import { describe, expect, it } from 'vitest';
import { QuoteIndex } from '../../src/validator/quote';

const segs = [
  { id: 'S1', text: 'Your subscription will automatically renew each month.' },
  { id: 'S2', text: 'We may share your personal data with advertising partners.' },
  { id: 'S3', text: 'These terms are governed by the laws of Delaware.' },
];
const idx = new QuoteIndex(segs);

describe('QuoteIndex', () => {
  it('birebir alıntıyı bulur ve doğru segmenti döner', () => {
    expect(idx.check('share your personal data with advertising partners')).toEqual({ ok: true, segmentId: 'S2' });
  });
  it('biçim farklarını tolere eder', () => {
    expect(idx.check('YOUR  subscription will\nautomatically renew')).toMatchObject({ ok: true, segmentId: 'S1' });
  });
  it('iki segmente yayılan alıntıyı kabul eder (başlangıç segmenti)', () => {
    expect(idx.check('renew each month. We may share')).toMatchObject({ ok: true, segmentId: 'S1' });
  });
  it('uydurma alıntıyı reddeder (A3)', () => {
    expect(idx.check('we will sell your data to anyone who pays')).toEqual({ ok: false, reason: 'quote_not_found' });
  });
  it('kelime değişen alıntıyı reddeder', () => {
    expect(idx.check('We will share your personal data with advertising partners')).toMatchObject({ ok: false });
  });
  it('çok kısa alıntıyı reddeder', () => {
    expect(idx.check('we may share')).toEqual({ ok: false, reason: 'too_short' });
  });
  it('üç nokta ile kırpılmış alıntıyı reddeder', () => {
    expect(idx.check('We may share … advertising partners')).toEqual({ ok: false, reason: 'contains_ellipsis' });
  });
  it('boş korpusta hiçbir şey bulmaz', () => {
    expect(new QuoteIndex([]).check('any quote with four words')).toMatchObject({ ok: false });
  });
});
