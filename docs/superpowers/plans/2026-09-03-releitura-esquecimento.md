# Releitura e Esquecimento — Implementation Plan (fatias 0–2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder desmarcar uma perícope, zerar em massa (livro / testamento / tudo), marcar para reler, e ser lembrado do que foi lido há mais de um ano — sem que nada disso reescreva o passado.

**Architecture:** `progresso` continua uma linha por perícope e ganha `historico: string[]` (conclusões, mais nova primeiro, teto 50) e `paraReler: boolean`. `concluidoEm` e `vezes` não são campos: derivam de `historico[0]` e `historico.length`. A linha passa a ter duas políticas de merge — LWW por `atualizadoEm` no estado (`status`, `paraReler`), união de conjuntos no `historico`, fora da guarda do LWW. O predicado que jornadas consome sai primeiro, sobre o modelo atual, e depois troca de corpo numa linha.

**Tech Stack:** TypeScript, React 19 + react-router, Vite, Vitest (+ `fake-indexeddb`), `idb` sobre IndexedDB, Cloudflare Workers + Hono + D1 (SQLite com JSON1).

**Spec:** `docs/superpowers/specs/2026-09-03-releitura-esquecimento-design.md`

**Fora deste plano:** a fatia 3 (`dias_leitura`, streak por atividade). É subsistema independente, cria a quinta/sexta entidade sincronizada e sobe o `paginarPull` mais uma lista genérica — o arquivo mais sutil do repo. Plano próprio, depois, e coordenado com a sessão de jornadas.

## Global Constraints

- **Português** em identificadores de domínio, comentários e texto de interface, seguindo o repo (`setProgresso`, `atualizadoEm`, `apagadoEm`).
- **`atualizadoEm` continua sendo a chave do LWW.** Nada neste plano muda isso.
- **`historico` nunca é apagado.** Desmarcar e zerar tocam em `status` e `paraReler`, e só.
- **Teto de 50** conclusões por perícope: `MAX_HISTORICO = 50`, em `src/lib/sync-limits.ts` e espelhado em `worker/sync-logic.ts` (o Worker não pode importar de `src/` — tsconfig e bundle separados; a cópia é deliberada e vem com comentário, como `MAX_ITENS`/`MAX_TEXTO` já fazem).
- **Migration `0010`.** A `0009` está reservada para a sessão de jornadas, que commitou primeiro.
- **Timestamps em ISO canônico** (`ISO_CANONICAL` no Worker: `YYYY-MM-DDTHH:mm:ss.sssZ`). Comparação de datas é lexicográfica sobre essa string, como `remoteWinsLocal` e `getPosicaoMaisRecente` já fazem. Nenhuma segunda noção de tempo entra no repo.
- **Compatibilidade com cliente velho:** um service worker em cache empurra sem `historico`/`paraReler`. O Worker aceita os campos ausentes, como já faz com `destaques`/`posicoes`.
- Rodar `npm test` (vitest) e `npm run typecheck:worker` antes de cada commit que toca no Worker.

---

### Task 1: O seam `contaComoLida` (fatia 0, sobre o modelo atual)

Sai primeiro e sozinho: desbloqueia a sessão de jornadas sem migration nenhuma, sem mudar tipo nenhum. Depois da Task 4 o corpo troca numa linha e nenhum chamador percebe.

**Files:**
- Create: `src/lib/conclusao.ts`
- Create: `src/lib/conclusao.test.ts`

**Interfaces:**
- Consumes: `Progresso` de `src/lib/types.ts`; `getProgresso`, `listAllProgresso` de `src/lib/user-db.ts`.
- Produces:
  - `contaComoLida(p: Progresso | undefined, desde: string | null): boolean`
  - `concluidaDesde(ordem: number, desde: string | null): Promise<boolean>`
  - `concluidasDesde(ordens: number[], desde: string | null): Promise<Set<number>>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/conclusao.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { concluidaDesde, concluidasDesde, contaComoLida } from './conclusao'
import { setProgresso } from './user-db'
import type { Progresso } from './types'

function linha(ordem: number, status: Progresso['status'], quando: string): Progresso {
  return { pericopeOrdem: ordem, status, atualizadoEm: quando }
}

const JAN = '2026-01-10T12:00:00.000Z'
const AGO = '2026-08-02T12:00:00.000Z'

describe('contaComoLida', () => {
  it('desde null: qualquer conclusão conta, de qualquer época', () => {
    expect(contaComoLida(linha(1, 'concluido', JAN), null)).toBe(true)
  })

  it('exige status concluido, não só a data', () => {
    // Desmarcar tira da jornada: é o que a palavra promete e é o único jeito
    // de desfazer um engano.
    expect(contaComoLida(linha(1, 'em_andamento', AGO), null)).toBe(false)
    expect(contaComoLida(linha(1, 'nao_iniciado', AGO), null)).toBe(false)
  })

  it('linha ausente nunca conta', () => {
    expect(contaComoLida(undefined, null)).toBe(false)
  })

  it('o limite é inclusivo: conclusão exatamente em `desde` conta', () => {
    expect(contaComoLida(linha(1, 'concluido', AGO), AGO)).toBe(true)
  })

  it('conclusão anterior a `desde` não conta', () => {
    expect(contaComoLida(linha(1, 'concluido', JAN), AGO)).toBe(false)
  })
})

describe('concluidaDesde / concluidasDesde', () => {
  it('concluidaDesde lê a linha gravada', async () => {
    await setProgresso(9200, 'concluido')
    expect(await concluidaDesde(9200, null)).toBe(true)
    expect(await concluidaDesde(9201, null)).toBe(false)
  })

  it('concluidasDesde devolve só as ordens pedidas que passam no predicado', async () => {
    await setProgresso(9210, 'concluido')
    await setProgresso(9211, 'em_andamento')
    await setProgresso(9212, 'concluido')
    const r = await concluidasDesde([9210, 9211, 9212, 9213], null)
    expect([...r].sort()).toEqual([9210, 9212])
    // O Set serve às duas coisas que a jornada precisa e não podem divergir:
    // .size alimenta a barra, .has() alimenta o cursor.
    expect(r.size).toBe(2)
    expect(r.has(9211)).toBe(false)
  })

  it('concluidasDesde faz UMA leitura, não N: lista vazia devolve Set vazio', async () => {
    expect((await concluidasDesde([], null)).size).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/conclusao.test.ts`
Expected: FAIL — `Failed to resolve import "./conclusao"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/conclusao.ts`:

```ts
import type { Progresso } from './types'
import { getProgresso, listAllProgresso } from './user-db'

/**
 * O predicado, um só: "existe uma conclusão desta perícope com timestamp
 * >= `desde`" (`desde` null = qualquer conclusão conta).
 *
 * É o SEAM entre este modelo e a feature de jornadas, que consome só isto e
 * nunca toca no formato de armazenamento de `progresso`. Quando a linha ganhar
 * `historico`, é o corpo desta função que muda — e só ele.
 *
 * Exige `status === 'concluido'` além da data: desmarcar significa "não consta
 * mais como lida", e a jornada regride junto. Quem quer revisitar sem regredir
 * usa "marcar para reler".
 *
 * Comparação lexicográfica de ISO, a mesma convenção de `remoteWinsLocal`
 * (sync-merge.ts) e `getPosicaoMaisRecente` (user-db.ts).
 */
export function contaComoLida(p: Progresso | undefined, desde: string | null): boolean {
  if (!p || p.status !== 'concluido') return false
  return desde === null || p.atualizadoEm >= desde
}

export async function concluidaDesde(ordem: number, desde: string | null): Promise<boolean> {
  return contaComoLida(await getProgresso(ordem), desde)
}

/**
 * Versão em lote. Uma jornada da Bíblia inteira são 2.647 ordens: faz UMA
 * leitura do store e filtra em memória, nunca N consultas.
 *
 * Devolve Set e não contagem porque quem chama precisa das duas coisas —
 * `.size` para a barra, `.has(ordem)` para o cursor — e elas não podem
 * divergir.
 */
export async function concluidasDesde(
  ordens: number[],
  desde: string | null,
): Promise<Set<number>> {
  const alvo = new Set(ordens)
  const out = new Set<number>()
  if (alvo.size === 0) return out
  for (const p of await listAllProgresso()) {
    if (alvo.has(p.pericopeOrdem) && contaComoLida(p, desde)) out.add(p.pericopeOrdem)
  }
  return out
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/lib/conclusao.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/conclusao.ts src/lib/conclusao.test.ts
git commit -m "feat: contaComoLida, o seam de conclusão que jornadas consome

Predicado \"existe uma conclusão de \`o\` com timestamp >= desde\", sobre o
modelo atual e sem migration. Sai primeiro para a sessão de jornadas poder
começar; quando progresso ganhar historico, muda só o corpo desta função."
```

---

### Task 2: `Progresso` ganha `historico` e `paraReler` (local)

Só o tipo, o upgrade do IndexedDB e a preservação nas escritas existentes. Ainda ninguém popula `historico` — é a Task 3.

