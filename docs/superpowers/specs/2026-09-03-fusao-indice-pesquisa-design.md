# Fusão do Índice com a Pesquisa — design

Data: 2026-09-03

## Problema

Há três superfícies para a mesma pergunta — "onde está o que eu quero ler?" —
espalhadas por duas páginas e dois itens de nav:

- `src/pages/Indice.tsx` (188 linhas): lista agrupada por livro, barra de
  progresso por livro, `<select>` de livro e um `<input type="search">` que
  filtra por título, nome de livro e referência.
- `src/pages/Pesquisar.tsx` (410 linhas): dois modos num estado
  `modo: 'ref' | 'texto'` — seletor livro → capítulo → versículo (com filtro
  de livros próprio) e busca full-text sobre os shards.

O leitor precisa saber de antemão em qual das três caixas o que ele quer está.
E as três não são equivalentes: a busca do Índice é uma versão pior da busca
por referência do Pesquisar.

## O que a medição mostrou

Tudo abaixo foi medido sobre `public/data/index.json` (2.647 perícopes,
66 livros) e os 66 shards de `public/data/texto/` (4,1 MB normalizados).

### Os dois catálogos de livro são o mesmo conjunto

Os 66 `livro` do `index.json` e os 66 `BIBLE_BOOKS` têm os mesmos nomes, os
mesmos `abbrev` e a mesma ordem canônica. O `<select>` do Índice e o catálogo
de chips do Pesquisar são dois desenhos da mesma lista. Fundir não perde
cobertura: o catálogo é estritamente mais rico (testamento, seção, `abbrev`,
`versesPerChapter`) e o `<select>` estritamente mais pobre.

Consequência: a estrutura do catálogo passa a vir de `BIBLE_BOOKS`, não de
`listLivros()`.

**Correção pós-escrita (Task 8):** este texto originalmente mandava apagar
`listLivros()` por "só era usada pelo Índice". Deixou de valer: a sessão de
releitura, mesclada depois deste documento ter sido escrito, fez
`Ajustes.tsx` passar a consumi-la (para o `<select>` de livro do formulário
de marcar perícope como lida). A função foi deliberadamente preservada na
implementação — só `listPericopes` foi estreitada (ver §2).

### A busca do Índice erra referências

| digitado no Índice hoje | resultado |
|---|---|
| `Jo 3:16` | 0 resultados |
| `João 3:16` | 0 resultados |
| `3:16` | 10 — inclui `1 Samuel 13:16`, `2 Crônicas 23:16` |

A cláusula é `` `${p.capitulo_inicio}:${p.versiculo_inicio}`.includes(q) ``
(`content.ts:46`): substring sobre o **início** da perícope, sem conter faixa.
`findPericopeByRef('Jo', 3, 16)` devolve corretamente
`João 3:1–3:21 · "Jesus e Nicodemos"`. A fusão não só remove uma superfície:
conserta um defeito.

### Adivinhar o modo é inseguro; exigir um dígito é seguro

46 dos 66 **nomes** de livro também são palavras do texto bíblico
(`Josué`=232, `João`=155, `Daniel`=86, `Atos`=78, `Jó`=64, `Juízes`=57).
Nos **abbrevs** é pior: `Os` (Oséias) tem 15.321 ocorrências do artigo "os" e
`Na` (Naum) 3.195.

Já "token de livro seguido de dígito" aparece **1 vez** em 4,1 MB — e essa uma
é artefato de quebra de linha (`"do que João\n2 —"`), não uma frase que alguém
busque.

Portanto: com dígito, referência é inequívoca. Sem dígito, **a tela não
escolhe** — empilha as seções que casarem.

### Só uma colisão de alias em 132

Sobre os 66 nomes + 66 abbrevs normalizados (minúsculas, sem diacríticos):
nomes não colidem entre si; abbrevs colidem em exatamente um par —
`jo` → **Jó** (`Jó`) e **João** (`Jo`). É a mesma colisão que
`livro-slug.ts` já documenta.

### O full-text nunca é parcial

`buildIndex()` (`fulltext.ts:169`) **não consome o que o prefetch trouxe**:
ele baixa os 66 shards de texto por conta própria, em série, pelo mesmo
`carregarTexto`; o `emVoo` de `shards.ts:13` funde as requisições com as da
fila de fundo. O índice é completo, pendente ou falho — nunca incompleto.
O prefetch não muda *se* a busca funciona, só *quanto* a primeira busca espera
(0 → 4,2 MB).

