# Sessão 3 — Reenriquecimento do material editorial

> Spec guardada em 2026-09-04, para executar depois de fechadas as pendências da
> Sessão 2. Branch: `v2-biblia-livre`.
> **Prompt para retomar:** *"Leia `docs/superpowers/specs/2026-09-04-sessao-3-reenriquecimento-design.md`
> e vamos executar a Sessão 3."*

## O que é

Reescrever o material editorial — contexto histórico-literário, resenha,
perguntas de reflexão e tópicos de pregação — das 2.823 perícopes, com a
qualidade que os subagents entregaram nas 195 novas.

## Por que

O catálogo de 2.628 perícopes antigas foi escrito pelo `gemini-3.7-flash`. As
195 novas foram escritas por subagents, e o dono comparou os dois lado a lado e
disse que o dos subagents ficou visivelmente acima.

O bloqueio histórico era o custo: reenriquecer obriga a regravar o áudio,
porque o realce por palavra alinha o texto exibido contra o texto gravado.
**Esse bloqueio evaporou** — a narração inteira vai ser descartada de qualquer
jeito (é leitura da NAA, obra derivada). Esta é a única janela em que
reenriquecer sai de graça.

> **Corrigido em execução (2026-09-05).** A tabela abaixo previa dois trabalhos
> diferentes. A medição derrubou isso: **192 das 195** novas citam frase que não
> existe na Bíblia Livre, então "só re-citação" seria reescrita de qualquer
> jeito. E o dono decidiu depois que nenhuma perícope recebe material anterior —
> material escrito sobre outra tradução traz o contexto dela, e conhecimento
> tácito herdado afasta o leitor. **As 2.823 são escritas do zero.** O briefing
> vigente é `docs/prompt-reenriquecimento.md`.

## Escopo: 2.628 + 195, e são trabalhos diferentes

| | quantas | trabalho |
|---|---|---|
| antigas (`ordem < 3000`) | 2.628 | **reescrita completa** |
| novas dos subagents (`ordem >= 3000`) | 195 | **só re-citação** — já estão no padrão, mas citam a NAA |

## O achado que define a arquitetura

**Um script não invoca subagent. Quem invoca é o Claude da sessão.** Então a
orquestração *é a sessão*, e o que precisa existir em disco é uma fila que
sobreviva a ela — a sessão vai cair, ser interrompida, e continuar noutro dia.

## Desenho

### 1. Fila com claim em disco

- Pendente = perícope sem `data/enriched/<ordem>.json` atualizado.
- Em curso = `data/enriquecimento/<ordem>.lock` (criado com `mkdir`, que é
  atômico).
- Feito = `data/enriched/<ordem>.json`, que é onde `montar-catalogo.ts` já lê.

É o mesmo padrão do lote de TTS, que sobreviveu a queda de DNS e a processo
morto. **A lição que veio junto e vale aqui:** a trava por `mkdir` NÃO é
devolvida quando o processo é morto — só quando há exceção. Depois de qualquer
queda, liberar as travas órfãs antes de religar.

### 2. Lote por subagent

Cada subagent recebe o texto da Bíblia Livre de N perícopes e devolve um JSON
por perícope. N=5 dá ~525 invocações; N=10 dá ~263. **O piloto decide o N** —
não chutar.

### 3. O prompt

Herda o que produziu as 195 e ganha três regras novas:

- citar a **Bíblia Livre**, nunca a NAA;
- usar o campo **`sobrescrito`** como contexto quando houver (é informação que a
  NAA não tinha — "quando ele fugia da presença de seu filho Absalão" é a
  diferença entre um lamento genérico e uma oração datada);
- **nunca citar frase que não esteja no texto** — inventar Escritura é o erro
  mais grave possível aqui.

### 4. Portão de qualidade

`scripts/validar-material.ts`, que já existe e já confere:

- campos obrigatórios, `ordem` batendo, 2 perguntas, sem cerca de código;
- tópicos com as duas seções, 5–7 bullets na linha de raciocínio, 4–6 nas
  mensagens, com negrito;
- resenha citando 5+ versículos → "virou tour";
- menos de 5 palavras em comum com o texto → material genérico;
- **frase entre aspas que não existe no texto** → é este que pega a citação da
  NAA sobrevivendo, e é o mais importante;
- campo com menos de 200 ou mais de 3.000 chars.

O que reprovar volta para a fila. Não entra no catálogo.

### 5. Piloto antes de tudo

10 perícopes de livros diferentes, com o dono lendo o resultado. Se o padrão não
agradar, ajusta-se o prompt gastando 10 e não 2.628.

## Fora do escopo

Narração, histórico do Git, qualquer coisa em `tts-spike/` (é território da
Sessão 4, que roda em paralelo).

## Referência de qualidade

`data/novas-material.jsonl` — as 195. Médias do que se espera:

| campo | antigas (gemini) | subagents |
|---|---|---|
| contexto | 479 chars | 547 |
| resenha | 910 | 1.114 |
| tópicos | 1.471 | 1.242 |
| perguntas | 2 | 2 |
