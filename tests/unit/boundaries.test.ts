/**
 * Mimari sınır testleri (kaynak kod düzeyinde, build gerektirmez):
 *  - İçerik betiği (güvenilmez sayfanın içinde çalışır) API anahtarına ve LLM uç noktasına ulaşamaz.
 *  - LLM çağrısı yalnızca service worker'dan yapılır.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/** Göreli import'ları izleyerek bir giriş dosyasından ulaşılabilen tüm src dosyaları. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [normalize(entry)];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const code = readFileSync(f, 'utf8');
    for (const m of code.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2]!;
      const base = join(dirname(f), spec);
      const cand = [base, `${base}.ts`, join(base, 'index.ts')].find((p) => existsSync(p) && p.endsWith('.ts'));
      if (cand) stack.push(normalize(cand));
    }
  }
  return seen;
}

describe('içerik betiği anahtara ve LLM uç noktasına ulaşamaz', () => {
  const files = [...reachable('src/content/index.ts')];
  it('içerik betiği modül grafiği bulundu', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain(normalize('src/ui/panel.ts'));
  });
  it('service worker modüllerini (LLM istemcisi) içe aktarmaz', () => {
    expect(files.filter((f) => f.includes(normalize('src/background/')))).toEqual([]);
    expect(files).not.toContain(normalize('src/shared/env.ts')); // LLM uç noktası burada
  });
  it.each(files)('%s: API anahtarını okumaz, ağ isteği atmaz', (f) => {
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/apiKey|x-goog-api-key|generativelanguage/);
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  });
});

describe('LLM çağrısı yalnızca service worker\'dan', () => {
  it('fetch kullanan tek kaynak dosya LLM istemcisidir', () => {
    const all = [...reachable('src/content/index.ts'), ...reachable('src/background/index.ts'), ...reachable('src/ui/options.ts')];
    const withFetch = [...new Set(all)].filter((f) => /\bfetch\s*\(|doFetch\s*\(/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
    expect(withFetch).toEqual([normalize('src/background/llm.ts')]);
  });
});