**Files:**
- Modify: `src/lib/types.ts` (o type `Progresso`)
- Modify: `src/lib/sync-limits.ts`
- Modify: `src/lib/user-db.ts` (`DB_VERSION`, `upgrade`, `setProgresso`, `OutboxItem`)
- Test: `src/lib/user-db.test.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `Progresso` com `historico: string[]` e `paraReler: boolean`
  - `MAX_HISTORICO = 50` exportado de `src/lib/sync-limits.ts`
  - `setProgresso(ordem, status)` preserva `historico` e `paraReler` da linha existente
  - `OutboxItem` do kind `'progresso'` ganha `historico?: string[]` e `paraReler?: boolean`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `src/lib/user-db.test.ts` (e adicionar `MAX_HISTORICO` ao import de `./sync-limits`):

```ts
describe('progresso: historico e paraReler', () => {
  it('linha nova nasce com historico vazio e paraReler false', async () => {
    await setProgresso(9300, 'em_andamento')
    const p = await getProgresso(9300)
    expect(p?.historico).toEqual([])
    expect(p?.paraReler).toBe(false)
  })

  it('setProgresso PRESERVA historico e paraReler da linha existente', async () => {
    // É a garantia central do modelo: mudar de status nunca apaga o fato.
    await setProgresso(9301, 'concluido')
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', {
      ...(await getProgresso(9301))!,
      historico: ['2026-01-10T12:00:00.000Z'],
      paraReler: true,
    })
    d.close()

    await setProgresso(9301, 'nao_iniciado')
    const p = await getProgresso(9301)
    expect(p?.status).toBe('nao_iniciado')
    expect(p?.historico).toEqual(['2026-01-10T12:00:00.000Z'])
    expect(p?.paraReler).toBe(true)
  })

  it('MAX_HISTORICO é 50', () => {
    expect(MAX_HISTORICO).toBe(50)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "historico e paraReler"`
Expected: FAIL — `MAX_HISTORICO` não exportado e `p.historico` é `undefined`.

- [ ] **Step 3: Implementar o tipo e o limite**

Em `src/lib/types.ts`, substituir o type `Progresso`:

```ts
export type Progresso = {
  pericopeOrdem: number
  status: ProgressoStatus
  /**
   * Conclusões desta perícope, em ISO canônico, MAIS NOVA PRIMEIRO, no máximo
   * MAX_HISTORICO. Nunca esvaziado: desmarcar e zerar mexem em `status` e
   * `paraReler`, o fato de ter sido lida fica.
   *
   * `concluidoEm` e `vezes` não são campos — são `historico[0]` e
   * `historico.length`.
   */
  historico: string[]
  /** Pin manual "quero revisitar", independente do status. */
  paraReler: boolean
  /** Chave do LWW. */
  atualizadoEm: string
}
```

Em `src/lib/sync-limits.ts`, acrescentar:

```ts
/**
 * Máximo de conclusões guardadas por perícope. Da 51ª releitura em diante a
 * mais antiga cai — mantém a linha limitada e o corpo do push previsível.
 * worker/sync-logic.ts tem a cópia deste valor (ver o aviso no topo do arquivo).
 */
export const MAX_HISTORICO = 50
```

- [ ] **Step 4: Implementar o upgrade e a preservação**

Em `src/lib/user-db.ts`:

1. **Bump da versão.** `DB_VERSION` no repo hoje é `4`; a sessão de jornadas pega a próxima com o store `jornadas`. **Incremente em exatamente 1 o valor que estiver no arquivo no momento da execução** e use esse mesmo número no guard abaixo. Se `DB_VERSION` estiver `4`, vira `5` e o guard é `oldVersion < 5`; se jornadas já tiver subido para `5`, vira `6` e o guard é `oldVersion < 6`. Os blocos `if (oldVersion < N)` compõem em qualquer ordem de merge.

2. Acrescentar o bloco de upgrade ao final da função `upgrade(database, oldVersion)`, usando `transaction` (o terceiro parâmetro do callback do `idb` — adicione-o à assinatura: `upgrade(database, oldVersion, _newVersion, transaction)`):

```ts
// Backfill OBRIGATÓRIO, não otimização: `remoteWinsLocal` é `>` estrito, então
// o pull nunca reescreve uma linha local cujo atualizadoEm empata com o do
// servidor — sem isto os campos ficariam `undefined` para sempre em quem já
// usa o app.
if (oldVersion < DB_VERSION) {
  const store = transaction.objectStore('progresso')
  for (const linha of await store.getAll()) {
    if (linha.historico !== undefined) continue
    await store.put({
      ...linha,
      // Linha já concluída teve ao menos uma conclusão; a única data que existe
      // hoje é o atualizadoEm.
      historico: linha.status === 'concluido' ? [linha.atualizadoEm] : [],
      paraReler: false,
    })
  }
}
```

3. Substituir `setProgresso` para preservar os campos novos:

```ts
export async function setProgresso(ordem: number, status: ProgressoStatus): Promise<void> {
  const atualizadoEm = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['progresso', 'outbox'], 'readwrite')
  const store = tx.objectStore('progresso')
  const anterior = await store.get(ordem)
  // Mudar de status NUNCA apaga o histórico nem o pin: quem os escreve são
  // concluirProgresso, desmarcarProgresso, zerarProgresso e setParaReler.
  const linha: Progresso = {
    pericopeOrdem: ordem,
    status,
    historico: anterior?.historico ?? [],
    paraReler: anterior?.paraReler ?? false,
    atualizadoEm,
  }
  await store.put(linha)
  await tx.objectStore('outbox').put({
    kind: 'progresso',
    ordem,
    status,
    historico: linha.historico,
    paraReler: linha.paraReler,
    atualizadoEm,
  } as OutboxItem)
  await tx.done
}
```

4. No type `OutboxItem`, trocar a variante `'progresso'` por:

```ts
  | {
      seq?: number
      kind: 'progresso'
      ordem: number
      status: ProgressoStatus
      atualizadoEm: string
      /** Opcionais: itens enfileirados por uma versão anterior do app não os
       *  têm, e `toPush` (sync.ts) os trata como `[]` / `false`. */
      historico?: string[]
      paraReler?: boolean
    }
```

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run src/lib/user-db.test.ts`
Expected: PASS, incluindo os 3 novos e todos os antigos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/sync-limits.ts src/lib/user-db.ts src/lib/user-db.test.ts
git commit -m "feat: progresso ganha historico e paraReler (local)

Backfill no upgrade do IndexedDB, obrigatorio porque remoteWinsLocal e '>'
estrito e o pull nunca reescreve linha de timestamp igual. setProgresso passa
a preservar os dois campos: mudar de status nunca apaga o fato."
```

---

### Task 3: `concluirProgresso` — o histórico passa a ser escrito

**Files:**
- Modify: `src/lib/user-db.ts` (`concluirProgresso`, `applyRemoteProgresso`)
- Modify: `src/lib/sync.ts` (`toPush`, type `PushProgresso`)
- Modify: `src/pages/Leitura.tsx` (`markDone`, ~linha 628)
- Test: `src/lib/user-db.test.ts`

**Interfaces:**
- Consumes: `Progresso` com `historico`/`paraReler` (Task 2); `MAX_HISTORICO`.
- Produces: `concluirProgresso(ordem: number): Promise<void>`; `applyRemoteProgresso` com merge híbrido.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `src/lib/user-db.test.ts` (e `concluirProgresso` ao import de `./user-db`):

```ts
describe('concluirProgresso', () => {
  it('anexa uma data ao histórico e marca concluido', async () => {
    await concluirProgresso(9310)
    const p = await getProgresso(9310)
    expect(p?.status).toBe('concluido')
    expect(p?.historico).toHaveLength(1)
    expect(p?.historico[0]).toBe(p?.atualizadoEm)
  })

  it('reler acrescenta uma SEGUNDA data, mais nova primeiro', async () => {
    await concluirProgresso(9311)
    const primeira = (await getProgresso(9311))!.historico[0]
    await new Promise((r) => setTimeout(r, 2))
    await concluirProgresso(9311)
    const p = await getProgresso(9311)
    expect(p?.historico).toHaveLength(2)
    expect(p?.historico[1]).toBe(primeira)
    expect(p!.historico[0] > p!.historico[1]).toBe(true)
  })

  it('concluir limpa o pin de releitura: a releitura aconteceu', async () => {
    await setProgresso(9312, 'em_andamento')
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9312))!, paraReler: true })
    d.close()
    await concluirProgresso(9312)
    expect((await getProgresso(9312))?.paraReler).toBe(false)
  })

  it('respeita MAX_HISTORICO, descartando a mais antiga', async () => {
    const cheio = Array.from({ length: MAX_HISTORICO }, (_, i) =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    ).reverse()
    await setProgresso(9313, 'em_andamento')
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9313))!, historico: cheio })
    d.close()

    await concluirProgresso(9313)
    const p = await getProgresso(9313)
    expect(p?.historico).toHaveLength(MAX_HISTORICO)
    expect(p?.historico).not.toContain('2020-01-01T00:00:00.000Z')
  })
})

