import { CATEGORIES, SEVERITY_MULTIPLIER, type CategoryId } from '../shared/categories';
import type { VerifiedFinding } from '../shared/schema';

/**
 * Deterministik risk skoru. LLM'in hiçbir skor/sayı çıktısı kullanılmaz.
 *
 *   skor = min(100, round( Σ_kategori ağırlık(k) × max_çarpan(k) ))
 *
 * Her kategori YALNIZCA BİR KEZ, en yüksek şiddetiyle sayılır. Böylece LLM aynı
 * maddeyi 10 kez raporlayarak skoru şişiremez; skor "kaç farklı risk türü var"
 * sorusuna bağlıdır. Yalnızca alıntısı doğrulanmış maddeler girer.
 */
export function computeRiskScore(findings: readonly VerifiedFinding[]): number {
  const maxMult = new Map<CategoryId, number>();
  for (const f of findings) {
    const m = SEVERITY_MULTIPLIER[f.severity];
    if (m > (maxMult.get(f.category) ?? 0)) maxMult.set(f.category, m);
  }
  let total = 0;
  for (const [cat, mult] of maxMult) total += CATEGORIES[cat].weight * mult;
  return Math.min(100, Math.round(total));
}

export const RISK_THRESHOLDS = { medium: 20, high: 45 } as const;

export function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}
