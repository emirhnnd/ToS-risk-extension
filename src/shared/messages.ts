import { z } from 'zod';
import type { Report } from './schema';

/**
 * İçerik betiği ↔ service worker mesajları.
 * Service worker gelen mesajı da şemayla doğrular (savunma derinliği):
 * içerik betiği güvenilmez sayfanın içinde çalışır.
 */
export const AnalyzeRequestSchema = z.object({
  type: z.literal('analyze'),
  url: z.string().max(2000),
  title: z.string().max(500),
  detectionScore: z.number().min(0).max(1),
  segments: z.array(z.object({ id: z.string().regex(/^S\d{1,5}$/), text: z.string().max(5000) })).max(5000),
  hidden: z
    .array(
      z.object({
        reason: z.enum(['display_none', 'visibility_hidden', 'zero_size_font', 'offscreen', 'transparent', 'same_color', 'aria_hidden', 'zero_opacity', 'clipped', 'zero_size']),
        text: z.string().max(2000),
        looks_like_instruction: z.boolean(),
      }),
    )
    .max(500),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export type AnalyzeResponse = { ok: true; report: Report } | { ok: false; error: string };

export interface OpenPanelMessage {
  type: 'open-panel';
}
