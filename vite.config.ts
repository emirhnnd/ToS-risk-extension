import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [crx({ manifest })],
  // Hangi build'in çalıştığını görmek için (panel altı + korpus dosyası)
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as any);
