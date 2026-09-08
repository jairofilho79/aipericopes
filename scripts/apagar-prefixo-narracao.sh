#!/bin/zsh
# Apaga do R2 um prefixo de narração aposentado.
#
# DESTRUTIVO E IRREVERSÍVEL do lado do R2 — só rode quando o prefixo novo já
# estiver publicado, conferido e no ar há tempo suficiente. Recuperar significa
# reprocessar dos masters em tts-corpus/ e subir tudo de novo.
#
# Duas travas, porque o erro aqui não tem desfazer:
#   1. recusa apagar o prefixo que a constante VOZ aponta;
#   2. exige um arquivo com as chaves a apagar, gerado do inventário REAL do
#      bucket — nunca de palpite. O wrangler não lista objetos; o inventário
#      sai de um worker descartável chamando `env.AUDIO.list()`. Ver
#      docs/narracao-volume.md.
#
# Uso: scripts/apagar-prefixo-narracao.sh <prefixo> <chaves.txt> [--confirmo]

set -u

REPO="${0:A:h:h}"
PREFIXO="${1:?prefixo a apagar}"
CHAVES="${2:?arquivo com as chaves, uma por linha}"
CONFIRMA="${3:-}"
BUCKET="biblia-pericopes-audio"

EM_USO=$(grep -oE "export const VOZ = '[^']+'" "$REPO/src/lib/manifesto.ts" | sed "s/.*'\(.*\)'/\1/")
if [[ "$PREFIXO" == "$EM_USO" ]]; then
  echo "RECUSADO: '$PREFIXO' é o prefixo em uso (VOZ em src/lib/manifesto.ts)." >&2
  exit 1
fi

total=$(grep -c . "$CHAVES")
echo "prefixo em uso pelo app: $EM_USO"
echo "a apagar:                $PREFIXO  ($total chaves)"
if [[ "$CONFIRMA" != "--confirmo" ]]; then
  echo
  echo "Nada foi apagado. Repita com --confirmo para executar."
  exit 0
fi

apagados=0; falhas=0
while read -r chave; do
  [[ -n "$chave" ]] || continue
  [[ "$chave" == "$PREFIXO/"* ]] || { echo "IGNORADA (fora do prefixo): $chave"; continue }
  if (cd "$REPO" && "$REPO/node_modules/.bin/wrangler" r2 object delete "$BUCKET/$chave" --remote > /dev/null 2>&1); then
    ((apagados++))
  else
    echo "FALHA ao apagar $chave"; ((falhas++))
  fi
done < "$CHAVES"

echo "apagados: $apagados   falhas: $falhas"
echo "Confira que sumiu mesmo: o inventário real, não o contador acima."
[[ $falhas -eq 0 ]]
