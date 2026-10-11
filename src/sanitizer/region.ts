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
  region: 'main' | 'whole_page';
  dropped_lines: number;
}

export function restrictToMainContent(visibleText: string, doc: Document = document): RegionResult {
  const main = doc.querySelector('main, [role="main"]');
  const textOf = (el: Element | null) => normalizeForMatch((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '');
  const mainText = textOf(main);
  const bodyText = textOf(doc.body);
  if (!main || bodyText.length === 0 || mainText.length / bodyText.length < MIN_MAIN_SHARE) {
    return { text: visibleText, region: 'whole_page', dropped_lines: 0 };
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
