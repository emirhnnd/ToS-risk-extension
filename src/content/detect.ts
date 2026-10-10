import { normalizeForMatch } from '../validator/normalize';

/**
 * F1: Sayfanın sözleşme sayfası (ToS / gizlilik / abonelik) olma ihtimali, 0–1.
 * Saf, deterministik sezgi: URL, başlık ve metindeki anahtar kelimeler.
 * Düşük skor analizi engellemez; yalnızca "belirsizlik" nedeni olur.
 */
const URL_KEYWORDS = [
  'terms', 'tos', 'legal', 'privacy', 'policy', 'conditions', 'agreement', 'eula',
  'subscription', 'kosullar', 'kullanim', 'gizlilik', 'sozlesme', 'kvkk', 'aydinlatma', 'politika', 'uyelik',
];
const TITLE_KEYWORDS = [
  'terms of service', 'terms of use', 'terms and conditions', 'privacy policy', 'privacy notice',
  'user agreement', 'subscription terms', 'kullanim kosullari', 'kullanim sartlari', 'gizlilik politikasi',
  'uyelik sozlesmesi', 'aydinlatma metni', 'gizlilik bildirimi', 'abonelik',
];
const BODY_KEYWORDS = [
  'you agree', 'these terms', 'personal data', 'third parties', 'governing law', 'liability',
  'terminate', 'arbitration', 'kabul etmis', 'kisisel veri', 'ucuncu taraf', 'sorumluluk', 'fesih', 'yetkili mahkeme',
];

export function detectContractPage(url: string, title: string, bodySample: string): number {
  const u = normalizeForMatch(decodeSafe(url));
  const t = normalizeForMatch(title);
  const b = normalizeForMatch(bodySample.slice(0, 20000));

  const urlHit = URL_KEYWORDS.some((k) => u.includes(k)) ? 1 : 0;
  const titleHit = TITLE_KEYWORDS.some((k) => t.includes(k)) ? 1 : 0;
  const bodyHits = BODY_KEYWORDS.filter((k) => b.includes(k)).length;
  const bodyScore = Math.min(1, bodyHits / 4);

  return round2(0.3 * urlHit + 0.3 * titleHit + 0.4 * bodyScore);
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
const round2 = (x: number) => Math.round(x * 100) / 100;
