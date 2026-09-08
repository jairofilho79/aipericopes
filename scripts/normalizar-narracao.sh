#!/bin/zsh
# Reprocessa a narração publicada para o volume de publicação, e SÓ aceita
# arquivo que ele mesmo mediu depois de gerar.
#
# POR QUÊ: o acervo saiu do TTS em -24,0 LUFS (medido nas 2646 publicadas:
# -24,7 a -23,6, só 1,1 dB de espalhamento). O alvo de YouTube e Spotify é -14.
# Dez decibéis abaixo — por isso a narração soava fraca ao lado de qualquer
# outra mídia no mesmo aparelho. O ganho vai no arquivo, não no cliente: o
# iPhone ignora `audio.volume`, então ganho no player não chegaria justamente
# no aparelho onde o problema aparece.
#
# A RECEITA, e as três coisas que ela aprendeu apanhando:
#
#   volume=13dB     Ganho FIXO, não por alvo. Com 1,1 dB de espalhamento em
#                   2646 arquivos, ganho fixo entrega o resultado auditado e
#                   preserva as diferenças reais entre perícopes.
#
#   aresample 96k   Limitar SOBREAMOSTRADO, não na taxa nativa. Limitador
#                   comum só vê pico de amostra e deixa passar o pico ENTRE
#                   amostras. Na perícope 1104 (83 min) o teto nativo de
#                   -4,5 dB entregou +0,3 dBTP; sobreamostrado, o mesmo
#                   material fica em -1,4 dBTP E sai mais alto.
#
#   -b:a 80k        Bitrate é o que controla o estouro que sobra. O excesso
#                   final é ruído de quantização do AAC, e ele SOBE quando se
#                   aperta o codec: na 1100, teto de -6 dB deu +2,2 dBTP,
#                   enquanto 96k no mesmo teto deu -2,1. Por isso a repescagem
#                   abaixo sobe o bitrate em vez de baixar o teto — e não custa
#                   volume nenhum.
#
# Duração NÃO muda: nem ganho nem limitador deslocam amostras. Por isso o
# manifest.json (offsets do realce palavra a palavra) é copiado sem tocar.
#
# NENHUM arquivo é publicado sem passar pela janela abaixo. A garantia não é a
# receita estar certa — é cada saída ser medida.
#
# Uso: scripts/normalizar-narracao.sh [destino]

set -u

CORPUS="${TTS_CORPUS:-/Volumes/SSD 2TB SD/dev/tts-corpus}"
# gam-ash2 = era Bíblia Livre. O `1` é a narração da NAA — ver o comentário
# em src/lib/manifesto.ts antes de mexer.
DESTINO="${1:-$CORPUS/gam-ash2}"
# Masters: o acervo principal, e o resgate das que só existiam no R2.
ARVORES=("$CORPUS/gam-ash" "$CORPUS/gam-ash-r2")

GANHO="13dB"
TETO="0.631"                      # -4,0 dBFS, aplicado a 96 kHz
BITRATES=(80k 96k 128k)           # repescagem: sobe o bitrate, não baixa o teto

I_MIN="-14.8"; I_MAX="-13.4"      # LUFS integrado
TP_MAX="-1.0"                     # dBTP

RELATORIO="$DESTINO/relatorio.tsv"
mkdir -p "$DESTINO"
[[ -f "$RELATORIO" ]] || printf 'ordem\tlufs\ttruepeak\tflat\tbitrate\tveredito\n' > "$RELATORIO"

