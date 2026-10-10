import { AnalyzeRequestSchema, type AnalyzeResponse } from '../shared/messages';
import { selectWithinBudget } from '../sanitizer/segment';
import { buildReport } from '../validator/validate';
import { DEFAULT_MODEL, analyzeWithGemini } from './llm';

/**
 * Service worker: LLM istemcisi burada yaşar.
 * API anahtarı yalnızca chrome.storage.local'dan okunur ve içerik betiğine/sayfaya
 * HİÇBİR ZAMAN gönderilmez. Rapor (skor, doğrulama) da burada, kodla üretilir.
 */
export const MAX_LLM_CHARS = 120_000;

chrome.runtime.onInstalled.addListener(async () => {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) await chrome.runtime.openOptionsPage();
});

// Araç çubuğu simgesi: algılanmayan sayfalarda da paneli açar.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) chrome.tabs.sendMessage(tab.id, { type: 'open-panel' }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || msg?.type !== 'analyze') return false;
  handleAnalyze(msg).then(sendResponse);
  return true; // yanıt asenkron
});

async function handleAnalyze(msg: unknown): Promise<AnalyzeResponse> {
  const req = AnalyzeRequestSchema.safeParse(msg);
  if (!req.success) return { ok: false, error: 'Geçersiz analiz isteği' };
  const { url, title, detectionScore, segments, hidden } = req.data;
  if (segments.length === 0) return { ok: false, error: 'Sayfada analiz edilecek görünür metin bulunamadı.' };

  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  if (typeof apiKey !== 'string' || !apiKey) {
    return { ok: false, error: 'API anahtarı ayarlanmamış. Uzantı simgesine sağ tıklayıp "Seçenekler"i açın.' };
  }

  const { selected, coverage } = selectWithinBudget(segments, MAX_LLM_CHARS);
  const llm = await analyzeWithGemini(selected, { url, title }, {
    apiKey,
    model: typeof model === 'string' && model ? model : DEFAULT_MODEL,
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  const report = buildReport({ url, now: new Date(), detectionScore, coverage, segments: selected, hidden, output: llm.data });
  return { ok: true, report };
}
