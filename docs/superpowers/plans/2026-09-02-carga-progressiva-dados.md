# Carga progressiva do catálogo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A primeira tela do app pinta com ~480 KB em vez de 4,4 MB comprimidos, com o restante do catálogo descendo em segundo plano até o aparelho ter o mesmo conteúdo offline de hoje.

**Architecture:** Um gerador de build fatia o catálogo em três conjuntos — um índice de metadados carregado no boot e dois conjuntos de shards por livro (`texto/` e `estudo/`) buscados sob demanda e por uma fila de fundo. O armazenamento é o Cache Storage do service worker, via runtime caching; nenhuma persistência própria.

**Tech Stack:** TypeScript, React 19, Vite 8, vite-plugin-pwa (Workbox), Vitest, tsx para os scripts de build.

**Spec:** `docs/superpowers/specs/2026-09-02-carga-progressiva-dados-design.md`

## Global Constraints

- Textos de UI em pt-BR; comentários e mensagens de commit em pt-BR, no padrão dos commits existentes.
- TDD: teste falhando antes da implementação, em todo módulo com lógica pura.
- Commits pequenos e frequentes — um por tarefa, no mínimo.
- `npm test`, `npm run typecheck:worker`, `npm run lint` e `npm run build` precisam passar ao fim de cada tarefa.
- Segredos nunca pelo shell do agente.
- O trabalho acontece na worktree `.worktrees/develop` (branch `develop`).
- Nomes de arquivo derivados do **nome completo** do livro, nunca da abreviação (`Jó`/`João` colidem em `jo`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/livro-slug.ts` (criar) | `livroSlug()` — nome do livro → segmento de URL. Compartilhado entre o gerador (Node) e o cliente (browser), que precisam concordar byte a byte. |
| `scripts/shard-catalogo.ts` (criar) | Lê `data/pericopes.json` e escreve `public/data/index.json`, `public/data/texto/*.json`, `public/data/estudo/*.json`. Idempotente e pulável por mtime. |
| `src/lib/types.ts` (modificar) | `PericopeIndex` novo; `Pericope` passa a estendê-lo. |
| `src/lib/content.ts` (modificar) | `loadIndex()` novo; funções de metadados leem o índice; `getPericope()` junta índice + shards; `loadPericopes()` sai. |
| `src/lib/shards.ts` (criar) | Busca e cache em memória dos shards por livro. Uma responsabilidade: transporte, sem regra de negócio. |
| `src/lib/prefetch-catalogo.ts` (criar) | Fila de fundo: `texto/*` primeiro, `estudo/*` depois, um por vez, começando no primeiro idle. |
| `src/lib/fulltext.ts` (modificar) | `buildIndex()` passa a se alimentar dos shards de texto e a reportar progresso. |
| `src/pages/Home.tsx`, `Indice.tsx`, `Leitura.tsx` (modificar) | Trocam `loadPericopes()` por `loadIndex()`. |
| `src/pages/Pesquisar.tsx` (modificar) | "Preparando busca…" mostra `n de 66`. |
| `vite.config.ts` (modificar) | Precache só do app shell + índice; shards por runtime caching. |
| `package.json`, `.gitignore` (modificar) | `predev`/`prebuild` chamam o gerador; derivados ignorados. |

---

## Task 1: Slug de livro e gerador de shards

**Files:**
- Create: `src/lib/livro-slug.ts`
- Test: `src/lib/livro-slug.test.ts`
- Create: `scripts/shard-catalogo.ts`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces: `livroSlug(livro: string): string`; o script `npx tsx scripts/shard-catalogo.ts`, que lê `public/data/pericopes.json` (o caminho antigo — a mudança para `data/` é a Tarefa 7) e escreve `public/data/index.json`, `public/data/texto/<slug>.json`, `public/data/estudo/<slug>.json`.

Formato dos arquivos gerados:

```ts
// index.json
PericopeIndex[]
// texto/<slug>.json
{ ordem: number; texto_naa: string }[]
// estudo/<slug>.json
{ ordem: number; contexto_historico_literario: string; resenha: string
  perguntas_reflexao: string[]; topicos_pregar?: string }[]
```

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/livro-slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { livroSlug } from './livro-slug'

describe('livroSlug', () => {
  it('tira acento, baixa a caixa e troca espaço por hífen', () => {
    expect(livroSlug('Gênesis')).toBe('genesis')
    expect(livroSlug('Êxodo')).toBe('exodo')
    expect(livroSlug('1 Samuel')).toBe('1-samuel')
    expect(livroSlug('Cântico dos Cânticos')).toBe('cantico-dos-canticos')
  })

  // A razão de o slug vir do nome completo e não da abreviação: as abreviações
  // "Jó" e "Jo" colidem sem acento, e um livro sobrescreveria o outro no build.
  it('separa Jó de João', () => {
    expect(livroSlug('Jó')).toBe('jo')
    expect(livroSlug('João')).toBe('joao')
  })

  it('não deixa hífen sobrando nas pontas', () => {
    expect(livroSlug(' Atos ')).toBe('atos')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/livro-slug.test.ts`
Expected: FAIL — `Cannot find module './livro-slug'`

- [ ] **Step 3: Implementar o slug**

`src/lib/livro-slug.ts`:

```ts
/**
 * Nome do livro → segmento de URL dos shards.
 *
 * Vem do nome COMPLETO de propósito: as abreviações "Jó" e "Jo" (João) colidem
 * ao perder o acento, e um livro sobrescreveria o arquivo do outro no build.
 * O gerador e o cliente importam daqui justamente para não poderem discordar.
 */
export function livroSlug(livro: string): string {
  return livro
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/livro-slug.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Escrever o gerador**

`scripts/shard-catalogo.ts`:

```ts
/**
 * Fatia o catálogo em três conjuntos servíveis:
 *   public/data/index.json        — metadados de todas as perícopes (~480 KB)
 *   public/data/texto/<slug>.json — texto_naa por livro (4,3 MB no total)
 *   public/data/estudo/<slug>.json— contexto/resenha/perguntas/tópicos (9,0 MB)
 *
 * Roda antes do vite (build e dev). É função pura do catálogo: os derivados
 * não são versionados.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { livroSlug } from '../src/lib/livro-slug'
import { readingMinutes } from '../src/lib/reading-time'
import type { Pericope } from '../src/lib/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogoPath = join(root, 'public/data/pericopes.json')
const outDir = join(root, 'public/data')

function precisaGerar(): boolean {
  if (process.argv.includes('--force')) return true
  try {
    const catalogo = statSync(catalogoPath).mtimeMs
    return statSync(join(outDir, 'index.json')).mtimeMs < catalogo
  } catch {
    return true // saída ausente: gera
  }
}

function main(): void {
  if (!precisaGerar()) {
    console.log('[shard] saídas em dia — nada a fazer')
    return
  }
  const catalogo = JSON.parse(readFileSync(catalogoPath, 'utf8')) as Pericope[]

  const porSlug = new Map<string, { livro: string; itens: Pericope[] }>()
  for (const p of catalogo) {
    const slug = livroSlug(p.livro)
    const atual = porSlug.get(slug)
    if (atual && atual.livro !== p.livro) {
      // Em voz alta: silenciosamente um livro sobrescreveria o outro.
      throw new Error(`colisão de slug "${slug}": "${atual.livro}" e "${p.livro}"`)
    }
    if (atual) atual.itens.push(p)
    else porSlug.set(slug, { livro: p.livro, itens: [p] })
  }

  const indice = catalogo.map((p) => ({
    ordem: p.ordem,
    livro: p.livro,
    abbrev: p.abbrev,
    capitulo_inicio: p.capitulo_inicio,
    versiculo_inicio: p.versiculo_inicio,
    capitulo_fim: p.capitulo_fim,
    versiculo_fim: p.versiculo_fim,
    titulo_pericope_pt: p.titulo_pericope_pt,
    // Pré-calculado aqui para a Home não precisar do texto só para dizer "~5 min".
    minutos: readingMinutes(p.texto_naa),
  }))

  for (const sub of ['texto', 'estudo']) {
    rmSync(join(outDir, sub), { recursive: true, force: true })
    mkdirSync(join(outDir, sub), { recursive: true })
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(indice))

  for (const [slug, { itens }] of porSlug) {
    writeFileSync(
      join(outDir, 'texto', `${slug}.json`),
      JSON.stringify(itens.map((p) => ({ ordem: p.ordem, texto_naa: p.texto_naa }))),
    )
    writeFileSync(
      join(outDir, 'estudo', `${slug}.json`),
      JSON.stringify(
        itens.map((p) => ({
          ordem: p.ordem,
          contexto_historico_literario: p.contexto_historico_literario,
          resenha: p.resenha,
          perguntas_reflexao: p.perguntas_reflexao,
          ...(p.topicos_pregar ? { topicos_pregar: p.topicos_pregar } : {}),
        })),
      ),
    )
  }
  console.log(`[shard] ${indice.length} perícopes em ${porSlug.size} livros`)
}

main()
```

- [ ] **Step 6: Rodar o gerador e conferir a saída**

Run: `npx tsx scripts/shard-catalogo.ts --force && ls public/data/texto | wc -l && du -sh public/data/index.json public/data/texto public/data/estudo`
Expected: 66 arquivos em `texto/`; `index.json` em torno de 480 KB; `texto/` ~4,3 MB; `estudo/` ~9,0 MB.

- [ ] **Step 7: Commit**

```bash
git add src/lib/livro-slug.ts src/lib/livro-slug.test.ts scripts/shard-catalogo.ts
git commit -m "feat(dados): gerador de shards do catálogo por livro"
```

---

## Task 2: `PericopeIndex` e as funções de metadados

**Files:**
- Modify: `src/lib/types.ts:1-18`
- Modify: `src/lib/content.ts`
- Test: `src/lib/content.test.ts`

**Interfaces:**
- Consumes: o `index.json` da Tarefa 1.
- Produces: `PericopeIndex`; `loadIndex(): Promise<PericopeIndex[]>`. `listPericopes`, `listLivros`, `findPericopeByRef`, `listPericopesByBookChapter` passam a devolver `PericopeIndex[]`/`PericopeIndex | null`; `refLabel`, `ordensDoTestamento`, `proximaNoTestamento`, `anteriorNoTestamento`, `containsRef`, `progressoPorLivro` passam a aceitar `PericopeIndex`.

`Pericope` passa a **estender** `PericopeIndex`. Sem isso, `refLabel(p: PericopeIndex)` recusaria um `Pericope` (que não teria `minutos`), e o código quebraria em cascata.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/lib/content.test.ts`:

```ts
import { loadIndex } from './content'
import type { PericopeIndex } from './types'

function respostaJson(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

describe('loadIndex', () => {
  it('busca o índice uma vez só e reaproveita', async () => {
    const idx: PericopeIndex[] = [
      {
        ordem: 0, livro: 'Gênesis', abbrev: 'Gn',
        capitulo_inicio: 1, versiculo_inicio: 1, capitulo_fim: 2, versiculo_fim: 3,
        titulo_pericope_pt: 'A criação', minutos: 5,
      },
    ]
    const fetchMock = vi.fn(async () => respostaJson(idx))
    vi.stubGlobal('fetch', fetchMock)

    expect(await loadIndex()).toEqual(idx)
    expect(await loadIndex()).toEqual(idx)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('data/index.json')
  })
})
```

O import de `vi` no topo do arquivo precisa entrar: `import { describe, expect, it, vi } from 'vitest'`.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: FAIL — `loadIndex is not a function`

- [ ] **Step 3: Ajustar os tipos**

Em `src/lib/types.ts`, trocar o bloco `export type Pericope = {...}` por:

```ts
/** Metadados de uma perícope: o que o índice de boot carrega. */
export type PericopeIndex = {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  titulo_pericope_pt: string
  /** Minutos de leitura, pré-calculados pelo gerador de shards. */
  minutos: number
}

/** Perícope completa: índice + o conteúdo que vem dos shards do livro. */
export type Pericope = PericopeIndex & {
  texto_naa: string
  /** O que saber ANTES de ler o texto */
  contexto_historico_literario: string
  /** Apanhado do que aconteceu e por quê; Deus/Jesus só quando couber com naturalidade */
  resenha: string
  perguntas_reflexao: string[]
  /** Outline curto para o pregador; markdown com **negrito** */
  topicos_pregar?: string
}
```

- [ ] **Step 4: Implementar `loadIndex` e converter as funções de metadados**

Em `src/lib/content.ts`, trocar o topo por:

```ts
import type { Pericope, PericopeIndex } from './types'
import { testamentOf, type Testament } from './testament'

let indice: PericopeIndex[] | null = null
let carregando: Promise<PericopeIndex[]> | null = null

/**
 * Índice de metadados: ~480 KB que destravam Home, Índice e Pesquisa por
 * referência. O conteúdo pesado vem depois, por livro (shards.ts).
 *
 * Chamadas concorrentes compartilham a mesma promessa — três telas montando
 * juntas não podem virar três downloads.
 */
export async function loadIndex(): Promise<PericopeIndex[]> {
  if (indice) return indice
  if (carregando) return carregando
  carregando = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/index.json`)
    if (!res.ok) throw new Error('Falha ao carregar o índice de perícopes')
    indice = (await res.json()) as PericopeIndex[]
    carregando = null
    return indice
  })().catch((err: unknown) => {
    carregando = null
    throw err
  })
  return carregando
}
```

Depois, trocar cada `await loadPericopes()` por `await loadIndex()` em `listPericopes`, `listLivros`, `findPericopeByRef` e `listPericopesByBookChapter`, e trocar o tipo `Pericope` por `PericopeIndex` nas assinaturas dessas quatro funções e em `refLabel`, `ordensDoTestamento`, `proximaNoTestamento`, `anteriorNoTestamento`, `containsRef`, `matchesBook` e `progressoPorLivro`. `getPericope` fica como está por enquanto (Tarefa 3).

Manter `loadPericopes()` por enquanto: `getPericope` e `fulltext.ts` ainda dependem dele, e ele sai na Tarefa 5.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npx vitest run && npx tsc -b`
Expected: PASS. As fixtures de `content.test.ts` usam `as Pericope` sobre objetos parciais, então continuam válidas.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/content.ts src/lib/content.test.ts
git commit -m "feat(dados): loadIndex e funções de metadados sobre o índice leve"
```

---

## Task 3: Shards por livro e `getPericope`

**Files:**
- Create: `src/lib/shards.ts`
- Test: `src/lib/shards.test.ts`
- Modify: `src/lib/content.ts` (`getPericope`)

**Interfaces:**
- Consumes: `livroSlug` (Tarefa 1), `loadIndex` (Tarefa 2).
- Produces:
  - `carregarTexto(slug: string): Promise<Map<number, string>>` — ordem → `texto_naa`.
  - `carregarEstudo(slug: string): Promise<Map<number, EstudoShard>>`.
  - `type EstudoShard = { contexto_historico_literario: string; resenha: string; perguntas_reflexao: string[]; topicos_pregar?: string }`
  - `shardCarregado(tipo: 'texto' | 'estudo', slug: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/shards.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarEstudo, carregarTexto, shardCarregado } from './shards'

function respostaJson(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('carregarTexto', () => {
  it('mapeia ordem → texto e busca o arquivo do livro', async () => {
    const fetchMock = vi.fn(async () =>
      respostaJson([{ ordem: 7, texto_naa: 'No princípio' }]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const mapa = await carregarTexto('genesis')

    expect(mapa.get(7)).toBe('No princípio')
    expect(fetchMock.mock.calls[0][0]).toContain('data/texto/genesis.json')
  })

  it('não busca o mesmo livro duas vezes', async () => {
    const fetchMock = vi.fn(async () => respostaJson([{ ordem: 1, texto_naa: 'a' }]))
    vi.stubGlobal('fetch', fetchMock)

    await carregarTexto('exodo')
    await carregarTexto('exodo')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(shardCarregado('texto', 'exodo')).toBe(true)
  })

  it('uma falha não fica grudada: a próxima tentativa busca de novo', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(respostaJson([{ ordem: 2, texto_naa: 'b' }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(carregarTexto('levitico')).rejects.toThrow('offline')
    expect(shardCarregado('texto', 'levitico')).toBe(false)
    expect((await carregarTexto('levitico')).get(2)).toBe('b')
  })
})

describe('carregarEstudo', () => {
  it('mapeia ordem → bloco de estudo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respostaJson([
          {
            ordem: 3,
            contexto_historico_literario: 'ctx',
            resenha: 'res',
            perguntas_reflexao: ['q1'],
          },
        ]),
      ),
    )

    const mapa = await carregarEstudo('numeros')

    expect(mapa.get(3)?.resenha).toBe('res')
    expect(mapa.get(3)?.perguntas_reflexao).toEqual(['q1'])
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/shards.test.ts`
Expected: FAIL — `Cannot find module './shards'`

- [ ] **Step 3: Implementar `shards.ts`**

```ts
export type EstudoShard = {
  contexto_historico_literario: string
  resenha: string
  perguntas_reflexao: string[]
  topicos_pregar?: string
}

type Tipo = 'texto' | 'estudo'

// Cache de módulo por (tipo, slug). O Cache Storage do service worker já evita
// a rede na segunda vez; este mapa evita também o parse do JSON.
const prontos = new Map<string, Map<number, unknown>>()
const emVoo = new Map<string, Promise<Map<number, unknown>>>()

function chave(tipo: Tipo, slug: string): string {
  return `${tipo}/${slug}`
}

export function shardCarregado(tipo: Tipo, slug: string): boolean {
  return prontos.has(chave(tipo, slug))
}

async function carregar(tipo: Tipo, slug: string): Promise<Map<number, unknown>> {
  const k = chave(tipo, slug)
  const pronto = prontos.get(k)
  if (pronto) return pronto
  const voando = emVoo.get(k)
  if (voando) return voando

  const p = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${tipo}/${slug}.json`)
    if (!res.ok) throw new Error(`Falha ao carregar ${tipo} de ${slug}`)
    const linhas = (await res.json()) as { ordem: number }[]
    const mapa = new Map<number, unknown>()
    for (const linha of linhas) {
      const { ordem, ...resto } = linha
      mapa.set(ordem, tipo === 'texto' ? (resto as { texto_naa: string }).texto_naa : resto)
    }
    prontos.set(k, mapa)
    emVoo.delete(k)
    return mapa
  })().catch((err: unknown) => {
    // Falha transitória (é um PWA: offline acontece) não pode reservar a
    // rejeição para sempre — a próxima chamada tenta de novo.
    emVoo.delete(k)
    throw err
  })
  emVoo.set(k, p)
  return p
}

