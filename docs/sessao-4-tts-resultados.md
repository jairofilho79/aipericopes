# Sessão 4 — resultados do spike de TTS aberto

Documento vivo. Registra o que já foi **medido**; o veredito de qualidade fica
em aberto até o dono ouvir. Protocolo e critérios em
[`kickoff-sessao-4-tts.md`](kickoff-sessao-4-tts.md).

## 1. O número-seguro: o mini está sendo subcobrado em 5,68×

Era a razão nº 1 do spike, e agora é fato medido, não suspeita.

Conferido em 2026-09-04 no `/api/v1/models` do OpenRouter e na tabela publicada
da OpenAI (`developers.openai.com/api/docs/pricing`):

| US$/M tokens | texto in | texto out | **áudio out** |
|---|---|---|---|
| `gpt-audio-mini` — OpenRouter cobra | 0,60 | 2,40 | **2,40** |
| `gpt-audio-mini` — OpenAI publica | 0,60 | 2,40 | **20,00** |
| `gpt-audio` (grande) — ambos | 2,50 | 10,00 | 64,00 |

O grande está certo; **no mini o áudio está saindo pela tabela de texto**. Não é
desconto, é a mesma linha repetida.

Recontado com os tokens reais da perícope 1600 (lidos dos manifests de
`amostras/gptaudio_parts/`, não estimados — o cálculo reproduz na vírgula os
US$ 0,0173 e os US$ 0,4074 já cobrados, o que valida a decomposição):

| | hoje | se corrigirem |
|---|---|---|
| por 1k chars | US$ 0,00534 | US$ 0,03030 |
| **acervo** (8,87M chars) | **US$ 47** | **US$ 269** |
| NT (2,84M chars) | US$ 15 | US$ 86 |

Reprodutível em `tts-spike/preco_seguro.py`.

**Consequência prática:** enquanto a tabela estiver errada, nenhum caminho aberto
compete com US$ 47 — a economia não paga a engenharia, exatamente como o kickoff
antecipou. No dia em que corrigirem, a conta vira US$ 269 e o caminho aberto
passa a ganhar por 5–25×. É por isso que o spike vale como **seguro**.

## 2. A hipótese central rodou — e de graça, sem GPU nenhuma

O kickoff supunha que testar Qwen3-TTS exigiria GPU alugada. Não exigiu: o
checkpoint **CustomVoice** (o único que aceita `instruct`) já estava em cache
local, e a Reflexão 1 saiu no Mac mini em MPS.

**Rodada 12** (`tts-spike/gera_qwen_cvi12.py`), bfloat16, sem flash-attn:

| take | fala | parede | RTF | ch/s |
|---|---|---|---|---|
| `cvi12_ryan_dir` — Ryan + direção "reflexões" | 16,3s | 26s | **1,56×** | 11,5 |
| `cvi12_ryan_seco` — Ryan sem instruct (controle) | 14,6s | 22s | 1,50× | 12,8 |
| `cvi12_serena_dir` — Serena + direção | 13,9s | 21s | 1,49× | 13,4 |

### ❌ Veredito: reprovado, e por um defeito novo

"Não chega perto" — e o motivo não foi entonação, foi **verbatim**: o modelo leu
*"Refleção"* no lugar de "Reflexão", e o número **"1"** ora virava "uma", ora
sumia. Não é falta de direção, é falta de leitura correta do português.

Isso muda o critério de escolha da sessão. O `gpt-audio-mini` devolve o
`transcript` no stream, o que deixa **conferir verbatim de graça** (difflib,
limiar 0,90, retry — 28/28 em 1,00). Nenhum TTS puro devolve transcript: com
modelo aberto, ou o modelo lê certo por conta própria, ou entra um ASR no
pipeline só para pegar o "Refleção". **Esse custo não estava na conta.**

Registrado também: dois sinais que continuam valendo, apesar da reprovação.

