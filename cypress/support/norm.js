/**
 * Alıntı karşılaştırması için hafif normalleştirme (src/validator/normalize.ts'in özü):
 * büyük/küçük harf, aksan, tırnak/tire biçimleri ve boşluklar yok sayılır.
 */
export function norm(s) {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ı/g, 'i')
    .replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ').replace(/\s+([.,;:!?)\]"'])/g, '$1').replace(/([(\["'])\s+/g, '$1')
    .trim();
}
