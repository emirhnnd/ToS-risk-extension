/**
 * Çalışma anı salt-okuma denetimi.
 * Analiz süresince sayfadaki tıklama / form gönderimi / giriş olaylarını yakalama
 * aşamasında (capture) dinler. `isTrusted === false` olan olaylar KOD tarafından
 * tetiklenmiştir (kullanıcı değil). Analiz sırasında böyle bir olay görülürse
 * raporda uyarı çıkar. Böylece "uzantı sayfada işlem yapmaz" iddiası her analizde
 * ölçülür; yalnızca README'de yazan bir söz olarak kalmaz.
 *
 * Not: Sayfanın KENDİ betikleri de sentetik olay üretebilir; bu yüzden uyarı
 * "uzantı tıkladı" değil, "analiz sırasında sentetik etkileşim görüldü" der.
 */
const EVENTS = ['click', 'submit', 'input', 'change', 'keydown'] as const;

export interface GuardResult {
  synthetic: number;
  trusted: number;
  samples: string[];
}

export function startActionGuard(target: EventTarget = document): () => GuardResult {
  const res: GuardResult = { synthetic: 0, trusted: 0, samples: [] };
  const onEvent = (e: Event) => {
    if (isOwnPanel(e)) return;
    if (e.isTrusted) {
      res.trusted++;
      return;
    }
    res.synthetic++;
    if (res.samples.length < 5) res.samples.push(`${e.type} → ${describe(e.target)}`);
  };
  for (const t of EVENTS) target.addEventListener(t, onEvent, { capture: true });
  let stopped = false;
  return () => {
    // İdempotent: birden çok kez çağrılabilir (hata yolları + finally)
    if (!stopped) for (const t of EVENTS) target.removeEventListener(t, onEvent, { capture: true });
    stopped = true;
    return res;
  };
}

function isOwnPanel(e: Event): boolean {
  return e.composedPath().some((n) => n instanceof Element && n.id === 'tos-risk-panel-host');
}

function describe(t: EventTarget | null): string {
  if (!(t instanceof Element)) return String(t);
  const id = t.id ? `#${t.id}` : '';
  const text = (t.textContent ?? '').trim().slice(0, 40);
  return `<${t.tagName.toLowerCase()}${id}>${text ? ` "${text}"` : ''}`;
}
