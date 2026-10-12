import { CATEGORIES } from '../shared/categories';
import type { Report } from '../shared/schema';
import { BUILD_TIME } from '../shared/build';
import { highlightQuote } from './highlight';
import { RISK_THRESHOLDS, scoreBreakdown } from '../validator/score';
import { HIDDEN_LABELS, LEGAL_DISCLAIMER, REJECT_LABELS, RISK_LEVEL_LABELS, SEVERITY_LABELS, UNCERTAINTY_LABELS } from './labels';

/**
 * Rapor paneli: sayfaya OPEN Shadow DOM ile enjekte edilir.
 *  - open: Cypress `shadow()` ile içine girebilsin diye (plan §8).
 *  - Sayfanın CSS'i paneli bozamaz, panelin CSS'i sayfayı bozmaz.
 * GÜVENLİK: LLM'den veya sayfadan gelen hiçbir metin innerHTML ile basılmaz;
 * tüm içerik `textContent` ile yazılır (XSS önlemi). `h()` yardımcısı bunu zorlar.
 * Hukuki uyarı panelin gövdesi dışında durur: panel küçültülse bile görünür.
 */
export const HOST_ID = 'tos-risk-panel-host';

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) if (c) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

export class ReportPanel {
  private readonly root: ShadowRoot;
  private readonly body: HTMLElement;
  private readonly frame: HTMLElement;
  private readonly host: HTMLElement;
  private readonly onKeydown: (e: KeyboardEvent) => void;
  onAnalyze: () => void = () => {};
  onExport: () => void = () => {};
  onClose: () => void = () => {};
  onDisableAutoOpen: () => void = () => {};

  /** Paneli sayfadan kaldırır (analiz sürüyorsa sonucu artık gösterilmez). */
  close(): void {
    document.removeEventListener('keydown', this.onKeydown, true);
    this.host.remove();
    this.onClose();
  }

  get isOpen(): boolean {
    return this.host.isConnected;
  }

  constructor() {
    document.getElementById(HOST_ID)?.remove();
    const host = h('div', { id: HOST_ID });
    this.root = host.attachShadow({ mode: 'open' });
    this.root.append(h('style', {}, STYLES));

    // Küçült / büyüt: simge ve erişilebilirlik durumu panelin hâline göre değişir
    const minimize = h('button', { class: 'icon', 'data-testid': 'minimize', 'aria-expanded': 'true', 'aria-label': 'Paneli küçült', title: 'Küçült' }, '–');
    minimize.addEventListener('click', () => {
      const min = this.frame.classList.toggle('min');
      minimize.textContent = min ? '+' : '–';
      minimize.setAttribute('aria-expanded', String(!min));
      minimize.setAttribute('aria-label', min ? 'Paneli büyüt' : 'Paneli küçült');
      minimize.title = min ? 'Büyüt' : 'Küçült';
    });
    // Kapat: panel sayfadan kaldırılır; uzantı simgesine tıklayınca yeniden açılır
    const close = h('button', { class: 'icon', 'data-testid': 'close', 'aria-label': 'Paneli kapat', title: 'Kapat (Esc). Uzantı simgesiyle yeniden açılır' }, '×');
    close.addEventListener('click', () => this.close());
    this.onKeydown = (e: KeyboardEvent) => {
      // Yalnızca odak paneldeyken: sayfanın kendi Esc kullanımını bozmamak için
      if (e.key === 'Escape' && e.composedPath().includes(host)) this.close();
    };
    document.addEventListener('keydown', this.onKeydown, true);

    // Hukuki uyarı: ilk cümle her durumda (küçültülmüşken de) görünür, devamı yalnızca açıkken
    const [first, ...rest] = LEGAL_DISCLAIMER.split(/(?<=\.)\s+/);
    this.body = h('div', { class: 'body', 'data-testid': 'panel-body' });
    this.frame = h(
      'section',
      { class: 'frame', 'data-testid': 'panel', role: 'complementary', 'aria-label': 'Sözleşme risk raporu' },
      h('header', {}, h('strong', {}, 'Sözleşme Risk Analizi'), h('span', { class: 'actions' }, minimize, close)),
      h('p', { class: 'disclaimer', 'data-testid': 'legal-disclaimer', role: 'note' }, '⚖️ ', h('span', { 'data-testid': 'legal-disclaimer-core' }, first ?? LEGAL_DISCLAIMER), rest.length ? h('span', { class: 'more' }, ' ', rest.join(' ')) : null),
      this.body,
    );
    this.frame.append(h('div', { class: 'build', 'data-testid': 'build' }, `sürüm: ${BUILD_TIME.slice(0, 16).replace('T', ' ')} UTC`));
    this.host = host;
    this.root.append(this.frame);
    document.documentElement.append(host);
  }

