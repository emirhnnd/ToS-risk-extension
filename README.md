# ToS Risk Analizi: Chrome Uzantısı

[![CI](https://github.com/emirhnnd/ToS-risk-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/emirhnnd/ToS-risk-extension/actions/workflows/ci.yml)

Kullanım koşulları, gizlilik politikası ve abonelik şartları sayfalarını LLM ile analiz eden, ama **LLM'e güvenmeyen** bir Chrome uzantısı (Manifest V3, TypeScript, Vite).

> ⚠️ **Bu uygulama hukuki tavsiye vermez.**

## Demo videosu (51 sn, Cypress ile kaydedildi)

[![Demo videosu: mutlu yol ve gizli talimatlı sayfada dürüst belirsizlik](docs/demo-poster.png)](docs/demo.mp4)

▶ **[Videoyu izle: docs/demo.mp4](docs/demo.mp4)** · [doğrudan indir](https://github.com/emirhnnd/ToS-risk-extension/raw/main/docs/demo.mp4)

1. **Mutlu yol:** Panel sözleşme sayfasında kendiliğinden açılır ve maddeleri bulur. Her alıntı sayfada kodla doğrulanır. "Skor nasıl hesaplandı?" tablosu skorun formülden geldiğini gösterir. "Sayfada göster" alıntıyı vurgular.
2. **Belirsizlik anı:** Gizli talimatlı sayfada panel "bu raporun güvenilirliği düşük" der. Gizli talimatlar "şüpheli" olarak listelenir ve yapay zekâya gönderilmez; test bunu LLM'e giden istekten doğrular. Sayfadaki "Abone ol" butonuna kodla hiç tıklanmaz.

Video `npm run e2e:video` ile üretilir. Kullanılan LLM yanıtları gerçek Gemini yanıtlarıdır; kaydedilip (`cypress/fixtures/llm/`) tekrar oynatılır. Bu kayıtta Gemini uydurma alıntı üretmediği için videoda reddedilen bir iddia görünmüyor. Reddetme davranışı birim testlerinde (`tests/unit/validate.test.ts`, `fuzz.test.ts`) ve eval'de ölçüldü.


## Temel ilke

LLM sistemin içinde **güvenilmez bir bileşen**dir. Ürettiği hiçbir şey doğrulanmadan kullanıcıya ulaşmaz:

| LLM ne yapar | Kod ne yapar |
|---|---|
| Riskli maddeleri ve alıntılarını önerir (JSON) | JSON'u Zod şemasıyla doğrular (`src/shared/schema.ts`), bilinmeyen alanları reddeder |
| Her maddeye birebir alıntı verir | Alıntıyı orijinal metinde arar, bulunamazsa maddeyi **atar** (`src/validator/quote.ts`) |
| Şiddet seviyesi önerir | Risk skorunu **formülle** hesaplar, LLM'den skor istenmez (`src/validator/score.ts`) |
| — | Belirsizlik nedenlerini kurallarla belirler (`src/validator/validate.ts`) |

## Mimari

Üç ayrı çalışma ortamı var ve güven sınırları bunlara göre çizildi:

![Mimari: sayfa, içerik betiği, service worker ve Gemini arasındaki güven sınırları](docs/mimari.png)

### Veri akışı (bir analiz)

![Veri akışı: bir analizin adımları](docs/veri-akisi.png)

| Bileşen | Sorumluluk | Neye erişemez |
|---|---|---|
| İçerik betiği (`src/content`, `src/sanitizer`, `src/ui/panel.ts`) | Sayfayı okur, gizli metni ayıklar, raporu gösterir | API anahtarı, ağ (`tests/unit/boundaries.test.ts`) |
| Service worker (`src/background`) | Anahtarı okur, LLM'i çağırır, raporu üretir | Sayfa DOM'u |
| Doğrulayıcı (`src/validator`) | Şema, alıntı, skor, belirsizlik: saf fonksiyonlar | Ağ, tarayıcı API'leri (birim testlenir) |
| LLM | Yalnızca öneri üretir | Skor, karar, sayfada eylem |

## Kurulum (geliştirme)

Gerekli: Node.js 22 veya üstü (CI'da Node 22 ve 24 ile test edilir).

```bash
npm install
npm test         # birim testleri
npm run build    # dist/ klasörü oluşur
```

Chrome → `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → `dist/` klasörü.
**Kodu her güncellediğinizde:** `npm run build` → `chrome://extensions`'ta uzantının ⟳ (yenile) simgesi → açık sekmeyi F5 ile yenile. Bu sıra atlanırsa Chrome eski dosyaları arar (`ERR_FILE_NOT_FOUND`).

Ayarlar sayfasında Gemini API anahtarını girin. Anahtar yalnızca `chrome.storage.local` içinde saklanır, repoda yoktur.

Yerel test sayfaları için `npm run fixtures` çalıştırıp http://localhost:5555 adresini açın. Kurgusal ToS, prompt injection, 29 gizleme tekniği, gerçekçi düzenler ve agresif CSS sayfaları var.

Eval ve Cypress (canlı Gemini) için `.env.example` dosyasını `.env` olarak kopyalayıp `GEMINI_API_KEY=` satırına anahtarınızı yazın. `.env` git'e girmez.

**Sürekli entegrasyon:** Her gönderimde GitHub Actions şunları çalıştırır (`.github/workflows/ci.yml`):
- tip kontrolü
- birim testleri (sır taraması dahil)
- normal build ve e2e build
- normal build'e test sunucusu adresinin sızmadığının kontrolü

Cypress testleri görünür bir tarayıcı gerektirdiği için yerelde çalışır.

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
scripts/       test sunucusu + LLM vekili, Cypress çalıştırıcısı, etiketleme aracı ve diyagram üreticileri
eval/          korpus, altın etiketler, ölçüm, hata analizi
docs/          demo videosu, mimari ve veri akışı diyagramları (+ Mermaid kaynakları)
.github/       CI iş akışı
```

## Arayüz

- Panel sözleşme sayfasında kendiliğinden açılır. Kullanıcı paneli **×** veya Esc ile kapatabilir, küçültebilir ya da "bu sitede kendiliğinden açılmasın" diyebilir; uzantı simgesine tıklayınca panel her zaman yeniden açılır. Küçültülünce hukuki uyarının ilk cümlesi görünür kalır.
- **Skor nasıl hesaplandı?** bölümü, her risk türünün ağırlık × şiddet = puan katkısını gösterir. Kullanıcı skoru kendisi doğrulayabilir. Belirsizlik yüksekse skorun altında "skor eksik veya yanıltıcı olabilir" notu çıkar.
- Açık ve koyu tema (`prefers-color-scheme`), klavyeyle gezinme (görünür odak halkası) ve dar ekran (en fazla `100vw − 32px`) desteklenir. Ayarlar sayfası panelle aynı renkleri kullanır.

## Risk skoru

```
skor = min(100, round( Σ_kategori ağırlık(k) × max_çarpan(k) ))
çarpan: low 0.5 · medium 1 · high 1.5      seviye: <20 düşük · <45 orta · ≥45 yüksek
```

Her kategori yalnızca bir kez, en yüksek şiddetiyle sayılır. Böylece LLM aynı maddeyi tekrar ederek skoru şişiremez. Ağırlıklar `src/shared/categories.ts` dosyasındadır.

**Sınırı:** Formül deterministiktir, ama şiddet seçimi LLM'den gelir. Ağırlıklar ve eşikler veriyle ayarlanmadı; tasarım kararıdır. Şiddeti LLM'den almak yerine sabit bir değer kullanmanın daha iyi olup olmayacağı eval'deki 6 metinde ölçüldü. Ölçüt, elle etiketlerle aynı formülden çıkan skora olan ortalama mutlak farktı:

| Şiddet kaynağı | Ortalama fark | Risk seviyesi tutan metin |
|---|---|---|
| LLM (kullanılan) | 7,0 | 4/6 |
| Hepsi "orta" | 10,5 | 1/6 |
| Hepsi "yüksek" | 9,0 | 6/6 (3 metinde skor 12–17 puan fazla) |

LLM şiddeti sabit değerlerden daha yakın çıktığı için korundu. 6 metin ağırlıkları yeniden ayarlamak için yetersizdir; bunu yapmak bu 6 metne göre ezberlemek olurdu.

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
| "sade Türkçe açıklama ve ___" (ödev metninde boş) | Güven / belirsizlik seviyesi |
| "orijinal metinden ___ ile gösterilmeli" (ödev metninde boş) | Orijinal metinden **birebir alıntı** ile; sonraki cümle "Alıntısı olmayan iddia geçersiz sayılır" diyor |
| page-agent kullanımı ("… sayfada işlem yapabilir. ve ___", ödev metninde eksik) | Yalnızca DOM→metin okuma katmanı (`@page-agent/page-controller`). Aksiyon metotları kapalı; `tests/unit/readonly.test.ts` bunu denetler. Analiz sırasındaki her kod kaynaklı tıklama panelde sayılır |
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

1. Ayarlar sayfasında **Geliştirici modu**nu açın. Sözleşme sayfasında panelden **💾 Eval için metni kaydet** → dosyayı `eval/corpus/` içine koyun. (Bu düğme normal kullanıcıya gösterilmez.)
2. `npm run label` → `eval/label.html` dosyasını tarayıcıda açın. `eval/corpus/` içindeki metinler araca gömülür ve listede etiket durumlarıyla görünür (⬜ etiketlenmedi / 📝 taslak / ✅ tamamlandı). Riskli ifadeleri seçerek etiketleyin, indirilen dosyayı `eval/gold/` içine koyun. (`label.html` korpus metnini içerdiği için üretilmiş dosyadır, git'e girmez.) Araç LLM sonucunu göstermez (kör etiketleme).
3. `npm run eval` (anahtar `.env` içindeki `GEMINI_API_KEY`). İlk çalıştırma LLM'i çağırır, sonrakiler önbellekten okur; `--no-cache` yeni çağrı yapar.

**Eşleştirme kuralı** (sonuçlara bakmadan önce yazıldı, `eval/lib/match.ts`): sistem bulgusu ile altın etiket, *aynı kategoride* ve alıntılarının metindeki karakter aralıkları *kesişiyorsa* eşleşir; eşleştirme bire birdir. Aynı maddeyi parçalı bulmak FP değil "tekrar" sayılır. Yeri doğru ama kategorisi farklı bulgu FP + FN olur ve raporda ayrıca işaretlenir.

**Ek kural (etiketleme bittikten sonra, sonuçlar görülmeden eklendi):** Aynı kategoride metinde kesişen altın etiketler tek madde sayılır. Etiketleme sırasında aynı paragraf yanlışlıkla birkaç kez ya da iç içe parçalar halinde eklenmişti (Spotify'da 3, Steam'de 2 etiket). Bu kural olmasaydı LLM o maddeyi doğru bulsa bile fazla kopyalar FN sayılırdı. Etiket dosyalarına dokunulmadı; birleştirme sayısı `results.md` özetinde gösterilir.

### Sonuçlar (özet)

6 gerçek metin (Spotify, Getir, YouTube: TR · Netflix, Amazon.com, Steam: EN), 45 elle etiketlenmiş madde, `gemini-3.8-flash`, prompt v1. Ayrıntı: [`eval/results.md`](eval/results.md), hataların tek tek nedenleri: [`eval/error-analysis.md`](eval/error-analysis.md).

| Ölçüm | Precision | Recall | F1 |
|---|---|---|---|
| Madde düzeyi (birincil) | %82 | %69 | %75 |
| Belge × kategori (skorun kullandığı düzey) | %94 | %91 | %93 |

- **Halüsinasyon:** LLM'in 39 iddiasının hiçbiri alıntı doğrulamasında reddedilmedi.
- **Etiket gürültüsü:** Sonuçlar görüldükten sonra etiketleyici 7 yanlış alarmı tek tek inceledi: 4'üne "kaçırmışım", 2'sine "belki", 1'ine "hayır" dedi. Resmî sayılar değiştirilmedi. "Evet"ler sayılsaydı precision %92 olurdu. Bu inceleme tek yönlü olduğu için recall düzeltilemiyor.
- **Kaçırmalar:** 14 kaçırmanın 7'si aynı kategorinin ikinci örneği (LLM kategori başına genelde tek madde veriyor). 3'ü, aynı maddenin komşu cümlesinin alıntılanması.
- **Şiddet ve skor:** LLM şiddeti sistematik olarak düşük tahmin ediyor (eşleşen 31 maddenin 15'inde). Bu yüzden skor 6 metnin 5'inde, elle etiketlerle hesaplanandan düşük; Getir'de risk seviyesi "orta" yerine "düşük" çıkıyor.
- **Eval'in bulup düzelttiği iki hata:** (1) Tek bir uzun alıntı Spotify analizinin tamamını düşürüyordu; bulgular artık tek tek doğrulanıyor. (2) Görünür talimat sezgisi, sözleşmelerdeki yapay zekâ maddelerinde ("AI-generated content", "model parameters") yanlış alarm veriyordu; desen daraltıldı.

## Uçtan uca test (Cypress)

```
npm run e2e         # tüm Cypress testleri (ilk sefer Chrome for Testing indirir)
npm run e2e:video   # yalnızca demo testi, adımlar arası beklemeli → cypress/videos/demo.cy.js.mp4
npm run e2e:open    # Cypress arayüzü
```

- **Neden Chrome for Testing?** Markalı Chrome 137'den beri `--load-extension` bayrağını desteklemiyor; Cypress belgeleri de Chrome for Testing veya Chromium öneriyor. `scripts/e2e.mjs` onu bir kez `.browsers/` altına indirir.
- **Ayrı e2e build'i (`dist-e2e/`).** `vite build --mode e2e` iki şeyi değiştirir. Birincisi, Cypress test edilen sayfayı iframe içinde açtığı için içerik betiği çerçevelere de girer (`all_frames`). İkincisi, LLM isteği Google yerine yerel test sunucusuna (`localhost:5555/e2e-llm/…`) gider. Normal build'de bunların hiçbiri yoktur; `tests/unit/e2e-setup.test.ts` bunu denetler.
- **Anahtar yine uzantıda değil.** E2E build'inde uzantı yer tutucu bir anahtar gönderir. Gerçek anahtarı test sunucusu `.env`'den ekleyip isteği Gemini'ye iletir.
- **Kayıtlı gerçek yanıtlar.** Sunucu (`LLM_MODE=auto`) her başarılı Gemini yanıtını `cypress/fixtures/llm/<istek özeti>.json` olarak kaydeder; aynı istek tekrar gelirse kayıttan döndürür. Video (`e2e:video`, `LLM_MODE=replay`) bu kayıtlarla çekilir. Böylece videodaki çıktı gerçek bir Gemini yanıtıdır, ama video LLM'i beklemez ve tekrarlanabilir olur. Adımlar arasındaki duraklamalar ve ekran altı açıklamalar yalnızca video modunda vardır. Açıklamalar analiz bittikten sonra eklenir, böylece LLM'e giden metni değiştirmezler. Sayfa veya prompt değişirse istek özeti değişir ve kayıt geçersiz kalır; `npm run e2e` yeniden kaydeder.
- **Gizli metnin LLM'e gitmediği dışarıdan kanıtlanır.** Test sunucusu son LLM isteğini `/e2e-llm/last` adresinde gösterir. Demo testi bu isteğin içinde gizli talimatların hiçbirinin olmadığını doğrular. Ekran dışı (`left:-9999px`) metin kuralı jsdom'da test edilemiyordu; burada gerçek tarayıcıda test edilir.

| Test | Ne gösterir |
|---|---|
| `demo.cy.js` 1) mutlu yol | Panel kendiliğinden açılır ve hukuki uyarı görünür. Analizden sonra her alıntı sayfa metninde birebir bulunur. Skor dökümünün toplamı skorla aynıdır. "Sayfada göster" alıntıyı vurgular. Salt-okuma denetimi 0 |
| `demo.cy.js` 2) belirsizlik | Gizli talimatlı sayfada belirsizlik **yüksek**, gizli içerik "şüpheli" olarak listelenir, LLM'e giden istekte gizli metin yok, sayfadaki butona kodla hiç tıklanmadı |
| `guards.cy.js` | Sözleşme olmayan sayfada panel açılmaz. Panel open Shadow DOM'dadır. Küçültülünce uyarının ilk cümlesi ("Bu uygulama hukuki tavsiye vermez.") kalır. Panel × ile kapatılır. Agresif sayfa CSS'i paneli ve uyarıyı gizleyemez |
| `hiding.cy.js` | 29 gizleme tekniğinden 27'si LLM'e gitmez (biri bilinen sınırlama, biri aslında görünür). Gerçekçi düzenlerde görünür metin atılmaz |

## Güvenlik

- **Gizli metin LLM'e gitmez.** Tespit (`src/sanitizer/hidden.ts`) iki katmanlıdır:
  - **CSS kuralları:** `display:none`, `visibility:hidden`, `opacity:0` / `filter:opacity(0)`, 4 px altı yazı, şeffaf (alfa < 0,1) veya arka planla aynı renk, ekran dışı konum, `clip` / dejenere `clip-path`.
  - **Geometri:** Gerçek tarayıcıda metnin çizildiği dikdörtgenler okunur. Böylece `transform:scale(0)` ve `overflow:hidden` bir kutunun dışına itilen metin (`text-indent:-9999px`, 1 px kutu) tek tek kural yazmadan yakalanır.

  29 gizleme tekniğinden oluşan test sayfasında (`cypress/fixtures/pages/terms-hidden-techniques.html`) ilk ölçümde 9 teknik LLM'e sızıyordu; şimdi 27'si engelleniyor. Kalan iki teknikten biri bilinen sınırlama (üstü başka elemanla örtülen metin), diğeri ise aslında görünür. Yanlış alarm kontrolü için ikinci bir sayfa var (`terms-real-layouts.html`): kaydırılabilir sözleşme kutusu, "…" ile kısaltma, satır sınırlama ve 10 px dipnotun hepsi LLM'e gidiyor. İki sayfa da `cypress/e2e/hiding.cy.js` ile gerçek Chrome'da test edilir. Gizli metinler raporda "gizli içerik" olarak listelenir; talimata benzeyenler güvenilirliği düşürür.
- **Sayfa metni veri olarak işaretlenir.** Talimatlar `systemInstruction` alanında, sayfa metni `<untrusted_document>` içinde gönderilir. Metindeki kapanış etiketi etkisizleştirilir (sınırlayıcıdan kaçış saldırısı). Sayfa başlığı (`<title>`) ve URL de saldırganın kontrolünde olduğu için bloğun **içinde** durur. v1'de talimat düzeyindeydiler; denetimde bulunup prompt v2'de düzeltildi.
- **LLM hiçbir şeye karar vermez.** Doğrulama iki katmanlıdır. Dış yapı katıdır: bilinmeyen bir alan varsa (`.strict()`: LLM'in eklediği bir `risk_score` alanı bile) çıktının tamamı reddedilir. Bulgular ise tek tek doğrulanır: şemaya uymayan bulgu (örn. 600 karakteri aşan alıntı) atılır, "reddedilen iddia" olarak gösterilir ve belirsizliği yükseltir. İlk eval koşusunda tek bir uzun alıntı Spotify analizinin tamamını düşürdüğü için bu ayrım yapıldı. Alıntısı metinde olmayan iddia atılır. Skor formülle hesaplanır.
- **page-agent salt okuma modunda.** Yalnızca `@page-agent/page-controller` paketinin `updateTree()` metodu kullanılır; aksiyonlu `page-agent` paketi bağımlılıkta yoktur. `tests/unit/readonly.test.ts`, kaynak kodda hiçbir aksiyon metodunun çağrılmadığını denetler. Kütüphanedeki `eval` çağrısı yalnızca hiç kullanmadığımız `executeJavascript` aksiyonundadır; ayrıca MV3'ün içerik güvenliği politikası `eval`'i zaten engeller.
- **API anahtarı.** Yalnızca service worker okur; içerik betiği ve sayfa göremez. İstek başlığında (`x-goog-api-key`) gönderilir, URL'de değil. `tests/unit/secrets.test.ts` git'e girecek dosyaları anahtar kalıplarına karşı tarar; `.githooks/pre-commit` anahtar içeren commit'i engeller.
- **XSS.** Panel, LLM veya sayfa kaynaklı metni yalnızca `textContent` ile yazar; birim testi `<img onerror>` içeren LLM çıktısının çalışmadığını doğrular.
- **Sayfa paneli gizleyemez.** Panel Shadow DOM'dadır, kabın görünürlük özellikleri ise `:host` üzerinde `!important` ile kilitlidir. Kaskad kuralına göre `!important` bildirimlerde Shadow DOM içindeki kural sayfanınkini yener. Böylece `#tos-risk-panel-host { display:none !important }` gibi bir kural paneli ve hukuki uyarıyı gizleyemez (`terms-hostile-css.html`, `guards.cy.js`). Denetimden önce bu mümkündü.
- **Mesaj doğrulama.** Service worker, içerik betiğinden gelen isteği de Zod ile doğrular ve yalnızca kendi uzantısından gelen mesajları kabul eder.
- **Mimari sınırlar testle korunur.** `tests/unit/boundaries.test.ts`, içerik betiğinden ulaşılabilen her modülü import grafı üzerinden tarar. Hiçbiri API anahtarını okumaz, LLM uç noktasını bilmez veya ağ isteği atmaz. `fetch` kullanan tek dosya LLM istemcisidir.
- **Bozuk / kötü niyetli LLM çıktısına dayanıklılık.** `tests/unit/fuzz.test.ts`, tohumlu rastgele üretilmiş binlerce LLM yanıtında şunları denetler:
  - Ayrıştırıcı hiçbir girdide çökmez.
  - Rapordaki her alıntı metinde vardır.
  - Skor her zaman 0–100 arasında ve formülle aynıdır.
  - Hiçbir bulgu sessizce kaybolmaz.

  Aynı dosyadaki metamorfik testler şunların skoru değiştirmediğini doğrular: bulgu sırası, aynı bulgunun tekrarı, aynı kategoride ikinci madde, alıntının harf/boşluk biçimi, LLM'in açıklaması ve uydurma bir bulgu. Testlerin gerçekten hata yakalayıp yakalamadığı koda bilerek hata konarak denendi. Bu denemede "kategori birden çok kez sayılsın" hatasının fuzz testinden sağ çıktığı görüldü ve onu yakalayan metamorfik test eklendi.

## Bilinen sınırlamalar

- **Alıntı doğrulama, metnin sayfada var olduğunu kanıtlar; gerçek bir sözleşme maddesi olduğunu kanıtlamaz.** Saldırgan uydurma bir maddeyi sayfaya görünür biçimde yazarsa doğrulama onu kabul eder. Bu durumda tek savunma, görünür metindeki talimat benzeri ifadelerin güvenilirliği düşürmesidir (`tests/unit/fixtures.test.ts`, "BİLİNEN SINIRLAMA" testi).
- Talimat tespiti düzenli ifadelere dayanır; eş anlamlı ifadeleri veya desteklenmeyen dilleri kaçırabilir. Bu bir raporlama sinyalidir, asıl savunma değildir.
- Gizli metin tespiti, başka bir elemanın arkasına saklanmış (üstü örtülen) veya resim üstüne aynı renkte yazılmış metni yakalamaz. `aria-hidden` bilinçli olarak gizli sayılmaz, çünkü görsel olarak görünürdür. Kapalı akordeonlar gibi sayfada o an görünmeyen içerik analiz edilmez ve "gizli içerik" listesinde görünür.
- jsdom yerleşim hesaplamadığı için geometri kuralları (ekran dışı, sıfır alan, kutu dışına itilme) birim testlerinde değil, Cypress'te gerçek Chrome'da test edilir.
- Eval sonuçları prompt v1 ile üretildi. v2 yalnızca sayfa başlığının ve URL'nin konumunu değiştirir; eval v2 ile yeniden koşulmadı.
- Metin çıkarma, sayfada `<main>` bölgesi varsa (ve metnin ≥%40'ını içeriyorsa) yalnızca onu alır; menü, alt bilgi ve çerez uyarısı dışarıda kalır. `<main>` yoksa sayfanın tamamı alınır ve bu gürültü LLM'e gider. Korpus dosyasındaki `extraction` alanı hangisinin olduğunu ve kaç satır atıldığını kaydeder.
- Alıntı normalizasyonu aksanları kaldırır; çok nadir durumlarda farklı kelimeleri eşleştirebilir.

## Gelecekte yapılabilecekler

- **Prompt v2'nin eval'i:** v1 ile karşılaştırma ve "aynı kategoriden birden fazla madde varsa her birini raporla" talimatı. Kaçırmaların yarısı aynı kategorinin ikinci örneğiydi.
- **Şiddeti metindeki ifadelere bağlayan kurallar:** Örneğin "sole discretion", "without notice", "non-refundable". Skor tamamen deterministik olur, ama bunu ölçmek için daha büyük bir etiketli küme gerekir.
- **Tablo farkındalığı:** Tablo satırlarını "hücre | hücre" biçiminde koruyan metin çıkarma. Spotify'ın ülke → hukuk tablosu bu yüzden kaçtı.
- **ToS değişiklik takibi:** Aynı sayfanın önceki analiziyle karşılaştırıp yeni eklenen riskli maddeleri göstermek.
- **İkinci etiketleyici:** Etiketleyiciler arası uyumu ölçmek. Tek etiketleyicide en az 4 eksik madde bulundu.
