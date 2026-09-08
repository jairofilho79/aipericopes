#!/bin/zsh
# Confere contra a API o que REALMENTE está publicado, comparando o
# content-length de cada objeto com o arquivo local correspondente.
#
# Existe porque marcador local mente: o fluxo anterior tinha `.subiu` dizendo
# 309 enviadas enquanto o R2 servia 2646, e ninguém percebeu até alguém sondar
# a API. O `wrangler` não lista objetos do R2 — HEAD na API é o único
# inventário confiável.
#
# Uso: scripts/conferir-narracao.sh [origem] [prefixo] [esteira.txt]

set -u

CORPUS="${TTS_CORPUS:-/Volumes/SSD 2TB SD/dev/tts-corpus}"
# O padrão é `gam-ash2`, a era da Bíblia Livre. NÃO devolva para `gam-ash1`:
# aquele é o acervo da NAA, que continua no bucket e é obra derivada de uma
# tradução protegida. Rodar este script contra ele reintroduz o problema que
# a troca de VOZ em src/lib/manifesto.ts fechou. Para conferir o acervo antigo
# de propósito, passe o prefixo como argumento — explícito, nunca por padrão.
ORIGEM="${1:-$CORPUS/gam-ash2}"
PREFIXO="${2:-gam-ash2}"
LISTA_ARG="${3:-}"
API="${API_BASE:-https://biblia-pericopes.jairofilho79.workers.dev}"
# Terceiro argumento permite conferir em esteiras paralelas: 5292 HEADs
# em série levam ~20 min.
LISTA="${LISTA_ARG:-$ORIGEM/ordens.txt}"

tam_remoto() {  # tam_remoto <chave>
  curl -sI --max-time 30 "$API/api/audio/$1" | tr -d '\r' \
    | awk -F': ' 'tolower($1)=="content-length"{print $2}'
}

ok=0; ausente=0; divergente=0
DIVERG="$ORIGEM/divergencias$(basename ${LISTA_ARG:-}).txt"
: > "$DIVERG"
while read -r ordem; do
  [[ -n "$ordem" ]] || continue
  d=$(printf "%s/%04d" "$ORIGEM" "$ordem")
  for par in "m4a:pericope.m4a" "json:manifest.json"; do
    ext="${par%%:*}"; arq="${par#*:}"
    local_b=$(stat -f%z "$d/$arq" 2>/dev/null || echo 0)
    remoto_b=$(tam_remoto "$PREFIXO/$ordem.$ext")
    if [[ -z "$remoto_b" ]]; then
      echo "AUSENTE   $PREFIXO/$ordem.$ext" >> "$DIVERG"; ((ausente++))
    elif [[ "$remoto_b" != "$local_b" ]]; then
      echo "DIVERGE   $PREFIXO/$ordem.$ext  local=$local_b remoto=$remoto_b" >> "$DIVERG"
      ((divergente++))
    else
      ((ok++))
    fi
  done
done < "$LISTA"

echo "objetos conferidos e idênticos: $ok"
echo "ausentes no R2:                 $ausente"
echo "com tamanho divergente:         $divergente"
[[ $ausente -eq 0 && $divergente -eq 0 ]] \
  && echo "PUBLICAÇÃO ÍNTEGRA" \
  || { echo "PROBLEMAS em $ORIGEM/divergencias.txt"; exit 1 }
