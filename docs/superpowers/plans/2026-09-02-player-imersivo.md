# Player imersivo (P6) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tocar a narração pré-gerada realçando o alvo (versículo/parágrafo) e a
palavra em curso, com a tela acompanhando, e retirar o TTS sintético do app.

**Architecture:** Três módulos puros e testáveis — cliente do manifesto,
alinhamento por fluxo de tokens, busca temporal — sob um componente de player
que possui o `<audio>` e dirige o realce. A `Leitura` só expõe os alvos
renderizados e recebe de volta qual deles está em fala; o realce de palavra é
imperativo (troca de classe), fora do caminho do React.

**Tech Stack:** React 19, TypeScript, Vitest (ambiente node; `happy-dom` por
arquivo quando precisar de DOM), Cloudflare Worker servindo `/api/audio/*` do R2.

**Spec:** `docs/superpowers/specs/2026-09-02-player-imersivo-design.md`

## Global Constraints

- Textos de UI em pt-BR. Mensagens de commit em pt-BR, no padrão dos existentes.
- **O tokenizador é `texto.split(' ')`, sem filtro e sem normalização**, dos dois
  lados. É o contrato de `palavras` (um item por token de `texto.split(' ')`).
  Filtrar vazios desalinha os índices com `palavras`.
- **Na dúvida, realce nenhum.** Qualquer divergência entre o fluxo de tokens do
  manifesto e o da tela faz *aquela seção* tocar sem realce. Nunca realçar por
  aproximação, nunca por chute.
- A seção `titulo` do manifesto (2 unidades: título e referência falada) não tem
  alvo na tela e é pulada inteira. Nas outras seções, a **primeira** unidade é o
  cabeçalho falado (`"Contexto."`, `"Texto Bíblico."`, `"Resenha."`,
  `"Reflexões."`) e é descartada.
- Prefixos a descartar da unidade: `Capítulo N.` e `Reflexão N.` — e **só**
  quando o descarte faz o token seguinte coincidir com o próximo token pendente
  da tela.
- `res.ok` é o critério de sucesso das respostas de `/api/audio/*`: o Worker
  responde **206** em GET de objeto do R2, não 200. Um `status === 200` quebra.
- TDD: teste que falha primeiro, depois a implementação. Commits pequenos.
- Nada de `@testing-library`: o projeto não tem infra de teste de componente. O
  que precisa de teste vira função pura num módulo próprio (padrão de
  `src/lib/use-wake-lock.test.ts`).
- Não encostar em `docs/superpowers/specs/2026-09-01-tts-batch-vozes-design.md`,
  `docs/superpowers/plans/2026-09-01-tts-batch-geracao.md`, nem em nada do
  pipeline de geração de áudio (`../tts-spike/`, `../tts-corpus/`).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/manifesto.ts` (novo) | Tipos do manifesto + busca tolerante a falha (404/erro → `null`) |
| `src/lib/manifesto.test.ts` (novo) | Validação de forma e caminhos de falha |
| `src/lib/alinhar-narracao.ts` (novo) | Alinhamento por fluxo de tokens, por seção |
| `src/lib/alinhar-narracao.test.ts` (novo) | Fixture real + casos adulterados |
| `src/lib/narracao-timeline.ts` (novo) | Busca do alvo e da palavra em curso dado `t` |
| `src/lib/narracao-timeline.test.ts` (novo) | Avanço, seek para trás, vãos |
| `src/lib/__fixtures__/manifesto-1600.json` (já existe) | Manifesto real de Mateus 1:1-17 |
| `src/components/NarracaoPlayer.tsx` (reescrito) | `<audio>`, carga do manifesto, `timeupdate` → realce |
| `src/pages/Leitura.tsx` (modificado) | Monta os alvos, recebe o alvo em fala, tokeniza o alvo em curso |
| `src/styles/app.css` (modificado) | `.word-speaking`; some o `.ttsmenu-pop` |
| `src/lib/tts.ts`, `tts.test.ts`, `tts-prefs.ts`, `tts-prefs.test.ts`, `src/components/TtsMenu.tsx` | **apagados** na Task 6 |

---

### Task 1: Cliente do manifesto

**Files:**
- Create: `src/lib/manifesto.ts`
- Test: `src/lib/manifesto.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export type SecaoManifesto = 'titulo' | 'contexto' | 'texto' | 'resenha' | 'reflexoes'
  export type PalavraManifesto = { t: string; i: number; d: number }
  export type UnidadeManifesto = {
    i: number
    secao: SecaoManifesto
    texto: string
    inicio: number
    dur: number
    palavras?: PalavraManifesto[]
  }
  export type Manifesto = { ordem: number; dur_total: number; unidades: UnidadeManifesto[] }
  export function manifestoValido(v: unknown): v is Manifesto
  export async function carregarManifesto(ordem: number, signal?: AbortSignal): Promise<Manifesto | null>
  ```

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/manifesto.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { manifestoValido } from './manifesto'
import bruto from './__fixtures__/manifesto-1600.json'

describe('manifestoValido', () => {
  it('aceita o manifesto real', () => {
    expect(manifestoValido(bruto)).toBe(true)
  })

  it('recusa não-objeto', () => {
    expect(manifestoValido(null)).toBe(false)
    expect(manifestoValido('{}')).toBe(false)
    expect(manifestoValido([])).toBe(false)
  })

  it('recusa sem unidades', () => {
    expect(manifestoValido({ ordem: 1, dur_total: 1 })).toBe(false)
    expect(manifestoValido({ ordem: 1, dur_total: 1, unidades: {} })).toBe(false)
  })

  it('recusa unidade sem os campos do eixo de tempo', () => {
    const m = { ordem: 1, dur_total: 9, unidades: [{ i: 0, secao: 'texto', texto: 'oi' }] }
    expect(manifestoValido(m)).toBe(false)
  })

  it('recusa seção desconhecida', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [{ i: 0, secao: 'rodape', texto: 'oi', inicio: 0, dur: 1 }],
    }
    expect(manifestoValido(m)).toBe(false)
  })

  it('aceita unidade sem palavras (manifesto não realinhado)', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [{ i: 0, secao: 'texto', texto: 'oi', inicio: 0, dur: 1 }],
    }
    expect(manifestoValido(m)).toBe(true)
  })

  it('recusa palavras malformadas', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [
        { i: 0, secao: 'texto', texto: 'oi', inicio: 0, dur: 1, palavras: [{ t: 'oi', i: 0 }] },
      ],
    }
    expect(manifestoValido(m)).toBe(false)
  })
})
```

