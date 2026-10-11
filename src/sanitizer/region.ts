import { normalizeForMatch } from '../validator/normalize';

/**
 * Menü, alt bilgi ve çerez uyarısı gibi sözleşme dışı metni ayıklar.
 * Gerçek Spotify sayfasında çerez uyarısı ("We and our partners process data…") metne
 * giriyordu; LLM bunu "veri paylaşımı" diye işaretleyip sahte FP üretebilirdi.
 *
 * Kural: sayfada <main> / [role=main] varsa ve sayfa metninin en az %40'ını içeriyorsa,
 * yalnızca o bölgede geçen satırlar tutulur. Aksi halde HİÇBİR satır atılmaz
 * (yanlışlıkla sözleşme metni atmaktansa gürültüyü tutmak tercih edilir).
 */
export const MIN_MAIN_SHARE = 0.4;

export interface RegionResult {
  text: string;
  region: 'main' | 'without_landmarks' | 'whole_page';
  dropped_lines: number;
}

export function restrictToMainContent(visibleText: string, doc: Document = document): RegionResult {
  const main = doc.querySelector('main, [role="main"]');
  const textOf = (el: Element | null) => normalizeForMatch((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '');
  const mainText = textOf(main);
  const bodyText = textOf(doc.body);
  if (!main || bodyText.length === 0 || mainText.length / bodyText.length < MIN_MAIN_SHARE) {
    return withoutLandmarks(visibleText, doc);
  }
  let dropped = 0;
  const kept = visibleText.split('\n').filter((line) => {
    const n = normalizeForMatch(line);
    const keep = n.length === 0 || mainText.includes(n);
    if (!keep) dropped++;
    return keep;
  });
  return { text: kept.join('\n'), region: 'main', dropped_lines: dropped };
}

/**
 * <main> yoksa: üst menü / gezinme / alt bilgi işaretli bölgelerde (header, nav, footer, role=banner|navigation|contentinfo)
 * geçen satırlar atılır. Bir satır bu bölgelerin DIŞINDA da geçiyorsa tutulur (ör. hem menüde hem metinde "Kullanım Koşulları").
 * Gerçek Amazon sayfasında üst menü kullanıcının konumunu ("Teslimat konumu: <semt> <posta kodu>") içeriyordu.
 */
const LANDMARKS = 'header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"]';

function withoutLandmarks(visibleText: string, doc: Document): RegionResult {
  const marks = [...doc.querySelectorAll(LANDMARKS)].filter((el) => !el.parentElement?.closest(LANDMARKS));
  if (marks.length === 0) return { text: visibleText, region: 'whole_page', dropped_lines: 0 };
  const landmarkText = normalizeForMatch(marks.map((el) => el.textContent ?? '').join(' '));
  const clone = doc.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(LANDMARKS).forEach((el) => el.remove());
  const restText = normalizeForMatch(clone.textContent ?? '');
  let dropped = 0;
  const kept = visibleText.split('\n').filter((line) => {
    const n = normalizeForMatch(line);
    const drop = n.length > 0 && landmarkText.includes(n) && !restText.includes(n);
    if (drop) dropped++;
    return !drop;
  });
  return { text: kept.join('\n'), region: dropped > 0 ? 'without_landmarks' : 'whole_page', dropped_lines: dropped };
}
