import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Güvenlik denetimi: page-agent'in aksiyon metotları kaynak kodda hiç çağrılmıyor olmalı. */
const FORBIDDEN = /\.(clickElement|inputText|selectOption|scroll|scrollHorizontally|executeJavascript|showMask)\s*\(/;
const FORBIDDEN_IMPORTS = /\b(clickElement|inputTextElement|selectOptionElement|scrollVertically|scrollHorizontally|getElementByIndex)\b/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('read-only page-agent kullanımı', () => {
  it.each(files('src'))('%s aksiyon çağırmaz', (f) => {
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // yorumlar hariç
    expect(code).not.toMatch(FORBIDDEN);
    expect(code).not.toMatch(FORBIDDEN_IMPORTS);
  });
  it('tam "page-agent" ajan paketi (aksiyonlu) bağımlılıkta yok', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain('page-agent');
  });
});
