// Cypress E2E: uzantının e2e build'i (dist-e2e) gerçek Chromium'a yüklenir.
// Not: Chrome 137+ (markalı Chrome) --load-extension'ı kaldırdı; bu yüzden
// "npm run e2e" Chrome for Testing indirip onu kullanır (scripts/e2e.mjs).
import { defineConfig } from 'cypress';
import { resolve } from 'node:path';
import { startServer } from './scripts/serve-fixtures.mjs';

export default defineConfig({
  video: true,
  videoCompression: 28,
  viewportWidth: 1280,
  viewportHeight: 800,
  e2e: {
    baseUrl: 'http://localhost:5555',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    includeShadowDom: true, // rapor paneli open Shadow DOM içinde
    defaultCommandTimeout: 10_000,
    async setupNodeEvents(on, config) {
      // Test sunucusu (sayfalar + LLM vekili). Zaten açıksa onu kullan.
      try {
        await startServer({ mode: process.env.LLM_MODE ?? 'auto' });
      } catch (e) {
        if (e.code !== 'EADDRINUSE') throw e;
        console.log('Port 5555 zaten açık: mevcut test sunucusu kullanılıyor.');
      }
      // Demo videosu için adımlar arası bekleme (ms); scripts/e2e.mjs video modunda ayarlar
      on('task', { demoPauseMs: () => Number(process.env.DEMO_PAUSE || 0) });
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.extensions.push(resolve('dist-e2e'));
        }
        return launchOptions;
      });
      return config;
    },
  },
});
