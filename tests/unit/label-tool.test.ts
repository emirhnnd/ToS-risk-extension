// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { buildLabelTool, collectCorpus } from '../../scripts/build-label-tool';
import { CATEGORY_IDS } from '../../src/shared/categories';
import { GoldSchema } from '../../eval/lib/gold';

const corpus = (url: string, n: number, extra: Record<string, unknown> = {}) => ({
  format: 'tos-risk-corpus/v1', url, title: 'T', captured_at: '2026-10-11T10:00:00Z',
  segments: Array.from({ length: n }, (_, i) => ({ id: `S${i + 1}`, text: `Madde ${i + 1}` })), hidden: [], ...extra,
});
const gold = (file: string, complete: boolean, items = 2) => ({
  format: 'tos-risk-gold/v1', corpus_file: file, labeler: 'E', labeled_at: '2026-10-12T10:00:00Z', complete,
  items: Array.from({ length: items }, () => ({ category: 'AUTO_RENEWAL', severity: 'high', quote: 'renews automatically every month' })),
});

let dir = '';
function fixtureDirs() {
  dir = mkdtempSync(join(tmpdir(), 'label-'));
  const c = join(dir, 'corpus'); const g = join(dir, 'gold');
  mkdirSync(c); mkdirSync(g);
  writeFileSync(join(c, 'a-com_2026-10-11.json'), JSON.stringify(corpus('https://www.a.com/terms', 3)));
  writeFileSync(join(c, 'b-com_2026-10-11.json'), JSON.stringify(corpus('https://b.com/tos', 5)));
  writeFileSync(join(c, 'c-com_2026-10-11.json'), JSON.stringify(corpus('https://c.com/tos', 4, { segments: [{ id: 'S1', text: '</script><script>window.pwned=1</script>' }] })));
  writeFileSync(join(c, 'bozuk.json'), '{');
  writeFileSync(join(g, 'a-com_2026-10-11.gold.json'), JSON.stringify(gold('a-com_2026-10-11.json', true)));
  writeFileSync(join(g, 'b-com_2026-10-11.gold.json'), JSON.stringify(gold('b-com_2026-10-11.json', false, 1)));
  return { corpusDir: c, goldDir: g };
}
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = ''; });

function run(html: string) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  return dom.window;
}

describe('etiketleme aracı', () => {
  it('tüm kategorileri içerir ve LLM sonucu göstermez (kör etiketleme)', () => {
    const html = buildLabelTool({ corpusDir: '/yok' });
    for (const c of CATEGORY_IDS) expect(html).toContain(`"${c}"`);
    expect(html).not.toMatch(/findings|explanation_tr|summary_tr|confidence/);
  });

  it('ürettiği etiket formatı GoldSchema ile uyumlu', () => {
    expect(GoldSchema.safeParse(gold('x.json', true)).success).toBe(true);
    const html = buildLabelTool({ corpusDir: '/yok' });
    for (const k of ["format: 'tos-risk-gold/v1'", 'corpus_file:', 'labeler:', 'labeled_at:', 'complete:', 'items:']) expect(html).toContain(k);
  });

  it('korpus klasörünü gömer, bozuk dosyayı uyarıyla atlar', () => {
    const warnings: string[] = [];
    const entries = collectCorpus({ ...fixtureDirs(), warn: (m) => warnings.push(m) });
    expect(entries.map((e) => e.file)).toEqual(['a-com_2026-10-11.json', 'b-com_2026-10-11.json', 'c-com_2026-10-11.json']);
    expect(warnings.join()).toContain('bozuk.json');
  });

  it('listede her metnin durumu görünür ve seçilen metin yüklenir', () => {
    const w = run(buildLabelTool(fixtureDirs()));
    const opts = [...w.document.querySelectorAll<HTMLOptionElement>('#corpusPick option')].map((o) => o.textContent);
    expect(opts).toEqual(['— listeden seçin —', '✅ a.com · 3 bölüm', '📝 b.com · 5 bölüm', '⬜ c.com · 1 bölüm']);
    expect(w.document.getElementById('corpusTable')!.textContent).toContain('tamamlandı (2 etiket)');

    const sel = w.document.getElementById('corpusPick') as HTMLSelectElement;
    sel.value = 'a-com_2026-10-11.json';
    sel.dispatchEvent(new w.Event('change'));
    expect(w.document.querySelectorAll('#segments .seg')).toHaveLength(3);
    // eval/gold'daki kayıtlı etiketler yüklenir
    expect(w.document.getElementById('count')!.textContent).toBe('2');
    expect((w.document.getElementById('complete') as HTMLInputElement).checked).toBe(true);
  });

  it('korpus metni script etiketini kapatıp kod çalıştıramaz', () => {
    const w = run(buildLabelTool(fixtureDirs())) as unknown as { pwned?: number; document: Document };
    expect(w.pwned).toBeUndefined();
    expect(w.document.querySelectorAll('#corpusPick option')).toHaveLength(4);
  });
});
