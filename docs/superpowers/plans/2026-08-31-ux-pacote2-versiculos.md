# Pacote 2 — Versículos e dados: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seis melhorias de interação com versículos e dados do usuário (menu de ações ao tocar num versículo, destaques coloridos sincronizados, seleção de intervalo, anotações com vínculo/edição/confirmação, tema sépia + seguir sistema, espaçamento e largura no "Aa") mais os seis débitos técnicos herdados dos pacotes anteriores.

**Architecture:** Este é o único pacote que atravessa as três camadas: uma entidade sincronizada nova (`destaques`) e uma coluna nova (`anotacoes.verse_ref`) replicam o padrão IndexedDB + outbox → `/api/sync` → D1 de forma espelhada nos seis arquivos de sempre (`user-db.ts`, `sync.ts`, `worker/sync-logic.ts`, `worker/index.ts`, `migrations/`), sem abstração genérica. A camada de UI ganha um módulo puro novo (`src/lib/verse-range.ts`), um componente novo (`src/components/VerseActions.tsx`) e mudanças concentradas em `Leitura.tsx`, `ReadingMenu.tsx`, `theme.ts`, `reading-prefs.ts`, `app.css` e no script inline do `index.html`.

**Tech Stack:** React 19, react-router-dom 7, idb 8, Hono 4 + Cloudflare D1, better-auth, Vitest 4 (+ happy-dom e fake-indexeddb), Vite 8 + vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-08-31-ux-pacote2-versiculos-design.md`

## Global Constraints

- Convenções pt-BR na UI: rótulos em sentence-case, ellipsis `…` (nunca `...`), nomes de domínio em português (`Destaque`, `Anotação`, `atualizadoEm`).
- Estilo de código do repo: sem ponto-e-vírgula, aspas simples, indentação de 2 espaços, vírgula final.
- CSS plano em `src/styles/app.css` com classes kebab-case; nada de CSS Modules, CSS-in-JS ou framework.
- O Worker não importa de `src/`: limites e constantes são duplicados deliberadamente entre `src/lib/sync-limits.ts` e `worker/sync-logic.ts` — mudar um exige mudar o outro.
- Toda escrita local é atômica com o outbox na mesma transação `idb` (`[store, 'outbox']`): uma aba morta no meio nunca grava o dado sem o item de sync correspondente.
- LWW por `atualizado_em` (relógio do cliente) + cursor de pull `server_em` (relógio do servidor); o upsert do Worker é `ON CONFLICT ... WHERE excluded.atualizado_em > tabela.atualizado_em`.
- `localStorage`/IndexedDB indisponível nunca quebra a leitura: try/catch com padrão seguro em todo módulo novo.
- Testes com Vitest; arquivos que precisam de DOM levam `// @vitest-environment happy-dom` no topo, e `installLocalStorageMock()` de `src/lib/testing/storage-mock.ts` para `localStorage`.
- Contexto, resenha, reflexão e tópicos são leitura de primeira classe: o que for tipográfico vale para toda a prosa; interação com versículos é exclusiva do texto NAA.
- Comandos: testes `npm test`, lint `npm run lint`, build `npm run build`, typecheck do Worker `npm run typecheck:worker`. A suíte parte de **60 testes verdes**; toda task termina com a suíte verde.

---

### Task 1: Entidade `destaques` no cliente (types + IndexedDB v3)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/user-db.ts`
- Modify: `src/lib/user-db.test.ts`

**Interfaces:**
- Consumes: `remoteWinsLocal(remoteAtualizadoEm: string, localAtualizadoEm: string | undefined): boolean` de `./sync-merge`.
- Produces:
  - `type DestaqueCor = 'amarelo' | 'verde' | 'azul' | 'rosa'`
  - `type Destaque = { id: string; pericopeOrdem: number; verseId: string; cor: DestaqueCor; criadoEm: string; atualizadoEm: string }`
  - novo membro de `OutboxItem`: `{ seq?: number; kind: 'destaque'; destaque: Destaque; apagadoEm: string | null }`
  - `listDestaques(ordem: number): Promise<Destaque[]>`
  - `setDestaque(pericopeOrdem: number, verseId: string, cor: DestaqueCor): Promise<Destaque>`
  - `removeDestaque(id: string): Promise<void>`
  - `applyRemoteDestaques(items: { id: string; pericopeOrdem: number; verseId: string; cor: DestaqueCor; criadoEm: string; atualizadoEm: string; apagadoEm: string | null }[]): Promise<void>`
  - Tasks 2 (sync client) e 7 (UI) dependem destes nomes exatos.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/user-db.test.ts`, acrescentar `applyRemoteDestaques`, `listDestaques`, `removeDestaque` e `setDestaque` ao import de `./user-db` (mantendo a ordem alfabética do bloco existente) e acrescentar a constante abaixo logo depois de `const PAST = ...`:

```ts
const FUTURE_2 = '2099-06-01T00:00:00.000Z'
```

No fim do arquivo, depois do `describe('user-db v2 (outbox/meta)', ...)`, acrescentar:

```ts
describe('user-db v3 (destaques)', () => {
  it('setDestaque grava o destaque e enfileira o outbox na mesma transação', async () => {
    const d = await setDestaque(9101, '1:3', 'amarelo')
    expect(d.id).toBe('9101:1:3')
    expect((await listDestaques(9101)).map((x) => x.cor)).toEqual(['amarelo'])

    const outbox = await listOutbox()
    const item = outbox.find((i) => i.kind === 'destaque' && i.destaque.id === '9101:1:3')
    expect(item).toBeDefined()
    if (item?.kind === 'destaque') {
      expect(item.apagadoEm).toBeNull()
      expect(item.destaque.cor).toBe('amarelo')
    }
  })

  it('destacar de novo troca a cor e preserva criadoEm', async () => {
    const primeiro = await setDestaque(9102, '2:7', 'verde')
    const segundo = await setDestaque(9102, '2:7', 'rosa')
    expect(segundo.id).toBe(primeiro.id)
    expect(segundo.criadoEm).toBe(primeiro.criadoEm)
    expect((await listDestaques(9102)).map((x) => x.cor)).toEqual(['rosa'])
  })

  it('removeDestaque apaga o local e enfileira a lápide', async () => {
    const d = await setDestaque(9103, '1:1', 'azul')
    await removeDestaque(d.id)

    expect(await listDestaques(9103)).toEqual([])
    const outbox = await listOutbox()
    const lapides = outbox.filter((i) => i.kind === 'destaque' && i.destaque.id === d.id)
    const ultima = lapides[lapides.length - 1]
    expect(ultima).toBeDefined()
    if (ultima?.kind === 'destaque') {
      expect(ultima.apagadoEm).not.toBeNull()
      expect(ultima.destaque.atualizadoEm).toBe(ultima.apagadoEm)
    }
  })

  it('applyRemoteDestaques: mais velho é ignorado, mais novo vence, lápide apaga', async () => {
    const local = await setDestaque(9104, '1:2', 'amarelo')

    await applyRemoteDestaques([{ ...local, cor: 'verde', atualizadoEm: PAST, apagadoEm: null }])
    expect((await listDestaques(9104)).map((x) => x.cor)).toEqual(['amarelo'])

    await applyRemoteDestaques([{ ...local, cor: 'azul', atualizadoEm: FUTURE, apagadoEm: null }])
    expect((await listDestaques(9104)).map((x) => x.cor)).toEqual(['azul'])

    await applyRemoteDestaques([{ ...local, cor: 'azul', atualizadoEm: FUTURE_2, apagadoEm: FUTURE_2 }])
    expect(await listDestaques(9104)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts`
Expected: FAIL — `setDestaque`/`listDestaques`/`removeDestaque`/`applyRemoteDestaques` não existem em `./user-db`.

- [ ] **Step 3: Tipos novos em `src/lib/types.ts`**

Acrescentar depois do bloco `export type Anotacao = { ... }`:

```ts
export type DestaqueCor = 'amarelo' | 'verde' | 'azul' | 'rosa'

/** `id` determinístico `${pericopeOrdem}:${verseId}`: um destaque por versículo
 * por usuário, então destacar de novo é um upsert e o LWW resolve sozinho. */
export type Destaque = {
  id: string
  pericopeOrdem: number
  /** "capitulo:versiculo", igual ao TextoBlock.id */
  verseId: string
  cor: DestaqueCor
  criadoEm: string
  atualizadoEm: string
}
```

- [ ] **Step 4: Store `destaques` em `src/lib/user-db.ts`**

Trocar o import de tipos e a versão do banco:

```ts
import type { Anotacao, Destaque, DestaqueCor, Progresso, ProgressoStatus } from './types'

const DB_NAME = 'biblia-pericopes'
const DB_VERSION = 3
```

Acrescentar o membro novo em `OutboxItem`:

```ts
export type OutboxItem =
  | { seq?: number; kind: 'progresso'; ordem: number; status: ProgressoStatus; atualizadoEm: string }
  | { seq?: number; kind: 'anotacao'; nota: Anotacao; apagadoEm: string | null }
  | { seq?: number; kind: 'destaque'; destaque: Destaque; apagadoEm: string | null }
```

Acrescentar o store em `Schema`, depois de `anotacoes`:

```ts
  destaques: {
    key: string
    value: Destaque
    indexes: { 'by-pericope': number }
  }
```

Acrescentar o branch de upgrade dentro de `upgrade(database, oldVersion)`, depois do `if (oldVersion < 2)`:

```ts
        if (oldVersion < 3) {
          const hl = database.createObjectStore('destaques', { keyPath: 'id' })
          hl.createIndex('by-pericope', 'pericopeOrdem')
        }
```

- [ ] **Step 5: API de destaques em `src/lib/user-db.ts`**

Acrescentar logo depois de `deleteAnotacao`:

```ts
/** Id determinístico do destaque: um por versículo por perícope. */
function destaqueId(pericopeOrdem: number, verseId: string): string {
  return `${pericopeOrdem}:${verseId}`
}

export async function listDestaques(ordem: number): Promise<Destaque[]> {
  return (await db()).getAllFromIndex('destaques', 'by-pericope', ordem)
}

export async function setDestaque(
  pericopeOrdem: number,
  verseId: string,
  cor: DestaqueCor,
): Promise<Destaque> {
  const now = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['destaques', 'outbox'], 'readwrite')
  const store = tx.objectStore('destaques')
  const id = destaqueId(pericopeOrdem, verseId)
  const existing = await store.get(id)
  const destaque: Destaque = {
    id,
    pericopeOrdem,
    verseId,
    cor,
    criadoEm: existing?.criadoEm ?? now,
    atualizadoEm: now,
  }
  await store.put(destaque)
  await tx.objectStore('outbox').put({ kind: 'destaque', destaque, apagadoEm: null } as OutboxItem)
  await tx.done
  return destaque
}

export async function removeDestaque(id: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['destaques', 'outbox'], 'readwrite')
  const store = tx.objectStore('destaques')
  const existing = await store.get(id)
  await store.delete(id)
  if (existing) {
    // Soft delete: a linha some daqui, mas sobe como lápide para o servidor
    // tombar a dele — senão o próximo pull ressuscitaria o destaque.
    const now = new Date().toISOString()
    await tx.objectStore('outbox').put({
      kind: 'destaque',
      destaque: { ...existing, atualizadoEm: now },
      apagadoEm: now,
    } as OutboxItem)
  }
  await tx.done
}
```

Acrescentar no fim do arquivo, depois de `applyRemoteAnotacoes`:

```ts
export async function applyRemoteDestaques(
  items: {
    id: string
    pericopeOrdem: number
    verseId: string
    cor: DestaqueCor
    criadoEm: string
    atualizadoEm: string
    apagadoEm: string | null
  }[],
): Promise<void> {
  const d = await db()
  for (const item of items) {
    const local = await d.get('destaques', item.id)
    if (!remoteWinsLocal(item.atualizadoEm, local?.atualizadoEm)) continue
    if (item.apagadoEm) {
      await d.delete('destaques', item.id)
    } else {
      const { apagadoEm: _apagadoEm, ...destaque } = item
      await d.put('destaques', destaque)
    }
  }
}
```

- [ ] **Step 6: `clearAllUserData` limpa `destaques` também**

Substituir a função inteira por:

```ts
export async function clearAllUserData(): Promise<void> {
  const d = await db()
  const tx = d.transaction(['progresso', 'anotacoes', 'destaques', 'outbox'], 'readwrite')
  await Promise.all([
    tx.objectStore('progresso').clear(),
    tx.objectStore('anotacoes').clear(),
    tx.objectStore('destaques').clear(),
    tx.objectStore('outbox').clear(),
    tx.done,
  ])
}
```

E acrescentar duas linhas ao teste existente `clearAllUserData apaga progresso, anotações e outbox; deleteMeta remove a chave`, dentro do `it`: depois de `await saveAnotacao(9012, 'some junto')` inserir `await setDestaque(9013, '1:1', 'verde')`, e depois de `expect(await listAnotacoes(9012)).toEqual([])` inserir `expect(await listDestaques(9013)).toEqual([])`.

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 60 antigos + 4 novos = 64.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/user-db.ts src/lib/user-db.test.ts
git commit -m "feat: entidade destaques no IndexedDB (v3) com outbox atômico"
```

---

### Task 2: `destaques` no cliente de sync

**Files:**
- Modify: `src/lib/sync.ts`
- Modify: `src/lib/sync.test.ts`

**Interfaces:**
- Consumes (Task 1): `applyRemoteDestaques`, `listDestaques`, `setDestaque`, `OutboxItem` com `kind: 'destaque'`.
- Produces: `PushDestaque = { id: string; pericopeOrdem: number; verseId: string; cor: string; criadoEm: string; atualizadoEm: string; apagadoEm: string | null }` (interno a `sync.ts`); corpo do `POST /api/sync` passa a ser `{ progresso, anotacoes, destaques }`; a resposta do `GET /api/sync` passa a aceitar `destaques` (ausente ⇒ lista vazia). Task 3 implementa o outro lado deste contrato.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/sync.test.ts`, acrescentar `listDestaques` e `setDestaque` ao import de `./user-db`. No fim do arquivo, acrescentar:

```ts
describe('syncNow — destaques', () => {
  it('push envia destaques deduplicados por id e o pull aplica os remotos', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    // mesmo versículo destacado duas vezes: só a última cor sobe
    await setDestaque(70001, '1:3', 'amarelo')
    await setDestaque(70001, '1:3', 'verde')

    const posts: { destaques: unknown[] }[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string))
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({
        progresso: [],
        anotacoes: [],
        destaques: [
          {
            id: '70002:2:5',
            pericopeOrdem: 70002,
            verseId: '2:5',
            cor: 'azul',
            criadoEm: FUTURE,
            atualizadoEm: FUTURE,
            apagadoEm: null,
          },
        ],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(posts).toHaveLength(1)
    expect(posts[0].destaques).toEqual([
      {
        id: '70001:1:3',
        pericopeOrdem: 70001,
        verseId: '1:3',
        cor: 'verde',
        criadoEm: expect.any(String),
        atualizadoEm: expect.any(String),
        apagadoEm: null,
      },
    ])
    expect((await listDestaques(70002)).map((d) => d.cor)).toEqual(['azul'])
    expect(await listOutbox()).toEqual([])
  })

  it('resposta de pull sem a lista destaques não quebra o sync', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })),
    )

    await syncNow()

    expect(await getMeta('sync-cursor')).toBe(FUTURE)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/sync.test.ts -t "push envia destaques deduplicados por id e o pull aplica os remotos"`
Expected: FAIL — o corpo do POST não tem a chave `destaques`.

- [ ] **Step 3: `PushDestaque` e `toPush` em `src/lib/sync.ts`**

Acrescentar `applyRemoteDestaques` ao import de `./user-db` (primeira linha do bloco, antes de `applyRemoteAnotacoes`).

Acrescentar o tipo depois de `PushAnotacao`:

```ts
type PushDestaque = {
  id: string
  pericopeOrdem: number
  verseId: string
  cor: string
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}
```

Substituir `toPush` inteira por:

```ts
function toPush(items: OutboxItem[]) {
  const progresso = new Map<number, PushProgresso>()
  const anotacoes = new Map<string, PushAnotacao>()
  const destaques = new Map<string, PushDestaque>()
  for (const item of items) {
    if (item.kind === 'progresso') {
      progresso.set(item.ordem, {
        pericopeOrdem: item.ordem,
        status: item.status,
        atualizadoEm: item.atualizadoEm,
      })
    } else if (item.kind === 'anotacao') {
      anotacoes.set(item.nota.id, { ...item.nota, apagadoEm: item.apagadoEm })
    } else {
      destaques.set(item.destaque.id, { ...item.destaque, apagadoEm: item.apagadoEm })
    }
  }
  return {
    progresso: [...progresso.values()],
    anotacoes: [...anotacoes.values()],
    destaques: [...destaques.values()],
  }
}
```

- [ ] **Step 4: `pushOutbox` envia a terceira lista**

Substituir o corpo de `pushOutbox` por:

```ts
async function pushOutbox(outbox: OutboxItem[]): Promise<boolean> {
  const { progresso, anotacoes, destaques } = toPush(outbox)
  const lotesProgresso = chunk(progresso, MAX_ITENS_POR_LOTE)
  const lotesAnotacoes = chunk(anotacoes, MAX_ITENS_POR_LOTE)
  const lotesDestaques = chunk(destaques, MAX_ITENS_POR_LOTE)
  const total = Math.max(lotesProgresso.length, lotesAnotacoes.length, lotesDestaques.length)

  for (let i = 0; i < total; i++) {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        progresso: lotesProgresso[i] ?? [],
        anotacoes: lotesAnotacoes[i] ?? [],
        destaques: lotesDestaques[i] ?? [],
      }),
    })
    if (res.status === 401) {
      derrubarSessao()
      return false
    }
    if (!res.ok) {
      // fica no outbox para a próxima tentativa — mas agora com rastro no console
      console.warn('[sync] push falhou', res.status)
      return false
    }
  }
  return true
}
```

- [ ] **Step 5: Aplicar `destaques` no pull**

Em `syncNow`, substituir o bloco que desserializa e aplica a resposta por:

```ts
    const data = (await res.json()) as {
      progresso: Parameters<typeof applyRemoteProgresso>[0]
      anotacoes: Parameters<typeof applyRemoteAnotacoes>[0]
      // opcional: uma resposta sem a lista (servidor mais velho, ou um mock de
      // teste) vira lista vazia em vez de estourar e abortar o pull inteiro.
      destaques?: Parameters<typeof applyRemoteDestaques>[0]
      agora: string
    }
    await applyRemoteProgresso(data.progresso)
    await applyRemoteAnotacoes(data.anotacoes)
    await applyRemoteDestaques(data.destaques ?? [])
    await setMeta(CURSOR_KEY, data.agora)
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 64 antigos + 2 novos = 66.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync.ts src/lib/sync.test.ts
git commit -m "feat: push/pull de destaques no cliente de sync"
```

---

### Task 3: `destaques` no Worker e no D1

**Files:**
- Create: `migrations/0004_destaques.sql`
- Modify: `worker/sync-logic.ts`
- Modify: `worker/index.ts`
- Modify: `worker/sync-logic.test.ts`

**Interfaces:**
- Consumes (Task 2): corpo do POST `{ progresso, anotacoes, destaques }`; a resposta do GET precisa devolver `destaques`.
- Produces:
  - `export type PushDestaque = { id: string; pericopeOrdem: number; verseId: string; cor: 'amarelo' | 'verde' | 'azul' | 'rosa'; criadoEm: string; atualizadoEm: string; apagadoEm: string | null }`
  - `parseSyncPush(body: unknown): { progresso: PushProgresso[]; anotacoes: PushAnotacao[]; destaques: PushDestaque[] } | null`
  - tabela D1 `destaques (user_id, id, pericope_ordem, verse_id, cor, criado_em, atualizado_em, apagado_em, server_em)` com PK `(user_id, id)`.

- [ ] **Step 1: Escrever os testes que falham**

Em `worker/sync-logic.test.ts`, acrescentar a fixture depois de `const nota = { ... }`:

```ts
const destaque = {
  id: '12:1:3',
  pericopeOrdem: 12,
  verseId: '1:3',
  cor: 'amarelo',
  criadoEm: '2026-08-31T09:00:00.000Z',
  atualizadoEm: '2026-08-31T10:00:00.000Z',
  apagadoEm: null,
}
```

Atualizar as três asserções existentes que comparam o retorno inteiro (agora com a terceira lista):

```ts
  it('aceita payload válido', () => {
    expect(parseSyncPush({ progresso: [prog], anotacoes: [nota] })).toEqual({
      progresso: [prog],
      anotacoes: [nota],
      destaques: [],
    })
  })
  it('aceita listas ausentes como vazias', () => {
    expect(parseSyncPush({})).toEqual({ progresso: [], anotacoes: [], destaques: [] })
  })
