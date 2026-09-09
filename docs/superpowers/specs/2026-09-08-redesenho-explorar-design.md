# Redesenho do Explorar: campo único, ditado e a casca visual — design

Data: 2026-09-08

## O estado de hoje

O Explorar (`src/pages/Explorar.tsx`) já fundiu Índice e Pesquisar numa tela só
(spec `2026-09-03-fusao-indice-pesquisa-design.md`) e, no commit mais recente
(`438a1d9`), ganhou um segundo eixo de navegação, Registros. O que existe hoje:

- **Campo de busca** — `Explorar.tsx:452-460`: um `<input type="search">` solto
  dentro de `<div className="filters">`, sem ditado, placeholder "Buscar
  livro, título, referência ou trecho…". Resolve título, livro **e**
  referência (`Jo 3:16`, `salmo 23`, `1co 13` já funcionam via
  `parseConsulta`, `src/lib/consulta.ts`).
- **Chips de recorte de leitura** — `Explorar.tsx:462-474`: Todos / Não lidos
  / Comecei / Lidos, `role="group"`, `aria-pressed`, sempre visíveis (repouso,
  livro aberto, registro aberto, resultado de busca).
- **Eixo Livros/Registros** — `Explorar.tsx:500-516`: tabs `Livros | Registros`
  só no repouso (`emRepouso`, linha 446: `!consulta.termo && !livro &&
  !registro`), abaixo dos chips.
- **Formulário de capítulo/versículo** — `LivroAberto.tsx:82-115`: dentro do
  livro aberto, um `<form className="ref-form">` com dois `<input
  type="number">` (capítulo, depois versículo, o segundo desabilitado até o
  primeiro validar) e um botão "Ir". Estado local em `LivroAberto.tsx:29-42`
  (`campoCap`, `campoVer`, validação contra `maxChapter`/`maxVerse`). Submeter
  só capítulo filtra a lista do livro por capítulo (`onCap`, linha 221-222 de
  `Explorar.tsx`, `listPericopesByBookChapter` em `Explorar.tsx:394`);
  submeter capítulo+versículo fecha o livro e reaproveita a seção Referência
  (`onIrParaVersiculo` → `irParaReferencia`, `Explorar.tsx:261-266`) — **duas
  portas para o mesmo resultado**, exatamente o que a decisão 1 elimina.
- **`DitarBotao`** (`src/components/DitarBotao.tsx`) só existe hoje dentro do
  formulário de anotação da Leitura (`Leitura.tsx:1082`). Ele mesmo decide
  quando sumir: `if (!online) return null` (`DitarBotao.tsx:364`) e, sem a Web
  Speech API nativa, exige sessão e `MediaRecorder` (`DitarBotao.tsx:365`). O
  rótulo ocioso está hoje gravado como a string literal `'Ditar anotação'`
  (`DitarBotao.tsx:376`).

## O eixo Registros — levantamento

(Resposta à pergunta específica do pedido, para corrigir o mockup.)

**O que é.** Registros é um segundo recorte de "onde está a perícope" — não
geográfico (Livro/Testamento/Seção), mas temático: o clima do trecho
(Lamento, Consolo, Reverência, Tensão, Batalha, Juízo, Confronto, Mistério,
Ensino, Intimidade, Louvor, Linhagem, Ordenança, Santuário, A Terra, Crônica,
Correspondência — dezessete). O dado já existia para escolher a cama de áudio
da narração; o commit só o expôs como navegação. Fonte: `public/data/
registros.json` (derivado, montado por `npm run shard` a partir de
`data/trilha-registros.json`, `.gitignore` — ver `scripts/montar-registros.ts`),
carregado por `loadRegistros()` (`src/lib/registros.ts:31-52`) num `useEffect`
próprio em `Explorar.tsx:155-165`, **fora** do `Promise.all` que carrega o
catálogo de livros — não bloqueia nada, e falha em silêncio (registros vazios
caem no repouso sem erro visível).

**É um EIXO, não um filtro cruzado.** Este é o ponto central: escolher um
registro **troca o catálogo inteiro**, não estreita o catálogo de livros.
Não existe "veja Consolo dentro de Gênesis" nem um segundo nível de recorte
combinando os dois. A única coisa que atravessa os dois eixos são os quatro
chips de leitura (Todos/Não lidos/Comecei/Lidos) — esses sim valem para
Livros e para Registros igualmente (`progressoPorRegistro`/`contagemPorRegistro`,
`src/lib/registros.ts:60-99`, espelham `progressoPorLivro`/`contagemPorLivro`).

