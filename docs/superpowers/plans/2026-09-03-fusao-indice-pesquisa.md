# Fusão do Índice com a Pesquisa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundir `src/pages/Indice.tsx` e `src/pages/Pesquisar.tsx` numa tela só, `/explorar`, cujo estado de repouso é um catálogo navegável dos 66 livros e que vira busca conforme se digita, sem trocar de modo.

**Architecture:** Um parser puro (`consulta.ts`) classifica o que foi digitado sem escolher um modo: o resultado é aditivo (pode ter referência **e** livros **e** títulos). A página empilha quatro seções — Referência, Livros, Títulos, No texto — e a seção que não casa não aparece. As três primeiras saem de `index.json`, já carregado; só "No texto" espera os shards. Dois componentes novos são reusados em mais de um lugar: `CatalogoLivros` serve o repouso e a seção "Livros"; `ListaPericopes` serve "Títulos", "No texto" e o livro aberto.

**Tech Stack:** React 19 + react-router-dom, TypeScript, Vite, vitest + happy-dom, IndexedDB via `idb`. Sem bibliotecas novas.

**Spec:** `docs/superpowers/specs/2026-09-03-fusao-indice-pesquisa-design.md`

## Global Constraints

- **Nenhum teste pode ler `public/data/index.json`.** É derivado e gitignored (`.gitignore:29`), gerado por `npm run shard`. A CI roda `npm test` (passo 19) **antes** do build que o gera (passo 21): um teste assim passa localmente e quebra a CI com `ENOENT`. Fontes permitidas: `src/lib/bible-books.ts`, `data/pericopes.json` (versionado), ou fixtures literais montadas no próprio teste.
- **Baseline de testes: 52 arquivos / 654 testes** (era 39/435 quando este plano foi escrito; a `main` foi mesclada nesta branch no commit `87b2723`, trazendo jornadas, releitura e chrome). Na `main` o vitest também coleta as outras worktrees e mostra um número maior — não é cobertura a mais.
- **Rode `npx tsc -b` além de `npm test` antes de cada commit.** O vitest NÃO faz checagem de tipo: quando o merge tornou `historico` e `paraReler` obrigatórios em `Progresso`, a suíte continuou verde com 654 testes e só o `tsc -b` acusou o literal quebrado. Suíte verde não é evidência de build são.
- **`src/styles/app.css` é tocado por quatro sessões: só ACRESCENTAR blocos, nunca reescrever os existentes.** Blocos novos vão no fim do arquivo. Não encostar em `.top`, `.top nav`, `.theme-menu`, `.theme-toggle`, `.ref-row`, `.ref-nav`, `.ref-arrow`, `.section-chips` — são de outra sessão. `.ref-sticky` (`app.css:2105`) é nosso.
- **Comentários e mensagens de commit em português**, seguindo o repositório. Comentário explica *por quê*, não *o quê*.
- **Ordem de merge acordada:** jornadas → releitura → chrome → esta. `src/App.tsx` só é editado na Task 8, e **por conteúdo, nunca por número de linha** — a sessão do chrome reescreve a nav antes e os números vão andar.
- Rodar `npm run lint` (oxlint) além de `npm test` antes de cada commit.

---

### Task 1: Parser da consulta (`src/lib/consulta.ts`)

Função pura que classifica o que foi digitado. É a peça que substitui os dois modos do Pesquisar e a busca por referência do Índice.

**Files:**
- Create: `src/lib/consulta.ts`
- Create: `src/lib/consulta.test.ts`
- Modify: `src/lib/bible-books.ts:1743-1748` (tornar `norm` exportada)

**Interfaces:**
- Consumes: `BIBLE_BOOKS`, `filterBooks`, `maxChapter`, `maxVerse`, `BibleBook` de `./bible-books`; `MIN_CHARS` de `./fulltext`.
- Produces:
  - `type RefParseada = { livro: BibleBook; cap: number; ver: number | null }`
  - `type Consulta = { termo: string; ref: RefParseada | null; refForaDeFaixa: (RefParseada & { motivo: string }) | null; livros: BibleBook[]; buscarNoTexto: boolean }`
  - `function parseConsulta(entrada: string): Consulta`
  - `function normalizarNome(s: string): string` (de `bible-books.ts`)

- [ ] **Step 1: Exportar o normalizador de `bible-books.ts`**

Em `src/lib/bible-books.ts`, trocar a função privada `norm` (linha 1743) por uma exportada, e ajustar os dois usos dentro de `filterBooks`:

```ts
/** Minúsculas sem diacríticos — o casamento de NOME de livro ignora acento. */
export function normalizarNome(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function filterBooks(q: string): BibleBook[] {
  const needle = normalizarNome(q.trim())
  if (!needle) return BIBLE_BOOKS
  return BIBLE_BOOKS.filter(
    (b) => normalizarNome(b.name).includes(needle) || normalizarNome(b.abbrev).includes(needle),
  )
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/lib/consulta.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseConsulta } from './consulta'
import { BIBLE_BOOKS } from './bible-books'

describe('parseConsulta — referência', () => {
  it('abbrev + capítulo + versículo', () => {
    const c = parseConsulta('Jo 3:16')
    expect(c.ref?.livro.name).toBe('João')
    expect(c.ref?.cap).toBe(3)
    expect(c.ref?.ver).toBe(16)
  })

  it('não busca no texto quando é referência — "jo 3:16" não é um trecho', () => {
    expect(parseConsulta('Jo 3:16').buscarNoTexto).toBe(false)
  })

  it('a seção Livros mostra o livro da referência', () => {
    expect(parseConsulta('Jo 3:16').livros.map((b) => b.name)).toEqual(['João'])
  })

  it('só capítulo, sem versículo', () => {
    const c = parseConsulta('Salmos 23')
    expect(c.ref?.livro.name).toBe('Salmos')
    expect(c.ref?.cap).toBe(23)
    expect(c.ref?.ver).toBeNull()
  })

  it('aceita ponto e vírgula como separador de versículo', () => {
    expect(parseConsulta('Jo 3.16').ref?.ver).toBe(16)
    expect(parseConsulta('Jo 3,16').ref?.ver).toBe(16)
  })

  it('o espaço do ordinal não conta: "1 co 13" é 1 Coríntios 13', () => {
    const c = parseConsulta('1 co 13')
    expect(c.ref?.livro.name).toBe('1 Coríntios')
    expect(c.ref?.cap).toBe(13)
  })

  it('nome completo com ordinal', () => {
    expect(parseConsulta('1 Samuel 3').ref?.livro.name).toBe('1 Samuel')
  })
})

describe('parseConsulta — a colisão jo/jó', () => {
  it('abbrev é sensível a acento: "jo 3:16" é João', () => {
    expect(parseConsulta('jo 3:16').ref?.livro.name).toBe('João')
  })

  it('abbrev é sensível a acento: "jó 3:16" é Jó', () => {
    expect(parseConsulta('jó 3:16').ref?.livro.name).toBe('Jó')
  })

  it('"jo" sozinho não é referência e lista os cinco livros que começam com jo', () => {
    const c = parseConsulta('jo')
    expect(c.ref).toBeNull()
    expect(c.livros.map((b) => b.name)).toEqual(['Josué', 'Jó', 'Joel', 'Jonas', 'João'])
  })

  it('fronteira de palavra: "josue 3" é Josué, não João seguido de "sue 3"', () => {
    expect(parseConsulta('josue 3').ref?.livro.name).toBe('Josué')
  })
})

describe('parseConsulta — fora de faixa', () => {
  it('capítulo alto demais explica em vez de sumir', () => {
    const c = parseConsulta('João 99')
    expect(c.ref).toBeNull()
    expect(c.refForaDeFaixa?.motivo).toBe('João tem 21 capítulos.')
    expect(c.buscarNoTexto).toBe(false)
    expect(c.livros.map((b) => b.name)).toEqual(['João'])
  })

  it('versículo alto demais explica', () => {
    const c = parseConsulta('João 3:99')
    expect(c.refForaDeFaixa?.motivo).toBe('João 3 tem 36 versículos.')
  })
})

describe('parseConsulta — texto livre', () => {
  it('sem token de livro, busca no texto', () => {
    const c = parseConsulta('amor de Deus')
    expect(c.ref).toBeNull()
    expect(c.livros).toEqual([])
    expect(c.buscarNoTexto).toBe(true)
  })

  it('nome de livro sozinho é ambíguo: livro E busca no texto', () => {
    const c = parseConsulta('josué')
    expect(c.ref).toBeNull()
    expect(c.livros.map((b) => b.name)).toEqual(['Josué'])
    expect(c.buscarNoTexto).toBe(true)
  })

  it('abaixo de MIN_CHARS não busca no texto', () => {
    expect(parseConsulta('am').buscarNoTexto).toBe(false)
  })

  it('vazio é vazio', () => {
    const c = parseConsulta('   ')
    expect(c.termo).toBe('')
    expect(c.livros).toEqual([])
    expect(c.buscarNoTexto).toBe(false)
  })

  it('referência sem livro cai no texto — "3:16" sozinho tem 66 respostas', () => {
    const c = parseConsulta('3:16')
    expect(c.ref).toBeNull()
    expect(c.buscarNoTexto).toBe(true)
  })
})

describe('parseConsulta — cobertura dos 66', () => {
  it('todo nome de livro + capítulo 1 vira referência para o livro certo', () => {
    for (const b of BIBLE_BOOKS) {
      expect(parseConsulta(`${b.name} 1`).ref?.livro.name).toBe(b.name)
    }
  })

  it('todo abbrev + capítulo 1 vira referência para o livro certo', () => {
    for (const b of BIBLE_BOOKS) {
      expect(parseConsulta(`${b.abbrev} 1`).ref?.livro.name).toBe(b.name)
    }
  })
})
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/consulta.test.ts`
Expected: FAIL — `Failed to resolve import "./consulta"`.

