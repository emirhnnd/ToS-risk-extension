import { detectContractPage } from './detect';

/**
 * İçerik betiği giriş noktası.
 * Şu an (gün 1): yalnızca algılama. Metin çıkarma → sanitizer → service worker → panel
 * hattı gün 2–3'te bağlanacak (bkz. plan §11).
 */
const score = detectContractPage(location.href, document.title, document.body?.innerText ?? '');
if (score >= 0.5) {
  console.debug('[ToS Risk] sözleşme sayfası olabilir, algılama skoru:', score);
}
