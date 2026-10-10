# ToS Risk Analizi: Chrome Uzantısı

Kullanım koşulları, gizlilik politikası ve abonelik şartları sayfalarını LLM ile analiz eden, ama **LLM'e güvenmeyen** bir Chrome uzantısı (Manifest V3, TypeScript, Vite).

> ⚠️ **Bu uygulama hukuki tavsiye vermez.**

> 🚧 Geliştirme sürüyor (gün 1/5). Bu README teslimden önce mimari diyagram, eval sonuçları ve güvenlik bölümüyle tamamlanacak.

## Temel ilke

LLM sistemin içinde **güvenilmez bir bileşen**dir. Ürettiği hiçbir şey doğrulanmadan kullanıcıya ulaşmaz:

| LLM ne yapar | Kod ne yapar |
|---|---|
| Riskli maddeleri ve alıntılarını önerir (JSON) | JSON'u Zod şemasıyla doğrular (`src/shared/schema.ts`), bilinmeyen alanları reddeder |
| Her maddeye birebir alıntı verir | Alıntıyı orijinal metinde arar, bulunamazsa maddeyi **atar** (`src/validator/quote.ts`) |
| Şiddet seviyesi önerir | Risk skorunu **formülle** hesaplar, LLM'den skor istenmez (`src/validator/score.ts`) |
| — | Belirsizlik nedenlerini kurallarla belirler (`src/validator/validate.ts`) |

## Kurulum (geliştirme)

```bash
npm install
npm test         # birim testleri
npm run build    # dist/ klasörü oluşur
```

Chrome → `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → `dist/` klasörü.
Ayarlar sayfasında Gemini API anahtarını girin. Anahtar yalnızca `chrome.storage.local` içinde saklanır, repoda yoktur.

## Klasör yapısı

```
src/
  shared/      kategori listesi + ağırlıklar, Zod şeması, tipler
  content/     sayfa algılama, page-agent ile metin çıkarma (salt okuma)
  sanitizer/   segmentasyon, talimat-benzeri metin tespiti
  validator/   şema, alıntı doğrulama, skor, belirsizlik  ← sistemin kalbi
  background/  service worker, LLM istemcisi
  ui/          ayarlar sayfası, rapor paneli
tests/unit/    Vitest
```

## Risk skoru

```
skor = min(100, round( Σ_kategori ağırlık(k) × max_çarpan(k) ))
çarpan: low 0.5 · medium 1 · high 1.5      seviye: <20 düşük · <45 orta · ≥45 yüksek
```

Her kategori yalnızca bir kez, en yüksek şiddetiyle sayılır. Böylece LLM aynı maddeyi tekrar ederek skoru şişiremez. Ağırlıklar `src/shared/categories.ts` dosyasındadır.

## Alıntı doğrulama kuralları

- Karşılaştırma öncesi normalizasyon: Unicode NFKD, aksanlar kaldırılır, büyük/küçük harf, akıllı tırnaklar, tireler, boşluklar ve sıfır genişlikli karakterler eşitlenir. **Kelimeler değişirse eşleşme olmaz.**
- En az 4 kelime gerekir. Kısa parçalar her metinde geçtiği için reddedilir.
- `...` / `…` ile kırpılmış alıntı birebir sayılmaz ve reddedilir.
- LLM yanlış `segment_id` verirse alıntının gerçekte bulunduğu segment kaydedilir.
- Bilinen sınırlama: aksan kaldırma, çok nadir durumlarda farklı kelimeleri (örn. "sasi" / "şaşı") eşleştirebilir.

## Varsayımlar

| Belirsizlik | Varsayım |
|---|---|
| Grup büyüklüğü | Bireysel |
| "sade Türkçe açıklama ve ___" | Güven / belirsizlik seviyesi |
| page-agent kullanımı | Yalnızca DOM→metin okuma katmanı (`@page-agent/page-controller`). Aksiyon metotları kapalı; `tests/unit/readonly.test.ts` bunu denetler |
| İçerik betiği kapsamı | Otomatik algılama (F1) için tüm http/https sayfalarda çalışır. Yalnızca okuma yapar, ağ isteği atmaz |
