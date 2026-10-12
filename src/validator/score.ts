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

/** Skorun dökümü: panelde "Skor nasıl hesaplandı?" bölümü bunu gösterir (kullanıcı skoru kendisi doğrulayabilir). */
export interface ScoreTerm { category: CategoryId; weight: number; severity: VerifiedFinding['severity']; multiplier: number; points: number }
export function scoreBreakdown(findings: readonly VerifiedFinding[]): { terms: ScoreTerm[]; total: number; capped: boolean } {
  const best = new Map<CategoryId, VerifiedFinding['severity']>();
  for (const f of findings) {
    const cur = best.get(f.category);
    if (!cur || SEVERITY_MULTIPLIER[f.severity] > SEVERITY_MULTIPLIER[cur]) best.set(f.category, f.severity);
  }
  const terms = [...best].map(([category, severity]) => {
    const weight = CATEGORIES[category].weight, multiplier = SEVERITY_MULTIPLIER[severity];
    return { category, weight, severity, multiplier, points: weight * multiplier };
  }).sort((a, b) => b.points - a.points);
  const raw = terms.reduce((n, t) => n + t.points, 0);
  return { terms, total: Math.min(100, Math.round(raw)), capped: raw > 100 };
}

export const RISK_THRESHOLDS = { medium: 20, high: 45 } as const;

export function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}
