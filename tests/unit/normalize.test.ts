import { describe, expect, it } from 'vitest';
import { normalizeForMatch } from '../../src/validator/normalize';

describe('normalizeForMatch', () => {
  it('boşluk, satır sonu ve büyük/küçük harfi eşitler', () => {
    expect(normalizeForMatch('  We   MAY\n share\tdata ')).toBe('we may share data');
  });
  it('akıllı tırnak ve tireleri düz karaktere çevirir', () => {
    expect(normalizeForMatch('“Service” – user’s')).toBe('"service" - user\'s');
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
});
