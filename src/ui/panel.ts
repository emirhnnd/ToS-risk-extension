import { CATEGORIES } from '../shared/categories';
import type { Report } from '../shared/schema';
import { BUILD_TIME } from '../shared/build';
import { highlightQuote } from './highlight';
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
  onAnalyze: () => void = () => {};
  onExport: () => void = () => {};

  constructor() {
    document.getElementById(HOST_ID)?.remove();
    const host = h('div', { id: HOST_ID });
    this.root = host.attachShadow({ mode: 'open' });
    this.root.append(h('style', {}, STYLES));

    const minimize = h('button', { class: 'icon', 'data-testid': 'minimize', 'aria-label': 'Küçült / büyüt', title: 'Küçült / büyüt' }, '–');
    minimize.addEventListener('click', () => this.frame.classList.toggle('min'));

    this.body = h('div', { class: 'body', 'data-testid': 'panel-body' });
    this.frame = h(
      'section',
      { class: 'frame', 'data-testid': 'panel', role: 'complementary', 'aria-label': 'Sözleşme risk raporu' },
      h('header', {}, h('strong', {}, 'Sözleşme Risk Analizi'), minimize),
      h('p', { class: 'disclaimer', 'data-testid': 'legal-disclaimer', role: 'note' }, '⚖️ ', LEGAL_DISCLAIMER),
      this.body,
    );
    this.frame.append(h('div', { class: 'build', 'data-testid': 'build' }, `sürüm: ${BUILD_TIME.slice(0, 16).replace('T', ' ')} UTC`));
    this.root.append(this.frame);
    document.documentElement.append(host);
  }

  get shadowRoot(): ShadowRoot {
    return this.root;
  }

  showIdle(detectionScore: number): void {
    const btn = h('button', { class: 'primary', 'data-testid': 'analyze-button' }, 'Bu sayfayı analiz et');
    btn.addEventListener('click', () => this.onAnalyze());
    this.body.replaceChildren(
      h('p', {}, detectionScore >= 0.5 ? 'Bu sayfa bir sözleşme metnine benziyor.' : 'Bu sayfa bir sözleşme sayfasına pek benzemiyor, yine de analiz edebilirsiniz.'),
      btn,
      h('p', { class: 'muted' }, 'Analiz için sayfanın görünür metni, kendi API anahtarınızla Gemini\'ye gönderilir.'),
      this.exportButton(),
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
      h('p', { class: 'muted' }, 'Skor, yalnızca alıntısı doğrulanmış maddelerden sabit bir formülle hesaplanır.'),
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
:host { all: initial; }
.frame { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 380px; max-height: calc(100vh - 32px);
  display: flex; flex-direction: column; background: #fff; color: #1a1a1a; border: 1px solid #c8c8c8; border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.frame.min .body { display: none; }
header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #e3e3e3; }
.disclaimer { margin: 0; padding: 8px 14px; background: #fff4ce; color: #3b2f00; border-bottom: 1px solid #e6d58a; font-size: 13px; font-weight: 600; }
.body { overflow-y: auto; padding: 12px 14px; flex: 1 1 auto; min-height: 0; } /* min-height:0 → uzun rapor panel içinde kayar, ekrandan taşmaz */
button { font: inherit; cursor: pointer; border: 1px solid #b5b5b5; background: #f4f4f4; border-radius: 6px; padding: 6px 12px; }
button.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; width: 100%; padding: 9px; font-weight: 600; }
button.icon { padding: 0 10px; font-size: 18px; line-height: 24px; }
button.link { border: 0; background: none; color: #1f5eff; padding: 0; text-decoration: underline; }
.muted { color: #5f5f5f; font-size: 12px; }
.build { padding: 4px 14px; border-top: 1px solid #e3e3e3; color: #8a8a8a; font-size: 11px; }
.frame.min .build { display: none; }
.score { display: flex; align-items: baseline; gap: 6px; padding: 10px 12px; border-radius: 8px; font-weight: 600; }
.score .num { font-size: 32px; }
.score.low { background: #e5f6ea; } .score.medium { background: #fff0d6; } .score.high { background: #fde3e1; }
.uncertain { margin: 10px 0; padding: 10px 12px; border-radius: 8px; background: #eef3ff; border: 1px solid #c9d7ff; }
.uncertain.high { background: #fff1e0; border: 2px solid #e07b00; }
.uncertain ul { margin: 6px 0 0; padding-left: 18px; }
.error { padding: 10px 12px; border-radius: 8px; background: #fde3e1; border: 1px solid #e29b95; margin-bottom: 8px; }
h3 { font-size: 15px; margin: 14px 0 6px; }
.findings { padding-left: 18px; margin: 0; }
.finding { margin-bottom: 12px; }
.finding p { margin: 4px 0; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.badge { font-size: 11px; padding: 1px 8px; border-radius: 10px; font-weight: 600; }
.badge.low { background: #e5f6ea; } .badge.medium { background: #fff0d6; } .badge.high { background: #fde3e1; color: #8a1c12; }
blockquote { margin: 4px 0; padding: 6px 10px; border-left: 3px solid #9a9a9a; background: #f7f7f7; font-style: italic; overflow-wrap: anywhere; }
details { margin: 10px 0; } summary { cursor: pointer; font-weight: 600; }
details ul { padding-left: 18px; font-size: 12px; overflow-wrap: anywhere; }
.hidden-content.alarm summary { color: #a23b00; }
`;
