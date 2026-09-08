# Jornadas de leitura — design

Data: 2026-09-03

## Problema

A Home pressupõe que o leitor começa em Gênesis 1 e em Mateus 1. Ela monta duas
trilhas fixas — Velho e Novo Testamento — e o "Continuar" de cada uma é a
primeira perícope não concluída da sequência canônica inteira (ou o checkpoint
mais recente, quando existe).

Quem chega ao app já lendo por outro caminho não tem por onde entrar. Alguém em
Isaías 40 no papel, alguém estudando só João, alguém que quer reler o
Pentateuco — todos são recebidos por uma tela que diz "continue de Gênesis 1".
O progresso existe, mas não há como declarar **onde** se está nem **o que** se
pretende ler.

Esta fase introduz a **jornada**: um percurso declarado pelo leitor, com escopo
e ponto de partida próprios, que passa a ser o que a Home mostra.

## Decisões de produto (tomadas com o usuário)

1. **Uma jornada ativa por vez.** A ideia inicial era até cinco simultâneas. O
   próprio usuário a revisou: *"Ninguém lê a bíblia de 5 formas diferentes ao
   mesmo tempo... acho que isso vai acabar criando um hábito ruim."* Iniciar uma
   nova arquiva a anterior. Isso elimina, de saída, toda a ambiguidade de a qual
   jornada atribuir uma leitura.
2. **O progresso continua global.** `progresso` permanece uma linha por
   perícope, como hoje. O ✓ do Índice, as barras por livro e o streak não mudam
   de fonte. A contagem da jornada é **derivada** desse mesmo dado — nunca uma
   segunda contabilidade que possa divergir.
3. **O trecho pulado fica fora do escopo.** Uma jornada do AT começando em
   Isaías 40 vai de Isaías 40 a Malaquias. O que veio antes não conta como lido
   nem como pendente: simplesmente não pertence à jornada. A barra começa
   honesta.
4. **Qualquer leitura no escopo conta.** Concluir chegando pelo Índice, pela
   busca ou por link direto credita a jornada do mesmo jeito que o botão
   "Continuar". Não existe leitura que "não valeu". O modo *reler* restringe
   por **data**, nunca por caminho — são eixos independentes.
5. **A ordem cronológica fica para depois.** O dataset não tem ordenação
   cronológica e produzi-la é trabalho de conteúdo, não de código. A V1 entrega
   os escopos canônicos; a arquitetura nasce preparada para recebê-la.

## Objetivo

Permitir que o leitor declare um percurso — um livro, um bloco, um testamento
ou a Bíblia inteira — a partir de qualquer ponto, e que o app respeite esse
percurso como o lugar de onde se continua.

**Não é objetivo:** desmarcar leituras, zerar progresso em massa, "marcar para
reler" ou esquecimento por decay. Tudo isso é a feature de **releitura e
esquecimento**, desenhada em paralelo noutra sessão. O contrato entre as duas
está na seção "Fronteira com releitura e esquecimento".

## Modelo de dados

```ts
// src/lib/types.ts
export type JornadaTipo = 'sequencia' | 'bloco' | 'livro'   // 'cronologica' depois

export type Jornada = {
  id: string                    // crypto.randomUUID()
  nome: string                  // editável; default derivado do escopo
  tipo: JornadaTipo
  /**
   * 'sequencia' → 'biblia' | 'vt' | 'nt'
   * 'bloco'     → id de BLOCOS (ex.: 'pentateuco')
   * 'livro'     → nome do livro, como aparece em PericopeIndex.livro
   */
  escopo: string
  /** Ordem da 1ª perícope da jornada dentro da rota do escopo. */
  inicioOrdem: number
  /**
   * Âncora da atribuição.
   * `null` → modo "continuar": qualquer conclusão no escopo conta, de
   *          qualquer época.
   * ISO    → modo "reler": só conclusões a partir dali contam, e o cursor
   *          volta ao início da rota.
   */
  contaDesde: string | null
  criadoEm: string
  atualizadoEm: string          // chave do LWW
  arquivadaEm: string | null
  concluidaEm: string | null
}
```

