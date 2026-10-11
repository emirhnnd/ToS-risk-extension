import type { CategoryId } from '../../src/shared/categories';
import type { Segment, VerifiedFinding } from '../../src/shared/schema';
import { QuoteIndex } from '../../src/validator/quote';
import type { GoldItem } from './gold';

/**
 * EŞLEŞTİRME KURALI (önceden yazıldı, sonuçlara bakmadan değiştirilmez):
 *   Sistem bulgusu S ile altın etiket G eşleşir ⇔
 *     S.category === G.category  VE
 *     S ve G alıntılarının normalize metindeki karakter aralıkları kesişir.
 *   Eşleştirme bire birdir (açgözlü, en çok kesişen önce). Bir G'ye birden çok S
 *   denk gelirse fazlası FP değil "tekrar" sayılır (skora etkisi yok, bkz. score.ts).
 *
 * TP = eşleşen G, FN = eşleşmeyen G, FP = eşleşmeyen ve tekrar olmayan S.
 * Ek tanı: FP'nin aralığı FARKLI kategorili bir G ile kesişiyorsa "yanlış kategori".
 */
export interface MatchResult {
  tp: { gold: GoldItem; sys: VerifiedFinding; overlap: number }[];
  fn: GoldItem[];
  fp: { sys: VerifiedFinding; wrongCategoryOf?: CategoryId }[];
  duplicates: VerifiedFinding[];
  /** Altın etiketin alıntısı korpusta bulunamadı: etiketleme hatası, ölçümden önce düzeltilmeli */
  unlocatableGold: GoldItem[];
}

type Span = [number, number];
const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

export function matchFindings(segments: readonly Segment[], gold: readonly GoldItem[], sys: readonly VerifiedFinding[]): MatchResult {
  const idx = new QuoteIndex(segments);
  const g = gold.map((item) => ({ item, span: idx.locate(item.quote) }));
  const s = sys.map((f) => ({ f, span: idx.locate(f.quote) }));
  const unlocatableGold = g.filter((x) => !x.span).map((x) => x.item);

  const pairs: { gi: number; si: number; ov: number }[] = [];
  g.forEach((gx, gi) => s.forEach((sx, si) => {
    if (!gx.span || !sx.span || gx.item.category !== sx.f.category) return;
    const ov = overlap(gx.span, sx.span);
    if (ov > 0) pairs.push({ gi, si, ov });
  }));
  pairs.sort((a, b) => b.ov - a.ov || a.gi - b.gi || a.si - b.si);

  const gUsed = new Set<number>();
  const sUsed = new Set<number>();
  const tp: MatchResult['tp'] = [];
  for (const p of pairs) {
    if (gUsed.has(p.gi) || sUsed.has(p.si)) continue;
    gUsed.add(p.gi); sUsed.add(p.si);
    tp.push({ gold: g[p.gi]!.item, sys: s[p.si]!.f, overlap: p.ov });
  }
  // Eşleşmiş bir G ile aynı kategoride kesişen fazladan S = tekrar
  const duplicates: VerifiedFinding[] = [];
  const fp: MatchResult['fp'] = [];
  s.forEach((sx, si) => {
    if (sUsed.has(si)) return;
    const dupOf = pairs.find((p) => p.si === si && gUsed.has(p.gi));
    if (dupOf) return void duplicates.push(sx.f);
    const wrong = sx.span ? g.find((gx) => gx.span && gx.item.category !== sx.f.category && overlap(gx.span, sx.span!) > 0) : undefined;
    fp.push({ sys: sx.f, ...(wrong ? { wrongCategoryOf: wrong.item.category } : {}) });
  });
  const fn = g.filter((gx, gi) => gx.span && !gUsed.has(gi)).map((x) => x.item);
  return { tp, fn, fp, duplicates, unlocatableGold };
}

export function prf(tp: number, fp: number, fn: number) {
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  const f1 = precision === null || recall === null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}
