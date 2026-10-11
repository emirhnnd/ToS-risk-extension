/**
 * Alıntı karşılaştırması için metin normalizasyonu.
 *
 * Amaç: LLM'in "birebir" alıntısını, yalnızca biçimsel farklar yüzünden
 * reddetmemek (akıllı tırnak, fazla boşluk, büyük/küçük harf, satır sonu).
 * KELİMELER değişirse eşleşme olmaz: normalizasyon içerik değiştirmez.
 *
 * Bilinçli sınırlama: aksan işaretleri kaldırılır (ş→s, ü→u, İ/ı→i) çünkü
 * Türkçe büyük/küçük harf dönüşümü (I/ı, İ/i) İngilizce ile çakışır.
 * Bu, "sasi" ile "şaşı" gibi nadir çakışmalara izin verir; README'de yazılı.
 */
export function normalizeForMatch(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // birleşik aksan işaretleri
    .replace(/[­​-‍⁠﻿]/g, '') // yumuşak tire, sıfır genişlikli
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    // Tırnak/parantez/noktalama çevresindeki boşluk farkı içerik farkı değildir:
    // '(" Spotify Hizmeti ")' ≡ '("Spotify Hizmeti")', 'Politikası 'na' ≡ 'Politikası'na'
    .replace(/\s*(["'()\[\]])\s*/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/** Normalize edilmiş metindeki kelime sayısı */
export function wordCount(normalized: string): number {
  return normalized.length === 0 ? 0 : normalized.split(' ').length;
}