**Ativa** = `arquivadaEm === null && concluidaEm === null`. Existe no máximo
uma; a invariante é mantida na escrita (ver "Iniciar uma jornada").

**Não existe `fimOrdem`.** O escopo já define onde a rota termina. O campo cabe
depois, sem migração destrutiva, se algum dia surgir "de Gênesis a
Deuteronômio".

### O que `contaDesde` compra

Um campo só cobre três operações, e as três são a **mesma** derivação com
`desde` diferente — não há dois caminhos de código para discordarem:

| Ação | Efeito |
|---|---|
| Criar em modo **Continuar** | `contaDesde = null` — pula o que já foi lido; a barra já nasce parcialmente cheia |
| Criar em modo **Reler** | `contaDesde = criadoEm` — barra em 0, cursor no `inicioOrdem` |
| **Reiniciar** a jornada | `contaDesde = agora`, `concluidaEm = null` — dá a volta de novo |

`contaDesde` é uma **âncora de visão**, não uma operação destrutiva: a barra da
jornada zera, mas o ✓ do Índice, as barras por livro e o streak seguem
intactos. Essa distinção é deliberada e precisa sobreviver à interface (ver a
seção de fronteira).

## Escopos e a escada de tamanhos

| | `tipo` | `escopo` | exemplo |
|---|---|---|---|
| Curta | `livro` | nome do livro | Jonas |
| Média | `bloco` | id do bloco | Evangelhos |
| Longa | `sequencia` | `vt` \| `nt` | Novo Testamento |
| Inteira | `sequencia` | `biblia` | A Bíblia toda |

A tabela de blocos vive em `src/lib/blocos.ts`, indexada por `abbrev` — mesmo
formato do `NT_ABBREVS` que já existe em `src/lib/testament.ts`. Oito blocos que
**particionam** os 66 livros: nenhum de fora, nenhum em dois.

| Bloco | `id` | Livros |
|---|---|---|
| Pentateuco | `pentateuco` | Gn Êx Lv Nm Dt (5) |
| Históricos | `historicos` | Js Jz Rt 1Sm 2Sm 1Rs 2Rs 1Cr 2Cr Ed Ne Et (12) |
| Poéticos e Sabedoria | `poeticos` | Jó Sl Pv Ec Ct (5) |
| Profetas Maiores | `profetas-maiores` | Is Jr Lm Ez Dn (5) |
| Profetas Menores | `profetas-menores` | Os Jl Am Ob Jn Mq Na Hc Sf Ag Zc Ml (12) |
| Evangelhos | `evangelhos` | Mt Mc Lc Jo (4) |
| Atos e as Cartas de Paulo | `paulo` | At Rm 1Co 2Co Gl Ef Fp Cl 1Ts 2Ts 1Tm 2Tm Tt Fm (14) |
| Hebreus a Apocalipse | `hebreus-apocalipse` | Hb Tg 1Pe 2Pe 1Jo 2Jo 3Jo Jd Ap (9) |

39 + 27 = 66.

> **Armadilha verificada no dataset:** `Jó` (o livro de Jó) e `Jo` (João)
> diferem apenas pelo acento. Um acento perdido move Jó dos Poéticos para os
> Evangelhos **sem erro nenhum** — a rota só fica silenciosamente errada. O
> teste de partição (abaixo) é o que pega isso.

## Rota, derivação e cursor

Toda a regra vive em `src/lib/jornadas.ts`, **puro**, no espírito de
`streak.ts` e `content.ts`: nenhum acesso a IndexedDB, testável sem mock de
storage. O CRUD fica em `user-db.ts`, que é o dono do schema.

### A rota

