# ToS Risk Analizi: Chrome Uzantısı

Kullanım koşulları, gizlilik politikası ve abonelik şartları sayfalarını LLM ile analiz eden, ama **LLM'e güvenmeyen** bir Chrome uzantısı (Manifest V3, TypeScript, Vite).

> ⚠️ **Bu uygulama hukuki tavsiye vermez.**

> 🚧 Geliştirme sürüyor (gün 2/5). Bu README teslimden önce mimari diyagram, eval sonuçları ve güvenlik bölümüyle tamamlanacak.

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
**Kodu her güncellediğinizde:** `npm run build` → `chrome://extensions`'ta uzantının ⟳ (yenile) simgesi → açık sekmeyi F5 ile yenile. Bu sıra atlanırsa Chrome eski dosyaları arar (`ERR_FILE_NOT_FOUND`).

Ayarlar sayfasında Gemini API anahtarını girin. Anahtar yalnızca `chrome.storage.local` içinde saklanır, repoda yoktur.

Yerel test sayfaları için `npm run fixtures` çalıştırıp http://localhost:5555 adresini açın (kurgusal ToS + prompt injection sayfası).

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

## Güvenlik

- **Gizli metin LLM'e gitmez.** `display:none`, `visibility:hidden`, `opacity:0`, 2 px altı yazı, ekran dışı konum, kırpma, şeffaf veya arka planla aynı renk yazı tespit edilir (`src/sanitizer/hidden.ts`). Bu metinler raporda "gizli içerik" olarak listelenir; talimata benzeyenler güvenilirliği düşürür.
- **Sayfa metni veri olarak işaretlenir.** Talimatlar `systemInstruction` alanında, sayfa metni `<untrusted_document>` içinde gönderilir; metindeki kapanış etiketi etkisizleştirilir (sınırlayıcıdan kaçış saldırısı).
- **LLM hiçbir şeye karar vermez.** Şema dışı çıktı reddedilir (`.strict()`: LLM'in eklediği bir `risk_score` alanı bile geçmez). Alıntısı metinde olmayan iddia atılır. Skor formülle hesaplanır.
- **page-agent salt okuma modunda.** Yalnızca `@page-agent/page-controller` paketinin `updateTree()` metodu kullanılır; aksiyonlu `page-agent` paketi bağımlılıkta yoktur. `tests/unit/readonly.test.ts`, kaynak kodda hiçbir aksiyon metodunun çağrılmadığını denetler. Kütüphanedeki `eval` çağrısı yalnızca hiç kullanmadığımız `executeJavascript` aksiyonundadır; ayrıca MV3'ün içerik güvenliği politikası `eval`'i zaten engeller.
- **API anahtarı.** Yalnızca service worker okur; içerik betiği ve sayfa göremez. İstek başlığında (`x-goog-api-key`) gönderilir, URL'de değil. `tests/unit/secrets.test.ts` git'e girecek dosyaları anahtar kalıplarına karşı tarar; `.githooks/pre-commit` anahtar içeren commit'i engeller.
- **XSS.** Panel, LLM veya sayfa kaynaklı metni yalnızca `textContent` ile yazar; birim testi `<img onerror>` içeren LLM çıktısının çalışmadığını doğrular.
- **Mesaj doğrulama.** Service worker, içerik betiğinden gelen isteği de Zod ile doğrular ve yalnızca kendi uzantısından gelen mesajları kabul eder.

## Bilinen sınırlamalar

- **Alıntı doğrulama, metnin sayfada var olduğunu kanıtlar; gerçek bir sözleşme maddesi olduğunu kanıtlamaz.** Saldırgan uydurma bir maddeyi sayfaya görünür biçimde yazarsa doğrulama onu kabul eder. Bu durumda tek savunma, görünür metindeki talimat benzeri ifadelerin güvenilirliği düşürmesidir (`tests/unit/fixtures.test.ts`, "BİLİNEN SINIRLAMA" testi).
- Talimat tespiti düzenli ifadelere dayanır; eş anlamlı ifadeleri veya desteklenmeyen dilleri kaçırabilir. Bu bir raporlama sinyalidir, asıl savunma değildir.
- Gizli metin tespiti; başka bir elemanın arkasına saklanmış (z-index) veya resim üstüne aynı renkte yazılmış metni yakalamaz. `aria-hidden` bilinçli olarak gizli sayılmaz, çünkü görsel olarak görünürdür.
- jsdom yerleşim hesaplamadığı için "ekran dışı" kuralı birim testlerinde değil, Cypress'te gerçek Chrome'da test edilir.
- Alıntı normalizasyonu aksanları kaldırır; çok nadir durumlarda farklı kelimeleri eşleştirebilir.
