import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/** Cypress test sunucusu (yalnızca `--mode e2e` build'inde izinli) */
export const E2E_SERVER = 'http://localhost:5555';

// Minimum izin ilkesi: yalnızca activeTab, storage, scripting.
// Not: içerik betiği F1 (otomatik algılama) için tüm http/https sayfalarda çalışır;
// sayfaya yalnızca okuma yapar, ağ isteği atmaz.
// host_permissions yalnızca LLM API uç noktası için (service worker fetch'i).
export default defineManifest((env) => {
  const e2e = env.mode === 'e2e';
  return {
    manifest_version: 3,
    name: e2e ? 'ToS Risk Analizi (E2E test)' : 'ToS Risk Analizi',
    version: pkg.version,
    description: pkg.description,
    permissions: ['activeTab', 'storage', 'scripting'],
    // E2E: LLM isteği Google yerine yerel test sunucusuna gider (anahtarı sunucu ekler)
    host_permissions: e2e ? [`${E2E_SERVER}/*`] : ['https://generativelanguage.googleapis.com/*'],
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module',
    },
    action: {
      default_title: 'Bu sayfayı analiz et',
    },
    options_page: 'src/ui/options.html',
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['src/content/index.ts'],
        run_at: 'document_idle',
        // Cypress test edilen sayfayı bir iframe içinde açar; yalnızca E2E build'inde çerçevelere de girilir.
        ...(e2e ? { all_frames: true } : {}),
      },
    ],
  };
});
