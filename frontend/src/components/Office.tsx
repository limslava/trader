import { useEffect, useRef } from 'react';
import type { ArenaAgent, ArenaGroup } from '../api';

/**
 * Pixel-art office for the Arena: every agent sits at a workstation, thinking agents type, idle ones wander to the
 * cooler or a plant, stopped ones doze, and a speech bubble shows the last fill. One room per tournament.
 * Tiles: LimeZu "Modern Office" and the free "Modern Interiors" characters (see public/office/LICENSE-*).
 */

const T = 16;
const SKINS = ['adam', 'alex', 'amelia', 'bob'] as const;
// Four base characters read as many people with a hue shift per agent.
const TINTS = ['', 'hue-rotate(35deg)', 'hue-rotate(-45deg)', 'hue-rotate(110deg) saturate(1.15)', 'hue-rotate(190deg)', 'saturate(0.45)', 'hue-rotate(75deg)', 'hue-rotate(-100deg)'];

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

type Visual = { x: number; y: number; dir: number; t: number; path: { x: number; y: number }[] | null; pause: number; home: { x: number; y: number } };

type Room = { group: ArenaGroup; top: number; rows: number; lounge: { x: number; y: number }[] };

const COLS_WIDE = 4;
const COLS_NARROW = 2;
const STATION_W = 5 * T;
const STATION_H = 6 * T;
const ROOM_PAD_TOP = 3 * T; // wall + whiteboard strip
const ROOM_PAD_BOTTOM = 2 * T;
const SIDE = 1 * T;
const LOUNGE_W = 3 * T;

