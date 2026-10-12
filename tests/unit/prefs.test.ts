// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, disableAutoOpen, getPrefs, normalizePrefs, shouldAutoOpen } from '../../src/shared/prefs';
import { ReportPanel } from '../../src/ui/panel';

function memoryStorage(init: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...init };
  return {
    data,
    get: async (keys: string[]) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
  } as unknown as chrome.storage.StorageArea & { data: Record<string, unknown> };
}

describe('tercihler', () => {
  it('varsayılan: her yerde kendiliğinden açılır, geliştirici modu kapalı', async () => {
    expect(await getPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
  });
  it('bozuk değerler güvenli varsayılana döner', () => {
    expect(normalizePrefs({ autoOpenDisabledHosts: 'x', devMode: 'true' })).toEqual(DEFAULT_PREFS);
  });
  it('"bu sitede açılmasın" yalnızca o siteyi etkiler ve tekrar eklemez', async () => {
    const st = memoryStorage();
    await disableAutoOpen('www.netflix.com', st);
    await disableAutoOpen('www.netflix.com', st);
    const prefs = await getPrefs(st);
    expect(prefs.autoOpenDisabledHosts).toEqual(['www.netflix.com']);
    expect(shouldAutoOpen(0.9, 'www.netflix.com', prefs)).toBe(false);
    expect(shouldAutoOpen(0.9, 'www.spotify.com', prefs)).toBe(true);
    expect(shouldAutoOpen(0.3, 'www.spotify.com', prefs)).toBe(false);
  });
  it('depolama okunamazsa panel varsayılanlarla çalışır', async () => {
    const broken = { get: async () => { throw new Error('x'); }, set: async () => {} } as unknown as chrome.storage.StorageArea;
    expect(await getPrefs(broken)).toEqual(DEFAULT_PREFS);
  });
});

describe('panel: boşta görünümü', () => {
  it('eval düğmesi yalnızca geliştirici modunda görünür', () => {
    const p = new ReportPanel();
    p.showIdle(0.9);
    expect(p.shadowRoot.querySelector('[data-testid=export-button]')).toBeNull();
    p.showIdle(0.9, { devMode: true });
    expect(p.shadowRoot.querySelector('[data-testid=export-button]')).not.toBeNull();
  });
  it('kendiliğinden açıldıysa "bu sitede açılmasın" bağlantısı vardır', () => {
    const p = new ReportPanel();
    let n = 0;
    p.onDisableAutoOpen = () => n++;
    p.showIdle(0.9);
    expect(p.shadowRoot.querySelector('[data-testid=disable-auto-open]')).toBeNull();
    p.showIdle(0.9, { autoOpened: true });
    (p.shadowRoot.querySelector('[data-testid=disable-auto-open]') as HTMLButtonElement).click();
    expect(n).toBe(1);
  });
});
