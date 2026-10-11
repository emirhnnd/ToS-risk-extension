/**
 * Mini eval: npm run eval
 *
 *   eval/corpus/<ad>.json        uzantının "💾 Eval için metni kaydet" butonuyla kaydedilen girdi
 *   eval/gold/<ad>.gold.json     eval/label.html ile ELLE hazırlanan altın etiketler
 *   eval/cache/<hash>.json       LLM ham yanıtları (tekrarlanabilirlik: aynı girdi → aynı sonuç)
 *   eval/results.md / .json      üretilen sonuçlar
 *
 * Uzantıyla AYNI kod yolu kullanılır: aynı istem, aynı bütçe, aynı doğrulayıcı (buildReport).
 * Seçenekler: --no-cache (yeni LLM çağrısı), --model <ad>, --only <ad-parçası>
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_MODEL, analyzeWithGemini } from '../src/background/llm';
import { CATEGORIES, type CategoryId } from '../src/shared/categories';
import { CorpusSnapshotSchema, type CorpusSnapshot } from '../src/shared/corpus';
import { MAX_LLM_CHARS } from '../src/shared/limits';
import { PROMPT_VERSION, buildSystemInstruction, buildUserMessage } from '../src/shared/prompt';
import type { Report, Segment } from '../src/shared/schema';
import { selectWithinBudget } from '../src/sanitizer/segment';
import { buildReport, parseLlmOutput } from '../src/validator/validate';
import { GoldSchema, type Gold } from './lib/gold';
import { matchFindings, prf, type MatchResult } from './lib/match';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
/** --dir: testlerde ayrı klasörle çalıştırmak için (varsayılan: eval) */
const DIR = opt('--dir') ?? 'eval';