function layout(groups: ArenaGroup[], cols: number) {
  const rooms: Room[] = [];
  let top = 0;
  for (const g of groups) {
    if (g.agents.length === 0) continue;
    const rows = Math.ceil(g.agents.length / cols);
    const h = ROOM_PAD_TOP + rows * STATION_H + ROOM_PAD_BOTTOM;
    const loungeX = SIDE + cols * STATION_W + T;
    const lounge = [
      { x: loungeX + 8, y: top + ROOM_PAD_TOP + 10 },
      { x: loungeX + 8, y: top + h - ROOM_PAD_BOTTOM - 8 },
      { x: SIDE + 4, y: top + h - ROOM_PAD_BOTTOM - 8 },
    ];
    rooms.push({ group: g, top, rows, lounge });
    top += h;
  }
  const width = SIDE + cols * STATION_W + LOUNGE_W + SIDE;
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cols = wrap.clientWidth >= 620 ? COLS_WIDE : COLS_NARROW;
    let scale = 1;
    const sheets: Sprites = {};

    const all = () => latest.current.groups.flatMap((g) => g.agents);
    const agentIndex = () => {
      const map = new Map<number, { agent: ArenaAgent; home: { x: number; y: number }; room: Room; idx: number }>();
      const { rooms } = layout(latest.current.groups, cols);
      for (const room of rooms) room.group.agents.forEach((a, i) => map.set(a.id, { agent: a, home: stationPos(room, i, cols), room, idx: i }));
      return { map, rooms };
    };

    const resize = () => {
      cols = wrap.clientWidth >= 620 ? COLS_WIDE : COLS_NARROW;
      const { width, height } = layout(latest.current.groups, cols);
      scale = Math.max(1, Math.floor((wrap.clientWidth / width) * 2) / 2);
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width * scale}px`;
      canvas.style.height = `${height * scale}px`;
      ctx.imageSmoothingEnabled = false;
      // Homes move when the column count changes: snap everyone back to their desk.
      const { map } = agentIndex();
      for (const [id, v] of visuals.current) {
        const e = map.get(id);
        if (!e) continue;
        v.home = e.home;
        if (!v.path) {
          v.x = e.home.x + T;
          v.y = e.home.y + 4;
        }
      }
    };

    const tile = (sheet: string, sx: number, sy: number, w: number, h: number, dx: number, dy: number) => {
      const img = sheets[sheet];
      if (img) ctx.drawImage(img, sx, sy, w, h, Math.round(dx), Math.round(dy), w, h);
    };

    const planWalk = (v: Visual, room: Room) => {
      const target = room.lounge[Math.floor(Math.random() * room.lounge.length)];
      const aisle = v.home.y + STATION_H - 6;
      v.path = [
        { x: v.home.x + T, y: aisle },
        { x: target.x, y: aisle },
        { x: target.x, y: target.y },
        { x: target.x, y: aisle },
        { x: v.home.x + T, y: aisle },
        { x: v.home.x + T, y: v.home.y + 4 },
      ];
    };

    const step = (v: Visual, dt: number) => {
      if (!v.path?.length) return;
      const p = v.path[0];
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const dist = Math.hypot(dx, dy);
      const speed = 36 * dt;
      if (dist <= speed) {
        v.x = p.x;
        v.y = p.y;
        v.path.shift();
        if (!v.path.length) {
          v.path = null;
          v.dir = 3;
          v.pause = 8 + Math.random() * 20;
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

    const label = (raw: string, cx: number, y: number, font: string, active: boolean) => {
      ctx.font = font;
      const text = clip(raw, STATION_W - 14);
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = active ? '#6b5cff' : 'rgba(255,255,255,0.92)';
      ctx.fillRect(Math.round(cx - w / 2), y, Math.round(w), 11);
      ctx.fillStyle = active ? '#ffffff' : '#2a2520';
      ctx.fillText(text, Math.round(cx - w / 2) + 4, y + 2);
      return w;
    };

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { map, rooms } = agentIndex();
      const agents = all();

      // Sync visuals with the current agent list.
      for (const a of agents) {
        const e = map.get(a.id)!;
        let v = visuals.current.get(a.id);
        if (!v) {
          v = { x: e.home.x + T, y: e.home.y + 4, dir: 3, t: Math.random() * 100, path: null, pause: 3 + Math.random() * 15, home: e.home };
          visuals.current.set(a.id, v);
        }
        v.home = e.home;
        const idle = a.status === 'active' && !a.running;
        if (!reduced) {
          v.t += dt;
          if (idle) {
            if (v.path) step(v, dt);
            else {
              v.pause -= dt;
              if (v.pause <= 0) planWalk(v, e.room);
            }
          } else if (v.path) step(v, dt);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Rooms: floor, wall, whiteboard, plants, cooler, title.
      for (const room of rooms) {
        const h = ROOM_PAD_TOP + room.rows * STATION_H + ROOM_PAD_BOTTOM;
        for (let y = room.top; y < room.top + h; y += T) for (let x = 0; x < canvas.width; x += T) tile('room-office', 176, 80, T, T, x, y);
        for (let x = 0; x < canvas.width; x += T) tile('room-office', 16, 176, T, 2 * T, x, room.top);
        tile('office', 144, 192, 32, 32, canvas.width - LOUNGE_W - T - 24, room.top + 2);
        const lx = SIDE + cols * STATION_W + T;
        tile('office', 192, 240, 16, 32, lx + 8, room.top + ROOM_PAD_TOP - 14);
        tile('office', 96, 128, 16, 32, lx + 8, room.top + h - ROOM_PAD_BOTTOM - 22);
        tile('office', 96, 160, 16, 32, SIDE, room.top + h - ROOM_PAD_BOTTOM - 22);
        ctx.font = '600 9px Onest, Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#4a4660';
        ctx.fillText(`${room.group.title} · ${room.group.agents.length}`, SIDE + 4, room.top + 6);
      }
      // Partitions and desks (back layer), then characters sorted by y, then the desk fronts.
      for (const a of agents) {
        const { home } = map.get(a.id)!;
        tile('office', 16, 416, 48, 48, home.x, home.y - T);
      }
      const order = [...agents].sort((p, q) => visuals.current.get(p.id)!.y - visuals.current.get(q.id)!.y);
      for (const a of order) {
        const v = visuals.current.get(a.id)!;
        const e = map.get(a.id)!;
        const seated = !v.path;
        const skin = SKINS[a.id % SKINS.length];
        const sheet = v.path ? `${skin}-run` : `${skin}-idle`;
        const f = a.running ? Math.floor(v.t * 10) % 6 : a.status === 'stopped' ? 0 : Math.floor(v.t * 4) % 6;
        const dir = v.path ? v.dir : 3;
        ctx.save();
        const tint = TINTS[Math.floor(a.id / SKINS.length) % TINTS.length];
        ctx.filter = a.status === 'stopped' ? `${tint} brightness(0.8)`.trim() : tint || 'none';
        tile(sheet, (dir * 6 + f) * 16, 0, 16, 32, v.x, v.y);
        ctx.restore();
        if (!seated) tile('office', 0, 128, 16, 32, e.home.x + T, e.home.y + 2);
        tile('office', 128, 448, 48, 32, e.home.x, e.home.y + 30);
        tile('office', 176, 416, 16, 32, e.home.x + T, e.home.y + 26);
        tile('office', 128, 416, 16, 32, e.home.x, e.home.y + 22);
      }
      // Names, status dots, bubbles.
      ctx.textBaseline = 'top';
      for (const a of agents) {
        const v = visuals.current.get(a.id)!;
        const e = map.get(a.id)!;
        const cx = e.home.x + T + 8;
        const active = a.id === latest.current.selected || a.id === hover;
        // "Persona · model" takes two lines so neighbours never collide.
        const [persona, model] = a.name.includes(' · ') ? a.name.split(' · ') : [a.name, ''];
        const w = label(persona, cx, e.home.y + 64, '600 8px Onest, Arial, sans-serif', active);
        if (model) label(model, cx, e.home.y + 75, '500 7px Onest, Arial, sans-serif', false);
        ctx.fillStyle = a.running ? '#ef9f27' : a.status === 'stopped' ? '#e24b4a' : '#1d9e75';
        ctx.fillRect(Math.round(cx + w / 2) - 7, e.home.y + 67, 4, 4);
        const raw = a.running ? ['.', '..', '...'][Math.floor(v.t * 2) % 3] : a.status === 'stopped' ? 'z z z' : a.lastAction && !v.path ? a.lastAction : '';
        if (raw) {
          const bob = a.status === 'stopped' ? Math.floor(v.t * 2) % 2 : 0;
          ctx.font = '500 7px Onest, Arial, sans-serif';
          // Several fills in one run: show the first, the journal has the rest.
          const text = clip(raw.split(', ')[0], STATION_W + 8);
          const bw = ctx.measureText(text).width + 8;
          const bx = Math.max(1, Math.min(canvas.width - bw - 1, Math.round(v.x + 8 - bw / 2)));
          const by = Math.round(v.y - 12 - bob);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx, by, Math.round(bw), 10);
          ctx.strokeStyle = '#2a2520';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 0.5, by + 0.5, Math.round(bw) - 1, 9);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillText(text, bx + 4, by + 1);
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const pick = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * canvas.width;
      const y = ((ev.clientY - r.top) / r.height) * canvas.height;
      let best = -1;
      for (const [id, v] of visuals.current) if (x >= v.x - 4 && x <= v.x + 20 && y >= v.y - 12 && y <= v.y + 64) best = id;
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
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    Promise.all(['room-office', 'office', ...SKINS.flatMap((s) => [`${s}-idle`, `${s}-run`])].map((n) => load(n).then((img) => (sheets[n] = img))))
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
    <div ref={wrapRef} className="overflow-x-auto">
      <canvas ref={canvasRef} className="block rounded-2xl [image-rendering:pixelated]" aria-label="Офис: агенты арены за рабочими местами" />
    </div>
  );
}
