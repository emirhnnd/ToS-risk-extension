import { describe, expect, it, vi } from 'vitest';
import { analyzeWithGemini } from '../../src/background/llm';
import { finding, output } from './helpers';

const segs = [{ id: 'S1', text: 'Your subscription will automatically renew each month.' }];
const meta = { url: 'https://x.test', title: 'Terms' };
const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

describe('analyzeWithGemini', () => {
  it('geçerli yanıtı doğrulanmış olarak döner; anahtar başlıkta, URL\'de değil', async () => {
    const fetchFn = vi.fn(async () => geminiOk(JSON.stringify(output([finding()]))));
    const r = await analyzeWithGemini(segs, meta, { apiKey: 'K123', model: 'm', fetchFn });
    expect(r.ok).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('K123');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('K123');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toContain('VERİDİR');
  });
  it('şema dışı yanıtta 1 kez yeniden dener', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(geminiOk('not json')).mockResolvedValueOnce(geminiOk(JSON.stringify(output([]))));
    const r = await analyzeWithGemini(segs, meta, { apiKey: 'k', model: 'm', fetchFn });
    expect(r).toMatchObject({ ok: true, attempts: 2 });
  });
  it('iki kez şema dışıysa güvenli hata (doğrulanmamış veri dönmez)', async () => {
    const fetchFn = vi.fn(async () => geminiOk(JSON.stringify({ ...output([]), risk_score: 0 })));
    const r = await analyzeWithGemini(segs, meta, { apiKey: 'k', model: 'm', fetchFn });
    expect(r).toMatchObject({ ok: false, attempts: 2 });
    expect('data' in r).toBe(false);
  });
  it.each([
    [400, 'API key not valid', /anahtarı geçersiz/],
    [404, '', /modeli bulunamadı/],
    [429, '', /limiti/],
  ])('HTTP %i → anlaşılır Türkçe hata, yeniden deneme yok', async (status, body, re) => {
    const fetchFn = vi.fn(async () => new Response(body, { status }));
    const r = await analyzeWithGemini(segs, meta, { apiKey: 'k', model: 'm', fetchFn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(re);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('ağ hatası yakalanır', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await analyzeWithGemini(segs, meta, { apiKey: 'k', model: 'm', fetchFn })).toMatchObject({ ok: false });
  });
});