function loadEnv(): Record<string, string> {
  if (!existsSync('.env')) return {};
  return Object.fromEntries(
    readFileSync('.env', 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1]!, m[2]!.replace(/^["']|["']$/g, '')]),
  );
}

interface DocResult {
  name: string; url: string; captured_at: string; language: string;
  segments: number; coverage: number; llm_findings: number; rejected: number;
  report: Report; match: MatchResult; cached: boolean;
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const apiKey = env.GEMINI_API_KEY ?? '';
  const model = opt('--model') ?? env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const useCache = !flag('--no-cache');
  const only = opt('--only');
  mkdirSync(join(DIR, 'cache'), { recursive: true });

  const files = readdirSync(join(DIR, 'corpus')).filter((f) => f.endsWith('.json') && (!only || f.includes(only))).sort();
  if (files.length === 0) return fail('eval/corpus klasöründe .json yok. Uzantıdaki "💾 Eval için metni kaydet" ile kaydedip buraya koyun.');

  const results: DocResult[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const name = basename(file, '.json');
    const snap = CorpusSnapshotSchema.parse(JSON.parse(readFileSync(join(DIR, 'corpus', file), 'utf8')));
    const goldPath = join(DIR, 'gold', `${name}.gold.json`);
    if (!existsSync(goldPath)) { skipped.push(`${name}: altın etiket yok (${goldPath})`); continue; }
    const gold: Gold = GoldSchema.parse(JSON.parse(readFileSync(goldPath, 'utf8')));
    if (!gold.complete) { skipped.push(`${name}: etiketleme tamamlanmamış ("complete": false)`); continue; }

    process.stdout.write(`• ${name} … `);
    const r = await analyze(snap, model, apiKey, useCache);
    if (!r.ok) { console.log(`HATA: ${r.error}`); skipped.push(`${name}: LLM hatası: ${r.error}`); continue; }
    const match = matchFindings(r.selected, gold.items, r.report.findings);
    console.log(`${r.cached ? '(önbellek) ' : ''}TP ${match.tp.length} · FP ${match.fp.length} · FN ${match.fn.length}`);
    results.push({
      name, url: snap.url, captured_at: snap.captured_at, language: r.report.language, segments: snap.segments.length,
      coverage: r.report.coverage, llm_findings: r.llmFindings, rejected: r.report.rejected.filter((x) => x.reason !== 'duplicate').length,
      report: r.report, match, cached: r.cached,
    });
  }

  writeFileSync(join(DIR, 'results.json'), JSON.stringify({ model, prompt_version: PROMPT_VERSION, generated_at: new Date().toISOString(), skipped, results }, null, 2));
  writeFileSync(join(DIR, 'results.md'), renderMarkdown(results, skipped, model));
  console.log(`\n→ eval/results.md yazıldı (${results.length} metin, ${skipped.length} atlandı)`);
}

async function analyze(snap: CorpusSnapshot, model: string, apiKey: string, useCache: boolean) {
  const { selected, coverage } = selectWithinBudget(snap.segments, MAX_LLM_CHARS);
  const meta = { url: snap.url, title: snap.title };
  const key = cacheKey(model, selected, meta);
  const cachePath = join(DIR, 'cache', `${key}.json`);

  let raw: string | undefined;
  let cached = false;
  if (useCache && existsSync(cachePath)) {
    raw = JSON.parse(readFileSync(cachePath, 'utf8')).raw;
    cached = true;
  } else {
    if (!apiKey) return { ok: false as const, error: '.env içinde GEMINI_API_KEY yok' };
    const res = await analyzeWithGemini(selected, meta, { apiKey, model, timeoutMs: 180_000 });
    if (!res.ok) return { ok: false as const, error: res.error };
    raw = res.raw;
    writeFileSync(cachePath, JSON.stringify({ model, prompt_version: PROMPT_VERSION, url: snap.url, created_at: new Date().toISOString(), raw }, null, 2));
    await new Promise((r) => setTimeout(r, 4000)); // ücretsiz katman hız sınırı
  }
  const parsed = parseLlmOutput(raw!);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  const report = buildReport({ url: snap.url, now: new Date(snap.captured_at), detectionScore: snap.detection_score, coverage, segments: selected, hidden: snap.hidden, output: parsed.data });
  return { ok: true as const, report, selected, cached, llmFindings: parsed.data.findings.length };
}

export function cacheKey(model: string, selected: Segment[], meta: { url: string; title: string }): string {
  return createHash('sha256').update([model, PROMPT_VERSION, buildSystemInstruction(), buildUserMessage(selected, meta)].join('\u0000')).digest('hex').slice(0, 24);
}

// ---------- rapor ----------
const pct = (x: number | null) => (x === null ? '–' : `%${Math.round(x * 100)}`);
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const cut = (s: string, n = 110) => esc(s.length > n ? `${s.slice(0, n)}…` : s);
const catLabel = (c: CategoryId) => CATEGORIES[c].label_tr;

export function renderMarkdown(results: DocResult[], skipped: string[], model: string): string {
  const sum = (f: (r: DocResult) => number) => results.reduce((n, r) => n + f(r), 0);
  const TP = sum((r) => r.match.tp.length), FP = sum((r) => r.match.fp.length), FN = sum((r) => r.match.fn.length);
  const all = prf(TP, FP, FN);
  const llmTotal = sum((r) => r.llm_findings), rejTotal = sum((r) => r.rejected);
  const sevAgree = results.flatMap((r) => r.match.tp).filter((t) => t.gold.severity === t.sys.severity).length;

  const L: string[] = [];
  L.push('# Eval sonuçları', '', `> Otomatik üretildi: \`npm run eval\` · model \`${model}\` · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '> Altın etiketler elle, LLM kullanılmadan hazırlandı (`eval/gold/`). Eşleştirme kuralı: `eval/lib/match.ts`.', '');
  L.push('## Özet', '', '| Metrik | Değer |', '|---|---|',
    `| Metin sayısı | ${results.length} |`, `| TP / FP / FN | ${TP} / ${FP} / ${FN} |`,
    `| Precision | ${pct(all.precision)} |`, `| Recall | ${pct(all.recall)} |`, `| F1 | ${pct(all.f1)} |`,
    `| Reddedilen alıntı oranı (halüsinasyon göstergesi) | ${pct(llmTotal ? rejTotal / llmTotal : null)} (${rejTotal}/${llmTotal}) |`,
    `| TP'lerde şiddet uyumu (LLM = elle etiket) | ${pct(TP ? sevAgree / TP : null)} (${sevAgree}/${TP}) |`, '');

  L.push('## Metin bazında', '', '| Metin | Dil | Bölüm | Kapsam | TP | FP | FN | Precision | Recall | Reddedilen | Skor |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const m = prf(r.match.tp.length, r.match.fp.length, r.match.fn.length);
    L.push(`| [${r.name}](${r.url}) | ${r.language} | ${r.segments} | ${pct(r.coverage)} | ${r.match.tp.length} | ${r.match.fp.length} | ${r.match.fn.length} | ${pct(m.precision)} | ${pct(m.recall)} | ${r.rejected} | ${r.report.risk_score} |`);
  }
  L.push('');

  L.push('## Kategori bazında', '', '| Kategori | TP | FP | FN | Precision | Recall |', '|---|---|---|---|---|---|');
  for (const c of Object.keys(CATEGORIES) as CategoryId[]) {
    const tp = sum((r) => r.match.tp.filter((t) => t.gold.category === c).length);
    const fp = sum((r) => r.match.fp.filter((t) => t.sys.category === c).length);
    const fn = sum((r) => r.match.fn.filter((t) => t.category === c).length);
    if (tp + fp + fn === 0) continue;
    const m = prf(tp, fp, fn);
    L.push(`| ${catLabel(c)} | ${tp} | ${fp} | ${fn} | ${pct(m.precision)} | ${pct(m.recall)} |`);
  }
  L.push('');

  L.push('## Hata listesi', '', 'Her satırın **nedeni** `eval/error-analysis.md` dosyasında elle yorumlanır.', '');
  for (const r of results) {
    if (r.match.fn.length + r.match.fp.length + r.match.unlocatableGold.length === 0) continue;
    L.push(`### ${r.name}`, '', '| Tür | Kategori | Alıntı | Not |', '|---|---|---|---|');
    for (const g of r.match.fn) L.push(`| FN (kaçırıldı) | ${catLabel(g.category)} | “${cut(g.quote)}” | ${esc(g.note ?? '')} |`);
    for (const f of r.match.fp) L.push(`| FP (yanlış alarm) | ${catLabel(f.sys.category)} | “${cut(f.sys.quote)}” | ${f.wrongCategoryOf ? `yer doğru, kategori yanlış (etiket: ${catLabel(f.wrongCategoryOf)})` : ''} |`);
    for (const g of r.match.unlocatableGold) L.push(`| ⚠️ etiket metinde yok | ${catLabel(g.category)} | “${cut(g.quote)}” | etiketleme hatası, düzeltilmeli |`);
    L.push('');
  }
  const rejectedRows = results.flatMap((r) => r.report.rejected.filter((x) => x.reason !== 'duplicate').map((x) => ({ r, x })));
  if (rejectedRows.length) {
    L.push('## Reddedilen LLM iddiaları', '', '| Metin | Neden | Alıntı |', '|---|---|---|');
    for (const { r, x } of rejectedRows) L.push(`| ${r.name} | ${x.reason} | “${cut(String((x.finding as { quote?: string }).quote ?? ''))}” |`);
    L.push('');
  }
  if (skipped.length) L.push('## Atlanan metinler', '', ...skipped.map((s) => `- ${s}`), '');
  return L.join('\n');
}

function fail(msg: string): never {
  console.error(`✋ ${msg}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => fail((e as Error).stack ?? String(e)));
