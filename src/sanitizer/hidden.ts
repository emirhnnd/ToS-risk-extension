import type { HiddenTextFinding } from '../shared/schema';
import { normalizeForMatch } from '../validator/normalize';
import { looksLikeInstruction } from './instructions';

/**
 * Sayfada kullanıcıya GÖRÜNMEYEN ama DOM'da bulunan metinleri bulur.
 * Bunlar LLM'e gönderilmez; raporda "şüpheli gizli içerik" olarak listelenir.
 *
 * Yakalananlar: display:none, visibility:hidden, opacity:0, ~0 px font,
 * ekran dışı konum, clip / clip-path ile kırpma, şeffaf veya arka planla aynı renk.
 * Bilinçli olarak yakalanMAyanlar (README "Sınırlamalar"):
 *  - aria-hidden: görsel olarak görünür, gizleme tekniği değildir.
 *  - Başka bir elemanın arkasına saklanan metin (z-index), arka plan resmi üstüne aynı renk.
 */
export const MIN_HIDDEN_TEXT_CHARS = 12;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'OBJECT', 'HEAD', 'META', 'LINK']);

type Reason = HiddenTextFinding['reason'];

export function findHiddenText(root: Element = document.body, win: Window = window): HiddenTextFinding[] {
  const found = new Map<Element, { reason: Reason; text: string }>();
  const walker = win.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    if (text.length === 0) continue;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName.toUpperCase()) || isInsideOurPanel(parent)) continue;

    const hit = hiddenReason(parent, win);
    if (!hit) continue;
    const prev = found.get(hit.el);
    found.set(hit.el, { reason: hit.reason, text: prev ? `${prev.text} ${text}` : text });
  }

  return [...found.values()]
    .filter((h) => h.text.length >= MIN_HIDDEN_TEXT_CHARS)
    .map((h) => ({ reason: h.reason, text: h.text.slice(0, 2000), looks_like_instruction: looksLikeInstruction(h.text) }));
}

/** Elemanı veya bir atasını gizleyen ilk nedeni döner (gruplama için gizleyen elemanla birlikte). */
function hiddenReason(el: Element, win: Window): { reason: Reason; el: Element } | null {
  for (let cur: Element | null = el; cur && cur !== win.document.documentElement; cur = cur.parentElement) {
    const cs = win.getComputedStyle(cur);
    if (cs.display === 'none') return { reason: 'display_none', el: cur };
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return { reason: 'visibility_hidden', el: cur };
    if (parseFloat(cs.opacity) === 0) return { reason: 'zero_opacity', el: cur };
    if (isClipped(cs)) return { reason: 'clipped', el: cur };
  }
  const cs = win.getComputedStyle(el);
  // Yalnızca mutlak px değerine güven: "1.5em" gibi göreli değerler 1.5 px DEĞİLDİR.
  if (/^[\d.]+px$/.test(cs.fontSize) && parseFloat(cs.fontSize) < 2) return { reason: 'zero_size_font', el };
  if (isOffscreen(el, win)) return { reason: 'offscreen', el };
  const color = parseColor(cs.color);
  if (color && color.a === 0) return { reason: 'transparent', el };
  const bg = effectiveBackground(el, win);
  if (color && bg && colorDistance(color, bg) < 20) return { reason: 'same_color', el };
  return null;
}

function isClipped(cs: CSSStyleDeclaration): boolean {
  const clip = cs.clip?.replace(/\s/g, '');
  if (clip && /^rect\(0(px)?,?0(px)?,?0(px)?,?0(px)?\)$/.test(clip)) return true;
  const cp = cs.clipPath?.replace(/\s/g, '');
  return cp === 'inset(50%)' || cp === 'inset(100%)' || cp === 'circle(0px)' || cp === 'circle(0)';
}

function isOffscreen(el: Element, win: Window): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false; // ölçülemiyor (ör. jsdom); diğer kurallara bırak
  const docW = Math.max(win.document.documentElement.scrollWidth, win.innerWidth);
  const left = r.left + win.scrollX;
  const top = r.top + win.scrollY;
  return left + r.width < -100 || top + r.height < -100 || left > docW + 100;
}

interface Rgba { r: number; g: number; b: number; a: number }

export function parseColor(s: string): Rgba | null {
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (!m) return s === 'transparent' ? { r: 0, g: 0, b: 0, a: 0 } : null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a };
}

function effectiveBackground(el: Element, win: Window): Rgba | null {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const cs = win.getComputedStyle(cur);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // resim üstünde karşılaştırma yapılamaz
    const c = parseColor(cs.backgroundColor);
    if (c && c.a > 0.5) return c;
  }
  return { r: 255, g: 255, b: 255, a: 1 }; // tarayıcı varsayılanı
}

function colorDistance(a: Rgba, b: Rgba): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

function isInsideOurPanel(el: Element): boolean {
  return el.closest('#tos-risk-panel-host') !== null;
}

/**
 * Savunma derinliği: page-agent'in çıktısında gizli metinle aynı satır varsa çıkar.
 * (page-agent görünürlüğü kendi ölçütleriyle belirler; bizim ölçütlerimiz farklı olabilir.)
 */
export function removeHiddenLines(visibleText: string, hidden: readonly HiddenTextFinding[]): { text: string; removed: number } {
  const hiddenNorm = hidden.map((h) => normalizeForMatch(h.text)).filter((h) => h.length >= MIN_HIDDEN_TEXT_CHARS);
  if (hiddenNorm.length === 0) return { text: visibleText, removed: 0 };
  let removed = 0;
  const kept = visibleText.split('\n').filter((line) => {
    const n = normalizeForMatch(line);
    const isHidden = n.length >= MIN_HIDDEN_TEXT_CHARS && hiddenNorm.some((h) => h.includes(n) || n.includes(h));
    if (isHidden) removed++;
    return !isHidden;
  });
  return { text: kept.join('\n'), removed };
}
