import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest, { E2E_SERVER } from './manifest.config.ts';

export default defineConfig(({ mode }) => {
  const e2e = mode === 'e2e';
  return {
    plugins: [crx({ manifest })],
    define: {
      // Hangi build'in çalıştığını görmek için (panel altı + korpus dosyası)
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __E2E__: JSON.stringify(e2e),
      ...(e2e ? { __LLM_ENDPOINT__: JSON.stringify(`${E2E_SERVER}/e2e-llm/v1beta/models`) } : {}),
    },
    build: { outDir: e2e ? 'dist-e2e' : 'dist', emptyOutDir: true },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  } as any;
});