- [ ] **Step 4: Escrever a implementação**

Criar `src/lib/consulta.ts`:

```ts
import {
  BIBLE_BOOKS,
  filterBooks,
  maxChapter,
  maxVerse,
  normalizarNome,
  type BibleBook,
} from './bible-books'
import { MIN_CHARS } from './fulltext'

export type RefParseada = { livro: BibleBook; cap: number; ver: number | null }

export type Consulta = {
  /** A consulta aparada, do jeito que foi digitada. */
  termo: string
  /** Preenchida só quando há token de livro + número DENTRO da faixa do livro. */
  ref: RefParseada | null
  /** Token de livro + número fora da faixa: a seção explica em vez de sumir calada. */
  refForaDeFaixa: (RefParseada & { motivo: string }) | null
  /** Livros cujo nome ou abbrev casa com o termo. */
  livros: BibleBook[]
  buscarNoTexto: boolean
}

/**
 * "1 co 13" → "1co 13". O espaço depois do numeral ordinal não conta: é assim
 * que as pessoas digitam, e aplicar a mesma regra ao alias ("1 Samuel" →
 * "1samuel") mantém os dois lados simétricos.
 */
function juntarOrdinal(s: string): string {
  return s.replace(/^(\d)\s+/, '$1')
}

/** Prefixo só casa se terminar em fim de string ou em caractere não-letra —
 *  sem isso "jo" casaria dentro de "josue". */
function casaPrefixo(alvo: string, prefixo: string): boolean {
  if (!prefixo || !alvo.startsWith(prefixo)) return false
  const seguinte = alvo[prefixo.length]
  return seguinte === undefined || !/\p{L}/u.test(seguinte)
}

/**
 * Classifica a consulta SEM escolher um modo: o resultado é aditivo, e uma
 * mesma consulta pode ter referência, livros e ainda buscar no texto.
 *
 * Adivinhar o modo seria errado por medição: 46 dos 66 nomes de livro também
 * são palavras do texto bíblico (Josué=232, João=155) e o abbrev "Os" tem
 * 15.321 ocorrências do artigo. Já "token de livro + dígito" aparece 1 vez em
 * 4,1 MB — por isso só o dígito autoriza tratar como referência.
 */
export function parseConsulta(entrada: string): Consulta {
  const termo = entrada.trim()
  if (!termo) {
    return { termo, ref: null, refForaDeFaixa: null, livros: [], buscarNoTexto: false }
  }

  const semRef: Consulta = {
    termo,
    ref: null,
    refForaDeFaixa: null,
    livros: filterBooks(termo),
    buscarNoTexto: termo.length >= MIN_CHARS,
  }

  // Dois alvos: o casamento de NOME ignora acento, o de ABBREV não. É o que
  // separa "jo" (João) de "jó" (Jó) — a única colisão entre os 132 aliases.
  const semAcento = juntarOrdinal(normalizarNome(termo))
  const comAcento = juntarOrdinal(termo.toLowerCase())

  let melhor: { livro: BibleBook; comprimento: number } | null = null
  for (const livro of BIBLE_BOOKS) {
    const tentativas: readonly (readonly [string, string])[] = [
      [semAcento, juntarOrdinal(normalizarNome(livro.name))],
      [comAcento, juntarOrdinal(livro.abbrev.toLowerCase())],
    ]
    for (const [alvo, alias] of tentativas) {
      if (!casaPrefixo(alvo, alias)) continue
      if (!melhor || alias.length > melhor.comprimento) {
        melhor = { livro, comprimento: alias.length }
      }
    }
  }
  if (!melhor) return semRef

  // `semAcento` e `comAcento` têm o mesmo comprimento para texto pré-composto
  // (é o caso da NAA). Se algum dia não tiverem, o corte falha o regex abaixo e
  // a consulta degrada para texto livre — nunca para uma referência errada.
  const resto = semAcento.slice(melhor.comprimento).trim()
  const m = /^(\d+)(?:[:.,](\d+))?$/.exec(resto)
  if (!m) return semRef

  const livro = melhor.livro
  const cap = Number(m[1])
  const ver = m[2] === undefined ? null : Number(m[2])
  const base: RefParseada = { livro, cap, ver }
  const comLivro = { ...semRef, livros: [livro], buscarNoTexto: false }

  if (cap < 1 || cap > maxChapter(livro)) {
    return {
      ...comLivro,
      refForaDeFaixa: { ...base, motivo: `${livro.name} tem ${maxChapter(livro)} capítulos.` },
    }
  }
  const verMax = maxVerse(livro, cap)
  if (ver !== null && (ver < 1 || ver > verMax)) {
    return {
      ...comLivro,
      refForaDeFaixa: { ...base, motivo: `${livro.name} ${cap} tem ${verMax} versículos.` },
    }
  }
  return { ...comLivro, ref: base }
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/consulta.test.ts src/lib/fulltext.test.ts`
Expected: PASS. `fulltext.test.ts` entra junto porque `bible-books.ts` mudou e ele importa a cadeia.

- [ ] **Step 6: Suíte inteira e lint**

Run: `npm test && npm run lint`
Expected: 40 arquivos / 435+ testes verdes (baseline 39/435 mais o arquivo novo). Zero erros de lint.

- [ ] **Step 7: Commit**

```bash
git add src/lib/consulta.ts src/lib/consulta.test.ts src/lib/bible-books.ts
git commit -m "feat: parser de consulta que não escolhe modo

Classifica o que foi digitado de forma aditiva: uma consulta pode ter
referência, livros e ainda buscar no texto. Só o dígito autoriza tratar
como referência — 46 dos 66 nomes de livro também são palavras do texto,
mas token de livro + dígito aparece 1 vez em 4,1 MB.

O casamento de abbrev é sensível a acento e o de nome não, que é o que
separa \"jo\" (João) de \"jó\" (Jó) — a única colisão entre os 132 aliases."
```

---

### Task 2: Filtro de leitura (`src/lib/content.ts`)

Predicado puro dos quatro chips, e a contagem por livro dentro do recorte ativo.

**Files:**
- Modify: `src/lib/content.ts` (acrescentar ao fim)
- Modify: `src/lib/content.test.ts` (acrescentar describes)

**Interfaces:**
- Consumes: `Progresso`, `ProgressoStatus` de `./types`.
- Produces:
  - `type FiltroLeitura = 'todos' | 'nao-lidos' | 'comecei' | 'lidos'`
  - `function aceitaFiltro(status: ProgressoStatus | undefined, filtro: FiltroLeitura): boolean`
  - `function statusPorOrdem(todos: Progresso[]): Map<number, ProgressoStatus>`
  - `function filtroDeOrdens(status: Map<number, ProgressoStatus>, filtro: FiltroLeitura): (ordem: number) => boolean`
  - `function contagemPorLivro(all: PericopeIndex[], aceita: (ordem: number) => boolean): Map<string, number>`

`progressoPorLivro` **não muda** — a sessão de releitura depende da assinatura atual (`Set<number>`).

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `src/lib/content.test.ts`:

```ts
import {
  aceitaFiltro,
  contagemPorLivro,
  filtroDeOrdens,
  statusPorOrdem,
} from './content'
import type { Progresso } from './types'

function prog(ordem: number, status: Progresso['status']): Progresso {
  return { pericopeOrdem: ordem, status, atualizadoEm: '2026-09-03T00:00:00.000Z' }
}

describe('aceitaFiltro', () => {
  it('"todos" aceita tudo, inclusive sem registro', () => {
    expect(aceitaFiltro(undefined, 'todos')).toBe(true)
    expect(aceitaFiltro('concluido', 'todos')).toBe(true)
  })

  it('"lidos" é só concluído', () => {
    expect(aceitaFiltro('concluido', 'lidos')).toBe(true)
    expect(aceitaFiltro('em_andamento', 'lidos')).toBe(false)
    expect(aceitaFiltro(undefined, 'lidos')).toBe(false)
  })

  it('"comecei" é só em_andamento', () => {
    expect(aceitaFiltro('em_andamento', 'comecei')).toBe(true)
    expect(aceitaFiltro('concluido', 'comecei')).toBe(false)
    expect(aceitaFiltro(undefined, 'comecei')).toBe(false)
  })

  it('"nao-lidos" é tudo que não concluiu — sem registro conta como não lido', () => {
    expect(aceitaFiltro(undefined, 'nao-lidos')).toBe(true)
    expect(aceitaFiltro('nao_iniciado', 'nao-lidos')).toBe(true)
    expect(aceitaFiltro('em_andamento', 'nao-lidos')).toBe(true)
    expect(aceitaFiltro('concluido', 'nao-lidos')).toBe(false)
  })

  it('"comecei" é subconjunto de "nao-lidos", de propósito', () => {
    expect(aceitaFiltro('em_andamento', 'comecei')).toBe(true)
    expect(aceitaFiltro('em_andamento', 'nao-lidos')).toBe(true)
  })
})

describe('filtroDeOrdens e contagemPorLivro', () => {
  const mapa = statusPorOrdem([prog(1, 'concluido'), prog(3, 'em_andamento')])

  it('o predicado lê o mapa e trata ausência como não iniciado', () => {
    const aceita = filtroDeOrdens(mapa, 'nao-lidos')
    expect(aceita(1)).toBe(false)
    expect(aceita(2)).toBe(true)
    expect(aceita(3)).toBe(true)
  })

  it('conta por livro só o que o predicado aceita', () => {
    const c = contagemPorLivro(ALL, filtroDeOrdens(mapa, 'nao-lidos'))
    expect(c.get('Gn')).toBe(1)
    expect(c.get('Mt')).toBe(2)
  })

  it('livro sem nada no recorte aparece com zero, não some do mapa', () => {
    const c = contagemPorLivro(ALL, filtroDeOrdens(mapa, 'comecei'))
    expect(c.get('Gn')).toBe(0)
    expect(c.get('Mt')).toBe(1)
  })
})
```