```ts
export function rotaDaJornada(j: Jornada, indice: PericopeIndex[]): number[] {
  const seq =
    j.tipo === 'livro'
      ? indice.filter((p) => p.livro === j.escopo).map((p) => p.ordem)
      : j.tipo === 'bloco'
        ? indice.filter((p) => abbrevsDoBloco(j.escopo).has(p.abbrev)).map((p) => p.ordem)
        : j.escopo === 'biblia'
          ? indice.map((p) => p.ordem)
          : ordensDoTestamento(indice, j.escopo as Testament)   // já existe em content.ts
  const i = seq.indexOf(j.inicioOrdem)
  // -1 só ocorre se o catálogo mudou debaixo de uma jornada antiga. Degrada
  // para o escopo inteiro — nunca para uma jornada vazia.
  return seq.slice(i < 0 ? 0 : i)
}
```

O corte é **posicional** (`indexOf` + `slice`), não numérico
(`filter(o => o >= inicioOrdem)`). Na ordem canônica os dois coincidem; na
cronológica que virá, as ordens não são crescentes e só o posicional está
certo. `rotaDaJornada` é o único ponto de extensão para `'cronologica'`.

### O predicado, um só

```ts
export function contaComoLida(p: Progresso | undefined, desde: string | null): boolean {
  if (!p || p.status !== 'concluido') return false
  return desde === null || p.atualizadoEm >= desde
}
```

Comparação lexicográfica de ISO — a mesma convenção que `remoteWinsLocal`
(`sync-merge.ts`) e `getPosicaoMaisRecente` (`user-db.ts`) já usam. Nenhuma
segunda noção de tempo entra no repo.

### Barra e cursor

```ts
export type ProgressoJornada = {
  total: number
  concluidas: number
  pct: number                  // 0–100, arredondado
  proximaOrdem: number | null  // null = a rota acabou
}

export function progressoDaJornada(
  rota: number[],
  progressos: Map<number, Progresso>,
  desde: string | null,
): ProgressoJornada
```

`proximaOrdem` é a **primeira da rota que reprova no mesmo predicado** que
alimenta `concluidas`. Isso é o ponto: se a barra dissesse "0 de 431" e o
cursor pulasse para o meio (porque aquilo foi lido em outra época), a jornada
se contradiria na mesma tela.

O cursor final repete a heurística que a Home já usa hoje — o checkpoint mais
recente ganha da primeira-não-concluída, porque é o que retoma uma perícope
longa deixada no meio — com **uma regra a mais**:

> Numa jornada em modo reler (`contaDesde !== null`), o checkpoint só vale se
> `posicao.atualizadoEm >= contaDesde`.

Sem isso, uma jornada de releitura devolveria o leitor no meio da passada
anterior — exatamente o que ela existe para não fazer.

### Fim de jornada, nos dois sentidos

`concluidaEm` precisa estar persistido (é ele que tira a jornada do posto de
ativa), mas quem o descobre é a derivação. O caminho de carga da Home e da tela
`/jornada` reconcilia, idempotente:

- `proximaOrdem === null && concluidaEm === null` → grava `concluidaEm`
- `proximaOrdem !== null && concluidaEm !== null` → limpa `concluidaEm`

O segundo caso não é hipotético: é o que acontece quando a feature paralela
desmarcar uma perícope de uma jornada já terminada. A jornada se reabre
sozinha, sem código especial para o caso.

### Uma limpeza junto

A Home hoje chama `doneSet()` dentro do laço dos testamentos — quatro varreduras
completas de `progresso` por render. A nova carga faz `listAllProgresso()`
**uma vez**, vira um `Map<number, Progresso>` e o passa às funções puras. É
melhoria dentro do código que esta fase já reescreve, não refactor oportunista.

## Persistência e sync

Quinta entidade sincronizada, seguindo a receita das quatro existentes sem
inventar nada. `migrations/0008_posicao_leitura.sql` é o molde literal.

**`migrations/0009_jornadas.sql`** — tabela `jornada`:

