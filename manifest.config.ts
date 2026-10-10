import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

// Minimum izin ilkesi: yalnızca activeTab, storage, scripting.
// Not: içerik betiği F1 (otomatik algılama) için tüm http/https sayfalarda çalışır;
// sayfaya yalnızca okuma yapar, ağ isteği atmaz.
// host_permissions yalnızca LLM API uç noktası için (service worker fetch'i).
export default defineManifest({
  manifest_version: 3,
  name: 'ToS Risk Analizi',
  version: pkg.version,
  description: pkg.description,
  permissions: ['activeTab', 'storage', 'scripting'],
  host_permissions: ['https://generativelanguage.googleapis.com/*'],
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
    },
  ],
});
