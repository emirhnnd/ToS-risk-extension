# Hata analizi

> `eval/results.md`'deki her FN (kaçırılan) ve FP (yanlış alarm) için **neden** sorusu burada yanıtlanır.
> Kurallar: Sonuçları güzelleştirmek için hiçbir satır silinmedi. Altın etiketler sonuçlar görüldükten sonra **değiştirilmedi**.
> Bir FP aslında riskli bir maddeyse bu "olası etiket eksiği" olarak not edildi, ama sayılar olduğu gibi bırakıldı.

Model `gemini-3.8-flash`, prompt `v1`, 6 metin (3 TR + 3 EN), 45 altın madde (50 etiket; 5'i kesişme kuralıyla birleşti).

| Ölçüm | Precision | Recall | F1 |
|---|---|---|---|
| Madde düzeyi (birincil) | %82 (31/38) | %69 (31/45) | %75 |
| Belge × kategori (skorun kullandığı düzey, ikincil) | %94 (32/34) | %91 (32/35) | %93 |

Halüsinasyon göstergesi: LLM'in 39 iddiasından **0'ı** alıntı doğrulamasında reddedildi (uydurma alıntı yok). 1'i şema doğrulamasında reddedildi (aşağıda, ŞEMA).

## Neden kodları

| Kod | Anlamı |
|---|---|
| KOMŞU | LLM aynı maddenin **bitişik cümlesini** seçti; alıntı aralıkları kesişmediği için FN + FP olarak sayıldı |
| TEKRAR | Aynı kategoride metinde **ikinci/üçüncü örnek** kaçırıldı (LLM kategori başına çoğunlukla tek bulgu verdi) |
| KAÇIRMA | LLM o kategorideki maddeyi hiç görmedi |
| KATEGORİ | Yer doğru sayılabilir, kategori tanımı tartışmalı |
| SINIR | Gri alan: madde riskli sayılabilir de sayılmayabilir de |
| ŞEMA | LLM maddeyi buldu ama bulgu şema doğrulamasından geçemedi |
| TABLO | Sayfadaki tablo düz metne dönüşünce madde anlaşılmaz hâle geldi |
| BÖLME | Altın etikette tek madde iki etikete bölünmüştü; LLM'in tek alıntısı yalnızca birini karşılayabildi (bire bir eşleştirme kuralının yan etkisi) |
| ETİKET? | Olası etiket eksiği: FP aslında riskli olabilir. Altın etiket değiştirilmedi |

## Bulgular

| # | Metin | Tür | Kategori | Kısa alıntı | Neden | Açıklama |
|---|---|---|---|---|---|---|
| 1 | Amazon | FN | Sorumluluk reddi | "THE AMAZON SERVICES … PROVIDED … ON AN "AS IS" …" | KOMŞU | Aynı bölümde LLM garanti reddini değil, bir sonraki paragraftaki sorumluluk sınırlamasını seçti (#2) |
| 2 | Amazon | FP | Sorumluluk reddi | "TO THE FULL EXTENT PERMISSIBLE BY LAW, AMAZON WILL NOT BE LIABLE …" | KOMŞU, ETİKET? | #1'in eşi. Sorumluluk sınırlaması da bu kategorinin tanımına uyuyor; altın etikette yalnızca garanti reddi var |
| 3 | Getir | FN | Keyfi hesap kapatma | "Müşteri'nin … aykırı davrandığının tespiti halinde … üyeliğini askıya alma …" | TEKRAR | LLM hemen önceki cümleyi ("dilediği zaman hizmetlerini askıya alma") buldu (TP); ikinci örneği raporlamadı |
| 4 | Getir | FN | İade yok | "… iptal ve iadeyi kabul etmeyebilecek ve ücret iadesi yapmayabilecektir." | KAÇIRMA | Belgede bu kategoriden başka madde yok; kategori tamamen kaçtı. Skora etkisi var (bkz. Skor bölümü) |
| 5 | Netflix | FN | Otomatik yenileme | "Your Netflix subscription will continue until terminated …" | KOMŞU | LLM aynı bölümden "Unless you cancel … you authorize us to charge …" cümlesini seçti (#9) |
| 6 | Netflix | FN | Tek taraflı değişiklik | "We may, from time to time, change these Terms of Use." | TEKRAR | LLM fiyat değişikliği maddesini buldu (TP), sözleşme değişikliği maddesini raporlamadı |
| 7 | Netflix | FN | Sorumluluk reddi | ", to the extent permitted by applicable law, we will not be held liable …" | TEKRAR | "as is" maddesi bulundu (TP), ikinci örnek raporlanmadı |
| 8 | Netflix | FN | Kullanıcı içeriğine geniş lisans | "worldwide and in perpetuity without further compensation …" | BÖLME | Geri bildirim maddesi altın etikette iki parçaya bölünmüştü. LLM'in tek alıntısı ikisiyle de kesişiyor ama bire bir kural yalnızca birini TP sayıyor. Model hatası değil |
| 9 | Netflix | FP | Otomatik yenileme | "Unless you cancel your subscription before your billing date, you authorize us to charge …" | KOMŞU, ETİKET? | #5'in eşi. Otomatik yenilemeyi en doğrudan anlatan cümle bu olabilir |
| 10 | Spotify | FN | Sorumluluk reddi | "Spotify Hizmeti "olduğu gibi" … garanti olmaksızın sunulmaktadır." | ŞEMA | LLM bu kategoride sorumluluk sınırlaması maddesini ("Spotify, yetkilileri, hissedarları …") seçti, ama alıntı 600 karakteri aştığı için şemadan geçemedi. Kategori rapora hiç girmedi |
| 11 | Spotify | FN | Yabancı hukuk / yargı yeri | "Bulgaristan, Kıbrıs, … Türkiye İsveç Kanunları Münhasır değil;" | TABLO | Ülke → geçerli hukuk tablosu tek satır düz metne dönüştü. Türkiye'deki kullanıcı için İsveç hukuku geçerli olduğu bu satırdan okunamıyor |
| 12 | Spotify | FP | Tek taraflı değişiklik | "Spotify; düzenli abonelik ücretleri … ücretini zaman zaman değiştirebilir …" | ETİKET? | Fiyat değişikliği maddesi. Netflix'teki benzer madde altın etikette "Tek taraflı değişiklik" olarak işaretlendi, burada işaretlenmedi: etiketler arası tutarsızlık |
| 13 | Spotify | FP | Keyfi hesap kapatma | "Spotify, her türlü Kullanıcı İçeriği'ni herhangi bir nedenle ya da nedensiz şekilde kaldırma …" | KATEGORİ | İçerik kaldırma, hesap kapatma değil; kategori tanımı ("hesabı sebepsiz kapatma") bunu açıkça kapsamıyor |
| 14 | Spotify | FP | Tahkim / toplu dava feragati | "Siz ve Spotify … zorunlu bağlayıcı bireysel tahkim ile çözümleneceğini kabul edersiniz." | ETİKET?, SINIR | Bu bir tahkim maddesi, ama 6.3 "bu maddenin yürütülebilir olduğu bir yargı bölgesinde bulunmanız halinde" geçerli. Türkiye'deki kullanıcıya uygulanıp uygulanmadığı metinden belli değil |
| 15 | Steam | FN | Sorumluluk reddi | "STEAM … ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS …" | TEKRAR | Sorumluluk sınırlaması bulundu (TP), garanti reddi raporlanmadı. Amazon'daki #1 ile aynı örüntü |
| 16 | Steam | FN | İade yok | "Your cancellation of an Account … will not entitle you to any refund …" | TEKRAR | Steam Cüzdanı iade maddesi bulundu (TP), ikinci örnek raporlanmadı |
| 17 | Steam | FN | Kullanıcı içeriğine geniş lisans | "If you provide Valve with any feedback or suggestions … free to use …" | TEKRAR | Kullanıcı içeriği lisansı bulundu (TP), geri bildirim maddesi raporlanmadı |
| 18 | YouTube | FN | Tek taraflı değişiklik | "Bu Sözleşme'yi, örneğin (1) Hizmet'teki … değiştirebiliriz." | KOMŞU | LLM hemen sonraki cümleyi seçti (#21); iki alıntı arasında yalnızca 1 karakter var |
| 19 | YouTube | FN | Tek taraflı değişiklik | "özellik ve işlev ekleme veya kaldırma … değişiklikler yapabiliriz." | TEKRAR | Hizmetin kendisinde değişiklik; ikinci örnek raporlanmadı |
| 20 | YouTube | FP | Keyfi hesap kapatma | "YouTube; (a) … ihlal etmeniz; (b) … mahkeme emrine …; (c) … makul bir şekilde karar vermemiz halinde … feshetme hakkını saklı tutar." | SINIR | Fesih nedenleri sayılmış, yani "keyfi" değil; ama (c) geniş bir takdir alanı bırakıyor |
| 21 | YouTube | FP | Tek taraflı değişiklik | "Bu Sözleşme'de esaslı değişiklik yapmamız durumunda … bilgilendirir …" | KOMŞU | #18'in eşi |

### Neden dağılımı

| Neden | FN | FP | Toplam |
|---|---|---|---|
| TEKRAR | 7 | – | 7 |
| KOMŞU | 3 | 3 | 6 (FP'lerin 2'si ayrıca ETİKET?) |
| KAÇIRMA | 1 | – | 1 |
| ŞEMA | 1 | – | 1 |
| TABLO | 1 | – | 1 |
| BÖLME | 1 | – | 1 |
| KATEGORİ | – | 1 | 1 |
| SINIR | – | 1 | 1 |
| ETİKET? (birincil) | – | 2 | 2 |
| **Toplam** | **14** | **7** | **21** |

KOMŞU satırları FN + FP çiftleri oluşturuyor: 3 KOMŞU çifti (Amazon, Netflix, YouTube) tek başına 6 hata demek. Amazon #1 KOMŞU'dur ama eşi (#2) aynı zamanda ETİKET? olarak işaretlendi; Netflix #9 da öyle. Tabloda her satır yalnızca birincil nedeniyle bir kez sayıldı.

## Ana örüntüler

**1. Kaçırmaların yarısı, aynı kategoride ikinci örnek (TEKRAR, 7/14 FN).** LLM her kategoriden çoğunlukla tek bir madde döndürüyor: 38 doğrulanmış bulgu 34 belge-kategoriye dağılmış, altın etikette ise 45 madde 35 belge-kategoride. Prompt "her örneği ayrı raporla" demiyor. Bu kaçırmalar **skoru etkilemez**, çünkü skor her kategoriyi bir kez sayar. Belge × kategori düzeyinde recall %91. Kullanıcı için anlamı şu: panel, sözleşmede o türden *bir* riskin varlığını doğru gösteriyor ama aynı türün bütün maddelerini listelemiyor.

**2. Komşu cümle seçimi (KOMŞU, 3 çift).** Amazon, Netflix ve YouTube'da LLM doğru paragrafı buldu ama farklı cümleyi alıntıladı. Eşleştirme kuralı "alıntılar metinde kesişmeli" dediği için bunlar FN + FP sayıldı. Kural sonuçlardan önce yazıldığı için değiştirilmedi. "Aynı paragraf" düzeyinde eşleştirme seçilseydi bu 6 hata TP'ye dönerdi, ama bu kural sonuç görüldükten sonra seçilmiş olurdu.

**3. Şiddet sistematik olarak düşük tahmin ediliyor.** Eşleşen 31 maddenin 15'inde LLM'in verdiği şiddet benimkinden düşük, 14'ünde aynı, 2'sinde yüksek. Skor kodla hesaplanıyor, ama şiddet çarpanı LLM'den geliyor. Bu yüzden sistem skoru 6 metnin 5'inde, aynı formülün altın etiketlerle verdiği skordan düşük kaldı:

| Metin | Sistem | Altın etiketlerle | Fark |
|---|---|---|---|
| Getir | 18 (düşük) | 35 (orta) | −17: **seviye değişiyor**. ≈7,5 puanı "İade yok" kategorisinin tamamen kaçmasından (#4), ≈9,5 puanı 3 kategoride "yüksek" yerine "orta" verilmesinden |
| Amazon | 46 | 54 | −8 |
| Spotify | 45 | 53 | −8: iki kategori kayıp (Sorumluluk reddi: ŞEMA #10, Yabancı hukuk: TABLO #11); yanlış alarm #13 (+6) farkı kısmen kapatıyor |
| Netflix | 40 | 45 | −5 |
| YouTube | 27 | 30 | −3 |
| Steam | 47 | 46 | +1 |

Bu, README'deki "skoru LLM değil formül hesaplar" iddiasının sınırını gösteriyor. Formül deterministik, ama girdilerinden biri (şiddet) hâlâ LLM'in yargısı. İyileştirme seçenekleri "Sonraki adımlar"da.

**4. Prompt injection savunmasının gerçek metinde yan etkisi (düzeltildi).** İlk koşuda Amazon ve Netflix "belirsizlik: yüksek" çıktı. Sebep, görünür talimat sezgisinin modern sözleşmelerdeki yapay zekâ maddelerine takılmasıydı: "use AI-generated content", "such as a model, model parameters", "machine learning tool, model, system". Desen yalnızca "AI:" / "asistan:" biçimindeki hitabı yakalayacak şekilde daraltıldı. Gerçek metinlerde yanlış alarm 3 segmentten 0'a indi; saldırı test sayfasındaki talimatların hepsi hâlâ yakalanıyor. Bu cümleler regresyon testi olarak eklendi (`tests/unit/sanitizer.test.ts`). P/R sayıları bundan etkilenmedi.

**5. Tek hatalı bulgu tüm analizi düşürüyordu (düzeltildi).** İlk koşuda Spotify analizi tamamen başarısız oldu: LLM tek bir maddede 600 karakteri aşan alıntı verdi ve şema tüm çıktıyı reddetti. Doğrulama iki katmana ayrıldı. Dış yapı hâlâ katı: bilinmeyen bir alan, örneğin LLM'in eklediği bir `risk_score`, varsa her şey reddediliyor. Bulgular ise tek tek doğrulanıyor. Yeni koşuda o tek bulgu "reddedilen iddia" oldu, diğer 8 bulgu rapora girdi ve panel belirsizliği "yüksek" gösterdi. Sonuç: Spotify'da Sorumluluk reddi kategorisi yine kayıp (#10), ama analizin kalanı kurtuldu.

**6. LLM'in kendi belirsizlik notları güvenilmez; sistem bunlara güvenmediği için doğru davranıyor.** Getir için LLM "son güncelleme tarihi (06/04/2026) ileri bir tarihi göstermektedir" notunu yazdı. Bu yanlış: tarih analizden önceye ait (model bugünün tarihini bilmiyor). Tasarım gereği LLM notları belirsizliği tek başına "yüksek" yapmıyor (`llm_reported_uncertainty` yumuşak neden). Bu örnek o kararın doğru olduğunu gösteriyor. YouTube için yazdığı not ise ("yerel tüketici kanunlarının elverdiği ölçüde yerel mahkemeler istisnası") doğru ve faydalı.

**7. Tablo yapısı kayboluyor (TABLO).** Spotify'ın ülke → hukuk tablosu düz metne dönüşünce "Türkiye: İsveç kanunları" bilgisi okunamaz hâle geldi. page-agent'ın metin çıkarma katmanı tablo hücrelerini satır içinde birleştiriyor.

## Etiket düzeltmeleri

Sonuçlar görüldükten sonra hiçbir altın etiket değiştirilmedi.

Sonuçlardan **önce** yapılanlar:
- Getir: "İstanbul Merkez (Çağlayan) Mahkemeleri …" etiketi "Yabancı hukuk" kategorisindeydi. Etiketleme kuralı "Türkiye mahkemesi yabancı sayılmaz" dediği için etiketleyicinin kararıyla silindi.
- Spotify'da 3, Steam'de 2 etiket aynı paragrafın tekrarıydı (etiketleme aracında yanlışlıkla tekrar ekleme). Dosyalar değiştirilmedi; eşleştirmeye "aynı kategoride kesişen altın etiketler tek madde" kuralı eklendi.

ETİKET? olarak işaretlenen 4 FP (#2, #9, #12, #14) altın etikette yer alsaydı precision %82 → %92 olurdu (35/38). Bu sayı **resmî sonuç değildir**, yalnızca etiket belirsizliğinin büyüklüğünü göstermek için verildi.

## Sonraki adımlar (yapılmadı)

- **Prompt v2:** "Aynı kategoriden birden fazla madde varsa her birini ayrı raporla" talimatı. TEKRAR hatalarını hedefler; prompt sürümü değiştiği için önbellek otomatik geçersiz olur ve v1 ile karşılaştırılabilir.
- **Şiddeti LLM'den almamak:** Kategori başına sabit şiddet ya da şiddeti metindeki ifadelere ("sole discretion", "without notice", "non-refundable") bağlayan kurallar. Skor tamamen deterministik olur. Bedeli bağlama duyarlılığın azalması.
- **Tablo farkındalığı:** `<table>` satırlarını "hücre | hücre" biçiminde koruyan metin çıkarma.
- **Paragraf düzeyinde eşleştirme:** KOMŞU hatalarını azaltır. Sonuçlar görüldüğü için bu çalışmada uygulanmadı; bir sonraki eval için önceden yazılmalı.
- **Etiketleyiciler arası tutarlılık:** Tek etiketleyici var. #12'deki gibi tutarsızlıklar ikinci bir etiketleyiciyle ölçülebilir.
