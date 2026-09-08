# Kickoff — juntar tudo na v2 (Bíblia Livre)

> **Prompt para abrir a sessão nova:** "Leia `docs/kickoff-merge-v2-blivre.md` e
> me diga, antes de mexer em qualquer coisa, o que está servido em produção hoje."

A `v2-biblia-livre` está 200 commits à frente da `main` (confira com
`git rev-list --count main..HEAD` — o número anda), e a diferença não é
cosmética: a `main` ainda carrega o campo `texto_naa` — a Nova Almeida
Atualizada, que é justamente a tradução que a refundação tirou do projeto por
direitos autorais. Toda a Bíblia Livre, o acervo narrado e os consertos de
07–08/09 vivem só no branch. Este documento existe para o merge não perder nada
do que **não está em commit nenhum**, que é a parte perigosa.

## Estado (08/09/2026) — o acervo está narrado, alinhado e publicado

| eixo | número | onde conferir |
|---|---|---|
| perícopes narradas | 2.823 / 2.823 | `tts-corpus/gam-ash2/*/manifest.json` |
| áudio | 224,2 h · 80.081 unidades | soma de `dur_total` nos manifestos |
| alinhamento | 1.957.143 palavras · 0 pendentes | `alinha_estado.py <corpus>` |
| publicado no R2 | 2.823 `.m4a` + 2.823 `.json` | marcadores `.subiu` / `.subiu_json` |
| custo | US$ 56,05 + US$ 0,15 de renarração | `lote_gam.log` |
| receitas × catálogo | 31.102 versículos, sem divergência | `npm run conferir-receitas` |
| suíte | 237 arquivos / 2.838 testes | `npx vitest run` |

Commits desta rodada, todos na `v2-biblia-livre`:

```
cced3b3  docs: o documento da Sessão 4 se contradizia depois do próprio veredito
64d69cc  docs: a checagem de número era gravada e nunca lida
ba97429  fix: quatro frases que o narrador obedecia em vez de ler
94453c5  fix: `alinda` era `ainda`, e quem achou foi o narrador
```

## O que JÁ existe — não construa de novo

- **`npm run conferir-receitas`** (`scripts/conferir-receitas.ts`) roda o pipeline
  inteiro e compara os 31.102 versículos com o que o catálogo serve. É a **única**
  coisa que enxerga conserto feito num endereço e não no outro. Não é teste de
  vitest de propósito: depende de `data/bliv-tr_vpl.txt`, que é gitignorado.
- **`tts-spike/alinha_estado.py <corpus> [--solta-travas]`** responde
  `"<pendentes> <travas soltas>"` em menos de um segundo (0,73 s medido nas 2.823).
  O `roda_alinha_continuo.sh` antigo abria um Python por manifesto — 2.823
  partidas, alguns minutos de atraso antes de alinhar qualquer coisa.
- **`tts-spike/encadeia_alinhamento.sh`** espera a narração sair, solta travas
  órfãs, sobe os alinhadores **antes** do uploader e faz uma passada final.
- **A varredura por corretor ortográfico** está descrita em
  `docs/defeitos-blivre-rede-ortografica.md`, seção de 08/09. Ela está **fechada**:
  as 80 palavras que sobram fora do dicionário são nome próprio, letra hebraica do
  Salmo 119 e arcaísmo da Almeida.

## Detalhes técnicos que vão morder

### 🚨 1. O manifesto guarda o TEXTO FALADO

Mudar o texto de um versículo no catálogo **sem renarrar a unidade** quebra o
realce naquele trecho — o app casa o que está na tela com o que está no manifesto,
e a divergência não gera erro em lugar nenhum. Já aconteceu numa sessão anterior,
em larga escala — o registro está na memória do projeto, não neste repo, então
trate o número como relato e o mecanismo como certo. Toda alteração de texto tem três passos, nesta ordem:

```
1. receita   scripts/blivre-correcoes.ts   (o pipeline reaplica ao VPL a cada build)
2. resultado data/pericopes.json + npm run shard   (o que o leitor lê)
3. áudio     renarrar a unidade, realinhar, republicar
```

Renarração cirúrgica: apague `u<NN>.mp3`/`u<NN>.json` das unidades alvo **e** o
`manifest.json` da perícope, depois chame
`CORPUS_DIR=… ORDENS=426,615 LIMIAR_VERBATIM=0.98 gera_lote_gam.py`. Custou
US$ 0,001 por perícope contra US$ 0,02 na íntegra.

### 🚨 2. Conserto tem dois endereços, e o resultado sozinho morre

`data/pericopes.json` é o RESULTADO; `scripts/blivre-correcoes.ts` é a RECEITA.
Conserto que mora só no resultado sobrevive até alguém rodar `npm run pipeline`, e
some sem erro, sem log e sem teste vermelho. Rode `npm run conferir-receitas`
depois de **qualquer** toque no texto bíblico.

### ⚠️ 3. As chaves do R2 são as de produção

`sobe_gam.sh` publica em `nt-ml/<ordem sem zeros>.{m4a,json}` no bucket
`biblia-pericopes-audio` — as mesmas chaves que o app consome. O áudio novo já
está lá, seja qual for o texto que o app esteja mostrando hoje.

