import { describe, expect, it, vi } from 'vitest';
vi.mock('@page-agent/page-controller', () => ({ PageController: class {} }));
import { detectContractPage } from '../../src/content/detect';
import { simplifiedToPlainText } from '../../src/content/extract';

describe('detectContractPage', () => {
  it('ToS sayfası yüksek skor alır', () => {
    expect(detectContractPage('https://x.com/legal/terms', 'Terms of Service', 'By using you agree to these terms. Governing law. Liability. Third parties.')).toBe(1);
  });
  it('Türkçe URL kodlaması çözülür', () => {
    expect(detectContractPage('https://x.com.tr/kullan%C4%B1m-ko%C5%9Fullar%C4%B1', 'Kullanım Koşulları', '')).toBeGreaterThanOrEqual(0.6);
  });
  it('alakasız sayfa düşük skor alır', () => {
    expect(detectContractPage('https://x.com/blog/recipe', 'Elmalı kek tarifi', 'un, şeker, elma')).toBeLessThan(0.5);
  });
});

describe('simplifiedToPlainText', () => {
  it('page-agent işaretlerini atar, metni tutar', () => {
    const s = '[0]<a aria-label=Home />\nTerms of Service\n\t[1]<button >Accept />\n\t*[2]<a >Privacy Policy />\nWe may share data.';
    expect(simplifiedToPlainText(s)).toBe('Terms of Service\nAccept\nPrivacy Policy\nWe may share data.');
  });
});