```

e, no `it('exige timestamps no formato ISO canônico (toISOString)')`, a última asserção:

```ts
    expect(
      parseSyncPush({ progresso: [{ ...prog, atualizadoEm: '2026-08-31T10:00:00.000Z' }] }),
    ).toEqual({
      progresso: [{ ...prog, atualizadoEm: '2026-08-31T10:00:00.000Z' }],
      anotacoes: [],
      destaques: [],
    })
```

E acrescentar, no fim do arquivo, um `describe` novo:

```ts
describe('parseSyncPush — destaques', () => {
  it('aceita destaque válido', () => {
    expect(parseSyncPush({ destaques: [destaque] })).toEqual({
      progresso: [],
      anotacoes: [],
      destaques: [destaque],
    })
  })
  it('aceita lápide (apagadoEm ISO)', () => {
    const lapide = { ...destaque, apagadoEm: '2026-08-31T11:00:00.000Z' }
    expect(parseSyncPush({ destaques: [lapide] })?.destaques).toEqual([lapide])
  })
  it('rejeita cor fora do enum, verseId malformado, id vazio e datas inválidas', () => {
    expect(parseSyncPush({ destaques: [{ ...destaque, cor: 'roxo' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, verseId: '1' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, verseId: 'x:1' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, id: '' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, criadoEm: '2026-08-31' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, apagadoEm: 'ontem' }] })).toBeNull()
  })
  it('rejeita lote de destaques acima de 500 itens', () => {
    expect(parseSyncPush({ destaques: Array(501).fill(destaque) })).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run worker/sync-logic.test.ts`
Expected: FAIL — o retorno de `parseSyncPush` não tem a chave `destaques`.

- [ ] **Step 3: Validação em `worker/sync-logic.ts`**

Acrescentar o tipo depois de `PushAnotacao`:

```ts
export type PushDestaque = {
  id: string
  pericopeOrdem: number
  verseId: string
  cor: 'amarelo' | 'verde' | 'azul' | 'rosa'
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}
```

Acrescentar as constantes junto das existentes (depois de `const STATUS = ...`):

```ts
const CORES = new Set(['amarelo', 'verde', 'azul', 'rosa'])
// "capitulo:versiculo" — o mesmo formato do TextoBlock.id no cliente.
const VERSE_ID = /^\d+:\d+$/
```

Acrescentar o guard depois de `validAnotacao`:

```ts
function validDestaque(v: unknown): v is PushDestaque {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return (
    typeof d.id === 'string' &&
    d.id.length > 0 &&
    d.id.length <= 64 &&
    typeof d.pericopeOrdem === 'number' &&
    typeof d.verseId === 'string' &&
    VERSE_ID.test(d.verseId) &&
    typeof d.cor === 'string' &&
    CORES.has(d.cor) &&
    isIso(d.criadoEm) &&
    isIso(d.atualizadoEm) &&
    (d.apagadoEm === null || isIso(d.apagadoEm))
  )
}
```

Substituir `parseSyncPush` inteira por:

```ts
export function parseSyncPush(
  body: unknown,
): { progresso: PushProgresso[]; anotacoes: PushAnotacao[]; destaques: PushDestaque[] } | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const progresso = b.progresso ?? []
  const anotacoes = b.anotacoes ?? []
  // Corpo sem `destaques` é aceito como lista vazia: um cliente ainda não
  // atualizado continua sincronizando progresso e anotações normalmente.
  const destaques = b.destaques ?? []
  if (!Array.isArray(progresso) || !Array.isArray(anotacoes) || !Array.isArray(destaques)) return null
  if (progresso.length > MAX_ITENS || anotacoes.length > MAX_ITENS || destaques.length > MAX_ITENS) {
    return null
  }
  if (
    !progresso.every(validProgresso) ||
    !anotacoes.every(validAnotacao) ||
    !destaques.every(validDestaque)
  ) {
    return null
  }
  return { progresso, anotacoes, destaques }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run worker/sync-logic.test.ts`
Expected: PASS — 5 antigos + 4 novos = 9 neste arquivo.

- [ ] **Step 5: Migration `migrations/0004_destaques.sql`**

Criar o arquivo com:

```sql
-- Terceira entidade sincronizada: um destaque de cor por versículo por usuário.
-- Mesma receita das outras: PK (user_id, id), atualizado_em como chave do LWW,
-- server_em como cursor de pull (indexado), apagado_em como lápide.
CREATE TABLE "destaques" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "id" TEXT NOT NULL,
  "pericope_ordem" INTEGER NOT NULL,
  "verse_id" TEXT NOT NULL,
  "cor" TEXT NOT NULL,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  "apagado_em" TEXT,
  "server_em" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX "idx_destaques_user_server" ON "destaques" ("user_id", "server_em");
```

- [ ] **Step 6: SELECT e upsert em `worker/index.ts`**

No handler `app.get('/api/sync', ...)`, depois do `const notas = await c.env.DB.prepare(...)` e antes do `return c.json(...)`:

```ts
  const marcas = await c.env.DB.prepare(
    `SELECT id, pericope_ordem AS pericopeOrdem, verse_id AS verseId, cor,
            criado_em AS criadoEm, atualizado_em AS atualizadoEm, apagado_em AS apagadoEm
     FROM destaques WHERE user_id = ?1 AND server_em > ?2`,
  )
    .bind(userId, since)
    .all()
```

e a resposta vira:

```ts
  // server_em não volta para o cliente: o cursor dele é o `agora` opaco.
  return c.json({
    progresso: prog.results,
    anotacoes: notas.results,
    destaques: marcas.results,
    agora,
  })
```

No handler `app.post('/api/sync', ...)`, acrescentar ao array `stmts`, depois do bloco `...parsed.anotacoes.map(...)`:

```ts
    ...parsed.destaques.map((d) =>
      c.env.DB.prepare(
        `INSERT INTO destaques (user_id, id, pericope_ordem, verse_id, cor, criado_em, atualizado_em, apagado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(user_id, id) DO UPDATE SET
           cor = excluded.cor, atualizado_em = excluded.atualizado_em,
           apagado_em = excluded.apagado_em, server_em = excluded.server_em
         WHERE excluded.atualizado_em > destaques.atualizado_em`,
      ).bind(
        userId,
        d.id,
        d.pericopeOrdem,
        d.verseId,
        d.cor,
        d.criadoEm,
        d.atualizadoEm,
        d.apagadoEm,
        serverEm,
      ),
    ),
```

- [ ] **Step 7: Verificar tipos do Worker e a suíte inteira**

Run: `npm run typecheck:worker && npm test`
Expected: PASS — typecheck sem erros; 66 antigos + 4 novos = 70 testes.

- [ ] **Step 8: Commit**

```bash
git add migrations/0004_destaques.sql worker/sync-logic.ts worker/index.ts worker/sync-logic.test.ts
git commit -m "feat: tabela destaques no D1 com validação e upsert LWW no Worker"
```

---

### Task 4: `verseRef` nas anotações (cliente + Worker + D1)

**Files:**
- Create: `migrations/0005_anotacao_verse_ref.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/user-db.ts`
- Modify: `src/lib/sync.ts`
- Modify: `worker/sync-logic.ts`
- Modify: `worker/index.ts`
- Modify: `src/lib/user-db.test.ts`
- Modify: `worker/sync-logic.test.ts`

**Interfaces:**
- Consumes (Tasks 1–3): `Anotacao`, `saveAnotacao`, `applyRemoteAnotacoes`, `parseSyncPush`.
- Produces:
  - `Anotacao` ganha `verseRef: string | null` (formato `"c:v"` ou `"c:v-c:v"`)
  - `saveAnotacao(pericopeOrdem: number, texto: string, id?: string, verseRef?: string | null): Promise<Anotacao>` — `verseRef` ausente numa edição preserva o vínculo existente
  - `applyRemoteAnotacoes` aceita `verseRef?: string | null` em cada item
  - `PushAnotacao` (worker) ganha `verseRef: string | null`; `parseSyncPush` normaliza ausente ⇒ `null`
  - Tasks 7 e 8 consomem `saveAnotacao(..., verseRef)` e `Anotacao.verseRef`.

- [ ] **Step 1: Escrever os testes que falham**

Em `worker/sync-logic.test.ts`, acrescentar `verseRef: null` à fixture `nota` (depois de `texto`), e acrescentar no fim do arquivo:

```ts
describe('parseSyncPush — verseRef da anotação', () => {
  it('aceita string, null e ausente (ausente vira null)', () => {
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: '1:3-2:2' }] })?.anotacoes).toEqual([
      { ...nota, verseRef: '1:3-2:2' },
    ])
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: null }] })?.anotacoes).toEqual([nota])
    const semCampo = { ...nota } as Record<string, unknown>
    delete semCampo.verseRef
    expect(parseSyncPush({ anotacoes: [semCampo] })?.anotacoes).toEqual([nota])
  })
  it('rejeita verseRef de tipo errado ou acima de 32 chars', () => {
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: 7 }] })).toBeNull()
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: 'x'.repeat(33) }] })).toBeNull()
  })
})
```

Em `src/lib/user-db.test.ts`, acrescentar no fim do arquivo:

```ts
describe('anotações com vínculo a versículo', () => {
  it('saveAnotacao grava verseRef e a edição preserva criadoEm e o vínculo', async () => {
    const nova = await saveAnotacao(9105, 'nota vinculada', undefined, '1:3-1:7')
    expect(nova.verseRef).toBe('1:3-1:7')

    const editada = await saveAnotacao(9105, 'nota editada', nova.id)
    expect(editada.id).toBe(nova.id)
    expect(editada.criadoEm).toBe(nova.criadoEm)
    expect(editada.verseRef).toBe('1:3-1:7')

    const semVinculo = await saveAnotacao(9105, 'nota editada', nova.id, null)
    expect(semVinculo.verseRef).toBeNull()
  })

  it('anotação sem vínculo tem verseRef null', async () => {
    const nota = await saveAnotacao(9106, 'nota solta')
    expect(nota.verseRef).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts worker/sync-logic.test.ts`
Expected: FAIL — `verseRef` não existe em `Anotacao` nem em `parseSyncPush`.

- [ ] **Step 3: Tipo em `src/lib/types.ts`**

Substituir o bloco `Anotacao` por:

```ts
export type Anotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  /** Vínculo opcional a versículo(s): "c:v" ou "c:v-c:v". */
  verseRef: string | null
  criadoEm: string
  atualizadoEm: string
}
```

- [ ] **Step 4: `saveAnotacao` e `applyRemoteAnotacoes` em `src/lib/user-db.ts`**

Substituir `saveAnotacao` por:

```ts
export async function saveAnotacao(
  pericopeOrdem: number,
  texto: string,
  id?: string,
  verseRef?: string | null,
): Promise<Anotacao> {
  const now = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['anotacoes', 'outbox'], 'readwrite')
  const notas = tx.objectStore('anotacoes')
  const existing = id ? await notas.get(id) : undefined
  const note: Anotacao = {
    id: existing?.id ?? crypto.randomUUID(),
    pericopeOrdem,
    // Trunca no ponto de escrita: o servidor rejeita o lote inteiro acima de
    // MAX_TEXTO, e uma nota grande demais travaria o outbox para sempre.
    texto: texto.slice(0, MAX_TEXTO),
    // Parâmetro ausente numa edição preserva o vínculo; `null` explícito remove.
    verseRef: verseRef !== undefined ? verseRef : (existing?.verseRef ?? null),
    criadoEm: existing?.criadoEm ?? now,
    atualizadoEm: now,
  }
  await notas.put(note)
  await tx.objectStore('outbox').put({ kind: 'anotacao', nota: note, apagadoEm: null } as OutboxItem)
  await tx.done
  return note
}
```

Em `applyRemoteAnotacoes`, acrescentar `verseRef?: string | null` ao tipo do item (depois de `texto: string`) e normalizar na escrita:

```ts
export async function applyRemoteAnotacoes(
  items: {
    id: string
    pericopeOrdem: number
    texto: string
    verseRef?: string | null
    criadoEm: string
    atualizadoEm: string
    apagadoEm: string | null
  }[],
): Promise<void> {
  const d = await db()
  for (const item of items) {
    const local = await d.get('anotacoes', item.id)
    if (!remoteWinsLocal(item.atualizadoEm, local?.atualizadoEm)) continue
    if (item.apagadoEm) {
      await d.delete('anotacoes', item.id)
    } else {
      const { apagadoEm: _apagadoEm, ...nota } = item
      // Linha vinda de servidor sem a coluna (ou de antes da migration) entra
      // como null: o tipo local exige o campo presente.
      await d.put('anotacoes', { ...nota, verseRef: nota.verseRef ?? null })
    }
  }
}
```

- [ ] **Step 5: `PushAnotacao` em `src/lib/sync.ts`**

Acrescentar o campo ao tipo (depois de `texto: string`):

```ts
type PushAnotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  verseRef: string | null
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}
```

(O `toPush` já espalha `...item.nota`, que agora carrega `verseRef` — nenhuma outra mudança em `sync.ts`.)

- [ ] **Step 6: Validação em `worker/sync-logic.ts`**

Acrescentar o campo a `PushAnotacao` (depois de `texto: string`):

```ts
  verseRef: string | null
```

Acrescentar a constante junto das outras:

```ts
// "c:v" ou "c:v-c:v" cabem folgado; o limite existe só para barrar abuso.
const MAX_VERSE_REF = 32
```

Substituir `validAnotacao` por:

```ts
function validAnotacao(v: unknown): v is Omit<PushAnotacao, 'verseRef'> {
  if (typeof v !== 'object' || v === null) return false
  const a = v as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    a.id.length > 0 &&
    a.id.length <= 64 &&
    typeof a.pericopeOrdem === 'number' &&
    typeof a.texto === 'string' &&
    a.texto.length <= MAX_TEXTO &&
    (a.verseRef === undefined ||
      a.verseRef === null ||
      (typeof a.verseRef === 'string' && a.verseRef.length <= MAX_VERSE_REF)) &&
    isIso(a.criadoEm) &&
    isIso(a.atualizadoEm) &&
    (a.apagadoEm === null || isIso(a.apagadoEm))
  )
}
```

E normalizar no `return` de `parseSyncPush` (só a última linha muda):

```ts
  return {
    progresso,
    anotacoes: anotacoes.map((a) => ({
      ...a,
      verseRef: typeof a.verseRef === 'string' ? a.verseRef : null,
    })),
    destaques,
  }