  get shadowRoot(): ShadowRoot {
    return this.root;
  }

  showIdle(detectionScore: number, opts: { devMode?: boolean; autoOpened?: boolean } = {}): void {
    const btn = h('button', { class: 'primary', 'data-testid': 'analyze-button' }, 'Bu sayfayı analiz et');
    btn.addEventListener('click', () => this.onAnalyze());
    let quiet: HTMLElement | null = null;
    if (opts.autoOpened) {
      const b = h('button', { class: 'link', 'data-testid': 'disable-auto-open' }, 'Bu sitede kendiliğinden açılmasın');
      b.addEventListener('click', () => this.onDisableAutoOpen());
      quiet = h('p', { class: 'muted' }, b, ' · Uzantı simgesiyle her zaman açabilirsiniz.');
    }
    this.body.replaceChildren(
      h('p', {}, detectionScore >= 0.5 ? 'Bu sayfa bir sözleşme metnine benziyor.' : 'Bu sayfa bir sözleşme sayfasına pek benzemiyor, yine de analiz edebilirsiniz.'),
      btn,
      h('p', { class: 'muted' }, 'Analiz için sayfanın görünür metni, kendi API anahtarınızla Gemini\'ye gönderilir.'),
      ...[quiet, opts.devMode ? this.exportButton() : null].filter((x): x is HTMLElement => x !== null),
    );
  }

  private exportButton(): HTMLElement {
    const b = h('button', { class: 'link', 'data-testid': 'export-button', title: 'LLM\'e gönderilen metni eval korpusu için JSON olarak indirir' }, '💾 Eval için metni kaydet');
    b.addEventListener('click', () => this.onExport());
    return h('p', { class: 'muted' }, b);
  }

  showLoading(step: string): void {
    this.body.replaceChildren(h('p', { class: 'loading', 'data-testid': 'loading', role: 'status' }, '⏳ ', step));
  }

  showError(message: string): void {
    const retry = h('button', { 'data-testid': 'retry-button' }, 'Tekrar dene');
    retry.addEventListener('click', () => this.onAnalyze());
    this.body.replaceChildren(h('div', { class: 'error', 'data-testid': 'error', role: 'alert' }, '❌ ', message), retry);
  }

  /** "Skor nasıl hesaplandı?": kategori × ağırlık × şiddet çarpanı tablosu (koddaki formülün aynısı). */
  private scoreDetails(r: Report): HTMLElement {
    const b = scoreBreakdown(r.findings);
    const n = (x: number) => x.toLocaleString('tr-TR');
    const rows = b.terms.map((t) =>
      h('tr', {}, h('td', {}, CATEGORIES[t.category].label_tr), h('td', {}, n(t.weight)), h('td', {}, `${SEVERITY_LABELS[t.severity]} ×${n(t.multiplier)}`), h('td', {}, n(t.points))),
    );
    return h(
      'details',
      { class: 'score-details', 'data-testid': 'score-details' },
      h('summary', {}, 'Skor nasıl hesaplandı?'),
      h('p', { class: 'muted' }, 'Yalnızca alıntısı metinde doğrulanmış maddeler sayılır. Her risk türü bir kez, en yüksek şiddetiyle: ağırlık × şiddet çarpanı (düşük 0,5 · orta 1 · yüksek 1,5).'),
      b.terms.length
        ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Risk türü'), h('th', {}, 'Ağırlık'), h('th', {}, 'Şiddet'), h('th', {}, 'Puan'))), h('tbody', {}, ...rows))
        : h('p', { class: 'muted' }, 'Doğrulanmış madde yok, skor 0.'),
      h('p', { class: 'muted' }, `Toplam: ${b.terms.map((t) => n(t.points)).join(' + ') || '0'} = ${b.total}${b.capped ? ' (100 ile sınırlandı)' : ''}. Eşikler: ${RISK_THRESHOLDS.medium} altı düşük, ${RISK_THRESHOLDS.high} ve üstü yüksek risk. Şiddet seçimi yapay zekâdan gelir.`),
    );
  }

