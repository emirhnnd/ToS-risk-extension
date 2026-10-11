import { PageController } from '@page-agent/page-controller';

/**
 * F2: page-agent'in DOM→metin katmanı ile görünür sayfa metnini alır.
 *
 * GÜVENLİK: PageController'ın yalnızca `updateTree()` (okuma) metodu kullanılır.
 * clickElement / inputText / selectOption / scroll / executeJavascript gibi aksiyon
 * metotları bu kod tabanında HİÇBİR YERDE çağrılmaz (tests/unit/readonly.test.ts
 * bunu kaynak kodu tarayarak denetler). LLM'in çıktısı da hiçbir zaman bir aksiyona
 * bağlanmaz; LLM'e araç (tool) verilmez.
 */
export async function extractVisibleText(): Promise<string> {
  const pc = new PageController({
    viewportExpansion: -1, // tüm sayfa, yalnızca görünür alan değil
    enableMask: false,
    includeAttributes: [],
  });
  try {
    const simplified = await pc.updateTree();
    return simplifiedToPlainText(simplified);
  } finally {
    await pc.cleanUpHighlights();
    pc.dispose();
  }
}

/**
 * page-agent'in "simplified HTML" çıktısını düz metne çevirir.
 * Etkileşimli elemanlar `[12]<a href=...>Metin />` biçiminde gelir; yalnızca metin tutulur.
 * Saf fonksiyon, birim testi var.
 */
export function simplifiedToPlainText(simplified: string): string {
  return simplified
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*\*?/, '')
        // Etiket işaretleri satırın HERHANGİ bir yerinde olabilir (gerçek Amazon/Netflix sayfalarında görüldü):
        //   'Ana içerik [8]<div id=glow-ingress-block>Teslimat konumu … />'  → yalnızca metin
        .replace(/(?:\[\d+\])?<[a-zA-Z][\w-]*(?:\s[^<>]*?)?>/g, ' ')
        .replace(/\s*\/>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 0)
    .join('\n');
}