- **RTF 1,5×**, não os 3–13× temidos. A objeção de velocidade que derrubou o
  Qwen na Sessão anterior era do float32; em bfloat16 ela encolheu muito.
- **O take dirigido ficou 12% mais longo que o seco** — o mesmo padrão do
  Algieba (direção alonga). Indício de que o `instruct` está de fato pegando no
  CustomVoice, que é precisamente o que o clone stateless do Fish não fazia.

Receita aplicada com todos os antídotos já pagos: direção em inglês, âncora
"São Paulo, Brazil" e **a palavra "Portuguese" jamais no instruct**, "firm chest
voice, never breathy", e a direção de seção "reflexões" idêntica à do lote em
produção.

## 3. O catálogo do Hugging Face, estudado (2026-09-04)

Levantamento pedido pelo dono depois da reprovação do Qwen. Filtrado pelo que
este projeto exige: **português do Brasil de verdade**, **direção em linguagem
natural** (o que derrubou o clone do Fish foi não aceitar direção) e **licença**
— um app refundado por causa de direitos autorais não vai se prender a uma
licença ruim de novo.

| modelo | tam. | licença | pt-BR | aceita direção? | RTF publicado |
|---|---|---|---|---|---|
| **openbmb/VoxCPM2** | 2B | **Apache-2.0** ✅ comercial | 30 idiomas, pt incluído | ✅ descrição entre parênteses no início do texto (`(slightly faster, cheerful tone)`) + clonagem controlada | **0,30 numa RTX 4090**; 0,13 com Nano-vLLM |
| bosonai/higgs-tts-3-4b | 4B | pesquisa / não-comercial (com "Creator Use Grant") | 🇧🇷 explícito, WER/CER < 5 | ⚠️ só tags estruturadas (`<\|style:whispering\|>`), não texto livre | 0,217 em H100, 8 simultâneas |
| fishaudio/s2-pro | 5B | Fish Research (não-comercial) | pt em "Tier 2" | ✅ tags em linguagem natural (`[professional broadcast tone]`), 15 mil tags | 0,195 em H200 |
| k2-fsa/OmniVoice | 0.6B | código Apache, **pesos CC-BY-NC** | 600+ idiomas, pt sem destaque | ⚠️ só atributos (gênero, idade, sotaque) | **0,025 — 40× tempo real** |
| mistralai/Voxtral-4B-TTS | 4B | CC BY-NC | pt entre 9 idiomas | ❌ 20 vozes fixas | — |
| BreezeBlue/Breeze-TTS-2 | 3B | pesquisa / não-comercial | ❌ só EN/ZH | ✅ | 0,32 em H100 |

Três achados que valem mais que a tabela:

1. **Não existe TTS de 18B.** O maior modelo bom hoje tem **5B** (Fish S2-Pro).
   O que aparece como 18B no Hub é filtro de tamanho sobre modelos em geral, não
   TTS. E tamanho não é o gargalo aqui — o Qwen de 1,7B errou por dados de
   português, não por falta de parâmetros.
2. **A safra boa de 2026 é quase toda não-comercial.** Higgs, Fish, Voxtral,
   Breeze e os pesos do OmniVoice: todos com restrição. As licenças realmente
   livres (Apache/MIT) são justamente as já reprovadas — Qwen3-TTS, Kokoro,
   Chatterbox — **com uma exceção: o VoxCPM2, Apache-2.0 e livre para comercial.**
3. **Serverless no HF não serve.** Só 7 modelos de TTS estão nos *Inference
   Providers* (Kokoro, Chatterbox, CSM-1B, Zonos) e nenhum é candidato. Para os
   bons, ou é Space com ZeroGPU, ou é GPU dedicada por hora.

### O "hardware de graça" do HF, medido