**Como o usuário alterna.** Um seletor de duas abas — `<div className="eixo-tabs"
role="tablist" aria-label="Livros ou Registros">` com dois `<button role="tab"
aria-selected>` (`Explorar.tsx:503-516`), rótulos literais **"Livros"** e
**"Registros"** (array `EIXOS`, `Explorar.tsx:62-65`). Visual: sublinhado em
`--accent` no ativo, mesma linguagem de `.notes-tabs`/`.notes-tab` da Leitura
(CSS `.eixo-tabs`/`.eixo-tab`, adicionado por este commit em `app.css:2806-2837`
— ver diff acima). **O seletor só aparece no repouso** (`emRepouso`): com
busca ativa, livro aberto ou registro aberto, o eixo em uso já está óbvio na
tela e o seletor some (comentário em `Explorar.tsx:500-502`). Estado na URL:
`?eixo=registros` (ausente = livros, é o padrão — `setEixo`, `Explorar.tsx:
244-251`).

**O que aparece na tela em cada eixo, no repouso:**
- **Livros** (padrão): `CatalogoLivros` — os 66 livros agrupados por
  Testamento → Seção, cada linha com nome, abreviação, barra de progresso e
  contagem (o que a spec de fusão já descrevia).
- **Registros**: `CatalogoRegistros` (`src/components/CatalogoRegistros.tsx`)
  — uma lista **chata, sem agrupamento** dos 17 registros, ordenados por
  tamanho decrescente (mais perícopes primeiro; `loadRegistros`, linha 43).
  Cada linha reaproveita **as mesmas classes CSS** do catálogo de livros —
  `livro-row`, `livro-nome`, `book-progress`, `book-progress-fill`,
  `book-progress-label` (`CatalogoRegistros.tsx:34-50`) — mas com **menos
  colunas**: só nome + barra + rótulo, **sem abreviação** (não há equivalente
  de `livro-abbrev` para um registro). Isto importa para o mockup: qualquer
  redesenho da linha de livro que dependa de uma coluna de abreviação fixa
  (decisão 5) **não tem para onde ir** na linha de registro — não é um campo
  que falta preencher, é um conceito que não existe para Registros.

**Abrir um registro.** Clicar chama `abrirRegistro(slug)`
(`Explorar.tsx:224-239`): seta `?registro=<slug>&eixo=registros`, apaga
`q`/`livro`/`cap`, rola para o topo. Renderiza `RegistroAberto`
(`src/components/RegistroAberto.tsx`): cabeçalho `.ref-sticky`/`.selected-book`
igual ao de `LivroAberto` (nome do registro, barra de progresso **real** —
nunca filtrada, `RegistroAberto.tsx:50-52` — e botão "**Trocar registro**"),
depois a lista **agrupada por livro** (`agruparPorLivro`, por transição, não
por chave — o mesmo cuidado de `agruparLivros`), **cem por vez** com um link
"**Ver mais 100**" (`PAGINA = 100`, `RegistroAberto.tsx:8,89-102`) — o corte é
sobre a lista achatada, antes de agrupar, senão viraria "as 100 primeiras de
cada livro". A contagem mostrada ("N à mostra de M") obedece ao recorte de
leitura ativo; a barra do cabeçalho, não. **`RegistroAberto` não tem
formulário de capítulo/versículo** — nunca teve; é, portanto, o padrão mais
próximo do que `LivroAberto` deveria virar depois que a decisão 1 remove o
dele.

**Precedência e URL.** Busca vence livro, que vence registro
(`consulta.termo > livro > registro`, resolvida na *derivação* do estado —
`Explorar.tsx:99-102` — não nos handlers, porque uma URL colada à mão com os
três parâmetros juntos não passa por handler nenhum). Abrir um livro fecha
registro e busca; abrir um registro fecha livro e busca; digitar fecha os
dois painéis (`Explorar.tsx:185-251`, comentários "Simétrico a...").

**Spec correspondente em `docs/`:** não há uma. Procurei por "registro" nas
specs existentes (`grep -il` em `docs/superpowers/specs/*.md`) e os únicos
acertos são menções incidentais a "registro" no sentido de "log"/"gravação"
em specs de auth, versículos, engajamento e rebranding — nenhuma é sobre este
eixo. O commit `438a1d9` (mensagem + diff) é a única fonte de design
disponível; esta seção supre a lacuna.

## Decisões de partida

Tomadas fora desta spec — o desenho abaixo é construído em torno delas, não
as reabre.

1. O formulário de `LivroAberto` (capítulo → validar → versículo → "Ir") sai.
   No lugar, o campo único de referência do topo do Explorar resolve `Gn
   3:15`, `salmo 23`, `1co 13` diretamente — ele já faz isso.
2. O campo de busca ganha o `DitarBotao` que hoje só existe na Leitura.
   44px dentro do campo, separado por um filete. Some quando offline
   (comportamento que o componente já tem).
3. Campo com 54px de altura, fundo `--paper`, borda `--line`, raio 12px;
   abaixo, uma dica em 14px `--muted` com dois exemplos em `--accent`.
