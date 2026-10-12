// Cypress E2E çalıştırıcısı
//   node scripts/e2e.mjs run     tüm testler (LLM: kayıt varsa kayıttan, yoksa canlı Gemini + kaydet)
//   node scripts/e2e.mjs open    Cypress arayüzü
//   node scripts/e2e.mjs video   yalnızca demo testi, adımlar arası bekleme ile; LLM yalnızca kayıttan
//
// 1) Uzantının e2e build'ini alır (dist-e2e)
// 2) Chrome for Testing'i .browsers/ altına bir kez indirir (markalı Chrome 137+ uzantı yüklemeyi kapattı)
// 3) Cypress'i bu tarayıcıyla, görünür pencerede çalıştırır (headless Chrome uzantı yükleyemez)
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import cypress from 'cypress';
import { Browser, computeExecutablePath, detectBrowserPlatform, getInstalledBrowsers, install, resolveBuildId } from '@puppeteer/browsers';

const command = process.argv[2] ?? 'run';
if (!['run', 'open', 'video'].includes(command)) {
  console.error('Kullanım: node scripts/e2e.mjs run | open | video');
  process.exit(2);
}
const cacheDir = resolve('.browsers');

async function chromeForTesting() {
  if (process.env.CYPRESS_BROWSER) return process.env.CYPRESS_BROWSER;
  const installed = (await getInstalledBrowsers({ cacheDir })).filter((b) => b.browser === Browser.CHROME);
  if (installed.length > 0) return installed[installed.length - 1].executablePath;

  const platform = detectBrowserPlatform();
  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
  console.log(`Chrome for Testing ${buildId} indiriliyor (yalnızca ilk sefer, ~150 MB)…`);
  let lastPct = -1;
  await install({
    browser: Browser.CHROME, buildId, cacheDir,
    downloadProgressCallback: (done, total) => {
      const pct = Math.floor((done / total) * 10) * 10;
      if (pct !== lastPct) { lastPct = pct; process.stdout.write(`  %${pct}\r`); }
    },
  });
  console.log('');
  return computeExecutablePath({ browser: Browser.CHROME, buildId, cacheDir });
}

console.log('→ e2e build (dist-e2e)…');
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e', '--logLevel', 'warn'], { stdio: 'inherit' });

const browser = await chromeForTesting();
console.log(`→ Tarayıcı: ${browser}`);

if (command === 'video') {
  process.env.DEMO_PAUSE ??= '2000'; // cypress.config.mjs → task demoPauseMs
  process.env.LLM_MODE ??= 'replay'; // video: önceden kaydedilmiş gerçek Gemini yanıtları, bekleme yok
}

if (command === 'open') {
  await cypress.open({ browser, e2e: true });
} else {
  const result = await cypress.run({
    browser,
    headed: true,
    ...(command === 'video' ? { spec: 'cypress/e2e/demo.cy.js' } : {}),
  });
  if (result.status === 'failed') {
    console.error('Cypress başlatılamadı:', result.message);
    process.exit(1);
  }
  for (const run of result.runs) {
    const v = run.video;
    const dur = Math.round((run.stats.duration ?? 0) / 1000);
    console.log(`${run.stats.failures ? '✗' : '✓'} ${run.spec.relative}: ${run.stats.passes} geçti, ${run.stats.failures} başarısız, ${dur} sn` +
      (v && existsSync(v) ? `  · video: ${v} (${Math.round(statSync(v).size / 1024)} KB)` : ''));
  }
  process.exit(result.totalFailed > 0 ? 1 : 0);
}