  showReport(r: Report): void {
    const parts: Child[] = [];

    // 1) Skor
    parts.push(
      h(
        'div',
        { class: `score ${r.risk_level}`, 'data-testid': 'risk-score', 'data-score': String(r.risk_score) },
        h('span', { class: 'num' }, String(r.risk_score)),
        h('span', {}, ` / 100 · ${RISK_LEVEL_LABELS[r.risk_level]}`),
      ),
      r.uncertainty.level === 'high'
        ? h('p', { class: 'score-caveat', 'data-testid': 'score-caveat' }, 'Güvenilirlik düşük: bazı maddeler doğrulanamadığı ya da sayfada şüpheli içerik olduğu için skor eksik veya yanıltıcı olabilir.')
        : null,
      this.scoreDetails(r),
    );

    // 2) Belirsizlik (dürüstlük kutusu) – skordan hemen sonra, gözden kaçmasın
    if (r.uncertainty.level === 'high' || r.uncertainty.reasons.length > 0) {
      const high = r.uncertainty.level === 'high';
      parts.push(
        h(
          'div',
          { class: high ? 'uncertain high' : 'uncertain', 'data-testid': 'uncertainty', 'data-level': r.uncertainty.level, role: high ? 'alert' : 'status' },
          h('strong', {}, high ? '⚠️ Bu raporun güvenilirliği düşük çünkü:' : 'ℹ️ Notlar:'),
          h('ul', {}, ...r.uncertainty.reasons.map((x) => h('li', { 'data-reason': x }, UNCERTAINTY_LABELS[x]))),
          r.uncertainty.notes.length > 0 &&
            h('details', {}, h('summary', {}, 'Yapay zekânın notları'), h('ul', {}, ...r.uncertainty.notes.map((n) => h('li', {}, n)))),
        ),
      );
    }

    // 2b) Salt-okuma denetimi sonucu
    parts.push(
      r.synthetic_interactions && r.synthetic_interactions.count > 0
        ? h('div', { class: 'error', 'data-testid': 'action-guard', 'data-synthetic': String(r.synthetic_interactions.count), role: 'alert' },
            `🚨 Analiz sırasında ${r.synthetic_interactions.count} sentetik etkileşim görüldü: `, r.synthetic_interactions.samples.join(', '))
        : h('p', { class: 'muted', 'data-testid': 'action-guard', 'data-synthetic': '0' }, '✅ Salt-okuma denetimi: analiz sırasında sayfada hiçbir tıklama veya giriş tetiklenmedi.'),
    );

    // 3) Özet
    if (r.summary_tr) parts.push(h('p', { class: 'summary', 'data-testid': 'summary' }, r.summary_tr));

    // 4) Maddeler
    parts.push(h('h3', {}, `Riskli maddeler (${r.findings.length})`));
    if (r.findings.length === 0) parts.push(h('p', { class: 'muted' }, 'Doğrulanmış riskli madde bulunamadı. Bu, sözleşmenin risksiz olduğu anlamına gelmez.'));
    const sorted = [...r.findings].sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
    parts.push(
      h(
        'ol',
        { class: 'findings', 'data-testid': 'findings' },
        ...sorted.map((f) => {
          const show = h('button', { class: 'link', 'data-testid': 'show-quote' }, 'Sayfada göster');
          show.addEventListener('click', () => {
            if (!highlightQuote(f.quote)) show.textContent = 'Sayfada konumu bulunamadı';
          });
          return h(
            'li',
            { class: `finding ${f.severity}`, 'data-testid': 'finding', 'data-category': f.category },
            h('div', { class: 'row' }, h('strong', {}, CATEGORIES[f.category].label_tr), h('span', { class: `badge ${f.severity}` }, SEVERITY_LABELS[f.severity])),
            h('p', {}, f.explanation_tr),
            h('blockquote', { 'data-testid': 'quote' }, '“', f.quote, '”'),
            h('div', { class: 'row muted' }, h('span', {}, `Kaynak: ${f.matched_segment_id} · güven %${Math.round(f.confidence * 100)}`), show),
          );
        }),
      ),
    );

    // 5) Reddedilen iddialar
    const rejected = r.rejected.filter((x) => x.reason !== 'duplicate');
    if (rejected.length > 0) {
      parts.push(
        h(
          'details',
          { class: 'rejected', 'data-testid': 'rejected' },
          h('summary', {}, `🚫 Reddedilen iddialar (${rejected.length}): doğrulamadan geçemedi`),
          h(
            'ul',
            {},
            ...rejected.map((x) => {
              const f = x.finding as { category?: string; quote?: string };
              return h('li', {}, `[${REJECT_LABELS[x.reason]}] ${f.category ?? '?'}: “${String(f.quote ?? '').slice(0, 200)}”`);
            }),
          ),
        ),
      );
    }

    // 6) Gizli içerik
    if (r.hidden.length > 0) {
      const instr = r.hidden.filter((x) => x.looks_like_instruction);
      parts.push(
        h(
          'details',
          { class: instr.length > 0 ? 'hidden-content alarm' : 'hidden-content', 'data-testid': 'hidden-content', ...(instr.length > 0 ? { open: '' } : {}) },
          h('summary', {}, `🕵️ Gizli içerik (${r.hidden.length}${instr.length > 0 ? `, ${instr.length} tanesi talimat gibi` : ''}): yapay zekâya gönderilmedi`),
          h(
            'ul',
            {},
            ...[...instr, ...r.hidden.filter((x) => !x.looks_like_instruction)].slice(0, 30).map((x) =>
              h('li', { 'data-instruction': String(x.looks_like_instruction) }, x.looks_like_instruction ? '⚠️ ' : '', `[${HIDDEN_LABELS[x.reason]}] “${x.text.slice(0, 200)}”`),
            ),
          ),
        ),
      );
    }

    parts.push(h('p', { class: 'muted' }, `Kapsam: metnin %${Math.round(r.coverage * 100)}'i analiz edildi · ${new Date(r.analyzed_at).toLocaleString('tr-TR')}`));
    const again = h('button', { 'data-testid': 'analyze-button' }, 'Yeniden analiz et');
    again.addEventListener('click', () => this.onAnalyze());
    parts.push(again, this.exportButton());

    this.body.replaceChildren(...parts.filter((p): p is Node => !!p && typeof p !== 'string'));
  }
}