4. Chips de recorte sobem para 42px, logo abaixo da dica. (Fechado em **44px**
   — o mínimo canônico da spec de toque; ver §3.)
5. Linha de livro com 56px: abreviação à esquerda em Cormorant Garamond 600
   numa coluna fixa de 42px; nome em 18px; linha secundária em 12,5px
   `--muted` ("N de M perícopes" / "nenhuma lida ainda"); barra de progresso
   de 58×4px à direita.
6. O eixo Registros continua existindo; encaixar no desenho novo e resolver
   qualquer conflito visual com os chips.
7. Nenhuma cor muda.

---

## O desenho

### 1. Anatomia em repouso

```
┌─────────────────────────────────────────────┐
│  [ referência, título ou trecho…    | 🎤 ]   │  ← campo, 54px
│  Ex.: Gn 3:15 · Salmo 23                     │  ← dica, 14px muted
├─────────────────────────────────────────────┤
│  ( Todos )( Não lidos )( Comecei )( Lidos )  │  ← chips, 44px
├─────────────────────────────────────────────┤
│   Livros    Registros                        │  ← eixo-tabs (só repouso)
│   ────────                                   │
│  ANTIGO TESTAMENTO                           │
│   PENTATEUCO                                 │
│  ┌────┬───────────────────────────┬───────┐  │
│  │ Gn │ Gênesis                   │ ▬▬▬░░ │  │  ← linha de livro, 56px
│  │    │ 12 de 50 perícopes        │       │  │
│  └────┴───────────────────────────┴───────┘  │
│  ┌────┬───────────────────────────┬───────┐  │
│  │ Êx │ Êxodo                     │ ░░░░░ │  │
│  │    │ nenhuma lida ainda        │       │  │
│  └────┴───────────────────────────┴───────┘  │
│  …                                            │
└─────────────────────────────────────────────┘
```

Ordem vertical: **campo → dica → chips → eixo-tabs (só repouso) → corpo**. A
ordem campo/dica/chips vem direto das decisões 3 e 4 (a dica "abaixo dele", os
chips "abaixo da dica"); o eixo-tabs cai naturalmente depois dos chips porque
não há mais nenhum outro lugar livre acima do corpo — é também onde ele já
vive hoje (`Explorar.tsx`: chips antes, eixo-tabs dentro do bloco `emRepouso`,
que vem depois).

### 2. O campo de referência

Estrutura nova (`.filters` deixa de ter o `<input>` sozinho):

```html
<div class="campo-ref">
  <input type="search" aria-label="Buscar livro, título, referência ou trecho"
         aria-describedby="ref-dica" ... />
  <span class="campo-ref-filete" aria-hidden="true"></span>
  <DitarBotao rotuloOcioso="Ditar referência" onTexto={...} onAviso={...} />
</div>
<p id="ref-dica" class="ref-dica">
  Ex.: <span class="ref-exemplo">Gn 3:15</span> ·
  <span class="ref-exemplo">Salmo 23</span>
</p>
<p class="muted" role="status">{aviso}</p>
```

- `.campo-ref`: `display:flex; align-items:center; height:54px; background:
  var(--paper); border:1px solid var(--line); border-radius:12px;`. O
  `<input>` fica `flex:1`, sem borda/fundo próprios (herda do container) —
  hoje `.filters input` tem borda e fundo (`app.css:1750-1761`); isso sai de
  dentro do input e vai para o container.
- `.campo-ref-filete`: `width:1px; height:28px; background:var(--line);
  margin:0 0.4rem;` — o filete entre o texto e o microfone.
- `DitarBotao` some inteiro (`display:none` via `return null`) quando
  `!navigator.onLine`; isso é comportamento herdado do componente
  (`DitarBotao.tsx:364`), não uma regra nova desta tela. Sem sessão e sem Web
  Speech API nativa (Firefox deslogado), também não aparece
  (`DitarBotao.tsx:365`) — mesma herança.
- `.ref-dica`: `font-size:0.875rem` (14px), `color:var(--muted)`; os dois
  `<span class="ref-exemplo">` em `color:var(--accent)`.
- `id="ref-dica"` + `aria-describedby` no input: quem usa leitor de tela ouve
  o formato ao focar o campo, sem precisar navegar até o parágrafo.
- **`.ditar-botao` não tem regra base nenhuma hoje.** Todo o tamanho e a
  aparência do microfone vivem sob `.note-form .ditar-botao`
  (`app.css:1840-1865`, mais a variante de movimento reduzido em
  `app.css:1927`) — dentro do `.campo-ref`, que não é `.note-form`, o botão
  sairia sem estilo nenhum: sem largura, sem círculo, sem borda. As regras
  precisam ser desescopadas (ou `.campo-ref` acrescentado aos seletores),
  subindo de `2.5rem` para os 44px de área de toque que a §3 fixa.
