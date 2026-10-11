// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildLabelTool } from '../../scripts/build-label-tool';
import { CATEGORY_IDS } from '../../src/shared/categories';
import { GoldSchema } from '../../eval/lib/gold';

describe('etiketleme aracı', () => {
  it('commit edilmiş eval/label.html güncel (kategoriler değişince `npm run label` çalıştırılmalı)', () => {
    expect(readFileSync('eval/label.html', 'utf8')).toBe(buildLabelTool());
  });
  it('tüm kategorileri içerir ve LLM sonucu göstermez (kör etiketleme)', () => {
    const html = buildLabelTool();
    for (const c of CATEGORY_IDS) expect(html).toContain(`"${c}"`);
    expect(html).not.toMatch(/findings|explanation_tr|summary_tr|confidence/);
  });
  it('ürettiği etiket formatı GoldSchema ile uyumlu', () => {
    const sample = { format: 'tos-risk-gold/v1', corpus_file: 'x.json', labeler: 'Emirhan', labeled_at: '2026-10-12T10:00:00Z', complete: true,
      items: [{ category: 'AUTO_RENEWAL', severity: 'high', quote: 'renews automatically every month', note: 'emin değilim' }] };
    expect(GoldSchema.safeParse(sample).success).toBe(true);
    // Araçtaki dışa aktarma nesnesi bu alanları üretiyor mu?
    const html = buildLabelTool();
    for (const k of ["format: 'tos-risk-gold/v1'", 'corpus_file:', 'labeler:', 'labeled_at:', 'complete:', 'items:']) expect(html).toContain(k);
  });
});