const sevRank = (s: 'low' | 'medium' | 'high') => ({ low: 0, medium: 1, high: 2 })[s];

const STYLES = `
/* Kabı kilitle: sayfanın CSS'i (#tos-risk-panel-host { display:none !important } gibi) paneli ve hukuki
   uyarıyı gizleyemesin. Kaskad kuralı: !important bildirimlerde Shadow DOM içindeki :host kuralı
   dış sayfanın kuralını yener. (Test: cypress/fixtures/pages/terms-hostile-css.html) */
:host {
  all: initial !important; display: block !important; visibility: visible !important; opacity: 1 !important;
  position: static !important; transform: none !important; filter: none !important; clip-path: none !important;
  mask: none !important; contain: none !important; zoom: 1 !important;
}
.frame {
  --bg: #fff; --fg: #1a1a1a; --muted: #5f5f5f; --faint: #8a8a8a; --line: #e3e3e3; --border: #c8c8c8;
  --btn-bg: #f4f4f4; --btn-border: #b5b5b5; --accent: #1f5eff; --accent-fg: #fff; --link: #1f5eff;
  --warn-bg: #fff4ce; --warn-fg: #3b2f00; --warn-line: #e6d58a;
  --ok-bg: #e5f6ea; --mid-bg: #fff0d6; --bad-bg: #fde3e1; --bad-fg: #8a1c12; --bad-line: #e29b95;
  --info-bg: #eef3ff; --info-line: #c9d7ff; --alarm-bg: #fff1e0; --alarm-line: #e07b00; --alarm-fg: #a23b00;
  --quote-bg: #f7f7f7; --quote-line: #9a9a9a; --focus: #1f5eff;
  position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  text-align: left; direction: ltr; color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  .frame {
    --bg: #1e1f22; --fg: #ececec; --muted: #a8a8a8; --faint: #8c8c8c; --line: #34363b; --border: #4a4d55;
    --btn-bg: #2b2d31; --btn-border: #50535b; --accent: #4c7dff; --accent-fg: #fff; --link: #8fb0ff;
    --warn-bg: #3a3214; --warn-fg: #f6e7a8; --warn-line: #6b5d1f;
    --ok-bg: #173323; --mid-bg: #3b2f14; --bad-bg: #432020; --bad-fg: #ffb4ab; --bad-line: #7a3a35;
    --info-bg: #1d2740; --info-line: #34467a; --alarm-bg: #3a2614; --alarm-line: #e07b00; --alarm-fg: #ffb366;
    --quote-bg: #26282c; --quote-line: #6b6e75; --focus: #8fb0ff;
    color-scheme: dark; box-shadow: 0 6px 24px rgba(0,0,0,.5);
  }
}
@media (prefers-reduced-motion: no-preference) { button { transition: background-color .12s; } }
.frame.min .body, .frame.min .build, .frame.min .disclaimer .more { display: none; }
.frame.min .disclaimer { border-bottom: 0; border-radius: 0 0 10px 10px; }
.actions { display: flex; gap: 6px; }
header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--line); }
.disclaimer { margin: 0; padding: 8px 14px; background: var(--warn-bg); color: var(--warn-fg); border-bottom: 1px solid var(--warn-line); font-size: 13px; font-weight: 600; }
.body { overflow-y: auto; padding: 12px 14px; flex: 1 1 auto; min-height: 0; } /* min-height:0 → uzun rapor panel içinde kayar, ekrandan taşmaz */
button { font: inherit; color: var(--fg); cursor: pointer; border: 1px solid var(--btn-border); background: var(--btn-bg); border-radius: 6px; padding: 6px 12px; }
button:hover { filter: brightness(0.96); }
button:focus-visible, summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); width: 100%; padding: 9px; font-weight: 600; }
button.icon { padding: 0 10px; font-size: 18px; line-height: 24px; min-width: 32px; }
button.link { border: 0; background: none; color: var(--link); padding: 0; text-decoration: underline; }
.muted { color: var(--muted); font-size: 12px; }
.build { padding: 4px 14px; border-top: 1px solid var(--line); color: var(--faint); font-size: 11px; }
.score { display: flex; align-items: baseline; gap: 6px; padding: 10px 12px; border-radius: 8px; font-weight: 600; }
.score .num { font-size: 32px; }
.score.low { background: var(--ok-bg); } .score.medium { background: var(--mid-bg); } .score.high { background: var(--bad-bg); }
.uncertain { margin: 10px 0; padding: 10px 12px; border-radius: 8px; background: var(--info-bg); border: 1px solid var(--info-line); }
.uncertain.high { background: var(--alarm-bg); border: 2px solid var(--alarm-line); }
.uncertain ul { margin: 6px 0 0; padding-left: 18px; }
.error { padding: 10px 12px; border-radius: 8px; background: var(--bad-bg); border: 1px solid var(--bad-line); margin-bottom: 8px; }
h3 { font-size: 15px; margin: 14px 0 6px; }
.findings { padding-left: 18px; margin: 0; }
.finding { margin-bottom: 12px; }
.finding p { margin: 4px 0; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.badge { font-size: 11px; padding: 1px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
.badge.low { background: var(--ok-bg); } .badge.medium { background: var(--mid-bg); } .badge.high { background: var(--bad-bg); color: var(--bad-fg); }
blockquote { margin: 4px 0; padding: 6px 10px; border-left: 3px solid var(--quote-line); background: var(--quote-bg); font-style: italic; overflow-wrap: anywhere; }
details { margin: 10px 0; } summary { cursor: pointer; font-weight: 600; }
details ul { padding-left: 18px; font-size: 12px; overflow-wrap: anywhere; }
.hidden-content.alarm summary { color: var(--alarm-fg); }
.score-caveat { margin: 6px 0 0; font-size: 12px; color: var(--alarm-fg); font-weight: 600; }
.score-details { margin: 8px 0; font-size: 12px; } .score-details summary { font-weight: 600; font-size: 12px; color: var(--muted); }
.score-details table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.score-details th, .score-details td { text-align: left; padding: 3px 4px; border-bottom: 1px solid var(--line); }
.score-details td:nth-child(n+2), .score-details th:nth-child(n+2) { text-align: right; white-space: nowrap; }
`;
