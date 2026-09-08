# Kickoff — Sessão 4: spike de TTS aberto em GPU alugada

> **Prompt para abrir a sessão nova:**
> *"Leia `docs/kickoff-sessao-4-tts.md` e toque a Sessão 4. É um spike: o
> resultado é um número por candidato e uma decisão, não código para manter."*

Roda **em paralelo** com a Sessão 3 (reenriquecimento), que está sendo tocada
noutra sessão. Ver a divisão de território no fim deste arquivo.

## A pergunta

Dá para narrar o acervo **melhor e/ou mais barato** que o `openai/gpt-audio-mini`
na voz `ash`, usando modelo aberto em GPU alugada (Hugging Face Inference
Endpoints, RunPod)?

## A resposta honesta antes de começar: a economia sozinha NÃO justifica

Não vá para esta sessão esperando economizar muito. Os números do acervo:

| | |
|---|---|
| chars narrados | ~9,1 milhões |
| áudio resultante | ~265 h |
| custo no `gpt-audio-mini`/`ash` (US$ 0,0053/1k) | **~US$ 48** |
| tempo de parede na API | ~11 h |

Do outro lado, uma GPU do porte de RTX 4090 / L40S custa na faixa de
**US$ 0,35–1,20/h**. Para produzir 265 h de áudio a 10× tempo real são ~27 h de
GPU: **US$ 10–32**. É a mesma ordem de grandeza, não uma fração. Dias de
engenharia para disputar algumas dezenas de dólares.

**O que justifica o spike mesmo assim** — e é isto que a sessão precisa medir:

1. **O preço do mini é um artefato de cobrança do OpenRouter.** Eles cobram o
   áudio pela tabela de TEXTO (US$ 2,40/M tokens de saída). Se corrigirem para a
   tabela de áudio da OpenAI, o custo multiplica e o caminho aberto passa a
   ganhar de lavada. Ter o número medido é seguro, não economia.
2. **O custo marginal de MAIS UMA VOZ.** Na API são outros US$ 48 por voz. Numa
   GPU já ligada, é quase zero. A voz feminina `coral` já está aprovada e
   esperando, e o dono pode querer outras.
3. **Qualidade.** Se algum modelo aberto dirigido superar o `ash` no ouvido do
   dono, o custo vira detalhe.

## A hipótese central a testar

**Qwen3-TTS 1.7B (Apache 2.0) com `instruct`.**

Por que essa e não outra: ela **já passou no ouvido do dono** — as vozes M-L e
F-V foram eleitas por ele em rodadas de VoiceDesign. O único motivo de ter
perdido foi **velocidade no Mac mini** (1,5× a 13× mais lento que tempo real em
MPS), e uma GPU alugada apaga exatamente essa objeção.

E tem um detalhe nunca testado em volume: a API `generate_custom_voice` do
Qwen3 **aceita `instruct`** — ou seja, aceita a direção por seção, que é
precisamente o que fez o Algieba e o `ash` ganharem. O que reprovou o clone do
Fish foi entonação achatada; o clone stateless não aceita direção. Com
`instruct`, essa objeção também cai.

Candidatos secundários, se sobrar fôlego: Chatterbox Multilingual (MIT, pt),
F5-TTS com checkpoint pt-BR, CosyVoice2, IndexTTS-2. **Não perca tempo com
Kokoro e XTTS-v2** — os dois já foram reprovados pelo dono.

## A régua e o corpus de teste — use EXATAMENTE estes

Tudo em `/Volumes/SSD 2TB SD/dev/tts-spike/`.

- **Régua masculina:** `amostras/gam_refl1_ash.mp3` — a Reflexão 1 no
  `gpt-audio-mini` voz `ash`, que é o narrador em produção hoje.
- **Régua histórica:** `amostras/or_pericope_kore.m4a` (Gemini) e
  `amostras/g31_1600_algieba.m4a`.
- **Perícope completa padrão:** ordem **1600** — a Genealogia de Jesus, 3.240
  chars, 28 unidades. É a prova de fogo, porque tem genealogia (nomes próprios
  em série), pergunta e fechamento. Comparáveis já gerados:
  `amostras/gptaudio_mini_cedar_1600.m4a` e `g31_1600_algieba.m4a`.
- **Referências de voz do Qwen já eleitas:** `amostras/qwen_vd4_m_l.wav`
  (masculina) e `amostras/qwen_vd7_f_v.wav` (feminina).
