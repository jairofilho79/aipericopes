# Refundação na Bíblia Livre — mapa das sessões

> Arquivo de largada, no mesmo espírito de `docs/kickoff-proximas-fases.md`.
> Prompt sugerido para uma sessão nova: **"Leia docs/refundacao-blivre.md e
> docs/licencas.md e vamos tocar a Sessão N."**

## Por que estamos aqui

A NAA é protegida por direitos autorais da Sociedade Bíblica do Brasil e o app a
distribui sem licença. Em 2026-09-04 o dono decidiu refundar o catálogo sobre uma
tradução de uso livre. A ARC, que era a outra candidata, **está fora pelo mesmo
motivo** (© SBB nas edições de 1995 e 2009) — ver `docs/licencas.md`.

## Decisões travadas

1. **Versão única: Bíblia Livre (BLIVRE)**, CC BY 3.0 Brasil, 66 livros.
   Sem seletor de versão. A arquitetura atual do app se preserva.
2. **Reenriquecer todo o material** (2.823 perícopes) com a qualidade dos
   subagents, em vez de congelar o material antigo do gemini-3.7-flash.
   O bloqueio histórico ("reenriquecer obriga a regravar, ~US$ 50") evaporou:
   a regravação vai acontecer de qualquer jeito.
3. **A narração inteira é descartada** — é leitura em voz alta da NAA, obra
   derivada. As 185h em `tts-corpus/gam-ash/` e tudo no bucket R2 saem.

## O que sobrevive, o que morre

**Sobrevive:**

- O app inteiro: React, Worker, D1, auth, sync, ditado, jornadas, player.
- **O desenho das 2.823 perícopes.** Os limites vêm de
  `data/raw/PericopeGroupedKJVVerses.json` + os cortes manuais em
  `scripts/cortes.ts` — não da NAA. `ordem` e `seq` se preservam.
- **O material editorial** (contexto, resenha, reflexões, tópicos): prosa
  original sobre a passagem, não derivada da tradução. Medido em amostra de 406
  perícopes: só ~13% trazem alguma citação literal curta da NAA entre aspas.
  (Vai ser reescrito mesmo assim, por decisão de qualidade — não por licença.)
- Todo o pipeline de TTS: direção por seção, checagem de verbatim, alinhamento
  MMS, formato do manifesto, uploader, player com realce por palavra.

**Morre:**

- `data/NAA.json`, `data/NAA.json.bak`, o campo `texto_naa` e
  `public/data/texto/*.json`.
- Os `.m4a` e os manifestos no R2 (os manifestos carregam o texto narrado).
- `scripts/naa-versificacao.ts` e os 10 valores travados no teste do commit
  `95e2d3d`, que são específicos da versificação da NAA.

## Números medidos (2026-09-04)

| | |
|---|---|
| perícopes | 2.823 |
| chars de texto bíblico | 4.055.642 |
| chars de material editorial | 5.006.338 |
| chars narrados por versão | **9.061.980** |
| áudio resultante | ~265 h |
| custo no `gpt-audio-mini`/`ash` (US$ 0,0053/1k) | **~US$ 48** |

## As sessões

### ✅ Sessão 0 — Licenças (feita em 2026-09-04)

Saída: `docs/licencas.md`. ARC descartada, BLIVRE aprovada, BLT descoberta como
só-Novo-Testamento.

### Sessão 1 — Despejo da NAA

O item mais urgente: **`data/pericopes.json` (14 MB, com o `texto_naa` das 2.823
perícopes) está versionado no repositório público** `jairofilho79/biblia-pericopes`,
e está no histórico do Git. Não basta `git rm` — exige reescrita de histórico.

Escopo:

- Tirar o texto da NAA do repositório e do histórico público.
- Renomear `texto_naa` → `texto` (~15 arquivos; ver `grep -rn texto_naa src worker scripts`)
  e registrar a versão e o crédito obrigatório da BLIVRE na UI.
- Esvaziar o bucket R2 (`.m4a` + manifestos) e aposentar `tts-corpus/gam-ash/`.
- Testes verdes com fixture sintética, sem texto bíblico real nos fixtures.

