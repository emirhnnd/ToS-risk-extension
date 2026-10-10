import {
  LlmOutputSchema,
  type HiddenTextFinding,
  type LlmOutput,
  type RejectedFinding,
  type Report,
  type Segment,
  type UncertaintyReason,
  type VerifiedFinding,
} from '../shared/schema';
import { looksLikeInstruction } from '../sanitizer/instructions';
import { normalizeForMatch } from './normalize';
import { QuoteIndex } from './quote';
import { computeRiskScore, riskLevel } from './score';

export type ParseResult = { ok: true; data: LlmOutput } | { ok: false; error: string };

/** Adım 1: ham LLM yanıtı → şemaya uyan nesne ya da güvenli hata. Asla throw etmez. */
export function parseLlmOutput(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'LLM yanıtı geçerli JSON değil' };
  }
  const r = LlmOutputSchema.safeParse(json);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, error: `Şema hatası: ${first?.path.join('.') || '(kök)'} – ${first?.message ?? ''}` };
  }
  return { ok: true, data: r.data };
}

/** Adım 2: her iddianın alıntısını orijinal metinde ara. Bulunamayan atılır. */
export function verifyFindings(
  output: LlmOutput,
  segments: readonly Segment[],
): { verified: VerifiedFinding[]; rejected: RejectedFinding[] } {
  const index = new QuoteIndex(segments);
  const verified: VerifiedFinding[] = [];
  const rejected: RejectedFinding[] = [];
  const seen = new Set<string>();

  for (const f of output.findings) {
    const check = index.check(f.quote);
    if (!check.ok) {
      rejected.push({ finding: f, reason: check.reason });
      continue;
    }
    const key = `${f.category}|${normalizeForMatch(f.quote)}`;
    if (seen.has(key)) {
      rejected.push({ finding: f, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    verified.push({ ...f, matched_segment_id: check.segmentId });
  }
  return { verified, rejected };
}

export const LOW_CONFIDENCE = 0.5;
export const MIN_COVERAGE = 0.9;
export const MIN_DETECTION = 0.5;
export const SUPPORTED_LANGUAGES = ['tr', 'en'];

export interface ReportInput {
  url: string;
  now: Date;
  detectionScore: number; // 0–1, content/detect.ts
  coverage: number; // 0–1
  segments: readonly Segment[];
  hidden: readonly HiddenTextFinding[];
  output: LlmOutput;
}

/** Adım 3: doğrulanmış maddelerden raporu ve belirsizlik durumunu kodla üret. */
export function buildReport(input: ReportInput): Report {
  const { verified, rejected } = verifyFindings(input.output, input.segments);
  const score = computeRiskScore(verified);
  const instructionSegments = input.segments.filter((s) => looksLikeInstruction(s.text)).map((s) => s.id);

  const reasons: UncertaintyReason[] = [];
  if (input.detectionScore < MIN_DETECTION) reasons.push('not_a_contract_page');
  if (input.coverage < MIN_COVERAGE) reasons.push('partial_coverage');
  if (rejected.some((r) => r.reason !== 'duplicate')) reasons.push('rejected_claims');
  if (input.hidden.some((h) => h.looks_like_instruction)) reasons.push('hidden_instructions');
  if (instructionSegments.length > 0) reasons.push('visible_instructions');
  if (verified.some((f) => f.confidence < LOW_CONFIDENCE)) reasons.push('low_confidence_findings');
  if (!SUPPORTED_LANGUAGES.includes(input.output.language)) reasons.push('unsupported_language');
  if (input.output.uncertainty_notes.length > 0) reasons.push('llm_reported_uncertainty');

  // LLM'in kendi notları tek başına güvenilirliği "düşük" yapmaz; diğer nedenler yapar.
  const hard = reasons.filter((r) => r !== 'llm_reported_uncertainty');

  return {
    url: input.url,
    analyzed_at: input.now.toISOString(),
    document_type: input.output.document_type,
    language: input.output.language,
    risk_score: score,
    risk_level: riskLevel(score),
    findings: verified,
    rejected,
    hidden: [...input.hidden],
    instruction_segments: instructionSegments,
    summary_tr: input.output.summary_tr,
    coverage: input.coverage,
    uncertainty: { level: hard.length > 0 ? 'high' : 'low', reasons, notes: input.output.uncertainty_notes },
  };
}
