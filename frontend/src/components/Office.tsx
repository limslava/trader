import { useEffect, useRef } from 'react';
import type { ArenaAgent, ArenaGroup } from '../api';

/**
 * Pixel-art office for the Arena. Every agent has a workstation; thinking agents check the market on their phone,
 * stopped ones doze at the desk, idle ones go for water or coffee, sit on the sofa in front of the TV or meet a
 * colleague at the conference table. A speech bubble shows the last fill; a crown marks the room's leader.
 * Tiles: LimeZu "Modern Office" + "Modern Interiors" (licensed; see public/office/LICENSE-*).
 */

const T = 16;
const CHARS = 20; // premade characters, char-01 … char-20
// Rows in a premade character sheet (16x32 frames): idle/walk have 4 directions × 6 frames (right, up, left, down).
const ROW = { idle: 32, walk: 64, sleep: 96, sit: 128, phone: 192 };

type Sprites = Record<string, HTMLImageElement>;
const cache: Sprites = {};
function load(name: string): Promise<HTMLImageElement> {
  if (cache[name]) return Promise.resolve(cache[name]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve((cache[name] = img));
    img.onerror = reject;
    img.src = `/office/${name}.png`;
  });
}

type Spot = { kind: 'cooler' | 'coffee' | 'sofa' | 'meet'; x: number; y: number; face: 0 | 1 | 2 | 3; busy: number | null };
type Visual = {
  x: number;
  y: number;
  dir: number;
  t: number;
  path: { x: number; y: number }[] | null;
  pause: number;
  home: { x: number; y: number };
  spot: Spot | null;
  stay: number;
  mood: string;
};

type Room = { group: ArenaGroup; top: number; height: number; rows: number; spots: Spot[] };

const COLS_WIDE = 4;
const COLS_NARROW = 2;
const STATION_W = 5 * T;
const STATION_H = 6 * T;
const ROOM_PAD_TOP = 3 * T;
const ROOM_PAD_BOTTOM = 5 * T; // conference corner
const SIDE = T;
const LOUNGE_W = 6 * T;

function layout(groups: ArenaGroup[], cols: number) {
  const rooms: Room[] = [];
  let top = 0;
  const width = SIDE + cols * STATION_W + LOUNGE_W + SIDE;
  for (const g of groups) {
    if (g.agents.length === 0) continue;
    const rows = Math.ceil(g.agents.length / cols);
    const height = ROOM_PAD_TOP + rows * STATION_H + ROOM_PAD_BOTTOM;
    const lx = SIDE + cols * STATION_W + T; // lounge column
    const by = top + height - ROOM_PAD_BOTTOM; // bottom strip
    const spots: Spot[] = [
      { kind: 'cooler', x: lx + 4, y: top + ROOM_PAD_TOP + 22, face: 1, busy: null },
      { kind: 'coffee', x: lx + 40, y: top + ROOM_PAD_TOP + 22, face: 1, busy: null },
      { kind: 'sofa', x: lx + 2, y: top + ROOM_PAD_TOP + 58, face: 3, busy: null },
      { kind: 'sofa', x: lx + 18, y: top + ROOM_PAD_TOP + 58, face: 3, busy: null },
      { kind: 'meet', x: SIDE + 8, y: by + 22, face: 0, busy: null },
      { kind: 'meet', x: SIDE + 8 + 96, y: by + 22, face: 2, busy: null },
    ];
    rooms.push({ group: g, top, height, rows, spots });
    top += height;
  }
  return { rooms, width, height: top };
}

const stationPos = (room: Room, index: number, cols: number) => ({
  x: SIDE + (index % cols) * STATION_W + T,
  y: room.top + ROOM_PAD_TOP + Math.floor(index / cols) * STATION_H,
});

