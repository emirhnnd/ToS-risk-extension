import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Güvenlik: git'e girecek hiçbir dosyada API anahtarı olmamalı.
 * `npm test` her çalıştığında izlenen + eklenmeye hazır dosyaları tarar.
 */
const KEY_PATTERNS: [string, RegExp][] = [
  ['Google API anahtarı (AIza)', /AIza[0-9A-Za-z_-]{35}/],
  ['Google API anahtarı (AQ.)', /\bAQ\.[0-9A-Za-z_-]{30,}/],
  ['OpenAI anahtarı', /\bsk-(proj-)?[0-9A-Za-z_-]{20,}/],
];

function gitFiles(): string[] {
  try {
    const out = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' });
    return out.split('\n').filter((f) => f && !f.endsWith('.zip') && !f.startsWith('node_modules/'));
  } catch {
    return []; // git yoksa (örn. zip'ten açılmış kopya) atla
  }
}

describe('repoda API anahtarı yok', () => {
  it.each(gitFiles())('%s', (file) => {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      return;
    }
    for (const [name, re] of KEY_PATTERNS) expect(re.test(text), `${name} bulundu`).toBe(false);
  });

  it('.env ve türevleri git tarafından yok sayılıyor', () => {
    const ignore = readFileSync('.gitignore', 'utf8').split('\n');
    expect(ignore).toContain('.env');
    expect(ignore).toContain('.env.*');
  });
});
