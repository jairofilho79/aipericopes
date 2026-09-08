#!/bin/zsh
# Sobe a narração normalizada para o R2, e confere contra a API o que subiu.
#
# O prefixo TEM que ser o mesmo da constante VOZ em src/lib/manifesto.ts. Este
# script e aquela constante são os dois únicos lugares que sabem o nome.
#
# POR QUE A CONFERÊNCIA NO FIM: a versão anterior deste fluxo usava só um
# marcador `.subiu` por diretório, e o marcador MENTIU — dizia 309 enviadas
# quando o R2 tinha 2646, porque o corpus local havia sido podado depois. Um
# marcador registra o que este script fez, não o que o R2 tem. Só a API sabe.
# O `wrangler` não lista objetos, então a conferência é por HEAD, comparando
# content-length com o arquivo local.
#
# Uso: scripts/publicar-narracao.sh [origem] [esteira.txt]

set -u

REPO="${0:A:h:h}"
CORPUS="${TTS_CORPUS:-/Volumes/SSD 2TB SD/dev/tts-corpus}"
ORIGEM="${1:-$CORPUS/gam-ash2}"
LISTA="${2:-$ORIGEM/ordens.txt}"

# `gam-ash2` = VOZ em src/lib/manifesto.ts, e tem de continuar batendo com ela.
# O `1` era a era NAA e o acervo dele SEGUE NO BUCKET: publicar aqui com
# prefixo `gam-ash1` misturaria a narração da Bíblia Livre com a da NAA nas
# MESMAS chaves por `ordem`, e não haveria como separar depois.
PREFIXO="${3:-gam-ash2}"
BUCKET="biblia-pericopes-audio"
API="${API_BASE:-https://biblia-pericopes.jairofilho79.workers.dev}"

poe() {  # poe <chave> <arquivo> <content-type>
  (cd "$REPO" && "$REPO/node_modules/.bin/wrangler" r2 object put "$BUCKET/$1" \
      --file="$2" --content-type="$3" --remote > /dev/null 2>&1)
}

subiu=0; falhou=0
while read -r ordem; do
  [[ -n "$ordem" ]] || continue
  d=$(printf "%s/%04d" "$ORIGEM" "$ordem")
  [[ -f "$d/pericope.m4a" && -f "$d/manifest.json" ]] || { echo "INCOMPLETA $ordem"; ((falhou++)); continue }

  if [[ ! -f "$d/.subiu" ]]; then
    poe "$PREFIXO/$ordem.m4a" "$d/pericope.m4a" audio/mp4 \
      && touch "$d/.subiu" || { echo "FALHA m4a $ordem"; ((falhou++)); continue }
  fi
  if [[ ! -f "$d/.subiu_json" ]]; then
    poe "$PREFIXO/$ordem.json" "$d/manifest.json" application/json \
      && touch "$d/.subiu_json" || { echo "FALHA json $ordem"; ((falhou++)); continue }
  fi
  ((subiu++))
done < "$LISTA"

echo "enviadas nesta passada: $subiu   falhas: $falhou"
echo "AGORA CONFIRA com: scripts/conferir-narracao.sh"
