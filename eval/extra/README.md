# Ek korpus (etiketsiz)

Bu klasördeki metinler `npm run eval` ölçümüne **girmez** (altın etiketleri yoktur).
Diller arası tutarlılık gibi gözlemler için saklanır.

- `spotify-com-il-en-end-user-agreement_2026-10-11.json`: Spotify Kullanım Şartları, İngilizce (İsrail sürümü, `/il-en/`).
  Eval'deki Türkçe Spotify metni (`/tr-en/` adresi Türkçe döndürdü) ile birebir aynı değildir; ülkeye özgü maddeler farklıdır.
- `youtube-com-terms_2026-10-11.json`: YouTube Hizmet Şartları, İngilizce ("English Courtesy Translation", `hl=en`).
  Eval'deki Türkçe `youtube-com-static` metninin aynı belgenin çevirisidir; diller arası tutarlılık
  (aynı madde iki dilde aynı kategoriyle bulunuyor mu?) için ileride kullanılabilir.
