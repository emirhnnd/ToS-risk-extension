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
export {};
