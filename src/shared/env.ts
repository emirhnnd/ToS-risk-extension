/**
 * Derleme modu sabitleri (vite define). Normal build'de E2E=false ve LLM uç noktası Google'dır.
 * `vite build --mode e2e` (yalnızca Cypress için, dist-e2e/) LLM isteğini yerel test
 * sunucusuna yönlendirir; gerçek anahtarı o sunucu .env'den ekler, uzantıya hiç girmez.
 */
declare const __E2E__: boolean | undefined;
declare const __LLM_ENDPOINT__: string | undefined;

export const E2E: boolean = typeof __E2E__ === 'boolean' ? __E2E__ : false;
export const GOOGLE_LLM_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const LLM_ENDPOINT: string = typeof __LLM_ENDPOINT__ === 'string' ? __LLM_ENDPOINT__ : GOOGLE_LLM_ENDPOINT;
/** E2E build'de anahtar yerine giden yer tutucu (yerel sunucu bunu atar, kendi anahtarını koyar) */
export const E2E_PLACEHOLDER_KEY = 'e2e-anahtari-yerel-sunucu-ekler';
