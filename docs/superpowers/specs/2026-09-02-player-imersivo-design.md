# Player imersivo (P6 — TTS fase 2) — design

Data: 2026-09-02

## Problema

A Leitura hoje lê em voz alta com o TTS sintético do navegador (Web Speech
API), com realce da unidade falada e rolagem acompanhando. Funciona em toda
perícope, mas a voz é a do sistema.

Em paralelo, uma sessão dedicada gerou narrações profissionais com voz clonada
e publicou, junto do áudio, um manifesto de sincronização. O player que existe
hoje (`src/components/NarracaoPlayer.tsx`) é um `<audio controls>` cru: toca,
mas não conversa com a tela.

Esta fase substitui esse player por um que dirige a leitura — realçando o
versículo e a palavra em curso e rolando junto — e retira o TTS sintético do
app.

## Decisões de produto (tomadas com o usuário)

1. **Ouvir passa a existir só onde há narração.** O TTS sintético do navegador
   sai do app inteiro, deliberadamente. Onde não há áudio, a Leitura não
   oferece nenhuma forma de ouvir e não menciona que a narração falta.
2. **A rolagem do usuário continua livre.** O player acompanha a leitura, não
   sequestra a tela.
3. **Realce por palavra é requisito**, não enfeite. A motivação veio do uso
   real: *"se eu olhar pro lado, eu já me perco de onde ele está lendo"*.

Consequência aceita: o Velho Testamento inteiro e a parte ainda não gerada do
Novo ficam sem leitura em voz alta até o corpus cobri-los. A cobertura era
~309/1047 perícopes do NT em 2026-09-02, e cresce com um lote diário.

## Objetivo

Ouvir a perícope com a voz narrada, com o versículo e a palavra em curso
realçados e a tela acompanhando — sem que o usuário perca o lugar ao desviar o
olhar.

**Não é objetivo:** gerar áudio, mexer no pipeline de narração, nem cobrir
perícopes sem áudio.

## O contrato (verificado, não presumido)

`GET /api/audio/nt-ml/<ordem>.json` devolve:

```
{ ordem, livro, abbrev, titulo, voz, motor, sr,
  pausa_unidade, pausa_secao, dur_total,
  unidades: [{ i, secao, arquivo, texto, chars, inicio, dur, palavras }] }
```

- `inicio`/`dur` em segundos **dentro do m4a costurado** — é o eixo do
  `timeupdate`.
- `secao` ∈ `{titulo, contexto, texto, resenha, reflexoes}`.
- `palavras: [{ t, i, d }]` — um item por token de `texto.split(' ')`, `i`
  **absoluto** no m4a, `d` a duração. Alinhamento forçado (MMS), não
  estimativa.
- `arquivo` é interno: ignorar.

Medições feitas sobre o manifesto real da ordem 1600 (Mateus 1:1-17), e que
sustentam o desenho abaixo:

| Verificação | Resultado |
|---|---|
| Unidades com contagem de tokens divergente de `texto.split(' ')` | **0** |
| Palavras fora da janela `[inicio, inicio+dur]` da própria unidade | **0** |
| Maior intervalo entre palavras no versículo mais longo (14,6 s, 29 palavras) | 0,56 s |
| Velocidade entre unidades | 9,5 a 14,2 chars/s |

O último número é o que **desqualifica a estimativa proporcional** e justifica
depender do alinhamento: com 50% de variação entre unidades, distribuir a
duração por caractere erraria por palavras inteiras num versículo longo. E
realce na palavra errada é pior que realce nenhum — destrói exatamente a
confiança que a feature existe para dar.

## O mapeamento manifesto ↔ tela

Este é o risco central. Um erro de um índice desloca o realce da perícope
inteira, e o sintoma é sutil: tudo parece funcionar, só que no versículo
errado.

**O mapeamento não é posicional.** As duas listas têm elementos que a outra
não tem, e — medido em 2026-09-02 sobre os manifestos republicados — as
contagens de unidade nem sempre batem com as de elemento na tela:

- Cada seção de conteúdo começa com uma unidade de **cabeçalho falado** —
  `"Contexto."`, `"Texto Bíblico."`, `"Resenha."`, `"Reflexões."` — que não
  corresponde a nada na tela.
- A seção `titulo` tem **duas** unidades (o título e a referência falada) e
  nenhuma delas é cabeçalho. Não tem alvo na tela: toca sem realce.
- `parseTextoNaa` emite blocos `{ kind: 'chapter' }` que não são narrados como
  unidade própria — o `"Capítulo N."` vem **fundido** ao primeiro versículo do
  capítulo. As unidades de `reflexoes` vêm prefixadas com `"Reflexão N. "`.
- **`contexto` tem 1 unidade e a tela mostra 2 parágrafos.** O gerador quebra
  a prosa pelos `\n\n` do dado bruto; o `contexto_historico_literario` não tem
  nenhum, então vira uma unidade só, enquanto `paragraphize` na tela cai no
  caminho de quebra por frases e produz 2. Verificado em 7 de 7 manifestos.
  A `resenha` tem 2 `\n\n` e por isso bate: 2 unidades, 2 parágrafos.