O app fica de pé e limpo, esperando o texto novo.

### ✅ Sessão 2 — ETL da BLIVRE (feita em 2026-09-04)

**O texto trocou e a auditoria fecha:** 2.823 perícopes · 31.102 versículos ·
cobertura **100,0000%** · 0 fora de perícope · 0 em mais de uma · 0 divergência
com `bible-books.ts`. Os 16 avisos que restam são `limite_corrigido` do próprio
dataset KJV, os mesmos de antes. Zero aviso de versículo ausente.

**A versificação bateu de primeira.** A tabela `AJUSTES` ficou VAZIA: a BLIVRE
segue a KJV nos 31.102 versículos. Os cinco ajustes que a NAA exigia morreram
todos, e o motivo de cada um está escrito em `scripts/versificacao.ts`. Cinco
números de `bible-books.ts` trocaram de lado junto (1Sm 20, 1Rs 22, 2Co 13,
3Jo 1, Ap 12) e estão travados em teste.

**Sobrescritos entregues.** 119 perícopes ganharam o campo `sobrescrito`, que a
Leitura desenha como epígrafe acima do texto e fora da numeração. O achado que
estava em aberto no `estado-cobertura-e-cortes.md` — "não dá para gerar, teria
de vir de fonte NAA licenciada" — está resolvido: o Salmo 3 abre com "Salmo de
Davi, quando ele fugia da presença de seu filho Absalão".

**Módulos novos:** `blivre-texto` (colchetes), `blivre-epigrafes` (a tabela
curada), `blivre-fonte` + `blivre-para-fonte` (VPL → `data/BLIVRE.json`),
`extrair-texto` (recorte compartilhado). Saíram `naa-versificacao`, seu teste e
o `fix-naa`.

**Dois bugs latentes que a re-execução revelou e que ficam consertados:** o ETL
não era re-executável (gravava o catálogo pós-corte no arquivo de onde o
`gerarNovas` lia as perícopes pré-corte), e o `validar-cortes` tinha o mesmo
defeito. Hoje o ETL grava também `data/raw-pericopes-brutas.jsonl` e é
idempotente — rodar duas vezes dá byte a byte o mesmo resultado.

#### O que ficou registrado para as sessões seguintes

- **65 defeitos da fonte corrigidos** (`scripts/blivre-correcoes.ts`), sem
  nenhuma marca na tela. O método é o que importa e vale para a próxima:
  conferir contra **duas testemunhas independentes** — a KJV que já está no
  repo (`data/raw/PericopeGroupedKJVVerses.json`, mesma linhagem Textus
  Receptus) e a **Almeida de 1911** (domínio público, ancestral da BLIVRE).
  Só corrige onde as duas concordam contra a BLIVRE. A comparação derrubou
  dois candidatos que pareciam duplicata e eram português correto.
- **Sl 72** vem "Para SalomãoDeus, dá teus juízos" — sem separador. Entrou como
  exceção com o texto esperado verificado.
- **Para a Sessão 5**: o manifesto de narração vai precisar de uma unidade para
  a seção `sobrescrito`. Hoje a epígrafe já tem `data-fala-id`, mas nenhum
  manifesto a descreve.
- ✅ **A revisão editorial foi feita — pela comparação, não pela leitura.** A
  da Bíblia Livre parou em ~15 livros do NT em 2018; a nossa varreu os 31.102
  versículos comparando comprimento contra as duas testemunhas e produziu 84
  candidatos para ler um a um. Saíram **14 subscrições de escriba** (nota de
  copista colada no último versículo de catorze epístolas, que NÃO é Escritura)
  e voltaram **28 frases omitidas**. Os outros 56 candidatos eram concisão
  legítima, divisão de versículo ou crux de tradução, e ficaram intactos.
- **Branches**: `main` é a V1 (NAA, em produção). Todo este trabalho vive em
  **`v2-biblia-livre`**. Não misturar.

### Sessão 2 — ETL da BLIVRE (escopo original)