```

- [ ] **Step 7: Migration `migrations/0005_anotacao_verse_ref.sql`**

Criar o arquivo com:

```sql
-- Vínculo opcional de uma anotação a versículo(s): "c:v" ou "c:v-c:v".
-- Nullable e sem default: linhas anteriores à migration ficam com NULL, que é
-- exatamente o que o cliente entende como "anotação sem vínculo".
ALTER TABLE "anotacoes" ADD COLUMN "verse_ref" TEXT;
```

- [ ] **Step 8: SELECT e upsert de `verse_ref` em `worker/index.ts`**

No `app.get('/api/sync', ...)`, substituir a query de `notas` por:

```ts
  const notas = await c.env.DB.prepare(
    `SELECT id, pericope_ordem AS pericopeOrdem, texto, verse_ref AS verseRef,
            criado_em AS criadoEm, atualizado_em AS atualizadoEm, apagado_em AS apagadoEm
     FROM anotacoes WHERE user_id = ?1 AND server_em > ?2`,
  )
    .bind(userId, since)
    .all()
```

No `app.post('/api/sync', ...)`, substituir o bloco `...parsed.anotacoes.map(...)` por:

```ts
    ...parsed.anotacoes.map((a) =>
      c.env.DB.prepare(
        `INSERT INTO anotacoes (id, user_id, pericope_ordem, texto, verse_ref, criado_em, atualizado_em, apagado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(user_id, id) DO UPDATE SET
           texto = excluded.texto, verse_ref = excluded.verse_ref,
           atualizado_em = excluded.atualizado_em,
           apagado_em = excluded.apagado_em, server_em = excluded.server_em
         WHERE excluded.atualizado_em > anotacoes.atualizado_em`,
      ).bind(
        a.id,
        userId,
        a.pericopeOrdem,
        a.texto,
        a.verseRef,
        a.criadoEm,
        a.atualizadoEm,
        a.apagadoEm,
        serverEm,
      ),
    ),