Uma regra posicional descartaria o realce do `contexto` em **toda** perícope —
justamente a seção que toca primeiro.

### A regra: alinhamento por fluxo de tokens

Em vez de casar unidade com elemento, casar **token com token**, por seção:

1. Pular a seção `titulo` inteira; nas outras, descartar a primeira unidade (o
   cabeçalho falado).
2. Montar o fluxo do manifesto: a concatenação, na ordem, dos tokens de cada
   unidade restante — cada token carregando seu `{ i, d }` de `palavras`.
   Descartar o prefixo `"Capítulo N."` / `"Reflexão N. "` (e os itens de
   `palavras` correspondentes) **apenas quando o descarte faz o token seguinte
   coincidir** com o próximo token pendente da tela; assim um versículo que
   legitimamente comece com essa forma não é mutilado.
3. Montar o fluxo da tela: a concatenação, na ordem, dos tokens de cada alvo —
   `contexto` → `[data-verse-id="contexto-<n>"]`; `texto` → os blocos
   `kind === 'verse'` (ignorando os marcadores de capítulo), alvo
   `[data-verse-id="<c:v>"]`; `resenha` → `resenha-<n>`; `reflexoes` →
   `reflexao-<n>`.
4. Se os dois fluxos tiverem o mesmo comprimento **e os mesmos tokens**, o
   alinhamento é exato: cada token do manifesto sabe a qual alvo pertence e
   qual é sua posição dentro dele. Senão, a seção toca **sem realce**.

Isso resolve as duas escalas de uma vez — o alvo em curso é o dono do token em
curso, e a palavra em curso é a posição desse token dentro do alvo — e cobre o
caso 1-unidade-para-N-parágrafos sem exceção nenhuma.

### Por que isso é mais seguro que contar

Comparar contagens aceita duas listas do mesmo tamanho e conteúdo diferente.
Comparar tokens não: um `paragraphize` diferente, uma normalização nova no
gerador ou uma edição no catálogo derrubam o realce **daquela seção** em vez de
deslocá-lo. Na dúvida, realce nenhum — nunca realce mentiroso.

Medido sobre os manifestos publicados das ordens 1600, 1601, 1605, 1610, 1620,
1650 e 1700 (134 unidades):

| Verificação | Resultado |
|---|---|
| Unidades sem `palavras` | **0** |
| `palavras[k].t` diferente de `texto.split(' ')[k]` | **0** |
| Tempos de palavra não monotônicos dentro da unidade | **0** |
| Palavras fora da janela `[inicio, inicio+dur]` da unidade | **0** |
| Seções cujo fluxo de tokens não bate com a tela (após a regra acima) | **0 de 28** |
| Formas de prefixo encontradas | só `Capítulo N.` e `Reflexão N.` |

## Realce e rolagem

O mecanismo já existe e é reaproveitado inteiro: a Leitura mantém um estado da
unidade em fala e aplica `verse-speaking` / `prose-speaking` (sublinhado em
`app.css:927-935`), com um efeito que rola até o elemento realçado. O que muda
é a **fonte**: em vez dos eventos do TTS, o `timeupdate` do `<audio>`.

- A unidade em curso é a que satisfaz `inicio <= t < inicio + dur`. Busca por
  varredura a partir da última conhecida (o tempo anda para frente na maior
  parte do tempo), com fallback para busca binária depois de um seek.
- A rolagem mantém os guardas que já existem: não rola com a barra de ações
  aberta, nem com anotação em edição ou rascunho aberto — a pessoa está
  escrevendo, mover a tela debaixo dela é hostil.
- **Rolagem do usuário tem precedência.** Se a pessoa rolar manualmente, o
  player para de rolar sozinho até a próxima troca de unidade — e nunca briga
  com o dedo dela.

## Realce por palavra

A palavra em curso é o token que satisfaz `i <= t < i + d`. O alinhamento por
fluxo de tokens já entregou, para cada token do manifesto, o alvo a que ele
pertence e sua posição dentro dele — não há um segundo mapeamento a fazer nem
uma segunda validação a aplicar: **a mesma checagem de fluxo governa as duas
escalas**. Uma seção que passou realça palavra e alvo; uma que não passou não
realça nem um nem outro.

Entre uma palavra e a seguinte há silêncio (o `d` termina antes do `i` do
próximo token). Nesse vão, mantém-se a **última** palavra realçada em vez de
apagar o realce: apagar produziria uma piscada a cada palavra, que é
exatamente o desconforto que a feature existe para remover. O realce só sai
quando o alvo muda ou o áudio para.

### Quebrar o versículo em palavras

O texto hoje é um nó único: `<span className="verse-text">{b.text}</span>`,
dentro de um `<button>` que carrega `onClick` de seleção e um `aria-label`.
Realçar palavra exige envolver cada token num elemento próprio, e isso toca
três coisas que já funcionam:

- **Seleção e cópia.** A Leitura deixa selecionar versículos e copiar/
  compartilhar. Se a quebra emitir os tokens sem os espaços entre eles, o texto
  copiado sai grudado. Os espaços têm que sobreviver à quebra.
- **O `aria-label` do botão.** Ele descreve o versículo inteiro; a quebra não
  pode fazer o leitor de tela soletrar palavra a palavra.
- **Custo de DOM.** Um versículo mediano tem 12 palavras, o maior medido tem 29.

**Quebrar só a unidade em curso**, revertendo para texto simples quando a
unidade muda. Mantém o DOM da página praticamente intacto, limita a mudança ao
trecho que está sendo lido, e evita mexer na seleção de texto do resto da
página. O custo é uma remontagem pequena a cada troca de unidade (~6 s pela
mediana medida) — barata, e fora do caminho do `timeupdate`, que só troca uma
classe.

**Fallback obrigatório:** manifesto sem o campo `palavras` toca **sem realce
nenhum**, sem erro visível. Não existe meio-termo útil: sem `palavras` não há
como saber a qual parágrafo do `contexto` a unidade única corresponde, e
realçar os dois seria a mentira que a validação existe para evitar.

A republicação com `palavras` já terminou — nas 134 unidades medidas o campo
está em todas. O fallback é defesa contra um caso real, porém: o manifesto é
servido com `cache-control: immutable, max-age=31536000`, então um aparelho que
tenha buscado a versão antiga pode carregá-la do cache por um ano.

O realce por palavra deve ser visualmente mais leve que o do versículo — dois
realces de mesmo peso competem e cansam. Peso exato fica para a implementação,
mas a hierarquia é: versículo é o contexto, palavra é o ponteiro.

## Remoção do TTS sintético

Sai:

- `src/lib/tts.ts` e `src/lib/tts.test.ts`
- `src/lib/tts-prefs.ts` e `src/lib/tts-prefs.test.ts`
- `src/components/TtsMenu.tsx`
- As ~79 linhas de fiação de TTS em `src/pages/Leitura.tsx` (de 987)

**Fica:**

- `src/lib/use-wake-lock.ts` — está ligado a *ter perícope aberta*
  (`Leitura.tsx:374`, `useWakeLock(p !== null)`), não ao TTS. Com narração
  tocando ele importa mais, não menos.
- As classes `verse-speaking` / `prose-speaking` e o efeito de rolagem — mudam
  de dono, não de existência.

Os itens de backlog sobre o TTS sintético (o `onerror` que aborta a fila, a
cobertura de teste de "play superseded") deixam de existir junto com o código;
o backlog precisa ser atualizado, não carregado adiante.

## Cobertura parcial

`HEAD` no `.m4a` decide se há narração — é a checagem barata que o player atual
já faz. Sem narração, a Leitura fica como está hoje **menos** o TTS: sem
player, sem menção, sem promessa não cumprida.

Manifesto ausente com áudio presente não deve acontecer, mas se acontecer o
player toca sem realce em vez de sumir — o áudio é o valor principal.

## Riscos

- **Desalinhamento silencioso.** Mitigado pela validação por seção descrita
  acima: na dúvida, realce nenhum.
- **Custo do `timeupdate`.** Dispara ~4x/s; a busca da unidade e da palavra
  precisa ser barata e não recriar a árvore. Realce por classe em elementos já
  renderizados, sem remontar a lista de versículos.
- **Perder o TTS é irreversível na prática.** Depois de remover, voltar atrás
  custa reimplementar. A decisão é deliberada e está registrada acima com o
  motivo.
- **Tokenização divergente.** O texto na tela e o narrado passam por caminhos
  diferentes (`parse-texto` e o normalizador do gerador). A validação de
  contagem por unidade é o que impede isso de virar realce errado.

## Critérios de aceite

1. Numa perícope com narração, tocar realça o versículo em curso e a palavra em
   curso, e a tela acompanha. Verificado no app rodando, não só em teste.
2. Rolar manualmente durante a reprodução não é revertido pelo player.
3. Um seek (arrastar a barra) reposiciona o realce corretamente, para frente e
   para trás.
4. Perícope sem narração não mostra player nem qualquer menção a áudio, e não
   oferece TTS.
5. Manifesto sem `palavras` (ainda não realinhado) toca sem realce nenhum,
   sem erro visível — o áudio é o valor principal.
6. Uma seção cujo fluxo de tokens não bate toca sem realce naquela seção, e as
   outras seções seguem realçando. Verificado com um manifesto adulterado.
   Em particular, `contexto` (1 unidade, 2 parágrafos na tela) DEVE realçar.
7. Nenhum resquício do TTS sintético: `grep -rn "tts" src/` não retorna código
   vivo, e o backlog não lista mais itens sobre ele.
8. Selecionar e copiar um versículo durante a reprodução devolve o texto com
   os espaços corretos, e o leitor de tela continua anunciando o versículo
   inteiro, não palavra a palavra.
9. `npm test`, `npx tsc -b`, `npm run typecheck:worker`, `npx oxlint` e
   `npm run build` passam.