- Ingerir a BLIVRE (fonte: releases de `github.com/blivre/BibliaLivre`, formatos
  USFM/VPL; há também JSON por livro em `damarals/biblias`, diretório
  `data/canonical/BLIVRE/`, 66 livros).
- Rodar o ETL com os mesmos limites KJV + cortes, escrever a tabela de
  versificação da BLIVRE no lugar da da NAA, e fechar `auditar-cobertura.ts`
  em 100%.
- **É aqui que se descobre de verdade se o desenho das perícopes encaixa.**
  A expectativa é que encaixe, porque a numeração de referência é a da KJV, mas
  as divergências de versificação precisam ser resolvidas uma a uma.
- Antes de fechar: leitura por amostragem do texto da BLIVRE, dada a ressalva de
  revisão parcial registrada em `docs/licencas.md`.

### Sessão 3 — Material: reenriquecimento total

- Reescrever contexto, resenha, perguntas e tópicos das 2.823 perícopes com
  subagents, no padrão que ficou visivelmente acima do gemini-3.7-flash nas 195
  novas.
- Citações passam a ser da BLIVRE. `scripts/listar-citacoes-suspeitas.ts` vira a
  ferramenta de conferência.
- **Precisa vir depois da Sessão 2**, para os subagents citarem o texto certo.
- Custo em dinheiro: zero. Custo em tempo de máquina: é a maior das sessões.

### Sessão 4 — Spike de TTS (medir, não construir)

Pergunta: dá para narrar melhor e/ou mais barato que o `gpt-audio-mini`/`ash`
com modelo aberto em GPU alugada (HF Inference Endpoints, RunPod)?

Números que já temos para a comparação: o acervo inteiro custa **US$ 48** e ~11h
de parede no `gpt-audio-mini`. Uma GPU do porte de uma 4090/L40S custa US$ 0,35–1,20/h,
e 265h de áudio a 10× tempo real dão ~27h de GPU, ou seja US$ 10–32. **É a mesma
ordem de grandeza, não uma fração** — a economia não justifica o desvio sozinha.

O que justifica o spike:

- O preço do mini é um artefato de cobrança do OpenRouter (cobram o áudio pela
  tabela de texto). Se corrigirem, vai para ~5× e o caminho aberto passa a ganhar.
  Ter o número medido é seguro.
- O custo marginal de **mais uma voz** numa GPU alugada é quase zero; na API é
  outros US$ 48. A `coral` feminina já está aprovada e esperando.

Hipótese central a testar: **Qwen3-TTS com `instruct`**. Já passou no ouvido do
dono (M-L/F-V eleitos), é Apache 2.0, e perdeu só por velocidade no Mac mini —
objeção que uma GPU alugada elimina. E o `generate_custom_voice` aceita `instruct`,
que é justamente a direção por seção que fez o Algieba e o `ash` ganharem, e que
nunca foi testada em volume.

Protocolo: mesma Reflexão 1 e mesma perícope de referência já usadas na página de
audição, régua = `ash`, três eixos (ouvido do dono × US$/1k chars real × horas de
parede). Julgar qualidade no crédito grátis do HF; só depois decidir onde rodar
o volume. **Uma sessão, com resultado numérico.**

### Sessão 5 — Narração completa

Regravar as 2.823 perícopes com o vencedor da Sessão 4, republicar no R2 e
realinhar o realce por palavra.

## Backlog aberto por esta refundação

- Segunda versão do app (a BLT no NT, ou outra) — exigiria seletor de versão,
  shards por versão e chave R2 por versão.
- Os sobrescritos dos Salmos: o achado em aberto de
  `docs/estado-cobertura-e-cortes.md` muda de figura, porque a BLIVRE pode trazê-los
  onde a NAA não trazia. Conferir na Sessão 2.

## Regras da casa (inalteradas)

- Fluxo superpowers: brainstorm → spec → plano → execução.
- TDD nos módulos com infra de teste; commits pequenos e frequentes, em pt-BR.
- Segredos nunca via shell do Claude — o dono grava em terminal próprio.
- Textos de UI em pt-BR.
