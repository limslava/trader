import { Readability } from '@mozilla/readability';
import { Router } from 'express';
import { parseHTML } from 'linkedom';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, TtlCache } from '../http.js';

export const articleRouter = Router();

export type Article = {
  url: string;
  title: string;
  siteName: string | null;
  byline: string | null;
  paragraphs: string[];
  /** True when the page could not be read and only the RSS summary is available. */
  fallback: boolean;
  summary: string | null;
};

const cache = new TtlCache<Article>(60 * 60_000);
const MAX_BYTES = 3 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

/** Only public http(s) hosts: the server must never be talked into fetching localhost or the LAN. */
function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, 'Некорректная ссылка');
  }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, 'Поддерживаются только http(s)-ссылки');
  const h = u.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(h) ||
    h.includes(':')
  ) {
    throw new HttpError(400, 'Ссылка на внутренний адрес недопустима');
  }
  return u;
}

async function fetchPage(u: URL): Promise<string> {
  const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new HttpError(502, `Сайт ответил ${res.status}`);
  // Redirects could land anywhere; re-check the final host.
  assertPublicUrl(res.url);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new HttpError(502, 'Страница слишком большая');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new HttpError(502, 'Страница слишком большая');
  const ct = res.headers.get('content-type') ?? '';
  const charset = /charset=([\w-]+)/i.exec(ct)?.[1] ?? /charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString('latin1'))?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

const BLOCK = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'BR', 'TR', 'SECTION', 'ARTICLE', 'FIGCAPTION', 'PRE', 'UL', 'OL']);
const SKIP = new Set(['FIGURE', 'IMG', 'PICTURE', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'VIDEO', 'AUDIO', 'FORM', 'BUTTON']);

/** Text of a node tree with newlines at block boundaries, so inline links between <p>s are not lost. */
function walk(node: Node, out: string[]): void {
  if (node.nodeType === 3) {
    out.push(node.textContent ?? '');
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (SKIP.has(el.tagName)) return;
  const block = BLOCK.has(el.tagName);
  if (block) out.push('\n');
  for (const child of el.childNodes) walk(child, out);
  if (block) out.push('\n');
}

/** Lines that stop mid-sentence (a link split the paragraph) are glued to the next one. */
function mergeFragments(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    // Only glue clear fragments: a trailing comma/dash, or a lowercase continuation.
    const fragment = prev && (/[,;:—–-]$/.test(prev) || (/[а-яёa-z]$/.test(prev) && /^[а-яёa-z]/.test(line)));
    if (fragment) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

/** Metadata that Readability sometimes leaves in: URLs, ISO timestamps, tag clouds, contacts. */
function isJunk(line: string): boolean {
  if (/^https?:\/\//i.test(line) || /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(line)) return true;
  if (/@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s()-]{8,}\d/.test(line)) return true;
  const letters = (line.match(/[а-яёa-z]/gi) ?? []).length;
  return letters / line.length < 0.6;
}

export function extractArticle(html: string, url: string): Omit<Article, 'fallback' | 'summary' | 'url'> | null {
  const { document } = parseHTML(html);
  const parsed = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  if (!parsed?.content) return null;
  // Keep text only: no scripts, styles or third-party markup reach the browser.
  // linkedom parses a fragment so that documentElement IS the wrapper; walk from there.
  const { document: doc } = parseHTML(`<div id="root">${parsed.content}</div>`);
  const buf: string[] = [];
  walk((doc.querySelector('#root') ?? doc.documentElement) as unknown as Node, buf);
  const lines = buf
    .join('')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
  const title = (parsed.title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const paragraphs = [...new Set(mergeFragments(lines.filter((l) => !isJunk(l))).filter((t) => t.length >= 25 && t.toLowerCase() !== title))];
  if (paragraphs.join('').length < 200) return null;
  return {
    title: parsed.title || new URL(url).hostname,
    siteName: parsed.siteName ?? null,
    byline: parsed.byline ?? null,
    paragraphs: paragraphs.slice(0, 80),
  };
}

export async function getArticle(raw: string): Promise<Article> {
  const u = assertPublicUrl(raw);
  return cache.get(u.href, async () => {
    const { rows } = await pool.query<{ title: string; source: string; summary: string | null }>('SELECT title, source, summary FROM news_items WHERE url = $1', [u.href]);
    const known = rows[0];
    try {
      const extracted = extractArticle(await fetchPage(u), u.href);
      // Feed headlines are more reliable than whatever Readability picks (sites often return a section name).
      if (extracted) {
        const title = known?.title ?? extracted.title;
        const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
        // Pages often repeat the headline as the first paragraph; the window already shows it once.
        const paragraphs = extracted.paragraphs.filter((p) => norm(p) !== norm(title));
        return { url: u.href, ...extracted, paragraphs, title, siteName: known?.source ?? extracted.siteName, fallback: false, summary: known?.summary ?? null };
      }
    } catch (err) {
      console.warn(`Article fetch failed for ${u.hostname}:`, err instanceof Error ? err.message : err);
    }
    return { url: u.href, title: known?.title ?? u.hostname, siteName: known?.source ?? u.hostname, byline: null, paragraphs: [], fallback: true, summary: known?.summary ?? null };
  });
}

articleRouter.get('/article', async (req, res) => {
  const url = z.string().min(8).max(2000).parse(req.query.url);
  res.json(await getArticle(url));
});