- **Página de audição:** `amostras/audicao.html`.

## O que JÁ SE SABE — não redescubra

Isto custou semanas. Está tudo em `tts-spike/` e na memória do projeto:

- **A direção vai em inglês**, prefixada ao input, e termina com *"Read only the
  text below, nothing else:"*. A receita por seção está em `gera_lote_gam.py`,
  constante `DIRECAO` — título solene, contexto de professor, texto bíblico
  reverente e pausado, resenha interpretando junto, reflexões genuinamente
  indagadoras. **Take seco é "terrível"** nas palavras do dono: sempre com direção.
- **A palavra "Portuguese" no instruct puxa Portugal.** Use âncora regional
  ("São Paulo, Brazil") e nunca escreva "Portuguese".
- **Direção intimista (smooth/velvety/late-night) gera voz soprosa.** Peça
  "firm chest voice, never breathy".
- **bfloat16** venceu float32 em teste cego; float16 perdeu claro. float32
  afogava o Mac mini — nunca mais.
- **MPS: um modelo Qwen3 por processo.** Carregar o segundo no mesmo processo dá OOM.
- **Deriva de timbre em unidades longas (~15s+)** no clone: se aparecer, quebre
  as unidades longas em frases.
- **Checagem de verbatim automática**: os modelos de chat com áudio devolvem
  `transcript` no stream, e dá para comparar com a entrada por `difflib`
  (limiar 0,90, com retry). 28/28 unidades em 1,00. Ver `gera_gptaudio_pericope.py`.
- **Paralelismo medido** (Mac mini M-, 10 CPUs, 16 GB): a API satura em ~32
  chamadas simultâneas; o **alinhamento** é o gargalo real e o teto é a RAM —
  5 processos é o máximo, 3 rende melhor por processo.

## O protocolo

1. **Comece de graça.** O crédito grátis da Hugging Face serve para *julgar
   qualidade*, não para produzir 265 h. Gere a **Reflexão 1** nos candidatos e
   compare com `gam_refl1_ash.mp3` na página de audição. Se nenhum passar no
   ouvido do dono, **a sessão acaba aqui** e o `ash` fica — esse é um resultado
   legítimo e barato.
2. **Quem passar, faz a perícope 1600 inteira**, com a direção por seção.
   É onde a entonação achatada aparece (foi assim que o clone do Fish caiu).
3. **Meça os três eixos, para cada sobrevivente:**
   - **qualidade** — veredito do dono, contra a régua;
   - **US$/1k chars reais** — incluindo o tempo de GPU ociosa entre chamadas;
   - **RTF (fator de tempo real)** e horas de parede projetadas para o acervo.
4. **Confira o preço da hora e o modelo de cobrança na própria página do
   provedor** antes de projetar qualquer coisa. Os valores deste documento são
   ordem de grandeza de setembro/2026, não cotação.

## Como decidir

| resultado | decisão |
|---|---|
| Nenhum candidato passa no ouvido | Fica o `ash`. Sessão encerrada, barato. |
| Passa mas custa igual ou mais | Fica o `ash`; registra o número como seguro contra o OpenRouter corrigir a tabela. |
| Passa e é claramente mais barato | Vale montar o pipeline na Sessão 5. |
| **Passa e soa melhor** | Ganha, mesmo custando mais. A barra de qualidade é inegociável. |

## Território — o que NÃO tocar

A Sessão 3 está mexendo no repo `biblia-pericopes` ao mesmo tempo. Para não
colidir:

- **Trabalhe em `../tts-spike/`**, que é descartável e fora do repo.
- **Não toque** em `scripts/`, `src/`, `worker/` nem em `data/pericopes.json`
  do repo — é tudo território da Sessão 3.
- Se precisar commitar algo no repo, restrinja-se a este arquivo e a um
  documento de resultados novo em `docs/`.

⚠️ **Os dados mudaram e os scripts do spike ainda não sabem.** O campo
`texto_naa` virou **`texto`**, existe um campo novo **`sobrescrito`** (120
perícopes), e o texto agora é a **Bíblia Livre**, não a NAA. Scripts como
`gera_lote_gam.py` e `conserta_unidades.py` leem o formato antigo — adapte antes
de reusar. Ver `docs/refundacao-blivre.md`.

E o principal: **a narração inteira que existe hoje vai ser descartada** (é
leitura da NAA, obra derivada). Não invista em conferir, alinhar ou reparar o
acervo atual — ele sai fora na Sessão 1.