# Ordens a processar: as que estão publicadas hoje (uma por linha em ordens.txt),
# ou todas as que tiverem master, se o arquivo não existir.
#
# TTS_LISTA aponta para outra lista, o que permite rodar várias esteiras em
# paralelo sobre o MESMO destino: cada uma recebe uma fatia das ordens e nunca
# duas tocam a mesma perícope. É a diferença entre 3 horas e 40 minutos.
LISTA="${TTS_LISTA:-$DESTINO/ordens.txt}"
if [[ ! -f "$LISTA" ]]; then
  for a in "${ARVORES[@]}"; do
    [[ -d "$a" ]] && for d in "$a"/*/; do
      [[ -f "$d/pericope.m4a" ]] && echo $((10#$(basename "$d")))
    done
  done | sort -n | uniq > "$LISTA"
fi

master() {  # master <ordem> -> caminho do diretório, ou vazio
  for a in "${ARVORES[@]}"; do
    local d=$(printf "%s/%04d" "$a" "$1")
    [[ -f "$d/pericope.m4a" && -f "$d/manifest.json" ]] && { echo "$d"; return }
  done
}

medir() {  # medir <arquivo> -> "I TP FLAT"
  local m=$(ffmpeg -nostdin -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1)
  local f=$(ffmpeg -nostdin -hide_banner -nostats -i "$1" -af astats=metadata=1 -f null - 2>&1 \
            | grep -m1 'Flat factor' | awk '{print $NF}')
  echo "$(echo "$m" | grep -E '^\s+I:'    | tail -1 | awk '{print $2}')" \
       "$(echo "$m" | grep -E '^\s+Peak:' | tail -1 | awk '{print $2}')" \
       "${f:-1}"
}

ok=0; falhou=0; pulou=0; repescadas=0

# `-nostdin` em todo ffmpeg NÃO é enfeite: sem ele o ffmpeg consome o stdin
# deste laço e devora pedaços da lista de ordens — perícopes somem em silêncio
# e outras chegam com a ordem truncada ("1600" vira "00").
while read -r ordem; do
  [[ -n "$ordem" ]] || continue
  src=$(master "$ordem")
  if [[ -z "$src" ]]; then
    echo "SEM MASTER  ordem $ordem — não será publicada"
    ((falhou++)); continue
  fi

  saida="$DESTINO/$(printf %04d $ordem)"
  if [[ -f "$saida/pericope.m4a" && -f "$saida/manifest.json" ]]; then
    ((pulou++)); continue         # retomável
  fi
  mkdir -p "$saida"

  aceito=""
  for br in "${BITRATES[@]}"; do
    ffmpeg -nostdin -hide_banner -loglevel error -y -i "$src/pericope.m4a" \
      -af "aresample=96000,volume=${GANHO},alimiter=limit=${TETO}:attack=5:release=50:level=disabled,aresample=24000" \
      -c:a aac -b:a "$br" -ar 24000 -ac 1 -movflags +faststart \
      "$saida/pericope.m4a" || break

    read -r lufs tp flat <<< "$(medir "$saida/pericope.m4a")"
    veredito=$(awk -v i="$lufs" -v t="$tp" -v f="$flat" \
                   -v a="$I_MIN" -v b="$I_MAX" -v c="$TP_MAX" \
      'BEGIN { print (i>=a && i<=b && t<=c && f==0) ? "ok" : "FORA" }')
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$ordem" "$lufs" "$tp" "$flat" "$br" "$veredito" >> "$RELATORIO"

    if [[ "$veredito" == "ok" ]]; then
      aceito="$br"
      [[ "$br" != "${BITRATES[1]}" ]] && { echo "repescada  ordem $ordem em $br (TP=$tp)"; ((repescadas++)) }
      break
    fi
    echo "  ordem $ordem fora da janela em $br: I=$lufs TP=$tp flat=$flat — tentando bitrate maior"
  done

  if [[ -n "$aceito" ]]; then
    cp "$src/manifest.json" "$saida/manifest.json"   # offsets intactos: a receita não desloca amostras
    ((ok++))
  else
    # sem manifest.json o uploader não publica esta perícope
    rm -f "$saida/pericope.m4a"
    echo "REJEITADA  ordem $ordem — não passou em nenhum bitrate"
    ((falhou++))
  fi
done < "$LISTA"

echo "---"
echo "aceitas: $ok (sendo $repescadas com bitrate maior)   rejeitadas: $falhou   já feitas: $pulou"
echo "relatório: $RELATORIO"
[[ $falhou -eq 0 ]]
