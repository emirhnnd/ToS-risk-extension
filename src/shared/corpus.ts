import { z } from 'zod';
import { AnalyzeRequestSchema } from './messages';
import { normalizeForMatch } from '../validator/normalize';

/**
 * Eval korpusu anlık görüntüsü (snapshot).
 * Uzantı, LLM'e GÖNDERDİĞİ girdiyi (gizli metin ayıklanmış segmentler) aynen kaydeder.
 * Eval script'i bu dosyayı kullanır: böylece eval, kullanıcının gördüğü sistemi ölçer
 * ve ToS metni sonradan değişse bile sonuçlar tekrarlanabilir kalır.
 */
export const CORPUS_FORMAT = 'tos-risk-corpus/v1';

export const CorpusSnapshotSchema = z.object({
  format: z.literal(CORPUS_FORMAT),
  captured_at: z.string(),
  url: AnalyzeRequestSchema.shape.url,
  title: AnalyzeRequestSchema.shape.title,
  detection_score: AnalyzeRequestSchema.shape.detectionScore,
  segments: AnalyzeRequestSchema.shape.segments,
  hidden: AnalyzeRequestSchema.shape.hidden,
  /** Metin çıkarma bilgisi: yalnızca <main> mı alındı, kaç satır atıldı (şeffaflık) */
  /** Kaydı üreten uzantı build'i (hangi kod sürümü) */
  extension_build: z.string().optional(),
  extraction: z.object({ region: z.enum(['main', 'without_landmarks', 'whole_page']), dropped_lines: z.number().int().min(0) }).optional(),
});
export type CorpusSnapshot = z.infer<typeof CorpusSnapshotSchema>;

/** "https://www.spotify.com/tr-tr/legal/end-user-agreement/" → "spotify-com-end-user-agreement" */
export function snapshotFileName(url: string, date: Date): string {
  let host = 'sayfa';
  let last = '';
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, '');
    last = decodeURIComponent(u.pathname).split('/').filter(Boolean).pop() ?? '';
  } catch { /* geçersiz URL */ }
  const slug = normalizeForMatch(`${host}-${last}`).replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${slug}_${date.toISOString().slice(0, 10)}.json`;
}
