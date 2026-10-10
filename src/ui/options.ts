const input = document.getElementById('key') as HTMLInputElement;
const statusEl = document.getElementById('statusEl') as HTMLParagraphElement;

chrome.storage.local.get('apiKey').then(({ apiKey }) => {
  if (typeof apiKey === 'string' && apiKey) statusEl.textContent = 'Kayıtlı bir anahtar var.';
});

document.getElementById('save')!.addEventListener('click', async () => {
  const key = input.value.trim();
  if (!key) {
    statusEl.textContent = 'Anahtar boş olamaz.';
    return;
  }
  await chrome.storage.local.set({ apiKey: key });
  input.value = '';
  statusEl.textContent = 'Kaydedildi.';
});
export {};
