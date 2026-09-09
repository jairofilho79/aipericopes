#!/bin/zsh
# Confere contra a API o que REALMENTE está publicado, comparando o
# content-length de cada objeto com o arquivo local correspondente.
#
# Existe porque marcador local mente: o fluxo anterior tinha `.subiu` dizendo
# 309 enviadas enquanto o R2 servia 2646, e ninguém percebeu até alguém sondar
# a API. O `wrangler` não lista objetos do R2 — HEAD na API é o único
# inventário confiável.
#
# Numa passada completa, grava também data/audio-cobertura.json — a
# lista das `ordem` cuja narração está confirmada no R2. Ver gravar_cobertura()
# abaixo para o formato; ele exige a MESMA rede e o MESMO corpus local que a
# conferência, porque é subproduto dela, não um passo separado que alguém
# esquece de rodar depois de publicar um lote.
#
# Uso: scripts/conferir-narracao.sh [origem] [prefixo] [esteira.txt]

set -u

REPO="${0:A:h:h}"
CORPUS="${TTS_CORPUS:-/Volumes/SSD 2TB SD/dev/tts-corpus}"
# O padrão é `gam-ash2`, a era da Bíblia Livre. NÃO devolva para `gam-ash1`:
# aquele é o acervo da NAA, que continua no bucket e é obra derivada de uma
# tradução protegida. Rodar este script contra ele reintroduz o problema que
# a troca de VOZ em src/lib/manifesto.ts fechou. Para conferir o acervo antigo
# de propósito, passe o prefixo como argumento — explícito, nunca por padrão.
VOZ=gam-ash2
ORIGEM="${1:-$CORPUS/$VOZ}"
PREFIXO="${2:-$VOZ}"
LISTA_ARG="${3:-}"
API="${API_BASE:-https://biblia-pericopes.jairofilho79.workers.dev}"
# Terceiro argumento permite conferir em esteiras paralelas: 5292 HEADs
# em série levam ~20 min.
LISTA="${LISTA_ARG:-$ORIGEM/ordens.txt}"

tam_remoto() {  # tam_remoto <chave>
  curl -sI --max-time 30 "$API/api/audio/$1" | tr -d '\r' \
    | awk -F': ' 'tolower($1)=="content-length"{print $2}'
}

# Grava a cobertura de narração que o app lê ANTES de tentar tocar (hoje ele só
# descobre no 404). Formato — JSON não aceita comentário, então o contrato mora
# aqui:
#
#   { "ordens": [1600, 1601, ...] }   crescentes, sem repetição
#
# Uma lista e não um mapa: o único consumidor (scripts/shard-catalogo.ts) faz
# uma pergunta só, "esta ordem tem áudio?", e a lista é o que este loop já tem
# na mão. Uma ordem só entra quando os DOIS objetos dela (m4a e manifest)
# batem — meio par publicado não toca.
#
# Só grava numa passada completa e da voz corrente. Uma esteira parcial
# conhece um pedaço da lista; outro prefixo é outro acervo. Os dois gravariam
# "não está publicado" sobre narração que está, e a Home esconderia o botão
# Ouvir do catálogo inteiro até a próxima passada boa.
#
# Divergência NÃO impede a gravação: a lista tem só os pares que bateram, e é
# no lote meio publicado que o catálogo mais precisa saber o que já existe.
# Uma conferência que morre no meio (rede fora, API caída) nunca chega aqui —
# quem grava é a última linha do script.
gravar_cobertura() {
  if [[ -n "$LISTA_ARG" ]]; then
    echo "esteira parcial:                data/audio-cobertura.json intocado"
    return
  fi
  if [[ "$PREFIXO" != "$VOZ" ]]; then
    echo "prefixo $PREFIXO não é a voz corrente: data/audio-cobertura.json intocado"
    return
  fi
  destino="$REPO/data/audio-cobertura.json"
  ordens=(${(onu)confirmadas})
  # tmp + mv: uma escrita interrompida não pode deixar meia lista no lugar da
  # inteira — o consumidor leria JSON quebrado ou cobertura mutilada.
  print -r -- "{\"ordens\":[${(j:,:)ordens}]}" > "$destino.tmp"
  mv "$destino.tmp" "$destino"
  echo "cobertura gravada:              ${#confirmadas} perícopes"
}

ok=0; ausente=0; divergente=0
confirmadas=()
DIVERG="$ORIGEM/divergencias$(basename ${LISTA_ARG:-}).txt"
: > "$DIVERG"
while read -r ordem; do
  [[ -n "$ordem" ]] || continue
  d=$(printf "%s/%04d" "$ORIGEM" "$ordem")
  par_inteiro=1
  for par in "m4a:pericope.m4a" "json:manifest.json"; do
    ext="${par%%:*}"; arq="${par#*:}"
    local_b=$(stat -f%z "$d/$arq" 2>/dev/null || echo 0)
    remoto_b=$(tam_remoto "$PREFIXO/$ordem.$ext")
    if [[ -z "$remoto_b" ]]; then
      echo "AUSENTE   $PREFIXO/$ordem.$ext" >> "$DIVERG"; ((ausente++)); par_inteiro=0
    elif [[ "$remoto_b" != "$local_b" ]]; then
      echo "DIVERGE   $PREFIXO/$ordem.$ext  local=$local_b remoto=$remoto_b" >> "$DIVERG"
      ((divergente++)); par_inteiro=0
    else
      ((ok++))
    fi
  done
  (( par_inteiro )) && confirmadas+=("$ordem")
done < "$LISTA"

echo "objetos conferidos e idênticos: $ok"
echo "ausentes no R2:                 $ausente"
echo "com tamanho divergente:         $divergente"
# A cobertura é gravada ANTES do veredito, e de propósito: a lista de
# confirmadas é o que a passada de fato viu par a par, e vale mesmo quando
# alguma outra perícope diverge. Gravar só na passada 100% limpa deixaria o
# catálogo sem sinal de narração justamente quando há o que consertar — que é
# o caso para o qual este script existe.
gravar_cobertura
[[ $ausente -eq 0 && $divergente -eq 0 ]] \
  || { echo "PROBLEMAS em $ORIGEM/divergencias.txt"; exit 1 }
echo "PUBLICAÇÃO ÍNTEGRA"
