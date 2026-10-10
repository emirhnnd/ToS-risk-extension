import { describe, expect, it } from 'vitest';
import { computeRiskScore, riskLevel } from '../../src/validator/score';
import { CATEGORIES, CATEGORY_IDS } from '../../src/shared/categories';
import { finding } from './helpers';

const v = (o: Parameters<typeof finding>[0]) => ({ ...finding(o), matched_segment_id: 'S1' });

describe('computeRiskScore', () => {
  it('madde yoksa 0', () => expect(computeRiskScore([])).toBe(0));
  it('ağırlık × çarpan', () => {
    expect(computeRiskScore([v({ category: 'DATA_SHARING', severity: 'high' })])).toBe(12); // 8 × 1.5
  });
  it('aynı kategori tekrarı skoru şişirmez, en yüksek şiddet sayılır', () => {
    const many = Array.from({ length: 10 }, () => v({ category: 'DATA_SHARING', severity: 'low' }));
    expect(computeRiskScore([...many, v({ category: 'DATA_SHARING', severity: 'medium' })])).toBe(8);
  });
  it('100 ile sınırlıdır', () => {
    const all = CATEGORY_IDS.map((c) => v({ category: c, severity: 'high' }));
    expect(computeRiskScore(all)).toBe(100);
  });
  it('deterministiktir', () => {
    const fs = [v({ category: 'NO_REFUND' }), v({ category: 'ARBITRATION_CLASS_WAIVER', severity: 'high' })];
    expect(computeRiskScore(fs)).toBe(computeRiskScore([...fs].reverse()));
  });
  it('tüm ağırlıklar 1–10 aralığında', () => {
    for (const c of Object.values(CATEGORIES)) expect(c.weight).toBeGreaterThanOrEqual(1), expect(c.weight).toBeLessThanOrEqual(10);
  });
});

describe('riskLevel', () => {
  it('eşikler', () => {
    expect(riskLevel(0)).toBe('low');
    expect(riskLevel(19)).toBe('low');
    expect(riskLevel(20)).toBe('medium');
    expect(riskLevel(45)).toBe('high');
  });
});