```

- [ ] **Step 9: Rodar tudo e ver verde**

Run: `npm run typecheck:worker && npm test`
Expected: PASS — 70 antigos + 4 novos = 74 testes.

- [ ] **Step 10: Commit**

```bash
git add migrations/0005_anotacao_verse_ref.sql src/lib/types.ts src/lib/user-db.ts src/lib/sync.ts worker/sync-logic.ts worker/index.ts src/lib/user-db.test.ts worker/sync-logic.test.ts
git commit -m "feat: anotações com vínculo a versículo (verseRef) ponta a ponta"
```

---

### Task 5: `src/lib/verse-range.ts` — intervalo, rótulos e transição de seleção

**Files:**
- Create: `src/lib/verse-range.ts`
- Create: `src/lib/verse-range.test.ts`

**Interfaces:**
- Consumes: `TextoBlock`, `VerseBlock` de `./parse-texto`; `Pericope` de `./types`.
- Produces:
  - `type VerseSelection = { start: string; end: string }`
  - `versesInRange(blocks: TextoBlock[], startId: string, endId: string): VerseBlock[]`
  - `rangeRef(verses: VerseBlock[]): string | null`
  - `parseVerseRef(verseRef: string): { start: string; end: string } | null`
  - `verseRefLabel(abbrev: string, verseRef: string): string`
  - `rangeLabel(p: Pericope, verses: VerseBlock[]): string`
  - `nextSelection(blocks: TextoBlock[], atual: VerseSelection | null, id: string): VerseSelection | null`
  - Tasks 7 e 8 consomem todos estes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/verse-range.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseTextoNaa } from './parse-texto'
import {
  nextSelection,
  parseVerseRef,
  rangeLabel,
  rangeRef,
  verseRefLabel,
  versesInRange,
} from './verse-range'
import type { Pericope } from './types'

const TEXTO = 'Capítulo 1\n1 Um\n2 Dois\n3 Três\nCapítulo 2\n1 Quatro\n2 Cinco'
const blocks = parseTextoNaa(TEXTO)
const gn = { abbrev: 'Gn' } as Pericope

describe('versesInRange', () => {
  it('intervalo simples no mesmo capítulo', () => {
    expect(versesInRange(blocks, '1:1', '1:3').map((v) => v.id)).toEqual(['1:1', '1:2', '1:3'])
  })

  it('atravessa capítulo', () => {
    expect(versesInRange(blocks, '1:3', '2:1').map((v) => v.id)).toEqual(['1:3', '2:1'])
  })

  it('ids invertidos são normalizados', () => {
    expect(versesInRange(blocks, '2:2', '1:2').map((v) => v.id)).toEqual([
      '1:2',
      '1:3',
      '2:1',
      '2:2',
    ])
  })

  it('um único versículo', () => {
    expect(versesInRange(blocks, '1:2', '1:2').map((v) => v.id)).toEqual(['1:2'])
  })

  it('id inexistente devolve lista vazia', () => {
    expect(versesInRange(blocks, '1:1', '9:9')).toEqual([])
    expect(versesInRange([], '1:1', '1:1')).toEqual([])
  })
})

describe('rangeRef e parseVerseRef', () => {
  it('um versículo vira "c:v" e um intervalo vira "c:v-c:v"', () => {
    expect(rangeRef(versesInRange(blocks, '1:2', '1:2'))).toBe('1:2')
    expect(rangeRef(versesInRange(blocks, '1:2', '2:1'))).toBe('1:2-2:1')
  })

  it('lista vazia não tem ref', () => {
    expect(rangeRef([])).toBeNull()
  })

  it('parseVerseRef lê os dois formatos e rejeita lixo', () => {
    expect(parseVerseRef('1:2')).toEqual({ start: '1:2', end: '1:2' })
    expect(parseVerseRef('1:2-2:1')).toEqual({ start: '1:2', end: '2:1' })
    expect(parseVerseRef('abacaxi')).toBeNull()
    expect(parseVerseRef('1:2-')).toBeNull()
  })
})

describe('rótulos', () => {
  it('versículo único, intervalo no mesmo capítulo e intervalo cruzando capítulo', () => {
    expect(rangeLabel(gn, versesInRange(blocks, '1:2', '1:2'))).toBe('Gn 1:2')
    expect(rangeLabel(gn, versesInRange(blocks, '1:1', '1:3'))).toBe('Gn 1:1–3')
    expect(rangeLabel(gn, versesInRange(blocks, '1:3', '2:2'))).toBe('Gn 1:3–2:2')
  })

  it('verseRefLabel reconstrói o rótulo a partir do vínculo salvo', () => {
    expect(verseRefLabel('Gn', '1:3')).toBe('Gn 1:3')
    expect(verseRefLabel('Gn', '1:3-1:7')).toBe('Gn 1:3–7')
    expect(verseRefLabel('Gn', '1:30-2:2')).toBe('Gn 1:30–2:2')
    expect(verseRefLabel('Gn', 'lixo')).toBe('lixo')
  })

  it('sem versículos válidos o rótulo é só a abreviação', () => {
    expect(rangeLabel(gn, [])).toBe('Gn')
  })
})

describe('nextSelection', () => {
  it('sem seleção, o toque seleciona só aquele versículo', () => {
    expect(nextSelection(blocks, null, '1:2')).toEqual({ start: '1:2', end: '1:2' })
  })

  it('toque fora da seleção estende o intervalo', () => {
    expect(nextSelection(blocks, { start: '1:1', end: '1:1' }, '2:1')).toEqual({
      start: '1:1',
      end: '2:1',
    })
  })

  it('toque dentro de um intervalo recolhe para aquele versículo', () => {
    expect(nextSelection(blocks, { start: '1:1', end: '2:1' }, '1:3')).toEqual({
      start: '1:3',
      end: '1:3',
    })
  })

  it('toque no único selecionado desseleciona', () => {
    expect(nextSelection(blocks, { start: '1:2', end: '1:2' }, '1:2')).toBeNull()
  })

  it('id fora do texto não muda a seleção; seleção órfã reinicia no toque', () => {
    expect(nextSelection(blocks, { start: '1:1', end: '1:1' }, '9:9')).toEqual({
      start: '1:1',
      end: '1:1',
    })
    expect(nextSelection(blocks, { start: '7:7', end: '7:7' }, '1:2')).toEqual({
      start: '1:2',
      end: '1:2',
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/verse-range.test.ts`
Expected: FAIL — o módulo `./verse-range` não existe.

- [ ] **Step 3: Implementar `src/lib/verse-range.ts`**

Criar o arquivo com:

```ts
import type { TextoBlock, VerseBlock } from './parse-texto'
import type { Pericope } from './types'

export type VerseSelection = { start: string; end: string }

/** "capitulo:versiculo". Versículos órfãos do parser usam "x:N" e ficam de fora
 * dos rótulos/vínculos — mas continuam entrando na seleção para copiar o texto. */
const VERSE_ID = /^\d+:\d+$/

/** Todos os versículos entre dois ids, na ordem dos blocos (inclusive
 * atravessando capítulos). Ids invertidos são normalizados; id inexistente
 * devolve lista vazia. */
export function versesInRange(
  blocks: TextoBlock[],
  startId: string,
  endId: string,
): VerseBlock[] {
  const verses = blocks.filter((b): b is VerseBlock => b.kind === 'verse')
  const a = verses.findIndex((v) => v.id === startId)
  const b = verses.findIndex((v) => v.id === endId)
  if (a === -1 || b === -1) return []
  const [from, to] = a <= b ? [a, b] : [b, a]
  return verses.slice(from, to + 1)
}

/** Vínculo persistido de uma anotação: "c:v" ou "c:v-c:v". */
export function rangeRef(verses: VerseBlock[]): string | null {
  const uteis = verses.filter((v) => VERSE_ID.test(v.id))
  if (uteis.length === 0) return null
  const first = uteis[0]
  const last = uteis[uteis.length - 1]
  return first.id === last.id ? first.id : `${first.id}-${last.id}`
}

export function parseVerseRef(verseRef: string): VerseSelection | null {
  const parts = verseRef.split('-')
  if (parts.length === 1 && VERSE_ID.test(parts[0])) return { start: parts[0], end: parts[0] }
  if (parts.length === 2 && VERSE_ID.test(parts[0]) && VERSE_ID.test(parts[1])) {
    return { start: parts[0], end: parts[1] }
  }
  return null
}

/** "Gn 1:3", "Gn 1:3–7", "Gn 1:30–2:2" (travessão, não hífen). */
export function verseRefLabel(abbrev: string, verseRef: string): string {
  const parsed = parseVerseRef(verseRef)
  if (!parsed) return verseRef
  const [c1, v1] = parsed.start.split(':')
  const [c2, v2] = parsed.end.split(':')
  if (parsed.start === parsed.end) return `${abbrev} ${c1}:${v1}`
  if (c1 === c2) return `${abbrev} ${c1}:${v1}–${v2}`
  return `${abbrev} ${c1}:${v1}–${c2}:${v2}`
}

export function rangeLabel(p: Pericope, verses: VerseBlock[]): string {
  const ref = rangeRef(verses)
  if (!ref) return p.abbrev
  return verseRefLabel(p.abbrev, ref)
}

/**
 * Transição de seleção a cada toque num versículo:
 * sem seleção → só ele; fora da seleção → estende o intervalo; dentro de um
 * intervalo → recolhe para ele; no único selecionado → desseleciona (null).
 */
export function nextSelection(
  blocks: TextoBlock[],
  atual: VerseSelection | null,
  id: string,
): VerseSelection | null {
  const existe = blocks.some((b) => b.kind === 'verse' && b.id === id)
  if (!existe) return atual
  if (!atual) return { start: id, end: id }
  const dentro = versesInRange(blocks, atual.start, atual.end)
  // Seleção órfã (restaurada de outra perícope): recomeça neste versículo.
  if (dentro.length === 0) return { start: id, end: id }
  if (dentro.some((v) => v.id === id)) {
    return dentro.length === 1 ? null : { start: id, end: id }
  }
  return { start: atual.start, end: id }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 74 antigos + 16 novos = 90 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verse-range.ts src/lib/verse-range.test.ts
git commit -m "feat: verse-range com intervalo, rótulos e transição de seleção"
```

---

### Task 6: Tema sépia e "seguir sistema"

**Files:**
- Modify: `src/lib/theme.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ReadingMenu.tsx`
- Modify: `src/styles/app.css`
- Create: `src/lib/theme.test.ts`

**Interfaces:**
- Consumes: `applyTheme`/`resolveTheme`/`toggleTheme` existentes; evento `pericopes-theme`.
- Produces:
  - `type Theme = 'light' | 'dark' | 'sepia'`
  - `type ThemePref = Theme | 'system'`
  - `getStoredTheme(): Theme | null`
  - `getThemePref(): ThemePref`
  - `setThemePref(pref: ThemePref): Theme`
  - paleta CSS `[data-theme='sepia']`
  - Task 7 acrescenta os tokens `--hl-*` às quatro paletas criadas/tocadas aqui.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/theme.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { getStoredTheme, getThemePref, resolveTheme, setThemePref, toggleTheme } from './theme'
import { installLocalStorageMock } from './testing/storage-mock'