Logo, "não parecer quebrada" é questão de layout, não de correção.

## Objetivo

Uma tela só, `/explorar`, cujo estado de repouso é um catálogo navegável e que
vira busca conforme se digita. Um item de nav em vez de dois, sem submenu.

**Não é objetivo** mudar o modelo de dados, o sync, a carga progressiva de
shards, nem o que a Leitura faz com `?v=`.

---

## 1. Rotas e estado

`/explorar` é canônica. `/indice` e `/pesquisar` viram
`<Navigate to="/explorar" replace />` — nenhum link salvo quebra.

Todo o estado da tela mora na URL, então tudo é linkável e o botão voltar
funciona:

| parâmetro | valor | ausente significa |
|---|---|---|
| `q` | consulta crua | repouso |
| `livro` | nome completo (`João`) | nenhum livro aberto |
| `cap` | inteiro | sem filtro de capítulo |
| `f` | `nao-lidos` \| `comecei` \| `lidos` | todos |

Digitação navega com `replace: true`: teclar não pode entulhar o histórico.
Abrir um livro e trocar o filtro navegam com `push`, porque são movimentos que
o leitor espera desfazer com o botão voltar.

`cap` sem `livro` é ignorado — um capítulo não significa nada sem o livro, e
uma URL montada à mão não pode deixar a tela num estado que ela não sabe
desenhar.

O campo **não** recebe foco automático no repouso: no celular isso abriria o
teclado por cima do catálogo, que é justamente o que a tela quer mostrar.

## 2. Arquivos

| Arquivo | | Responsabilidade |
|---|---|---|
| `src/pages/Explorar.tsx` | novo, ~190 | Estado da URL, carga, orquestração das seções |
| `src/components/CatalogoLivros.tsx` | novo, ~90 | Testamento → Seção → linha de livro |
| `src/components/LivroAberto.tsx` | novo, ~120 | Cabeçalho, formulário cap/vers, lista |
| `src/components/ListaPericopes.tsx` | novo, ~45 | `<ul>` de perícopes com ✓, ref e snippet opcional |
| `src/lib/consulta.ts` | novo, ~70 | Parser puro da consulta |
| `src/lib/content.ts` | +~35 | Predicado do filtro, junto de `progressoPorLivro`; `listPericopes` fica só com o casamento de título (perde as cláusulas de livro e de `cap:ver`) — `listLivros` **preservada**, ver correção acima |
| `src/lib/bible-books.ts` | tocado | `norm` renomeada para `normalizarNome` e exportada — `consulta.ts` (§3) precisa dela para casar livro/abbrev sem diacríticos |
| `src/lib/fulltext.ts` | +~5 | `searchTexto` ganha o predicado de filtro |
| `src/pages/Indice.tsx` | apagado | |
| `src/pages/Pesquisar.tsx` | apagado | |
| `src/pages/Leitura.tsx` | 1 linha | migalha `/indice` → `/explorar?livro=<livro>` |

`CatalogoLivros` serve **dois lugares**: o estado de repouso e a seção
"Livros" dos resultados. `ListaPericopes` serve **três**: "Títulos", "No texto"
e o livro aberto. É o que mantém ~550 linhas espalhadas em vez das 598
concentradas de hoje, e nenhum arquivo passa de 200.

## 3. O parser (`src/lib/consulta.ts`)

Puro, sem I/O, sem React. Depende só de `bible-books.ts` — que é `.ts`
versionado, não JSON derivado.

```ts
export type RefParseada = { livro: BibleBook; cap: number; ver: number | null }

export type Consulta = {
  /** Consulta aparada, do jeito que foi digitada. */
  termo: string
  /** Preenchida só quando há token de livro + número dentro da faixa. */
  ref: RefParseada | null
  /** Token de livro + número FORA da faixa: a seção explica em vez de sumir. */
  refForaDeFaixa: (RefParseada & { motivo: string }) | null
  /** Livros cujo nome ou abbrev casa com o termo. */
  livros: BibleBook[]
  buscarNoTexto: boolean
}

export function parseConsulta(entrada: string): Consulta
```

Regras, nesta ordem:

1. **Descascar o token de livro.** Para cada livro, tenta o prefixo do nome e
   o prefixo do abbrev; vence o casamento mais longo. O prefixo precisa
   terminar em fim de string ou em caractere não-letra, para `jo` não casar
   dentro de `josue`.
