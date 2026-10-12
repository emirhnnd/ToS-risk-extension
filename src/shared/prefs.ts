/**
 * Kullanıcı tercihleri (chrome.storage.local). API anahtarı burada DEĞİL; o yalnızca
 * service worker ve ayarlar sayfasınca okunur. Buradaki değerler içerik betiğine açıktır.
 */
export interface Prefs {
  /** Panelin kendiliğinden açılmayacağı siteler (hostname). Uzantı simgesiyle yine açılır. */
  autoOpenDisabledHosts: string[];
  /** Geliştirici modu: panelde "eval için metni kaydet" düğmesi görünür. */
  devMode: boolean;
}

export const DEFAULT_PREFS: Prefs = { autoOpenDisabledHosts: [], devMode: false };

type Area = Pick<chrome.storage.StorageArea, 'get' | 'set'>;
const area = (): Area => chrome.storage.local;

export function normalizePrefs(raw: Record<string, unknown>): Prefs {
  const hosts = Array.isArray(raw.autoOpenDisabledHosts) ? raw.autoOpenDisabledHosts.filter((h): h is string => typeof h === 'string') : [];
  return { autoOpenDisabledHosts: hosts, devMode: raw.devMode === true };
}

export async function getPrefs(storage: Area = area()): Promise<Prefs> {
  try {
    return normalizePrefs(await storage.get(['autoOpenDisabledHosts', 'devMode']));
  } catch {
    return { ...DEFAULT_PREFS }; // depolama okunamazsa varsayılanlar (panel yine çalışır)
  }
}

export async function disableAutoOpen(host: string, storage: Area = area()): Promise<void> {
  const prefs = await getPrefs(storage);
  if (!prefs.autoOpenDisabledHosts.includes(host)) {
    await storage.set({ autoOpenDisabledHosts: [...prefs.autoOpenDisabledHosts, host].sort() });
  }
}

export function shouldAutoOpen(detectionScore: number, host: string, prefs: Prefs): boolean {
  return detectionScore >= 0.5 && !prefs.autoOpenDisabledHosts.includes(host);
}