installLocalStorageMock()

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('sem chave, a preferência é seguir o sistema', () => {
    expect(getStoredTheme()).toBeNull()
    expect(getThemePref()).toBe('system')
    // happy-dom não prefere dark: o resolvido é claro
    expect(resolveTheme()).toBe('light')
  })

  it('setThemePref("sepia") grava, aplica e vira a preferência', () => {
    expect(setThemePref('sepia')).toBe('sepia')
    expect(localStorage.getItem('pericopes-theme')).toBe('sepia')
    expect(document.documentElement.dataset.theme).toBe('sepia')
    expect(getThemePref()).toBe('sepia')
    expect(resolveTheme()).toBe('sepia')
  })

  it('setThemePref("system") remove a chave e aplica o resolvido', () => {
    setThemePref('dark')
    expect(setThemePref('system')).toBe('light')
    expect(localStorage.getItem('pericopes-theme')).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(getThemePref()).toBe('system')
  })

  it('valor armazenado desconhecido é ignorado', () => {
    localStorage.setItem('pericopes-theme', 'roxo')
    expect(getStoredTheme()).toBeNull()
    expect(getThemePref()).toBe('system')
  })

  it('toggleTheme a partir de sépia vai para escuro', () => {
    setThemePref('sepia')
    expect(toggleTheme()).toBe('dark')
    expect(getThemePref()).toBe('dark')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL — `setThemePref`/`getThemePref` não existem.

- [ ] **Step 3: Reescrever `src/lib/theme.ts`**

Substituir o arquivo inteiro por:

```ts
const KEY = 'pericopes-theme'

export type Theme = 'light' | 'dark' | 'sepia'

/** Preferência armazenada; 'system' = nenhuma chave gravada. */
export type ThemePref = Theme | 'system'

const TEMAS: Theme[] = ['light', 'dark', 'sepia']

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return TEMAS.includes(v as Theme) ? (v as Theme) : null
  } catch {
    return null
  }
}

export function getThemePref(): ThemePref {
  return getStoredTheme() ?? 'system'
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

/** Ponto único de aplicação: dataset + persistência + evento de resync. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
  window.dispatchEvent(new Event('pericopes-theme'))
}

export function setThemePref(pref: ThemePref): Theme {
  if (pref !== 'system') {
    applyTheme(pref)
    return pref
  }
  // 'system' é a AUSÊNCIA da chave: gravar o resolvido aqui congelaria o tema
  // e o app deixaria de acompanhar o sistema.
  try {
    localStorage.removeItem(KEY)
  } catch {
    // idem
  }
  const resolvido = resolveTheme()
  document.documentElement.dataset.theme = resolvido
  window.dispatchEvent(new Event('pericopes-theme'))
  return resolvido
}

/** Alternância explícita do header: claro↔escuro (a partir de sépia vai para escuro). */
export function toggleTheme(): Theme {
  const next: Theme = resolveTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS — 5 testes novos.

- [ ] **Step 5: `Shell` não pode congelar o "seguir sistema"**

Em `src/App.tsx`, trocar o import de tema por:

```tsx
import { getStoredTheme, resolveTheme, toggleTheme, type Theme } from './lib/theme'
```

Remover o efeito que persiste o tema no mount:

```tsx
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
```

(o script inline do `index.html` já pinta o `data-theme` antes da hidratação, e `toggleTheme`/`setThemePref` aplicam nas trocas).

Acrescentar, depois do efeito que escuta `pericopes-theme`, um efeito que acompanha o sistema enquanto não houver preferência gravada:

```tsx
  // Sem preferência gravada, o app segue o sistema em tempo real.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      if (getStoredTheme() !== null) return
      const t = resolveTheme()
      document.documentElement.dataset.theme = t
      setTheme(t)
    }
    mq.addEventListener('change', onSystem)
    return () => mq.removeEventListener('change', onSystem)
  }, [])
```

- [ ] **Step 6: Linha "Tema" com 4 botões no `ReadingMenu`**

Em `src/components/ReadingMenu.tsx`, trocar o import de tema por:

```tsx
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
```

Acrescentar, depois de `const LAYOUTS = [...]`:

```tsx
const TEMAS: { id: ThemePref; label: string }[] = [
  { id: 'light', label: 'Claro' },
  { id: 'sepia', label: 'Sépia' },
  { id: 'dark', label: 'Escuro' },
  { id: 'system', label: 'Sistema' },
]
```

Trocar o estado `theme` por:

```tsx
  const [themePref, setPref] = useState<ThemePref>(() => getThemePref())
```

e o efeito de resync por:

```tsx
  useEffect(() => {
    const onTheme = () => setPref(getThemePref())
    window.addEventListener('pericopes-theme', onTheme)
    return () => window.removeEventListener('pericopes-theme', onTheme)
  }, [])