2. **Acento no abbrev é significativo.** O casamento de **abbrev** é
   insensível a maiúsculas e **sensível a acento**; o de **nome** é insensível
   aos dois. É o que resolve a única colisão dos 132 aliases:
   `jo 3:16` → **João** (abbrev `Jo`), `jó 3:16` → **Jó** (abbrev `Jó`).
   Quem digitar `jo` sem acento querendo Jó continua vendo Jó na seção
   "Livros" logo abaixo, onde o casamento é sem acento — o empilhamento
   absorve o erro.
3. **Abbrev tolera o espaço do prefixo numérico.** `1 co 13` casa `1Co`.
4. **O resto vira número.** `/^(\d+)(?:[:.,](\d+))?$/`. Dois-pontos, ponto e
   vírgula são aceitos como separador de versículo.
5. **Validação é a mesma do formulário.** `cap` em `1..maxChapter(livro)`;
   `ver`, se houver, em `1..maxVerse(livro, cap)`. Fora da faixa preenche
   `refForaDeFaixa` com um `motivo` legível ("João tem 21 capítulos").
6. **`livros`** = `filterBooks(termo)` — `includes` sem acento, como hoje.
7. **`buscarNoTexto`** = `ref == null && refForaDeFaixa == null &&
   termo.length >= MIN_CHARS`. `jo 3:16` não é um trecho de texto bíblico:
   quando a consulta é referência, **nenhum shard é baixado**.

O resultado é aditivo, nunca exclusivo: uma consulta pode ter `ref` **e**
`livros` **e** casar títulos. A tela nunca escolhe um modo.

## 4. As seções

Ordem fixa: **Referência → Livros → Títulos → No texto**. Barato antes de
caro, e específico antes de genérico. Seção sem casamento **não aparece** —
não fica vazia.

- **Referência** — o resultado de `findPericopeByRef`. Apresenta, não navega:
  o leitor clica. Vale também para o `submit` do formulário do livro aberto,
  para as duas portas terem o mesmo desfecho.
- **Livros** — `CatalogoLivros`, com barra de progresso por livro. Hoje o
  catálogo do Pesquisar não mostra progresso nenhum; isto é ganho.
- **Títulos** — casa **só** `titulo_pericope_pt`. A cláusula
  `p.livro.toLowerCase().includes(q)` de `content.ts:45` **sai**: com ela,
  digitar "joão" despejaria as 85 perícopes do livro João no meio dos 124
  títulos que mencionam João. Livro já tem seção própria.
- **No texto** — `searchTexto`, com o `<mark>` e o `?v=` de hoje.

## 5. Filtro de leitura

Quatro chips logo abaixo do campo, válidos em **toda** a tela — catálogo,
livro aberto e as quatro seções. Uma regra sem exceção para decorar.

| chip | `?f=` | inclui |
|---|---|---|
| Todos | *ausente* | tudo |
| Não lidos | `nao-lidos` | `nao_iniciado` + `em_andamento` |
| Comecei | `comecei` | `em_andamento` |
| Lidos | `lidos` | `concluido` |

`em_andamento` é gravado na primeira abertura de qualquer perícope
(`Leitura.tsx:286-288`), então "Comecei" significa *abri e não terminei* — um
estado real, não teórico. A fonte passa a ser `listAllProgresso()` no lugar de
`doneSet()`; `doneSet()` já chama `listAllProgresso()` por dentro, então não há
leitura nova de IndexedDB.

Os chips são **recortes, não uma partição**: "Comecei" é um subconjunto de
"Não lidos". É deliberado — "o que me falta" e "o que eu larguei no meio" são
perguntas diferentes, e quem quer a segunda não quer ver as 2.000 que nunca
abriu junto.

Duas regras que não são óbvias:

- **Livro sem nenhuma perícope no recorte ativo fica apagado com "0"** — não
  some. Vale para os quatro chips: Rute 4/4 sob "Não lidos", um livro
  intocado sob "Lidos". Os 66 livros sempre nos mesmos lugares: a memória
  muscular de onde fica cada livro não pode quebrar conforme se lê, e uma
  lista que encolhe debaixo do leitor desorienta.
- **A barra do cabeçalho do livro aberto ignora o filtro.** Ela mostra o
  progresso do livro inteiro, nunca o do que sobrou. É a mesma regra
  deliberada de `Indice.tsx:111-113`; sem ela, "Não lidos" zeraria toda barra.

### O teto de 50 precisa contar depois do filtro

