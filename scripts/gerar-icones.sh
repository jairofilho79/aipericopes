#!/usr/bin/env bash
# Rasteriza todos os icones a partir dos dois SVGs da marca.
#
# As fontes de verdade sao vetoriais e ficam versionadas:
#   public/favicon.svg           -> cartao de cantos arredondados (navegador, PWA "any")
#   public/brand/marca-plena.svg -> sangria total, marca na zona segura
#
# A distincao importa: o icone "maskable" e o apple-touch sao RECORTADOS pelo
# sistema (circulo, squircle, gota), entao precisam de fundo ate a borda e da
# marca menor. Um cartao arredondado nesses lugares vira canto cortado.
#
# Requer ImageMagick. Uso: scripts/gerar-icones.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CARTAO=public/favicon.svg
PLENA=public/brand/marca-plena.svg

render() { magick -background none -density 1200 "$1" -resize "$2x$2" -strip PNG32:"$3"; echo "  $3 (${2}px)"; }

echo "a partir de $CARTAO:"
render "$CARTAO" 64   public/favicon.png
render "$CARTAO" 192  public/pwa-192.png
render "$CARTAO" 512  public/pwa-512.png
render "$CARTAO" 128  public/brand/logo.png

echo "a partir de $PLENA (sangria total, para quem recorta):"
render "$PLENA" 180  public/apple-touch-icon.png
render "$PLENA" 512  public/pwa-512-maskable.png
render "$PLENA" 1024 public/brand/logo-master.png

echo "favicon.ico (16/32/48 num arquivo so):"
magick -background none -density 1200 "$CARTAO" \
  \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 48x48 \) \
  -delete 0 -strip public/favicon.ico
echo "  public/favicon.ico"
