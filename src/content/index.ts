import type { AnalyzeRequest, AnalyzeResponse } from '../shared/messages';
import { BUILD_TIME } from '../shared/build';
import { CORPUS_FORMAT, snapshotFileName, type CorpusSnapshot } from '../shared/corpus';
import { findHiddenText, removeHiddenLines } from '../sanitizer/hidden';
import { segmentText } from '../sanitizer/segment';
import { restrictToMainContent } from '../sanitizer/region';
import { ReportPanel } from '../ui/panel';
import { startActionGuard } from './action-guard';
import { detectContractPage } from './detect';
import { extractVisibleText } from './extract';
import { disableAutoOpen, getPrefs, shouldAutoOpen } from '../shared/prefs';

/**
 * İçerik betiği: veri akışının sayfa tarafı (plan §5.2, adım 1–3 ve 6).
 *   algıla → (kullanıcı "analiz et" der) → page-agent ile görünür metni çıkar
 *   → gizli metni ayıkla → segmentlere böl → service worker'a gönder → raporu göster
 * İçerik betiği API anahtarını görmez ve LLM'e kendisi istek atmaz.
 * LLM'e otomatik istek atılmaz; kullanıcı butona basınca analiz başlar.
 */
let panel: ReportPanel | null = null;

async function openPanel(autoOpened = false): Promise<ReportPanel> {
  if (panel && panel.isOpen) return panel;
  const prefs = await getPrefs();
  const p = new ReportPanel();
  panel = p;
  p.onAnalyze = () => void runAnalysis(p);
  p.onExport = () => void exportSnapshot();
  p.onDisableAutoOpen = () => void disableAutoOpen(location.hostname).then(() => p.close());
  p.showIdle(currentDetection(), { devMode: prefs.devMode, autoOpened });
  return p;
}

function currentDetection(): number {
  return detectContractPage(location.href, document.title, document.body?.innerText ?? '');
}

/** Sayfadan LLM girdisini üretir: algıla → page-agent ile oku → gizliyi ayıkla → böl. */
async function captureInput() {
  const detectionScore = currentDetection();
  const hidden = findHiddenText(document.body);
  let visible: string;
  try {
    visible = await extractVisibleText();
  } catch (e) {
    console.warn('[ToS Risk] page-agent metin çıkarma başarısız, innerText kullanılıyor:', e);
    visible = document.body.innerText;
  }
  const { text: noHidden } = removeHiddenLines(visible, hidden);
  const { text, region, dropped_lines } = restrictToMainContent(noHidden);
  return { detectionScore, hidden, segments: segmentText(text), extraction: { region, dropped_lines } };
}

/** Eval korpusu için LLM girdisini JSON olarak indirir (LLM çağrısı yapmaz). */
async function exportSnapshot(): Promise<void> {
  const { detectionScore, hidden, segments, extraction } = await captureInput();
  const now = new Date();
  const snap: CorpusSnapshot = {
    format: CORPUS_FORMAT, captured_at: now.toISOString(), url: location.href, title: document.title,
    detection_score: detectionScore, segments, hidden, extraction, extension_build: BUILD_TIME,
  };
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = snapshotFileName(location.href, now);
  a.click(); // kullanıcının kendi butonuna basmasıyla tetiklenen indirme; sayfaya dokunmaz
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function runAnalysis(p: ReportPanel): Promise<void> {
  const stopGuard = startActionGuard();
  try {
    p.showLoading('Sayfa metni okunuyor…');
    const { detectionScore, hidden, segments } = await captureInput();

    p.showLoading(`Yapay zekâ analiz ediyor (${segments.length} bölüm)… Genelde 10–60 sn sürer.`);
    const req: AnalyzeRequest = { type: 'analyze', url: location.href, title: document.title, detectionScore, segments, hidden };
    const res = (await chrome.runtime.sendMessage(req)) as AnalyzeResponse | undefined;

    if (!res) p.showError('Uzantının arka plan betiğinden yanıt alınamadı. Sayfayı yenileyip tekrar deneyin.');
    else if (!res.ok) p.showError(res.error);
    else {
      const guard = stopGuard();
      const report = res.report;
      if (guard.synthetic > 0) {
        report.synthetic_interactions = { count: guard.synthetic, samples: guard.samples };
        report.uncertainty.reasons.push('synthetic_interaction');
        report.uncertainty.level = 'high';
      }
      p.showReport(report);
    }
  } catch (e) {
    p.showError(`Beklenmeyen hata: ${(e as Error).message}`);
  } finally {
    stopGuard(); // her yolda dinleyiciler kaldırılır
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id === chrome.runtime.id && msg?.type === 'open-panel') void openPanel();
});

void getPrefs().then((prefs) => {
  if (shouldAutoOpen(currentDetection(), location.hostname, prefs)) void openPanel(true);
});