| via | o que dá | serve para |
|---|---|---|
| ZeroGPU, conta grátis | **3,5 min/dia** de H200 (210s) | julgar qualidade, nada além |
| ZeroGPU, PRO US$ 9/mês | 25 min/dia de H200 (~12,5 h/mês) | uma fatia do acervo por mês |
| ZeroGPU acima da cota | US$ 1 / 10 min = **US$ 6/h** de H200 | caro por hora, mas H200 é rápida |
| Inference Endpoints (GPU dedicada) | L4 US$ 0,80/h · L40S US$ 1,80/h · H100 US$ 4,50/h | produção, mas 2,4× o preço do RunPod |

Ou seja: **de graça o HF só dá para ouvir**, não para produzir 200 h de áudio.
Para produzir, o HF é a opção *cara* de alugar — a mesma classe de GPU sai bem
menos no RunPod.

## 4. Rodada 13 — VoxCPM2 testado, de graça, no Mac

O card só cita CUDA, mas o repositório é explícito: `--device auto` usa **MPS no
Apple Silicon**. Não foi preciso alugar nada nem ter token do HF.

`tts-spike/gera_vox13.py`, MPS (a lib força float32 no MPS), 5 takes:

| take | fala | parede | RTF |
|---|---|---|---|
| `vox13_m_dir` — masc + direção | 14,2s | 28s | 1,93× |
| `vox13_m_seed2` — mesma receita, outro timbre | 15,4s | 29s | 1,86× |
| `vox13_m_norm` — com `normalize=True` | 11,8s | 28s | 2,35× |
| `vox13_m_seco` — controle sem direção | 12,0s | 22s | 1,87× |
| `vox13_f_dir` — feminina + direção | 12,6s | 29s | 2,29× |

O RTF publicado numa RTX 4090 é **0,30** — cerca de 6× o que sai aqui, o que bate
com float32 forçado no MPS contra bfloat16 em CUDA.

### O teste de verbatim, com controle positivo e negativo

Como o defeito que matou o Qwen era de leitura, dá para medi-lo antes do ouvido.
`tts-spike/confere_verbatim.py` transcreve com Whisper e compara por difflib —
a mesma régua do lote em produção. `ash` como controle positivo, Qwen como
negativo:

| amostra | difflib | o que o ASR ouviu |
|---|---|---|
| `ash` (régua) | 1,000 | "Reflexão **1**. Mateus incluiu…" ✅ |
| qwen ryan dirigido | 0,992 | "**Reflexão.** Matheus incluiu…" ← **o "1" sumiu** |
| qwen ryan seco | 0,995 | "Reflexão, Mateus. Incluiu…" ← frase quebrada |
| **voxcpm2** (5 takes) | **0,997–1,000** | "Reflexão **1**. Mateus incluiu…" nos cinco |

Dois achados, e o segundo vale para o pipeline que já está no ar:

1. **O VoxCPM2 acerta o que o Qwen errou.** O "1" de "Reflexão 1" aparece inteiro
   nos cinco takes, inclusive no seco.
2. ⚠️ **A guarda de verbatim atual não pegaria esse defeito.** O take reprovado
   pelo dono marcou **0,992** — bem acima do limiar de 0,90. Um dígito perdido em
   190 caracteres quase não move o difflib. O limiar foi calibrado para falha
   grossa (o modelo de chat respondendo em vez de ler), não para omissão fina.
   **Vale endurecer a checagem no lote atual**: exigir que números e a contagem de
   palavras batam, não só a similaridade global.

E um limite honesto do método: o Whisper é modelo de linguagem e corrige grafia —
transcreveu "Reflexão" mesmo onde o dono ouviu "Refleção". **O que o ASR acusa é
defeito real; o silêncio dele não é atestado.** Sotaque e entonação seguem sendo
do ouvido.

## 5. VoxCPM2 aprovado no ouvido — e o que custa produzir em casa

Veredito do dono na rodada 13: **"fantástico… não esperava essa qualidade de fala
natural"**. A partir daqui o alvo mudou de "algum aberto serve?" para "como
produzir o acervo sem gastar".

### Desempenho medido (Mac mini M4, 10 núcleos, 16 GB)

