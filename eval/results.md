# Eval sonuçları

> Otomatik üretildi: `npm run eval` · model `gemini-3.8-flash` · 2026-10-12 19:53 UTC
> Altın etiketler elle, LLM kullanılmadan hazırlandı (`eval/gold/`). Eşleştirme kuralı: `eval/lib/match.ts`.

## Özet

| Metrik | Değer |
|---|---|
| Metin sayısı | 6 |
| TP / FP / FN | 31 / 7 / 14 |
| Precision | %82 |
| Recall | %69 |
| F1 | %75 |
| Reddedilen alıntı oranı (halüsinasyon göstergesi) | %3 (1/39) |
| Birleştirilen kesişen altın etiket (aynı kategori) | 5 |
| TP'lerde şiddet uyumu (LLM = elle etiket) | %45 (14/31) |

## Metin bazında

| Metin | Dil | Bölüm | Kapsam | TP | FP | FN | Precision | Recall | Reddedilen | Skor | Belirsizlik |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [amazon-com-display_2026-10-11](https://www.amazon.com/gp/help/customer/display.html?nodeId=GLSBYFE9MGKKQXXM) | en | 71 | %100 | 6 | 1 | 1 | %86 | %86 | 0 | 46 | düşük |
| [getir-com-kullanim-kosullari_2026-10-11](https://getir.com/yardim/kullanim-kosullari/) | tr | 83 | %100 | 4 | 0 | 2 | %100 | %67 | 0 | 18 | düşük (llm_reported_uncertainty) |
| [help-netflix-com-termsofuse_2026-10-11](https://help.netflix.com/legal/termsofuse?locale=en) | en | 45 | %100 | 6 | 1 | 4 | %86 | %60 | 0 | 40 | düşük |
| [spotify-com-end-user-agreement_2026-10-11](https://www.spotify.com/tr-en/legal/end-user-agreement/) | tr | 96 | %100 | 5 | 3 | 2 | %63 | %71 | 1 | 45 | yüksek (rejected_claims) |
| [store-steampowered-com-subscriber-agreement_2026-10-11](https://store.steampowered.com/subscriber_agreement/) | en | 109 | %100 | 7 | 0 | 3 | %100 | %70 | 0 | 47 | düşük |
| [youtube-com-static_2026-10-11](https://www.youtube.com/static?gl=TR&template=terms) | tr | 76 | %100 | 3 | 2 | 2 | %60 | %60 | 0 | 27 | düşük (llm_reported_uncertainty) |

## Skorun kullandığı düzey: belge × kategori (ikincil ölçüm)

> Risk skoru her kategoriyi belge başına bir kez sayar. Bu tablo "belgede bu risk türü var mı?" sorusunda sistemin başarısını gösterir.
> Bu ölçüm sonuçlar görüldükten **sonra** eklendi; birincil ölçüm yukarıdaki madde düzeyidir.

| Metrik | Değer |
|---|---|
| Belge×kategori TP / FP / FN | 32 / 2 / 3 |
| Precision / Recall / F1 | %94 / %91 / %93 |
| TP'lerde LLM şiddeti: daha düşük / aynı / daha yüksek | 15 / 14 / 2 |

| Metin | Sistem skoru | Altın etiketlerle aynı formül | Fark |
|---|---|---|---|
| amazon-com-display_2026-10-11 | 46 | 54 | -8 |
| getir-com-kullanim-kosullari_2026-10-11 | 18 | 35 | -17 |
| help-netflix-com-termsofuse_2026-10-11 | 40 | 45 | -5 |
| spotify-com-end-user-agreement_2026-10-11 | 45 | 53 | -8 |
| store-steampowered-com-subscriber-agreement_2026-10-11 | 47 | 46 | +1 |
| youtube-com-static_2026-10-11 | 27 | 30 | -3 |

## Kategori bazında

| Kategori | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|
| Otomatik yenileme | 2 | 1 | 1 | %67 | %67 |
| İade yok | 3 | 0 | 2 | %100 | %60 |
| Tek taraflı değişiklik | 5 | 2 | 3 | %71 | %63 |
| Kullanıcı içeriğine geniş lisans | 5 | 0 | 2 | %100 | %71 |
| Keyfi hesap kapatma | 3 | 2 | 1 | %60 | %75 |
| Sorumluluk reddi | 5 | 1 | 4 | %83 | %56 |
| Tahkim / toplu dava feragati | 4 | 1 | 0 | %80 | %100 |
| Yetkili mahkeme / yabancı hukuk | 4 | 0 | 1 | %100 | %80 |

## Hata listesi

Her satırın **nedeni** `eval/error-analysis.md` dosyasında elle yorumlanır.

### amazon-com-display_2026-10-11

| Tür | Kategori | Alıntı | Not |
|---|---|---|---|
| FN (kaçırıldı) | Sorumluluk reddi | “THE AMAZON SERVICES AND ALL INFORMATION, CONTENT, MATERIALS, PRODUCTS (INCLUDING SOFTWARE) AND OTHER SERVICES …” |  |
| FP (yanlış alarm) | Sorumluluk reddi | “TO THE FULL EXTENT PERMISSIBLE BY LAW, AMAZON WILL NOT BE LIABLE FOR ANY DAMAGES OF ANY KIND ARISING FROM THE …” |  |

### getir-com-kullanim-kosullari_2026-10-11

| Tür | Kategori | Alıntı | Not |
|---|---|---|---|
| FN (kaçırıldı) | Keyfi hesap kapatma | “Müşteri’nin işbu belirtilen Koşullar’a, amaca, ilgili mevzuata veya iyi niyet/ahlak kurallarına aykırı davrand…” | Sebep olmadan tüketicinin alehine karar verme |
| FN (kaçırıldı) | İade yok | “Bu kapsamda, Getir veya Üye İşyeri ilgili siparişin tamamına veya bir kısmına ilişkin iptal ve iadeyi kabul et…” |  |

### help-netflix-com-termsofuse_2026-10-11

| Tür | Kategori | Alıntı | Not |
|---|---|---|---|
| FN (kaçırıldı) | Otomatik yenileme | “Your Netflix subscription will continue until terminated. To purchase a subscription, you will need to add one…” |  |
| FN (kaçırıldı) | Tek taraflı değişiklik | “We may, from time to time, change these Terms of Use.” |  |
| FN (kaçırıldı) | Sorumluluk reddi | “, to the extent permitted by applicable law, we will not be held liable should such events occur.” |  |
| FN (kaçırıldı) | Kullanıcı içeriğine geniş lisans | “worldwide and in perpetuity without further compensation, acknowledgement or payment to you for any purpose wh…” |  |
| FP (yanlış alarm) | Otomatik yenileme | “Unless you cancel your subscription before your billing date, you authorize us to charge the subscription fee …” |  |

### spotify-com-end-user-agreement_2026-10-11

| Tür | Kategori | Alıntı | Not |
|---|---|---|---|
| FN (kaçırıldı) | Sorumluluk reddi | “Spotify Hizmeti "olduğu gibi" ve "kullanılabilir olduğu şekliyle", hiçbir türde açık, zımni veya yasal garanti…” |  |
| FN (kaçırıldı) | Yetkili mahkeme / yabancı hukuk | “Bulgaristan, Kıbrıs, Estonya, Fransa, Hong Kong, Letonya, Litvanya, Lüksemburg, Malta, Monako, Norveç, Filipin…” |  |
| FP (yanlış alarm) | Tek taraflı değişiklik | “Spotify; düzenli abonelik ücretleri, Ön Ödeme Dönemi (henüz ödemesi yapılmamış dönemler için) ya da Kodlar (yu…” |  |
| FP (yanlış alarm) | Keyfi hesap kapatma | “Spotify, her türlü Kullanıcı İçeriği'ni herhangi bir nedenle ya da nedensiz şekilde kaldırma ya da buna erişim…” |  |
| FP (yanlış alarm) | Tahkim / toplu dava feragati | “Siz ve Spotify, bu Sözleşmeler ile veya Hizmet'in bir kullanıcısı olarak Spotify ile aranızdaki ilişkiyle herh…” |  |

### store-steampowered-com-subscriber-agreement_2026-10-11

| Tür | Kategori | Alıntı | Not |
|---|---|---|---|
| FN (kaçırıldı) | Sorumluluk reddi | “STEAM, THE CONTENT AND SERVICES, THE SUBSCRIPTIONS, AND ANY INFORMATION AVAILABLE IN CONNECTION THEREWITH ARE …” |  |
| FN (kaçırıldı) | İade yok | “Your cancellation of an Account, or your cessation of use of any Subscription or request that access to a Subs…” |  |
| FN (kaçırıldı) | Kullanıcı içeriğine geniş lisans | “If you provide Valve with any feedback or suggestions about Steam, the Content and Services, or any Valve prod…” |  |

### youtube-com-static_2026-10-11

| Tür | Kategori | Alıntı | Not |
|---|---|---|---|
| FN (kaçırıldı) | Tek taraflı değişiklik | “Bu Sözleşme'yi, örneğin (1) Hizmet'teki veya çalışma şeklimizdeki değişiklikleri (yeni ürünler veya özellikler…” |  |
| FN (kaçırıldı) | Tek taraflı değişiklik | “özellik ve işlev ekleme veya kaldırma, yeni dijital içerikler veya hizmetler sunma ya da eskilerini kullanımda…” |  |
| FP (yanlış alarm) | Keyfi hesap kapatma | “YouTube; (a) bu Sözleşme'yi esaslı şekilde veya üst üste ihlal etmeniz; (b) bir yasal şart ya da bir mahkeme e…” |  |
| FP (yanlış alarm) | Tek taraflı değişiklik | “Bu Sözleşme'de esaslı değişiklik yapmamız durumunda, (1) yeni bir ürün veya özelliği kullanıma sunmamız ya da …” |  |

## Reddedilen LLM iddiaları

| Metin | Neden | Alıntı |
|---|---|---|
| spotify-com-end-user-agreement_2026-10-11 | schema_invalid | “Spotify, yetkilileri, hissedarları, çalışanları, temsilcileri, yöneticileri, bağlı ortaklıkları, iştirakleri, …” |
