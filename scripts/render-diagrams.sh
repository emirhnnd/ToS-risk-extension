#!/usr/bin/env sh
# README'deki Mermaid diyagramlarını docs/*.png olarak yeniden üretir (GitHub'ın Mermaid
# görüntüleyicisi her tarayıcıda yüklenmediği için README resimleri gösterir).
# Gerekli: npx @mermaid-js/mermaid-cli (ilk çalıştırmada indirilir)
set -e
node -e "
const s=require('fs').readFileSync('README.md','utf8');
const b=[...s.matchAll(/\`\`\`mermaid\n([\s\S]*?)\`\`\`/g)].map(m=>m[1]);
require('fs').writeFileSync('docs/mimari.mmd',b[0]); require('fs').writeFileSync('docs/veri-akisi.mmd',b[1]);"
npx -y @mermaid-js/mermaid-cli -i docs/mimari.mmd -o docs/mimari.png -b white -s 2
npx -y @mermaid-js/mermaid-cli -i docs/veri-akisi.mmd -o docs/veri-akisi.png -b white -s 2
rm docs/*.mmd
