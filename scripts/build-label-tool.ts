/**
 * eval/label-template.html → eval/label.html
 * - Kategoriler tek kaynaktan gelir (src/shared/categories.ts).
 * - eval/corpus/*.json ve varsa eval/gold/<ad>.gold.json araca gömülür; böylece metin
 *   listeden seçilir ve her metnin etiket durumu görünür. (Dosya, korpus metnini içerdiği
 *   için üretilmiş bir çıktıdır ve git'e girmez.)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATEGORIES, CATEGORY_IDS } from '../src/shared/categories';
import { CORPUS_FORMAT } from '../src/shared/corpus';
import { GoldSchema } from '../eval/lib/gold';

export interface LabelToolOptions {
  corpusDir?: string;
  goldDir?: string;
  /** Uyarılar (bozuk dosya vb.) */
  warn?: (msg: string) => void;
}

interface Entry {
  file: string;
  corpus: { format: string; url: string; title: string; captured_at: string; segments: unknown[]; hidden: unknown[] };
  gold: unknown | null;
}

/** </script> kaçışı: JSON metni script etiketini kapatamasın */
const toScriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export function collectCorpus({ corpusDir = 'eval/corpus', goldDir = 'eval/gold', warn = () => {} }: LabelToolOptions = {}): Entry[] {
  if (!existsSync(corpusDir)) return [];
  const files = readdirSync(corpusDir).filter((f) => f.endsWith('.json')).sort();
  const entries: Entry[] = [];
  for (const file of files) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(readFileSync(join(corpusDir, file), 'utf8'));
    } catch {
      warn(`atlandı (JSON okunamadı): ${file}`);
      continue;
    }
    if (data.format !== CORPUS_FORMAT || !Array.isArray(data.segments)) {
      warn(`atlandı (korpus dosyası değil): ${file}`);
      continue;
    }
    // Yalnızca etiketleme için gereken alanlar (kör etiketleme: LLM çıktısı zaten korpusta yok)
    const corpus = {
      format: data.format as string,
      url: String(data.url ?? ''),
      title: String(data.title ?? ''),
      captured_at: String(data.captured_at ?? ''),
      segments: data.segments as unknown[],
      hidden: Array.isArray(data.hidden) ? (data.hidden as unknown[]) : [],
    };
    let gold: unknown | null = null;
    const goldPath = join(goldDir, file.replace(/\.json$/i, '') + '.gold.json');
    if (existsSync(goldPath)) {
      const parsed = GoldSchema.safeParse(JSON.parse(readFileSync(goldPath, 'utf8')));
      if (parsed.success) gold = parsed.data;
      else warn(`etiket dosyası geçersiz, yok sayıldı: ${goldPath}`);
    }
    entries.push({ file, corpus, gold });
  }
  return entries;
}

export function buildLabelTool(options: LabelToolOptions = {}): string {
  const cats = CATEGORY_IDS.map((id) => ({ id, label_tr: CATEGORIES[id].label_tr, definition: CATEGORIES[id].definition }));
  return readFileSync('eval/label-template.html', 'utf8')
    .replace('/*__CATEGORIES__*/[]', () => toScriptJson(cats))
    .replace('/*__CORPUS_LIST__*/[]', () => toScriptJson(collectCorpus(options)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const entries = collectCorpus({ warn: (m) => console.warn('⚠ ' + m) });
  writeFileSync('eval/label.html', buildLabelTool());
  console.log(`→ eval/label.html üretildi (${entries.length} metin). Tarayıcıda açın: start eval\\label.html`);
  for (const e of entries) {
    const g = e.gold as { complete: boolean; items: unknown[] } | null;
    const st = g ? (g.complete ? `✅ tamamlandı, ${g.items.length} etiket` : `📝 taslak, ${g.items.length} etiket`) : '⬜ etiketlenmedi';
    console.log(`   ${st.padEnd(26)} ${e.file}`);
  }
}