E, no mesmo arquivo, os testes de `carregarManifesto` com `fetch` trocado:

```ts
import { afterEach, vi } from 'vitest'
import { carregarManifesto } from './manifesto'

function respostaJson(corpo: unknown, init: { status?: number } = {}): Response {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => corpo,
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('carregarManifesto', () => {
  it('devolve o manifesto quando a resposta é 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(bruto)))
    const m = await carregarManifesto(1600)
    expect(m?.ordem).toBe(1600)
  })

  it('aceita 206 — o Worker responde parcial em GET do R2', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(bruto, { status: 206 })))
    expect(await carregarManifesto(1600)).not.toBeNull()
  })

  it('404 vira null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({}, { status: 404 })))
    expect(await carregarManifesto(9999)).toBeNull()
  })

  it('content-type que não é json vira null', async () => {
    const html = {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: async () => bruto,
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn(async () => html))
    expect(await carregarManifesto(1600)).toBeNull()
  })

  it('corpo com forma errada vira null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ ordem: 1 })))
    expect(await carregarManifesto(1600)).toBeNull()
  })

  it('rede caída vira null, sem lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(carregarManifesto(1600)).resolves.toBeNull()
  })

  it('busca a URL do manifesto da ordem', async () => {
    const f = vi.fn(async () => respostaJson(bruto))
    vi.stubGlobal('fetch', f)
    await carregarManifesto(1600)
    expect(f.mock.calls[0]?.[0]).toBe('/api/audio/nt-ml/1600.json')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/manifesto.test.ts`
Expected: FAIL — `Cannot find module './manifesto'`.

Se o import do JSON reclamar de tipo, garanta `"resolveJsonModule": true` no
`tsconfig` que cobre `src/` (o Vite já resolve JSON em runtime; é só o `tsc`).

- [ ] **Step 3: Implementar**

`src/lib/manifesto.ts`:

```ts
/**
 * Manifesto de sincronização da narração (gerado noutra sessão, servido do R2
 * pelo Worker). `inicio`/`dur` e `palavras[].i`/`.d` são segundos ABSOLUTOS
 * dentro do m4a costurado — é o eixo do `timeupdate`.
 */
export type SecaoManifesto = 'titulo' | 'contexto' | 'texto' | 'resenha' | 'reflexoes'

export type PalavraManifesto = { t: string; i: number; d: number }

export type UnidadeManifesto = {
  i: number
  secao: SecaoManifesto
  texto: string
  inicio: number
  dur: number
  /** Ausente em manifesto anterior ao realinhamento: sem ele, não há realce. */
  palavras?: PalavraManifesto[]
}

export type Manifesto = {
  ordem: number
  dur_total: number
  unidades: UnidadeManifesto[]
}

const SECOES: readonly string[] = ['titulo', 'contexto', 'texto', 'resenha', 'reflexoes']

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function palavraValida(v: unknown): v is PalavraManifesto {
  const p = v as PalavraManifesto
  return !!p && typeof p === 'object' && typeof p.t === 'string' && num(p.i) && num(p.d)
}

function unidadeValida(v: unknown): v is UnidadeManifesto {
  const u = v as UnidadeManifesto
  if (!u || typeof u !== 'object') return false
  if (typeof u.texto !== 'string' || !SECOES.includes(u.secao)) return false
  if (!num(u.i) || !num(u.inicio) || !num(u.dur)) return false
  if (u.palavras !== undefined) {
    if (!Array.isArray(u.palavras) || !u.palavras.every(palavraValida)) return false
  }
  return true
}

/** Guarda de forma: o manifesto vem da rede, então nada aqui é presumido. */
export function manifestoValido(v: unknown): v is Manifesto {
  const m = v as Manifesto
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false
  if (!num(m.ordem) || !num(m.dur_total)) return false
  return Array.isArray(m.unidades) && m.unidades.every(unidadeValida)
}

/**
 * Busca o manifesto da perícope. Qualquer falha — 404, rede, corpo estranho —
 * devolve `null`: sem manifesto o áudio ainda toca, só que sem realce.
 */
export async function carregarManifesto(
  ordem: number,
  signal?: AbortSignal,
): Promise<Manifesto | null> {
  try {
    // `res.ok`, não `status === 200`: o Worker devolve 206 em GET do R2.
    const res = await fetch(`/api/audio/nt-ml/${ordem}.json`, { signal })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null
    const corpo: unknown = await res.json()
    return manifestoValido(corpo) ? corpo : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/manifesto.test.ts`
Expected: PASS, saída limpa (sem warnings).

- [ ] **Step 5: Commit**

```bash
git add src/lib/manifesto.ts src/lib/manifesto.test.ts
git commit -m "feat: cliente do manifesto de narração, tolerante a falha"
```

---

### Task 2: Alinhamento por fluxo de tokens

**Files:**
- Create: `src/lib/alinhar-narracao.ts`
- Test: `src/lib/alinhar-narracao.test.ts`

**Interfaces:**
- Consumes: `Manifesto`, `UnidadeManifesto`, `SecaoManifesto` de `./manifesto`.
- Produces:
  ```ts
  /** Um elemento da tela que pode ser realçado, na ordem em que é lido. */
  export type Alvo = { id: string; texto: string }
  /** Os alvos de uma seção do manifesto, na ordem de leitura. */
  export type SecaoAlvos = { secao: Exclude<SecaoManifesto, 'titulo'>; alvos: Alvo[] }
  export type AlvoAlinhado = {
    id: string
    inicio: number
    fim: number
    /** Uma por token de `alvo.texto.split(' ')`, na mesma ordem. */
    palavras: { inicio: number; fim: number }[]
  }
  /** Ordenado por `inicio`, sem sobreposição. Vazio = tocar sem realce. */
  export type Alinhamento = AlvoAlinhado[]
  export function tokens(texto: string): string[]
  export function alinhar(manifesto: Manifesto, secoes: SecaoAlvos[]): Alinhamento
  ```

**Regras que os testes travam:**