export function Office({ groups, selected, onSelect }: { groups: ArenaGroup[]; selected?: number; onSelect: (id: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visuals = useRef(new Map<number, Visual>());
  const latest = useRef({ groups, selected, onSelect });
  latest.current = { groups, selected, onSelect };
  const resizeRef = useRef<() => void>(() => {});
  const key = groups.map((g) => `${g.key}:${g.agents.length}`).join('|');
  useEffect(() => resizeRef.current(), [key]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let hover = -1;
    let clock = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cols = wrap.clientWidth >= 620 ? COLS_WIDE : COLS_NARROW;
    const sheets: Sprites = {};
    let rooms: Room[] = [];

    const index = () => {
      const map = new Map<number, { agent: ArenaAgent; home: { x: number; y: number }; room: Room }>();
      for (const room of rooms) room.group.agents.forEach((a, i) => map.set(a.id, { agent: a, home: stationPos(room, i, cols), room }));
      return map;
    };

    const resize = () => {
      cols = wrap.clientWidth >= 620 ? COLS_WIDE : COLS_NARROW;
      const l = layout(latest.current.groups, cols);
      rooms = l.rooms;
      const scale = Math.max(1, wrap.clientWidth / l.width);
      canvas.width = l.width;
      canvas.height = l.height;
      canvas.style.width = '100%';
      canvas.style.height = `${Math.round(l.height * scale)}px`;
      ctx.imageSmoothingEnabled = false;
      const map = index();
      for (const [id, v] of visuals.current) {
        const e = map.get(id);
        if (!e) continue;
        v.home = e.home;
        v.path = null;
        v.spot = null;
        v.x = e.home.x + T;
        v.y = e.home.y + 4;
      }
    };

    const tile = (sheet: string, sx: number, sy: number, w: number, h: number, dx: number, dy: number) => {
      const img = sheets[sheet];
      if (img) ctx.drawImage(img, sx, sy, w, h, Math.round(dx), Math.round(dy), w, h);
    };

    const takeSpot = (room: Room, forId: number): Spot | null => {
      const free = room.spots.filter((s) => s.busy === null);
      if (!free.length) return null;
      // Someone is waiting at the conference table: join them rather than wander off alone.
      const waiting = room.spots.some((s) => s.kind === 'meet' && s.busy !== null && s.busy !== forId);
      const meet = free.find((s) => s.kind === 'meet');
      const pick = waiting && meet ? meet : free[Math.floor(Math.random() * free.length)];
      pick.busy = forId;
      return pick;
    };

    const planTrip = (v: Visual, room: Room, id: number) => {
      const spot = takeSpot(room, id);
      if (!spot) {
        v.pause = 5 + Math.random() * 10;
        return;
      }
      v.spot = spot;
      const aisle = v.home.y + STATION_H - 6;
      v.path = [
        { x: v.home.x + T, y: aisle },
        { x: spot.x, y: aisle },
        { x: spot.x, y: spot.y + 4 },
      ];
      v.stay = spot.kind === 'sofa' ? 10 + Math.random() * 10 : spot.kind === 'meet' ? 12 + Math.random() * 8 : 4 + Math.random() * 4;
      v.mood = spot.kind === 'coffee' ? 'кофе' : spot.kind === 'cooler' ? 'вода' : '';
    };

    const goHome = (v: Visual) => {
      if (v.spot) v.spot.busy = null;
      v.spot = null;
      const aisle = v.home.y + STATION_H - 6;
      v.path = [
        { x: v.x, y: aisle },
        { x: v.home.x + T, y: aisle },
        { x: v.home.x + T, y: v.home.y + 4 },
      ];
      v.mood = '';
    };

    const step = (v: Visual, dt: number) => {
      if (!v.path?.length) return;
      const p = v.path[0];
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const dist = Math.hypot(dx, dy);
      const speed = 34 * dt;
      if (dist <= speed) {
        v.x = p.x;
        v.y = p.y;
        v.path.shift();
        if (!v.path.length) {
          v.path = null;
          v.dir = v.spot ? v.spot.face : 3;
          if (!v.spot) v.pause = 10 + Math.random() * 25;
        }
        return;
      }
      v.x += (dx / dist) * speed;
      v.y += (dy / dist) * speed;
      v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 3 : 1;
    };

    const clip = (text: string, maxW: number) => {
      if (ctx.measureText(text).width <= maxW) return text;
      let t = text;
      while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
      return `${t}…`;
    };

    const label = (raw: string, cx: number, y: number, font: string, active: boolean, maxW = STATION_W - 14) => {
      ctx.font = font;
      const text = clip(raw, maxW);
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = active ? '#6b5cff' : 'rgba(255,255,255,0.92)';
      ctx.fillRect(Math.round(cx - w / 2), y, Math.round(w), 11);
      ctx.fillStyle = active ? '#ffffff' : '#2a2520';
      ctx.fillText(text, Math.round(cx - w / 2) + 4, y + 2);
      return w;
    };

    const bubble = (text: string, x: number, y: number) => {
      ctx.font = '500 7px Onest, Arial, sans-serif';
      const bw = ctx.measureText(text).width + 8;
      const bx = Math.max(1, Math.min(canvas.width - bw - 1, Math.round(x - bw / 2)));
      const by = Math.round(y);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by, Math.round(bw), 10);
      ctx.strokeStyle = '#2a2520';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, Math.round(bw) - 1, 9);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(text, bx + 4, by + 1);
    };

    const drawRoom = (room: Room) => {
      const { top, height } = room;
      for (let y = top; y < top + height; y += T) for (let x = 0; x < canvas.width; x += T) tile('room-office', 176, 80, T, T, x, y);
      for (let x = 0; x < canvas.width; x += T) tile('room-office', 16, 176, T, 2 * T, x, top);
      // Wall: TV with the news, whiteboard chart, a shelf.
      tile('tv', (Math.floor(clock * 6) % 36) * 32, 0, 32, 32, SIDE + 8, top + 4);
      tile('office', 144, 192, 32, 32, canvas.width - LOUNGE_W - T - 8, top + 2);
      tile('office', 112, 192, 32, 32, canvas.width - LOUNGE_W + 12, top + 2);
      const lx = SIDE + cols * STATION_W + T;
      const ly = top + ROOM_PAD_TOP;
      // Lounge column: cooler, coffee corner, sofa and table, palm, server rack.
      tile('office', 192, 240, 16, 32, lx + 4, ly - 12);
      tile('living', 64, 480, 32, 32, lx + 32, ly - 12);
      tile('coffee', (Math.floor(clock * 2) % 3) * 32, 0, 32, 32, lx + 32, ly - 18);
      tile('living', 0, 448, 48, 32, lx, ly + 44);
      tile('living', 0, 480, 48, 32, lx, ly + 76);
      tile('office', 96, 128, 16, 32, lx + 56, ly + 52);
      tile('living', 208, 0, 48, 32, lx + 20, top + height - ROOM_PAD_BOTTOM + 4);
      tile('server', (Math.floor(clock * 3) % 3) * 16, 0, 16, 48, canvas.width - SIDE - 20, top + height - ROOM_PAD_BOTTOM + 8);
      // Conference corner at the bottom-left.
      const by = top + height - ROOM_PAD_BOTTOM;
      tile('conf', 80, 96, 80, 48, SIDE + 24, by + 10);
      tile('conf', 176, 96, 16, 32, SIDE + 8, by + 18);
      tile('conf', 176, 96, 16, 32, SIDE + 104, by + 18);
      tile('office', 96, 160, 16, 32, SIDE + 120, by + 24);
      ctx.font = '600 9px Onest, Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#4a4660';
      ctx.fillText(`${room.group.title} · ${room.group.agents.length}`, SIDE + 48, top + 6);
    };

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced) clock += dt;
      const map = index();
      const agents = latest.current.groups.flatMap((g) => g.agents);

      for (const a of agents) {
        const e = map.get(a.id);
        if (!e) continue;
        let v = visuals.current.get(a.id);
        if (!v) {
          v = { x: e.home.x + T, y: e.home.y + 4, dir: 3, t: Math.random() * 100, path: null, pause: 5 + Math.random() * 20, home: e.home, spot: null, stay: 0, mood: '' };
          visuals.current.set(a.id, v);
        }
        v.home = e.home;
        const idle = a.status === 'active' && !a.running;
        if (reduced) continue;
        v.t += dt;
        if (v.path) step(v, dt);
        else if (v.spot) {
          v.stay -= dt;
          if (v.stay <= 0 || !idle) goHome(v);
        } else if (idle) {
          v.pause -= dt;
          if (v.pause <= 0) planTrip(v, e.room, a.id);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const room of rooms) drawRoom(room);
      for (const a of agents) {
        const e = map.get(a.id);
        if (e) tile('office', 16, 416, 48, 48, e.home.x, e.home.y - T);
      }
      const leaders = new Set(rooms.map((r) => r.group.agents[0]?.id));
      const order = agents.filter((a) => map.has(a.id) && visuals.current.has(a.id)).sort((p, q) => visuals.current.get(p.id)!.y - visuals.current.get(q.id)!.y);
      for (const a of order) {
        const v = visuals.current.get(a.id)!;
        const e = map.get(a.id)!;
        const sheet = `char-${String((a.id % CHARS) + 1).padStart(2, '0')}`;
        const atDesk = !v.path && !v.spot;
        let sx = 0;
        let sy = ROW.idle;
        if (v.path) {
          sy = ROW.walk;
          sx = (v.dir * 6 + (Math.floor(v.t * 8) % 6)) * 16;
        } else if (v.spot?.kind === 'sofa' || v.spot?.kind === 'meet') {
          sy = ROW.sit;
          const right = v.spot.kind === 'sofa' || v.spot.face === 0;
          sx = ((right ? 0 : 6) + (Math.floor(v.t * 3) % 6)) * 16;
        } else if (atDesk && a.status === 'stopped') {
          sy = ROW.sleep;
          sx = (Math.floor(v.t * 2) % 6) * 16;
        } else if (atDesk && a.running) {
          sy = ROW.phone;
          sx = (3 + (Math.floor(v.t * 6) % 6)) * 16;
        } else {
          sx = ((v.spot ? v.spot.face : 3) * 6 + (Math.floor(v.t * 4) % 6)) * 16;
        }
        ctx.save();
        if (a.status === 'stopped') ctx.filter = 'brightness(0.85)';
        tile(sheet, sx, sy, 16, 32, v.x, v.y);
        ctx.restore();
        if (leaders.has(a.id)) {
          ctx.fillStyle = '#f2c230';
          const cx = Math.round(v.x) + 5;
          const cy = Math.round(v.y) - 5 + (Math.floor(v.t * 2) % 2);
          ctx.fillRect(cx, cy + 2, 6, 2);
          ctx.fillRect(cx, cy, 1, 2);
          ctx.fillRect(cx + 5, cy, 1, 2);
          ctx.fillRect(cx + 2, cy, 2, 2);
        }
        if (!atDesk) tile('office', 0, 128, 16, 32, e.home.x + T, e.home.y + 2);
        tile('office', 128, 448, 48, 32, e.home.x, e.home.y + 30);
        tile('office', 176, 416, 16, 32, e.home.x + T, e.home.y + 26);
        tile('office', 128, 416, 16, 32, e.home.x, e.home.y + 22);
      }
      ctx.textBaseline = 'top';
      for (const a of agents) {
        const v = visuals.current.get(a.id);
        const e = map.get(a.id);
        if (!v || !e) continue;
        const cx = e.home.x + T + 8;
        const active = a.id === latest.current.selected || a.id === hover;
        const [persona, model] = a.name.includes(' · ') ? a.name.split(' · ') : [a.name, ''];
        const w = label(persona, cx, e.home.y + 64, '600 8px Onest, Arial, sans-serif', active);
        if (model) label(model, cx, e.home.y + 75, '500 7px Onest, Arial, sans-serif', false);
        ctx.fillStyle = a.running ? '#ef9f27' : a.status === 'stopped' ? '#e24b4a' : '#1d9e75';
        ctx.fillRect(Math.round(cx + w / 2) - 7, e.home.y + 67, 4, 4);
        const atDesk = !v.path && !v.spot;
        let text = '';
        if (a.running) text = ['.', '..', '...'][Math.floor(v.t * 2) % 3];
        else if (a.status === 'stopped') text = 'z z z';
        else if (v.spot && !v.path) text = v.spot.kind === 'meet' ? (Math.floor(v.t) % 2 ? '…' : '') : v.mood;
        else if (atDesk && a.lastAction) text = clip(a.lastAction.split(', ')[0], STATION_W + 8);
        if (text) bubble(text, v.x + 8, v.y - 12 - (a.status === 'stopped' ? Math.floor(v.t * 2) % 2 : 0));
      }
      raf = requestAnimationFrame(frame);
    };

    const pick = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * canvas.width;
      const y = ((ev.clientY - r.top) / r.height) * canvas.height;
      let best = -1;
      for (const [id, v] of visuals.current) if (x >= v.x - 4 && x <= v.x + 20 && y >= v.y - 12 && y <= v.y + 36) best = id;
      if (best < 0) for (const [id, e] of index()) if (x >= e.home.x && x <= e.home.x + 48 && y >= e.home.y + 20 && y <= e.home.y + 84) best = id;
      return best;
    };
    const onMove = (ev: MouseEvent) => {
      hover = pick(ev);
      canvas.style.cursor = hover >= 0 ? 'pointer' : 'default';
    };
    const onClick = (ev: MouseEvent) => {
      const id = pick(ev);
      if (id >= 0) latest.current.onSelect(id);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    resizeRef.current = () => {
      if (Object.keys(sheets).length) resize();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const names = ['room-office', 'office', 'living', 'conf', 'tv', 'server', 'coffee', ...Array.from({ length: CHARS }, (_, i) => `char-${String(i + 1).padStart(2, '0')}`)];
    Promise.all(names.map((n) => load(n).then((img) => (sheets[n] = img))))
      .then(() => {
        if (!alive) return;
        resize();
        raf = requestAnimationFrame(frame);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="block w-full rounded-2xl [image-rendering:pixelated]" aria-label="Офис: агенты арены за рабочими местами" />
    </div>
  );
}
