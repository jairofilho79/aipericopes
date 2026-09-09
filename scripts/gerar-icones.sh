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
# Uso: scripts/gerar-icones.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CLARO=public/brand/marca-icone.svg
NOITE=public/brand/marca-icone-noite.svg

# Quem rasteriza e o rsvg-convert, nao o ImageMagick. Duas razoes: o
# renderizador interno MSVG erra o clipPath e os radialGradient destes SVGs (o
# de noite sai um quadrado preto solido, e o claro sai com o wordmark que o
# recorte deveria ter tirado); e o rsvg desenha direto no tamanho pedido, sem
# a etapa de superamostragem que o `-density` do magick forcava -- 12800px de
# lado para gerar um favicon de 64, o que levava minutos por arquivo.
# O ImageMagick fica so com o .ico, que e um contêiner de varios PNG.
if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "erro: rsvg-convert nao encontrado. instale com: brew install librsvg" >&2
  exit 1
fi

# Os dois icones tem fundo opaco em sangria total, diferente do monograma
# antigo, que era transparente: nao ha alfa a preservar nem franja a evitar.
render() { rsvg-convert -w "$2" -h "$2" -o "$3" "$1"; echo "  $3 (${2}px)"; }

echo "a partir de $CLARO (tema claro):"
render "$CLARO" 64  public/favicon.png
render "$CLARO" 128 public/brand/logo.png

echo "favicon.ico (16/32/48 num arquivo so):"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for n in 16 32 48; do rsvg-convert -w $n -h $n -o "$TMP/$n.png" "$CLARO"; done
magick "$TMP/16.png" "$TMP/32.png" "$TMP/48.png" -strip public/favicon.ico
echo "  public/favicon.ico"

echo "a partir de $NOITE (tema noite, o icone instalado):"
render "$NOITE" 192  public/pwa-192.png
render "$NOITE" 512  public/pwa-512.png
render "$NOITE" 180  public/apple-touch-icon.png
render "$NOITE" 1024 public/brand/logo-master.png

# O maskable e o mesmo render do pwa-512, byte a byte: a arte ja tem sangria
# total e o recorte deixa a cena dentro da zona segura do circulo do sistema.
cp public/pwa-512.png public/pwa-512-maskable.png
echo "  public/pwa-512-maskable.png (copia do pwa-512.png)"