`tts-spike/sonda_perf_vox.py` — o mesmo take dez vezes seguidas:

| | |
|---|---|
| RTF em regime | **1,86–1,95×** — estável, sem degradar |
| memória do driver MPS | **11,6 GB**, constante |
| carga do modelo | 82–118 s, uma vez por processo |
| determinismo | ✅ com semente fixa, 14,1 s de fala idênticos nas dez |

Duas coisas ficaram claras aqui:

- **A piora de RTF vista na rodada 14 (1,89× → 4,29×) era carga externa**, não o
  modelo. `empty_cache()` não muda nada; a sonda isolada não degrada. Como há
  outra sessão trabalhando nesta máquina, isso era disputa por CPU.
- **Determinismo com semente fixa** significa que uma queda no meio da noite
  retoma sem gerar áudio diferente do que já saiu.

### ❌ Não dá para paralelizar nesta máquina

11,6 GB de 16 GB por processo: não cabe um segundo. E não dá para encolher —
`voxcpm/model/utils.py` força float32 no MPS de propósito, porque bfloat16 e
float16 "produzem deriva numérica suficiente no laço da difusão para a saída sair
com glitch e o detector de badcase entrar em retry infinito". Há um escape
(`VOXCPM_MPS_DTYPE`), mas é justamente o caminho que este projeto já reprovou em
teste cego.

O único acelerador de graça é `inference_timesteps` (`tts-spike/sonda_timesteps.py`):

| passos | RTF | verbatim | acervo |
|---|---|---|---|
| 4 | **1,31×** | 1,000 ✅ | **~28 madrugadas de 8 h** |
| 6 | 1,78× | 1,000 ✅ | ~38 |
| 8 | 1,72× | 1,000 ✅ | ~38 |
| 10 (padrão) | 1,91× | 0,997 ✅ | ~41 |
| 16 | 2,54× | **0,104 ❌** | — |

⚠️ **Com 16 passos o áudio quebra** — o Whisper só conseguiu ouvir "Reflexão 1"
em 14 s de fala. Mais passos não é melhor. (E note: essa falha *grossa* o difflib
pegou com folga, ao contrário das omissões finas da seção 4 — é a confirmação de
que o limiar de 0,90 serve para desastre, não para dígito perdido.)

### A conta da produção em casa

Acervo: 8,867,063 chars a ~14,2 chars/s de fala = **~174 h de áudio por voz**.

| | com `ts=10` | com `ts=4` |
|---|---|---|
| segundos de máquina por segundo de áudio | 1,91 | **1,31** |
| por perícope média (3.350 chars) | 7,5 min | **5,2 min** |
| perícopes por madrugada de 8 h | 64 | **93** |
| acervo inteiro | 331 h → **41 madrugadas** | 227 h → **28 madrugadas** |
| rodando 24/7 | 14 dias | **9,5 dias** |

**Custo: US$ 0.** Contra US$ 47 na API hoje (US$ 269 se corrigirem a tabela).

Duas ressalvas honestas:

- **A máquina fica inutilizável enquanto gera** — 11,6 GB dos 16 GB. Por isso
  madrugada, e por isso a conta é em madrugadas e não em dias.
- **O alinhamento ainda tem que rodar** (o realce por palavra já depende dele).
  Ele não cabe junto com a geração; entra depois, e leva algumas horas com 3
  processos. **Bônus:** o alinhamento forçado é exatamente um detector de
  verbatim — palavra que não alinha é palavra que não foi dita. Ou seja, o ASR
  que eu tinha listado como "custo escondido" do caminho aberto **já existe no
  pipeline** e sai de graça.

Para referência, não como proposta: alugar uma RTX 4090 faria as mesmas ~174 h em
~2,2 dias por **US$ 18**. O dono foi explícito em preferir não gastar.

## 6. Como pedir uma voz grave ao VoxCPM2 (medido, não adivinhado)