`ALL` já existe no arquivo (`peri(1,'Gn')`, `peri(2,'Gn')`, `peri(3,'Mt')`, `peri(4,'Mt')`, e `peri` põe `livro = abbrev`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: FAIL — `aceitaFiltro is not exported`.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `src/lib/content.ts`:

```ts
import type { Progresso, ProgressoStatus } from './types'

/** Os quatro recortes de leitura. São RECORTES, não uma partição: "comecei" é
 *  subconjunto de "nao-lidos", porque "o que me falta" e "o que larguei no
 *  meio" são perguntas diferentes. */
export type FiltroLeitura = 'todos' | 'nao-lidos' | 'comecei' | 'lidos'

/** Perícope sem registro de progresso conta como não iniciada. */
export function aceitaFiltro(
  status: ProgressoStatus | undefined,
  filtro: FiltroLeitura,
): boolean {
  const s = status ?? 'nao_iniciado'
  switch (filtro) {
    case 'todos':
      return true
    case 'lidos':
      return s === 'concluido'
    case 'comecei':
      return s === 'em_andamento'
    case 'nao-lidos':
      return s !== 'concluido'
  }
}

export function statusPorOrdem(todos: Progresso[]): Map<number, ProgressoStatus> {
  return new Map(todos.map((p) => [p.pericopeOrdem, p.status]))
}

export function filtroDeOrdens(
  status: Map<number, ProgressoStatus>,
  filtro: FiltroLeitura,
): (ordem: number) => boolean {
  return (ordem) => aceitaFiltro(status.get(ordem), filtro)
}

/**
 * Quantas perícopes de cada livro sobrevivem ao recorte. Todo livro presente
 * em `all` entra no mapa, inclusive com zero: a tela mostra os 66 livros
 * sempre nos mesmos lugares, e um livro que some conforme se lê desorienta.
 */
export function contagemPorLivro(
  all: PericopeIndex[],
  aceita: (ordem: number) => boolean,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of all) {
    out.set(p.livro, (out.get(p.livro) ?? 0) + (aceita(p.ordem) ? 1 : 0))
  }
  return out
}
```

O `import type { Pericope, PericopeIndex } from './types'` no topo do arquivo passa a incluir `Progresso` e `ProgressoStatus` — juntar no import existente em vez de criar um segundo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Suíte e lint**

Run: `npm test && npm run lint`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content.ts src/lib/content.test.ts
git commit -m "feat: predicado dos quatro recortes de leitura

São recortes, não partição: \"comecei\" é subconjunto de \"nao-lidos\" de
propósito. contagemPorLivro devolve zero em vez de omitir o livro — a tela
mostra os 66 sempre nos mesmos lugares."
```

---

### Task 3: `searchTexto` filtra antes do teto (`src/lib/fulltext.ts`)

Sem isso, "51 achados → 3 não lidos": o teto de 50 corta antes do filtro e esconde casamentos.

**Files:**
- Modify: `src/lib/fulltext.ts:230-251`
- Modify: `src/lib/fulltext.test.ts`

**Interfaces:**
- Produces: `searchTexto(q: string, limit?: number, aceitar?: (ordem: number) => boolean): Promise<FulltextHit[]>` — parâmetro novo e opcional; sem ele o comportamento é idêntico ao de hoje.

- [ ] **Step 1: Escrever o teste que falha**

Ler primeiro `src/lib/fulltext.test.ts` para reaproveitar o mock de `carregarTexto`/`loadIndex` que já existe ali. Acrescentar:

```ts
describe('searchTexto com filtro', () => {
  it('o teto conta os aceitos, não os varridos', async () => {
    const todos = await searchTexto('a', 50)
    const pares = await searchTexto('a', 50, (ordem) => ordem % 2 === 0)
    expect(pares.every((h) => h.ordem % 2 === 0)).toBe(true)
    expect(pares.some((h) => !todos.slice(0, pares.length).includes(h))).toBe(true)
  })

  it('sem o parâmetro, o comportamento não muda', async () => {
    expect(await searchTexto('a', 3)).toEqual(await searchTexto('a', 3, undefined))
  })
})
```

Se as fixtures existentes do arquivo não derem perícopes suficientes para o teto morder, ampliá-las — não trocar de fonte de dado, e **não** ler `public/data/index.json`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/fulltext.test.ts`
Expected: FAIL — o terceiro argumento é ignorado, então `pares` traz ordens ímpares.

- [ ] **Step 3: Implementar**

Em `src/lib/fulltext.ts`, trocar a assinatura e acrescentar a guarda **antes** do `indexOf` (o predicado é mais barato que a varredura):

```ts
export async function searchTexto(
  q: string,
  limit = LIMITE_RESULTADOS,
  aceitar?: (ordem: number) => boolean,
): Promise<FulltextHit[]> {
  const agulha = normalize(q.trim())
  if (agulha.length < MIN_CHARS) return []
  const idx = await buildIndex()

  const hits: FulltextHit[] = []
  for (const e of idx) {
    if (hits.length >= limit) break
    // Antes do indexOf de propósito: o teto precisa contar os ACEITOS. Cortar
    // depois daria "51 achados → 3 não lidos" e esconderia o que passou do teto.
    if (aceitar && !aceitar(e.ordem)) continue
    const pos = e.textoNorm.indexOf(agulha)
    if (pos < 0) continue
    const i = linhaIndexAtOffset(e.linhas, pos)
    if (i < 0) continue
    const linha = e.linhas[i]
    hits.push({
      ordem: e.ordem,
      titulo: e.titulo,
      refLabel: e.ref,
      verseId: verseIdAtOffset(e.linhas, pos) ?? '',
      snippet: snippetAt(linha.texto, pos - linha.inicio, agulha.length),
    })
  }
  return hits
}
```

A única linha nova é a do `aceitar`; o resto do corpo está reproduzido acima
tal como já está no arquivo, para não haver dúvida sobre o que preservar.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/fulltext.test.ts`
Expected: PASS.

- [ ] **Step 5: Suíte, lint e commit**

```bash
npm test && npm run lint
git add src/lib/fulltext.ts src/lib/fulltext.test.ts
git commit -m "feat: searchTexto aceita predicado aplicado antes do teto

O teto de 50 cortava antes de qualquer filtro: com um recorte ativo o
resultado viraria \"51 achados, 3 aceitos\" e esconderia casamentos além do
teto. O predicado entra antes do indexOf, que também é mais barato."
```

---

### Task 4: `ListaPericopes` (`src/components/ListaPericopes.tsx`)

Um `<ul>` de perícopes com ✓, referência e trecho opcional. Serve **três** lugares: "Títulos", "No texto" e o livro aberto.

**Files:**
- Create: `src/components/ListaPericopes.tsx`

**Interfaces:**
- Consumes: `refLabel` de `../lib/content`; `PericopeIndex` de `../lib/types`.
- Produces:
  - `type ItemPericope = { ordem: number; titulo: string; ref: string; verseId?: string; trecho?: { antes: string; marcado: string; depois: string } }`
  - `function itemDeIndice(p: PericopeIndex): ItemPericope`
  - `default function ListaPericopes({ itens, concluidas, compact }: { itens: ItemPericope[]; concluidas: Set<number>; compact?: boolean })`

- [ ] **Step 1: Criar o componente**

```tsx
import { Link } from 'react-router-dom'
import { refLabel } from '../lib/content'
import type { PericopeIndex } from '../lib/types'

export type ItemPericope = {
  ordem: number
  titulo: string
  ref: string
  /** "capitulo:versiculo" para o deep-link `?v=` da Leitura; ausente fora da busca no texto. */
  verseId?: string
  /** Trecho já partido para o <mark>, por `marcarTrecho`. */
  trecho?: { antes: string; marcado: string; depois: string }
}

export function itemDeIndice(p: PericopeIndex): ItemPericope {
  return { ordem: p.ordem, titulo: p.titulo_pericope_pt, ref: refLabel(p) }
}

export default function ListaPericopes({
  itens,
  concluidas,
  compact = false,
}: {
  itens: ItemPericope[]
  concluidas: Set<number>
  compact?: boolean
}) {
  return (
    <ul className={compact ? 'peri-list compact' : 'peri-list'}>
      {itens.map((it) => {
        const done = concluidas.has(it.ordem)
        return (
          <li key={it.ordem}>
            <Link
              to={`/leitura/${it.ordem}${it.verseId ? `?v=${it.verseId}` : ''}`}
              className={done ? 'done' : undefined}
            >
              <span className="peri-row">
                <span className="check" aria-hidden>
                  {done ? '✓' : ''}
                </span>
                <span className="peri-text">
                  <strong>{it.titulo}</strong>
                  <span>{it.ref}</span>
                  {it.trecho && (
                    <span className="hit-snippet">
                      {it.trecho.antes}
                      {it.trecho.marcado && <mark>{it.trecho.marcado}</mark>}
                      {it.trecho.depois}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
```

Nenhum CSS novo: `.peri-list`, `.peri-row`, `.check`, `.peri-text`, `.hit-snippet` e `.peri-list li a.done strong` já existem. O seletor `.peri-list li a span.hit-snippet` (`app.css:2253`) casa por descendência, então o trecho aninhado em `.peri-text` continua estilizado.

- [ ] **Step 2: Typecheck, lint e commit**

Run: `npx tsc -b && npm run lint`
Expected: sem erros. (Ainda não há consumidor; o teste de comportamento vem na Task 8.)

```bash
git add src/components/ListaPericopes.tsx
git commit -m "feat: componente de lista de perícopes reusável

Um só <ul> para os três lugares que listam perícopes: títulos, hits de
texto e o livro aberto. O trecho com <mark> é opcional, e o ?v= vai junto
do item quando existe."
```

---

### Task 5: `CatalogoLivros` (`src/components/CatalogoLivros.tsx`)

Os 66 livros agrupados por Testamento e Seção, uma linha por livro com barra de progresso e a contagem do recorte ativo. Serve **dois** lugares: o repouso e a seção "Livros" dos resultados.

**Files:**
- Create: `src/components/CatalogoLivros.tsx`
- Create: `src/components/CatalogoLivros.test.tsx`

**Interfaces:**
- Consumes: `BIBLE_BOOKS`, `BibleBook` de `../lib/bible-books`; `testamentLabel`, `Testament` de `../lib/testament`; `FiltroLeitura`, `LivroProgresso` de `../lib/content`.
- Produces:
  - `function agruparLivros(livros: BibleBook[]): { testament: Testament; secoes: { secao: string; livros: BibleBook[] }[] }[]`
  - `function rotuloContagem(filtro: FiltroLeitura, prog: LivroProgresso | undefined, noRecorte: number): string`
  - `default function CatalogoLivros({ livros, progresso, contagem, filtro, onAbrir }: ...)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/CatalogoLivros.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { agruparLivros, rotuloContagem } from './CatalogoLivros'
import { BIBLE_BOOKS } from '../lib/bible-books'

describe('agruparLivros', () => {
  it('separa os dois testamentos e preserva a ordem canônica', () => {
    const g = agruparLivros(BIBLE_BOOKS)
    expect(g.map((x) => x.testament)).toEqual(['vt', 'nt'])
    expect(g[0].secoes[0].secao).toBe('Pentateuco')
    expect(g[0].secoes[0].livros[0].name).toBe('Gênesis')
  })

  it('testamento sem livro nenhum não vira grupo vazio', () => {
    const so = BIBLE_BOOKS.filter((b) => b.testament === 'nt')
    expect(agruparLivros(so).map((x) => x.testament)).toEqual(['nt'])
  })

  it('lista vazia não gera grupo', () => {
    expect(agruparLivros([])).toEqual([])
  })
})

describe('rotuloContagem', () => {
  const prog = { livro: 'Gênesis', total: 77, concluidas: 24, pct: 31 }

  it('"todos" mostra concluídas de total', () => {
    expect(rotuloContagem('todos', prog, 77)).toBe('24 de 77')
  })

  it('"nao-lidos" diz quanto resta', () => {
    expect(rotuloContagem('nao-lidos', prog, 53)).toBe('restam 53')
  })

  it('livro sem nada no recorte mostra 0, e não some', () => {
    expect(rotuloContagem('nao-lidos', prog, 0)).toBe('0')
    expect(rotuloContagem('lidos', prog, 0)).toBe('0')
  })

  it('"comecei" e "lidos" mostram só o número', () => {
    expect(rotuloContagem('comecei', prog, 3)).toBe('3')
    expect(rotuloContagem('lidos', prog, 24)).toBe('24')
  })

  it('livro ausente do progresso não quebra', () => {
    expect(rotuloContagem('todos', undefined, 0)).toBe('0 de 0')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/CatalogoLivros.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```tsx
import { BIBLE_BOOKS, type BibleBook } from '../lib/bible-books'
import { testamentLabel, type Testament } from '../lib/testament'
import type { FiltroLeitura, LivroProgresso } from '../lib/content'

export type Grupo = {
  testament: Testament
  secoes: { secao: string; livros: BibleBook[] }[]
}

/** Agrupa mantendo a ordem canônica recebida: seções nascem por transição,
 *  não por ordenação, então a lista nunca é reordenada por baixo do leitor. */
export function agruparLivros(livros: BibleBook[]): Grupo[] {
  const out: Grupo[] = []
  for (const t of ['vt', 'nt'] as const) {
    const doTestamento = livros.filter((b) => b.testament === t)
    if (!doTestamento.length) continue
    const secoes: Grupo['secoes'] = []
    for (const b of doTestamento) {
      const ultima = secoes[secoes.length - 1]
      if (ultima && ultima.secao === b.section) ultima.livros.push(b)
      else secoes.push({ secao: b.section, livros: [b] })
    }
    out.push({ testament: t, secoes })
  }
  return out
}

/** O número à direita da linha. Zero é informação boa ("terminei"), então o
 *  livro fica com "0" em vez de sumir da lista. */
export function rotuloContagem(
  filtro: FiltroLeitura,
  prog: LivroProgresso | undefined,
  noRecorte: number,
): string {
  if (filtro === 'todos') return `${prog?.concluidas ?? 0} de ${prog?.total ?? 0}`
  if (noRecorte === 0) return '0'
  return filtro === 'nao-lidos' ? `restam ${noRecorte}` : String(noRecorte)
}

export default function CatalogoLivros({
  livros = BIBLE_BOOKS,
  progresso,
  contagem,
  filtro,
  onAbrir,
}: {
  livros?: BibleBook[]
  /** Progresso REAL do livro — nunca obedece ao filtro. */
  progresso: Map<string, LivroProgresso>
  /** Quantas perícopes do livro sobrevivem ao recorte ativo. */
  contagem: Map<string, number>
  filtro: FiltroLeitura
  onAbrir: (livro: BibleBook) => void
}) {
  return (
    <div className="catalogo">
      {agruparLivros(livros).map((g) => (
        <div key={g.testament} className="testament-block">
          <h2 className="testament-h">{testamentLabel(g.testament)}</h2>
          {g.secoes.map((s) => (
            <div key={s.secao} className="section-block">
              <h3 className="section-h">{s.secao}</h3>
              <ul className="livro-list">
                {s.livros.map((b) => {
                  const prog = progresso.get(b.name)
                  const noRecorte = contagem.get(b.name) ?? 0
                  const vazio = filtro !== 'todos' && noRecorte === 0
                  return (
                    <li key={b.abbrev}>
                      <button
                        type="button"
                        className={`livro-row${vazio ? ' livro-vazio' : ''}`}
                        onClick={() => onAbrir(b)}
                      >
                        <span className="livro-nome">{b.name}</span>
                        <span className="livro-abbrev">{b.abbrev}</span>
                        {/* A barra é decoração: quem usa leitor de tela recebe o rótulo. */}
                        <span className="book-progress" aria-hidden>
                          <span
                            className="book-progress-fill"
                            style={{ width: `${prog?.pct ?? 0}%` }}
                          />
                        </span>
                        <span className="book-progress-label">
                          {rotuloContagem(filtro, prog, noRecorte)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
      {!livros.length && <p className="muted">Nenhum livro correspondente.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/CatalogoLivros.test.tsx`
Expected: PASS.

- [ ] **Step 5: Acrescentar o CSS**

No **fim** de `src/styles/app.css` (nunca no meio — quatro sessões editam este arquivo):

```css
/* ===== Explorar: catálogo de livros ===== */
.livro-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.livro-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.65rem 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  min-height: 2.75rem;
}

.livro-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.livro-nome {
  flex: 1;
  font-family: var(--font-display);
  font-weight: 600;
  min-width: 0;
}

.livro-abbrev {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  color: var(--muted);
}

/* Livro sem nada no recorte ativo continua no lugar dele: apagado, não some.
   A memória muscular de onde fica cada livro não pode quebrar conforme se lê. */
.livro-vazio {
  opacity: 0.45;
}

.catalogo .section-block {
  content-visibility: auto;
  contain-intrinsic-size: auto 240px;
}
```

`.testament-h` e `.section-h` existem hoje sob o seletor `.pesquisar` (`app.css:2042,2048`). Como `.pesquisar` deixa de existir na Task 8, acrescentar também, no mesmo bloco novo:

```css
.explorar .testament-h {
  font-family: var(--font-display);
  font-size: 1.35rem;
  margin: 1.5rem 0 0.75rem;
}

.explorar .section-h {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 1rem 0 0.45rem;
}
```

- [ ] **Step 6: Suíte, lint e commit**

```bash
npm test && npm run lint
git add src/components/CatalogoLivros.tsx src/components/CatalogoLivros.test.tsx src/styles/app.css
git commit -m "feat: catálogo de livros com progresso e recorte

Serve dois lugares: o repouso da tela e a seção Livros dos resultados. A
barra mostra o progresso REAL do livro e nunca obedece ao filtro — senão
\"não lidos\" zeraria toda barra. Livro sem nada no recorte fica apagado
com 0, não some."
```

---

### Task 6: `LivroAberto` (`src/components/LivroAberto.tsx`)

O painel do livro: cabeçalho com progresso e "Trocar", formulário capítulo/versículo validado, e a lista de perícopes do recorte ativo.

**Files:**
- Create: `src/components/LivroAberto.tsx`

**Interfaces:**
- Consumes: `maxChapter`, `maxVerse`, `BibleBook` de `../lib/bible-books`; `LivroProgresso`, `FiltroLeitura` de `../lib/content`; `ListaPericopes`, `ItemPericope` da Task 4.
- Produces: `default function LivroAberto({ livro, prog, itens, concluidas, filtro, cap, onCap, onTrocar, onIrParaVersiculo })`

Assinatura exata das callbacks:
- `onCap: (cap: number | null) => void` — filtro de capítulo (vai para `?cap=`).
- `onTrocar: () => void` — fecha o livro.
- `onIrParaVersiculo: (cap: number, ver: number) => void` — o pai resolve a perícope e mostra a seção Referência.

- [ ] **Step 1: Implementar**

```tsx
import { useState, type FormEvent } from 'react'
import { maxChapter, maxVerse, type BibleBook } from '../lib/bible-books'
import type { FiltroLeitura, LivroProgresso } from '../lib/content'
import ListaPericopes, { type ItemPericope } from './ListaPericopes'

export default function LivroAberto({
  livro,
  prog,
  itens,
  concluidas,
  filtro,
  cap,
  onCap,
  onTrocar,
  onIrParaVersiculo,
}: {
  livro: BibleBook
  /** Progresso do livro INTEIRO — não do que sobrou do recorte. */
  prog: LivroProgresso | undefined
  itens: ItemPericope[]
  concluidas: Set<number>
  filtro: FiltroLeitura
  cap: number | null
  onCap: (cap: number | null) => void
  onTrocar: () => void
  onIrParaVersiculo: (cap: number, ver: number) => void
}) {
  const [campoCap, setCampoCap] = useState('')
  const [campoVer, setCampoVer] = useState('')

  const capNum = Number(campoCap)
  const capOk = Number.isInteger(capNum) && capNum >= 1 && capNum <= maxChapter(livro)
  const verMax = capOk ? maxVerse(livro, capNum) : 0
  const verNum = Number(campoVer)
  const verOk = capOk && Number.isInteger(verNum) && verNum >= 1 && verNum <= verMax

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!capOk) return
    if (verOk) onIrParaVersiculo(capNum, verNum)
    else onCap(capNum)
  }

  return (
    <>
      <div className="ref-sticky">
        <div className="selected-book">
          <div className="selected-book-meta">
            <span className="selected-book-name">{livro.name}</span>
            <span className="muted">
              {livro.abbrev} · {livro.section}
            </span>
          </div>
          {/* A barra é do livro inteiro, nunca do recorte: com "não lidos"
              ativo, uma barra filtrada estaria sempre em zero. */}
          <span className="book-progress-wrap">
            <span className="book-progress" aria-hidden>
              <span className="book-progress-fill" style={{ width: `${prog?.pct ?? 0}%` }} />
            </span>
            <span className="book-progress-label">
              {prog?.concluidas ?? 0} de {prog?.total ?? 0}
            </span>
          </span>
          <button type="button" className="ghost trocar-livro" onClick={onTrocar}>
            Trocar livro
          </button>
        </div>

        <form className="ref-form" onSubmit={aoEnviar}>
          <label>
            Capítulo
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxChapter(livro)}
              placeholder={`1–${maxChapter(livro)}`}
              value={campoCap}
              onChange={(e) => {
                setCampoCap(e.target.value)
                setCampoVer('')
              }}
            />
          </label>
          <label>
            Versículo
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={verMax || undefined}
              placeholder={capOk ? `1–${verMax}` : 'Capítulo primeiro'}
              value={campoVer}
              disabled={!capOk}
              onChange={(e) => setCampoVer(e.target.value)}
            />
          </label>
          <button type="submit" disabled={!capOk}>
            Ir
          </button>
        </form>
      </div>

      <p className="peri-count">
        {cap != null
          ? `${itens.length} perícope${itens.length === 1 ? '' : 's'} no capítulo ${cap}`
          : `${itens.length} perícope${itens.length === 1 ? '' : 's'}${
              filtro === 'todos' ? ` em ${livro.name}` : ' no recorte'
            }`}
        {cap != null && (
          <>
            {' · '}
            <button type="button" className="linkish" onClick={() => onCap(null)}>
              Ver todas do livro
            </button>
          </>
        )}
      </p>

      <ListaPericopes itens={itens} concluidas={concluidas} />
    </>
  )
}
```

- [ ] **Step 2: Typecheck, lint e commit**

Run: `npx tsc -b && npm run lint`
Expected: sem erros.

```bash
git add src/components/LivroAberto.tsx
git commit -m "feat: painel do livro aberto com formulário cap/versículo

Herda a validação contra maxChapter/maxVerse do Pesquisar, que é o que o
campo único não faz: mostra quantos capítulos o livro tem e recusa valor
impossível antes de buscar. A barra do cabeçalho é do livro inteiro."
```

---

### Task 7: A página `Explorar` (`src/pages/Explorar.tsx`)

Orquestra: lê o estado da URL, carrega índice e progresso, monta as quatro seções.

**Files:**
- Create: `src/pages/Explorar.tsx`
- Modify: `src/styles/app.css` (acrescentar ao fim)

**Interfaces:**
- Consumes: tudo das Tasks 1–6, mais `loadIndex`, `listPericopes`, `findPericopeByRef`, `listPericopesByBookChapter`, `progressoPorLivro`, `refLabel` de `../lib/content`; `searchTexto`, `fatiarResultado`, `marcarTrecho`, `indexPronto`, `progressoDoIndice`, `LIMITE_RESULTADOS`, `MIN_CHARS` de `../lib/fulltext`; `listAllProgresso`, `doneSet` de `../lib/user-db`; `useSyncRefresh`; `SkeletonIndice`.
- Produces: `default function Explorar()`

- [ ] **Step 1: Implementar a página**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SkeletonIndice } from '../components/Skeleton'
import CatalogoLivros from '../components/CatalogoLivros'
import LivroAberto from '../components/LivroAberto'
import ListaPericopes from '../components/ListaPericopes'
// `itemDeIndice` e `ItemPericope` NÃO moram mais no arquivo do componente:
// exportar função pura ao lado de um componente dispara
// `react(only-export-components)` e quebra o fast refresh. Foram extraídos para
// `src/lib/item-pericope.ts`, seguindo o que o repositório já faz com toda
// lógica pura (mesmo movimento de `src/lib/perfil-secoes.ts`, commit d9ced2e).
import { itemDeIndice, type ItemPericope } from '../lib/item-pericope'
import { bookByName, type BibleBook } from '../lib/bible-books'
import {
  contagemPorLivro,
  filtroDeOrdens,
  findPericopeByRef,
  listPericopes,
  listPericopesByBookChapter,
  loadIndex,
  progressoPorLivro,
  refLabel,
  statusPorOrdem,
  type FiltroLeitura,
} from '../lib/content'
import { parseConsulta } from '../lib/consulta'
import {
  fatiarResultado,
  indexPronto,
  LIMITE_RESULTADOS,
  marcarTrecho,
  MIN_CHARS,
  progressoDoIndice,
  searchTexto,
} from '../lib/fulltext'
import { listAllProgresso } from '../lib/user-db'
import { useSyncRefresh } from '../lib/use-sync-refresh'
import type { PericopeIndex, ProgressoStatus } from '../lib/types'

const FILTROS: { valor: FiltroLeitura; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'nao-lidos', rotulo: 'Não lidos' },
  { valor: 'comecei', rotulo: 'Comecei' },
  { valor: 'lidos', rotulo: 'Lidos' },
]

function ehFiltro(v: string | null): v is FiltroLeitura {
  return v === 'nao-lidos' || v === 'comecei' || v === 'lidos'
}

export default function Explorar() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filtro: FiltroLeitura = ehFiltro(params.get('f')) ? (params.get('f') as FiltroLeitura) : 'todos'
  const livroParam = params.get('livro') ?? ''
  // `cap` sem `livro` é ignorado: um capítulo não significa nada sem o livro, e
  // uma URL montada à mão não pode deixar a tela num estado que ela não desenha.
  const livro: BibleBook | undefined = livroParam ? bookByName(livroParam) : undefined
  const capParam = Number(params.get('cap'))
  const cap = livro && Number.isInteger(capParam) && capParam >= 1 ? capParam : null

  const [todas, setTodas] = useState<PericopeIndex[]>([])
  const [status, setStatus] = useState(new Map<number, ProgressoStatus>())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const consulta = useMemo(() => parseConsulta(q), [q])
  const aceita = useMemo(() => filtroDeOrdens(status, filtro), [status, filtro])
  const concluidas = useMemo(
    () => new Set([...status].filter(([, s]) => s === 'concluido').map(([o]) => o)),
    [status],
  )

  async function carregarProgresso() {
    setStatus(statusPorOrdem(await listAllProgresso()))
  }

  useEffect(() => {
    let vivo = true
    Promise.all([loadIndex(), listAllProgresso()])
      .then(([tudo, prog]) => {
        if (!vivo) return
        setTodas(tudo)
        setStatus(statusPorOrdem(prog))
      })
      .catch(() => {
        if (vivo) setErro('Não foi possível carregar o catálogo.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  // Do sync só o progresso muda: o catálogo é estático e recarregá-lo faria a
  // lista piscar por causa de uma conclusão feita em outro aparelho.
  useSyncRefresh(() => {
    void carregarProgresso().catch(() => {})
  })

  function mexerNaUrl(mudar: (p: URLSearchParams) => void, replace: boolean) {
    const proximo = new URLSearchParams(params)
    mudar(proximo)
    setParams(proximo, { replace })
  }

  // Digitar navega com replace: teclar não pode entulhar o histórico.
  const setQ = (valor: string) =>
    mexerNaUrl((p) => (valor ? p.set('q', valor) : p.delete('q')), true)
  const setFiltro = (valor: FiltroLeitura) =>
    mexerNaUrl((p) => (valor === 'todos' ? p.delete('f') : p.set('f', valor)), false)
  const abrirLivro = (b: BibleBook) =>
    mexerNaUrl((p) => {
      p.set('livro', b.name)
      p.delete('cap')
    }, false)
  const fecharLivro = () =>
    mexerNaUrl((p) => {
      p.delete('livro')
      p.delete('cap')
    }, false)
  const setCap = (valor: number | null) =>
    mexerNaUrl((p) => (valor == null ? p.delete('cap') : p.set('cap', String(valor))), false)

  /**
   * Submeter capítulo+versículo no livro aberto tem que FECHAR o livro, não só
   * setar `q`: o render é `livro ? <LivroAberto/> : …`, então deixar `livro` na
   * URL manteria o painel do livro na tela e a seção "Referência" nunca
   * apareceria — o botão não faria nada visível. Sair do livro é aceitável
   * porque a seção "Livros" logo abaixo do resultado traz ele de volta a um
   * toque (`parseConsulta` de uma referência devolve `livros: [livro]`).
   */
  const irParaReferencia = (abbrev: string, cap: number, ver: number) =>
    mexerNaUrl((p) => {
      p.set('q', `${abbrev} ${cap}:${ver}`)
      p.delete('livro')
      p.delete('cap')
    }, false)

  // ---- Seção Referência ----
  const [refHit, setRefHit] = useState<PericopeIndex | null>(null)
  const [refMiss, setRefMiss] = useState('')
  useEffect(() => {
    const r = consulta.ref
    if (!r) {
      setRefHit(null)
      setRefMiss('')
      return
    }
    let vivo = true
    void findPericopeByRef(r.livro.abbrev, r.cap, r.ver ?? 1)
      .then((achado) => {
        if (!vivo) return
        setRefHit(achado)
        setRefMiss(achado ? '' : `Nenhuma perícope contém ${r.livro.name} ${r.cap}:${r.ver ?? 1}.`)
      })
      .catch(() => {
        if (vivo) setRefMiss('Não foi possível resolver a referência.')
      })
    return () => {
      vivo = false
    }
  }, [consulta.ref])

  // ---- Seção Títulos ----
  const [titulos, setTitulos] = useState<PericopeIndex[]>([])
  useEffect(() => {
    if (!consulta.termo || consulta.ref) {
      setTitulos([])
      return
    }
    let vivo = true
    void listPericopes({ q: consulta.termo }).then((r) => {
      if (vivo) setTitulos(r)
    })
    return () => {
      vivo = false
    }
  }, [consulta.termo, consulta.ref])

  // ---- Seção No texto ----
  const [resultado, setResultado] = useState<{
    termo: string
    hits: Awaited<ReturnType<typeof searchTexto>>
    truncado: boolean
  }>({ termo: '', hits: [], truncado: false })
  const [buscando, setBuscando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [erroBusca, setErroBusca] = useState(false)
  const [progressoBusca, setProgressoBusca] = useState({ feitos: 0, total: 0 })

  useEffect(() => {
    if (!consulta.buscarNoTexto) {
      setResultado({ termo: '', hits: [], truncado: false })
      setBuscando(false)
      setPreparando(false)
      setErroBusca(false)
      return
    }
    let vivo = true
    setBuscando(true)
    setErroBusca(false)
    setPreparando(!indexPronto())
    const termo = consulta.termo
    // Debounce de 300 ms: digitar não pode disparar uma varredura por tecla.
    const timer = window.setTimeout(() => {
      // `+ 1` de propósito: é o item extra que distingue "achou 50" de "achou
      // 50 e tem mais". fatiarResultado descarta ele da lista.
      searchTexto(termo, LIMITE_RESULTADOS + 1, aceita)
        .then((r) => {
          if (vivo) setResultado({ termo, ...fatiarResultado(r, LIMITE_RESULTADOS) })
        })
        .catch(() => {
          if (vivo) {
            setResultado({ termo, hits: [], truncado: false })
            setErroBusca(true)
          }
        })
        .finally(() => {
          if (!vivo) return
          setBuscando(false)
          setPreparando(false)
        })
    }, 300)
    return () => {
      vivo = false
      window.clearTimeout(timer)
    }
  }, [consulta.buscarNoTexto, consulta.termo, aceita])

  // `progressoDoIndice()` é leitura de módulo, não estado de React: sem
  // amostragem periódica a barra congelaria no primeiro render.
  useEffect(() => {
    if (!preparando) return
    const id = window.setInterval(() => setProgressoBusca(progressoDoIndice()), 300)
    return () => window.clearInterval(id)
  }, [preparando])

  // ---- Livro aberto ----
  const [doLivro, setDoLivro] = useState<PericopeIndex[]>([])
  useEffect(() => {
    if (!livro) {
      setDoLivro([])
      return
    }
    let vivo = true
    void listPericopesByBookChapter(livro.abbrev, cap ?? undefined).then((r) => {
      if (vivo) setDoLivro(r)
    })
    return () => {
      vivo = false
    }
  }, [livro, cap])

  const progresso = useMemo(() => progressoPorLivro(todas, concluidas), [todas, concluidas])
  const contagem = useMemo(() => contagemPorLivro(todas, aceita), [todas, aceita])

  const itensTitulos: ItemPericope[] = useMemo(
    () => titulos.filter((p) => aceita(p.ordem)).map(itemDeIndice),
    [titulos, aceita],
  )
  const itensTexto: ItemPericope[] = useMemo(
    () =>
      resultado.hits.map((h) => ({
        ordem: h.ordem,
        titulo: h.titulo,
        ref: h.refLabel,
        verseId: h.verseId || undefined,
        trecho: marcarTrecho(h.snippet, resultado.termo),
      })),
    [resultado],
  )
  const itensLivro: ItemPericope[] = useMemo(
    () => doLivro.filter((p) => aceita(p.ordem)).map(itemDeIndice),
    [doLivro, aceita],
  )

  if (erro) return <p className="muted">{erro}</p>

  const emRepouso = !consulta.termo && !livro

  return (
    <section className="explorar">
      <h1 className="sr-only">Explorar</h1>

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar livro, título, referência ou trecho…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar livro, título, referência ou trecho"
        />
      </div>

      <div className="chips-filtro" role="group" aria-label="Filtrar por leitura">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            className={`chip-filtro${filtro === f.valor ? ' active' : ''}`}
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <SkeletonIndice />
      ) : livro ? (
        <LivroAberto
          livro={livro}
          prog={progresso.get(livro.name)}
          itens={itensLivro}
          concluidas={concluidas}
          filtro={filtro}
          cap={cap}
          onCap={setCap}
          onTrocar={fecharLivro}
          onIrParaVersiculo={(c, v) => irParaReferencia(livro.abbrev, c, v)}
        />
      ) : emRepouso ? (
        <CatalogoLivros
          progresso={progresso}
          contagem={contagem}
          filtro={filtro}
          onAbrir={abrirLivro}
        />
      ) : (
        <>
          {(consulta.ref || consulta.refForaDeFaixa) && (
            <section className="secao-resultado">
              <h2 className="secao-h">Referência</h2>
              {consulta.refForaDeFaixa && <p className="muted">{consulta.refForaDeFaixa.motivo}</p>}
              {refMiss && <p className="muted">{refMiss}</p>}
              {refHit && (
                <ListaPericopes
                  itens={[
                    {
                      ordem: refHit.ordem,
                      titulo: refHit.titulo_pericope_pt,
                      ref: refLabel(refHit),
                      verseId: consulta.ref
                        ? `${consulta.ref.cap}:${consulta.ref.ver ?? 1}`
                        : undefined,
                    },
                  ]}
                  concluidas={concluidas}
                />
              )}
            </section>
          )}

          {/* `consulta.livros` vem de `filterBooks`, que filtra BIBLE_BOOKS sem
              reordenar. `agruparLivros` monta as seções por TRANSIÇÃO, então
              depende dessa ordem: uma lista reordenada produziria duas seções
              com o mesmo nome. Não ordene isto. */}
          {consulta.livros.length > 0 && (
            <section className="secao-resultado">
              <h2 className="secao-h">
                Livros <span className="secao-n">{consulta.livros.length}</span>
              </h2>
              <CatalogoLivros
                livros={consulta.livros}
                progresso={progresso}
                contagem={contagem}
                filtro={filtro}
                onAbrir={abrirLivro}
              />
            </section>
          )}

          {itensTitulos.length > 0 && (
            <section className="secao-resultado">
              <h2 className="secao-h">
                Títulos <span className="secao-n">{itensTitulos.length}</span>
              </h2>
              <ListaPericopes itens={itensTitulos} concluidas={concluidas} />
            </section>
          )}

          {consulta.buscarNoTexto && (
            <section className="secao-resultado">
              <h2 className="secao-h">
                No texto{' '}
                {!buscando && !erroBusca && (
                  <span className="secao-n">
                    {itensTexto.length}
                    {resultado.truncado ? ' (primeiros)' : ''}
                  </span>
                )}
              </h2>
              <div aria-live="polite">
                {preparando && (
                  <p className="muted">
                    Preparando busca
                    {progressoBusca.total > 0 &&
                      ` — ${progressoBusca.feitos} de ${progressoBusca.total} livros`}
                    …
                  </p>
                )}
                {!preparando && buscando && <p className="muted">Buscando…</p>}
                {!buscando && erroBusca && (
                  <p className="muted">
                    Não foi possível buscar agora — verifique a conexão e tente de novo.
                  </p>
                )}
                {!buscando && !erroBusca && itensTexto.length === 0 && (
                  <p className="muted">Nenhum resultado no texto.</p>
                )}
              </div>
              <ListaPericopes itens={itensTexto} concluidas={concluidas} />
            </section>
          )}

          {consulta.termo.length > 0 && consulta.termo.length < MIN_CHARS && (
            <p className="muted">Digite ao menos {MIN_CHARS} letras para buscar no texto.</p>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Acrescentar o CSS**

No fim de `src/styles/app.css`:

```css
/* ===== Explorar: chips de recorte e seções de resultado ===== */
.chips-filtro {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0 0 1.25rem;
}

.chip-filtro {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  min-height: 2.25rem;
}

.chip-filtro.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.secao-resultado {
  margin-bottom: 1.75rem;
}

.secao-h {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 0.5rem;
}

.secao-n {
  font-weight: 400;
  letter-spacing: 0;
  opacity: 0.75;
}
```

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc -b && npm run lint`
Expected: sem erros. A página ainda não está roteada — isso é a Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Explorar.tsx src/styles/app.css
git commit -m "feat: página Explorar com as quatro seções empilhadas

A tela nunca escolhe um modo: empilha Referência, Livros, Títulos e No
texto, e a seção que não casa não aparece. As três primeiras saem do
index.json e respondem sempre; só No texto espera os shards, e ela carrega
o próprio estado de espera e de erro.

Todo o estado mora na URL (q, livro, cap, f), então tudo é linkável.
Digitar navega com replace para não entulhar o histórico."
```

---

### Task 8: Trocar as telas antigas pela nova

A troca atômica: rotas, nav, apagar as duas páginas, limpar `content.ts`, migalha da Leitura, e o teste da página.

**Files:**
- Modify: `src/App.tsx` (**por conteúdo, não por linha**)
- Modify: `src/pages/Leitura.tsx` (uma linha, a migalha)
- Modify: `src/lib/content.ts` (`listLivros` sai; `listPericopes` fica só com título)
- Modify: `src/lib/content.test.ts` (cobrir o `listPericopes` estreitado)
- Delete: `src/pages/Indice.tsx`, `src/pages/Pesquisar.tsx`
- Create: `src/pages/Explorar.test.tsx`

**Interfaces:**
- Consumes: `Explorar` da Task 7.
- Produces: rota `/explorar`; redirects de `/indice` e `/pesquisar`.

- [ ] **Step 1: Estreitar `listPericopes` e apagar `listLivros`**

Em `src/lib/content.ts`, `listPericopes` perde as cláusulas de livro e de `cap:ver` — livro tem seção própria, e a de `cap:ver` era substring sobre o **início** da perícope (casava `13:16` e `23:16` para "3:16"):

```ts
export async function listPericopes(opts?: {
  livro?: string
  q?: string
  testament?: Testament
}): Promise<PericopeIndex[]> {
  let list = await loadIndex()
  if (opts?.testament) list = list.filter((p) => testamentOf(p) === opts.testament)
  if (opts?.livro) list = list.filter((p) => p.livro === opts.livro)
  if (opts?.q) {
    // Só o TÍTULO. A cláusula de livro despejaria as 85 perícopes de João no
    // meio dos 124 títulos que mencionam João, e a de "cap:ver" era substring
    // sobre o início da perícope — "3:16" casava 13:16 e 23:16.
    const q = opts.q.toLowerCase()
    list = list.filter((p) => p.titulo_pericope_pt.toLowerCase().includes(q))
  }
  return list
}
```

**`listLivros` NÃO é apagada.** O plano original mandava apagá-la porque só o
Índice a usava. Isso deixou de ser verdade quando a `main` foi mesclada nesta
branch: `src/pages/Ajustes.tsx:29` (da sessão de releitura) passou a consumi-la.
Deixe a função exatamente como está.

O estreitamento acima continua seguro apesar disso: `Ajustes.tsx:31` chama
`listPericopes({ livro })` e nunca usa a opção `q`.

- [ ] **Step 2: Cobrir o comportamento novo**

Acrescentar a `src/lib/content.test.ts`:

```ts
describe('listPericopes com q', () => {
  it('casa só o título — nome de livro não entra pela busca de texto', async () => {
    // usa o mock de fetch que o arquivo já monta para loadIndex
    const r = await listPericopes({ q: 'P1' })
    expect(r.map((p) => p.ordem)).toEqual([1])
  })
})
```

Se `content.test.ts` ainda não tiver um `beforeEach` que mocke `fetch` para `loadIndex`, reaproveitar `respostaJson` que já existe no topo do arquivo e limpar o cache de módulo entre testes com `vi.resetModules()`.

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: PASS.

- [ ] **Step 4: Rota, nav e redirects em `src/App.tsx`**

**Aplicar por conteúdo — a sessão do chrome JÁ mesclou e a nav mudou de forma.** O `App.tsx` atual tem:

```tsx
<NavLink to="/jornada">Jornada</NavLink>
<NavLink to="/indice">Índice</NavLink>
<NavLink to="/pesquisar">Pesquisar</NavLink>
<PerfilMenu onOpenChange={setPerfilAberto} />
```

O `Entrar`/`Sair` solto não existe mais — `PerfilMenu` absorveu Ajustes, Sair e
Entrar. As rotas `/jornada` e `/ajustes` também já estão lá. Nada disso é seu;
não toque em nenhuma dessas linhas.

Quatro mudanças:

1. Acrescentar `Navigate` ao import de `react-router-dom`:
```tsx
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
```

2. Trocar os dois imports de página por um:
```tsx
import Explorar from './pages/Explorar'
```
(removendo `import Indice from './pages/Indice'` e `import Pesquisar from './pages/Pesquisar'`)

3. Trocar os dois `NavLink` por um:
```tsx
<NavLink to="/explorar">Explorar</NavLink>
```

4. Trocar as duas `<Route>` por três:
```tsx
<Route path="/explorar" element={<Explorar />} />
<Route path="/indice" element={<Navigate to="/explorar" replace />} />
<Route path="/pesquisar" element={<Navigate to="/explorar" replace />} />
```

- [ ] **Step 5: Migalha da Leitura**

Em `src/pages/Leitura.tsx`, a linha da migalha — depois do merge ela está na
**819**, mas procure pelo conteúdo `<Link to="/indice">{p.livro}</Link>` e não
pelo número:

```tsx
<Link to={`/explorar?livro=${encodeURIComponent(p.livro)}`}>{p.livro}</Link>
```

A migalha diz o nome do livro mas levava ao topo do catálogo cru. **Não tocar em mais nada neste arquivo** — a sessão do chrome tem hunks em ~34, ~142 e ~806-829.

- [ ] **Step 6: Apagar as páginas antigas**

```bash
git rm src/pages/Indice.tsx src/pages/Pesquisar.tsx
```

- [ ] **Step 7: Limpar o CSS órfão**

Os seletores `.pesquisar .testament-h` e `.pesquisar .section-h` (`app.css:2042-2056`) e o bloco `.modo-busca`/`.modo-btn` (`app.css:2227-2251`) ficam sem elemento. **Não apagar agora**: outra sessão pode estar com o arquivo aberto e a remoção conflita. Registrar no backlog em vez disso (Step 9).

- [ ] **Step 8: Teste da página**

Criar `src/pages/Explorar.test.tsx`, no padrão `createRoot` + `act` de `src/components/DitarBotao.test.tsx` (o repositório **não** usa testing-library). Mockar `../lib/content`, `../lib/fulltext` e `../lib/user-db`; envolver em `<MemoryRouter initialEntries={[...]}>`.

```tsx
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const searchTexto = vi.fn(async () => [])

// `historico` e `paraReler` são OBRIGATÓRIOS em `Progresso` desde o merge da
// releitura. Sem eles o `npm test` passa (o vitest não checa tipo) e só o
// `tsc -b` do build quebra — foi exatamente o que aconteceu no commit 14b4f0d.
vi.mock('../lib/user-db', () => ({
  listAllProgresso: async () => [
    {
      pericopeOrdem: 1,
      status: 'concluido',
      historico: [],
      paraReler: false,
      atualizadoEm: '2026-09-03T00:00:00.000Z',
    },
  ],
}))

vi.mock('../lib/fulltext', async (original) => ({
  ...(await original<typeof import('../lib/fulltext')>()),
  searchTexto: (...args: unknown[]) => searchTexto(...(args as [])),
  indexPronto: () => true,
  progressoDoIndice: () => ({ feitos: 66, total: 66 }),
}))

vi.mock('../lib/content', async (original) => {
  const real = await original<typeof import('../lib/content')>()
  const ALL = [
    {
      ordem: 1,
      livro: 'João',
      abbrev: 'Jo',
      capitulo_inicio: 3,
      versiculo_inicio: 1,
      capitulo_fim: 3,
      versiculo_fim: 21,
      titulo_pericope_pt: 'Jesus e Nicodemos',
      minutos: 4,
    },
  ]
  return {
    ...real,
    loadIndex: async () => ALL,
    listPericopes: async () => [],
    listPericopesByBookChapter: async () => ALL,
    findPericopeByRef: async () => ALL[0],
  }
})

import Explorar from './Explorar'
import { notificarSync } from '../lib/sync-event'

// Os dois últimos testes mexem no tempo (debounce de 300 ms da busca no texto).
// Sem timers falsos eles ficariam lentos e instáveis.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

let host: HTMLDivElement
let root: Root

async function montar(url: string) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Explorar />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  searchTexto.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('Explorar', () => {
  it('em repouso desenha o catálogo dos 66 livros', async () => {
    await montar('/explorar')
    expect(host.querySelectorAll('.livro-row')).toHaveLength(66)
    expect(host.querySelector('.secao-resultado')).toBeNull()
  })

  it('referência abre a seção Referência e NÃO busca no texto', async () => {
    await montar('/explorar?q=Jo%203%3A16')
    const titulos = [...host.querySelectorAll('.secao-h')].map((h) => h.textContent ?? '')
    expect(titulos.some((t) => t.startsWith('Referência'))).toBe(true)
    expect(titulos.some((t) => t.startsWith('No texto'))).toBe(false)
    expect(searchTexto).not.toHaveBeenCalled()
  })

  it('texto livre não abre a seção Livros', async () => {
    await montar('/explorar?q=amor%20de%20Deus')
    const titulos = [...host.querySelectorAll('.secao-h')].map((h) => h.textContent ?? '')
    expect(titulos.some((t) => t.startsWith('Livros'))).toBe(false)
  })

  it('livro aberto mostra o formulário de capítulo e versículo', async () => {
    await montar('/explorar?livro=Jo%C3%A3o')
    expect(host.querySelector('.ref-form')).not.toBeNull()
    expect(host.querySelector('.selected-book-name')?.textContent).toBe('João')
  })

  it('o filtro atravessa: com "lidos", o catálogo conta só concluídas', async () => {
    await montar('/explorar?f=lidos')
    const rotulos = [...host.querySelectorAll('.book-progress-label')].map((n) => n.textContent)
    expect(rotulos.filter((r) => r === '1')).toHaveLength(1)
  })

  // Os dois casos abaixo travam decisões que custaram uma rodada de revisão
  // cada. Sem eles, uma regressão nos dois passa despercebida.

  it('livro aberto e busca são estados exclusivos: com os dois na URL, a busca vence', async () => {
    // O bug era chegar em ?livro=X&q=algo e a caixa de busca ficar MUDA: o
    // render é `livro ? <LivroAberto/> : …`, então nenhuma seção aparecia.
    await montar('/explorar?livro=Jo%C3%A3o&q=amor')
    expect(host.querySelector('.ref-sticky')).toBeNull()
    expect(host.querySelectorAll('.secao-resultado').length).toBeGreaterThan(0)
  })

  it('sync de outro aparelho não reinicia a busca no texto', async () => {
    // `statusPorOrdem` devolve sempre um Map novo; sem `mesmosStatus` essa
    // identidade chegava às dependências do efeito de busca e toda sincronização
    // derrubava a busca em voo, com novo debounce e novo "Buscando…".
    await montar('/explorar?q=amor%20de%20Deus')
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    const antes = searchTexto.mock.calls.length
    await act(async () => {
      notificarSync()
      vi.advanceTimersByTime(400)
    })
    expect(searchTexto.mock.calls.length).toBe(antes)
  })
})
```

- [ ] **Step 9: Atualizar o backlog**

Em `docs/superpowers/backlog-pos-pacotes.md`, na seção "Navegação / Índice / Busca", acrescentar:

```markdown
- CSS órfão depois da fusão: `.pesquisar .testament-h`, `.pesquisar .section-h`
  (`app.css:2042-2056`) e o bloco `.modo-busca`/`.modo-btn`
  (`app.css:2227-2251`) ficaram sem elemento quando `Pesquisar.tsx` foi
  apagado. Não removidos junto de propósito: quatro sessões editavam o
  arquivo na mesma rodada e a remoção conflitaria. Limpeza segura agora.
```

- [ ] **Step 10: Suíte inteira, lint, typecheck e build**

Run:
```bash
npm test && npm run lint && npx tsc -b && npm run build
```
Expected: tudo verde. O `build` importa porque é ele que pega um import quebrado de `Indice`/`Pesquisar` que tenha sobrado.

- [ ] **Step 11: Verificar no navegador**

`npm run dev` e conferir, com o próprio olho, os critérios 1–14 da seção 10 da spec. Em especial:
- `/indice` e `/pesquisar` redirecionam.
- `Jo 3:16` → João 3:1–3:21, e a aba Rede **não** baixa shard nenhum.
- `jó 3:16` → Jó; `jo 3:16` → João.
- `João 99` → "João tem 21 capítulos."
- `josué` → as três seções.
- Filtro "Não lidos": Rute (se concluída) fica apagada com "0"; a barra do livro aberto continua no total do livro.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: /explorar substitui /indice e /pesquisar

Duas páginas e três superfícies de busca viram uma tela. /indice e
/pesquisar viram redirects, então nenhum link salvo quebra.

listPericopes passa a casar só o título: a cláusula de livro despejaria as
85 perícopes de João no meio dos 124 títulos que o mencionam, e a de
\"cap:ver\" era substring sobre o início da perícope — \"3:16\" casava
13:16 e 23:16. listLivros sai junto, era usada só pelo Índice.

A migalha da Leitura passa a levar ao livro em vez do topo do catálogo."
```

---

## Self-Review

**Cobertura da spec:**

| Seção da spec | Task |
|---|---|
| §1 Rotas e estado | 7 (params), 8 (rotas) |
| §2 Arquivos | 1–8 |
| §3 Parser | 1 |
| §4 Seções e ordem | 7 |
| §4 "Títulos" só por título | 8 (Step 1) |
| §5 Filtro de leitura | 2 (predicado), 5 (rótulo), 7 (chips) |
| §5 Teto depois do filtro | 3 |
| §6 Espera e falha | 7 |
| §7 Testes | 1, 2, 3, 5, 8 |
| §8 Fronteiras | 8 (Steps 4, 5) |
| §10 Critérios 1–14 | 8 (Step 11) |

**Consistência de tipos:** `FiltroLeitura` (Task 2) é consumido por `rotuloContagem` e `CatalogoLivros` (Task 5), `LivroAberto` (Task 6) e `Explorar` (Task 7). `ItemPericope` (Task 4) é produzido por `itemDeIndice` e consumido pelas Tasks 6 e 7. `aceitar` (Task 3) recebe o retorno de `filtroDeOrdens` (Task 2). `parseConsulta` (Task 1) é consumido só pela Task 7.

**Riscos conhecidos:**
- A Task 8 depende de `src/App.tsx` no estado pós-chrome. Se o chrome ainda não tiver mesclado, aplicar mesmo assim: as quatro mudanças são por conteúdo e independem da forma da nav.
- `content.test.ts` hoje pode não ter mock de `fetch` para `loadIndex`; a Task 8 Step 2 prevê montar um. Se o custo crescer, cobrir `listPericopes` por um teste da função de filtro extraída em vez de pela função assíncrona.
