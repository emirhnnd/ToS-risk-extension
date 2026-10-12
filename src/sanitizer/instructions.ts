import { normalizeForMatch } from '../validator/normalize';

/**
 * Bir metnin yapay zekâya yönelik talimat gibi görünüp görünmediğini sezgisel olarak tespit eder.
 * Bu bir SAVUNMA KATMANI DEĞİL, raporlama sinyalidir: asıl savunma gizli metnin
 * LLM'e hiç gönderilmemesi, skorun kodla hesaplanması ve alıntı doğrulamasıdır.
 * Sezgi kaçırabilir (ör. başka dil, eşanlamlı ifade); bu eval'de dürüstçe raporlanır.
 */
const PATTERNS: RegExp[] = [
  // İngilizce
  /\bignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|prompts|rules)/,
  /\bdisregard (all |the )?(previous|prior|above)/,
  /\b(you are|act as) (an? )?(ai|assistant|language model|chatgpt|gpt|claude|gemini)/,
  // Hitap: yalnızca "AI:" / "assistant:" biçimi. "model," ve "AI-generated" gibi ifadeler
  // gerçek sözleşmelerin yapay zekâ maddelerinde geçtiği için eval'de yanlış alarm üretiyordu
  // (Amazon S10, S49; Netflix S18). Bkz. eval/error-analysis.md.
  /\b(ai|assistant|llm|chatbot|language model)s?( assistant)?\s*:/,
  /\b(system|developer) (prompt|message|instruction)/,
  /\b(risk )?score (of |to |= ?)?0\b/,
  /\b(report|return|output|say) (that )?(this|the) (agreement|contract|document|terms) (is )?(completely |totally )?safe/,
  /\bdo not (report|flag|mention|find)/,
  /\bclick (the )?(subscribe|buy|accept|confirm)/,
  // Türkçe (normalize edildiği için aksansız yazılır)
  /\b(onceki|yukaridaki|tum) talimatlari (yok say|gormezden gel|unut)/,
  /\b(yapay zeka|yapay zeka asistani|asistan|asistani|ai)\s*:/,
  /\brisk skoru(nu)? ?(0|sifir)/,
  /\b(madde|risk) (bulma|raporlama|gosterme)/,
  /\b(tamamen|tamamiyla) guvenli(dir)?/,
  /\b(abone ol|satin al|onayla) (butonuna|dugmesine) tikla/,
];

export function looksLikeInstruction(text: string): boolean {
  const n = normalizeForMatch(text);
  return PATTERNS.some((p) => p.test(n));
}
