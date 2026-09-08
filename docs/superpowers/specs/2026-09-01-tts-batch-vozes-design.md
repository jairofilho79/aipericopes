# Vozes oficiais do app: geração local em lote + entrega via R2

**Data:** 2026-09-01 · **Status:** aguardando revisão

## Objetivo

Substituir a voz do sistema (Web Speech, robótica e diferente em cada aparelho)
por duas vozes fixas do app — **Dorabella** (feminina) e **Cláudio** (masculina) —
geradas uma única vez no Mac mini M4 com o Kokoro-82M, armazenadas no R2 da
Cloudflare e servidas pelo Worker existente. Custo recorrente: zero (free tier
do R2; síntese local). O Web Speech vira fallback offline.

Este documento cobre a **fase 1: o batch de geração + upload**. A fase 2
(rota no Worker + player no app) tem desenho resumido na seção 8 e ganhará
plano próprio.

## 1. Vozes oficiais (receitas fixas, aprovadas por audição)

| Voz | Receita (embeddings Kokoro) |
|---|---|
| **Dorabella** | `0.5·pf_dora + 0.5·bf_isabella` |
| **Cláudio** | `0.7·pm_santa + 0.3·bm_george` |

Versões pinadas para reprodutibilidade: modelo `hexgrad/Kokoro-82M`,
pacote `kokoro==0.9.4`, `espeak-ng 1.52.0`, 24 kHz mono. A receita fica em
código versionado (`tools/tts-batch/vozes.py`); qualquer mudança de receita é
uma nova versão de áudio (`v2/...`), nunca sobrescreve a `v1`.

## 2. O que é falado (estrutura narrada por perícope)

Cinco arquivos de áudio por perícope, cada um abrindo com o cabeçalho falado:

| Arquivo | Conteúdo falado |
|---|---|
| `abertura` | Título da perícope. Referência ("Mateus, capítulo 1, versículos 1 a 17.") |
| `contexto` | "Contexto." + parágrafos |
| `texto` | "Texto Bíblico." + versículos |
| `resenha` | "Resenha." + parágrafos |
| `reflexao` | "Reflexões." + cada pergunta |

"Ouvir tudo" no app = tocar os cinco em sequência. O ▶ de cada seção toca só
o seu arquivo (o cabeçalho falado incluso). No app, o título da seção "Texto"
passa a exibir **"Texto Bíblico"**.

### Normalização de texto (regras validadas na audição)

- `SENHOR` → `Senhor` (evita soletração).
- Números de versículo **não são lidos**; a linha `Capítulo N` **nunca vira
  utterance isolada** — é emendada ao primeiro versículo seguinte
  ("Capítulo 1. Livro da genealogia…"), porque frases curtas isoladas saem
  deformadas da síntese (bug do "onze disfarçado", reproduzido e corrigido).
- Números permanecem como dígitos (validado por A/B: dígito lê melhor que
  por extenso).
- Espaços colapsados; unidades vazias descartadas.

## 3. Unidades de fala e manifesto (realce sincronizado)

Um script Node (`scripts/exporta-unidades.ts`) usa **as mesmas funções do app**
(`filaDeTextos`, paragraphize, montagem de versículos) para gerar
`unidades.json`: por perícope e seção, a lista `{id, texto}` na ordem falada —
ids idênticos aos `data-verse-id` do app, por construção.

O gerador sintetiza unidade por unidade (pausa de 0,4 s entre unidades; o
cabeçalho da seção é unidade com `id: null` — sem realce) e grava por seção:

- `{secao}.m4a` — áudio da seção;
- `{secao}.json` — manifesto `{unidades: [{id, inicio, dur}], hash}` onde
  `hash` é o hash do texto normalizado da seção (detecta necessidade de
  regeração futura) e `inicio`/`dur` em segundos movem o realce/rolagem no
  player via `timeupdate`.

## 4. Formatos

- **Publicação (R2):** AAC-LC mono 48 kbps `.m4a` (`-movflags +faststart`) —
  toca em qualquer iPhone/Android/desktop. Estimativa: ~5,7 GB nas duas vozes
  (cabe no free tier de 10 GB). Opus foi descartado: iPhone só toca a partir
  do iOS 18.4, com bugs; FLAC na web foi descartado: ~28 GB, ganho inaudível
  para fala sintetizada.
