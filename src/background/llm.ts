import { GEMINI_RESPONSE_SCHEMA, buildSystemInstruction, buildUserMessage } from '../shared/prompt';
import type { Segment } from '../shared/schema';
import { parseLlmOutput, type ParseResult } from '../validator/validate';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface LlmConfig {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch; // testlerde sahte fetch
  timeoutMs?: number;
}

export type LlmResult =
  | { ok: true; data: Extract<ParseResult, { ok: true }>['data']; attempts: number; raw: string }
  | { ok: false; error: string; attempts: number; raw?: string };

/**
 * Gemini'yi JSON şema moduyla çağırır ve çıktıyı Zod ile doğrular.
 * Şemaya uymayan yanıt 1 kez yeniden denenir (plan §5.2); ikinci başarısızlıkta
 * "analiz başarısız" döner, asla doğrulanmamış veri döndürmez.
 * Ağ uç noktası sabittir; sayfa metni URL'e değil, istek gövdesine konur.
 */
export async function analyzeWithGemini(
  segments: readonly Segment[],
  meta: { url: string; title: string },
  cfg: LlmConfig,
): Promise<LlmResult> {
  const doFetch = cfg.fetchFn ?? fetch;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
    contents: [{ role: 'user', parts: [{ text: buildUserMessage(segments, meta) }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  let lastError = 'Bilinmeyen hata';
  let lastRaw: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response;
    try {
      res = await doFetch(`${ENDPOINT}/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
        body,
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 90_000),
      });
    } catch (e) {
      // Zaman aşımı ve ağ hataları geçici olabilir: bir kez daha denenir.
      lastError = networkErrorMessage(e as Error, cfg.model);
      continue;
    }
    if (!res.ok) {
      // HTTP hataları yeniden denenmez (anahtar hatası, kota vb. tekrarla düzelmez)
      return { ok: false, error: await httpErrorMessage(res, cfg.model), attempts: attempt };
    }
    const json = (await res.json().catch(() => null)) as GeminiResponse | null;
    const raw = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    lastRaw = raw;
    if (!raw) {
      lastError = `LLM boş yanıt döndü (${json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason ?? 'neden belirtilmedi'})`;
      continue;
    }
    const parsed = parseLlmOutput(raw);
    if (parsed.ok) return { ok: true, data: parsed.data, attempts: attempt, raw };
    lastError = parsed.error;
  }
  return { ok: false, error: lastRaw === undefined ? lastError : `Analiz başarısız: ${lastError}`, attempts: 2, raw: lastRaw };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function networkErrorMessage(e: Error, model: string): string {
  if (e.name === 'TimeoutError' || /timed out|timeout/i.test(e.message)) {
    return `Gemini zamanında yanıt vermedi (${model}). Biraz bekleyip tekrar deneyin veya Ayarlar'dan daha hızlı bir model seçin (örn. gemini-3.5-flash-lite).`;
  }
  return 'Gemini\'ye ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
}

async function httpErrorMessage(res: Response, model: string): Promise<string> {
  const detail = await res.text().catch(() => '');
  switch (res.status) {
    case 400:
      return /API_KEY|api key/i.test(detail) ? 'API anahtarı geçersiz. Ayarlar sayfasından kontrol edin.' : `İstek reddedildi (400): ${detail.slice(0, 200)}`;
    case 401:
    case 403:
      return 'API anahtarı yetkisiz. Ayarlar sayfasından kontrol edin.';
    case 404:
      return `"${model}" modeli bulunamadı. Ayarlar sayfasından başka bir model deneyin.`;
    case 429:
      return 'Gemini istek limiti aşıldı. Bir dakika bekleyip tekrar deneyin.';
    default:
      return `LLM hatası (${res.status}).`;
  }
}
