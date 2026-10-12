#!/usr/bin/env sh
# docs/*.mmd (Mermaid kaynakları) → docs/*.png. README resimleri gösterir.
# Diyagramı değiştirmek için .mmd dosyasını düzenleyip bu betiği çalıştırın.
set -e
for f in docs/*.mmd; do
  npx -y @mermaid-js/mermaid-cli -i "$f" -o "${f%.mmd}.png" -b white -s 2
done
