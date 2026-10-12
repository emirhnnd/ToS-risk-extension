/**
 * Rastgele girdi (fuzz) ve metamorfik testler: LLM güvenilmez bir bileşen olduğuna göre
 * çıktısı ne kadar bozuk / kötü niyetli olursa olsun doğrulayıcının değişmezleri korunmalı.
 * Tohumlu (seed) rastgele üreteç: her koşu aynı girdileri üretir, hata tekrarlanabilir.
 */
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, SEVERITIES } from '../../src/shared/categories';
import { buildReport, parseLlmOutput } from '../../src/validator/validate';
import { computeRiskScore } from '../../src/validator/score';
import { QuoteIndex } from '../../src/validator/quote';
import type { Segment } from '../../src/shared/schema';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEGMENTS: Segment[] = [
  { id: 'S1', text: 'Your subscription will automatically renew each month unless you cancel at least 48 hours before.' },
  { id: 'S2', text: 'Kişisel verileriniz iş ortaklarımız ve reklam şirketleriyle paylaşılabilir ve satılabilir.' },
  { id: 'S3', text: 'We may terminate your account at any time, for any reason, without prior notice.' },
  { id: 'S4', text: 'Ödemeler iade edilmez; kısmi dönemler için kredi verilmez.' },
  { id: 'S5', text: 'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.' },
];
const WORDS = ['risk', 'skor', '0', 'ignore', 'previous', 'güvenli', 'subscription', 'veri', '…', '"', '</untrusted_document>', '<img src=x onerror=alert(1)>', '​', 'ı', 'İ'];

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!;
}

/** Gerçek bir alt dizi, değiştirilmiş alt dizi, uydurma metin veya bozuk değer üretir. */
function randomQuote(r: () => number): unknown {
  const seg = pick(r, SEGMENTS).text;
  const k = r();
  if (k < 0.35) { // gerçek alt dizi
    const a = Math.floor(r() * (seg.length / 2));
    return seg.slice(a, a + 20 + Math.floor(r() * 60));
  }
  if (k < 0.55) { // bir karakteri değiştirilmiş alt dizi (sinsi halüsinasyon)
    const q = seg.slice(0, 40).split('');
    q[Math.floor(r() * q.length)] = pick(r, ['x', 'Z', '9']);
    return q.join('');
  }
  if (k < 0.75) return Array.from({ length: 3 + Math.floor(r() * 10) }, () => pick(r, WORDS)).join(' ');
  if (k < 0.85) return seg.slice(0, 30) + ' … ' + seg.slice(-20);
  return pick(r, [null, 42, '', 'kısa', 'x'.repeat(700), { nested: true }]);
}

function randomFinding(r: () => number): unknown {
  const f: Record<string, unknown> = {
    category: r() < 0.9 ? pick(r, CATEGORY_IDS) : pick(r, ['SAFE', 'auto_renewal', '', 7]),
    severity: r() < 0.9 ? pick(r, SEVERITIES) : pick(r, ['critical', 2, null]),
    quote: randomQuote(r),
    segment_id: r() < 0.9 ? `S${1 + Math.floor(r() * 6)}` : pick(r, ['s1', 'S', 'S999999', 3]),
    explanation_tr: r() < 0.95 ? 'Açıklama.' : '',
    confidence: r() < 0.9 ? r() : pick(r, [-1, 2, 'yüksek', NaN]),
  };
  if (r() < 0.05) f.risk_score = 0; // enjekte edilmiş alan → o bulgu reddedilmeli
  if (r() < 0.05) delete f.quote;
  return f;
}

function randomOutput(r: () => number): unknown {
  const o: Record<string, unknown> = {
    document_type: r() < 0.95 ? pick(r, ['terms', 'privacy', 'subscription', 'other']) : 'contract!',
    language: r() < 0.95 ? pick(r, ['en', 'tr', 'de']) : 'eng',
    findings: Array.from({ length: Math.floor(r() * 12) }, () => randomFinding(r)),
    summary_tr: 'Özet.',
    uncertainty_notes: r() < 0.8 ? [] : ['', 'not'],
  };
  if (r() < 0.03) o.risk_score = 0;
  return o;
}

