import type { LlmOutput, LlmFinding } from '../../src/shared/schema';

export function finding(over: Partial<LlmFinding> = {}): LlmFinding {
  return {
    category: 'AUTO_RENEWAL',
    severity: 'medium',
    quote: 'your subscription will automatically renew each month',
    segment_id: 'S1',
    explanation_tr: 'Abonelik kendiliğinden yenilenir.',
    confidence: 0.9,
    ...over,
  };
}

export function output(findings: LlmFinding[], over: Partial<LlmOutput> = {}): LlmOutput {
  return { document_type: 'terms', language: 'en', findings, summary_tr: 'özet', uncertainty_notes: [], ...over };
}
