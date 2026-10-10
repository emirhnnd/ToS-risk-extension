import type { HiddenTextFinding, RejectedFinding, UncertaintyReason } from '../shared/schema';

export const LEGAL_DISCLAIMER = 'Bu uygulama hukuki tavsiye vermez. Rapor otomatik üretilmiştir ve hata içerebilir; önemli kararlar için sözleşmenin tamamını okuyun veya bir hukukçuya danışın.';

export const UNCERTAINTY_LABELS: Record<UncertaintyReason, string> = {
  not_a_contract_page: 'Bu sayfa bir sözleşme sayfasına benzemiyor.',
  partial_coverage: 'Metin çok uzun; bir kısmı analiz edilemedi.',
  rejected_claims: 'Yapay zekânın bazı iddiaları metinde bulunamadığı için reddedildi.',
  hidden_instructions: 'Sayfada gizlenmiş, yapay zekâya yönelik talimat tespit edildi.',
  visible_instructions: 'Sayfa metninde yapay zekâya yönelik talimat gibi görünen ifadeler var.',
  low_confidence_findings: 'Bazı maddelerde yapay zekâ düşük güven bildirdi.',
  unsupported_language: 'Metin desteklenmeyen bir dilde; sonuçlar güvenilir olmayabilir.',
  llm_reported_uncertainty: 'Yapay zekâ analiz sırasında belirsizlik notları bıraktı.',
};

export const HIDDEN_LABELS: Record<HiddenTextFinding['reason'], string> = {
  display_none: 'görünmez (display:none)',
  visibility_hidden: 'görünmez (visibility:hidden)',
  zero_opacity: 'tamamen şeffaf (opacity:0)',
  zero_size_font: 'okunamayacak kadar küçük yazı',
  offscreen: 'ekran dışına itilmiş',
  transparent: 'şeffaf renkli yazı',
  same_color: 'arka planla aynı renkte yazı',
  aria_hidden: 'erişilebilirlikten gizli',
  clipped: 'kırpılarak gizlenmiş',
};

export const REJECT_LABELS: Record<RejectedFinding['reason'], string> = {
  quote_not_found: 'alıntı metinde yok',
  too_short: 'alıntı çok kısa',
  contains_ellipsis: 'alıntı kırpılmış (…)',
  duplicate: 'tekrar eden madde',
};

export const SEVERITY_LABELS = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' } as const;
export const RISK_LEVEL_LABELS = { low: 'Düşük risk', medium: 'Orta risk', high: 'Yüksek risk' } as const;