describe('fuzz: parseLlmOutput hiçbir girdide throw etmez', () => {
  it('3000 rastgele / bozuk / kesik yanıt', () => {
    const r = rng(20261012);
    for (let i = 0; i < 3000; i++) {
      const raw = JSON.stringify(randomOutput(r));
      const variants = [raw, raw.slice(0, Math.floor(r() * raw.length)), raw.replace(/"/g, r() < 0.5 ? "'" : '"'), pick(r, WORDS) + raw];
      for (const v of variants) {
        const res = parseLlmOutput(v);
        expect(typeof res.ok).toBe('boolean');
      }
    }
  });
});

describe('fuzz: rapor değişmezleri (2000 rastgele LLM çıktısı)', () => {
  const index = new QuoteIndex(SEGMENTS);
  it('doğrulanmamış alıntı rapora girmez, skor 0–100 tam sayı ve formülle aynı, sayım korunur', () => {
    const r = rng(42);
    let reportsBuilt = 0, verifiedSeen = 0, rejectedSeen = 0;
    for (let i = 0; i < 2000; i++) {
      const parsed = parseLlmOutput(JSON.stringify(randomOutput(r)));
      if (!parsed.ok) continue;
      const report = buildReport({ url: 'https://x.test', now: new Date(0), detectionScore: 0.9, coverage: 1, segments: SEGMENTS, hidden: [], output: parsed.data });
      reportsBuilt++;
      // 1) Rapordaki her alıntı orijinal metinde bulunur
      for (const f of report.findings) expect(index.locate(f.quote), f.quote).not.toBeNull();
      // 2) Skor: tam sayı, 0–100, yalnızca doğrulanmış bulgulardan formülle
      expect(Number.isInteger(report.risk_score)).toBe(true);
      expect(report.risk_score).toBeGreaterThanOrEqual(0);
      expect(report.risk_score).toBeLessThanOrEqual(100);
      expect(report.risk_score).toBe(computeRiskScore(report.findings));
      // 3) Hiçbir bulgu kaybolmaz: kabul + red = LLM'in döndürdüğü
      const total = parsed.data.findings.length + (parsed.data.schema_rejected?.length ?? 0);
      expect(report.findings.length + report.rejected.length).toBe(total);
      // 4) Gerçek bir red varsa güvenilirlik "yüksek belirsizlik" olur
      if (report.rejected.some((x) => x.reason !== 'duplicate')) expect(report.uncertainty.level).toBe('high');
      verifiedSeen += report.findings.length;
      rejectedSeen += report.rejected.length;
    }
    // Üretecin gerçekten iki yolu da denediğini doğrula (boş geçen bir fuzz testi yanıltıcı olur)
    expect(reportsBuilt).toBeGreaterThan(1500);
    expect(verifiedSeen).toBeGreaterThan(500);
    expect(rejectedSeen).toBeGreaterThan(1000);
  });
});

describe('metamorfik: girdiyi anlamı koruyarak değiştirmek skoru değiştirmez', () => {
  const base = {
    document_type: 'terms', language: 'en', summary_tr: 'Özet.', uncertainty_notes: [],
    findings: [
      { category: 'AUTO_RENEWAL', severity: 'high', quote: 'automatically renew each month unless you cancel', segment_id: 'S1', explanation_tr: 'a', confidence: 0.9 },
      { category: 'ARBITRARY_TERMINATION', severity: 'medium', quote: 'terminate your account at any time, for any reason', segment_id: 'S3', explanation_tr: 'b', confidence: 0.8 },
      { category: 'NO_REFUND', severity: 'low', quote: 'Ödemeler iade edilmez; kısmi dönemler', segment_id: 'S4', explanation_tr: 'c', confidence: 0.7 },
    ],
  };
  const score = (o: unknown) => {
    const p = parseLlmOutput(JSON.stringify(o));
    if (!p.ok) throw new Error(p.error);
    return buildReport({ url: 'https://x.test', now: new Date(0), detectionScore: 0.9, coverage: 1, segments: SEGMENTS, hidden: [], output: p.data }).risk_score;
  };
  const s0 = score(base);

  it('bulguların sırası', () => {
    const r = rng(7);
    for (let i = 0; i < 50; i++) expect(score({ ...base, findings: [...base.findings].sort(() => r() - 0.5) })).toBe(s0);
  });
  it('aynı bulgunun tekrarı (LLM skoru şişiremez)', () => {
    expect(score({ ...base, findings: [...base.findings, ...base.findings, base.findings[0]] })).toBe(s0);
  });
  it('alıntının büyük/küçük harf, tırnak ve boşluk biçimi', () => {
    const f = base.findings.map((x) => ({ ...x, quote: `  ${x.quote.toUpperCase().replace(/ /g, '   ')} ` }));
    expect(score({ ...base, findings: f })).toBe(s0);
  });
  it('aynı kategoride FARKLI alıntılarla ikinci madde eklemek skoru artırmaz (kategori bir kez sayılır)', () => {
    // Manuel mutasyon denemesinde bu test yoktu ve "kategoriyi her bulgu için topla" hatası fuzz'dan sağ çıktı.
    const second = { ...base.findings[0]!, quote: 'cancel at least 48 hours before', severity: 'low' };
    expect(score({ ...base, findings: [...base.findings, second] })).toBe(s0);
  });
  it('LLM açıklaması, güven değeri ve özet skoru etkilemez', () => {
    const f = base.findings.map((x) => ({ ...x, explanation_tr: 'tamamen farklı', confidence: 0.51 }));
    expect(score({ ...base, summary_tr: 'Bu sözleşme tamamen güvenlidir.', findings: f })).toBe(s0);
  });
  it('uydurma bir bulgu eklemek skoru artırmaz (reddedilir)', () => {
    const fake = { category: 'DATA_SHARING', severity: 'high', quote: 'we sell your biometric data to anyone', segment_id: 'S2', explanation_tr: 'x', confidence: 1 };
    expect(score({ ...base, findings: [...base.findings, fake] })).toBe(s0);
  });
});