1. A primeira unidade de cada seção é o cabeçalho falado e sai. `titulo` é
   pulada inteira (não aparece em `secoes`).
2. Uma seção só entra se o fluxo de tokens do manifesto for **idêntico** —
   comprimento e conteúdo — ao fluxo de tokens dos seus alvos.
3. Prefixo `Capítulo N.` / `Reflexão N.` é descartado só quando o descarte faz o
   próximo token bater com o próximo token pendente da tela.
4. Unidade sem `palavras`, ou com `palavras` que não reproduzem
   `texto.split(' ')`, derruba a seção inteira.
5. As janelas são **contíguas dentro da seção**: o `fim` de um alvo é o `inicio`
   do próximo; o do último alvo é o fim da última unidade da seção. Idem para as
   palavras dentro do alvo. É isso que evita a piscada nos silêncios.
6. Seções não alinhadas simplesmente não aparecem no resultado — as outras
   seguem.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/alinhar-narracao.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { alinhar, tokens, type SecaoAlvos } from './alinhar-narracao'
import type { Manifesto } from './manifesto'
import fixture from './__fixtures__/manifesto-1600.json'

const real = fixture as unknown as Manifesto

/** Reconstrói os alvos da tela a partir do próprio manifesto: é o caso feliz
    (a tela mostra exatamente o que foi narrado, sem cabeçalho nem prefixo). */
function alvosDoManifesto(m: Manifesto, secao: 'contexto' | 'texto' | 'resenha' | 'reflexoes') {
  return m.unidades
    .filter((u) => u.secao === secao)
    .slice(1)
    .map((u, k) => ({
      id: `${secao}-${k}`,
      texto: u.texto.replace(/^(?:Capítulo|Reflexão)\s+\d+\.\s+/, ''),
    }))
}

describe('tokens', () => {
  it('é split(" ") puro — sem trim, sem filtro', () => {
    expect(tokens('a  b')).toEqual(['a', '', 'b'])
    expect(tokens('a b')).toEqual(['a', 'b'])
  })
})

describe('alinhar — manifesto real 1600', () => {
  it('alinha o texto bíblico versículo a versículo', () => {
    const alvos = alvosDoManifesto(real, 'texto')
    const r = alinhar(real, [{ secao: 'texto', alvos }])
    expect(r).toHaveLength(17)
    expect(r[0]!.id).toBe('texto-0')
    // "Capítulo 1." saiu: a 1ª palavra do 1º versículo é "Livro".
    expect(r[0]!.palavras).toHaveLength(tokens(alvos[0]!.texto).length)
    expect(r[0]!.inicio).toBeGreaterThan(42) // depois de "Capítulo 1."
  })

  it('alinha contexto com 1 unidade e 2 parágrafos na tela', () => {
    const uni = real.unidades.filter((u) => u.secao === 'contexto')[1]!
    const tk = tokens(uni.texto)
    const corte = 30
    const alvos = [
      { id: 'contexto-0', texto: tk.slice(0, corte).join(' ') },
      { id: 'contexto-1', texto: tk.slice(corte).join(' ') },
    ]
    const r = alinhar(real, [{ secao: 'contexto', alvos }])
    expect(r.map((a) => a.id)).toEqual(['contexto-0', 'contexto-1'])
    expect(r[0]!.palavras).toHaveLength(corte)
    expect(r[1]!.palavras).toHaveLength(tk.length - corte)
    // contíguo: o fim do primeiro é o início do segundo.
    expect(r[0]!.fim).toBe(r[1]!.inicio)
  })

  it('descarta o prefixo "Reflexão N."', () => {
    const alvos = alvosDoManifesto(real, 'reflexoes')
    const r = alinhar(real, [{ secao: 'reflexoes', alvos }])
    expect(r).toHaveLength(2)
    expect(r[0]!.palavras).toHaveLength(tokens(alvos[0]!.texto).length)
  })

  it('as janelas de palavra são contíguas e cobrem o alvo inteiro', () => {
    const alvos = alvosDoManifesto(real, 'resenha')
    const r = alinhar(real, [{ secao: 'resenha', alvos }])
    for (const a of r) {
      for (let k = 1; k < a.palavras.length; k++) {
        expect(a.palavras[k]!.inicio).toBe(a.palavras[k - 1]!.fim)
      }
      expect(a.palavras[0]!.inicio).toBe(a.inicio)
      expect(a.palavras[a.palavras.length - 1]!.fim).toBe(a.fim)
    }
  })

  it('as quatro seções juntas saem ordenadas por início, sem sobreposição', () => {
    const secoes: SecaoAlvos[] = (['contexto', 'texto', 'resenha', 'reflexoes'] as const).map(
      (s) => ({ secao: s, alvos: alvosDoManifesto(real, s) }),
    )
    // o contexto real tem 1 unidade só; aqui isso vira 1 alvo, e alinha igual.
    const r = alinhar(real, secoes)
    expect(r.length).toBe(1 + 17 + 2 + 2)
    for (let k = 1; k < r.length; k++) expect(r[k]!.inicio).toBeGreaterThanOrEqual(r[k - 1]!.fim)
  })

  it('ignora a seção titulo (não tem alvo na tela)', () => {
    const r = alinhar(real, [])
    expect(r).toEqual([])
  })
})

