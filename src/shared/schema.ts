import { z } from 'zod';
import { CATEGORY_IDS, DOCUMENT_TYPES, SEVERITIES } from './categories';

/**
 * LLM'den beklenen ham çıktının şeması.
 * LLM güvenilmez bir bileşen: bu şemadan geçmeyen hiçbir çıktı sisteme girmez.
 * Bilerek LLM'den skor İSTENMİYOR: skor validator/score.ts'te kodla hesaplanır.
 * `.strict()` ile bilinmeyen alanlar (ör. enjekte edilmiş "risk_score") reddedilir.
 */
export const LlmFindingSchema = z
  .object({
    category: z.enum(CATEGORY_IDS),
    severity: z.enum(SEVERITIES),
    /** Orijinal metinden birebir alıntı. Doğrulayıcı bunu metinde arar. */
    quote: z.string().min(8).max(600),
    /** Alıntının geldiği segment, örn. "S14" */
    segment_id: z.string().regex(/^S\d{1,5}$/),
    explanation_tr: z.string().min(1).max(600),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const LlmOutputSchema = z
  .object({
    document_type: z.enum(DOCUMENT_TYPES),
    language: z.string().regex(/^[a-z]{2}$/),
    findings: z.array(LlmFindingSchema).max(60),
    summary_tr: z.string().max(1500),
    uncertainty_notes: z.array(z.string().max(300)).max(20),
  })
  .strict();

export type LlmFinding = z.infer<typeof LlmFindingSchema>;
export type LlmOutput = z.infer<typeof LlmOutputSchema>;

/** Metnin bölünmüş hali. LLM'e giden ve doğrulamada kullanılan birim. */
export interface Segment {
  id: string; // "S1", "S2"...
  text: string;
}

/** Sanitizer'ın LLM'e GÖNDERMEDİĞİ, sayfada gizli bulunan metin */
export interface HiddenTextFinding {
  reason: 'display_none' | 'visibility_hidden' | 'zero_size_font' | 'offscreen' | 'transparent' | 'same_color' | 'aria_hidden' | 'zero_opacity' | 'clipped';
  text: string;
  /** Talimat benzeri kalıplar içeriyor mu (örn. "önceki talimatları yok say") */
  looks_like_instruction: boolean;
}

/** Alıntı doğrulamasından geçemeyen ve atılan iddia */
export interface RejectedFinding {
  finding: unknown;
  reason: 'quote_not_found' | 'too_short' | 'contains_ellipsis' | 'duplicate';
}

export interface VerifiedFinding extends LlmFinding {
  /** Alıntının normalize edilmiş orijinal metindeki gerçek segmenti */
  matched_segment_id: string;
}

export type UncertaintyReason =
  | 'not_a_contract_page'
  | 'partial_coverage'
  | 'rejected_claims'
  | 'hidden_instructions'
  | 'low_confidence_findings'
  | 'unsupported_language'
  | 'llm_reported_uncertainty';

/** Panelde gösterilen son rapor: tamamen kodla üretilir */
export interface Report {
  url: string;
  analyzed_at: string;
  document_type: LlmOutput['document_type'];
  language: string;
  risk_score: number; // 0–100, deterministik
  risk_level: 'low' | 'medium' | 'high';
  findings: VerifiedFinding[];
  rejected: RejectedFinding[];
  hidden: HiddenTextFinding[];
  summary_tr: string;
  coverage: number; // 0–1, LLM'e gönderilen metin / toplam görünür metin
  uncertainty: { level: 'low' | 'high'; reasons: UncertaintyReason[]; notes: string[] };
}