O dono ouviu a rodada 14 e notou que **só uma das cinco** saiu realmente grave —
as outras deram o mesmo timbre, e uma soou "falando triste, cabisbaixo". Em vez
de continuar caçando no ouvido, dá para medir: **"grave" é frequência
fundamental**, e F0 se mede com `tts-spike/mede_timbre.py` (librosa/pyin).

O resultado explica tudo de uma vez:

| receita | F0 mediana |
|---|---|
| `ash` — **a régua em produção** | **111 Hz** |
| g3 "low bass register, dark timbre" | 112,6 Hz ✅ |
| g1 "very deep bass-baritone" | 193,8 Hz ❌ |
| g4 "a receita boa + grave marcado" | 218,8 Hz ❌ |
| g2 "veteran radio announcer, deep and grave" | 221,4 Hz ❌ |

As quatro receitas reprovadas estavam **quase uma oitava acima** da aprovada.

### A regra que saiu disso

1. **Vocabulário de registro percebido funciona**: *"low bass register"*,
   *"dark timbre"*, *"thick low end"*, microfone de estúdio de diafragma grande.
2. **Vocabulário de intensidade não funciona**: *"deep"*, *"bass-baritone"*,
   *"veteran radio announcer"* não moveram um Hz.
3. **Vocabulário técnico é o pior de todos**: *"low fundamental frequency"* deu
   **215,7 Hz** — o modelo entende descrição perceptual, não medida física.
4. ⚠️ **"grave", "weighty" e "solemn" em inglês são PESO EMOCIONAL, não altura.**
   Foi o que produziu a leitura triste e cabisbaixa: o modelo obedeceu a
   instrução certa com o sentido errado. **Nunca usar essas palavras para pedir
   voz grave** — só termos de registro.
5. **A semente ainda sorteia ±60 Hz** com a receita certa (a mesma g3 deu 102,
   124 e 161 Hz em três sementes). A receita move a distribuição para baixo; o
   sorteio decide onde dentro dela.

### O garimpo virou filtro — e mostrou que filtrar não basta

`tts-spike/garimpa_grave.py` varreu **16 sementes** (8 por receita) medindo a F0
de cada uma. Resultado cru: **só 2 ficaram abaixo dos 111 Hz da régua**, e as
duas são a mesma semente 42 — as outras 14 espalharam entre 123 e 213 Hz.

Isso obriga a corrigir o item 5 acima: **a semente pesa mais que a receita.**
Dentro de uma mesma semente a redação faz diferença enorme (102 Hz do g3/h4
contra 194–221 Hz do g1/g2/g4), mas varrer sementes com a receita boa ainda é
loteria de ~12% de acerto. Caçar mais fundo é desperdício.

A saída é **congelar**: pegar a voz de 102,7 Hz que já existe e cloná-la. O
VoxCPM2 clona a partir de um wav de referência e — diferente do clone stateless
do Fish, que achatou a prosódia e foi reprovado duas vezes neste projeto — a
clonagem dele **aceita direção de estilo** ("controllable cloning"). Se isso se
confirmar, resolve os dois problemas de uma vez: timbre estável e direção por
seção. Testado em `tts-spike/gera_vox18_clone.py`.

### ✅ A clonagem congelou o timbre — e a direção sobreviveu

`tts-spike/gera_vox18_clone.py`, clonando de `vox17_g3_s42.wav` (102,7 Hz):

| take | F0 | nível | verbatim |
|---|---|---|---|
| clone + direção "reflexões" | **101,5 Hz** | −16,4 dB | 1,000 ✅ |
| clone **sem** direção (controle) | 107,5 Hz | −18,8 dB | 1,000 ✅ |
| clone + direção "texto bíblico" (genealogia) | 104,5 Hz | −15,5 dB | 0,957 ⚠️ |
| clone modo `prompt` (wav + transcrição) | 101,5 Hz | −19,4 dB | **0,240 ❌** |