- **`.ditar` precisa ser neutralizada dentro do campo.** O wrapper do botão
  (`app.css:1830-1838`) tem `flex: 1 1 auto; margin-left: auto;
  justify-content: flex-end` — desenhado para empurrar o microfone à direita
  do rodapé do formulário de anotação. Dentro do `.campo-ref` isso comeria a
  largura do `<input>`; `flex` volta a `0 0 auto` e `margin-left` a `0`
  neste contexto.
- **Uma regra fica órfã e precisa sair junto**: `@media (min-width: 640px)
  { .filters { grid-template-columns: 1.4fr 1fr } }` (`app.css:2363-2366`)
  divide `.filters` em duas colunas. Com o campo único, `.filters` passa a
  ter um filho só e a segunda coluna vira um vão morto à direita do campo no
  desktop.

**Onde o texto ditado entra — e por que ele não chega em forma de
referência.** `onTexto` do `DitarBotao` foi pensado para um textarea de
anotação: cada frase fechada entra "no cursor" via `inserirNoCursor`
(`src/lib/ditado.ts:36-52`) e já vem **pontuada** — `pontuarFrase`
(`src/lib/pontuar-ditado.ts:66`) acrescenta ponto final a toda frase que não
termine em `.!?…`. Do outro lado, o parser corta o nome do livro e testa o
resto contra `/^(\d+)(?:[:.,](\d+))?$/` (`src/lib/consulta.ts:98`). Logo,
ditar "Gênesis três quinze" chega como `"Gênesis 3 15."` (ou com o numeral
por extenso, conforme o reconhecedor) e **falha o regex**: a consulta degrada
em silêncio para busca de texto, sem erro na tela, e a seção Referência nunca
abre. É o defeito que mataria a decisão 2 na prática.

**Decisão: `consulta.ts` fica intacto.** É código testado e compartilhado com
o campo digitado — afrouxar o regex lá dentro trocaria um defeito de uma tela
por risco em todas as consultas. Entra um módulo puro novo,
`src/lib/ditado-referencia.ts`, com uma função `normalizarDitadoRef(frase:
string): string` que (a) remove pontuação de fecho, (b) junta `"3 15"` em
`"3:15"` e (c) converte numeral escrito em dígito quando aparecer; mais o par
`src/lib/ditado-referencia.test.ts`. O Explorar passa o que vem de `onTexto`
por essa função antes de escrever no campo — a normalização é do consumidor,
não do parser.

