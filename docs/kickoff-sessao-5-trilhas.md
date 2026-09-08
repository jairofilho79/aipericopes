# Kickoff — Sessão 5: trilha sonora por registro emocional

> **Prompt para abrir a sessão nova:**
> *"Leia `docs/kickoff-sessao-5-trilhas.md` e toque a Sessão 5. Começa pelo teste
> de três perícopes; se não convencer no ouvido, encerra ali."*

Nasceu de uma ideia do dono no fim da Sessão 4: usar o `google/lyria-3` (geração
de música, US$ 0,04 por clipe de 30s) para pôr cama musical sob a narração.
Preocupação dele, textual: *"não queria algo genérico… cada perícope pode ter uma
pegada diferente, seja aflição, guerra, profundidade de Deus e afins."*

## A pergunta

Dá para pôr música sob a narração de um jeito que **some com o texto** em vez de
decorar por cima — e sem virar um projeto de meses?

## Duas coisas para acertar antes de começar

### 1. NÃO gere uma trilha por perícope

É a armadilha do enunciado. A conta:

| desenho | clipes | custo |
|---|---|---|
| uma trilha por perícope | 2.823 | **US$ 113–226** |
| **paleta de registros** | 10–15 | **US$ 0,40–1,20** |

E o argumento forte nem é o dinheiro — é que **200× mais caro soa pior**. Um app
onde cada tela tem uma música inédita não soa rico, soa incoerente: o ouvinte
nunca aprende a linguagem sonora do produto. Uma paleta pequena e reconhecível
soa *desenhada*. É como um selo editorial: Salmo de lamento tem o som do lamento,
e o ouvinte passa a reconhecê-lo.

Some a isso o detalhe prático: o clipe do Lyria tem **30 segundos** e a perícope
média tem **4 minutos**. Vai ter que fazer loop de qualquer jeito. O trabalho
técnico é o mesmo para 15 peças ou para 2.823 — só que com 15 dá para o dono
ouvir todas e reprovar as ruins, e com 2.823 não dá.

### 2. ⚠️ Música sob a Escritura é decisão editorial, não de produção

Música **diz ao ouvinte o que sentir**. Pôr trilha sob o texto bíblico é
interpretá-lo — você escolhe por ele se aquela passagem é sombria ou esperançosa.
Este projeto tem um dono que exige duas testemunhas para corrigir uma palavra de
tradução ([`correcoes-por-duas-testemunhas`](../CLAUDE.md)) e que refundou o app
inteiro por causa de direitos. Ele vai querer essa decisão na mão dele.

**Proposta de linha, para o dono confirmar ou recusar:**

- ✅ música sob **contexto**, **resenha** e **reflexões** — que são comentário
  humano, já interpretativos por natureza;
- ❌ **silêncio sob o texto bíblico** — a Escritura entra sem trilha.

Isso não é só escrúpulo: também resolve dois problemas práticos de uma vez.
A seção de texto é a mais longa (menos loop para costurar) e a entrada do
silêncio marca o texto sagrado com uma mudança de textura, que é bom design.

## O que JÁ existe — não construa de novo

- **O material para classificar já está pronto.** `public/data/estudo/*.json` tem
  `contexto_historico_literario`, `resenha`, `perguntas_reflexao` e
  `topicos_pregar` para **2.823 perícopes** — média de **1.407 chars** por
  perícope, quase 4 milhões no total. Não precisa ler a Bíblia para saber o
  registro de uma perícope: a resenha já diz.
- **Classificar isso é barato**: ~1M tokens de entrada num modelo leve
  (`llama-3.1-8b` ou similar no OpenRouter) sai por **centavos**. É uma tarde,
  não um projeto.
- **O tocador de áudio já existe**: `NarracaoPlayer.tsx` + rota Worker
  `/api/audio/<voz>/<ordem>.m4a` (R2, Range, cache imutável) e o manifesto com
  tempo por palavra em `lib/manifesto.ts`. O prefixo `nt-ml/` está hardcoded nos
  dois — vale para VT também.
- **A narração é o `ash`** (`openai/gpt-audio-mini`), decidido na Sessão 4, a
  −24,2 LUFS com −7,4 dBTP de headroom. A cama tem que caber embaixo disso.

## O protocolo

1. **Comece pelo teste de três.** Escolha três perícopes de registro claramente
   diferente — sugestão: um Salmo de lamento, uma narrativa de guerra do AT, e um
   texto de consolo do NT. Gere uma cama para cada, misture sob a narração do
   `ash` que **já está no R2**, e ouça. Custo: **US$ 0,12**. Se não convencer o
   dono, **a sessão acaba aqui** — resultado legítimo e barato.
2. **Só quem passar vira paleta.** Derive os registros do material que existe:
   peça a um modelo que proponha 10–15 registros lendo uma amostra das resenhas,
   e leve a lista ao dono antes de classificar as 2.823. A taxonomia é escolha
   editorial dele.
3. **Classifique o acervo** e **mande o dono conferir uma amostra**. "Que
   registro é esta passagem" é julgamento editorial, do mesmo tipo que ele exigiu
   duas testemunhas para tradução. Uma amostra de 30–50 perícopes revela se a
   classificação está confiável.
4. **Meça o custo real** na página do provedor antes de projetar. Os US$ 0,04/0,08
   deste documento são de setembro/2026 e valem como ordem de grandeza.

## Detalhes técnicos que vão morder

- **Loop de 30s sob 4 minutos.** Música gerada não faz loop limpo sozinha —
  precisa de crossfade e, de preferência, de um corte em batida. Vale testar se
  o Lyria aceita prompt pedindo material "loopable"/"seamless".
- **Nível.** O `ash` está a −24,2 LUFS. A cama deve ficar em torno de **−38 a −40
  LUFS** — bem embaixo, presente sem competir. Provavelmente com *ducking* leve
  nas frases.
- **Duas pistas, não uma mistura.** Misturar a música dentro do m4a é mais
  simples, mas irreversível e sem controle. **Recomendo pista separada no
  tocador, com botão de desligar** — trilha é gosto, e uma parte dos usuários vai
  querer sem. Também deixa refazer a paleta sem regerar 180 h de narração.
- **Licença.** Conferir os termos do Lyria/Gemini para redistribuição de áudio
  gerado num app. Este projeto já foi refundado uma vez por direitos autorais —
  não repetir.
- **O Lyria não narra.** Ele é gerador de música (`modality: text+image->
  text+audio`, "music generation models"). Não tente usá-lo para voz; a narração
  é do `ash` e está decidida.

## Como decidir

| resultado | decisão |
|---|---|
| O teste de três não convence | Sem trilha. Encerra, custou US$ 0,12. |
| Convence, mas só em alguns registros | Paleta parcial: trilha só onde funciona, silêncio no resto. |
| Convence amplamente | Monta a paleta, classifica as 2.823, pista separada no tocador. |
| Convence mas o dono acha que interfere na Escritura | Vale a linha da seção 2 — trilha só no comentário. |

## Território

A Sessão 3 (reenriquecimento) mexe no repo em paralelo. Trabalhe em
`../tts-spike/` ou num diretório novo descartável; toque em `src/` e `worker/`
apenas quando chegar a hora da pista separada, e confira o log antes de assumir
que um commit é seu.
