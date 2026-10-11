import { describe, expect, it } from 'vitest';
import { normalizeForMatch } from '../../src/validator/normalize';

describe('normalizeForMatch', () => {
  it('boşluk, satır sonu ve büyük/küçük harfi eşitler', () => {
    expect(normalizeForMatch('  We   MAY\n share\tdata ')).toBe('we may share data');
  });
  it('akıllı tırnak ve tireleri düz karaktere çevirir', () => {
    expect(normalizeForMatch('“Service” – user’s')).toBe(normalizeForMatch('"Service" - user\'s'));
    expect(normalizeForMatch('“Service” – user’s')).toContain('-');
  });
  it('Türkçe I/ı/İ/i harflerini çakıştırır', () => {
    expect(normalizeForMatch('İPTAL ışık')).toBe(normalizeForMatch('iptal isik'));
  });
  it('sıfır genişlikli karakterleri siler (gizli bölme saldırısı)', () => {
    expect(normalizeForMatch('re​new')).toBe('renew');
  });
  it('kelimeleri değiştirmez', () => {
    expect(normalizeForMatch('we may share')).not.toBe(normalizeForMatch('we may not share'));
  });
  it('tırnak/parantez/noktalama çevresindeki boşluk farkını yok sayar (gerçek Spotify verisi)', () => {
    expect(normalizeForMatch('(toplu olarak " Spotify Hizmeti ") ve')).toBe(normalizeForMatch('(toplu olarak "Spotify Hizmeti") ve'));
    expect(normalizeForMatch("Spotify Gizlilik Politikası 'na bakın")).toBe(normalizeForMatch("Spotify Gizlilik Politikası'na bakın"));
    expect(normalizeForMatch('renew , unless')).toBe(normalizeForMatch('renew, unless'));
  });
  it('kelime sınırlarını korur', () => {
    expect(normalizeForMatch('we may not share')).not.toBe(normalizeForMatch('we maynot share'));
  });
});
describe('kontrol karakterleri', () => {
  it('\\u0001 yok sayılır', () => expect(normalizeForMatch('restoranlar,\u0001\u0001 GetirÇarşı')).toBe(normalizeForMatch('restoranlar, GetirÇarşı')));
});
