#!/usr/bin/env bash
# Rasteriza todos os icones a partir dos dois SVGs da marca.
#
# As fontes de verdade sao vetoriais e ficam versionadas:
#   public/brand/marca-icone.svg       -> tema claro (fundo #fefefc)
#   public/brand/marca-icone-noite.svg -> tema noite (fundo #1c1914, vinheta e halo)
#
# A distincao nao e de enquadramento, e de tema: os dois sao a mesma cena, no
# mesmo recorte e na mesma viewBox. O icone INSTALADO (PWA e apple-touch) e
# sempre o de noite, porque a tela inicial nao tem troca por esquema de cor.
# O claro serve a aba do navegador e ao logo pequeno.
#
# Requer ImageMagick com o delegate librsvg ativo. Uso: scripts/gerar-icones.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CLARO=public/brand/marca-icone.svg
NOITE=public/brand/marca-icone-noite.svg

# Os SVGs usam radialGradient e clipPath, e o renderizador interno MSVG do
# ImageMagick erra os dois. Com o icone de noite o estrago e total: sai um
# quadrado preto solido, sem nenhuma arte. Sem librsvg o PNG sai errado em
# silencio, entao o script para aqui em vez de gravar lixo.
if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "erro: rsvg-convert nao encontrado; o ImageMagick cairia no MSVG interno," >&2
  echo "      que erra o clipPath e os gradientes destes SVGs." >&2
  echo "      instale com: brew install librsvg" >&2
  exit 1
fi

# Diferente do monograma antigo, que era transparente, estes dois icones tem
# fundo opaco em sangria total -- por isso FUNDO e a cor do proprio desenho, e
# nao "none": evita franja transparente na borda ao reamostrar.
render() { magick -background "$FUNDO" -density 1200 "$1" -resize "$2x$2" -strip PNG32:"$3"; echo "  $3 (${2}px)"; }

FUNDO='#fefefc'
echo "a partir de $CLARO (tema claro):"
render "$CLARO" 64  public/favicon.png
render "$CLARO" 128 public/brand/logo.png

echo "favicon.ico (16/32/48 num arquivo so):"
magick -background "$FUNDO" -density 1200 "$CLARO" \
  \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 48x48 \) \
  -delete 0 -strip public/favicon.ico
echo "  public/favicon.ico"

FUNDO='#1c1914'
echo "a partir de $NOITE (tema noite, o icone instalado):"
render "$NOITE" 192  public/pwa-192.png
render "$NOITE" 512  public/pwa-512.png
render "$NOITE" 180  public/apple-touch-icon.png
render "$NOITE" 1024 public/brand/logo-master.png

# O maskable e o mesmo render do pwa-512, byte a byte: a arte ja tem sangria
# total e o recorte deixa a cena dentro da zona segura do circulo do sistema.
cp public/pwa-512.png public/pwa-512-maskable.png
echo "  public/pwa-512-maskable.png (copia do pwa-512.png)"