```

Substituir a linha "Tema" inteira por:

```tsx
          <div className="readmenu-row" role="group" aria-label="Tema">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`read-tool${themePref === t.id ? ' active' : ''}`}
                aria-pressed={themePref === t.id}
                onClick={() => {
                  setThemePref(t.id)
                  setPref(t.id)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
```

- [ ] **Step 7: Paleta sépia e correção do fallback dark no CSS**

Em `src/styles/app.css`, acrescentar o bloco abaixo logo depois do bloco `[data-theme='dark'] { ... }` (que termina na linha com `color-scheme: dark;` seguida de `}`):

```css
[data-theme='sepia'] {
  --bg: #f0e7d5;
  --bg-deep: #e4d8bf;
  --ink: #3a2f21;
  --read-ink: #2b2318;
  --read-shadow: 0 1px 0 rgb(43 35 24 / 0.08);
  --muted: #6b5b45;
  --accent: #8a5a2b;
  --accent-soft: #ecdcc2;
  --line: #d8c9ac;
  --paper: #f7f0e0;
  --cta-ink: #fbf6ec;
  --glow-a: #efe2c8;
  --glow-b: #e8dcc3;
  --focus-bg: color-mix(in srgb, var(--accent) 14%, var(--paper));
  --focus-line: color-mix(in srgb, var(--accent) 45%, var(--line));
  color-scheme: light;
}
```

E — **obrigatório** — corrigir o seletor do fallback dark por media query, senão um sistema em dark atropela o sépia explícito:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']):not([data-theme='sepia']) {
```

(só a linha do seletor muda; o corpo do bloco continua igual).

- [ ] **Step 8: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 90 antigos + 5 novos = 95 testes; lint e build sem erro.

- [ ] **Step 9: Verificação visual**

Abrir `npm run dev`, ir a uma perícope, abrir "Aa" e conferir: os 4 botões de tema alternam claro/sépia/escuro/sistema; "Sistema" fica `aria-pressed` quando não há chave `pericopes-theme` no localStorage; em sépia o fundo é papel quente e o texto marrom-escuro mesmo com o SO em dark; recarregar a página mantém o tema escolhido sem flash.

- [ ] **Step 10: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts src/App.tsx src/components/ReadingMenu.tsx src/styles/app.css
git commit -m "feat: tema sépia e opção de seguir o sistema"
```

---

### Task 7: Seleção de intervalo, barra de ações e render dos destaques

**Files:**
- Create: `src/components/VerseActions.tsx`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `nextSelection`, `versesInRange`, `rangeLabel`, `rangeRef`, `type VerseSelection` (Task 5); `listDestaques`, `setDestaque`, `removeDestaque` (Task 1); `DestaqueCor` (Task 1); `setVerseFocus`/`getVerseFocus` existentes; `parseTextoNaa`/`groupCorrido`/`VerseBlock` existentes.
- Produces:
  - componente `VerseActions` com props `{ label: string; temDestaque: boolean; aviso: string; onCopiar: () => void; onCompartilhar: () => void; onDestacar: (cor: DestaqueCor) => void; onRemoverDestaque: () => void; onAnotar: () => void; onFechar: () => void }`
  - `export const CORES: { id: DestaqueCor; label: string }[]` em `VerseActions.tsx`
  - estado `draftRef: string | null` em `Leitura.tsx` (consumido pela Task 8)
  - classes CSS `.verse-actions*`, `.hl-swatch`, `.verse-hl-<cor>` e tokens `--hl-amarelo|verde|azul|rosa` nas quatro paletas.

- [ ] **Step 1: Criar `src/components/VerseActions.tsx`**

```tsx
import { useEffect } from 'react'
import type { DestaqueCor } from '../lib/types'

export const CORES: { id: DestaqueCor; label: string }[] = [
  { id: 'amarelo', label: 'Amarelo' },
  { id: 'verde', label: 'Verde' },
  { id: 'azul', label: 'Azul' },
  { id: 'rosa', label: 'Rosa' },
]

type Props = {
  label: string
  temDestaque: boolean
  aviso: string
  onCopiar: () => void
  onCompartilhar: () => void
  onDestacar: (cor: DestaqueCor) => void
  onRemoverDestaque: () => void
  onAnotar: () => void
  onFechar: () => void
}

export default function VerseActions({
  label,
  temDestaque,
  aviso,
  onCopiar,
  onCompartilhar,
  onDestacar,
  onRemoverDestaque,
  onAnotar,
  onFechar,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  return (
    <div className="verse-actions" role="dialog" aria-label={`Ações para ${label}`}>
      <div className="verse-actions-head">
        <strong className="verse-actions-ref">{label}</strong>
        <button type="button" className="linkish" onClick={onFechar}>
          Fechar
        </button>
      </div>
      <div className="verse-actions-row">
        <button type="button" className="ghost" onClick={onCopiar}>
          Copiar
        </button>
        <button type="button" className="ghost" onClick={onCompartilhar}>
          Compartilhar
        </button>
        <button type="button" className="ghost" onClick={onAnotar}>
          Anotar
        </button>
      </div>
      <div className="verse-actions-row" role="group" aria-label="Destacar">
        {CORES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`hl-swatch hl-${c.id}`}
            aria-label={`Destacar em ${c.label.toLowerCase()}`}
            onClick={() => onDestacar(c.id)}
          />
        ))}
        {temDestaque && (
          <button type="button" className="linkish" onClick={onRemoverDestaque}>
            Remover
          </button>
        )}
      </div>
      <p className="verse-actions-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Imports e estado novos em `src/pages/Leitura.tsx`**

Trocar a primeira linha do arquivo por:

```tsx
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
```

Acrescentar aos imports existentes:

```tsx
import VerseActions from '../components/VerseActions'
import { groupCorrido, parseTextoNaa, type VerseBlock } from '../lib/parse-texto'
import { nextSelection, rangeLabel, rangeRef, versesInRange, type VerseSelection } from '../lib/verse-range'
```

(a linha `import { groupCorrido, parseTextoNaa } from '../lib/parse-texto'` é substituída pela acima).

No import de `../lib/user-db`, acrescentar `listDestaques`, `removeDestaque` e `setDestaque`:

```tsx
import {
  deleteAnotacao,
  getProgresso,
  listAnotacoes,
  listDestaques,
  removeDestaque,
  saveAnotacao,
  setDestaque,
  setProgresso,
} from '../lib/user-db'
```

No import de tipos, acrescentar `DestaqueCor`:

```tsx
import type { Anotacao, DestaqueCor, Pericope, ProgressoStatus } from '../lib/types'
```

Trocar o estado `focusId` pelos estados novos (substituir a linha `const [focusId, setFocusId] = useState<string | null>(null)`):

```tsx
  const [selection, setSelection] = useState<VerseSelection | null>(null)
  const [barOpen, setBarOpen] = useState(false)
  const [destaques, setDestaques] = useState<Map<string, DestaqueCor>>(new Map())
  const [draftRef, setDraftRef] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
```

- [ ] **Step 3: `blocks` e `selecionados` memoizados antes dos handlers**

Acrescentar logo depois de `const doneRef = useRef(false)`:

```tsx
  // Memoizado: o parser roda uma vez por perícope, não a cada render — e os
  // handlers de seleção precisam dos blocos antes dos returns antecipados.
  const blocks = useMemo(() => (p ? parseTextoNaa(p.texto_naa) : []), [p])
  const selecionados = useMemo(
    () => (selection ? versesInRange(blocks, selection.start, selection.end) : []),
    [blocks, selection],
  )
```

E remover a linha `const blocks = parseTextoNaa(p.texto_naa)` que ficava depois dos returns antecipados.

- [ ] **Step 4: Efeito de carga restaura seleção e destaques**

Dentro do efeito de carga, substituir o trecho de foco por:

```tsx
        const fromQuery =
          verseParam && /^\d+:\d+$/.test(verseParam) ? verseParam : null
        const focus = fromQuery ?? getVerseFocus(ordem)
        // Restaurar foco seleciona só aquele versículo e NÃO abre a barra:
        // a barra é resposta a toque, não a navegação.
        setSelection(focus ? { start: focus, end: focus } : null)
        setBarOpen(false)
        setDraftRef(null)
        if (fromQuery) setVerseFocus(ordem, fromQuery)
        const hl = await listDestaques(ordem)
        setDestaques(new Map(hl.map((d) => [d.verseId, d.cor])))
```

- [ ] **Step 5: `selectVerse` passa a operar sobre intervalo**

Substituir a função `selectVerse` inteira por:

```tsx
  function selectVerse(id: string) {
    const prox = nextSelection(blocks, selection, id)
    setSelection(prox)
    setBarOpen(prox !== null)
    const verses = prox ? versesInRange(blocks, prox.start, prox.end) : []
    // "versículo em leitura" persistido continua sendo o PRIMEIRO da seleção.
    setVerseFocus(ordem, verses[0]?.id ?? null)
  }
```

- [ ] **Step 6: Ações da barra**

Acrescentar depois de `selectVerse`:

```tsx
  function flashAviso(msg: string) {
    setAviso(msg)
    window.setTimeout(() => setAviso(''), 1600)
  }

  function citacaoSelecao(): string {
    if (!p) return ''
    return `"${selecionados.map((v) => v.text).join(' ')}" (${rangeLabel(p, selecionados)}, NAA)`
  }

  async function copiarSelecao() {
    try {
      await navigator.clipboard.writeText(citacaoSelecao())
      flashAviso('Copiado ✓')
    } catch {
      flashAviso('Não foi possível copiar')
    }
  }

  async function compartilharSelecao() {
    if (navigator.share) {
      try {
        await navigator.share({ text: citacaoSelecao() })
        return
      } catch (e) {
        // cancelar o share nativo não é erro: some em silêncio
        if (e instanceof Error && e.name === 'AbortError') return
      }
    }
    await copiarSelecao()
  }

  async function destacarSelecao(cor: DestaqueCor) {
    const proximos = new Map(destaques)
    for (const v of selecionados) {
      await setDestaque(ordem, v.id, cor)
      proximos.set(v.id, cor)
    }
    setDestaques(proximos)
  }

  async function removerDestaqueSelecao() {
    const proximos = new Map(destaques)
    for (const v of selecionados) {
      await removeDestaque(`${ordem}:${v.id}`)
      proximos.delete(v.id)
    }
    setDestaques(proximos)
  }

  function anotarSelecao() {
    setTab('anotacoes')
    setDraftRef(rangeRef(selecionados))
    setBarOpen(false)
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('.note-form textarea')
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus()
    }, 0)
  }

  function fecharBarra() {
    setBarOpen(false)
  }
```

- [ ] **Step 7: Classes e rótulos dos versículos**

Acrescentar logo antes do `return (` do componente (depois dos returns antecipados de `err`/`!p`):

```tsx
  const selecionadosIds = new Set(selecionados.map((v) => v.id))

  function verseClass(base: string, id: string): string {
    const cor = destaques.get(id)
    const foco = selecionadosIds.has(id) ? ' verse-focus' : ''
    return `${base}${foco}${cor ? ` verse-hl-${cor}` : ''}`
  }

  function verseAria(b: VerseBlock): string {
    if (!b.verse) return b.text.slice(0, 40)
    const cor = destaques.get(b.id)
    const marcas = [
      selecionadosIds.has(b.id) ? 'selecionado' : '',
      cor ? `destacado em ${cor}` : '',
    ]
      .filter(Boolean)
      .join(', ')
    return `Versículo ${b.chapter}:${b.verse}${marcas ? `, ${marcas}` : ''}`
  }
```

E substituir os dois botões de versículo dentro de `<div className="texto-biblico">` para usarem os helpers. No modo corrido:

```tsx
                        <button
                          type="button"
                          className={verseClass('verse-inline', b.id)}
                          aria-pressed={selecionadosIds.has(b.id)}
                          aria-label={verseAria(b)}
                          onClick={() => selectVerse(b.id)}
                        >
```

E no modo blocos:

```tsx
                  <button
                    key={b.id}
                    type="button"
                    className={verseClass('verse', b.id)}
                    aria-pressed={selecionadosIds.has(b.id)}
                    aria-label={verseAria(b)}
                    onClick={() => selectVerse(b.id)}
                  >
```

- [ ] **Step 8: Renderizar a barra**

Acrescentar imediatamente antes do `</article>` de fechamento:

```tsx
      {barOpen && selecionados.length > 0 && (
        <VerseActions
          label={rangeLabel(p, selecionados)}
          temDestaque={selecionados.some((v) => destaques.has(v.id))}
          aviso={aviso}
          onCopiar={() => void copiarSelecao()}
          onCompartilhar={() => void compartilharSelecao()}
          onDestacar={(cor) => void destacarSelecao(cor)}
          onRemoverDestaque={() => void removerDestaqueSelecao()}
          onAnotar={anotarSelecao}
          onFechar={fecharBarra}
        />
      )}
```

- [ ] **Step 9: Tokens `--hl-*` nas quatro paletas**

Em `src/styles/app.css`, acrescentar as quatro linhas correspondentes ao fim de cada bloco de paleta, antes de `color-scheme`:

Em `:root, [data-theme='light']`:

```css
  --hl-amarelo: #f7e9a8;
  --hl-verde: #cfe9c8;
  --hl-azul: #cadff2;
  --hl-rosa: #f4d0dd;
```

Em `[data-theme='dark']` **e** no bloco `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']):not([data-theme='sepia']) { ... } }` (os dois recebem os mesmos valores):

```css
  --hl-amarelo: #5a4c1c;
  --hl-verde: #24452c;
  --hl-azul: #1f3c58;
  --hl-rosa: #4e2437;
```

Em `[data-theme='sepia']` (criado na Task 6):

```css
  --hl-amarelo: #efdda0;
  --hl-verde: #cfdcb4;
  --hl-azul: #c7d6e0;
  --hl-rosa: #ecc9cf;
```

- [ ] **Step 10: Classes de destaque, swatches e a barra no CSS**

Acrescentar em `src/styles/app.css` logo depois da regra `.verse-inline.verse-focus { ... }`:

```css
/* Destaque de cor é o FUNDO do versículo; o foco de seleção continua sendo o
   anel/borda — por isso estas regras vêm DEPOIS de .verse-focus e repetem a
   especificidade composta do modo corrido, senão o foco comeria a cor. */
.verse.verse-hl-amarelo,
.verse-inline.verse-hl-amarelo {
  background: var(--hl-amarelo);
}

.verse.verse-hl-verde,
.verse-inline.verse-hl-verde {
  background: var(--hl-verde);
}

.verse.verse-hl-azul,
.verse-inline.verse-hl-azul {
  background: var(--hl-azul);
}

.verse.verse-hl-rosa,
.verse-inline.verse-hl-rosa {
  background: var(--hl-rosa);
}

/* anel mais forte que o fundo, para o foco continuar visível sobre a cor */
.verse-inline.verse-focus {
  box-shadow: 0 0 0 3px var(--focus-line);
}

.verse-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  display: grid;
  gap: 0.5rem;
  padding: 0.7rem max(var(--shell-pad, 1.1rem), env(safe-area-inset-right, 0px))
    calc(0.7rem + env(safe-area-inset-bottom, 0px))
    max(var(--shell-pad, 1.1rem), env(safe-area-inset-left, 0px));
  background: var(--paper);
  border-top: 1px solid var(--line);
  box-shadow: 0 -8px 24px rgb(0 0 0 / 0.14);
  font-family: var(--font-ui);
}

.verse-actions-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.verse-actions-ref {
  color: var(--accent);
}

.verse-actions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.verse-actions-aviso {
  margin: 0;
  min-height: 1.1rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.hl-swatch {
  width: 2.25rem;
  height: 2.25rem;
  min-height: 2.25rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
}

.hl-amarelo {
  background: var(--hl-amarelo);
}

.hl-verde {
  background: var(--hl-verde);
}

.hl-azul {
  background: var(--hl-azul);
}

.hl-rosa {
  background: var(--hl-rosa);
}

/* a barra é fixa: abre espaço embaixo para o último versículo não sumir */
.shell:has(.verse-actions) .main {
  padding-bottom: 9rem;
}
```

- [ ] **Step 11: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — os 95 testes continuam verdes (nenhum teste novo aqui: a lógica pura já foi coberta na Task 5); lint e build sem erro.

- [ ] **Step 12: Verificação visual**

Com `npm run dev`: tocar num versículo seleciona e abre a barra com a referência certa; tocar num segundo versículo estende o intervalo (inclusive cruzando "Capítulo N", exibindo "Gn 1:30–2:2"); tocar num versículo de dentro do intervalo recolhe para ele; tocar no único selecionado fecha a barra; `Escape` fecha; "Copiar" copia `"texto" (Gn 1:3–7, NAA)`; os 4 swatches pintam o fundo e "Remover" some com ele; a cor persiste ao recarregar; nos dois modos (corrido e blocos) a cor aparece e o foco continua visível por cima.

- [ ] **Step 13: Commit**

```bash
git add src/components/VerseActions.tsx src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: seleção de intervalo, barra de ações do versículo e destaques na leitura"
```

---

### Task 8: Anotações — editar, confirmar exclusão, chip de vínculo e ordenação

**Files:**
- Modify: `src/lib/user-db.ts`
- Modify: `src/lib/user-db.test.ts`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `saveAnotacao(pericopeOrdem, texto, id?, verseRef?)` (Task 4); `Anotacao.verseRef` (Task 4); `parseVerseRef`, `verseRefLabel` (Task 5); estado `draftRef` (Task 7).
- Produces: `listAnotacoes(ordem: number): Promise<Anotacao[]>` passa a devolver ordenado por `criadoEm` decrescente; estados `editingId: string | null` e `confirmarId: string | null` em `Leitura.tsx`; classes CSS `.note-ref-chip`, `.note-form-actions`, `.note-item-actions`.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/lib/user-db.test.ts`, acrescentar dentro do `describe('anotações com vínculo a versículo', ...)`:

```ts
  it('listAnotacoes devolve as notas mais recentes primeiro', async () => {
    await applyRemoteAnotacoes([
      {
        id: 'ord-a',
        pericopeOrdem: 9200,
        texto: 'antiga',
        verseRef: null,
        criadoEm: '2026-01-01T00:00:00.000Z',
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
      {
        id: 'ord-b',
        pericopeOrdem: 9200,
        texto: 'nova',
        verseRef: null,
        criadoEm: '2026-06-01T00:00:00.000Z',
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
      {
        id: 'ord-c',
        pericopeOrdem: 9200,
        texto: 'do meio',
        verseRef: null,
        criadoEm: '2026-03-01T00:00:00.000Z',
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
    ])

    expect((await listAnotacoes(9200)).map((n) => n.id)).toEqual(['ord-b', 'ord-c', 'ord-a'])
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "listAnotacoes devolve as notas mais recentes primeiro"`
Expected: FAIL — a ordem vem do índice do IndexedDB, não de `criadoEm`.

- [ ] **Step 3: Ordenar em `listAnotacoes`**

Em `src/lib/user-db.ts`, substituir `listAnotacoes` por:

```ts
export async function listAnotacoes(ordem: number): Promise<Anotacao[]> {
  const notas = await (await db()).getAllFromIndex('anotacoes', 'by-pericope', ordem)
  // Mais recentes primeiro: a última anotação escrita fica no topo da lista.
  return notas.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/user-db.test.ts`
Expected: PASS — o arquivo inteiro verde, com o teste novo incluído.

- [ ] **Step 5: Estados e handlers de anotação em `Leitura.tsx`**

Acrescentar aos imports:

```tsx
import { parseVerseRef, verseRefLabel } from '../lib/verse-range'
```

(juntando aos nomes já importados de `../lib/verse-range` na Task 7: a linha final é
`import { nextSelection, parseVerseRef, rangeLabel, rangeRef, verseRefLabel, versesInRange, type VerseSelection } from '../lib/verse-range'`).

Acrescentar os estados novos depois de `const [aviso, setAviso] = useState('')`:

```tsx
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmarId, setConfirmarId] = useState<string | null>(null)
```

Acrescentar `setEditingId(null)` e `setConfirmarId(null)` dentro de `anotarSelecao`, logo antes de `setDraftRef(...)`:

```tsx
  function anotarSelecao() {
    setTab('anotacoes')
    setEditingId(null)
    setConfirmarId(null)
    setDraftRef(rangeRef(selecionados))
    setBarOpen(false)
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('.note-form textarea')
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus()
    }, 0)
  }
```

Substituir `onSaveNote` por (e acrescentar os três handlers novos logo em seguida):

```tsx
  async function onSaveNote(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    await saveAnotacao(ordem, draft.trim(), editingId ?? undefined, draftRef)
    setDraft('')
    setDraftRef(null)
    setEditingId(null)
    await refreshNotes()
  }

  function editarNota(n: Anotacao) {
    setEditingId(n.id)
    setDraft(n.texto)
    setDraftRef(n.verseRef ?? null)
    setConfirmarId(null)
    setTab('anotacoes')
  }

  function cancelarEdicao() {
    setEditingId(null)
    setDraft('')
    setDraftRef(null)
  }

  async function apagarNota(id: string) {
    await deleteAnotacao(id)
    setConfirmarId(null)
    if (editingId === id) cancelarEdicao()
    await refreshNotes()
  }
```

- [ ] **Step 6: Formulário e lista de anotações**

Substituir o bloco `{tab === 'anotacoes' && ( ... )}` inteiro por:

```tsx
        {tab === 'anotacoes' && (
          <>
            <form onSubmit={onSaveNote} className="note-form">
              {draftRef && (
                <p className="note-ref-row">
                  <span className="note-ref-chip">{verseRefLabel(p.abbrev, draftRef)}</span>
                  <button type="button" className="linkish" onClick={() => setDraftRef(null)}>
                    Remover vínculo
                  </button>
                </p>
              )}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder="Escreva pensamentos, orações, aplicações…"
              />
              <div className="note-form-actions">
                <button type="submit">{editingId ? 'Salvar alterações' : 'Salvar anotação'}</button>
                {editingId && (
                  <button type="button" className="linkish" onClick={cancelarEdicao}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
            <ul className="note-list">
              {notes.map((n) => (
                <li key={n.id}>
                  {n.verseRef && (
                    <Link
                      className="note-ref-chip"
                      to={`/leitura/${ordem}?v=${parseVerseRef(n.verseRef)?.start ?? ''}`}
                    >
                      {verseRefLabel(p.abbrev, n.verseRef)}
                    </Link>
                  )}
                  <p>{n.texto}</p>
                  <div className="note-item-actions">
                    {confirmarId === n.id ? (
                      <>
                        <span className="muted">Apagar mesmo?</span>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => void apagarNota(n.id)}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => setConfirmarId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="linkish" onClick={() => editarNota(n)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => setConfirmarId(n.id)}
                        >
                          Apagar
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
```

- [ ] **Step 7: CSS do chip e das ações da nota**

Acrescentar em `src/styles/app.css` logo depois da regra `.note-list li { ... }`:

```css
.note-ref-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
}

.note-ref-chip {
  display: inline-flex;
  align-items: center;
  align-self: start;
  font-family: var(--font-ui);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  margin-bottom: 0.35rem;
  min-height: 1.9rem;
}

.note-form-actions,
.note-item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
  font-family: var(--font-ui);
  font-size: 0.9rem;
}
```

- [ ] **Step 8: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 95 antigos + 1 novo = 96 testes; lint e build sem erro.

- [ ] **Step 9: Verificação visual**

Com `npm run dev`: "Anotar" na barra rola até o campo com o chip do intervalo; salvar cria a nota com o chip; tocar no chip da nota navega para `/leitura/<ordem>?v=<primeiro verso>` e rola até ele; "Editar" carrega o texto no campo (botão vira "Salvar alterações", com "Cancelar" ao lado); "Apagar" pede "Apagar mesmo? Sim / Cancelar" no próprio item, sem diálogo do browser; a lista mostra as mais novas em cima.

- [ ] **Step 10: Commit**

```bash
git add src/lib/user-db.ts src/lib/user-db.test.ts src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: anotações com edição, confirmação inline, chip de vínculo e ordenação"
```

---

### Task 9: Espaçamento de linha e largura de medida no "Aa"

**Files:**
- Modify: `src/lib/reading-prefs.ts`
- Modify: `src/lib/reading-prefs.test.ts`
- Modify: `src/components/ReadingMenu.tsx`
- Modify: `src/styles/app.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `ReadingPrefs`, `applyReadingPrefs`, `getReadingPrefs` existentes; props `{ prefs, onPrefs }` do `ReadingMenu`.
- Produces:
  - `type ReadingMeasure = 'estreita' | 'media' | 'larga'`
  - `ReadingPrefs` ganha `leadingStep: number` e `measure: ReadingMeasure`
  - `export const LEADING_STEPS = [1.5, 1.65, 1.8, 1.95] as const`
  - `export const MEASURE_OPTIONS: { id: ReadingMeasure; label: string; width: string }[]`
  - `setReadingLeadingStep(step: number): ReadingPrefs`, `bumpReadingLeading(delta: number): ReadingPrefs`, `setReadingMeasure(m: ReadingMeasure): ReadingPrefs`
  - variáveis CSS `--read-leading` (número sem unidade) e `--read-measure` (comprimento).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/reading-prefs.test.ts`, acrescentar ao import:

```ts
import {
  bumpReadingLeading,
  getReadingPrefs,
  LEADING_STEPS,
  setReadingLayout,
  setReadingMeasure,
} from './reading-prefs'
```

E acrescentar no fim do arquivo:

```ts
describe('reading-prefs espaçamento e medida', () => {
  beforeEach(() => localStorage.clear())

  it('padrões são leadingStep 1 e medida média', () => {
    expect(getReadingPrefs()).toMatchObject({ leadingStep: 1, measure: 'media' })
  })

  it('prefs antigas sem os campos novos recebem os padrões', () => {
    localStorage.setItem('pericopes-reading', JSON.stringify({ sizeStep: 3, font: 'sans' }))
    expect(getReadingPrefs()).toMatchObject({
      sizeStep: 3,
      font: 'sans',
      layout: 'corrido',
      leadingStep: 1,
      measure: 'media',
    })
  })

  it('bumpReadingLeading anda nos passos e trava nas pontas', () => {
    expect(bumpReadingLeading(1).leadingStep).toBe(2)
    expect(bumpReadingLeading(-1).leadingStep).toBe(1)
    expect(bumpReadingLeading(-5).leadingStep).toBe(0)
    expect(bumpReadingLeading(99).leadingStep).toBe(LEADING_STEPS.length - 1)
  })

  it('setReadingMeasure persiste, aplica as variáveis CSS e valor inválido volta ao padrão', () => {
    setReadingMeasure('larga')
    expect(getReadingPrefs().measure).toBe('larga')
    expect(document.documentElement.style.getPropertyValue('--read-measure')).toBe('46rem')
    expect(document.documentElement.style.getPropertyValue('--read-leading')).toBe('1.65')

    localStorage.setItem('pericopes-reading', JSON.stringify({ measure: 'gigante', leadingStep: 9 }))
    expect(getReadingPrefs()).toMatchObject({ measure: 'media', leadingStep: 1 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/reading-prefs.test.ts`
Expected: FAIL — `LEADING_STEPS`, `bumpReadingLeading` e `setReadingMeasure` não existem.

- [ ] **Step 3: Campos, constantes e setters em `src/lib/reading-prefs.ts`**

Substituir o bloco de tipos e constantes do topo por:

```ts
const KEY = 'pericopes-reading'

export type ReadingFont = 'serif' | 'literata' | 'sans'

export type ReadingLayout = 'corrido' | 'blocos'

export type ReadingMeasure = 'estreita' | 'media' | 'larga'

export type ReadingPrefs = {
  sizeStep: number
  font: ReadingFont
  layout: ReadingLayout
  leadingStep: number
  measure: ReadingMeasure
}

/** rem steps for biblical + prose text */
export const SIZE_STEPS = [0.95, 1.05, 1.15, 1.28, 1.42, 1.58] as const

/** entrelinha da prosa de leitura; ESPELHADO no script inline do index.html */
export const LEADING_STEPS = [1.5, 1.65, 1.8, 1.95] as const

/** largura de medida do conteúdo de leitura; ESPELHADO no index.html */
export const MEASURE_OPTIONS: { id: ReadingMeasure; label: string; width: string }[] = [
  { id: 'estreita', label: 'Estreita', width: '32rem' },
  { id: 'media', label: 'Média', width: '38rem' },
  { id: 'larga', label: 'Larga', width: '46rem' },
]

export const FONT_OPTIONS: { id: ReadingFont; label: string; stack: string }[] = [
  { id: 'serif', label: 'Serif', stack: "'Source Serif 4 Variable', Georgia, serif" },
  { id: 'literata', label: 'Literata', stack: "'Literata Variable', Georgia, serif" },
  { id: 'sans', label: 'Sans', stack: "'Source Sans 3 Variable', 'DM Sans Variable', system-ui, sans-serif" },
]

const DEFAULTS: ReadingPrefs = {
  sizeStep: 2,
  font: 'serif',
  layout: 'corrido',
  leadingStep: 1,
  measure: 'media',
}
```

Substituir `getReadingPrefs` e `applyReadingPrefs` por:

```ts
export function getReadingPrefs(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>
    const sizeStep =
      typeof parsed.sizeStep === 'number' && parsed.sizeStep >= 0 && parsed.sizeStep < SIZE_STEPS.length
        ? parsed.sizeStep
        : DEFAULTS.sizeStep
    const font = FONT_OPTIONS.some((f) => f.id === parsed.font) ? (parsed.font as ReadingFont) : DEFAULTS.font
    const layout: ReadingLayout = parsed.layout === 'blocos' ? 'blocos' : 'corrido'
    // Prefs gravadas antes deste pacote não têm os campos novos: caem no padrão.
    const leadingStep =
      typeof parsed.leadingStep === 'number' &&
      parsed.leadingStep >= 0 &&
      parsed.leadingStep < LEADING_STEPS.length
        ? parsed.leadingStep
        : DEFAULTS.leadingStep
    const measure = MEASURE_OPTIONS.some((m) => m.id === parsed.measure)
      ? (parsed.measure as ReadingMeasure)
      : DEFAULTS.measure
    return { sizeStep, font, layout, leadingStep, measure }
  } catch {
    return { ...DEFAULTS }
  }
}

export function applyReadingPrefs(prefs: ReadingPrefs) {
  const root = document.documentElement
  root.style.setProperty('--read-size', `${SIZE_STEPS[prefs.sizeStep]}rem`)
  const stack = FONT_OPTIONS.find((f) => f.id === prefs.font)?.stack ?? FONT_OPTIONS[0].stack
  root.style.setProperty('--read-font', stack)
  root.style.setProperty('--read-leading', String(LEADING_STEPS[prefs.leadingStep]))
  const width = MEASURE_OPTIONS.find((m) => m.id === prefs.measure)?.width ?? MEASURE_OPTIONS[1].width
  root.style.setProperty('--read-measure', width)
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
}
```

Acrescentar no fim do arquivo:

```ts
export function setReadingLeadingStep(step: number): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.leadingStep = Math.max(0, Math.min(LEADING_STEPS.length - 1, step))
  applyReadingPrefs(prefs)
  return prefs
}

export function bumpReadingLeading(delta: number): ReadingPrefs {
  return setReadingLeadingStep(getReadingPrefs().leadingStep + delta)
}

export function setReadingMeasure(measure: ReadingMeasure): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.measure = measure
  applyReadingPrefs(prefs)
  return prefs
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/reading-prefs.test.ts`
Expected: PASS — 3 antigos + 4 novos = 7 neste arquivo.

- [ ] **Step 5: Linhas "Espaçamento" e "Largura" no `ReadingMenu`**

Em `src/components/ReadingMenu.tsx`, substituir o import de `../lib/reading-prefs` por:

```tsx
import {
  bumpReadingLeading,
  bumpReadingSize,
  FONT_OPTIONS,
  LEADING_STEPS,
  MEASURE_OPTIONS,
  setReadingFont,
  setReadingLayout,
  setReadingMeasure,
  SIZE_STEPS,
  type ReadingLayout,
  type ReadingPrefs,
} from '../lib/reading-prefs'
```

Acrescentar as duas linhas novas dentro do popover, logo depois do bloco `role="group" aria-label="Modo do texto bíblico"`:

```tsx
          <div className="readmenu-row" role="group" aria-label="Espaçamento entre linhas">
            <button
              type="button"
              className="read-tool"
              disabled={prefs.leadingStep === 0}
              aria-label="Diminuir espaçamento"
              onClick={() => onPrefs(bumpReadingLeading(-1))}
            >
              ▼
            </button>
            <button
              type="button"
              className="read-tool"
              disabled={prefs.leadingStep === LEADING_STEPS.length - 1}
              aria-label="Aumentar espaçamento"
              onClick={() => onPrefs(bumpReadingLeading(1))}
            >
              ▲
            </button>
          </div>
          <div className="readmenu-row" role="group" aria-label="Largura do texto">
            {MEASURE_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`read-tool${prefs.measure === m.id ? ' active' : ''}`}
                aria-pressed={prefs.measure === m.id}
                onClick={() => onPrefs(setReadingMeasure(m.id))}
              >
                {m.label}
              </button>
            ))}
          </div>
```

- [ ] **Step 6: CSS consome `--read-leading` e `--read-measure`**

Em `src/styles/app.css`, trocar as linhas indicadas:

- `.leitura` → `max-width: var(--read-measure, var(--measure));`
- `.texto-biblico` → `line-height: var(--read-leading, 1.65);`
- `.corrido` → `line-height: var(--read-leading, 1.65);` e `max-width: var(--read-measure, var(--measure));`
- `.prose` → `line-height: var(--read-leading, 1.65);` e `max-width: var(--read-measure, var(--measure));`
- `.perguntas` → `line-height: var(--read-leading, 1.65);`

(as demais páginas continuam com `--measure` fixo — só a leitura usa a medida ajustável).

- [ ] **Step 7: Espelhar no script inline do `index.html`**

Substituir o bloco `<script>` do `<head>` por:

```html
    <script>
      (function () {
        try {
          var t = localStorage.getItem('pericopes-theme')
          if (t !== 'light' && t !== 'dark' && t !== 'sepia') {
            t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          }
          document.documentElement.dataset.theme = t
          var raw = localStorage.getItem('pericopes-reading')
          var prefs = raw ? JSON.parse(raw) : {}
          // DUPLICAÇÃO DELIBERADA de src/lib/reading-prefs.ts: este script roda
          // antes de qualquer bundle. Mudou lá, mude aqui.
          var steps = [0.95, 1.05, 1.15, 1.28, 1.42, 1.58]
          var step = typeof prefs.sizeStep === 'number' && prefs.sizeStep >= 0 && prefs.sizeStep < steps.length ? prefs.sizeStep : 2
          var fonts = {
            serif: "'Source Serif 4 Variable', Georgia, serif",
            literata: "'Literata Variable', Georgia, serif",
            sans: "'Source Sans 3 Variable', 'DM Sans Variable', system-ui, sans-serif",
          }
          var font = fonts[prefs.font] || fonts.serif
          var leadings = [1.5, 1.65, 1.8, 1.95]
          var lstep = typeof prefs.leadingStep === 'number' && prefs.leadingStep >= 0 && prefs.leadingStep < leadings.length ? prefs.leadingStep : 1
          var measures = { estreita: '32rem', media: '38rem', larga: '46rem' }
          var measure = measures[prefs.measure] || measures.media
          document.documentElement.style.setProperty('--read-size', steps[step] + 'rem')
          document.documentElement.style.setProperty('--read-font', font)
          document.documentElement.style.setProperty('--read-leading', String(leadings[lstep]))
          document.documentElement.style.setProperty('--read-measure', measure)
        } catch (e) {}
      })()
    </script>
```

- [ ] **Step 8: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 96 antigos + 4 novos = 100 testes; lint e build sem erro.

- [ ] **Step 9: Verificação visual**

Com `npm run dev`: no "Aa", ▲/▼ mudam a entrelinha do texto NAA **e** de contexto/resenha/reflexão; os 3 botões de largura mudam a medida só da página de leitura (índice e pesquisa continuam iguais); recarregar mantém a escolha sem flash de layout; com o localStorage bloqueado a leitura ainda abre nos padrões.

- [ ] **Step 10: Commit**

```bash
git add src/lib/reading-prefs.ts src/lib/reading-prefs.test.ts src/components/ReadingMenu.tsx src/styles/app.css index.html
git commit -m "feat: espaçamento de linha e largura de medida nas preferências de leitura"
```

---

### Task 10: Débitos técnicos (§7 do spec)

**Files:**
- Modify: `src/lib/sync.ts`
- Modify: `src/lib/sync.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/components/ReadingMenu.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `signOutLocal(): Promise<void>` (`src/lib/sync.ts`); `useHideOnScroll` e a classe `.top-hidden`; refs `rootRef`/`btnRef` já existentes no `ReadingMenu`.
- Produces: `signOutLocal` passa a **rejeitar** quando `authClient.signOut()` falha, preservando outbox e cursor; classe CSS `.sr-only`.

- [ ] **Step 1: Escrever o teste que falha (débito 1)**

Em `src/lib/sync.test.ts`, acrescentar ao `describe('troca de conta e logout', ...)`:

```ts
  it('signOutLocal: se o signOut falhar, o outbox e o cursor ficam intactos', async () => {
    await resetLocal()
    await setProgresso(60002, 'concluido')
    await setMeta('sync-cursor', '2026-01-01T00:00:00.000Z')
    vi.mocked(authClient.signOut).mockRejectedValue(new Error('offline') as never)

    await expect(signOutLocal()).rejects.toThrow('offline')

    // nada de dado local jogado fora por um logout que nem aconteceu
    expect((await listOutbox()).some((i) => i.kind === 'progresso' && i.ordem === 60002)).toBe(true)
    expect(await getMeta('sync-cursor')).toBe('2026-01-01T00:00:00.000Z')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/sync.test.ts -t "signOutLocal: se o signOut falhar"`
Expected: FAIL — o outbox já foi esvaziado antes da tentativa de sign-out.

- [ ] **Step 3: Débito 1 — ordem em `signOutLocal`**

Em `src/lib/sync.ts`, substituir a função e seu comentário por:

```ts
/**
 * Logout que não deixa rastro sincronizável do usuário anterior. O sign-out vem
 * PRIMEIRO de propósito: se ele falhar (rede fora), o outbox e o cursor ficam
 * intactos e o usuário continua logado — limpar antes destruía escritas ainda
 * não sincronizadas de uma sessão que seguia viva. A marca `sync-user`
 * permanece: é ela que dispara o wipe se outra conta entrar aqui.
 */
export async function signOutLocal(): Promise<void> {
  await authClient.signOut()
  await clearOutboxAll()
  await deleteMeta(CURSOR_KEY)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/sync.test.ts`
Expected: PASS — os testes antigos de logout continuam verdes e o novo passa.

- [ ] **Step 5: Débito 2 — botão "Sair" com estado e feedback**

Em `src/App.tsx`, acrescentar os estados dentro de `Shell` (depois de `const headerHidden = ...`):

```tsx
  const [saindo, setSaindo] = useState(false)
  const [erroSaida, setErroSaida] = useState('')

  async function sair() {
    if (saindo) return
    setSaindo(true)
    setErroSaida('')
    try {
      await signOutLocal()
    } catch {
      // nunca deixar virar rejeição não tratada: o usuário precisa saber
      setErroSaida('Não foi possível sair. Tente de novo.')
    } finally {
      setSaindo(false)
    }
  }
```

E substituir o bloco do botão por:

```tsx
          {session ? (
            <>
              <button
                type="button"
                className="linkish nav-conta"
                onClick={() => void sair()}
                disabled={saindo}
                title={erroSaida || session.user.email}
              >
                {saindo ? 'Saindo…' : 'Sair'}
              </button>
              <span className="sr-only" role="status" aria-live="polite">
                {erroSaida}
              </span>
            </>
          ) : (
            <NavLink to="/entrar">Entrar</NavLink>
          )}
```

- [ ] **Step 6: Débito 3 — `aria-label` no pager inferior**

Em `src/pages/Leitura.tsx`, no `<nav className="pager">`, acrescentar os rótulos aos dois links:

```tsx
        <nav className="pager" aria-label="Navegação entre perícopes">
          {prev ? (
            <Link
              className="ghost pager-link"
              aria-label={`Anterior: ${prev.titulo}`}
              to={`/leitura/${prev.ordem}`}
            >
              ← {prev.titulo}
            </Link>
          ) : (
            <span aria-hidden />
          )}
          {next ? (
            <Link
              className="ghost pager-link pager-next"
              aria-label={`Próxima: ${next.titulo}`}
              to={`/leitura/${next.ordem}`}
            >
              {next.titulo} →
            </Link>
          ) : (
            <span aria-hidden />
          )}
        </nav>
```

- [ ] **Step 7: Débito 4 — `aria-modal` e focus trap no `ReadingMenu`**

Em `src/components/ReadingMenu.tsx`, acrescentar a ref do popover junto das outras:

```tsx
  const popRef = useRef<HTMLDivElement>(null)
```

Substituir o efeito de `open` inteiro por:

```tsx
  useEffect(() => {
    if (!open) return
    const pop = popRef.current
    pop?.querySelector<HTMLElement>('button:not([disabled])')?.focus()

    function fechar() {
      setOpen(false)
      // foco volta ao gatilho também quando o fechamento vem de toque fora
      btnRef.current?.focus()
    }
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) fechar()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        fechar()
        return
      }
      if (e.key !== 'Tab' || !pop) return
      const focaveis = [...pop.querySelectorAll<HTMLElement>('button:not([disabled])')]
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement
      if (e.shiftKey && (ativo === primeiro || !pop.contains(ativo))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
```

E na abertura do popover, acrescentar a ref e o `aria-modal`:

```tsx
        <div
          className="readmenu-pop"
          ref={popRef}
          role="dialog"
          aria-modal="true"
          aria-label="Preferências de leitura"
        >
```

- [ ] **Step 8: Débitos 5 e 6 e `.sr-only` no CSS**

Em `src/styles/app.css`, substituir a regra `.top-hidden` por:

```css
.top-hidden {
  transform: translateY(-100%);
  /* visibility sai do fluxo de foco/leitores, mas só no fim do transform,
     senão o header some antes de terminar de deslizar */
  visibility: hidden;
  transition: transform 0.25s ease, visibility 0s 0.25s;
}
```

No bloco de `prefers-reduced-motion`, acrescentar a segunda regra:

```css
@media (prefers-reduced-motion: reduce) {
  .top {
    transition: none;
  }

  .top-hidden {
    transition: none;
  }
}
```

Na regra `.top`, trocar as duas linhas de padding lateral (mesma proteção de safe-area que o `.shell` já faz):

```css
  padding-right: calc(50vw - 50% + max(var(--shell-pad), env(safe-area-inset-right, 0px)));
  padding-left: calc(50vw - 50% + max(var(--shell-pad), env(safe-area-inset-left, 0px)));
```

E acrescentar no fim do arquivo:

```css
/* visível só para leitores de tela: usado no aviso de erro do "Sair" */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 9: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 100 antigos + 1 novo = 101 testes; lint, typecheck e build sem erro.

- [ ] **Step 10: Verificação manual**

Com `npm run dev`: no header, "Sair" fica desabilitado exibindo "Saindo…" enquanto pendente e mostra o aviso no `title` se falhar; rolando na leitura o header some e **não** é mais alcançável por Tab; no "Aa" aberto, Tab circula só dentro do popover e tocar fora devolve o foco ao botão "Aa"; os links do pager inferior anunciam "Anterior: <título>"/"Próxima: <título>"; em landscape num aparelho com notch, o conteúdo do header não encosta na borda insegura.

- [ ] **Step 11: Commit**

```bash
git add src/lib/sync.ts src/lib/sync.test.ts src/App.tsx src/pages/Leitura.tsx src/components/ReadingMenu.tsx src/styles/app.css
git commit -m "fix: débitos do pacote 2 (signOut, botão Sair, pager, focus trap, header oculto, safe-area)"
```

---

## Checklist manual de fim de pacote (iPhone)

Rodar depois da Task 10, no aparelho, com duas sessões da mesma conta:

- [ ] Tocar num versículo abre a barra com a referência certa; `Escape`/"Fechar"/tocar de novo fecham.
- [ ] Selecionar intervalo cruzando capítulo mostra "Gn 1:30–2:2" e copia os textos concatenados.
- [ ] Destacar, trocar de cor e remover funcionam nos dois modos (corrido e blocos).
- [ ] Destaque criado num aparelho aparece no outro depois do sync (background/foreground).
- [ ] Anotar pela barra grava o vínculo; o chip navega para o versículo.
- [ ] Editar e apagar (com confirmação inline) funcionam; a lista fica em ordem decrescente.
- [ ] Sépia e "Sistema" aplicam corretamente, inclusive com o SO em dark.
- [ ] Espaçamento e largura persistem em modo avião e não piscam ao recarregar.
