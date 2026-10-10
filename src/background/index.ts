/**
 * Service worker: LLM istemcisi burada yaşar.
 * API anahtarı yalnızca chrome.storage.local'dan okunur ve içerik betiğine/sayfaya
 * HİÇBİR ZAMAN gönderilmez. LLM çağrısı gün 2'de eklenecek.
 */
chrome.runtime.onInstalled.addListener(async () => {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) await chrome.runtime.openOptionsPage();
});