**Neste consumidor, o ditado substitui em vez de anexar.** O texto
normalizado **substitui** o conteúdo do campo, e não é inserido no cursor:
anexar faria ditar duas vezes produzir `"Gênesis 3:15. Salmo 23."`, que não é
referência nenhuma e nem busca de texto útil. Um campo de referência guarda
um alvo só; o ditado mais recente é esse alvo. A Leitura continua anexando
via `inserirNoCursor`, com o contrato de hoje ("cada frase finalizada é
anexada") — nem o textarea de anotação nem `src/lib/ditado.ts` são tocados
por esta spec.

**`onAviso` precisa de um destino nesta tela.** `onAviso` é prop
**obrigatória** de `DitarBotao` (`src/components/DitarBotao.tsx:34`) e o
Explorar não tem canal de aviso nenhum hoje — a Leitura liga o dela ao
`flashAviso` (`Leitura.tsx:679`, ligação em `Leitura.tsx:1082`), que não
existe aqui. Decisão: um `<p className="muted" role="status">` abaixo da dica
do campo recebe os avisos do ditado (permissão negada, sem microfone, cota
esgotada) e fica vazio no resto do tempo. `role="status"` faz o leitor de
tela anunciar sem roubar foco — mesmo padrão do texto de estado interno do
próprio `DitarBotao` (`DitarBotao.tsx:409-415`). Sem esse destino, o aviso
não teria para onde ir e a falha de microfone ficaria invisível.

**`onRevisao` fica de fora.** A revisão por IA (`revisar-ditado.ts`) foi
desenhada para prosa longa, onde vírgulas e concordância importam; uma
referência curta ("Gênesis 3:15") não ganha nada com isso e pagaria uma
chamada de rede por toque de microfone. Não passar essa prop ao `DitarBotao`
no campo de busca — o componente já trata `onRevisao` como opcional
(`Props.onRevisao?`, `DitarBotao.tsx:33`).

**Rótulo do botão precisa de uma prop nova.** Hoje o rótulo ocioso está
gravado como a string literal `'Ditar anotação'` (`DitarBotao.tsx:376`) — ela
seria enganosa dentro do campo de busca (não existe "anotação" ali).
`DitarBotao` ganha uma prop opcional `rotuloOcioso?: string` (default `'Ditar
anotação'`, preservando a Leitura sem tocar nela); o Explorar passa
`rotuloOcioso="Ditar referência"`. Os outros rótulos ("Parar ditado", "Parar e
transcrever") já são genéricos e não precisam mudar.

### 3. Os chips de recorte

Sem mudança de comportamento — só `min-height`/`padding` para bater 44px em
vez dos atuais ~36px (`min-height: 2.25rem` em `.chip-filtro`,
`app.css:2913-2923`, sobe para `2.75rem`). Continuam sempre visíveis (não só
no repouso) e continuam valendo para os dois eixos.

**Por que 44px e não os 42px da decisão 4.** 44px é o alvo de toque mínimo
canônico do app, fixado pela spec irmã
`2026-09-08-redesenho-narracao-toque-design.md`, que vale para todo botão
pequeno de toda tela — inclusive `.chip-filtro` e `.trocar-livro`, que estão
nomeados na tabela de alvos de lá. Onde os dois números aparecerem, o que
vale é 44px; a decisão 4 arredondava para baixo um valor que a outra spec
já tinha fechado.

### 4. O eixo Registros no desenho novo

**Onde fica**: imediatamente abaixo dos chips, só no repouso — mesma posição
relativa de hoje. **Por que não conflita com os chips**, apesar de os dois
serem barras horizontais de botões logo uma sobre a outra:

- **Linguagens visuais diferentes de propósito.** Chips são pílulas com borda
  (`.chip-filtro`: `border-radius:999px; border:1px solid var(--line)`);
  eixo-tabs são texto sublinhado sem pílula (`.eixo-tab`: sem borda, sublinhado
  em `--accent` no ativo). Um leitor não confunde as duas fileiras com o
  mesmo tipo de controle — a pílula "filtra o que já está na tela", o
  sublinhado "troca a tela".
- **Escopos diferentes.** Chips valem em toda parte (repouso, livro aberto,
  registro aberto, cada seção de resultado — regra sem exceção, spec de
  fusão §5); eixo-tabs só existem no repouso, porque fora dele a pergunta "em
  qual eixo estou" já está respondida pelo que está na tela.
- **Nenhuma reordenação necessária**: a decisão 4 já fixa os chips
  "logo abaixo da dica", o que deixa o eixo-tabs no único lugar que sobra —
  entre os chips e o corpo do catálogo. É o mesmo lugar de hoje.

**A linha de registro fica sem coluna de abreviação.** Como `CatalogoRegistros`
reaproveita `.livro-row`/`.livro-nome`/`.book-progress*` (levantamento acima),
o restyle da linha (decisão 5, §5 abaixo) tem que continuar funcionando com
`.livro-row` em **flexbox**, não em grid de colunas fixas: a coluna de
abreviação (42px, Cormorant Garamond) é um filho a mais que só
`CatalogoLivros` renderiza. Faltando esse filho, o flexbox fecha o vão e
nome+barra deslocam ~42px para a esquerda — aceitável, porque não há nada
para alinhar contra (um registro não tem "abreviação"). **Não** force uma
coluna vazia/placeholder em `CatalogoRegistros` só para preservar alinhamento
milimétrico com `CatalogoLivros`: são listas visualmente adjacentes no tempo
(nunca lado a lado, nunca as duas na tela ao mesmo tempo), não colunas de uma
tabela — não precisam bater pixel a pixel.

A linha secundária (nome + "N de M perícopes"/"nenhuma lida ainda", §5) e a
barra de 58×4px **se aplicam igual a Registros** — `RegistroProgresso` tem a
mesma forma de `LivroProgresso` (`total`, `concluidas`, `pct`,
`src/lib/registros.ts:5-11`), e `rotuloContagem` (`src/lib/catalogo.ts:34-42`)
já é a função **compartilhada** que os dois catálogos chamam.

**Filtro cruzado: não existe.** Repetindo o ponto do levantamento porque é o
que mais provavelmente está errado num mockup: escolher "Registros" não é um
quinto chip que se soma a Todos/Não lidos/Comecei/Lidos, nem um filtro que
recorta a lista de livros. É uma aba que troca o catálogo inteiro por outro
catálogo, de mesma forma visual, mas outra fonte de dados.

### 5. As linhas do catálogo (Livros e Registros)

Layout novo de `.livro-row`, 56px de altura:

```
┌────────┬──────────────────────────────┬──────────┐
│  Gn    │ Gênesis                      │  ▬▬▬░░░  │
│ (42px, │ 18px, font-display            │  58×4px  │
│ Cormo- │ 12,5px muted:                 │          │
│ rant   │ "12 de 50 perícopes"          │          │
│ 600)   │                               │          │
└────────┴──────────────────────────────┴──────────┘
```

- Coluna de abreviação: `width:42px; flex-shrink:0; font-family:
  var(--font-display); font-weight:600;`. **A fonte não é instalada aqui.**
  Cormorant Garamond entra no projeto pela spec de tipografia
  (`2026-09-08-redesenho-tipografia-design.md`), que a torna o
  `--font-display` do app inteiro e cuida da dependência
  (`@fontsource-variable/cormorant-garamond`) e do import em
  `src/main.tsx`. Esta spec só consome o token — não cita `package.json`
  nem `src/main.tsx` entre os arquivos que altera. **Dependência de ordem**:
  a spec de tipografia precisa ter entrado antes desta, senão
  `var(--font-display)` ainda resolve para Fraunces e a coluna sai com a
  fonte velha (sem quebrar nada, só sem o desenho pedido pela decisão 5).
- Nome do livro/registro: sobe de indefinido (herda ~16px do body) para
  `font-size:1.125rem` (18px), mantém `font-family:var(--font-display)`
  (Fraunces) e `font-weight:600` como já é hoje (`.livro-nome`,
  `app.css:2865-2870`).
- **A linha secundária substitui o rótulo que hoje fica ao lado da barra**
  (`.book-progress-label`, hoje à direita, `app.css:2356-2361`) — mas
  **precisa de classe nova**, não do reaproveitamento dessa.
  `.book-progress-label` é compartilhada: além das linhas de catálogo
  (`CatalogoLivros.tsx:59`, `CatalogoRegistros.tsx:48`), ela veste o rótulo
  "N de M" ao lado da barra nos cabeçalhos de `LivroAberto.tsx:73` e
  `RegistroAberto.tsx:60`, onde esse rótulo **continua existindo do jeito que
  está**. Restilizá-la para 12,5px de linha secundária mudaria os dois
  cabeçalhos por tabela. A linha secundária ganha um seletor próprio (ex.:
  `.livro-sub`); a classe compartilhada fica intocada e some só do JSX das
  linhas de catálogo. Ela absorve
  o texto de `rotuloContagem` (`src/lib/catalogo.ts:34-42`), só que como
  frase, não como número solto:

  | filtro | com conteúdo | vazio (recorte zera o livro/registro) |
  |---|---|---|
  | Todos | "N de M perícopes" | "nenhuma lida ainda" |
  | Não lidos | "restam N perícopes" | "concluído" |
  | Comecei | "N em andamento" | "nada em andamento" |
  | Lidos | "N lidas" | "nenhuma lida ainda" |

  As duas frases citadas na decisão 5 ("N de M perícopes", "nenhuma lida
  ainda") cobrem exatamente os dois casos mais comuns (Todos, com e sem
  leitura); as quatro linhas do meio da tabela são extensão desta spec para
  fechar os outros três chips sem deixar um buraco — mesma função
  (`rotuloContagem`), frase mais legível no lugar do número cru. `livro-vazio`
  (opacidade 0.45, `app.css:2880-2882`) continua marcando a linha inteira
  quando o recorte zera — não muda.
- Barra: `width:58px; height:4px` (era `6rem`×4px = 96×4px,
  `.book-progress`, `app.css:2339-2345`) — só o tamanho muda, cor e
  `border-radius` seguem os mesmos (`--flame` no fill, decisão 7).
- `.livro-abbrev` (hoje ao lado do nome, `app.css:2872-2876`) é substituída
  por esta coluna nova — não convivem as duas.

### 6. `LivroAberto` depois que o formulário de capítulo sai

O componente perde o `<form className="ref-form">` inteiro
(`LivroAberto.tsx:82-115`) e o estado que o sustenta (`campoCap`, `campoVer`,
`capOk`, `verOk`, `verMax`, linhas 29-48). Junto, saem as props que só
existiam para esse formulário: `cap`, `onCap`, `onIrParaVersiculo`. A
assinatura fica:

```ts
{ livro, prog, itens, concluidas, filtro, onTrocar }
```

`filtro` **fica** — não é prop do formulário: é o que o `.peri-count` do
cabeçalho usa para dizer "em Gênesis" contra "no recorte"
(`LivroAberto.tsx:117-121`). Só `cap`, `onCap` e `onIrParaVersiculo` saem.

— a mesma forma de `RegistroAberto` (que nunca teve formulário). Depois desta
mudança os dois componentes ficam estruturalmente simétricos: cabeçalho
(`.ref-sticky`/`.selected-book`, nome + barra real + "Trocar livro"/"Trocar
registro") seguido de uma lista.

**O que se perde, e por que é aceitável.** A submissão de só capítulo
(`onCap`, sem versículo) hoje filtra a lista do livro aberto para as
perícopes daquele capítulo (`Explorar.tsx:394`,
`listPericopesByBookChapter`). Sem o formulário, não sobra controle de UI
para isso — o livro aberto passa a mostrar **sempre a lista inteira** do
livro (sujeita ao recorte de leitura ativo, nunca ao capítulo). O parâmetro
`?cap=` na URL e o filtro por capítulo em `content.ts` podem ser removidos do
código-fonte; não há mais como alcançá-los pela interface.

**O que continua existindo, por outro caminho.** Digitar `salmo 90` no campo
do topo resolve via `findPericopeByRef(abbrev, cap, ver ?? 1)`
(`Explorar.tsx:285`) para a perícope que contém o versículo 1 do capítulo —
na prática, "ir para o capítulo N" continua possível a partir de qualquer
lugar da tela, inclusive com o livro já aberto (o campo de busca é global,
não fecha sozinho quando você está dentro de um livro — ver `setQ`,
`Explorar.tsx:185-199`).

**Limite conhecido, documentado e não corrigido aqui**: se um capítulo tem
mais de uma perícope (comum em prosa narrativa, raro em Salmos), digitar
"Livro N" leva só à perícope que contém o versículo 1 daquele capítulo — as
demais perícopes do mesmo capítulo não aparecem juntas em lugar nenhum
específico; estão na lista inteira do livro aberto, fora de ordem de destaque.
Antes desta mudança, "Ver todas do capítulo" resolvia isso; depois, não há
substituto direto. É uma perda real de uma função secundária, aceita porque
a decisão 1 mata a forma inteira e o ganho (uma via só de referência) supera
o caso raro.

### 7. Estados

Herdados quase inteiros da spec de fusão (§6 lá); o que muda é só onde vivem
visualmente, não a lógica:

- **Preparando busca** — índice de texto ainda frio: seção "No texto" mostra
  "Preparando busca — N de 66 livros…" (`progressoDoIndice()`,
  `Explorar.tsx:380-384`). Referência, Livros e Títulos já respondem — vêm do
  `index.json`, carregado no boot.
- **Buscando** — debounce de 300ms (`Explorar.tsx:353`), "Buscando…" na seção
  "No texto" enquanto as outras seções já mostram o que têm.
- **Sem resultado** — três formas, todas herdadas: (a) referência fora de
  faixa mostra o motivo ("João tem 21 capítulos", `refForaDeFaixa.motivo`);
  (b) referência dentro de faixa sem perícope mostra "Nenhuma perícope contém
  X Y:Z" (`refMiss`, `Explorar.tsx:289`); (c) busca no texto sem acerto
  mostra "Nenhum resultado no texto." (`Explorar.tsx:621-623`). Um termo
  abaixo de `MIN_CHARS` (3, `fulltext.ts:6`) que também não bate título nem
  livro mostra só "Digite ao menos 3 letras para buscar no texto." — sem
  nenhuma seção acima dela. Isto é comportamento de hoje, não uma tela vazia
  nova.
- **Offline** — dois efeitos, independentes: (1) o `DitarBotao` do campo
  desaparece (`!navigator.onLine`); (2) a falha de rede fica confinada à
  seção "No texto" ("Não foi possível buscar agora…", `Explorar.tsx:616-619`)
  — Referência, Livros e Títulos continuam respondendo do `index.json`
  cacheado. Nenhuma das duas é nova nesta spec; a primeira é herdada do
  componente, a segunda da fusão.

### 8. Acessibilidade

- Campo: `aria-label` mantido (texto atual descreve bem o que o campo faz);
  `aria-describedby="ref-dica"` novo, para o formato de referência ser
  ouvido ao focar, sem precisar navegar até a dica.
- Filete divisório: `aria-hidden="true"` — é decoração, não estrutura.
- `DitarBotao`: já correto por herança — `aria-label`/`title` no botão
  (`rotulo`, `DitarBotao.tsx:369-376`), `role="status" aria-live="polite"`
  no texto de estado quando não é a prévia ao vivo (`DitarBotao.tsx:409-415`),
  prévia sem `aria-live` de propósito (mudaria a cada sílaba,
  `DitarBotao.tsx:401-407`). Nada disto muda ao entrar no campo de busca.
- Chips: `role="group"` + `aria-pressed` por botão — sem mudança.
- Eixo-tabs: `role="tablist"`/`role="tab"`/`aria-selected` — sem mudança.
  **Gap pré-existente, não coberto por esta spec**: não há `role="tabpanel"`
  associado nem `tabIndex` em rodízio (padrão ARIA completo de tabs pediria
  os dois); fica registrado, não é bloqueador para o redesenho visual.
- Linha de livro/registro: a barra continua `aria-hidden` (decoração); a
  linha secundária nova é texto real, visível e lido por leitor de tela —
  estritamente melhor que o rótulo espremido ao lado da barra que ela
  substitui.

## Fora do escopo

- Modelo de dados, sync, carga progressiva de shards — nada disso muda
  (herdado da spec de fusão).
- Paginação de `LivroAberto` (tipo "Ver mais 100" de `RegistroAberto`) para
  livros grandes (Salmos, ~150 perícopes) — continua sem paginação, igual
  hoje.
- Regras de precedência busca > livro > registro e o esquema de `?q=/?livro=/
  ?registro=/?eixo=/?f=` na URL — só a casca visual muda; a lógica de estado
  já descrita no commit `438a1d9` e na spec de fusão continua valendo.
- `Leitura.tsx` e o formulário de anotação — o `DitarBotao` de lá não muda de
  comportamento; ganha só uma prop opcional (`rotuloOcioso`) com valor
  default igual ao de hoje.
- Cores — nenhuma muda (decisão 7).
- **Instalar Cormorant Garamond.** `package.json` e `src/main.tsx` não são
  tocados aqui: a fonte chega pelo `--font-display` da spec de tipografia
  (§5), que é pré-requisito desta.
- `src/lib/consulta.ts` e `src/lib/ditado.ts` — nenhum dos dois muda; a
  normalização do ditado mora num módulo novo do lado do consumidor (§2).
- O `role="tabpanel"` que faltaria para o padrão ARIA de tabs ficar completo
  (ver §8) — registrado como gap conhecido, não corrigido aqui.
- Remover fisicamente `?cap=`/`onCap`/`listPericopesByBookChapter` do
  código — descrito como consequência (§6), não implementado por esta spec
  (que não altera arquivo nenhum).

## Checklist de verificação

1. `.filters` no repouso mostra o campo (54px, `--paper`, borda `--line`,
   raio 12px) com o microfone dentro, separado por um filete, e a dica de
   14px com dois exemplos em `--accent` logo abaixo.
2. Online e com Web Speech API (ou logado + `MediaRecorder`), o microfone
   aparece; offline, ele desaparece por completo — sem esqueleto, sem espaço
   reservado vazio.
3. Ditar "Gênesis três quinze" no campo (nativo) preenche o campo por
   `onTexto`, sem nenhuma chamada de revisão por IA disparada — e a **seção
   Referência abre** com Gênesis 3:15, não só o campo preenchido. Campo
   cheio com a busca degradada para texto é justamente o defeito que a §2
   fecha.
4. Ditar duas vezes seguidas deixa no campo só a última referência, não as
   duas emendadas.
5. Chips de recorte medem 44px de altura e ficam imediatamente abaixo da
   dica, acima do seletor de eixo.
6. Negar a permissão do microfone mostra o aviso **na tela**, no `<p
   role="status">` abaixo da dica — não só no console e não só dentro do
   componente. Mesma checagem para "sem microfone" e cota esgotada.
7. O microfone dentro do `.campo-ref` tem o mesmo desenho de sempre
   (círculo, borda `--line`, 44px de área de toque) e não espreme o
   `<input>` — o campo ocupa toda a largura que sobra, em 375px e em
   desktop.
8. Em ≥ 640px não sobra vão morto à direita do campo (a regra de duas
   colunas de `.filters` foi removida).
9. No repouso, o seletor "Livros | Registros" aparece abaixo dos chips;
   some assim que há busca, livro aberto ou registro aberto.
10. Trocar para "Registros" troca o catálogo inteiro — nenhum livro
    permanece visível, nenhum chip novo aparece disputando espaço com os
    quatro de sempre.
11. Linha de livro: 56px, abreviação em `var(--font-display)` (Cormorant
    Garamond, vinda da spec de tipografia) peso 600 numa coluna de 42px,
    nome em 18px, linha secundária em 12,5px com a frase certa para o
    filtro ativo, barra de 58×4px à direita.
12. Linha de registro: mesma altura e tipografia de nome/linha secundária/
    barra da linha de livro, **sem** coluna de abreviação — nome e barra
    ocupam o espaço que sobra.
13. Os cabeçalhos de livro aberto e de registro aberto continuam com o
    rótulo "N de M" ao lado da barra, do tamanho de hoje — a linha
    secundária nova não os alcançou.
14. Um livro/registro zerado pelo recorte ativo continua na lista, apagado
    (opacidade), nunca some.
15. Abrir um livro não mostra formulário de capítulo/versículo nenhum —
    só cabeçalho (nome, barra real, "Trocar livro") e a lista inteira do
    livro, sujeita ao recorte.
16. Com o livro aberto, digitar uma referência no campo do topo (inclusive
    do mesmo livro) ainda funciona e leva à seção Referência.
17. Abrir um registro continua mostrando "Ver mais 100" quando há mais de
    100 perícopes no recorte, agrupadas por livro.
18. Índice de busca frio: Referência, Livros e Títulos respondem na hora;
    "No texto" mostra "Preparando busca — N de 66 livros…".
19. Offline sem cache: erro confinado à seção "No texto"; as outras seções
    seguem respondendo do `index.json` cacheado.
20. Nenhuma cor (âmbar, `--line`, `--paper`, `--flame`) muda de valor em
    lugar nenhum desta tela.
21. `npm test` (inclui `ditado-referencia.test.ts`), `npx tsc -b`,
    `npx oxlint` e `npm run build` passam.
