const keyInput = document.getElementById('key') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;

chrome.storage.local.get(['apiKey', 'model']).then(({ apiKey, model }) => {
  if (typeof apiKey === 'string' && apiKey) statusEl.textContent = 'Kayıtlı bir anahtar var. Değiştirmek istemiyorsanız anahtar alanını boş bırakın.';
  if (typeof model === 'string') modelInput.value = model;
});

document.getElementById('save')!.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  const model = modelInput.value.trim();
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!key && !apiKey) {
    statusEl.textContent = 'Anahtar boş olamaz.';
    return;
  }
  if (model && !/^[a-z0-9.\-]+$/i.test(model)) {
    statusEl.textContent = 'Model adı yalnızca harf, rakam, nokta ve tire içerebilir.';
    return;
  }
  await chrome.storage.local.set({ ...(key ? { apiKey: key } : {}), model });
  keyInput.value = '';
  statusEl.textContent = 'Kaydedildi.';
});
// --- Panel tercihleri ---
import { getPrefs } from '../shared/prefs';
const hostsLine = document.getElementById('hosts-line') as HTMLParagraphElement;
const resetBtn = document.getElementById('reset-hosts') as HTMLButtonElement;
const devBox = document.getElementById('dev') as HTMLInputElement;
const panelStatus = document.getElementById('panel-status') as HTMLParagraphElement;

async function renderPrefs(): Promise<void> {
  const prefs = await getPrefs();
  devBox.checked = prefs.devMode;
  const n = prefs.autoOpenDisabledHosts.length;
  hostsLine.textContent = n === 0
    ? 'Panel, sözleşmeye benzeyen sayfalarda kendiliğinden açılır.'
    : `Panel şu sitelerde kendiliğinden açılmıyor: ${prefs.autoOpenDisabledHosts.join(', ')}. Uzantı simgesiyle yine açabilirsiniz.`;
  resetBtn.hidden = n === 0;
}
resetBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ autoOpenDisabledHosts: [] });
  panelStatus.textContent = 'Sıfırlandı.';
  await renderPrefs();
});
devBox.addEventListener('change', async () => {
  await chrome.storage.local.set({ devMode: devBox.checked });
  panelStatus.textContent = devBox.checked ? 'Geliştirici modu açık (sayfayı yenileyin).' : 'Geliştirici modu kapalı.';
});
void renderPrefs();
