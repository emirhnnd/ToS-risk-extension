import { describe, expect, it } from 'vitest';
import { matchFindings, prf } from '../../eval/lib/match';
import type { VerifiedFinding } from '../../src/shared/schema';
import type { GoldItem } from '../../eval/lib/gold';

const segs = [
  { id: 'S1', text: 'Your subscription will automatically renew each month unless you cancel.' },
  { id: 'S2', text: 'We may share your personal data with advertising partners and data brokers.' },
  { id: 'S3', text: 'We may terminate your account at any time without notice.' },
];
const sys = (category: VerifiedFinding['category'], quote: string): VerifiedFinding =>
  ({ category, quote, severity: 'medium', segment_id: 'S1', matched_segment_id: 'S1', explanation_tr: '', confidence: 0.9 });
const gold = (category: GoldItem['category'], quote: string): GoldItem => ({ category, quote, severity: 'medium' });

describe('matchFindings', () => {
  it('aynı kategori + kesişen alıntı = TP; farklı uzunlukta alıntılar da eşleşir', () => {
    const r = matchFindings(segs, [gold('AUTO_RENEWAL', 'Your subscription will automatically renew each month unless you cancel.')], [sys('AUTO_RENEWAL', 'automatically renew each month')]);
    expect(r.tp).toHaveLength(1);
    expect(r.fn).toHaveLength(0);
    expect(r.fp).toHaveLength(0);
  });
  it('kaçırılan altın etiket = FN, fazladan bulgu = FP', () => {
    const r = matchFindings(segs, [gold('ARBITRARY_TERMINATION', 'terminate your account at any time')], [sys('DATA_SHARING', 'share your personal data with advertising partners')]);
    expect(r.fn).toHaveLength(1);
    expect(r.fp).toEqual([{ sys: expect.objectContaining({ category: 'DATA_SHARING' }) }]);
  });
  it('doğru yer, yanlış kategori → FP + FN ve tanı', () => {
    const r = matchFindings(segs, [gold('DATA_SHARING', 'share your personal data with advertising partners')], [sys('SENSITIVE_DATA', 'personal data with advertising partners and data brokers')]);
    expect(r.tp).toHaveLength(0);
    expect(r.fn).toHaveLength(1);
    expect(r.fp[0]?.wrongCategoryOf).toBe('DATA_SHARING');
  });
  it('aynı maddeyi iki parça halinde bulmak: biri TP, diğeri tekrar (FP değil)', () => {
    const r = matchFindings(segs, [gold('DATA_SHARING', 'We may share your personal data with advertising partners and data brokers.')],
      [sys('DATA_SHARING', 'share your personal data with advertising'), sys('DATA_SHARING', 'advertising partners and data brokers')]);
    expect(r.tp).toHaveLength(1);
    expect(r.duplicates).toHaveLength(1);
    expect(r.fp).toHaveLength(0);
  });
  it('bire bir: tek bulgu iki altın etiketi birden karşılayamaz', () => {
    const r = matchFindings(segs, [gold('DATA_SHARING', 'share your personal data'), gold('DATA_SHARING', 'with advertising partners and data brokers')],
      [sys('DATA_SHARING', 'We may share your personal data with advertising partners and data brokers.')]);
    expect(r.tp).toHaveLength(1);
    expect(r.fn).toHaveLength(1);
  });
  it('aynı kategoride kesişen altın etiketler tek madde sayılır (yanlışlıkla tekrar eklenen paragraf)', () => {
    const full = 'We may share your personal data with advertising partners and data brokers.';
    const r = matchFindings(segs, [gold('DATA_SHARING', full), gold('DATA_SHARING', full), gold('DATA_SHARING', 'advertising partners and data brokers')],
      [sys('DATA_SHARING', 'share your personal data with advertising partners')]);
    expect(r.mergedGold).toBe(2);
    expect(r.tp).toHaveLength(1);
    expect(r.fn).toHaveLength(0);
  });
  it('kesişen ama FARKLI kategorili altın etiketler birleşmez', () => {
    const r = matchFindings(segs, [gold('DATA_SHARING', 'share your personal data with advertising partners'), gold('SENSITIVE_DATA', 'personal data with advertising partners')], []);
    expect(r.mergedGold).toBe(0);
    expect(r.fn).toHaveLength(2);
  });
  it('geçişli birleştirme: A–B ve B–C kesişiyorsa üçü tek madde', () => {
    const r = matchFindings(segs, [gold('DATA_SHARING', 'We may share your personal'), gold('DATA_SHARING', 'with advertising partners and data brokers.'), gold('DATA_SHARING', 'personal data with advertising')], []);
    expect(r.mergedGold).toBe(2);
    expect(r.fn).toHaveLength(1);
  });
  it('metinde bulunamayan altın etiket ayrı raporlanır (etiketleme hatası)', () => {
    const r = matchFindings(segs, [gold('NO_REFUND', 'no refunds will be given')], []);
    expect(r.unlocatableGold).toHaveLength(1);
    expect(r.fn).toHaveLength(0);
  });
});

describe('prf', () => {
  it('hesap', () => expect(prf(8, 2, 4)).toEqual({ precision: 0.8, recall: 8 / 12, f1: expect.closeTo(0.727, 3) }));
  it('sıfıra bölme yerine null', () => expect(prf(0, 0, 0)).toEqual({ precision: null, recall: null, f1: null }));
});
