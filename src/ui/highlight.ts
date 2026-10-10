/**
 * Doğrulanmış alıntıyı sayfada bulup vurgular (CSS Custom Highlight API, DOM'u değiştirmez).
 * Eşleşme kelime bazlıdır; kelimeler arası boşluk/noktalama/satır sonu esnek.
 */
export const HIGHLIGHT_NAME = 'tos-risk-quote';

export function highlightQuote(quote: string, doc: Document = document): boolean {
  const words = quote.match(/[\p{L}\p{N}]+/gu);
  if (!words || words.length === 0) return false;
  const re = new RegExp(words.map(escapeRe).join('[^\\p{L}\\p{N}]+'), 'iu');

  const nodes: Text[] = [];
  const starts: number[] = [];
  let full = '';
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => ((n.parentElement?.closest('#tos-risk-panel-host, script, style, noscript')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    starts.push(full.length);
    nodes.push(n);
    full += n.data + ' ';
  }
  const m = re.exec(full);
  if (!m) return false;

  const range = doc.createRange();
  const [sNode, sOff] = locate(m.index, nodes, starts);
  const [eNode, eOff] = locate(m.index + m[0].length, nodes, starts);
  if (!sNode || !eNode) return false;
  range.setStart(sNode, sOff);
  range.setEnd(eNode, eOff);

  const css = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS;
  const HighlightCtor = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  if (css?.highlights && HighlightCtor) css.highlights.set(HIGHLIGHT_NAME, new HighlightCtor(range));
  ensureHighlightStyle(doc);
  (sNode.parentElement ?? doc.body).scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

function locate(pos: number, nodes: Text[], starts: number[]): [Text | undefined, number] {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1]! <= pos) i++;
  const node = nodes[i];
  return [node, Math.min(pos - (starts[i] ?? 0), node?.data.length ?? 0)];
}

function ensureHighlightStyle(doc: Document): void {
  if (doc.getElementById('tos-risk-highlight-style')) return;
  const style = doc.createElement('style');
  style.id = 'tos-risk-highlight-style';
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: #ffd54a; color: #000; }`;
  doc.head.appendChild(style);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
