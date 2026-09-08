#!/bin/zsh
# Sobe as camas da trilha para o R2, e confere contra a API o que subiu.
#
# São 22 arquivos, não 2.646 — mas a lição do publicar-narracao.sh vale igual:
# um marcador local registra o que ESTE script fez, não o que o R2 tem. Só a
# API sabe. O `wrangler` não lista objetos, então a conferência é por HEAD,
# comparando content-length com o arquivo local.
#
# O PREFIXO tem que ser o mesmo que está em public/data/trilha.json, no campo
# `prefixo` — é dali que o app monta a URL. Este script confere isso antes de
# subir qualquer coisa, porque prefixo divergente é 404 em toda a trilha e
# nenhum erro em lugar nenhum.
#
# Regerar a paleta cria trilha-v2/ e NÃO regrava trilha-v1/: /api/audio/* é
# servido `immutable` com um ano de cache, então sobrescrever a mesma chave
# nunca chegaria em quem já ouviu.
#
# Uso: scripts/publicar-trilha.sh [origem]

set -u

REPO="${0:A:h:h}"
ORIGEM="${1:-/Volumes/SSD 2TB SD/dev/trilha-corpus/trilha-v1}"
BUCKET="biblia-pericopes-audio"
API="${API_BASE:-https://biblia-pericopes.jairofilho79.workers.dev}"
MAPA="$REPO/public/data/trilha.json"

PREFIXO=$(sed -n 's/.*"prefixo":"\([^"]*\)".*/\1/p' "$MAPA")
[[ -n "$PREFIXO" ]] || { echo "não achei o prefixo em $MAPA"; exit 1 }
echo "prefixo: $PREFIXO   origem: $ORIGEM"

# Toda cama citada no mapa tem que existir no disco, antes de subir a primeira.
faltando=0
for c in $(sed -n 's/.*"camas":{//p' "$MAPA" | grep -o '"[a-z0-9-]*":\[' | tr -d '":['); do
  [[ -f "$ORIGEM/$c.m4a" ]] || { echo "FALTA $c.m4a"; ((faltando++)) }
done
(( faltando == 0 )) || { echo "$faltando cama(s) do mapa sem arquivo — nada foi enviado"; exit 1 }

# if/else e não `&& ((subiu++)) ||`: em zsh o pós-incremento devolve o valor
# ANTIGO, então o primeiro sucesso (subiu 0->1) devolve 0, que é falso, e cai no
# ramo de erro. O primeiro arquivo era sempre reportado como FALHA tendo subido.
subiu=0; falhou=0
for f in "$ORIGEM"/*.m4a; do
  nome="${f:t}"
  if (cd "$REPO" && "$REPO/node_modules/.bin/wrangler" r2 object put "$BUCKET/$PREFIXO/$nome" \
        --file="$f" --content-type=audio/mp4 --remote > /dev/null 2>&1); then
    subiu=$((subiu + 1))
  else
    echo "FALHA $nome"; falhou=$((falhou + 1))
  fi
done
echo "enviadas: $subiu   falhas: $falhou"

# Esta conferência passa pelo Worker EM PRODUÇÃO. Ela só fecha depois de um
# deploy que leve o chaveAudio alargado (o que aceita nome de registro, e não
# só ordem numérica). Antes disso ela acusa "ausente" nas 22 mesmo com tudo no
# bucket — nesse caso confira direto:
#   node_modules/.bin/wrangler r2 object get \
#     biblia-pericopes-audio/trilha-v1/<cama>.m4a --remote --pipe | wc -c
echo "conferindo contra a API…"
ruim=0
for f in "$ORIGEM"/*.m4a; do
  nome="${f:t}"
  local_bytes=$(stat -f%z "$f")
  remoto=$(curl -sI "$API/api/audio/$PREFIXO/$nome" | tr -d '\r' \
           | sed -n 's/^[Cc]ontent-[Ll]ength: //p')
  if [[ "$remoto" != "$local_bytes" ]]; then
    echo "DIVERGE $nome  local=$local_bytes  remoto=${remoto:-ausente}"; ((ruim++))
  fi
done
(( ruim == 0 )) && echo "OK — as $subiu camas conferem com o R2" || echo "$ruim divergência(s)"
