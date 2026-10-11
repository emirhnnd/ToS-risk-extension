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
    // C0 kontrol karakterleri (gerçek Getir sayfasında \u0001 görüldü) metinden atılır
    .map((l) => l.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const merged: string[] = [];
  let carry = '';
  for (const line of lines) {
    // Satır içi link/kalın yazı page-agent çıktısında cümleyi böler (gerçek Spotify sayfasında görüldü):
    //   '... (toplu olarak "'  +  'Spotify Hizmeti ") ve ...'  → tek cümle
    if (carry && !continues(carry, line) && carry.length >= MIN_SEGMENT_CHARS) {
      merged.push(carry);
      carry = '';
    }
    carry = carry ? `${carry} ${line}` : line;
  }
  if (carry) merged.push(carry);

  const pieces = merged.map(tidyInline).flatMap(splitLong);
  return pieces.map((t, i) => ({ id: `S${i + 1}`, text: t }));
}

/** Önceki satır cümleyi bitirmediyse veya sonraki satır cümlenin devamıysa true. */
function continues(prev: string, next: string): boolean {
  const endsSentence = /[.!?:;]["'”’)\]]*$/.test(prev);
  const nextIsContinuation = /^[\p{Ll}"'”’),.;:!?\]]/u.test(next);
  return !endsSentence || nextIsContinuation;
}

/**
 * Satır birleştirmenin bıraktığı boşluk izlerini temizler (yalnızca görüntü; eşleştirme
 * normalizeForMatch ile zaten boşluktan bağımsızdır):
 *   '(" Spotify Hizmeti ")' → '("Spotify Hizmeti")'   'Politikası 'na' → 'Politikası'na'
 */
export function tidyInline(t: string): string {
  return tidyStraightQuotes(t)
    .replace(/“\s+/g, '“')
    .replace(/\s+”/g, '”')
    .replace(/(\p{L}) (['’])(\p{Ll}{1,5})(?![\p{L}'’])/gu, '$1$2$3')
    .replace(/\s+([,.;:!?])(?=\s|$)/g, '$1');
}

/** Düz çift tırnakları sırayla açılış/kapanış sayar; açılıştan sonraki ve kapanıştan önceki boşluğu siler.
 *  Tek sayıda tırnak varsa eşleşme belirsizdir, metne dokunulmaz. */
function tidyStraightQuotes(t: string): string {
  const parts = t.split('"');
  if (parts.length % 2 === 0) return t; // tek sayıda tırnak
  return parts
    .map((p, i) => (i % 2 === 1 ? p.trim() : p)) // tırnak içleri
    .join('"');
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
