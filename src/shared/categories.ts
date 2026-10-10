/**
 * Risk kategorileri: tek doğruluk kaynağı.
 * Şema (LLM'e verilen enum), skor formülü, UI etiketleri ve eval altın etiketleri
 * hepsi bu listeyi kullanır. Yeni kategori eklemek = yalnızca burayı değiştirmek.
 */
export const CATEGORY_IDS = [
  'AUTO_RENEWAL',
  'CANCELLATION_DIFFICULTY',
  'NO_REFUND',
  'UNILATERAL_CHANGE',
  'DATA_SHARING',
  'DATA_RETENTION',
  'CONTENT_LICENSE',
  'ARBITRARY_TERMINATION',
  'LIABILITY_DISCLAIMER',
  'ARBITRATION_CLASS_WAIVER',
  'JURISDICTION_FOREIGN_LAW',
  'SENSITIVE_DATA',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryInfo {
  id: CategoryId;
  /** UI'da gösterilen Türkçe ad */
  label_tr: string;
  /** LLM'e ve etiketleyiciye verilen tanım: neyin bu kategoriye girdiği */
  definition: string;
  /** Skor formülündeki ağırlık (1–10). Kullanıcıya etkisi büyük olan yüksek. */
  weight: number;
}

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  AUTO_RENEWAL: {
    id: 'AUTO_RENEWAL',
    label_tr: 'Otomatik yenileme',
    definition: 'Abonelik veya ödeme, kullanıcı açıkça iptal etmedikçe kendiliğinden yenilenir.',
    weight: 6,
  },
  CANCELLATION_DIFFICULTY: {
    id: 'CANCELLATION_DIFFICULTY',
    label_tr: 'İptal zorluğu',
    definition: 'İptal için uzun ön bildirim süresi, yalnızca telefon/posta ile iptal, cayma bedeli gibi engeller.',
    weight: 6,
  },
  NO_REFUND: {
    id: 'NO_REFUND',
    label_tr: 'İade yok',
    definition: 'Ödenen ücretlerin kısmen veya tamamen iade edilmeyeceğini söyleyen hükümler.',
    weight: 5,
  },
  UNILATERAL_CHANGE: {
    id: 'UNILATERAL_CHANGE',
    label_tr: 'Tek taraflı değişiklik',
    definition: 'Şirketin koşulları, fiyatı veya hizmeti kullanıcının onayı olmadan değiştirebilmesi.',
    weight: 7,
  },
  DATA_SHARING: {
    id: 'DATA_SHARING',
    label_tr: 'Üçüncü taraflarla veri paylaşımı / satışı',
    definition: 'Kişisel verilerin reklamverenler, iş ortakları veya başka şirketlerle paylaşılması ya da satılması.',
    weight: 8,
  },
  DATA_RETENTION: {
    id: 'DATA_RETENTION',
    label_tr: 'Veri saklama süresi',
    definition: 'Verilerin hesap silindikten sonra da veya belirsiz/uzun süre saklanması.',
    weight: 5,
  },
  CONTENT_LICENSE: {
    id: 'CONTENT_LICENSE',
    label_tr: 'Kullanıcı içeriğine geniş lisans',
    definition: 'Kullanıcının yüklediği içerik üzerinde şirkete geniş, devredilebilir, telifsiz, süresiz kullanım hakkı.',
    weight: 6,
  },
  ARBITRARY_TERMINATION: {
    id: 'ARBITRARY_TERMINATION',
    label_tr: 'Keyfi hesap kapatma',
    definition: 'Şirketin hesabı sebep göstermeden veya önceden bildirmeden askıya alabilmesi/kapatabilmesi.',
    weight: 6,
  },
  LIABILITY_DISCLAIMER: {
    id: 'LIABILITY_DISCLAIMER',
    label_tr: 'Sorumluluk reddi',
    definition: 'Şirketin zararlardan sorumluluğunu reddetmesi veya tazminatı çok düşük bir tutarla sınırlaması.',
    weight: 5,
  },
  ARBITRATION_CLASS_WAIVER: {
    id: 'ARBITRATION_CLASS_WAIVER',
    label_tr: 'Tahkim / toplu dava feragati',
    definition: 'Uyuşmazlıkların mahkeme yerine zorunlu tahkimde çözülmesi veya toplu davadan feragat.',
    weight: 8,
  },
  JURISDICTION_FOREIGN_LAW: {
    id: 'JURISDICTION_FOREIGN_LAW',
    label_tr: 'Yetkili mahkeme / yabancı hukuk',
    definition: 'Uyuşmazlıklarda kullanıcının ülkesi dışındaki bir hukukun veya mahkemenin yetkili kılınması.',
    weight: 4,
  },
  SENSITIVE_DATA: {
    id: 'SENSITIVE_DATA',
    label_tr: 'Hassas veri (konum, biyometri vb.)',
    definition: 'Hassas konum, biyometrik, sağlık, rehber veya benzeri özel nitelikli verilerin toplanması.',
    weight: 7,
  },
};

export const SEVERITIES = ['low', 'medium', 'high'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Skor formülündeki şiddet çarpanı */
export const SEVERITY_MULTIPLIER: Record<Severity, number> = {
  low: 0.5,
  medium: 1,
  high: 1.5,
};

export const DOCUMENT_TYPES = ['terms', 'privacy', 'subscription', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
