import type { HiddenTextFinding } from '../shared/schema';
import { normalizeForMatch } from '../validator/normalize';
import { looksLikeInstruction } from './instructions';

/**
 * Sayfada kullanıcıya GÖRÜNMEYEN ama DOM'da bulunan metinleri bulur.
 * Bunlar LLM'e gönderilmez; raporda "şüpheli gizli içerik" olarak listelenir.
 *
 * İki katman:
 *  1) CSS kuralları: display:none, visibility:hidden, opacity:0 (ve filter:opacity(0)),
 *     ~0 px font, clip / clip-path ile kırpma (dejenere inset/polygon/circle dahil),
 *     şeffaf (alfa < 0.1) veya arka planla aynı renk, ekran dışı konum.
 *  2) Geometri (yalnızca gerçek tarayıcıda; jsdom'da atlanır): metin düğümünün ÇİZİLEN
 *     dikdörtgenleri (Range.getClientRects) okunur. Böylece transform:scale(0) gibi alanı
 *     sıfırlayan teknikler ve overflow:hidden/clip bir atanın dışına itilen metin
 *     (text-indent:-9999px, 1px kutu) teknik teknik sayılmadan yakalanır.
 *     overflow:auto/scroll bilerek hariç: uzun sözleşmeler sık sık kaydırılabilir kutuda durur.
 * Bilinçli olarak yakalanMAyanlar (README "Sınırlamalar"):
 *  - aria-hidden: görsel olarak görünür, gizleme tekniği değildir.
 *  - Başka bir elemanın arkasına saklanan metin (z-index ile üstü örtülen), arka plan resmi üstüne aynı renk.
 * Gerçek Chromium'da 29 tekniklik test sayfası: cypress/fixtures/pages/terms-hidden-techniques.html
 */
export const MIN_HIDDEN_TEXT_CHARS = 12;
export const MIN_READABLE_FONT_PX = 4;
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

    const hit = hiddenReason(parent, win, node as Text);
    if (!hit) continue;
    const prev = found.get(hit.el);
    found.set(hit.el, { reason: hit.reason, text: prev ? `${prev.text} ${text}` : text });
  }

  return [...found.values()]
    .filter((h) => h.text.length >= MIN_HIDDEN_TEXT_CHARS)
    .map((h) => ({ reason: h.reason, text: h.text.slice(0, 2000), looks_like_instruction: looksLikeInstruction(h.text) }));
}

/** Elemanı veya bir atasını gizleyen ilk nedeni döner (gruplama için gizleyen elemanla birlikte). */
function hiddenReason(el: Element, win: Window, textNode?: Text): { reason: Reason; el: Element } | null {
  for (let cur: Element | null = el; cur && cur !== win.document.documentElement; cur = cur.parentElement) {
    const cs = win.getComputedStyle(cur);
    if (cs.display === 'none') return { reason: 'display_none', el: cur };
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return { reason: 'visibility_hidden', el: cur };
    if (parseFloat(cs.opacity) === 0 || filterOpacity(cs.filter) < 0.05) return { reason: 'zero_opacity', el: cur };
    if (isClipped(cs, cur)) return { reason: 'clipped', el: cur };
  }
  const cs = win.getComputedStyle(el);
  // Yalnızca mutlak px değerine güven: "1.5em" gibi göreli değerler 1.5 px DEĞİLDİR.
  // 4 px altı yazı okunamaz (gerçek sözleşmelerde en küçük dipnot ~8–9 px).
  if (/^[\d.]+px$/.test(cs.fontSize) && parseFloat(cs.fontSize) < MIN_READABLE_FONT_PX) return { reason: 'zero_size_font', el };
  if (isOffscreen(el, win)) return { reason: 'offscreen', el };
  const color = parseColor(cs.color);
  if (color && color.a < 0.1) return { reason: 'transparent', el };
  const bg = effectiveBackground(el, win);
  if (color && bg && colorDistance(color, bg) < 20) return { reason: 'same_color', el };
  if (textNode) return geometricReason(el, win, textNode);
  return null;
}

/** filter: opacity(x) değeri (yoksa 1). */
export function filterOpacity(filter: string | undefined): number {
  const m = filter?.match(/opacity\(\s*([\d.]+)(%?)\s*\)/);
  if (!m) return 1;
  return m[2] === '%' ? parseFloat(m[1]!) / 100 : parseFloat(m[1]!);
}