- **Master local (SSD 2 TB):** FLAC por seção (~28 GB) em
  `/Volumes/SSD 2TB SD/dev/tts-audio/masters/` — permite re-encodar para
  outro codec/bitrate no futuro sem repetir a síntese.

## 5. Esteiras de geração (paralelismo)

Quatro filas independentes: **AT×Cláudio, NT×Cláudio, AT×Dorabella,
NT×Dorabella** (AT = ordem 0–1599, 1600 perícopes; NT = ordem 1600–2646,
1047 perícopes; fronteira = primeira perícope de Mateus).

- `tools/tts-batch/gerar.py --fila at-claudio` roda UMA fila; o orquestrador
  `rodar-tudo.sh` sobe os 4 processos em paralelo sob `caffeinate -i` (mini
  não dorme), cada um com `torch.set_num_threads(2)` para não brigar pelos
  10 núcleos.
- **Retomável:** estado por fila em `estado/{fila}.json` (última ordem
  concluída + falhas); `Ctrl-C`/queda de energia → re-executar continua de
  onde parou. Escrita atômica (tmp + rename).
- **Controle de qualidade:** por unidade, razão duração/caracteres fora de
  faixa (fala truncada ou disparada) → re-síntese; segunda falha → loga em
  `estado/{fila}-falhas.json` e segue (não trava a esteira).
- Se rodar 4 processos sobrecarregar a máquina, o fallback é rodar 2 (um por
  voz) — a divisão AT/NT continua valendo como unidade de fila.

## 6. Upload em paralelo

Processo separado (`tools/tts-batch/subir.py`) roda junto com as esteiras:

- Varre `saida/`; uma perícope×voz está pronta quando o gerador grava o
  marcador `{ordem}.done` (gravado por último, atomicamente).
- Sobe os 10 objetos (5 `.m4a` + 5 `.json`) para o bucket R2
  `pericopes-audio`, chaves `v1/{claudio|dorabella}/{ordem}/{secao}.*`, com
  retry exponencial; sucesso → marcador `{ordem}.sent`; roda em loop até as
  esteiras acabarem e a fila esvaziar.
- Credenciais: o wrangler local já está autenticado (OAuth) com acesso ao R2
  — o upload usa `wrangler r2 object put` com concorrência (4–8 uploads
  simultâneos), sem criar credencial nova. Se o upload não acompanhar as
  esteiras, otimização opcional: token S3 do R2 criado pelo usuário **num
  terminal de verdade** (regra do secret vazio) + boto3. `--dry-run` para
  validar antes.

## 7. Estimativas

- Síntese: ~133 h de áudio por voz; single-process medido a ~5,5× tempo real;
  com 4 esteiras, estimativa de **~1 dia de mini ligado** (pior caso ~2,5 dias).
- R2: ~26,5 mil objetos de áudio + manifestos ≈ 53 mil PUTs (free tier:
  1 M/mês) e ~5,7 GB armazenados (free tier: 10 GB).

## 8. Fase 2 (resumo; plano próprio)

- **Worker:** binding R2 + rota `GET /audio/v1/:voz/:ordem/:arquivo` com
  `Cache-Control: public, max-age=31536000, immutable` e suporte a Range.
- **App:** controller de áudio (`HTMLAudioElement`) com a mesma interface do
  controller atual (`play/pause/resume/stop`, `onVerse`, `onState`);
  manifesto move o realce; velocidade = `playbackRate` (0,85/1/1,15);
  menu ⚙ passa a oferecer **Dorabella/Cláudio** (persistido); Web Speech
  permanece como fallback (offline/erro de rede/áudio ausente).
- Título da seção "Texto" → "Texto Bíblico".

## Fora de escopo

- Regerar áudio quando os textos das perícopes mudarem (o `hash` no manifesto
  já detecta; a rotina de regeração incremental fica para quando houver
  mudança de conteúdo).
- Vozes adicionais, clonagem de voz, outros idiomas/traduções.