| coluna | papel |
|---|---|
| `user_id` | FK `user(id)` `ON DELETE CASCADE` |
| `id` | uuid do cliente |
| `nome`, `tipo`, `escopo` | TEXT |
| `inicio_ordem` | INTEGER |
| `conta_desde`, `arquivada_em`, `concluida_em` | TEXT nullable |
| `criado_em`, `atualizado_em` | TEXT |
| `apagado_em` | lápide |
| `server_em` | cursor de pull |

PK `(user_id, id)`; índice `(user_id, server_em)`.

**Cliente** (`src/lib/user-db.ts`): store `jornadas`, keyPath `id`;
`DB_VERSION` 4 → 5; `OutboxItem` ganha
`{ kind: 'jornada'; jornada: Jornada; apagadoEm: string | null }`;
`applyRemoteJornadas` no molde dos outros `applyRemote*` (devolve quantas
linhas mudaram, para o live refresh); e `jornadas` entra em
`clearAllUserData`.

Escrita segue o padrão da casa: linha e item de outbox **na mesma transação**,
para uma aba morta no meio não gravar uma sem a outra.

**Worker** (`worker/sync-logic.ts`, `worker/index.ts`, `src/lib/sync.ts`):
quinto grupo, simétrico aos quatro atuais — validação, chunking por
`MAX_ITENS_POR_LOTE`, LWW por `atualizado_em`, pull por `server_em`.

**Validação no Worker** (mesma motivação de `VERSE_ID_RE` e `POSICAO_REF_RE`:
um item inválido no outbox trava o sync para sempre, então recusa-se na
escrita **e** na borda):
- `tipo` ∈ `{sequencia, bloco, livro}`
- `escopo` não-vazio, com teto de tamanho
- `inicioOrdem` inteiro seguro `>= 0` (o `isOrdem` que já existe)
- `nome` truncado em **120 caracteres** no ponto de escrita — mesmo padrão de
  `saveAnotacao` com `MAX_TEXTO`, mas com teto próprio: nome de jornada não é
  corpo de anotação

**Cardinalidade:** dezenas de linhas por usuário, no pior caso. Não reabre o
problema de paginação de pull que o backlog registra em destaques.

## Telas

### Home — dois estados, sem meio-termo

- **Com jornada ativa:** um card só, grande. Nome, "12 de 87", barra, e o
  `Continuar` vindo do cursor. Ele **substitui** os cards VT/NT. Ter os dois
  seria dois lugares dizendo "continue de onde parou" com números diferentes.
  Quem quiser ler solto continua indo pelo Índice.
- **Sem jornada ativa:** a Home de hoje, intacta (VT/NT e o streak), mais uma
  chamada — "Comece uma jornada" se logado, "Entre para criar jornadas" se
  não. O funcionamento offline sem login não regride em nada.

### Onde encaixa o "Vale reler" da fase paralela

Esta fase é dona da estrutura da Home, então decide o lugar: o bloco **"Vale
reler"** entra **abaixo** do conteúdo principal, nos dois estados da Home
(card da jornada ativa, ou trilhas VT/NT quando não há jornada), e fica oculto
quando vazio. Abaixo, e não acima, porque a Home responde primeiro "para onde
eu vou agora" — releitura é oferta, não instrução.

### `/jornada`

1. A jornada ativa: progresso, **Reiniciar** (`contaDesde = agora`) e
   **Encerrar** (`arquivadaEm = agora`).
2. O catálogo de escopos, agrupado pela escada de quatro degraus, com o tamanho
   de cada um ("87 perícopes · ~6 h", somando o `minutos` que já existe no
   índice).
3. As jornadas anteriores, em lista quieta.

### Criar — dois passos

1. Escolher o escopo no catálogo.
2. Confirmar: nome pré-preenchido e editável; **começar em** (padrão o início,
   com a opção "de onde parei" pré-preenchida do checkpoint mais recente dentro
   do escopo); e **modo** (Continuar / Reler). Havendo jornada ativa, o aviso de
   que ela será arquivada aparece **aqui, antes do botão** — não depois do fato.

