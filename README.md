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
cypress/       E2E: e2e/*.cy.js, fixtures/pages (test sayfaları), fixtures/llm (kayıtlı Gemini yanıtları)
scripts/       test sunucusu + LLM vekili, Cypress çalıştırıcısı, etiketleme aracı üreticisi
eval/          korpus, altın etiketler, ölçüm
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
| Eval dili | 3 Türkçe (Spotify, Getir, YouTube) + 3 İngilizce (Netflix, Amazon.com, Steam) metin, hepsi 11 Ekim 2026 tarihli tek sürümden (`extension_build: 2026-10-11T07:10:18.198Z`). Spotify `tr-en` adresi Türkçe metin döndürdü. Açıklamalar her durumda Türkçe |
| İçerik betiği kapsamı | Otomatik algılama (F1) için tüm http/https sayfalarda çalışır. Yalnızca okuma yapar, ağ isteği atmaz |

## Eval

```
eval/corpus/   uzantının "💾 Eval için metni kaydet" butonuyla kaydedilen, tarihli LLM girdileri
eval/gold/     eval/label.html ile ELLE (LLM görmeden) hazırlanan altın etiketler
eval/extra/    etiketsiz ek metinler (ör. YouTube TR/EN çeviri çifti), ölçüme girmez
eval/cache/    LLM ham yanıtları: aynı girdi → aynı sonuç (tekrarlanabilirlik)
eval/results.md   npm run eval çıktısı      eval/error-analysis.md   elle yazılan hata analizi
```

1. Sözleşme sayfasında panelden **💾 Eval için metni kaydet** → dosyayı `eval/corpus/` içine koyun.
2. `npm run label` → `eval/label.html` dosyasını tarayıcıda açın. `eval/corpus/` içindeki metinler araca gömülür ve listede etiket durumlarıyla görünür (⬜ etiketlenmedi / 📝 taslak / ✅ tamamlandı). Riskli ifadeleri seçerek etiketleyin, indirilen dosyayı `eval/gold/` içine koyun. (`label.html` korpus metnini içerdiği için üretilmiş dosyadır, git'e girmez.) Araç LLM sonucunu göstermez (kör etiketleme).
3. `npm run eval` (anahtar `.env` içindeki `GEMINI_API_KEY`). İlk çalıştırma LLM'i çağırır, sonrakiler önbellekten okur; `--no-cache` yeni çağrı yapar.

**Eşleştirme kuralı** (sonuçlara bakmadan önce yazıldı, `eval/lib/match.ts`): sistem bulgusu ile altın etiket, *aynı kategoride* ve alıntılarının metindeki karakter aralıkları *kesişiyorsa* eşleşir; eşleştirme bire birdir. Aynı maddeyi parçalı bulmak FP değil "tekrar" sayılır. Yeri doğru ama kategorisi farklı bulgu FP + FN olur ve raporda ayrıca işaretlenir.

**Ek kural (etiketleme bittikten sonra, sonuçlar görülmeden eklendi):** Aynı kategoride metinde kesişen altın etiketler tek madde sayılır. Etiketleme sırasında aynı paragraf yanlışlıkla birkaç kez ya da iç içe parçalar halinde eklenmişti (Spotify'da 3, Steam'de 2 etiket). Bu kural olmasaydı LLM o maddeyi doğru bulsa bile fazla kopyalar FN sayılırdı. Etiket dosyalarına dokunulmadı; birleştirme sayısı `results.md` özetinde gösterilir.

## Uçtan uca test (Cypress)

```
npm run e2e         # tüm Cypress testleri (ilk sefer Chrome for Testing indirir)
npm run e2e:video   # yalnızca demo testi, adımlar arası beklemeli → cypress/videos/demo.cy.js.mp4
npm run e2e:open    # Cypress arayüzü
```

- **Neden Chrome for Testing?** Markalı Chrome 137'den beri `--load-extension` bayrağını desteklemiyor; Cypress belgeleri de Chrome for Testing veya Chromium öneriyor. `scripts/e2e.mjs` onu bir kez `.browsers/` altına indirir.
- **Ayrı e2e build'i (`dist-e2e/`).** `vite build --mode e2e` iki şeyi değiştirir. Birincisi, Cypress test edilen sayfayı iframe içinde açtığı için içerik betiği çerçevelere de girer (`all_frames`). İkincisi, LLM isteği Google yerine yerel test sunucusuna (`localhost:5555/e2e-llm/…`) gider. Normal build'de bunların hiçbiri yoktur; `tests/unit/e2e-setup.test.ts` bunu denetler.
- **Anahtar yine uzantıda değil.** E2E build'inde uzantı yer tutucu bir anahtar gönderir. Gerçek anahtarı test sunucusu `.env`'den ekleyip isteği Gemini'ye iletir.
- **Kayıtlı gerçek yanıtlar.** Sunucu (`LLM_MODE=auto`) her başarılı Gemini yanıtını `cypress/fixtures/llm/<istek özeti>.json` olarak kaydeder; aynı istek tekrar gelirse kayıttan döndürür. Video (`e2e:video`, `LLM_MODE=replay`) bu kayıtlarla çekilir. Böylece videodaki çıktı gerçek bir Gemini yanıtıdır ama video beklemesiz ve tekrarlanabilir olur. Sayfa veya prompt değişirse istek özeti değişir ve kayıt geçersiz kalır; `npm run e2e` yeniden kaydeder.
- **Gizli metnin LLM'e gitmediği dışarıdan kanıtlanır.** Test sunucusu son LLM isteğini `/e2e-llm/last` adresinde gösterir. Demo testi bu isteğin içinde gizli talimatların hiçbirinin olmadığını doğrular. Ekran dışı (`left:-9999px`) metin kuralı jsdom'da test edilemiyordu; burada gerçek tarayıcıda test edilir.

| Test | Ne gösterir |
|---|---|
| `demo.cy.js` 1) mutlu yol | Panel kendiliğinden açılır, hukuki uyarı görünür, analiz sonrası her alıntı sayfa metninde birebir bulunur, "Sayfada göster" vurgular, salt-okuma denetimi 0 |
| `demo.cy.js` 2) belirsizlik | Gizli talimatlı sayfada belirsizlik **yüksek**, gizli içerik "şüpheli" olarak listelenir, LLM'e giden istekte gizli metin yok, sayfadaki butona kodla hiç tıklanmadı |
| `guards.cy.js` | Sözleşme olmayan sayfada panel açılmaz; panel open Shadow DOM'dadır; uyarı panel küçültülünce bile görünür |

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
- Metin çıkarma, sayfada `<main>` bölgesi varsa (ve metnin ≥%40'ını içeriyorsa) yalnızca onu alır; menü, alt bilgi ve çerez uyarısı dışarıda kalır. `<main>` yoksa sayfanın tamamı alınır ve bu gürültü LLM'e gider. Korpus dosyasındaki `extraction` alanı hangisinin olduğunu ve kaç satır atıldığını kaydeder.
- Alıntı normalizasyonu aksanları kaldırır; çok nadir durumlarda farklı kelimeleri eşleştirebilir.
