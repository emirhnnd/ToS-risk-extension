import type { Segment } from '../shared/schema';
import { normalizeForMatch, wordCount } from './normalize';

/** Alıntının kabul edilmesi için gereken en az kelime sayısı.
 *  "we may" gibi her metinde geçen kısa parçalarla doğrulamanın kandırılmasını önler. */
export const MIN_QUOTE_WORDS = 4;

export type QuoteCheck =
  | { ok: true; segmentId: string }
  | { ok: false; reason: 'quote_not_found' | 'too_short' | 'contains_ellipsis' };

/**
 * Orijinal segmentlerin normalize edilmiş, aranabilir dizini.
 * Segmentler tek boşlukla birleştirilir; böylece iki segmente yayılan alıntılar da bulunur.
 */
export class QuoteIndex {
  private readonly joined: string;
  /** joined içindeki her segmentin başlangıç ofseti */
  private readonly starts: { id: string; start: number }[] = [];

  constructor(segments: readonly Segment[]) {
    const parts: string[] = [];
    let offset = 0;
    for (const s of segments) {
      const n = normalizeForMatch(s.text);
      this.starts.push({ id: s.id, start: offset });
      parts.push(n);
      offset += n.length + 1; // +1: ayırıcı boşluk
    }
    this.joined = parts.join(' ');
  }

  check(quote: string): QuoteCheck {
    const q = normalizeForMatch(quote);
    // "..." ile ortası atlanmış alıntı birebir değildir.
    if (q.includes('...')) return { ok: false, reason: 'contains_ellipsis' };
    if (wordCount(q) < MIN_QUOTE_WORDS) return { ok: false, reason: 'too_short' };
    const pos = this.joined.indexOf(q);
    if (pos === -1) return { ok: false, reason: 'quote_not_found' };
    return { ok: true, segmentId: this.segmentAt(pos) };
  }

  private segmentAt(pos: number): string {
    let id = this.starts[0]?.id ?? 'S0';
    for (const s of this.starts) {
      if (s.start > pos) break;
      id = s.id;
    }
    return id;
  }
}