function hasLayout(win: Window): boolean {
  const r = win.document.documentElement.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

const area = (r: { width: number; height: number }) => Math.max(0, r.width) * Math.max(0, r.height);
function intersectArea(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Metnin gerçekten çizildiği alana bakar: sıfır alan veya overflow:hidden atası tarafından kırpılma. */
function geometricReason(el: Element, win: Window, textNode: Text): { reason: Reason; el: Element } | null {
  if (!hasLayout(win)) return null; // jsdom: yerleşim yok, karar verilemez
  const range = win.document.createRange();
  range.selectNodeContents(textNode);
  if (typeof range.getClientRects !== 'function') return null;
  const rects = [...range.getClientRects()];
  const total = rects.reduce((n, r) => n + area(r), 0);
  if (total < 1) return { reason: 'zero_size', el };
  for (let cur: Element | null = el; cur && cur !== win.document.body && cur !== win.document.documentElement; cur = cur.parentElement) {
    const cs = win.getComputedStyle(cur);
    const clips = (v: string) => v === 'hidden' || v === 'clip';
    if (!clips(cs.overflowX) && !clips(cs.overflowY)) continue;
    const box = cur.getBoundingClientRect();
    const visible = rects.reduce((n, r) => n + intersectArea(r, box), 0);
    // Gizli sayılır: metin kutunun tamamen dışında (text-indent:-9999px) ya da görünen kısmı
    // 3 px'ten alçak (1 px kutuya sıkıştırma). "…" ile kısaltılmış satır gizli SAYILMAZ: başı görünür.
    const visibleHeight = Math.max(0, ...rects.map((r) => Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top)));
    if (visible < 1 || visibleHeight < 3) return { reason: 'clipped', el: cur };
  }
  return null;
}

function isClipped(cs: CSSStyleDeclaration, el: Element): boolean {
  const clip = cs.clip?.replace(/\s/g, '');
  if (clip && /^rect\(0(px)?,?0(px)?,?0(px)?,?0(px)?\)$/.test(clip)) return true;
  return clipPathHidesAll(cs.clipPath, el.getBoundingClientRect());
}

/** clip-path elemanın tamamını gizliyor mu? inset / polygon / circle / ellipse için dejenere durumlar. */
export function clipPathHidesAll(clipPath: string | undefined, box: { width: number; height: number }): boolean {
  const cp = (clipPath ?? '').trim();
  if (!cp || cp === 'none') return false;
  const len = (v: string, ref: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v));
  const fn = cp.match(/^(inset|polygon|circle|ellipse)\((.*)\)/);
  if (!fn) return false;
  const [, kind, args] = fn as unknown as [string, string, string];
  if (kind === 'inset') {
    const vals = args.split(/\s+round\s+/)[0]!.trim().split(/\s+/);
    const [t, r = t, b = t, l = r] = vals as [string, string?, string?, string?];
    // Yüzde değerler kutu boyutundan bağımsız karar verir; px değerler için kutu boyutu gerekir
    const pctT = t.endsWith('%') ? parseFloat(t) : NaN, pctB = b!.endsWith('%') ? parseFloat(b!) : NaN;
    const pctL = l!.endsWith('%') ? parseFloat(l!) : NaN, pctR = r!.endsWith('%') ? parseFloat(r!) : NaN;
    if ((pctT || 0) + (pctB || 0) >= 100 || (pctL || 0) + (pctR || 0) >= 100) return true;
    if (box.width > 0 && box.height > 0) {
      return len(t, box.height) + len(b!, box.height) >= box.height || len(l!, box.width) + len(r!, box.width) >= box.width;
    }
    return false;
  }
  if (kind === 'circle' || kind === 'ellipse') {
    const radii = args.split(/\s+at\s+/)[0]!.trim().split(/\s+/).filter(Boolean);
    return radii.length > 0 && radii.some((v) => parseFloat(v) === 0);
  }
  // polygon: köşe noktalarının kapladığı alan (shoelace). Yüzdeler 100x100 kutuya göre ölçeklenir.
  const pts = args.replace(/^(nonzero|evenodd)\s*,/, '').split(',').map((p) => p.trim().split(/\s+/));
  if (pts.length < 3) return true;
  const W = box.width > 0 ? box.width : 100, H = box.height > 0 ? box.height : 100;
  const xy = pts.map(([x = '0', y = '0']) => [len(x, W), len(y, H)] as const);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]!, [x2, y2] = xy[(i + 1) % xy.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2 < 1;
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