**Os quatro ficaram abaixo dos 111 Hz da régua** — contra 2 em 16 no sorteio de
sementes. O timbre está resolvido: congela-se a referência e acabou a loteria.

E a direção continua pegando: o take dirigido saiu **17% mais longo** que o seco
(14,4 s contra 12,3 s), a mesma assinatura de "direção alonga" já vista no
Algieba e na rodada 12. Diferente do clone stateless do Fish, que ignorava.

Três armadilhas achadas de graça, todas pelo teste automático:

1. 🚨 **O modo `prompt_wav_path` + `prompt_text` NÃO consome a direção — ele LÊ a
   direção em voz alta, traduzida.** O take saiu dizendo "perguntando com
   curiosidade genuína, verdadeiramente inquisitiva…". **Usar só
   `reference_wav_path`.** (Aqui o difflib pegou com folga: 0,240. É o tipo de
   desastre para o qual o limiar de 0,90 foi feito.)
2. ⚠️ **Genealogia é o caso duro**: "Isaque" saiu "Isaac" e alguns "e" caíram
   (0,957). Passa no limiar, mas confirma que a seção de texto bíblico precisa do
   guarda de alinhamento.
3. ⚠️ **O clone dirigido sobe o nível**: −16 dB contra os −24,5 dB do `ash`, quase
   9 dB mais quente. Se for só nível, normaliza-se no pós (`loudnorm`); se for
   esforço vocal, não. Pende do ouvido do dono.

#### Como o filtro fica útil, mesmo assim

Como (a) a F0 se mede e (b) a geração é determinística por semente, não é preciso
julgar no escuro: `tts-spike/garimpa_grave.py` varre N sementes da receita boa,
mede cada uma e **só leva ao ouvido do dono as que ficam abaixo dos 111 Hz da
régua**. A voz escolhida fica congelada pela semente e sai idêntica na produção
inteira, sem custo nenhum.

Também aprovado nesta rodada: o **termo "interpretativo"** no A/B da rodada 14
("interpretando junto com o ouvinte, sentindo o sentido enquanto lê") — entra na
receita definitiva. E `ts=10` fica mantido.

Contra a "gritada" que o dono notou na voz grave: o nível medido ajuda a
enxergar. O `ash` roda a −24,5 dB RMS; o g3 a −20,6 dB, quase 4 dB mais quente. A
redação de microfone de estúdio (`h4`) desce para −22,1 dB mantendo os mesmos
102 Hz — é a candidata que junta grave e contido.

## 7. Cotações reais de GPU (RunPod, 2026-09-04)

Conferidas na página do provedor, como manda o passo 4 do protocolo:

| GPU | Community | Secure |
|---|---|---|
| RTX A5000 24GB | US$ 0,16/h | US$ 0,27/h |
| RTX A6000 48GB | US$ 0,33/h | US$ 0,53/h |
| **RTX 4090 24GB** | **US$ 0,34/h** | US$ 0,74/h |
| L40S 48GB | US$ 0,79/h | US$ 0,99/h |

## 8. A conta do caminho aberto, com os números de hoje

Base: o acervo dá **~200 h de áudio** por voz (8,87M chars no ritmo medido de
11–13 chars/s de fala). Preço de GPU: RTX 4090 no RunPod Community, US$ 0,34/h.

| caminho | RTF | horas de GPU | **custo/voz** |
|---|---|---|---|
| VoxCPM2 (Apache-2.0) | 0,30 publicado na própria 4090 | 60 h | **US$ 20** |
| VoxCPM2 com Nano-vLLM | 0,13 | 26 h | **US$ 9** |
| OmniVoice (NC, sem direção) | 0,025 | 5 h | US$ 2 |
| `gpt-audio-mini` / `ash` — **hoje** | — | — | **US$ 47** |
| `gpt-audio-mini` / `ash` — corrigido | — | — | **US$ 269** |

Duas ressalvas honestas, para a conta não mentir:

- **O RTF é publicado, não medido por nós.** Some tempo de GPU ociosa entre
  chamadas, carga do modelo e retomadas; na prática conte 1,5× a mais.
