import type { Segment } from '../shared/schema';

export const MAX_SEGMENT_CHARS = 1200;
/** Bu uzunluktan kısa satırlar (başlıklar, "1.", "Madde 3") bir sonrakine eklenir */
export const MIN_SEGMENT_CHARS = 40;

/**
 * Görünür düz metni numaralı segmentlere böler: S1, S2, ...
 * - Satır/paragraf sınırlarından böler.
 * - Çok kısa satırları sonraki satırla birleştirir (başlık + gövde).
 * - Çok uzun paragrafları cümle sınırından böler.
 * Saf fonksiyon: aynı girdi → aynı çıktı.
 */
export function segmentText(text: string): Segment[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const merged: string[] = [];
  let carry = '';
  for (const line of lines) {
    const cur = carry ? `${carry} ${line}` : line;
    if (cur.length < MIN_SEGMENT_CHARS) {
      carry = cur;
    } else {
      merged.push(cur);
      carry = '';
    }
  }
  if (carry) merged.push(carry);

  const pieces = merged.flatMap(splitLong);
  return pieces.map((t, i) => ({ id: `S${i + 1}`, text: t }));
}

function splitLong(p: string): string[] {
  if (p.length <= MAX_SEGMENT_CHARS) return [p];
  const sentences = p.match(/[^.!?;]+[.!?;]+["')\]]*\s*|[^.!?;]+$/g) ?? [p];
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf + s).length > MAX_SEGMENT_CHARS) {
      out.push(buf.trim());
      buf = '';
    }
    // Tek cümle sınırı aşıyorsa sert kes
    if (s.length > MAX_SEGMENT_CHARS) {
      for (let i = 0; i < s.length; i += MAX_SEGMENT_CHARS) out.push(s.slice(i, i + MAX_SEGMENT_CHARS).trim());
      continue;
    }
    buf += s;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((x) => x.length > 0);
}

/**
 * Bütçeye sığan segmentleri seçer ve kapsama oranını döner.
 * Kapsama < 1 ise rapor "metnin bir kısmı analiz edilemedi" belirsizliği gösterir.
 */
export function selectWithinBudget(segments: readonly Segment[], maxChars: number): { selected: Segment[]; coverage: number } {
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const selected: Segment[] = [];
  let used = 0;
  for (const s of segments) {
    if (used + s.text.length > maxChars) break;
    selected.push(s);
    used += s.text.length;
  }
  return { selected, coverage: total === 0 ? 0 : used / total };
}