export async function carregarTexto(slug: string): Promise<Map<number, string>> {
  return (await carregar('texto', slug)) as Map<number, string>
}

export async function carregarEstudo(slug: string): Promise<Map<number, EstudoShard>> {
  return (await carregar('estudo', slug)) as Map<number, EstudoShard>
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/shards.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Reescrever `getPericope`**

Em `src/lib/content.ts`, trocar `getPericope` por:

```ts
export async function getPericope(ordem: number): Promise<Pericope | undefined> {
  const meta = (await loadIndex()).find((p) => p.ordem === ordem)
  if (!meta) return undefined
  const slug = livroSlug(meta.livro)
  // Os dois shards do livro em paralelo: são requisições de usuário, não de
  // fundo, e a leitura só desenha com as duas.
  const [texto, estudo] = await Promise.all([carregarTexto(slug), carregarEstudo(slug)])
  const bloco = estudo.get(ordem)
  const corpo = texto.get(ordem)
  if (bloco === undefined || corpo === undefined) return undefined
  return { ...meta, texto_naa: corpo, ...bloco }
}
```

com os imports `import { livroSlug } from './livro-slug'` e `import { carregarEstudo, carregarTexto } from './shards'`.

- [ ] **Step 6: Rodar a suíte e o typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/shards.ts src/lib/shards.test.ts src/lib/content.ts
git commit -m "feat(dados): getPericope monta a perícope a partir dos shards do livro"
```

---

## Task 4: Telas sobre o índice

**Files:**
- Modify: `src/pages/Home.tsx:4,35`
- Modify: `src/pages/Indice.tsx:7,64`
- Modify: `src/pages/Leitura.tsx:10,259`

**Interfaces:**
- Consumes: `loadIndex` (Tarefa 2), `getPericope` (Tarefa 3), `PericopeIndex.minutos` (Tarefa 1).
- Produces: nada novo — é a troca de fonte das três telas.

- [ ] **Step 1: Home**

Trocar o import `loadPericopes` por `loadIndex` e a chamada `const all = await loadPericopes()` por `const all = await loadIndex()`.

Trocar `minutos: readingMinutes(peri.texto_naa)` por `minutos: peri.minutos` e remover o import de `readingMinutes`, que deixa de ser usado ali. É essa troca que impede a Home de arrastar os 4,22 MB de texto de volta.

- [ ] **Step 2: Índice**

Trocar o import e a chamada dentro do `Promise.all`: `loadPericopes()` → `loadIndex()`. O estado `todas` passa a ser `PericopeIndex[]`; ajustar a anotação de tipo do `useState`.

- [ ] **Step 3: Leitura**

Trocar o import e `const all = await loadPericopes()` por `loadIndex()`. `all` só alimenta `anteriorNoTestamento`, `proximaNoTestamento` e a busca do título da vizinha — tudo metadado.

- [ ] **Step 4: Verificar no app**

Run: `npm run dev` e abrir `http://localhost:5173/`

Confirmar no DevTools (aba Network, com cache desligado):
- A Home pinta sem esperar nenhuma requisição de `texto/` ou `estudo/`.
- `data/index.json` é a única requisição de dados até abrir uma perícope.
- Abrir uma perícope dispara exatamente dois pedidos: `texto/<slug>.json` e `estudo/<slug>.json`.
- Os minutos exibidos na Home batem com os de antes da mudança.

- [ ] **Step 5: Rodar a suíte e o build**

Run: `npx vitest run && npx tsc -b && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx src/pages/Indice.tsx src/pages/Leitura.tsx
git commit -m "feat(ui): Home, Índice e Leitura passam a montar sobre o índice leve"
```

---

## Task 5: Busca full-text sobre os shards de texto

**Files:**
- Modify: `src/lib/fulltext.ts:1,150-186`
- Modify: `src/lib/fulltext.test.ts:31-34`
- Modify: `src/lib/content.ts` (remover `loadPericopes`)

**Interfaces:**
- Consumes: `loadIndex` (Tarefa 2), `carregarTexto` (Tarefa 3), `livroSlug` (Tarefa 1).
- Produces: `buildIndex()` com a assinatura de hoje; `progressoDoIndice(): { feitos: number; total: number }` para a Pesquisa mostrar quanto falta.

- [ ] **Step 1: Ajustar o mock do teste para a fonte nova**

Em `src/lib/fulltext.test.ts`, o mock atual devolve `loadPericopes`. Trocar por `loadIndex` + `carregarTexto`:

```ts
vi.mock('./content', async (importOriginal) => {
  const real = await importOriginal<typeof import('./content')>()
  return {
    ...real,
    loadIndex: async () => FIXTURES.map(({ texto_naa: _t, ...meta }) => meta),
  }
})

vi.mock('./shards', () => ({
  carregarTexto: async (slug: string) =>
    new Map(
      FIXTURES.filter((p) => livroSlug(p.livro) === slug).map((p) => [p.ordem, p.texto_naa]),
    ),
  carregarEstudo: async () => new Map(),
  shardCarregado: () => true,
}))
```

com `import { livroSlug } from './livro-slug'` no topo do teste. As `FIXTURES` já cobrem Gênesis, Salmos e João — três livros distintos, que é o que exercita o agrupamento por slug.

Atenção: o helper `peri()` em `fulltext.test.ts:8-23` devolve um literal tipado
`Pericope` (não é um `as Pericope` como em `content.test.ts`), então acrescentar
`minutos` ao tipo na Tarefa 2 **quebra o typecheck deste arquivo**. Acrescentar
`minutos: 1` ao literal — se a Tarefa 2 não tiver feito isso, faça aqui.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/fulltext.test.ts`
Expected: FAIL — `buildIndex` ainda chama `loadPericopes`, que o mock não fornece mais.

- [ ] **Step 3: Reescrever `buildIndex`**

Em `src/lib/fulltext.ts`, trocar o import `import { loadPericopes, refLabel } from './content'` por `import { loadIndex, refLabel } from './content'`, acrescentar `import { carregarTexto } from './shards'` e `import { livroSlug } from './livro-slug'`, e trocar o corpo do `construindo`:

```ts
let progresso = { feitos: 0, total: 0 }

/** Quantos livros de texto já entraram no índice — alimenta o "Preparando busca…". */
export function progressoDoIndice(): { feitos: number; total: number } {
  return progresso
}

construindo = (async () => {
  const meta = await loadIndex()
  const slugs = [...new Set(meta.map((p) => livroSlug(p.livro)))]
  progresso = { feitos: 0, total: slugs.length }
  const textos = new Map<number, string>()
  // Um livro por vez: a busca é a única coisa que o usuário está esperando
  // aqui, mas 66 requisições paralelas afogariam uma conexão móvel.
  for (const slug of slugs) {
    for (const [ordem, texto] of await carregarTexto(slug)) textos.set(ordem, texto)
    progresso = { feitos: progresso.feitos + 1, total: slugs.length }
  }
  const out = meta.flatMap((p) => {
    const texto = textos.get(p.ordem)
    if (texto === undefined) return []
    const linhas = indexarLinhas(texto)
    return [{
      ordem: p.ordem,
      titulo: p.titulo_pericope_pt,
      ref: refLabel(p),
      textoNorm: linhas.map((l) => normalize(l.texto)).join('\n'),
      linhas,
    }]
  })
  indice = out
  construindo = null
  return out
})().catch((err: unknown) => {
  construindo = null
  throw err
})
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/fulltext.test.ts`
Expected: PASS

- [ ] **Step 5: Remover `loadPericopes`**

Em `src/lib/content.ts`, apagar `loadPericopes` — a esta altura nenhum arquivo o chama.

Run: `grep -rn "loadPericopes" src/` → deve não retornar nada.

- [ ] **Step 6: Progresso na Pesquisa**

Em `src/pages/Pesquisar.tsx`, trocar `{preparando && <p className="muted">Preparando busca…</p>}` por:

```tsx
{preparando && (
  <p className="muted">
    Preparando busca
    {progressoBusca.total > 0 && ` — ${progressoBusca.feitos} de ${progressoBusca.total} livros`}…
  </p>
)}
```

com o estado e o efeito que o alimentam:

```tsx
const [progressoBusca, setProgressoBusca] = useState({ feitos: 0, total: 0 })

// `progressoDoIndice()` é uma leitura de módulo, não um estado de React: sem
// uma amostragem periódica a barra ficaria congelada no valor do primeiro
// render. O intervalo só existe enquanto há o que mostrar.
useEffect(() => {
  if (!preparando) return
  const id = window.setInterval(() => setProgressoBusca(progressoDoIndice()), 300)
  return () => window.clearInterval(id)
}, [preparando])
```

e `progressoDoIndice` acrescentado ao import de `../lib/fulltext`.

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npx vitest run && npx tsc -b && npm run build
git add src/lib/fulltext.ts src/lib/fulltext.test.ts src/lib/content.ts src/pages/Pesquisar.tsx
git commit -m "feat(busca): índice full-text montado sobre os shards de texto"
```

---

## Task 6: Fila de fundo

**Files:**
- Create: `src/lib/prefetch-catalogo.ts`
- Test: `src/lib/prefetch-catalogo.test.ts`
- Modify: `src/App.tsx:40-42`

**Interfaces:**
- Consumes: `loadIndex` (Tarefa 2), `carregarTexto`/`carregarEstudo`/`shardCarregado` (Tarefa 3), `livroSlug` (Tarefa 1).
- Produces: `iniciarPrefetch(): void` — idempotente; `filaDePrefetch(slugs: string[]): { tipo: 'texto' | 'estudo'; slug: string }[]` (pura, testável).

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/prefetch-catalogo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { filaDePrefetch } from './prefetch-catalogo'

describe('filaDePrefetch', () => {
  // Todos os textos antes de qualquer estudo: é o que destrava a busca com
  // 4,3 MB em vez de 13,7 MB.
  it('põe todos os textos antes de todos os estudos', () => {
    const fila = filaDePrefetch(['genesis', 'exodo'])
    expect(fila).toEqual([
      { tipo: 'texto', slug: 'genesis' },
      { tipo: 'texto', slug: 'exodo' },
      { tipo: 'estudo', slug: 'genesis' },
      { tipo: 'estudo', slug: 'exodo' },
    ])
  })

  it('lista vazia não gera trabalho', () => {
    expect(filaDePrefetch([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/prefetch-catalogo.test.ts`
Expected: FAIL — `Cannot find module './prefetch-catalogo'`

- [ ] **Step 3: Implementar**

```ts
import { loadIndex } from './content'
import { livroSlug } from './livro-slug'
import { carregarEstudo, carregarTexto, shardCarregado } from './shards'

export type ItemDaFila = { tipo: 'texto' | 'estudo'; slug: string }

/**
 * Ordem do preenchimento: todos os textos antes de qualquer estudo. É o que
 * deixa a busca pronta depois de 4,3 MB em vez dos 13,7 MB do catálogo.
 */
export function filaDePrefetch(slugs: string[]): ItemDaFila[] {
  return [
    ...slugs.map((slug) => ({ tipo: 'texto' as const, slug })),
    ...slugs.map((slug) => ({ tipo: 'estudo' as const, slug })),
  ]
}

let rodando = false

/**
 * Baixa o catálogo inteiro em segundo plano, um arquivo por vez, para o app
 * voltar a funcionar offline por completo. Começa no primeiro momento ocioso:
 * a renderização inicial tem prioridade.
 */
export function iniciarPrefetch(): void {
  if (rodando) return
  rodando = true
  const comecar = () => {
    void (async () => {
      const slugs = [...new Set((await loadIndex()).map((p) => livroSlug(p.livro)))]
      for (const { tipo, slug } of filaDePrefetch(slugs)) {
        if (shardCarregado(tipo, slug)) continue
        try {
          if (tipo === 'texto') await carregarTexto(slug)
          else await carregarEstudo(slug)
        } catch {
          // Offline no meio da fila é rotina num PWA: para por aqui e a próxima
          // visita retoma de onde o Cache Storage deixou.
          return
        }
      }
    })()
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(comecar, { timeout: 3000 })
  else setTimeout(comecar, 2000)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/prefetch-catalogo.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Ligar no boot**

`src/main.tsx` não é o lugar: quem dispara efeitos de boot é `App.tsx:40-42`.
Estender o efeito que já existe:

```tsx
useEffect(() => {
  initSyncTriggers()
  iniciarPrefetch()
}, [])
```

com `import { iniciarPrefetch } from './lib/prefetch-catalogo'`. `iniciarPrefetch`
é idempotente, então o duplo `useEffect` do StrictMode em dev não gera duas
filas.

- [ ] **Step 6: Verificar no app**

Run: `npm run dev`, abrir a Home com o DevTools na aba Network.
Confirmar: a Home pinta primeiro; segundos depois começam a cair `texto/*.json` um a um, e só depois os `estudo/*.json`; nenhum deles bloqueia a interação.

- [ ] **Step 7: Commit**

```bash
git add src/lib/prefetch-catalogo.ts src/lib/prefetch-catalogo.test.ts src/App.tsx
git commit -m "feat(dados): fila de fundo baixa o catálogo depois da primeira tela"
```

---

## Task 7: Service worker, build e mudança do catálogo de lugar

**Files:**
- Modify: `vite.config.ts:52-60`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`
- Modify: `scripts/shard-catalogo.ts` (caminho do catálogo)
- Modify: `scripts/enrich-pericopes.ts:28,547`, `scripts/enrich-preach.ts:14,245`
- Move: `public/data/pericopes.json` → `data/pericopes.json`

**Interfaces:**
- Consumes: o gerador da Tarefa 1.
- Produces: nada de código — é a fiação de build e distribuição.

- [ ] **Step 1: Precache e runtime caching**

Em `vite.config.ts`, dentro de `workbox`:

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
  // O índice entra no precache (é o que a primeira tela espera); os shards
  // não — precachear os 132 arquivos desfaria a mudança inteira.
  globIgnores: ['**/data/texto/**', '**/data/estudo/**'],
  navigateFallbackDenylist: [/^\/api\//],
  runtimeCaching: [
    {
      // Conteúdo estático dentro de uma versão do build: uma vez em cache,
      // nunca precisa de rede.
      urlPattern: /\/data\/(texto|estudo)\/.*\.json$/,
      handler: 'CacheFirst',
      options: { cacheName: 'catalogo-shards', expiration: { maxEntries: 200 } },
    },
  ],
},
```

Remover `maximumFileSizeToCacheInBytes: 16 * 1024 * 1024`: ele só existia para caber o monolito.

Como `globPatterns` deixa de incluir `json`, acrescentar `'data/index.json'` a `includeAssets` para o índice continuar precacheado.

- [ ] **Step 2: Mover o catálogo e ajustar quem o lê**

```bash
git mv public/data/pericopes.json data/pericopes.json
```

Em `scripts/shard-catalogo.ts`, `scripts/enrich-pericopes.ts` e `scripts/enrich-preach.ts`, trocar `public/data/pericopes.json` por `data/pericopes.json` — inclusive nos argumentos de `git add` dos dois scripts de enrich.

- [ ] **Step 3: Ignorar os derivados**

Acrescentar ao `.gitignore`:

```
# Derivados do catálogo (gerados por scripts/shard-catalogo.ts no build)
public/data/index.json
public/data/texto/
public/data/estudo/
```

- [ ] **Step 4: Ligar o gerador ao build e ao dev**

Em `package.json`:

```json
"shard": "tsx scripts/shard-catalogo.ts",
"predev": "npm run shard",
"prebuild": "npm run shard",
```

- [ ] **Step 5: Verificar a distribuição**

```bash
rm -rf dist && npm run build
ls dist/data                      # index.json, texto/, estudo/ — sem pericopes.json
grep -c "texto/" dist/sw.js       # os shards NÃO podem estar no manifesto de precache
du -sh dist
```

Expected: `dist/data/pericopes.json` não existe; o manifesto de precache do `sw.js` não lista os shards; o precache cai de ~15,7 MB para menos de 1,5 MB.

- [ ] **Step 6: Verificar a migração de um cliente antigo**

Com a versão publicada aberta no navegador (service worker instalado e Cache Storage com os 13 MB), subir a versão nova por cima em `npm run preview` na mesma origem, recarregar duas vezes e conferir no DevTools → Application → Cache Storage que a entrada do `pericopes.json` sumiu e não sobrou cache órfão.

- [ ] **Step 7: Rodar tudo e commitar**

```bash
npx vitest run && npx tsc -b && npm run typecheck:worker && npm run lint && npm run build
git add -A
git commit -m "build: catálogo sai de public/, shards por runtime caching"
```

---

## Task 8: Medir o resultado e registrar

**Files:**
- Modify: `docs/superpowers/backlog-pos-pacotes.md`
- Modify: `README.md` (seção de desenvolvimento)

**Interfaces:**
- Consumes: tudo acima.
- Produces: os números do antes/depois, que são o critério de aceite nº 1.

- [ ] **Step 1: Medir a primeira tela**

Com `npm run preview` servindo o build novo, no DevTools → Network com "Disable cache" ligado e throttling "Fast 3G", recarregar a Home e anotar: bytes transferidos até o primeiro conteúdo pintado, e o total até a fila de fundo terminar.

Comparar com a medição de hoje registrada na spec (4.446.987 bytes comprimidos, 12,5 s).

- [ ] **Step 2: Conferir o offline completo**

Depois de a fila terminar, marcar "Offline" no DevTools e abrir três perícopes de livros diferentes que não foram visitadas. Todas precisam abrir.

- [ ] **Step 3: Conferir a busca**

Com o Cache Storage limpo, entrar em "No texto" logo depois do boot: o "Preparando busca…" precisa mostrar progresso e só devolver resultado quando os 66 livros entrarem.

- [ ] **Step 4: Atualizar o README**

A seção "Desenvolvimento" cita `npm run pipeline` e o caminho antigo do catálogo. Acrescentar o `npm run shard` e o novo caminho `data/pericopes.json`. Corrigir também `npm run enrich:openai`/`OPENAI_API_KEY`, que não existem mais no `package.json` (hoje é `enrich:openrouter`).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/backlog-pos-pacotes.md
git commit -m "docs: registra os números da carga progressiva"
```