- **Falta o ASR.** Sem o `transcript` de graça do gpt-audio, pegar o "Refleção"
  exige passar 200 h de áudio por um Whisper — mais algumas horas da mesma GPU
  (~US$ 5–10) e mais um pedaço de pipeline.

Mesmo somando tudo: **US$ 25–40 por voz contra US$ 47**, e a **segunda voz custa
o mesmo** em vez de outros US$ 48. A economia na primeira voz é magra, como o
kickoff já avisava. Ela só fica interessante em dois cenários: quando o
OpenRouter corrigir a tabela, ou quando o dono quiser 3–4 vozes.

## 9. Veredito final da Sessão 4

**Fica o `ash`.** O dono vai carregar créditos e narrar o acervo inteiro em
`openai/gpt-audio-mini` voz `ash`, por ~US$ 47.

O VoxCPM2 chegou perto — **"nota 7,5: dá para aceitar, mas não enche os olhos"** —
e o diagnóstico é que **o teto é da categoria, não do modelo**. Um TTS com
condicionamento de estilo *pinta* um estilo sobre a leitura; um modelo de chat com
áudio *atua* o texto, porque entende o que está lendo. É por isso que o `ash`
responde a "faça uma pergunta genuinamente indagadora" de um jeito que um TTS não
responde: ele sabe o que é uma pergunta.