`searchTexto(termo, LIMITE_RESULTADOS + 1)` para de varrer no 51º achado
(`fulltext.ts:236-237`), **antes** de qualquer filtro. Filtrar depois daria
"51 achados → 3 não lidos" e esconderia casamentos além do teto.

`searchTexto` ganha um parâmetro opcional:

```ts
export async function searchTexto(
  q: string,
  limit = LIMITE_RESULTADOS,
  aceitar?: (ordem: number) => boolean,
): Promise<FulltextHit[]>
```

aplicado dentro do laço, antes do `hits.push`. Sem o parâmetro o comportamento
é idêntico ao de hoje. É a única mudança fora dos arquivos desta fusão, e
`fulltext.ts` só é consumido pela tela que esta spec cria.

## 6. Carga, espera e falha

`index.json` (~480 KB, já carregado no boot) alimenta Referência, Livros e
Títulos: **essas três respondem sempre**, inclusive na primeira visita e
offline. Só "No texto" espera os 4,2 MB.

- **Boot** — `SkeletonIndice`, como hoje, até `loadIndex()` e o progresso
  chegarem.
- **Índice de busca frio** — a seção "No texto" mostra
  "Preparando busca — N de 66 livros…" com o `progressoDoIndice()` que já
  existe. As seções acima já estão respondidas.
- **Falha de rede** — o erro fica **dentro** da seção "No texto". Hoje ele
  toma a tela inteira do modo "No texto".
- **Sync** — `useSyncRefresh` recarrega só o progresso, como
  `Indice.tsx:85-90`: livros e perícopes são conteúdo estático e recarregá-los
  faria a lista piscar.

## 7. Testes

**Nenhum teste lê `public/data/index.json`.** O arquivo é derivado e
gitignored (`.gitignore:29`), gerado só por `npm run shard`;
`.github/workflows/deploy-worker.yml` roda `npm test` (passo 19) **antes** do
build que o gera (passo 21). Um teste assim passa na máquina e quebra a CI com
`ENOENT`. O risco foi levantado de forma independente por três sessões nesta
rodada, e esta tela é a mais exposta — é a única que consome o catálogo pelos
dois lados (`loadIndex()` e os shards), logo a candidata natural a um teste de
integração que carregue o catálogo de verdade. **Não escreva esse teste.**

Fontes permitidas: `src/lib/bible-books.ts` (66 livros com `name`, `abbrev`,
`testament`, `section`, `versesPerChapter`, em memória, sem I/O) para tudo que
é parser e catálogo; `data/pericopes.json` (versionado, 13,7 MB) só se um
teste realmente precisar do catálogo inteiro; e índices literais montados no
próprio teste para os casos pequenos.

Uma nota de aferição, para não se comemorar número errado: numa worktree
limpa o baseline é 39 arquivos / 435 testes. Na `main` o vitest também coleta
`.worktrees/develop` e mostra 66 / 706 — é a outra worktree na conta, não
cobertura a mais.

- `src/lib/consulta.test.ts` — os 66 livros por nome e por abbrev;
  `jo`/`jó`/`joão`; `1 co 13`; separadores `:` `.` `,`; fora de faixa nos dois
  eixos; termos sem livro; termos abaixo de `MIN_CHARS`; a garantia de que
  `buscarNoTexto` é `false` quando há referência.
- `src/lib/content.test.ts` — predicado do filtro nos quatro chips sobre
  `Progresso[]` sintético.
- `src/lib/fulltext.test.ts` — `searchTexto` com `aceitar` rejeitando: o teto
  conta os aceitos, não os varridos.
- `src/pages/Explorar.test.tsx` — no padrão `createRoot` + `act` de
  `DitarBotao.test.tsx` (o repo não usa testing-library), com `content` e
  `fulltext` mockados: repouso desenha o catálogo; digitar referência abre a
  seção Referência sem disparar `searchTexto`; seção vazia não aparece; o
  filtro atravessa as seções.

## 8. Fronteiras com as outras sessões

