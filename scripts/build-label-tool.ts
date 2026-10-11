/** eval/label-template.html → eval/label.html (kategoriler tek kaynaktan, src/shared/categories.ts). */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CATEGORIES, CATEGORY_IDS } from '../src/shared/categories';

export function buildLabelTool(): string {
  const cats = CATEGORY_IDS.map((id) => ({ id, label_tr: CATEGORIES[id].label_tr, definition: CATEGORIES[id].definition }));
  // </script> kaçışı: JSON metni script etiketini kapatamasın
  const json = JSON.stringify(cats).replace(/</g, '\\u003c');
  return readFileSync('eval/label-template.html', 'utf8').replace('/*__CATEGORIES__*/[]', json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync('eval/label.html', buildLabelTool());
  console.log('→ eval/label.html üretildi. Tarayıcıda açın (çift tıklayın).');
}