E há evidência de que isso é padrão, não acaso: **é a segunda vez que este projeto
bate na mesma parede.** O clone M-L no Fish caiu com a queixa quase idêntica
("ficou pobre de interpretação… faz total diferença ter um narrador sentindo a
leitura junto com você"). Dois modelos abertos independentes, o mesmo limite.

### O que a sessão entrega

| entrega | valor |
|---|---|
| **Número-seguro medido** | acervo US$ 47 hoje → **US$ 269** se o OpenRouter corrigir (fator 5,68×), e a metadata mostra que o erro está isolado no mini — o `gpt-audio` grande, mesma modality, é cobrado certo |
| **Catálogo aberto mapeado** | VoxCPM2 é o único de licença livre e chega a 7,5; Higgs TTS 3 e Fish S2-Pro seguem não testados (precisam de GPU, ~US$ 10–30 pelo acervo, licença não-comercial) |
| **Método de voz por medição** | F0, nível e verbatim viraram números — ver seção 6 |
| **Um defeito achado no lote em produção** | o limiar de verbatim 0,90 não pega omissão fina (o take reprovado marcou 0,992) — vale endurecer |
| **Gasto da sessão** | **US$ 0** |

### Pendências que saem daqui

1. **Endurecer a checagem de verbatim do lote do `ash`**: exigir que números e
   contagem de palavras batam, não só a similaridade global. Território da outra
   sessão, mas o defeito é real e está medido na seção 4.
2. **Trilha sonora** → [`kickoff-sessao-5-trilhas.md`](kickoff-sessao-5-trilhas.md).
3. **Higgs TTS 3** fica registrado como a única pedra não virada, caso o preço do
   `ash` mude ou o dono queira 3+ vozes.

## ~~9. Estado das decisões~~ · SUPERADA

> **Atenção, e leia isto antes das duas seções abaixo.** Elas foram escritas
> ANTES da seção "9. Veredito final da Sessão 4" e ficaram depois dela no arquivo
> por acidente de edição — daí o `## 9` aparecer duas vezes. Estão erradas hoje: a
> tabela diz que o VoxCPM2 é "⏳ não testado — próximo passo", e ele foi testado
> nesta mesma sessão (aprovado no ouvido, nota final 7,5), e o próximo passo que
> elas propõem nunca foi executado nem precisa ser. **A fonte de verdade sobre o
> estado da sessão é a seção 9 "Veredito final", e o narrador decidido é o `ash`.**
> Ficam aqui como registro do que se pensava no meio do caminho, não como plano.


| eixo | situação |
|---|---|
| Qwen3-TTS 1.7B | ❌ **reprovado** — erra o verbatim em português ("Refleção", número sumido) |
| custo hoje no `ash` | ✅ medido: US$ 47 — nenhum caminho aberto compete com folga |
| custo se corrigirem | ✅ medido: US$ 269 — aí o aberto ganha por 7–10× |
| catálogo do HF | ✅ estudado — **VoxCPM2 é o único candidato de licença livre** |
| hardware grátis do HF | ✅ medido: 3,5 min/dia — dá para ouvir, não para produzir |
| qualidade do VoxCPM2 | ⏳ **não testado** — próximo passo |

**Nada foi gasto nesta sessão.**

## ~~10. Próximo passo proposto~~ · SUPERADA (ver o aviso acima)

Alugar **uma hora de RTX 4090 (US$ 0,34)** e, nela, rodar a Reflexão 1 e depois a
perícope 1600 nos três candidatos que aceitam direção — **VoxCPM2**, **Fish
S2-Pro** e **Higgs TTS 3**. Uma hora resolve os dois eixos de uma vez: sai o
veredito do ouvido *e* sai o RTF medido na GPU exata que seria usada em produção.

É mais barato e mais rápido que o ZeroGPU (3,5 min/dia não dão nem a perícope
inteira) e não exige assinar o PRO. Pré-requisito: uma conta no RunPod e um
**token do Hugging Face** (nem existe token configurado nesta máquina hoje).

## Fecho da pendência técnica (08/09/2026)

A lista de pendências desta sessão abria com **"endurecer a checagem de verbatim do
lote em produção — exigir números e contagem de palavras, não só similaridade
global"**. Fechada, com o defeito medido no acervo inteiro.

**O que estava errado.** `gera_lote_gam.py` já calculava `numeros_ok` e o gravava
nas 80.081 unidades — e **nunca o consultava**. O único gatilho de refazer era
`sim < LIMIAR_VERBATIM`. Número que some não move a similaridade global: o `1` de
"Reflexão 1" vale um caractere em cem, e a nota fica em 0,99. Era exatamente o
caso que a Sessão 4 tinha descoberto e anotado, e que continuava passando.

**E a própria checagem estava quebrada.** A docstring dizia "todo número da
entrada aparece no transcrito", mas o código exigia os dois conjuntos IGUAIS:

    return sorted(re.findall(r"\d+", entrada)) == sorted(re.findall(r"\d+", transcrito))

Número **a mais** no transcrito reprovava. Foi o que aconteceu na única unidade do
acervo marcada com número errado — 2218/u21, nota 0,98:

    escrito  Reflexão 1. … qual dos dois você parece ser diante de Deus?
    falado   Reflexão 1. … qual dos 2 você parece ser diante de Deus?

O narrador disse "dois"; quem grafou em dígito foi o transcrito. O áudio estava
intacto. **Um alarme falso em 80.081, e era o único achado da checagem.**

**O conserto.** `num_ok` passou a ser contenção e não igualdade (`Counter(entrada)
- Counter(transcrito)` vazio), e virou gatilho de refazer POR SI, ao lado do
limiar. A checagem nova é mais frouxa que a velha em exatamente um ponto — dígito
a mais no transcrito —, então nenhuma unidade já aprovada passa a reprovar: o
acervo fica com zero números faltando. O campo de 2218/u21 foi corrigido no
manifesto e republicado, para o alarme falso não voltar em auditoria futura.

Fica **por fazer** a segunda metade do item, a contagem de palavras: nenhuma
medição justificou escrevê-la ainda, e as 202 unidades abaixo de 0,98 de 07/09
foram todas explicadas por outros meios (transcrito desleixado, preâmbulo do
narrador, leitura errada). Ver `defeitos-blivre-rede-ortografica.md`.

`tts-spike/` não é repositório git — o estado anterior está em
`gera_lote_gam.py.pre-numeros`.
