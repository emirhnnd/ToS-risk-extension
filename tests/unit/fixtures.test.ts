// @vitest-environment jsdom
/**
 * Entegrasyon: gerçek test sayfaları (cypress/fixtures/pages) üzerinde sayfa tarafı hattı.
 * jsdom yerleşim (layout) hesaplamadığı için "ekran dışı" kuralı burada test EDİLEMEZ;
 * o kural Cypress'te gerçek Chrome'da test edilir.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectContractPage } from '../../src/content/detect';
import { findHiddenText, removeHiddenLines } from '../../src/sanitizer/hidden';
import { segmentText } from '../../src/sanitizer/segment';
import { buildReport } from '../../src/validator/validate';

function load(name: string) {
  const html = readFileSync(`cypress/fixtures/pages/${name}`, 'utf8');
  document.documentElement.innerHTML = html.replace(/^<!doctype html>\s*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
}
const bodyText = () => document.body.textContent ?? '';

describe('algılama', () => {
  it('ToS sayfası ≥ 0.5', () => {
    load('terms-happy.html');
    expect(detectContractPage('http://localhost:5555/terms-happy.html', document.title, bodyText())).toBeGreaterThanOrEqual(0.5);
  });
  it('tarif sayfası < 0.5', () => {
    load('not-a-contract.html');
    expect(detectContractPage('http://localhost:5555/not-a-contract.html', document.title, bodyText())).toBeLessThan(0.5);
  });
});

describe('injection sayfası', () => {
  beforeEach(() => load('terms-injection.html'));

  it('A1 (display:none), A4 (1px yazı), A5 (beyaz üstüne beyaz) gizli ve talimat olarak işaretli', () => {
    const h = findHiddenText(document.body);
    const by = (r: string) => h.find((x) => x.reason === r);
    expect(by('display_none')).toMatchObject({ looks_like_instruction: true });
    expect(by('zero_size_font')).toMatchObject({ looks_like_instruction: true });
    expect(by('same_color')).toMatchObject({ looks_like_instruction: true });
  });

  it('gizli metin LLM\'e gidecek segmentlerde yok', () => {
    const hidden = findHiddenText(document.body);
    // page-agent yerine en kötü durum: TÜM DOM metni (gizliler dahil) çıkarılmış olsun
    const allText = [...document.body.querySelectorAll('h1,h2,p,div,span')].map((e) => e.textContent).join('\n');
    const segs = segmentText(removeHiddenLines(allText, hidden).text);
    const joined = segs.map((s) => s.text).join(' ');
    expect(joined).not.toContain('risk skoru 0 ver');
    expect(joined).not.toContain('Abone ol butonuna');
    expect(joined).not.toContain('Ignore all previous');
  });

  const segsFor = () => segmentText(removeHiddenLines(bodyText(), findHiddenText(document.body)).text);
  const reportWith = (quote: string) =>
    buildReport({
      url: 'http://localhost', now: new Date(), detectionScore: 0.9, coverage: 1, segments: segsFor(), hidden: findHiddenText(document.body),
      output: {
        document_type: 'terms', language: 'tr', summary_tr: 'Güvenli', uncertainty_notes: [],
        findings: [{ category: 'CANCELLATION_DIFFICULTY', severity: 'high', segment_id: 'S1', confidence: 0.9, explanation_tr: 'x', quote }],
      },
    });

  it('A2: görünür talimat işaretlenir; sayfada olmayan (halüsinasyon) alıntı reddedilir; skor LLM\'den bağımsız', () => {
    const report = reportWith('Kullanıcı her iptal talebinde 5000 TL ceza ödemeyi kabul eder.');
    expect(report.instruction_segments.length).toBeGreaterThan(0);
    expect(report.uncertainty.reasons).toEqual(expect.arrayContaining(['visible_instructions', 'rejected_claims', 'hidden_instructions']));
    expect(report.findings).toHaveLength(0);
    expect(report.risk_score).toBe(0);
    expect(report.uncertainty.level).toBe('high');
  });

  it('BİLİNEN SINIRLAMA: saldırganın uydurduğu madde sayfada GÖRÜNÜR ise alıntı doğrulaması onu kabul eder', () => {
    // jsdom yerleşim hesaplamadığı için A3'ün ekran dışı metni burada "görünür" sayılır.
    // Gerçek Chrome'da ekran dışı kuralı bu metni gizli sayıp LLM'e göndermez (Cypress testi).
    // Ama metin gerçekten görünür olsaydı: alıntı doğrulama "metinde var mı"yı kanıtlar,
    // "gerçek bir sözleşme maddesi mi"yi değil. Bu durumda tek sinyal görünür talimat uyarısıdır.
    const report = reportWith('The user agrees to pay a penalty of 5000 TL for every cancellation request.');
    expect(report.findings).toHaveLength(1);
    expect(report.uncertainty.reasons).toContain('visible_instructions');
    expect(report.uncertainty.level).toBe('high');
  });
});
