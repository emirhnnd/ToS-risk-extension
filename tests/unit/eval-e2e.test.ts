// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { findHiddenText, removeHiddenLines } from '../../src/sanitizer/hidden';
import { segmentText, selectWithinBudget } from '../../src/sanitizer/segment';
import { cacheKey } from '../../eval/run-eval';
import { DEFAULT_MODEL } from '../../src/background/llm';
/**
 * Uçtan uca eval testi: gerçek CLI, gerçek doğrulayıcı, SAHTE LLM yanıtı (önbellek dosyası).
 * Sahte yanıtta her durum bilerek var: TP, şiddet farkı, yanlış kategori, FP, FN, halüsinasyon.
 */
it('npm run eval: beklenen TP/FP/FN ve rapor', { timeout: 30_000 }, () => {
  const D = mkdtempSync(join(tmpdir(), 'tos-eval-'));
  const html = readFileSync('cypress/fixtures/pages/terms-happy.html', 'utf8');
  document.documentElement.innerHTML = html.replace(/^<!doctype html>\s*<html[^>]*>/i, '');
  const hidden = findHiddenText(document.body);
  const segments = segmentText(removeHiddenLines(document.body.textContent!, hidden).text);
  for (const d of ['corpus', 'gold', 'cache']) mkdirSync(`${D}/${d}`, { recursive: true });
  const snap = { format: 'tos-risk-corpus/v1', captured_at: '2026-10-11T09:00:00Z', url: 'http://localhost:5555/terms-happy.html', title: document.title, detection_score: 1, segments, hidden };
  writeFileSync(`${D}/corpus/streamly.json`, JSON.stringify(snap));
  writeFileSync(`${D}/gold/streamly.gold.json`, JSON.stringify({ format: 'tos-risk-gold/v1', corpus_file: 'streamly.json', labeler: 'smoke', labeled_at: '2026-10-11', complete: true, items: [
    { category: 'AUTO_RENEWAL', severity: 'medium', quote: 'will automatically renew at the end of each billing period' },
    { category: 'NO_REFUND', severity: 'high', quote: 'All payments are non-refundable' },
    { category: 'DATA_SHARING', severity: 'high', quote: 'with our advertising partners and other third parties for marketing purposes' },
    { category: 'ARBITRATION_CLASS_WAIVER', severity: 'high', quote: 'binding individual arbitration' },
  ] }));
  const f = (category: string, severity: string, quote: string) => ({ category, severity, quote, segment_id: 'S1', explanation_tr: 'x', confidence: 0.9 });
  const raw = JSON.stringify({ document_type: 'terms', language: 'en', summary_tr: 'özet', uncertainty_notes: [], findings: [
    f('AUTO_RENEWAL', 'medium', 'Your Streamly subscription will automatically renew at the end of each billing period'), // TP
    f('NO_REFUND', 'medium', 'All payments are non-refundable, and we do not provide refunds'),                              // TP, şiddet farklı
    f('SENSITIVE_DATA', 'high', 'share your personal information, including your viewing history and device identifiers, with our advertising partners'), // yanlış kategori
    f('LIABILITY_DISCLAIMER', 'medium', 'our total liability shall not exceed ten US dollars'),                               // FP (etikette yok)
    f('UNILATERAL_CHANGE', 'high', 'We may change anything we want whenever we like'),                                        // halüsinasyon → reddedilir
  ] });
  const { selected } = selectWithinBudget(segments, 120000);
  writeFileSync(`${D}/cache/${cacheKey(DEFAULT_MODEL, selected, { url: snap.url, title: snap.title })}.json`, JSON.stringify({ raw }));
  const out = execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'eval/run-eval.ts', '--dir', D], { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
  expect(out).toContain('TP 2 · FP 2 · FN 2');
  const md = readFileSync(`${D}/results.md`, 'utf8');
  expect(md).toContain('| TP / FP / FN | 2 / 2 / 2 |');
  expect(md).toContain('(1/5)'); // reddedilen alıntı oranı
  expect(md).toContain('%50 (1/2)'); // şiddet uyumu
  expect(md).toContain('yer doğru, kategori yanlış');
});
