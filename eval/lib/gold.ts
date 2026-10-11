import { z } from 'zod';
import { CATEGORY_IDS, SEVERITIES } from '../../src/shared/categories';

/** Elle (LLM'siz) hazırlanan altın etiket dosyası. eval/label.html üretir. */
export const GoldSchema = z.object({
  format: z.literal('tos-risk-gold/v1'),
  corpus_file: z.string(),
  labeler: z.string().min(1),
  labeled_at: z.string(),
  /** Etiketleyici metnin tamamını okuduğunu onaylar (kısmi etiket eval'e girmez) */
  complete: z.boolean(),
  items: z.array(
    z.object({
      category: z.enum(CATEGORY_IDS),
      severity: z.enum(SEVERITIES),
      quote: z.string().min(1),
      note: z.string().optional(),
    }),
  ),
});
export type Gold = z.infer<typeof GoldSchema>;
export type GoldItem = Gold['items'][number];
