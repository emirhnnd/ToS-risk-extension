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

describe('gerçek sayfalardan çıkan regresyonlar (2026-10-11 korpusu)', () => {
  it('satır ortasındaki page-agent etiketleri atılır (Amazon, Netflix)', () => {
    const s = 'Ana içerik .com.tr [8]<div id=glow-ingress-block>Teslimat konumu: X Konumu güncelle /> [9]<select title=Şurada ara: name=url id=searchDropdownBox>Tüm Kategoriler Kitaplar /> Hesap\nSon Güncelleme: 10 Nisan 2026 [9]<select title=Tercih ettiğiniz dil... id=lang-switcher>Bir dil seç Türkçe /> Gizlilik';
    const out = simplifiedToPlainText(s);
    expect(out).not.toMatch(/\[\d+\]|<|\/>|id=/);
    expect(out).toContain('Teslimat konumu: X Konumu güncelle');
    expect(out).toContain('Son Güncelleme: 10 Nisan 2026 Bir dil seç Türkçe Gizlilik');
  });
  it('Amazon başlığı sözleşme olarak algılanır', () => {
    expect(detectContractPage('https://www.amazon.com.tr/gp/help/customer/display.html?nodeId=GLSBYFE9MGKKQXXM', 'Amazon.com.tr Kullanım ve Satış Şartları - Amazon Müşteri Hizmetleri', 'Amazon Hizmetleri\'ni kullanarak, bu koşullarla bağlı olmayı kabul etmektesiniz. Kişisel veri sorumluluk')).toBeGreaterThanOrEqual(0.5);
  });
});

describe('algılama: ödevdeki üç sayfa türü (kullanım koşulları, gizlilik, abonelik)', () => {
  const body = 'These terms apply. We collect personal data and share it with third parties. You agree to the governing law.';
  const bodyTr = 'Kişisel verileriniz üçüncü taraflarla paylaşılır. Sorumluluk kabul edilmez. Yetkili mahkeme İstanbul. Kabul etmiş sayılırsınız.';
  it.each([
    ['https://example.com/privacy', 'Privacy Policy', body],
    ['https://example.com/legal/privacy-notice', 'Privacy Notice – Example', body],
    ['https://ornek.com/gizlilik-politikasi', 'Gizlilik Politikası', bodyTr],
    ['https://ornek.com/kvkk-aydinlatma-metni', 'KVKK Aydınlatma Metni', bodyTr],
    ['https://example.com/subscription-terms', 'Subscription Terms', body],
    ['https://ornek.com/uyelik-sozlesmesi', 'Üyelik Sözleşmesi', bodyTr],
    ['https://ornek.com/abonelik-sartlari', 'Abonelik Şartları', bodyTr],
    ['https://example.com/terms', 'Terms of Service', body],
  ])('%s → sözleşme sayfası', (url, title, text) => {
    expect(detectContractPage(url, title, text)).toBeGreaterThanOrEqual(0.5);
  });
  it.each([
    ['https://ornek.com/tarifler/elmali-kek', 'Elmalı Kek Tarifi', 'Unu ve şekeri karıştırın.'],
    ['https://news.example.com/2026/10/12/story', 'Local team wins', 'The match ended 2-1.'],
  ])('%s → sözleşme değil', (url, title, text) => {
    expect(detectContractPage(url, title, text)).toBeLessThan(0.5);
  });
});