**Nome padrão**, calculado no passo 2 e editável: o nome do livro (`Jonas`), o
nome do bloco (`Evangelhos`), `Velho Testamento` / `Novo Testamento`, ou
`A Bíblia toda`. Quando `inicioOrdem` não é o começo da rota, ganha o sufixo
` a partir de <refLabel>` — `Novo Testamento a partir de Romanos 1:1`.

**Aviso de escopo já concluído.** No modo Continuar, se o escopo inteiro já
estiver lido, a jornada nasceria e seria imediatamente marcada como concluída
pela reconciliação. O passo 2 detecta isso antes de gravar e diz — "você já leu
tudo desse escopo; em modo Reler ela começa do zero" — deixando a escolha com o
leitor em vez de entregar uma jornada natimorta.

### Iniciar uma jornada (a invariante)

Numa transação só sobre `jornadas` + `outbox`: arquiva a ativa (se houver) e
grava a nova, com um item de outbox para cada. Duas abas não podem produzir
duas ativas; e se ainda assim o pull trouxer duas de aparelhos diferentes, a
leitura resolve por `atualizadoEm` mais recente e arquiva a perdedora na
reconciliação da carga.

### Header

O item vira **"Jornada"**, singular — mais curto e, com uma ativa por vez,
literalmente correto.

**O risco de adensamento foi resolvido fora desta fase** (decidido com o
usuário em 2026-09-03): `Hoje` sai da nav, porque a marca já é
`<NavLink to="/">` e faz exatamente a mesma coisa. A nav vai de
`Hoje · Índice · Pesquisar · Entrar` para
`Jornada · Índice · Pesquisar · Perfil` — mesmo número de itens de antes,
mesmo tendo ganhado `Jornada`.

Essa reorganização do chrome (remover `Hoje`, trocar `Sair` por um menu
`Perfil` que absorve o `ThemeMenu` e as preferências do `Aa`, e retirar o pill
`.ref-nav` da Leitura) é **tarefa própria**, com desenho separado. Esta fase
depende dela apenas em não introduzir um 5º item — e não introduz.

## Fronteira com releitura e esquecimento

Contrato **acordado** com a sessão paralela em 2026-09-03 (spec de lá:
`docs/superpowers/specs/2026-09-03-releitura-esquecimento-design.md`,
commit `dc447d8`). Não é mais hipótese — está fechado dos dois lados.

> Jornadas consomem **apenas** o predicado "existe uma conclusão da perícope
> `o` com timestamp `>= desde`". Nunca tocam no formato de armazenamento de
> `progresso`.

**Onde o predicado mora.** `contaComoLida(p, desde)` — assinatura exatamente a
desta spec — sai de `src/lib/jornadas.ts` e passa a viver em
**`src/lib/conclusao.ts`**, arquivo da outra fase. Jornadas importa de lá. Isso
é o que permite trocarem o corpo da função sem abrir nenhum arquivo desta fase.
Ela sai na primeira fatia de lá, sobre o modelo atual e sem migration — então
esta fase não fica bloqueada em momento nenhum.

`conclusao.ts` também expõe `concluidaDesde(ordem, desde)` e
`concluidasDesde(ordens, desde)` (async, uma varredura só). Esta fase **não as
usa**: `progressoDaJornada(rota, Map, desde)` já recebe o `Map` pronto da
carga única da Home, o que é estritamente melhor. O açúcar existe para outros
consumidores.

**`progresso` não muda de forma.** Continua uma linha por perícope, com
`status` e `atualizadoEm` como hoje, e `atualizadoEm` continua sendo a chave do
LWW. A outra fase acrescenta dois campos **aditivos** — `historico: string[]`
(conclusões em ISO, mais nova primeiro, teto 50) e `paraReler: boolean`. O
`Map<number, Progresso>` desta fase segue funcionando sem uma linha de
mudança; depois da fatia 1 de lá, o corpo de `contaComoLida` troca
`p.atualizadoEm` por `p.historico[0]`, que é o máximo e mantém o predicado
O(1).