describe('alinhar — recusas', () => {
  const uma = (u: Partial<Manifesto['unidades'][number]>): Manifesto => ({
    ordem: 1,
    dur_total: 10,
    unidades: [
      { i: 0, secao: 'resenha', texto: 'Resenha.', inicio: 0, dur: 1, palavras: [{ t: 'Resenha.', i: 0, d: 1 }] },
      {
        i: 1,
        secao: 'resenha',
        texto: 'um dois',
        inicio: 2,
        dur: 2,
        palavras: [{ t: 'um', i: 2, d: 1 }, { t: 'dois', i: 3, d: 1 }],
        ...u,
      },
    ],
  })

  it('texto da tela diferente do narrado derruba a seção', () => {
    const r = alinhar(uma({}), [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um tres' }] }])
    expect(r).toEqual([])
  })

  it('contagem diferente derruba a seção', () => {
    const r = alinhar(uma({}), [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um' }] }])
    expect(r).toEqual([])
  })

  it('unidade sem palavras derruba a seção', () => {
    const r = alinhar(uma({ palavras: undefined }), [
      { secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um dois' }] },
    ])
    expect(r).toEqual([])
  })

  it('palavras que não reproduzem o texto derrubam a seção', () => {
    const m = uma({ palavras: [{ t: 'um', i: 2, d: 1 }, { t: 'DOIS', i: 3, d: 1 }] })
    const r = alinhar(m, [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um dois' }] }])
    expect(r).toEqual([])
  })

  it('uma seção quebrada não derruba as outras', () => {
    const secoes: SecaoAlvos[] = [
      { secao: 'texto', alvos: [{ id: 'v', texto: 'nao bate' }] },
      { secao: 'resenha', alvos: alvosDoManifesto(real, 'resenha') },
    ]
    const r = alinhar(real, secoes)
    expect(r.map((a) => a.id)).toEqual(alvosDoManifesto(real, 'resenha').map((a) => a.id))
  })

  it('seção ausente do manifesto sai vazia, sem lançar', () => {
    const r = alinhar(uma({}), [{ secao: 'contexto', alvos: [{ id: 'c-0', texto: 'oi' }] }])
    expect(r).toEqual([])
  })

  it('prefixo que NÃO é prefixo é preservado', () => {
    // A tela diz literalmente "Capítulo 3. começa aqui" — não é o marcador
    // fundido, é o texto. Descartar mutilaria o alinhamento.
    const m: Manifesto = {
      ordem: 1,
      dur_total: 10,
      unidades: [
        { i: 0, secao: 'texto', texto: 'Texto Bíblico.', inicio: 0, dur: 1, palavras: [{ t: 'Texto', i: 0, d: 0.5 }, { t: 'Bíblico.', i: 0.5, d: 0.5 }] },
        {
          i: 1,
          secao: 'texto',
          texto: 'Capítulo 3. começa aqui',
          inicio: 2,
          dur: 4,
          palavras: [
            { t: 'Capítulo', i: 2, d: 1 },
            { t: '3.', i: 3, d: 1 },
            { t: 'começa', i: 4, d: 1 },
            { t: 'aqui', i: 5, d: 1 },
          ],
        },
      ],
    }
    const r = alinhar(m, [{ secao: 'texto', alvos: [{ id: 'v', texto: 'Capítulo 3. começa aqui' }] }])
    expect(r).toHaveLength(1)
    expect(r[0]!.palavras).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/alinhar-narracao.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`src/lib/alinhar-narracao.ts`:

```ts
import type { Manifesto, SecaoManifesto, UnidadeManifesto } from './manifesto'

/** Um elemento da tela que pode ser realçado (`data-verse-id` é o `id`). */
export type Alvo = { id: string; texto: string }

/** Os alvos de uma seção, na ordem de leitura. `titulo` não tem alvo na tela. */
export type SecaoAlvos = { secao: Exclude<SecaoManifesto, 'titulo'>; alvos: Alvo[] }

export type AlvoAlinhado = {
  id: string
  inicio: number
  fim: number
  /** Uma janela por token de `alvo.texto.split(' ')`, na mesma ordem. */
  palavras: { inicio: number; fim: number }[]
}

/** Ordenado por `inicio`, sem sobreposição. Vazio significa "sem realce". */
export type Alinhamento = AlvoAlinhado[]

/**
 * O tokenizador do contrato: `palavras` traz um item por token de
 * `texto.split(' ')`. Filtrar vazios ou aparar desalinharia os índices.
 */
export function tokens(texto: string): string[] {
  return texto.split(' ')
}

const PREFIXO = /^(?:Capítulo|Reflexão)\s+\d+\.\s+/

type TokenManifesto = { tok: string; inicio: number }

/**
 * Achata as unidades de conteúdo num fluxo de tokens com tempo. Devolve `null`
 * ao primeiro sinal de que o manifesto não honra o contrato de `palavras`.
 *
 * `telaTok` entra só para decidir o descarte de prefixo: `"Capítulo 3."` é
 * marcador fundido quando descartá-lo faz o token seguinte casar com o que a
 * tela espera, e é texto de verdade quando não faz.
 */
function fluxoDoManifesto(unidades: UnidadeManifesto[], telaTok: string[]): TokenManifesto[] | null {
  const fluxo: TokenManifesto[] = []
  for (const u of unidades) {
    const tk = tokens(u.texto)
    const pal = u.palavras
    if (!pal || pal.length !== tk.length) return null
    for (let k = 0; k < tk.length; k++) if (pal[k]!.t !== tk[k]) return null

    let ini = 0
    const m = PREFIXO.exec(u.texto)
    if (m) {
      const n = tokens(m[0].trimEnd()).length
      if (n < tk.length && telaTok[fluxo.length] === tk[n]) ini = n
    }
    for (let k = ini; k < tk.length; k++) fluxo.push({ tok: tk[k]!, inicio: pal[k]!.i })
  }
  return fluxo
}

/** Alinha uma seção. Devolve `[]` — sem realce — a qualquer divergência. */
function alinharSecao(unidadesDaSecao: UnidadeManifesto[], alvos: Alvo[]): AlvoAlinhado[] {
  // A primeira unidade de toda seção de conteúdo é o cabeçalho falado
  // ("Contexto.", "Texto Bíblico.", …), que não existe na tela.
  const conteudo = unidadesDaSecao.slice(1)
  if (!conteudo.length || !alvos.length) return []

  const telaTok: string[] = []
  const donoDoToken: number[] = []
  alvos.forEach((a, ia) => {
    for (const tok of tokens(a.texto)) {
      telaTok.push(tok)
      donoDoToken.push(ia)
    }
  })

  const fluxo = fluxoDoManifesto(conteudo, telaTok)
  if (!fluxo || fluxo.length !== telaTok.length) return []
  for (let k = 0; k < fluxo.length; k++) if (fluxo[k]!.tok !== telaTok[k]) return []

  const ultima = conteudo[conteudo.length - 1]!
  const fimSecao = ultima.inicio + ultima.dur

  const saida: AlvoAlinhado[] = alvos.map((a) => ({
    id: a.id,
    inicio: 0,
    fim: 0,
    palavras: [],
  }))
  fluxo.forEach((t, k) => {
    saida[donoDoToken[k]!]!.palavras.push({ inicio: t.inicio, fim: 0 })
  })

  // Janelas contíguas: cada uma vai até o começo da seguinte. Sem isso, o
  // silêncio entre palavras apagaria o realce e produziria uma piscada.
  for (let ia = 0; ia < saida.length; ia++) {
    const a = saida[ia]!
    a.inicio = a.palavras[0]!.inicio
    a.fim = ia + 1 < saida.length ? saida[ia + 1]!.palavras[0]!.inicio : fimSecao
  }
  for (const a of saida) {
    for (let k = 0; k < a.palavras.length; k++) {
      a.palavras[k]!.fim = k + 1 < a.palavras.length ? a.palavras[k + 1]!.inicio : a.fim
    }
  }
  return saida
}

/**
 * Casa o manifesto com o que a tela renderizou, token a token. Uma seção cujo
 * fluxo não bata exatamente fica de fora: toca sem realce, e as outras seguem.
 */
export function alinhar(manifesto: Manifesto, secoes: SecaoAlvos[]): Alinhamento {
  const saida: AlvoAlinhado[] = []
  for (const { secao, alvos } of secoes) {
    const daSecao = manifesto.unidades.filter((u) => u.secao === secao)
    saida.push(...alinharSecao(daSecao, alvos))
  }
  return saida.sort((a, b) => a.inicio - b.inicio)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/alinhar-narracao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alinhar-narracao.ts src/lib/alinhar-narracao.test.ts
git commit -m "feat: alinhamento manifesto↔tela por fluxo de tokens"
```

---

### Task 3: Busca temporal

**Files:**
- Create: `src/lib/narracao-timeline.ts`
- Test: `src/lib/narracao-timeline.test.ts`

**Interfaces:**
- Consumes: `AlvoAlinhado`, `Alinhamento` de `./alinhar-narracao`.
- Produces:
  ```ts
  export function indiceEm(alinhamento: Alinhamento, t: number, dica: number): number
  export function indiceDaPalavra(alvo: AlvoAlinhado, t: number, dica: number): number
  ```
  Ambas devolvem `-1` quando `t` cai fora de tudo (vão entre seções, cabeçalho
  falado, antes do começo). `dica` é o último índice conhecido — a busca tenta
  `dica` e `dica + 1` antes de cair na binária, porque o tempo anda para frente
  na maior parte dos `timeupdate`; depois de um seek a binária resolve.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/narracao-timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { indiceDaPalavra, indiceEm } from './narracao-timeline'
import type { AlvoAlinhado } from './alinhar-narracao'

const alvo = (id: string, inicio: number, fim: number): AlvoAlinhado => ({
  id,
  inicio,
  fim,
  palavras: [
    { inicio, fim: inicio + (fim - inicio) / 2 },
    { inicio: inicio + (fim - inicio) / 2, fim },
  ],
})

// Duas seções, com um vão entre elas (o cabeçalho falado da segunda).
const linha = [alvo('a', 0, 10), alvo('b', 10, 20), alvo('c', 30, 40)]

describe('indiceEm', () => {
  it('acha pela dica certa sem varrer', () => {
    expect(indiceEm(linha, 5, 0)).toBe(0)
  })

  it('avança um passo quando o tempo cruza para o próximo', () => {
    expect(indiceEm(linha, 12, 0)).toBe(1)
  })

  it('acha com dica errada (seek para frente)', () => {
    expect(indiceEm(linha, 35, 0)).toBe(2)
  })

  it('acha com dica errada (seek para trás)', () => {
    expect(indiceEm(linha, 1, 2)).toBe(0)
  })

  it('dica fora da faixa não quebra', () => {
    expect(indiceEm(linha, 5, 99)).toBe(0)
    expect(indiceEm(linha, 5, -3)).toBe(0)
  })

  it('vão entre seções não realça nada', () => {
    expect(indiceEm(linha, 25, 1)).toBe(-1)
  })

  it('antes do primeiro e depois do último não realça nada', () => {
    expect(indiceEm([alvo('a', 5, 10)], 1, 0)).toBe(-1)
    expect(indiceEm(linha, 100, 2)).toBe(-1)
  })

  it('a borda pertence ao alvo seguinte — [inicio, fim)', () => {
    expect(indiceEm(linha, 10, 0)).toBe(1)
  })

  it('alinhamento vazio devolve -1', () => {
    expect(indiceEm([], 3, 0)).toBe(-1)
  })
})

describe('indiceDaPalavra', () => {
  const a = alvo('a', 0, 10)

  it('primeira e segunda metades', () => {
    expect(indiceDaPalavra(a, 1, 0)).toBe(0)
    expect(indiceDaPalavra(a, 7, 0)).toBe(1)
  })

  it('seek para trás dentro do alvo', () => {
    expect(indiceDaPalavra(a, 1, 1)).toBe(0)
  })

  it('fora do alvo devolve -1', () => {
    expect(indiceDaPalavra(a, 50, 0)).toBe(-1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/narracao-timeline.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`src/lib/narracao-timeline.ts`:

```ts
import type { Alinhamento, AlvoAlinhado } from './alinhar-narracao'

type Janela = { inicio: number; fim: number }

function dentro(j: Janela | undefined, t: number): boolean {
  return !!j && t >= j.inicio && t < j.fim
}

/**
 * Índice da janela que contém `t`, ou -1. `dica` é o último índice conhecido:
 * o `timeupdate` anda para frente quase sempre, então tentar `dica` e a
 * seguinte resolve o caso comum em duas comparações; a binária cobre o seek.
 */
function buscar(janelas: readonly Janela[], t: number, dica: number): number {
  if (dentro(janelas[dica], t)) return dica
  if (dentro(janelas[dica + 1], t)) return dica + 1

  let lo = 0
  let hi = janelas.length - 1
  while (lo <= hi) {
    const meio = (lo + hi) >> 1
    const j = janelas[meio]!
    if (t < j.inicio) hi = meio - 1
    else if (t >= j.fim) lo = meio + 1
    else return meio
  }
  return -1
}

/** Qual alvo está em fala em `t`. -1 nos vãos (cabeçalho falado, silêncio). */
export function indiceEm(alinhamento: Alinhamento, t: number, dica: number): number {
  return buscar(alinhamento, t, dica)
}

/** Qual palavra do alvo está em fala em `t`. -1 se `t` está fora do alvo. */
export function indiceDaPalavra(alvo: AlvoAlinhado, t: number, dica: number): number {
  return buscar(alvo.palavras, t, dica)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/narracao-timeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/narracao-timeline.ts src/lib/narracao-timeline.test.ts
git commit -m "feat: busca do alvo e da palavra em fala por tempo"
```

---

### Task 4: Player que dirige o realce

**Files:**
- Modify (reescrever): `src/components/NarracaoPlayer.tsx`

**Interfaces:**
- Consumes: `carregarManifesto` (Task 1), `alinhar`/`SecaoAlvos` (Task 2),
  `indiceEm`/`indiceDaPalavra` (Task 3).
- Produces:
  ```ts
  export default function NarracaoPlayer(props: {
    ordem: number
    /** Alvos renderizados, na ordem de leitura. DEVE ser memoizado. */
    secoes: SecaoAlvos[]
    /** Chamado só quando o alvo em fala muda (inclusive para null). */
    onAlvo: (id: string | null) => void
  }): JSX.Element | null
  ```

**Decisões que o implementador não deve reabrir:**

- O `HEAD` no `.m4a` decide se o player aparece — é o que o player de hoje já
  faz e é a checagem barata. O manifesto decide só se há realce.
- **O alvo em fala é estado do React; a palavra em fala não.** A palavra troca
  ~2,5×/s: passá-la por `setState` re-renderizaria a `Leitura` inteira (987
  linhas) nesse ritmo. O realce de palavra é uma troca de classe imperativa
  num elemento que já está na árvore.
- No `timeupdate` em que o alvo muda, os `<span data-w>` do alvo novo ainda não
  existem (o React só renderiza depois). Chamar `onAlvo` e sair é o certo: o
  próximo `timeupdate` (≤250 ms) marca a palavra, e o realce do alvo já está
  visível nesse meio tempo.

- [ ] **Step 1: Reescrever o componente**

`src/components/NarracaoPlayer.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alinhar, type SecaoAlvos } from '../lib/alinhar-narracao'
import { carregarManifesto, type Manifesto } from '../lib/manifesto'
import { indiceDaPalavra, indiceEm } from '../lib/narracao-timeline'

type Props = {
  ordem: number
  /** Alvos renderizados, na ordem de leitura. Memoize na Leitura. */
  secoes: SecaoAlvos[]
  onAlvo: (id: string | null) => void
}

/**
 * Narração pré-gerada (voz clonada, servida do R2 via /api/audio). Só aparece
 * quando o áudio da perícope existe — um HEAD barato decide. O manifesto,
 * quando existe e casa com a tela, transforma o `timeupdate` em realce do
 * alvo e da palavra em fala.
 */
export default function NarracaoPlayer({ ordem, secoes, onAlvo }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [manifesto, setManifesto] = useState<Manifesto | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Índices da última busca: o timeupdate anda para frente quase sempre.
  const iAlvo = useRef(0)
  const iPalavra = useRef(0)
  const alvoAtual = useRef<string | null>(null)
  const spanAtual = useRef<HTMLElement | null>(null)

  const alinhamento = useMemo(
    () => (manifesto ? alinhar(manifesto, secoes) : []),
    [manifesto, secoes],
  )

  useEffect(() => {
    const url = `/api/audio/nt-ml/${ordem}.m4a`
    const ac = new AbortController()
    let vivo = true
    setSrc(null)
    setManifesto(null)
    fetch(url, { method: 'HEAD', signal: ac.signal })
      .then((r) => {
        if (vivo && r.ok) setSrc(url)
      })
      .catch(() => {})
    carregarManifesto(ordem, ac.signal).then((m) => {
      if (vivo) setManifesto(m)
    })
    return () => {
      vivo = false
      ac.abort()
    }
  }, [ordem])

  const limparPalavra = useCallback(() => {
    spanAtual.current?.classList.remove('word-speaking')
    spanAtual.current = null
  }, [])

  const trocarAlvo = useCallback(
    (id: string | null) => {
      if (id === alvoAtual.current) return
      alvoAtual.current = id
      iPalavra.current = 0
      limparPalavra()
      onAlvo(id)
    },
    [limparPalavra, onAlvo],
  )

  // Sair da perícope (ou perder o alinhamento) devolve a tela ao normal.
  useEffect(() => {
    return () => {
      limparPalavra()
      alvoAtual.current = null
      onAlvo(null)
    }
  }, [ordem, limparPalavra, onAlvo])

  function aoTempo() {
    const a = audioRef.current
    if (!a || !alinhamento.length) return
    const t = a.currentTime

    const i = indiceEm(alinhamento, t, iAlvo.current)
    if (i >= 0) iAlvo.current = i
    const alvo = i >= 0 ? alinhamento[i]! : null

    if ((alvo?.id ?? null) !== alvoAtual.current) {
      trocarAlvo(alvo?.id ?? null)
      // Os spans do alvo novo só existem depois do render — o próximo
      // timeupdate marca a palavra.
      return
    }
    if (!alvo) return

    const w = indiceDaPalavra(alvo, t, iPalavra.current)
    if (w < 0) return
    iPalavra.current = w
    const el = document.querySelector<HTMLElement>(`[data-verse-id="${alvo.id}"] [data-w="${w}"]`)
    if (!el || el === spanAtual.current) return
    limparPalavra()
    el.classList.add('word-speaking')
    spanAtual.current = el
  }

  if (!src) return null
  return (
    <div className="narracao">
      <span className="narracao-rotulo">🎙️ Narração</span>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={src}
        aria-label="Narração da perícope"
        onTimeUpdate={aoTempo}
        onSeeked={aoTempo}
        onEnded={() => {
          limparPalavra()
          trocarAlvo(null)
        }}
      />
    </div>
  )
}
```

Notas para o implementador:

- `preload="metadata"` (era `"none"`): sem a duração o `<audio controls>` não
  mostra a barra, e o critério de aceite 3 é arrastar a barra. É metadado, não
  o áudio: custo de alguns KB.
- O `useEffect` de limpeza roda também quando `onAlvo` muda de identidade — daí
  a exigência de a `Leitura` passar uma referência estável (`setFalando` é
  estável; um arrow inline não é).

- [ ] **Step 2: Verificar que compila e que nada quebrou**

Run: `npx tsc -b && npx vitest run`
Expected: PASS. O `tsc` vai apontar a `Leitura`, que ainda passa só `ordem` —
**pare aqui e não conserte**: é a Task 5. Se o `tsc` falhar SÓ por isso,
registre no relatório e siga; se falhar por outro motivo, conserte.

Para não deixar a branch quebrada entre tarefas, faça o commit desta task junto
com o ajuste mínimo da chamada na `Leitura`. **Não** torne `secoes`/`onAlvo`
opcionais para calar o `tsc` — isso esconderia a fiação que falta:

```tsx
<NarracaoPlayer ordem={p.ordem} secoes={[]} onAlvo={setFalando} />
```

Com `secoes={[]}` o player toca sem realce — o comportamento de hoje — e a
Task 5 preenche os alvos de verdade.

- [ ] **Step 3: Commit**

```bash
git add src/components/NarracaoPlayer.tsx src/pages/Leitura.tsx
git commit -m "feat: player de narração dirige o realce pelo timeupdate"
```

---

### Task 5: Fiação na Leitura, realce de palavra e rolagem

**Files:**
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `SecaoAlvos` (Task 2), `NarracaoPlayer` (Task 4).
- Produces: nada para tarefas seguintes.

**O que muda, item a item:**

1. **`secoes` memoizado**, montado dos MESMOS arrays que a página renderiza —
   é isso que garante que o alinhamento valide o que o olho vê:

```tsx
const secoesNarracao = useMemo<SecaoAlvos[]>(
  () => [
    { secao: 'contexto', alvos: parasContexto.map((t, i) => ({ id: `contexto-${i}`, texto: t })) },
    {
      secao: 'texto',
      alvos: blocks
        .filter((b): b is VerseBlock => b.kind === 'verse')
        .map((b) => ({ id: b.id, texto: b.text })),
    },
    { secao: 'resenha', alvos: parasResenha.map((t, i) => ({ id: `resenha-${i}`, texto: t })) },
    {
      secao: 'reflexoes',
      alvos: (p?.perguntas_reflexao ?? []).map((q, i) => ({ id: `reflexao-${i}`, texto: q })),
    },
  ],
  [parasContexto, blocks, parasResenha, p],
)
```

2. **Componente de texto tokenizado.** Só o alvo em fala é quebrado; os outros
   seguem como nó de texto único. Os espaços viram nós de texto de verdade
   entre os spans, senão copiar o versículo grudaria as palavras.

```tsx
/**
 * Quebra em palavras só a unidade em fala — o resto da página fica com o nó de
 * texto único de sempre. O espaço entre os spans é um nó de texto real: é o
 * que faz "selecionar e copiar" continuar devolvendo o versículo legível.
 */
function TextoFalado({ texto, ativo }: { texto: string; ativo: boolean }) {
  if (!ativo) return <>{texto}</>
  return (
    <>
      {texto.split(' ').map((tk, k) => (
        <Fragment key={k}>
          {k > 0 ? ' ' : ''}
          <span data-w={k}>{tk}</span>
        </Fragment>
      ))}
    </>
  )
}
```

3. **Trocar os quatro pontos de renderização** para usá-lo:

```tsx
// contexto
<p key={i} className={falaClass('prose', `contexto-${i}`)} data-verse-id={`contexto-${i}`}>
  <TextoFalado texto={para} ativo={falando === `contexto-${i}`} />
</p>

// texto — nos DOIS layouts (corrido e por versículo)
<span className="verse-text">
  <TextoFalado texto={b.text} ativo={falando === b.id} />
</span>

// resenha
<p key={i} className={falaClass('prose', `resenha-${i}`)} data-verse-id={`resenha-${i}`}>
  <TextoFalado texto={para} ativo={falando === `resenha-${i}`} />
</p>

// reflexão
<li key={i} className={falaClass('', `reflexao-${i}`)} data-verse-id={`reflexao-${i}`}>
  <TextoFalado texto={q} ativo={falando === `reflexao-${i}`} />
</li>
```

O `aria-label` do botão de versículo não muda: ele já descreve o versículo
inteiro e, por ser `aria-label`, substitui o conteúdo para o leitor de tela —
a quebra em spans é invisível para a tecnologia assistiva.

4. **Passar os alvos ao player:**

```tsx
<NarracaoPlayer ordem={p.ordem} secoes={secoesNarracao} onAlvo={setFalando} />
```

5. **Abrir o contexto quando ele entra em fala** — realçar parágrafo escondido
   não serve para nada (o `tocar` do TTS já fazia isso):

```tsx
useEffect(() => {
  if (falando?.startsWith('contexto-')) abrirContexto()
}, [falando])
```

6. **Rolagem: a mão do usuário tem precedência.** O efeito de rolagem que já
   existe passa a respeitar um "cedeu": qualquer rolagem iniciada pelo usuário
   suspende o acompanhamento automático por 10 s. Escute `wheel`, `touchmove` e
   as teclas de rolagem — **nunca o evento `scroll`**, que o próprio
   `scrollIntoView` dispara e criaria um falso positivo que desliga o
   acompanhamento para sempre.

```tsx
const cedeuAte = useRef(0)

useEffect(() => {
  const ceder = () => {
    cedeuAte.current = Date.now() + 10_000
  }
  const tecla = (e: KeyboardEvent) => {
    if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) ceder()
  }
  window.addEventListener('wheel', ceder, { passive: true })
  window.addEventListener('touchmove', ceder, { passive: true })
  window.addEventListener('keydown', tecla)
  return () => {
    window.removeEventListener('wheel', ceder)
    window.removeEventListener('touchmove', ceder)
    window.removeEventListener('keydown', tecla)
  }
}, [])
```

e no efeito de rolagem existente, uma linha a mais na guarda:

```tsx
if (!falando || barOpen || editingId || draftRef) return
if (Date.now() < cedeuAte.current) return
```

7. **CSS do realce de palavra** — mais leve que o do versículo: o alvo é o
   contexto, a palavra é o ponteiro. Dois realces de mesmo peso competem.

```css
/* realce da PALAVRA em fala: fundo suave, sob o sublinhado da unidade — a
   unidade é o contexto, a palavra é o ponteiro; mesmo peso nos dois cansa. */
[data-w].word-speaking {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: 0.2em;
  box-shadow: 0 0 0 0.1em color-mix(in srgb, var(--accent) 18%, transparent);
}

@media (prefers-reduced-motion: no-preference) {
  [data-w].word-speaking {
    transition: background 90ms linear;
  }
}
```

- [ ] **Step 1: Aplicar as sete mudanças acima**

- [ ] **Step 2: Verificar**

Run: `npx vitest run && npx tsc -b && npm run typecheck:worker && npx oxlint`
Expected: PASS. Dois avisos do oxlint são pré-existentes e permanecem
(`scripts/enrich-preach.ts:270`, `src/pages/Leitura.tsx:292`); qualquer aviso
novo é problema seu.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: realce de versículo e palavra dirigido pela narração"
```

---

### Task 6: Remoção do TTS sintético

**Files:**
- Delete: `src/lib/tts.ts`, `src/lib/tts.test.ts`, `src/lib/tts-prefs.ts`,
  `src/lib/tts-prefs.test.ts`, `src/components/TtsMenu.tsx`
- Modify: `src/pages/Leitura.tsx`, `src/styles/app.css`,
  `docs/superpowers/backlog-pos-pacotes.md`

**Sai da `Leitura.tsx`:**

- os imports de `../lib/tts`, `../lib/tts-prefs` e `../components/TtsMenu`
- o componente local `BarraOuvir` e o tipo `FonteFala`
- os estados `ttsRef`, `ttsState`, `fonteFala`, `temTts`
- os três efeitos de TTS (criar o controller, parar ao trocar de perícope,
  zerar `fonteFala` no `idle`) e a função `tocar`
- os memos de fila: `versesParaFala`, `filaContexto`, `filaResenha`,
  `filaReflexao`, `filaTudo`
- as cinco instâncias de `<BarraOuvir …>` no JSX

**Fica, e não é para mexer:**

- `falando`/`setFalando`, `falaClass`, o ramo de fala do `verseClass` e as
  classes `verse-speaking`/`prose-speaking` — mudaram de dono na Task 5, não
  de existência
- o efeito de rolagem e o "cedeu" da Task 5
- `useWakeLock(p !== null)`: está ligado a *ter perícope aberta*, não ao TTS —
  com narração tocando ele importa mais, não menos
- `parasContexto`, `parasResenha` e `abrirContexto`, que agora servem à
  narração

**No CSS:** somem `.tts-bar` e `.ttsmenu-pop` (confirme com `grep` que nenhuma
outra regra ou componente os usa antes de apagar).

**No backlog:** os itens sobre o TTS sintético (o `onerror` que aborta a fila,
a cobertura de "play superseded") deixam de existir junto com o código. Apague
esses itens em vez de carregá-los adiante, e anote numa linha que saíram porque
o TTS sintético saiu.

- [ ] **Step 1: Apagar os arquivos e a fiação**

```bash
git rm src/lib/tts.ts src/lib/tts.test.ts src/lib/tts-prefs.ts src/lib/tts-prefs.test.ts src/components/TtsMenu.tsx
```

E editar `Leitura.tsx`, `app.css` e o backlog conforme acima.

- [ ] **Step 2: Verificar que não sobrou resquício**

```bash
grep -rn "tts\|Tts\|TTS" src/ || echo "limpo"
grep -rn "tts" docs/superpowers/backlog-pos-pacotes.md || echo "backlog limpo"
```
Expected: nenhum código vivo. (Comentários que expliquem a remoção são
aceitáveis; fiação, não.)

- [ ] **Step 3: Suíte completa**

Run: `npx vitest run && npx tsc -b && npm run typecheck:worker && npx oxlint && npm run build`
Expected: PASS. A contagem de testes cai — `tts.test.ts` e `tts-prefs.test.ts`
foram embora de propósito. Diga no relatório quantos testes saíram e quantos
ficaram.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat!: remove o TTS sintético — ouvir passa a ser só a narração"
```

---

### Task 7: Verificação no app rodando

**Files:** nenhum (a menos que a verificação encontre defeito).

Esta task é do controlador, não de um implementador: os critérios de aceite 1,
2, 3 e 8 só se verificam com o app na tela.

- [ ] **Step 1: Subir o Worker e o Vite**

```bash
npx wrangler dev --port 8787   # serve /api/audio a partir do R2
npm run dev
```

- [ ] **Step 2: Percorrer os critérios** em `/leitura/1600` (Mateus 1:1-17, que
  tem narração) e numa perícope sem narração (ex.: `/leitura/2074`):

  1. Tocar realça o versículo e a palavra, e a tela acompanha.
  2. Rolar com o dedo/roda não é revertido nos 10 s seguintes.
  3. Arrastar a barra reposiciona o realce, para frente e para trás.
  4. `2074` não mostra player, não menciona áudio e não oferece TTS.
  5. Manifesto adulterado sem `palavras` → toca sem realce, sem erro.
  6. Seção adulterada → só ela perde o realce; **`contexto` realça**.
  7. `grep -rn "tts" src/` sem código vivo.
  8. Selecionar e copiar um versículo em reprodução devolve o texto com os
     espaços certos.

- [ ] **Step 3: Console limpo.** Nenhum erro nem warning novo durante a
  reprodução inteira de uma perícope.

---

## Auto-revisão do plano

**Cobertura da spec:** contrato → T1; mapeamento por fluxo de tokens → T2;
realce e rolagem → T3+T5; realce por palavra e quebra da unidade → T5;
remoção do TTS → T6; cobertura parcial (404) → T4; os 9 critérios de aceite →
T7 (1,2,3,4,5,6,8), T6 (7) e o passo de verificação de cada task (9).

**Tipos:** `SecaoAlvos`/`Alvo` nascem na T2 e são consumidos com o mesmo nome
na T4 e na T5. `Alinhamento`/`AlvoAlinhado` nascem na T2 e são consumidos na
T3 e T4. `Manifesto` nasce na T1 e é consumido na T2 e T4.

**Ordem:** o TTS sai por último de propósito. Removê-lo antes deixaria
`setFalando` sem dono entre as tasks — código morto que o lint apanha e que o
revisor teria de julgar sem contexto.