### ⚠️ 4. Nada disso está em git

`tts-spike/` e `tts-corpus/` **não são repositórios**. O que mudou tem backup por
arquivo, e só:

```
tts-spike/gera_lote_gam.py        .pre-numeros  .pre-recirurgia  .pre-lv
tts-corpus/sobe_gam.sh            .pre-mtime
tts-spike/roda_gam.sh             .pre-s4
tts-spike/alinha_estado.py, encadeia_alinhamento.sh   (novos, sem versão anterior)
```

Se o merge for mexer nessas máquinas, versione antes.

### ⚠️ 5. Quatro armadilhas de nome e de estado

| coisa | armadilha |
|---|---|
| `gera_lote_gam.py` | pula toda perícope que já tem `manifest.json` — corpus cheio faz a noite render **zero**, com log limpo |
| `CORPUS_DIR` × `CORPUS_TTS` | o lote e o uploader leem `CORPUS_DIR`; o alinhador lê `CORPUS_TTS`. Nomes diferentes para a mesma coisa |
| trava `.alinhando` | é um `mkdir` e **não volta no sucesso**, só na exceção. Depois de qualquer rodada o corpus fica todo travado, e a próxima diz "alinhadas 0" com FIM_OK limpo. Solte com `--solta-travas`, que só desperta perícope não alinhada |
| `npm run pipeline` | é `etl && enrich --local`, e `enrich --local` **sobrescreve material de IA**. Para só remontar, use `--limit=0` |

### ⚠️ 6. O narrador obedece imperativo em vez de ler

Frase do material que começa com "Leia…", ou rótulo antes de citação ("A frase é
esta:"), o narrador entende como ordem dirigida a ele e **pula**. Cinco tentativas
dão sempre o mesmo resultado. Conserto no MATERIAL, nunca no prompt: mexer no
pedido mudaria a receita das 80.081 unidades para acertar quatro. Quatro já foram
reescritas (`ba97429`).

## O que NÃO fazer

- ❌ **Não reescreva Escritura para casar com o que o narrador falou.** Na triagem
  de 07/09 (antes da renarração, e portanto não reproduzível hoje) a maioria das
  divergências reais caía na seção `texto`. A correção ali é renarrar, não editar
  a Bíblia.
- ❌ **Não varra o VPL cru.** `data/bliv-tr_vpl.txt` guarda os defeitos de
  propósito. Varrendo o cru, 63 de 68 achados eram conserto que já existia na
  tabela — a conta está no cabeçalho do bloco de 08/09 em `blivre-correcoes.ts` e
  em `defeitos-blivre-rede-ortografica.md`. Varra o texto **depois** de
  `corrigirVersiculo`.
- ❌ **Não use a Almeida 1911.** Regra nova do dono (08/09): *"Usando a KJV (não
  use mais a Almeida de 1911) como fonte de verdade"*. As receitas antigas que a
  citam ficam como estão.
- ❌ **Não trate as 68 notas de verbatim abaixo de 0,98 como defeito.** Em 67
  delas a grafia certa está do NOSSO lado (`palavras`→`palabras`,
  `livro`→`labro`): quem errou foi o transcrito, e o áudio está intacto. A 68ª é
  `1570/u16`, que é Zc 1:17 e está na lista de decisões do dono, abaixo. Conte
  com um script lendo `verbatim` de cada unidade dos manifestos — as faixas de
  fronteira mudam o total (`[0,90; 0,98]` fechado dá 82).

## Antes de dar por pronto

1. `npm run conferir-receitas` → *OK: 31.102 versículos*.
2. `npx vitest run` → 2.838 testes.
3. `alinha_estado.py <corpus>` → `0 0`.
4. **Marcador mais novo que o arquivo que ele diz ter publicado**: `.subiu_json`
   mais novo que `manifest.json`, e `.subiu` mais novo que `pericope.m4a`, nas
   2.823. Contar marcador que existe não prova nada — foi o erro de 07/09.
5. Baixe dois ou três manifestos do R2 e compare byte a byte com o local.

## Decisões que são do dono, não suas

- **O merge e o deploy.** O gatilho automático foi desligado por decisão dele em
  05/09; `npm run deploy` publica a **árvore de trabalho**, não a `main`. A posição
  do branch não diz o que está no ar — pergunte antes de supor.
- **Zc 1:17.** O narrador engole *"Fala em voz alta mais, dizendo:"* porque lê o
  imperativo como ordem. É o mesmo defeito das quatro frases reescritas, mas aqui
  o texto é **Escritura**. Ficou como está, com a nota 0,92 no manifesto.
- **Contagem de palavras no verbatim.** Metade do item da Sessão 4 ficou por
  fazer: nenhuma medição a justificou até agora.

## Território

Outra sessão commita neste mesmo repositório ao mesmo tempo — confira
`git log` antes de assumir que um commit é seu. Os documentos de sessão são
"vivos" e podem se contradizer: em `sessao-4-tts-resultados.md` duas seções
sobraram **depois** do veredito final e diziam o oposto dele; ficaram marcadas
como `~~SUPERADA~~` em vez de apagadas (`cced3b3`). Se encontrar contradição
parecida, a fonte mais nova vence — e marque, não apague.