**O streak.** `computeStreak` continua puro e intacto; quem muda de fonte é
`diasComConclusao`, e só na última fatia de lá. Para a Home desta fase não
sentir isso, `streak.ts` passa a expor `streakAtual(): Promise<Streak>` e a
Home chama só isso — recíproca exata do seam `contaComoLida`.
`progressoPorLivro` não é tocado por nenhuma das duas fases.

**Numeração, confirmada com a outra sessão:** esta fase fica com
`migrations/0009` e `DB_VERSION` 4 → 5; a outra fase fica com `0010` e 5 → 6.
Os blocos `if (oldVersion < N)` compõem sem conflito.

### A distinção que precisa sobreviver à interface

- **Reiniciar jornada** (`contaDesde`) é uma **âncora de visão**. Não muda nada
  visível fora da barra da própria jornada.
- **Zerar / esquecer** (fase paralela) é **destrutivo**: tira o ✓ de centenas
  de linhas do Índice e derruba as barras por livro.

Correção registrada: uma versão anterior desta spec afirmava que zerar também
derrubaria o streak. **Está errado** — o usuário decidiu o contrário, e o
histórico de conclusões nunca é apagado, então streak e recorde sobrevivem a
"zerar tudo". A diferença entre as duas ações continua gritante sem sacrificar
o streak.

## Riscos

1. **Nav a 360 px.** Acima; medir, com plano B definido.
2. **`Jó` vs `Jo`.** Acima; coberto por teste de partição.
3. **Mudança de catálogo sob jornada antiga.** `inicioOrdem` some da rota
   (`indexOf` = -1). Degrada para o escopo inteiro, nunca para vazio.
4. **Duas ativas vindas de aparelhos diferentes.** Resolvido na reconciliação
   da carga por `atualizadoEm` mais recente.
5. **Colisão com a fase paralela.** Rebaixado em 2026-09-03: o seam
   `contaComoLida` foi acordado, `progresso` mantém a forma atual (campos novos
   são aditivos), a numeração de migration e de `DB_VERSION` está dividida, e
   `streak.ts` ganha o seam recíproco `streakAtual()`. Resta apenas coordenação
   de merge nos arquivos compartilhados de sync, quando a fatia 3 de lá subir
   `paginarPull` de 4 para 5 listas — e eles avisam antes de encostar.

## Critérios de aceite

1. Criar jornada de cada um dos quatro tamanhos (livro, bloco, testamento,
   Bíblia) e ver a rota e o total corretos.
2. Criar jornada do AT começando em Isaías 40: total conta só de Isaías 40 a
   Malaquias; a barra começa em 0 no modo reler.
3. Modo **Continuar** numa jornada de livro já lido: a barra nasce cheia e a
   jornada é reconhecida como concluída.
4. Modo **Reler** no mesmo livro: barra em 0, cursor na primeira perícope, e o
   ✓ do Índice **permanece**.
5. Concluir uma perícope do escopo chegando pelo Índice credita a jornada.
6. Barra e cursor nunca se contradizem: com a barra em `0 de N`, `Continuar`
   aponta para `inicioOrdem`.
7. Iniciar uma segunda jornada arquiva a primeira; o histórico a mostra.
8. Concluir a última perícope da rota marca `concluidaEm`; desmarcá-la depois
   reabre a jornada. Confirmado com a fase paralela: o predicado exige
   `status === 'concluido'` além da data, então desmarcar faz a jornada
   regredir. Testável por unidade sobre `progressoDaJornada` desde já.
9. A jornada sincroniza entre dois aparelhos logados na mesma conta.
10. Deslogado, a Home é exatamente a de hoje e nada quebra offline.
11. Teste de partição: os 8 blocos cobrem os 66 livros do `index.json`, sem
    sobra e sem repetição.