describe('applyRemoteProgresso: merge híbrido', () => {
  it('une os históricos mesmo quando o LWW local vence', async () => {
    // Aparelho A concluiu offline em T2; B desmarcou em T3 > T2 e sincronizou
    // primeiro. O status de B vence, e a conclusão de A NÃO pode se perder.
    await setProgresso(9320, 'nao_iniciado')
    const local = await getProgresso(9320)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...local!, historico: ['2026-08-03T00:00:00.000Z'] })
    d.close()

    await applyRemoteProgresso([
      {
        pericopeOrdem: 9320,
        status: 'concluido',
        historico: ['2026-08-01T00:00:00.000Z'],
        paraReler: false,
        atualizadoEm: PAST,
      },
    ])
    const p = await getProgresso(9320)
    expect(p?.status).toBe('nao_iniciado') // LWW local venceu
    expect(p?.historico).toEqual(['2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z'])
  })

  it('conta como aplicada quando SÓ a união mudou', async () => {
    await setProgresso(9321, 'concluido')
    const n = await applyRemoteProgresso([
      {
        pericopeOrdem: 9321,
        status: 'concluido',
        historico: ['2019-01-01T00:00:00.000Z'],
        paraReler: false,
        atualizadoEm: PAST,
      },
    ])
    // Sem isto o live refresh perderia uma releitura vinda de outro aparelho.
    expect(n).toBe(1)
    expect((await getProgresso(9321))?.historico).toContain('2019-01-01T00:00:00.000Z')
  })

  it('tolera payload sem os campos novos (servidor/cliente antigo)', async () => {
    await setProgresso(9322, 'nao_iniciado')
    await applyRemoteProgresso([
      { pericopeOrdem: 9322, status: 'concluido', atualizadoEm: FUTURE },
    ])
    const p = await getProgresso(9322)
    expect(p?.status).toBe('concluido')
    expect(Array.isArray(p?.historico)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "concluirProgresso"`
Expected: FAIL — `concluirProgresso is not a function`.

- [ ] **Step 3: Implementar em `user-db.ts`**

```ts
/** Une dois históricos: conjunto, mais nova primeiro, cortado em MAX_HISTORICO. */
function unirHistorico(a: readonly string[] = [], b: readonly string[] = []): string[] {
  return [...new Set([...a, ...b])].sort((x, y) => (x < y ? 1 : x > y ? -1 : 0)).slice(0, MAX_HISTORICO)
}

/**
 * Conclui a perícope: anexa a data ao histórico, marca `concluido` e limpa o
 * pin de releitura (a releitura aconteceu).
 *
 * Substitui `setProgresso(ordem, 'concluido')` como o gesto de concluir — é o
 * único lugar que faz o histórico crescer.
 */
export async function concluirProgresso(ordem: number): Promise<void> {
  const atualizadoEm = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['progresso', 'outbox'], 'readwrite')
  const store = tx.objectStore('progresso')
  const anterior = await store.get(ordem)
  const linha: Progresso = {
    pericopeOrdem: ordem,
    status: 'concluido',
    historico: unirHistorico([atualizadoEm], anterior?.historico),
    paraReler: false,
    atualizadoEm,
  }
  await store.put(linha)
  await tx.objectStore('outbox').put({
    kind: 'progresso',
    ordem,
    status: linha.status,
    historico: linha.historico,
    paraReler: linha.paraReler,
    atualizadoEm,
  } as OutboxItem)
  await tx.done
}
```

Substituir `applyRemoteProgresso` inteira:

```ts
/**
 * Aplica o progresso vindo do pull. Duas políticas na mesma linha, de propósito:
 * `status` e `paraReler` seguem o LWW por `atualizadoEm`; `historico` é união
 * de conjuntos e roda FORA da guarda do LWW — senão um lote que perdeu o LWW
 * levaria junto uma conclusão feita offline, que nunca mais voltaria.
 *
 * A contagem alimenta o live refresh (sync-event.ts): "veio no payload" não é
 * "mudou aqui", e uma união que cresceu conta tanto quanto um status novo.
 */
export async function applyRemoteProgresso(
  items: {
    pericopeOrdem: number
    status: ProgressoStatus
    historico?: string[]
    paraReler?: boolean
    atualizadoEm: string
  }[],
): Promise<number> {
  const d = await db()
  let aplicadas = 0
  for (const item of items) {
    const local = await d.get('progresso', item.pericopeOrdem)
    const remotoVence = remoteWinsLocal(item.atualizadoEm, local?.atualizadoEm)
    const historico = unirHistorico(item.historico, local?.historico)
    const uniaoMudou = historico.length !== (local?.historico?.length ?? -1)
    if (!remotoVence && !uniaoMudou) continue
    await d.put('progresso', {
      pericopeOrdem: item.pericopeOrdem,
      status: remotoVence ? item.status : (local?.status ?? item.status),
      historico,
      paraReler: remotoVence ? (item.paraReler ?? false) : (local?.paraReler ?? false),
      atualizadoEm:
        remotoVence || !local ? item.atualizadoEm : local.atualizadoEm,
    })
    aplicadas++
  }
  return aplicadas
}
```

- [ ] **Step 4: Levar os campos no push**

Em `src/lib/sync.ts`, no type `PushProgresso` acrescentar `historico: string[]` e `paraReler: boolean`, e em `toPush` trocar o ramo do progresso:

```ts
    if (item.kind === 'progresso') {
      progresso.set(item.ordem, {
        pericopeOrdem: item.ordem,
        status: item.status,
        // Item enfileirado por uma versão anterior do app não tem os campos.
        // `[]` é neutro na união do servidor e `false` é seguro: `paraReler`
        // não existia quando aquele item foi gravado.
        historico: item.historico ?? [],
        paraReler: item.paraReler ?? false,
        atualizadoEm: item.atualizadoEm,
      })
    } else if (item.kind === 'anotacao') {
```

- [ ] **Step 5: Trocar `markDone` na Leitura**

Em `src/pages/Leitura.tsx`, no import de `../lib/user-db` trocar `setProgresso` por `concluirProgresso, setProgresso` (as duas: a linha 287 continua usando `setProgresso` para `em_andamento`), e em `markDone` trocar a primeira linha:

```ts
  async function markDone() {
    await concluirProgresso(ordem)
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test`
Expected: PASS, suíte inteira.

- [ ] **Step 7: Commit**

```bash
git add src/lib/user-db.ts src/lib/user-db.test.ts src/lib/sync.ts src/pages/Leitura.tsx
git commit -m "feat: concluir escreve o historico; merge hibrido no pull

concluirProgresso anexa a data, limpa o pin e respeita MAX_HISTORICO.
applyRemoteProgresso passa a ter duas politicas: LWW no estado, uniao de
conjuntos no historico FORA da guarda — um lote que perde o LWW nao pode
levar junto uma conclusao feita offline."
```

---

### Task 4: streak e seam passam a ler o histórico

É o que blinda o streak: depois desta task, desmarcar e zerar não conseguem mais apagar um dia de leitura.

**Files:**
- Modify: `src/lib/streak.ts`
- Modify: `src/lib/conclusao.ts`
- Modify: `src/pages/Home.tsx`
- Test: `src/lib/streak.test.ts`, `src/lib/conclusao.test.ts`

**Interfaces:**
- Consumes: `Progresso.historico` (Task 2).
- Produces: `diasComConclusao` lendo `historico`; `streakAtual(): Promise<Streak>` — o seam recíproco prometido à sessão de jornadas, para a Home nova não saber de onde vem o streak.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/streak.test.ts`, trocar o helper `concluida` e acrescentar dois testes:

```ts
function concluida(ordem: number, quando: string): Progresso {
  return {
    pericopeOrdem: ordem,
    status: 'concluido',
    historico: [quando],
    paraReler: false,
    atualizadoEm: quando,
  }
}

// ... dentro de describe('diasComConclusao', ...):

  it('conta TODAS as datas do histórico, não só a última', () => {
    const dias = diasComConclusao([
      {
        pericopeOrdem: 1,
        status: 'concluido',
        historico: [iso(2026, 8, 30), iso(2026, 3, 2)],
        paraReler: false,
        atualizadoEm: iso(2026, 8, 30),
      },
    ])
    expect([...dias].sort()).toEqual(['2026-03-02', '2026-08-30'])
  })

  it('desmarcar NÃO apaga o dia: o histórico sobrevive ao status', () => {
    // A garantia que sustenta "zerar não zera o seu recorde".
    const dias = diasComConclusao([
      {
        pericopeOrdem: 1,
        status: 'nao_iniciado',
        historico: [iso(2026, 8, 30)],
        paraReler: false,
        atualizadoEm: iso(2026, 9, 3),
      },
    ])
    expect([...dias]).toEqual(['2026-08-30'])
  })
```

Nos testes existentes de `diasComConclusao` que passam linhas cruas com `status: 'em_andamento'` / `'nao_iniciado'` e SEM histórico, acrescentar `historico: [], paraReler: false` — eles continuam devendo produzir conjunto vazio, agora porque o histórico é que está vazio.

Em `src/lib/conclusao.test.ts`, trocar o helper e acrescentar um teste:

```ts
function linha(ordem: number, status: Progresso['status'], quando: string): Progresso {
  return {
    pericopeOrdem: ordem,
    status,
    historico: status === 'concluido' ? [quando] : [],
    paraReler: false,
    atualizadoEm: quando,
  }
}

  it('lê a data do histórico, não do atualizadoEm', () => {
    // Desmarcar e remarcar mexem no atualizadoEm; a jornada tem que enxergar
    // a data da CONCLUSÃO.
    const p: Progresso = {
      pericopeOrdem: 1,
      status: 'concluido',
      historico: [JAN],
      paraReler: false,
      atualizadoEm: '2026-09-03T12:00:00.000Z',
    }
    expect(contaComoLida(p, AGO)).toBe(false)
    expect(contaComoLida(p, JAN)).toBe(true)
  })
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/streak.test.ts src/lib/conclusao.test.ts`
Expected: FAIL — `diasComConclusao` ainda filtra por status e lê `atualizadoEm`.

- [ ] **Step 3: Implementar**

Em `src/lib/streak.ts`, substituir `diasComConclusao` e acrescentar `streakAtual`:

```ts
/**
 * Dias (locais) em que alguma perícope foi concluída, lidos do HISTÓRICO — não
 * do `atualizadoEm` nem do `status`.
 *
 * É isso que faz o streak sobreviver a desmarcar e a "zerar tudo": o histórico
 * nunca é apagado, então os dias em que se leu continuam existindo mesmo depois
 * de o ✓ sumir do Índice. O hábito não é o progresso.
 */
export function diasComConclusao(progressos: Progresso[]): Set<string> {
  const dias = new Set<string>()
  for (const p of progressos) {
    for (const quando of p.historico ?? []) {
      const data = new Date(quando)
      // Data inválida (registro corrompido, string vazia) não vira dia nenhum.
      if (Number.isNaN(data.getTime())) continue
      dias.add(diaLocal(data))
    }
  }
  return dias
}
```

E, ao fim do arquivo:

```ts
/**
 * O streak de hoje, sem que quem chama saiba de onde ele sai. É o seam
 * recíproco de `contaComoLida`: a fatia 3 troca a fonte por uma entidade de
 * dias de leitura, e a Home não muda uma linha.
 */
export async function streakAtual(): Promise<Streak> {
  const { listAllProgresso } = await import('./user-db')
  return computeStreak(diasComConclusao(await listAllProgresso()), new Date())
}
```

Em `src/lib/conclusao.ts`, trocar o corpo do predicado (a única linha que muda):

```ts
export function contaComoLida(p: Progresso | undefined, desde: string | null): boolean {
  if (!p || p.status !== 'concluido') return false
  // historico[0] é a conclusão mais nova, logo o máximo: "existe conclusão
  // >= desde" é exatamente `historico[0] >= desde`, e continua O(1).
  const ultima = p.historico[0]
  if (ultima === undefined) return false
  return desde === null || ultima >= desde
}
```

Em `src/pages/Home.tsx`, trocar a linha do streak por `setStreak(await streakAtual())`, ajustando os imports (`streakAtual` de `../lib/streak`; remover `computeStreak`/`diasComConclusao` e `listAllProgresso` se ficarem sem uso).

- [ ] **Step 4: Rodar tudo**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak.ts src/lib/streak.test.ts src/lib/conclusao.ts src/lib/conclusao.test.ts src/pages/Home.tsx
git commit -m "feat: streak e predicado passam a ler o historico

diasComConclusao le todas as datas do historico e ignora o status, entao
desmarcar e zerar deixam de apagar dias do streak. contaComoLida troca
atualizadoEm por historico[0] — uma linha, nenhum chamador percebe.
streakAtual() e o seam reciproco prometido a sessao de jornadas."
```

---

### Task 5: Servidor — migration 0010, validação e upsert com união

**Files:**
- Create: `migrations/0010_progresso_historico.sql`
- Modify: `worker/sync-logic.ts` (`PushProgresso`, `validProgresso`, `MAX_HISTORICO`)
- Modify: `worker/index.ts` (`SELECT_PROGRESSO`, upsert, hidratação da resposta)
- Test: `worker/sync-logic.test.ts`

**Interfaces:**
- Consumes: o formato do push produzido em `sync.ts` (Task 3).
- Produces: `/api/sync` aceitando e devolvendo `historico`/`paraReler`, com união server-side.

- [ ] **Step 1: Escrever o teste que falha**

Em `worker/sync-logic.test.ts`, acrescentar:

```ts
describe('validProgresso: historico e paraReler', () => {
  const base = { pericopeOrdem: 1, status: 'concluido', atualizadoEm: '2026-08-31T10:00:00.000Z' }

  it('aceita o corpo ANTIGO, sem os campos novos', () => {
    // Um service worker em cache continua sincronizando.
    expect(parseSyncPush({ progresso: [base] })?.progresso).toHaveLength(1)
  })

  it('aceita historico e paraReler válidos', () => {
    const r = parseSyncPush({
      progresso: [{ ...base, historico: ['2026-08-31T10:00:00.000Z'], paraReler: true }],
    })
    expect(r?.progresso[0].historico).toEqual(['2026-08-31T10:00:00.000Z'])
    expect(r?.progresso[0].paraReler).toBe(true)
  })

  it('rejeita data não canônica no histórico', () => {
    expect(parseSyncPush({ progresso: [{ ...base, historico: ['2026-08-31'] }] })).toBeNull()
  })

  it('rejeita histórico acima do teto', () => {
    const grande = Array.from({ length: 51 }, (_, i) =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    )
    expect(parseSyncPush({ progresso: [{ ...base, historico: grande }] })).toBeNull()
  })

  it('rejeita histórico que não é array e paraReler que não é boolean', () => {
    expect(parseSyncPush({ progresso: [{ ...base, historico: 'x' }] })).toBeNull()
    expect(parseSyncPush({ progresso: [{ ...base, paraReler: 1 }] })).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run worker/sync-logic.test.ts -t "historico e paraReler"`
Expected: FAIL — campos extras hoje passam sem validação; o teste do teto e o da data não canônica retornam objeto em vez de `null`.

- [ ] **Step 3: Escrever a migration**

Criar `migrations/0010_progresso_historico.sql`:

```sql
-- Histórico de conclusões por perícope, dentro da própria linha de progresso.
-- Duas colunas aditivas (padrão da 0005): nenhuma linha existente quebra.
--
-- `historico` é um json_array de ISO canônico, MAIS NOVA PRIMEIRO, no máximo
-- 50. `concluido_em` e `vezes` não existem como colunas: são json_extract($[0])
-- e json_array_length(). O merge é UNIÃO DE CONJUNTOS e roda fora da guarda do
-- LWW (ver o ON CONFLICT em worker/index.ts) — um lote que perde o LWW não pode
-- levar junto uma conclusão feita offline.
ALTER TABLE "progresso" ADD COLUMN "historico"  TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE "progresso" ADD COLUMN "para_reler" INTEGER NOT NULL DEFAULT 0;

-- Backfill: linha já concluída teve ao menos uma conclusão, e a única data que
-- existe hoje é atualizado_em (mesmo espírito do backfill da 0003).
UPDATE "progresso" SET "historico" = json_array("atualizado_em") WHERE "status" = 'concluido';
```

- [ ] **Step 4: Implementar a validação**

Em `worker/sync-logic.ts`: acrescentar ao bloco de constantes copiadas (junto de `MAX_ITENS`/`MAX_TEXTO`, sob o mesmo comentário de "cópia deliberada"):

```ts
// Cópia de MAX_HISTORICO em src/lib/sync-limits.ts.
const MAX_HISTORICO = 50
```

No type `PushProgresso`, acrescentar `historico: string[]` e `paraReler: boolean`. Substituir `validProgresso`:

```ts
function validProgresso(v: unknown): v is Omit<PushProgresso, 'historico' | 'paraReler'> & {
  historico?: unknown
  paraReler?: unknown
} {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    isOrdem(p.pericopeOrdem) &&
    typeof p.status === 'string' &&
    STATUS.has(p.status) &&
    isIso(p.atualizadoEm) &&
    // Ausentes = cliente ainda não atualizado, aceito (mesma tolerância que
    // `destaques`/`posicoes` já têm em parseSyncPush).
    (p.historico === undefined ||
      (Array.isArray(p.historico) && p.historico.length <= MAX_HISTORICO && p.historico.every(isIso))) &&
    (p.paraReler === undefined || typeof p.paraReler === 'boolean')
  )
}
```

E em `parseSyncPush`, normalizar o progresso na volta (como já se faz com `verseRef`):

```ts
  return {
    progresso: progresso.map((p) => ({
      ...p,
      historico: Array.isArray(p.historico) ? (p.historico as string[]) : [],
      paraReler: p.paraReler === true,
    })),
    anotacoes: anotacoes.map((a) => ({
```

- [ ] **Step 5: Rodar os testes do worker**

Run: `npx vitest run worker/sync-logic.test.ts && npm run typecheck:worker`
Expected: PASS nos dois.

- [ ] **Step 6: Implementar o upsert e o SELECT**

Em `worker/index.ts`, trocar `SELECT_PROGRESSO`:

```ts
const SELECT_PROGRESSO = `SELECT pericope_ordem AS pericopeOrdem, status, historico,
          para_reler AS paraReler, atualizado_em AS atualizadoEm, server_em AS serverEm
   FROM progresso WHERE user_id = ?1`
```

Acrescentar o hidratador ao lado de `despirServerEm`:

```ts
/**
 * D1 devolve `historico` como TEXT e `para_reler` como 0/1. O cliente espera
 * `string[]` e `boolean` — a conversão é aqui, não lá, para o formato do
 * protocolo ser o mesmo do tipo `Progresso`.
 */
function hidratarProgresso<T extends { historico: unknown; paraReler: unknown }>(linha: T) {
  let historico: string[] = []
  try {
    const bruto: unknown = JSON.parse(String(linha.historico ?? '[]'))
    if (Array.isArray(bruto)) historico = bruto.filter((d): d is string => typeof d === 'string')
  } catch {
    // Linha corrompida vira histórico vazio em vez de derrubar o pull inteiro.
  }
  return { ...linha, historico, paraReler: Boolean(linha.paraReler) }
}
```

Na montagem da resposta (linha ~191), trocar por:

```ts
    progresso: progresso.map((l) => despirServerEm(hidratarProgresso(l))),
```

E substituir o upsert do progresso:

```ts
    ...parsed.progresso.map((p) =>
      c.env.DB.prepare(
        `INSERT INTO progresso (user_id, pericope_ordem, status, historico, para_reler, atualizado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(user_id, pericope_ordem) DO UPDATE SET
           status     = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                             THEN excluded.status     ELSE progresso.status     END,
           para_reler = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                             THEN excluded.para_reler ELSE progresso.para_reler END,
           atualizado_em = MAX(excluded.atualizado_em, progresso.atualizado_em),
           historico = (SELECT json_group_array(d) FROM (
                          SELECT value AS d FROM json_each(excluded.historico)
                          UNION
                          SELECT value AS d FROM json_each(progresso.historico)
                          ORDER BY d DESC LIMIT ${MAX_HISTORICO})),
           server_em = excluded.server_em
         WHERE excluded.atualizado_em > progresso.atualizado_em
            OR EXISTS (SELECT 1 FROM json_each(excluded.historico)
                       WHERE value NOT IN (SELECT value FROM json_each(progresso.historico)))`,
      ).bind(
        userId,
        p.pericopeOrdem,
        p.status,
        JSON.stringify(p.historico),
        p.paraReler ? 1 : 0,
        p.atualizadoEm,
        serverEm,
      ),
    ),
```

Importar `MAX_HISTORICO` de `./sync-logic` (exportá-lo lá). O `EXISTS` no `WHERE` é deliberado e não pode virar um `<>` de string: um cliente velho empurra `historico` vazio, e um `<>` faria `server_em` avançar à toa — cada push viraria linha re-entregue no pull seguinte, para sempre.

- [ ] **Step 7: Aplicar a migration local e provar a união com dois "aparelhos"**

```bash
npx wrangler d1 migrations apply biblia-pericopes --local
```

Cobre os critérios de aceite 6 e 7 da spec (dois aparelhos offline na mesma perícope) direto contra o SQL, que é onde a união mora. Salve como `/tmp/uniao.sql` e rode com `npx wrangler d1 execute biblia-pericopes --local --file=/tmp/uniao.sql`:

```sql
-- Aparelho A conclui em 01/ago (atualizado_em antigo).
INSERT INTO progresso (user_id, pericope_ordem, status, historico, para_reler, atualizado_em, server_em)
VALUES ('u-teste', 99999, 'concluido', json_array('2026-08-01T00:00:00.000Z'), 0,
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');

-- Aparelho B desmarcou DEPOIS (03/ago) e chega com o histórico dele: o status
-- de B tem que vencer o LWW, e a conclusão de A NÃO pode se perder.
INSERT INTO progresso (user_id, pericope_ordem, status, historico, para_reler, atualizado_em, server_em)
VALUES ('u-teste', 99999, 'nao_iniciado', json_array('2026-08-03T00:00:00.000Z'), 0,
        '2026-08-03T00:00:00.000Z', '2026-08-03T00:00:00.000Z')
ON CONFLICT(user_id, pericope_ordem) DO UPDATE SET
  status     = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                    THEN excluded.status     ELSE progresso.status     END,
  para_reler = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                    THEN excluded.para_reler ELSE progresso.para_reler END,
  atualizado_em = MAX(excluded.atualizado_em, progresso.atualizado_em),
  historico = (SELECT json_group_array(d) FROM (
                 SELECT value AS d FROM json_each(excluded.historico)
                 UNION
                 SELECT value AS d FROM json_each(progresso.historico)
                 ORDER BY d DESC LIMIT 50)),
  server_em = excluded.server_em
WHERE excluded.atualizado_em > progresso.atualizado_em
   OR EXISTS (SELECT 1 FROM json_each(excluded.historico)
              WHERE value NOT IN (SELECT value FROM json_each(progresso.historico)));

SELECT status, historico, json_array_length(historico) AS vezes FROM progresso
WHERE user_id = 'u-teste' AND pericope_ordem = 99999;

DELETE FROM progresso WHERE user_id = 'u-teste';
```

Expected: `status = 'nao_iniciado'` (LWW de B venceu) e `vezes = 2`, com as duas datas — mais nova primeiro. Se `vezes` vier 1, a união está dentro da guarda do LWW e o modelo perdeu uma conclusão: pare e conserte antes de seguir.

- [ ] **Step 8: Rodar tudo**

Run: `npm test && npm run typecheck:worker`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add migrations/0010_progresso_historico.sql worker/sync-logic.ts worker/sync-logic.test.ts worker/index.ts
git commit -m "feat: servidor guarda o historico de conclusoes (migration 0010)

Duas colunas aditivas; historico e json_array de ISO, mais nova primeiro,
teto 50. O merge e uniao de conjuntos e roda fora da guarda do LWW, com
EXISTS no WHERE para um cliente velho nao bombar server_em a toa.
validProgresso aceita os campos ausentes."
```

---

### Task 6: Desmarcar uma perícope

**Files:**
- Modify: `src/lib/user-db.ts` (`desmarcarProgresso`)
- Modify: `src/pages/Leitura.tsx` (bloco `.actions`, ~linha 1114)
- Modify: `src/styles/app.css`
- Test: `src/lib/user-db.test.ts`

**Interfaces:**
- Consumes: `setProgresso` preservando campos (Task 2).
- Produces: `desmarcarProgresso(ordem: number): Promise<void>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
describe('desmarcarProgresso', () => {
  it('volta a nao_iniciado preservando o histórico', async () => {
    await concluirProgresso(9330)
    const antes = (await getProgresso(9330))!.historico
    await desmarcarProgresso(9330)
    const p = await getProgresso(9330)
    expect(p?.status).toBe('nao_iniciado')
    expect(p?.historico).toEqual(antes)
  })

  it('limpa o pin de releitura', async () => {
    await concluirProgresso(9331)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9331))!, paraReler: true })
    d.close()
    await desmarcarProgresso(9331)
    expect((await getProgresso(9331))?.paraReler).toBe(false)
  })

  it('enfileira no outbox', async () => {
    await concluirProgresso(9332)
    await desmarcarProgresso(9332)
    const item = (await listOutbox())
      .filter((i) => i.kind === 'progresso' && i.ordem === 9332)
      .at(-1)
    expect(item && item.kind === 'progresso' && item.status).toBe('nao_iniciado')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "desmarcarProgresso"`
Expected: FAIL — `desmarcarProgresso is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/user-db.ts`:

```ts
/**
 * Desmarca a perícope: volta a `nao_iniciado` e limpa o pin. O histórico fica —
 * a leitura aconteceu, e é ele que sustenta o streak.
 *
 * Consequência deliberada: `contaComoLida` exige `status === 'concluido'`,
 * então a jornada ativa regride junto. Desmarcar é desfazer, não revisitar;
 * quem quer revisitar sem regredir usa `setParaReler`.
 */
export async function desmarcarProgresso(ordem: number): Promise<void> {
  const atualizadoEm = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['progresso', 'outbox'], 'readwrite')
  const store = tx.objectStore('progresso')
  const anterior = await store.get(ordem)
  const linha: Progresso = {
    pericopeOrdem: ordem,
    status: 'nao_iniciado',
    historico: anterior?.historico ?? [],
    paraReler: false,
    atualizadoEm,
  }
  await store.put(linha)
  await tx.objectStore('outbox').put({
    kind: 'progresso',
    ordem,
    status: linha.status,
    historico: linha.historico,
    paraReler: false,
    atualizadoEm,
  } as OutboxItem)
  await tx.done
}
```

- [ ] **Step 4: Ligar na Leitura**

Em `src/pages/Leitura.tsx`: importar `desmarcarProgresso`, e acrescentar ao lado de `markDone`:

```ts
  async function desmarcar() {
    await desmarcarProgresso(ordem)
    doneRef.current = false
    setStatus('em_andamento')
  }
```

No bloco `.actions`, envolver os dois ramos de "concluída" para o link aparecer sob o cartão sem competir com ele:

```tsx
        <div className="actions">
          {status !== 'concluido' ? (
            <button type="button" className="cta" onClick={markDone}>
              Marcar como concluída
            </button>
          ) : (
            <>
              {next ? (
                <Link className="done-card" to={`/leitura/${next.ordem}`}>
                  <span className="badge">Concluída ✓</span>
                  <span className="done-next">
                    Próxima: <strong>{next.titulo}</strong> →
                  </span>
                </Link>
              ) : (
                <p className="badge">Concluída ✓</p>
              )}
              {/* Sem confirmação: é UMA perícope, e remarcar é um toque. O
                  cartão "Próxima →" continua sendo a ação primária. */}
              <button type="button" className="linkish desmarcar" onClick={() => void desmarcar()}>
                Desmarcar como concluída
              </button>
            </>
          )}
        </div>
```

Em `src/styles/app.css`, junto das regras de `.actions`:

```css
.desmarcar {
  display: block;
  margin: 0.75rem auto 0;
  font-size: 0.875rem;
  color: var(--muted);
}
```

- [ ] **Step 5: Rodar e conferir na tela**

Run: `npm test`
Expected: PASS.

Depois, `npm run dev`, abrir uma perícope, concluir, e conferir: o link aparece sob o cartão; ao tocar, o bloco volta a "Marcar como concluída"; recarregar a página mantém desmarcada; o ✓ some do Índice.

- [ ] **Step 6: Commit**

```bash
git add src/lib/user-db.ts src/lib/user-db.test.ts src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: desmarcar uma pericope

Volta a nao_iniciado e limpa o pin; o historico fica. Link discreto sob o
cartao 'Proxima', sem confirmacao — e uma pericope e remarcar e um toque."
```

---

### Task 7: `zerarProgresso` — zerar em massa

**Files:**
- Modify: `src/lib/user-db.ts` (`zerarProgresso`, `contarConcluidas`)
- Test: `src/lib/user-db.test.ts`

**Interfaces:**
- Consumes: `Progresso` (Task 2).
- Produces:
  - `zerarProgresso(ordens: number[]): Promise<number>` — devolve quantas linhas mudou
  - `contarConcluidas(ordens: number[]): Promise<number>` — para a confirmação mostrar a contagem real

- [ ] **Step 1: Escrever o teste que falha**

```ts
describe('zerarProgresso', () => {
  it('zera as concluídas e as em andamento, preservando o histórico', async () => {
    await concluirProgresso(9340)
    await setProgresso(9341, 'em_andamento')
    const hist = (await getProgresso(9340))!.historico
    const n = await zerarProgresso([9340, 9341])
    expect(n).toBe(2)
    expect((await getProgresso(9340))?.status).toBe('nao_iniciado')
    expect((await getProgresso(9340))?.historico).toEqual(hist)
    expect((await getProgresso(9341))?.status).toBe('nao_iniciado')
  })

  it('SÓ escreve o que muda', async () => {
    // Sem o filtro, "zerar tudo" enfileiraria 2646 itens para mudar 32.
    await concluirProgresso(9350)
    await zerarProgresso([9350])
    const antes = (await listOutbox()).length
    const n = await zerarProgresso([9350, 9351, 9352, 9353])
    expect(n).toBe(0)
    expect((await listOutbox()).length).toBe(antes)
  })

  it('apaga a posição das ordens zeradas, com lápide', async () => {
    // Sem isto, zerar o AT e voltar à Home devolve o leitor ao meio de Isaías:
    // Home.tsx prefere o checkpoint mais recente à primeira não-concluída.
    await setProgresso(9360, 'em_andamento')
    await setPosicaoLocal(9360, 'versiculo', '3:16')
    await zerarProgresso([9360])
    expect(await getPosicao(9360)).toBeUndefined()
    const lapide = (await listOutbox()).find(
      (i) => i.kind === 'posicao' && i.posicao.pericopeOrdem === 9360 && i.apagadoEm !== null,
    )
    expect(lapide).toBeDefined()
  })

  it('contarConcluidas conta só as concluídas das ordens pedidas', async () => {
    await concluirProgresso(9370)
    await setProgresso(9371, 'em_andamento')
    expect(await contarConcluidas([9370, 9371, 9372])).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "zerarProgresso"`
Expected: FAIL — `zerarProgresso is not a function`.

- [ ] **Step 3: Implementar**

```ts
/** Quantas das `ordens` estão concluídas. Alimenta a contagem da confirmação. */
export async function contarConcluidas(ordens: number[]): Promise<number> {
  const done = await doneSet()
  return ordens.filter((o) => done.has(o)).length
}

/**
 * Zera o progresso das `ordens` e devolve quantas linhas mudou de fato.
 *
 * Três decisões que não são detalhe:
 *
 * 1. SÓ escreve o que muda. Zerar tudo com 32 lidas escreve 32 linhas, não
 *    2646 — senão o outbox receberia 2646 itens para mudar 32.
 * 2. Apaga a posição das ordens zeradas, COM LÁPIDE. Home.tsx prefere o
 *    checkpoint mais recente à primeira não-concluída: sem isto se zera o
 *    Antigo Testamento e o "Continuar" devolve o leitor ao meio de Isaías em
 *    vez de Gênesis 1. Sem a lápide, o pull ressuscitaria o checkpoint.
 * 3. Limpa `paraReler`: o que não consta como lido não pode estar na fila de
 *    releitura.
 *
 * O `historico` NUNCA é apagado — é o que faz o streak e o recorde
 * sobreviverem a "zerar tudo".
 */
export async function zerarProgresso(ordens: number[]): Promise<number> {
  if (ordens.length === 0) return 0
  const atualizadoEm = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['progresso', 'posicoes', 'outbox'], 'readwrite')
  const progresso = tx.objectStore('progresso')
  const posicoes = tx.objectStore('posicoes')
  const outbox = tx.objectStore('outbox')
  let mudadas = 0

  for (const ordem of ordens) {
    const anterior = await progresso.get(ordem)
    if (!anterior || (anterior.status === 'nao_iniciado' && !anterior.paraReler)) continue
    const linha: Progresso = {
      pericopeOrdem: ordem,
      status: 'nao_iniciado',
      historico: anterior.historico ?? [],
      paraReler: false,
      atualizadoEm,
    }
    await progresso.put(linha)
    await outbox.put({
      kind: 'progresso',
      ordem,
      status: linha.status,
      historico: linha.historico,
      paraReler: false,
      atualizadoEm,
    } as OutboxItem)
    mudadas++

    const posicao = await posicoes.get(ordem)
    if (posicao) {
      await posicoes.delete(ordem)
      await outbox.put({
        kind: 'posicao',
        posicao: { ...posicao, atualizadoEm },
        apagadoEm: atualizadoEm,
      } as OutboxItem)
    }
  }

  await tx.done
  return mudadas
}
```

- [ ] **Step 4: Rodar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-db.ts src/lib/user-db.test.ts
git commit -m "feat: zerarProgresso, zerar em massa preservando o historico

So escreve o que muda; apaga a posicao das ordens zeradas com lapide (senao
o Continuar da Home devolve o leitor ao meio de Isaias); limpa paraReler.
O historico nunca e apagado — streak e recorde sobrevivem a 'zerar tudo'."
```

---

### Task 8: A tela `/ajustes`

**Files:**
- Create: `src/pages/Ajustes.tsx`
- Modify: `src/App.tsx` (rota + ponto de entrada)
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `zerarProgresso`, `contarConcluidas` (Task 7); `loadIndex`, `listLivros`, `ordensDoTestamento` de `src/lib/content.ts`; `testamentLabel` de `src/lib/testament.ts`.
- Produces: rota `/ajustes`.

**Nota de coordenação:** a sessão de jornadas é dona do chrome e decidiu que este é um item **dentro do menu "Perfil"**, nunca item de primeiro nível da nav. O formato do Perfil ainda estava sendo decidido quando este plano foi escrito. Na Step 3, siga o caso que corresponder ao estado do `App.tsx` no momento da execução — a rota e a tela são as mesmas nos dois.

- [ ] **Step 1: Escrever a tela**

Criar `src/pages/Ajustes.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { listLivros, listPericopes, loadIndex, ordensDoTestamento } from '../lib/content'
import { testamentLabel, type Testament } from '../lib/testament'
import { contarConcluidas, zerarProgresso } from '../lib/user-db'
import { useSyncRefresh } from '../lib/use-sync-refresh'

type Alvo = { chave: string; rotulo: string; ordens: number[] }

export default function Ajustes() {
  const [livros, setLivros] = useState<string[]>([])
  const [livro, setLivro] = useState('')
  const [alvos, setAlvos] = useState<Alvo[]>([])
  const [contagens, setContagens] = useState<Map<string, number>>(new Map())
  const [confirmando, setConfirmando] = useState<Alvo | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const todas = await loadIndex()
      const ls = await listLivros()
      setLivros(ls)
      const doLivro = livro ? await listPericopes({ livro }) : []
      const lista: Alvo[] = [
        ...(livro ? [{ chave: `livro:${livro}`, rotulo: livro, ordens: doLivro.map((p) => p.ordem) }] : []),
        ...(['vt', 'nt'] as Testament[]).map((t) => ({
          chave: `t:${t}`,
          rotulo: testamentLabel(t),
          ordens: ordensDoTestamento(todas, t),
        })),
        { chave: 'tudo', rotulo: 'Tudo', ordens: todas.map((p) => p.ordem) },
      ]
      setAlvos(lista)
      const pares = await Promise.all(
        lista.map(async (a) => [a.chave, await contarConcluidas(a.ordens)] as const),
      )
      setContagens(new Map(pares))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    }
  }, [livro])

  useEffect(() => {
    void carregar()
  }, [carregar])
  useSyncRefresh(() => void carregar())

  async function zerar(alvo: Alvo) {
    setConfirmando(null)
    try {
      const n = await zerarProgresso(alvo.ordens)
      setAviso(n === 1 ? '1 leitura zerada.' : `${n} leituras zeradas.`)
      await carregar()
    } catch {
      setAviso('Não foi possível zerar agora.')
    }
  }

  if (erro) return <p className="muted">{erro}</p>

  return (
    <section className="ajustes">
      <h1>Ajustes</h1>
      <h2>Progresso de leitura</h2>
      <p className="lead">
        Zerar tira o ✓ do Índice e faz as barras por livro voltarem a zero. Seu streak e seu
        recorde continuam: os dias em que você leu aconteceram.
      </p>

      <label className="ajustes-livro">
        Escolher um livro
        <select value={livro} onChange={(e) => setLivro(e.target.value)}>
          <option value="">—</option>
          {livros.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <ul className="ajustes-alvos">
        {alvos.map((a) => {
          const n = contagens.get(a.chave) ?? 0
          return (
            <li key={a.chave}>
              <span className="ajustes-rotulo">{a.rotulo}</span>
              <span className="ajustes-contagem">{n === 1 ? '1 lida' : `${n} lidas`}</span>
              <button
                type="button"
                className="ghost"
                disabled={n === 0}
                onClick={() => setConfirmando(a)}
              >
                Zerar
              </button>
            </li>
          )
        })}
      </ul>

      {confirmando && (
        <div className="ajustes-confirma" role="dialog" aria-label="Confirmar zerar progresso">
          <p>
            <strong>
              Zerar {contagens.get(confirmando.chave) ?? 0} leituras de {confirmando.rotulo}?
            </strong>
          </p>
          <p className="muted">
            O ✓ some do Índice e as barras voltam a zero. Seu 🔥 streak e seu recorde continuam.
            Não dá para desfazer.
          </p>
          <div className="ajustes-confirma-acoes">
            <button type="button" className="ghost" onClick={() => setConfirmando(null)}>
              Cancelar
            </button>
            <button type="button" className="cta" onClick={() => void zerar(confirmando)}>
              Zerar
            </button>
          </div>
        </div>
      )}

      <p className="ajustes-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Registrar a rota**

Em `src/App.tsx`, importar `Ajustes` e acrescentar dentro de `<Routes>`:

```tsx
          <Route path="/ajustes" element={<Ajustes />} />
```

- [ ] **Step 3: Ponto de entrada**

- **Se o menu "Perfil" já existir** (a sessão de jornadas o introduziu): acrescente uma entrada dentro dele, `<NavLink to="/ajustes">Ajustes</NavLink>`, junto de tema / preferências / sair. Não crie item de primeiro nível na nav.
- **Se ainda NÃO existir**: acrescente `<NavLink to="/ajustes">Ajustes</NavLink>` dentro do bloco `session ? (...)` do `<nav>`, ao lado do botão "Sair" — mesma vizinhança semântica (conta), e a sessão de jornadas o move para dentro do Perfil quando o menu nascer. Deslogado, a entrada não aparece; a rota continua acessível por URL, e a tela funciona porque `zerarProgresso` é local.

- [ ] **Step 4: Estilo**

Em `src/styles/app.css`:

```css
.ajustes-alvos {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
}
.ajustes-alvos li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--linha);
}
.ajustes-rotulo {
  flex: 1;
}
.ajustes-contagem {
  color: var(--muted);
  font-size: 0.875rem;
}
.ajustes-confirma {
  margin-top: 1.25rem;
  padding: 1rem;
  border: 1px solid var(--linha);
  border-radius: 0.75rem;
}
.ajustes-confirma-acoes {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.75rem;
}
.ajustes-livro select {
  margin-left: 0.5rem;
}
```

Confira os nomes reais das variáveis CSS (`--muted`, `--linha`) no topo de `app.css` e use os que existirem.

- [ ] **Step 5: Conferir na tela**

Run: `npm run dev`
Conferir: as contagens batem com o Índice; "Zerar" desabilitado quando 0; confirmar zera e a contagem vai a 0; voltar à Home e ver que "Continuar" aponta para a primeira perícope do testamento zerado, não para um checkpoint velho; a Home mostra o streak inalterado.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Ajustes.tsx src/App.tsx src/styles/app.css
git commit -m "feat: tela /ajustes com zerar por livro, testamento e tudo

Contagem real antes de confirmar, e a confirmacao diz o que sobrevive.
Ponto de entrada no menu de conta, nunca item de primeiro nivel da nav."
```

---

### Task 9: Marcar para reler

**Files:**
- Modify: `src/lib/user-db.ts` (`setParaReler`)
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`
- Test: `src/lib/user-db.test.ts`

**Interfaces:**
- Consumes: `Progresso.paraReler` (Task 2).
- Produces: `setParaReler(ordem: number, valor: boolean): Promise<void>`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
describe('setParaReler', () => {
  it('liga e desliga o pin sem tocar em status nem histórico', async () => {
    await concluirProgresso(9380)
    const antes = await getProgresso(9380)
    await setParaReler(9380, true)
    const ligado = await getProgresso(9380)
    expect(ligado?.paraReler).toBe(true)
    expect(ligado?.status).toBe('concluido')
    expect(ligado?.historico).toEqual(antes?.historico)

    await setParaReler(9380, false)
    expect((await getProgresso(9380))?.paraReler).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "setParaReler"`
Expected: FAIL — `setParaReler is not a function`.

- [ ] **Step 3: Implementar**

```ts
/**
 * Liga/desliga o pin "quero revisitar". Não mexe em `status` nem no histórico:
 * é exatamente a alternativa não-destrutiva a desmarcar — a perícope continua
 * lida, o ✓ do Índice fica e a jornada não regride.
 */
export async function setParaReler(ordem: number, valor: boolean): Promise<void> {
  const atualizadoEm = new Date().toISOString()
  const d = await db()
  const tx = d.transaction(['progresso', 'outbox'], 'readwrite')
  const store = tx.objectStore('progresso')
  const anterior = await store.get(ordem)
  const linha: Progresso = {
    pericopeOrdem: ordem,
    status: anterior?.status ?? 'nao_iniciado',
    historico: anterior?.historico ?? [],
    paraReler: valor,
    atualizadoEm,
  }
  await store.put(linha)
  await tx.objectStore('outbox').put({
    kind: 'progresso',
    ordem,
    status: linha.status,
    historico: linha.historico,
    paraReler: valor,
    atualizadoEm,
  } as OutboxItem)
  await tx.done
}
```

- [ ] **Step 4: Ligar na Leitura**

Guardar a linha inteira num estado (`const [prog, setProg] = useState<Progresso | null>(null)`), populado onde hoje se chama `getProgresso(ordem)` no efeito de carga, e reatualizado depois de `markDone`, `desmarcar` e do toggle. No bloco `.actions`, dentro do ramo de concluída, acrescentar sob o link de desmarcar:

```tsx
              <button
                type="button"
                className="linkish reler"
                onClick={() => void alternarReler()}
              >
                {prog?.paraReler ? '★ Marcada para reler' : '☆ Marcar para reler'}
              </button>
              {prog && prog.historico.length > 0 && (
                <p className="historico-leitura">
                  {prog.historico.length === 1 ? 'lida 1×' : `lida ${prog.historico.length}×`} ·{' '}
                  {prog.historico
                    .slice(0, 3)
                    .map((d) =>
                      new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                    )
                    .join(' · ')}
                </p>
              )}
```

```ts
  async function alternarReler() {
    await setParaReler(ordem, !prog?.paraReler)
    setProg((await getProgresso(ordem)) ?? null)
  }
```

- [ ] **Step 5: Rodar e conferir**

Run: `npm test` — PASS.
`npm run dev`: concluir uma perícope, marcar para reler, recarregar e ver o pin mantido e o ✓ do Índice **intacto**; concluir de novo e ver o pin sumir sozinho.

- [ ] **Step 6: Commit**

```bash
git add src/lib/user-db.ts src/lib/user-db.test.ts src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: marcar para reler, a alternativa nao-destrutiva a desmarcar

O pin nao toca em status nem no historico: a pericope continua lida, o check
do Indice fica e a jornada nao regride. A Leitura mostra o historico."
```

---

### Task 10: Esquecimento por decay e o bloco "Vale reler"

**Files:**
- Create: `src/lib/releitura.ts`
- Create: `src/lib/releitura.test.ts`
- Modify: `src/pages/Home.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `Progresso` (Task 2); `PericopeIndex`, `refLabel` de `src/lib/content.ts`.
- Produces:
  - `DIAS_ESQUECIMENTO = 365`
  - `type CandidatoReler = { ordem: number; ultima: string | null; vezes: number; paraReler: boolean; dias: number }`
  - `candidatosReler(progressos: Progresso[], agora: Date): CandidatoReler[]`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/releitura.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { candidatosReler, DIAS_ESQUECIMENTO } from './releitura'
import type { Progresso } from './types'

const AGORA = new Date('2026-09-03T12:00:00.000Z')

function haDias(n: number): string {
  return new Date(AGORA.getTime() - n * 86_400_000).toISOString()
}

function lida(ordem: number, dias: number, vezes = 1, paraReler = false): Progresso {
  const historico = Array.from({ length: vezes }, (_, i) => haDias(dias + i * 400))
  return {
    pericopeOrdem: ordem,
    status: 'concluido',
    historico,
    paraReler,
    atualizadoEm: historico[0],
  }
}

describe('candidatosReler', () => {
  it('a fronteira é 365 dias: 366 entra, 364 não', () => {
    expect(DIAS_ESQUECIMENTO).toBe(365)
    const r = candidatosReler([lida(1, 366), lida(2, 364)], AGORA)
    expect(r.map((c) => c.ordem)).toEqual([1])
  })

  it('o pin entra mesmo recém-lida, e vem primeiro', () => {
    const r = candidatosReler([lida(1, 400), lida(2, 3, 1, true)], AGORA)
    expect(r.map((c) => c.ordem)).toEqual([2, 1])
  })

  it('não sugere o que não consta como lido', () => {
    const naoLida: Progresso = {
      pericopeOrdem: 9,
      status: 'nao_iniciado',
      historico: [haDias(900)],
      paraReler: false,
      atualizadoEm: haDias(1),
    }
    expect(candidatosReler([naoLida], AGORA)).toEqual([])
  })

  it('ordena da mais esquecida para a menos, desempatando por menos lida', () => {
    const r = candidatosReler([lida(1, 400, 3), lida(2, 500), lida(3, 400, 1)], AGORA)
    expect(r.map((c) => c.ordem)).toEqual([2, 3, 1])
  })

  it('reporta vezes e dias', () => {
    const [c] = candidatosReler([lida(1, 400, 2)], AGORA)
    expect(c.vezes).toBe(2)
    expect(c.dias).toBe(400)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/releitura.test.ts`
Expected: FAIL — `Failed to resolve import "./releitura"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/releitura.ts`:

```ts
import type { Progresso } from './types'

/**
 * Depois de um ano sem reler, a perícope volta para "Vale reler". Limiar
 * ÚNICO, de propósito: não cresce com as releituras. Ler três vezes não afasta
 * da fila — o esquecimento não é mérito.
 */
export const DIAS_ESQUECIMENTO = 365

const MS_POR_DIA = 86_400_000

export type CandidatoReler = {
  ordem: number
  /** Conclusão mais recente; null só em linha corrompida. */
  ultima: string | null
  vezes: number
  paraReler: boolean
  /** Dias inteiros desde `ultima`; 0 quando não há data. */
  dias: number
}

/**
 * As perícopes que vale reler, já ordenadas: o pin manual primeiro, depois da
 * mais esquecida para a menos, desempatando pela menos lida.
 *
 * Função pura sobre as linhas — nenhum acesso a storage, nenhum `Date.now()`
 * escondido. Duas fontes que se somam: `paraReler` (curadoria) e o decay
 * (tempo). Ambas exigem `status === 'concluido'`: o que não consta como lido
 * não é releitura, é leitura.
 */
export function candidatosReler(progressos: Progresso[], agora: Date): CandidatoReler[] {
  const out: CandidatoReler[] = []
  for (const p of progressos) {
    if (p.status !== 'concluido') continue
    const ultima = p.historico[0] ?? null
    const t = ultima === null ? Number.NaN : Date.parse(ultima)
    const dias = Number.isNaN(t) ? 0 : Math.floor((agora.getTime() - t) / MS_POR_DIA)
    if (!p.paraReler && dias <= DIAS_ESQUECIMENTO) continue
    out.push({ ordem: p.pericopeOrdem, ultima, vezes: p.historico.length, paraReler: p.paraReler, dias })
  }
  return out.sort(
    (a, b) =>
      Number(b.paraReler) - Number(a.paraReler) || b.dias - a.dias || a.vezes - b.vezes,
  )
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/lib/releitura.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: O bloco na Home**

`CandidatoReler` traz `ordem`, `vezes`, `paraReler` e `dias` — **não** traz título nem referência, que vivem no índice. A Home cruza os dois num tipo local:

```tsx
type ItemReler = CandidatoReler & { titulo: string; ref: string }

const [candidatos, setCandidatos] = useState<ItemReler[]>([])
const [todos, setTodos] = useState(false)
```

Dentro da mesma função `carregar` que já monta as trilhas — mesma função de propósito, senão a tela mostra dois instantes diferentes do mesmo progresso — e depois de `const all = await loadIndex()`:

```tsx
      const porOrdem = new Map(all.map((p) => [p.ordem, p]))
      setCandidatos(
        candidatosReler(await listAllProgresso(), new Date()).flatMap((c) => {
          const meta = porOrdem.get(c.ordem)
          // Perícope que saiu do catálogo não vira linha órfã na Home.
          return meta ? [{ ...c, titulo: meta.titulo_pericope_pt, ref: refLabel(meta) }] : []
        }),
      )
```

Imports novos: `candidatosReler` e `type CandidatoReler` de `../lib/releitura`, `refLabel` de `../lib/content`, e `listAllProgresso` de `../lib/user-db` (que a Task 4 pode ter deixado sem uso — reponha).

E o bloco, renderizado **abaixo do conteúdo principal**:

```tsx
{candidatos.length > 0 && (
  <section className="vale-reler">
    <h2>Vale reler</h2>
    <ul>
      {(todos ? candidatos : candidatos.slice(0, 3)).map((c) => (
        <li key={c.ordem}>
          <Link to={`/leitura/${c.ordem}`}>
            <span aria-hidden>{c.paraReler ? '★' : '●'}</span>
            <span className="vale-reler-texto">
              <strong>{c.titulo}</strong>
              <span>
                {c.ref} · {c.vezes === 1 ? 'lida 1×' : `lida ${c.vezes}×`}
                {c.paraReler ? ' · marcada' : ` · há ${Math.floor(c.dias / 30)} meses`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
    {!todos && candidatos.length > 3 && (
      <button type="button" className="linkish" onClick={() => setTodos(true)}>
        ver todas ({candidatos.length})
      </button>
    )}
  </section>
)}
```

Posição: **depois** do `.track-grid` e de qualquer card de jornada, oculto quando vazio. A sessão de jornadas é dona da estrutura da Home e decidiu isso: a Home responde primeiro "para onde eu vou agora"; releitura é oferta, não instrução.

- [ ] **Step 6: Rodar e conferir**

Run: `npm test` — PASS.
`npm run dev`: com nada velho, o bloco não aparece. Marcar uma perícope para reler e ver o bloco surgir com ela no topo, com ★.

- [ ] **Step 7: Commit**

```bash
git add src/lib/releitura.ts src/lib/releitura.test.ts src/pages/Home.tsx src/styles/app.css
git commit -m "feat: Vale reler — pin manual mais decay de 1 ano

candidatosReler e puro: duas fontes que se somam, ordenado com o pin primeiro
e depois da mais esquecida. Bloco na Home abaixo do conteudo principal,
oculto quando vazio."
```

---

## Verificação final

- [ ] `npm test` e `npm run typecheck:worker` verdes.
- [ ] `npm run lint` sem erro novo.
- [ ] `npx wrangler d1 migrations apply biblia-pericopes --local` aplica a 0010 limpa.
- [ ] Os 9 critérios de aceite das fatias 0–2 na spec (§Critérios de aceite, itens 1–9) conferidos à mão. O item 10 é da fatia 3 e fica fora deste plano; o item 11 (instalação antiga) exige abrir o app com um IndexedDB pré-existente — dá para simular no navegador guardando dados antes de trocar de branch.
- [ ] Antes de `wrangler deploy`: aplicar a 0010 em produção (`--remote`) **antes** de subir o Worker novo, senão o `INSERT` referencia colunas que ainda não existem.
