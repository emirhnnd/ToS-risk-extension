# Hata analizi

> `eval/results.md`'deki her FN (kaçırılan) ve FP (yanlış alarm) için **neden** sorusu burada elle yanıtlanır.
> Sonuçları güzelleştirmek için hiçbir satır silinmez; altın etiket yalnızca gerçek bir etiketleme hatası varsa düzeltilir ve bu da aşağıya yazılır.

## Neden kategorileri

| Kod | Anlamı |
|---|---|
| KESİK | Metin bütçe nedeniyle kesildi, madde LLM'e hiç gitmedi |
| KATEGORİ | Yer doğru, kategori farklı (iki kategoriye de girebilecek madde) |
| SINIR | Gri alan: madde riskli sayılabilir de sayılmayabilir de |
| DİL | Dil/çeviri kaynaklı (ör. Türkçe hukuki terim) |
| ALINTI | LLM doğru maddeyi buldu ama alıntıyı bozdu, doğrulayıcı reddetti |
| KAÇIRMA | LLM maddeyi hiç görmedi |
| AŞIRI | LLM zararsız bir maddeyi riskli saydı |
| ETİKET | Benim etiketleme hatam (düzeltildi, aşağıda belirtildi) |

## Bulgular

| Metin | Tür | Kategori | Kısa alıntı | Neden | Açıklama |
|---|---|---|---|---|---|
| | | | | | |

## Etiket düzeltmeleri

(Yok)

## Genel yorum

(Eval tamamlanınca yazılacak.)