| Superfície | Dono | Combinado |
|---|---|---|
| `Indice.tsx`, `Pesquisar.tsx`, `Explorar.tsx`, rotas delas | **esta sessão** | — |
| `src/App.tsx` (nav e `<Route>`) | chrome/header | Recebe de nós: rótulo **"Explorar"**, `to="/explorar"`, a rota canônica e os dois redirects — já enviado e arquivado por ela. Quem *aplica* depende da ordem de merge (abaixo) |
| `src/pages/Leitura.tsx:796` | esta sessão, 1 linha | `/indice` → `/explorar?livro=<livro>`; as outras três são avisadas |
| `src/pages/Home.tsx` | jornadas (f2) | Não encostamos |
| `progresso.historico`, `paraReler` | releitura (a4) | Aditivos; `progressoPorLivro` não é tocado. "Vale reler" mora na Home, não aqui, e a a4 decidiu que o ✓ permanece — o filtro desta tela é só estado de leitura e não disputa superfície |
| `src/styles/app.css` | todas | Só **acrescentamos** blocos. `.ref-sticky` (`app.css:2105`) é nosso; o header não encosta |

Se a nav for mesclada antes desta tela existir, ela mantém **dois** itens —
um item só apontando para `/indice` esconderia a Pesquisa e seria regressão.

### Ordem de merge

Combinada entre as quatro sessões: **jornadas → releitura → chrome → esta**.
Entrar por último é o que protege a dependência mais dura da rodada — o
`import Explorar from './pages/Explorar'` do `App.tsx` não pode existir antes
do arquivo. Como o chrome mescla antes, a aplicação física do diff da nav
provavelmente cai para esta sessão, com o conteúdo já acordado e arquivado
por ela; a decisão do rótulo e da rota continua tendo sido dela.

O chrome reescreve a nav antes disso (`Hoje` sai, `Perfil` entra), então os
números de linha do `App.tsx` mudam. O diff acordado é aplicado **por
conteúdo**, nunca por linha.

Um recorte "marcadas para reler" (`paraReler`) foi considerado e **recusado**
pela sessão de releitura, que é dona do conceito: os chips desta tela são um
eixo (status de leitura) e "Vale reler" é outro (tempo desde a última leitura
mais pin manual). Juntá-los no mesmo conjunto prometeria uma coerência que não
existe.

## 9. Limites conhecidos

Registrados aqui para não virarem descoberta depois:

- **Busca por título é `includes` sem fronteira de palavra**: "amor" casa
  "Amorreus" e "Clamor". Herdado, e mantido de propósito — o full-text também
  é `indexOf` puro, e divergir faria as duas seções responderem por regras
  diferentes à mesma consulta.
- **A primeira busca no texto ainda paga 4,2 MB** se o prefetch não tiver
  terminado. A fusão esconde melhor a espera; não a elimina.
- **`?f=` não sobrevive à troca de aparelho** — é estado de URL, não de
  usuário. Deliberado: é um recorte momentâneo, não uma preferência.
- **Referência sem livro deixa de ser atalho.** Hoje digitar `3:16` no Índice
  devolve 10 perícopes — e devolve errado (casa `13:16` e `23:16`, porque é
  substring sobre o início). Na tela nova, `3:16` sem livro cai na busca no
  texto. É remoção deliberada: "3:16" sozinho tem 66 respostas possíveis e
  nenhuma forma de escolher entre elas.

## 10. Critérios de aceitação

1. `/indice` e `/pesquisar` levam a `/explorar` sem quebrar histórico.
2. Repouso mostra os 66 livros agrupados por Testamento e Seção, com barra de
   progresso, e cabe em ~4,5 telas em vez das ~27 de hoje.
3. `Jo 3:16` devolve `João 3:1–3:21` na seção Referência **e** nenhum shard é
   baixado.
4. `jó 3:16` devolve Jó; `jo 3:16` devolve João.
5. `João 99` diz "João tem 21 capítulos" em vez de não devolver nada.
6. `josué` devolve as três seções: 1 livro, 9 títulos e 66 perícopes casando
   no texto — das quais as 50 primeiras listadas, com o "(primeiros)" que o
   `fatiarResultado` já decide.
7. `amor de Deus` não mostra seção "Livros".
8. Com o índice de busca frio, Livros e Títulos já respondem enquanto "No
   texto" mostra o progresso de indexação.
9. Offline sem cache, o erro fica confinado à seção "No texto".
10. Filtro "Não lidos" recontagem em todos os livros; Rute 4/4 fica apagado
    com "0"; a barra do cabeçalho do livro aberto continua no total do livro.
11. Com filtro ativo, a contagem de "No texto" reflete os aceitos, não os
    varridos.
12. Clicar num livro abre o livro com o formulário cap/vers e o botão
    "Trocar"; o filtro continua valendo.
13. Os dois `?v=` (hit de texto e hit de referência) continuam levando ao
    versículo certo na Leitura.
14. A migalha da Leitura leva ao livro, não ao topo do catálogo.
