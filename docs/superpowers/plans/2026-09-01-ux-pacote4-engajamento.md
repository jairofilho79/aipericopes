# Pacote 4 — Engajamento e extras: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seis melhorias de engajamento e conforto, 100% no cliente: streak de dias na Home, tempo estimado de leitura, skeleton loading no lugar do "Carregando…", ouvir a perícope com TTS, tela acesa durante a leitura (wake lock) e a seção Contexto colapsável com a escolha lembrada.

**Architecture:** Nenhuma mudança no Worker, no D1 ou no esquema de sync — este pacote é inteiro cliente e o streak deriva dos registros de `progresso` que já sincronizam. Quatro módulos puros novos em `src/lib/` (`streak.ts`, `reading-time.ts`, `tts.ts`, `contexto-collapse.ts`), um hook novo (`src/lib/use-wake-lock.ts`), um componente novo de esqueletos (`src/components/Skeleton.tsx`), uma prop nova em `src/components/SectionChips.tsx` (`onIr`), e mudanças concentradas em `Leitura.tsx`, `Home.tsx`, `Indice.tsx` e `src/styles/app.css`. Toda API de plataforma (`speechSynthesis`, `wakeLock`, `matchMedia`, `localStorage`) entra por uma função de guarda testável, e o encanamento de listener/timer fica dentro de `useEffect` com cleanup completo.

**Tech Stack:** React 19, react-router-dom 7, Vitest 4 (+ happy-dom), Vite 8 + vite-plugin-pwa. Sem biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-08-31-ux-pacote4-engajamento-design.md`

## Global Constraints

- Estilo de código do repo: sem ponto-e-vírgula, aspas simples, indentação de 2 espaços, vírgula final.
- Convenções pt-BR na UI: rótulos em sentence-case, ellipsis `…` (nunca `...`), nomes de domínio em português (`Perícope`, `Anotação`, `atualizadoEm`).
- CSS plano em `src/styles/app.css` com classes kebab-case; nada de CSS Modules, CSS-in-JS ou framework.
- APIs de plataforma (`speechSynthesis`, `wakeLock`, `matchMedia`, `localStorage`, `IntersectionObserver`) nunca quebram a leitura: feature-detect na entrada (`typeof X === 'undefined'` ou `?.`), falha silenciosa (recurso simplesmente não aparece), e cleanup completo (`removeEventListener`, `clearTimeout`, `cancel()`, `release()`) em todo `useEffect`.
- `prefers-reduced-motion: reduce` é respeitado em toda animação (shimmer do esqueleto, chevron) e em toda rolagem programática (`behavior: 'auto'` no lugar de `'smooth'`).
- Testes com Vitest; arquivos que precisam de DOM levam `// @vitest-environment happy-dom` no topo e, quando tocam em `localStorage`, chamam `installLocalStorageMock()` de `./testing/storage-mock`.
- Contexto é leitura de primeira classe: o colapsável existe, mas o padrão é **ABERTO** e o chip de seção continua levando até lá (expandindo, se preciso).
- Comandos: testes `npm test`, lint `npm run lint`, typecheck do worker `npm run typecheck:worker`, build `npm run build`. A suíte parte de **137 testes verdes**; toda task termina com a suíte verde e com lint, `typecheck:worker` e build limpos.
- A checagem visual interativa (`npm run dev` + navegador) é **pré-dispensada nesta sessão headless**: onde o passo pedir verificação visual, rodar `npm run build` e registrar a descrição do que deveria ser visto.

---

### Task 1: `src/lib/streak.ts` — dias seguidos na Home

**Files:**
- Create: `src/lib/streak.ts`
- Create: `src/lib/streak.test.ts`
- Modify: `src/pages/Home.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `listAllProgresso(): Promise<Progresso[]>` de `../lib/user-db`; `type Progresso` de `./types` (`{ pericopeOrdem: number; status: ProgressoStatus; atualizadoEm: string }`).
- Produces:
  - `export function diaLocal(d: Date): string`
  - `export function diasComConclusao(progressos: Progresso[]): Set<string>`
  - `export type Streak = { atual: number; recorde: number }`
  - `export function computeStreak(dias: Set<string>, hoje: Date): Streak`
  - classes CSS `.streak`, `.streak-recorde`
  - A Task 3 volta a mexer no render de `Home.tsx` (esqueleto), mas não depende destes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/streak.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeStreak, diaLocal, diasComConclusao } from './streak'
import type { Progresso } from './types'

/** ISO como o `setProgresso` grava, ancorado numa hora LOCAL escolhida. */
function iso(y: number, m: number, d: number, hora = 12): string {
  return new Date(y, m - 1, d, hora).toISOString()
}

function concluida(ordem: number, quando: string): Progresso {
  return { pericopeOrdem: ordem, status: 'concluido', atualizadoEm: quando }
}

describe('diaLocal', () => {
  it('formata YYYY-MM-DD com zero à esquerda', () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(diaLocal(new Date(2026, 10, 30))).toBe('2026-11-30')
  })

  it('usa o dia do calendário local, não o UTC', () => {
    // 23h30 local já é o dia seguinte em boa parte dos fusos a leste; o streak
    // é do leitor, então continua sendo dia 10.
    expect(diaLocal(new Date(2026, 2, 10, 23, 30))).toBe('2026-03-10')
  })
})

describe('diasComConclusao', () => {
  it('só conta registros concluídos', () => {
    const dias = diasComConclusao([
      concluida(1, iso(2026, 8, 30)),
      { pericopeOrdem: 2, status: 'em_andamento', atualizadoEm: iso(2026, 8, 29) },
      { pericopeOrdem: 3, status: 'nao_iniciado', atualizadoEm: iso(2026, 8, 28) },
    ])
    expect([...dias]).toEqual(['2026-08-30'])
  })

  it('várias perícopes no mesmo dia viram um dia só', () => {
    const dias = diasComConclusao([
      concluida(1, iso(2026, 8, 30, 7)),
      concluida(2, iso(2026, 8, 30, 22)),
      concluida(3, iso(2026, 8, 31, 9)),
    ])
    expect(dias.size).toBe(2)
    expect(dias.has('2026-08-30')).toBe(true)
    expect(dias.has('2026-08-31')).toBe(true)
  })

  it('datas inválidas são ignoradas', () => {
    expect(diasComConclusao([concluida(1, 'ontem à noite'), concluida(2, '')]).size).toBe(0)
  })

  it('lista vazia devolve conjunto vazio', () => {
    expect(diasComConclusao([]).size).toBe(0)
  })
})

describe('computeStreak', () => {
  const HOJE = new Date(2026, 8, 1)

  it('sem dias, tudo zero', () => {
    expect(computeStreak(new Set(), HOJE)).toEqual({ atual: 0, recorde: 0 })
  })

  it('sequência terminando hoje conta até hoje', () => {
    const dias = new Set(['2026-08-30', '2026-08-31', '2026-09-01'])
    expect(computeStreak(dias, HOJE)).toEqual({ atual: 3, recorde: 3 })
  })

  it('sequência terminando ontem se mantém', () => {
    // Ainda dá tempo de ler hoje: virar a meia-noite não quebra o streak.
    expect(computeStreak(new Set(['2026-08-30', '2026-08-31']), HOJE)).toEqual({
      atual: 2,
      recorde: 2,
    })
  })

  it('pular um dia inteiro zera o atual e preserva o recorde', () => {
    const dias = new Set(['2026-08-28', '2026-08-29', '2026-08-30'])
    expect(computeStreak(dias, HOJE)).toEqual({ atual: 0, recorde: 3 })
  })

  it('recorde maior que a sequência atual aparece separado', () => {
    const dias = new Set([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-08-31',
      '2026-09-01',
    ])
    expect(computeStreak(dias, HOJE)).toEqual({ atual: 2, recorde: 5 })
  })

  it('um único dia hoje vale 1 e 1', () => {
    expect(computeStreak(new Set(['2026-09-01']), HOJE)).toEqual({ atual: 1, recorde: 1 })
  })

  it('a sequência atravessa a virada do mês', () => {
    expect(computeStreak(new Set(['2026-08-31', '2026-09-01']), HOJE)).toEqual({
      atual: 2,
      recorde: 2,
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/streak.test.ts`
Expected: FAIL — o módulo `./streak` não existe.

- [ ] **Step 3: Implementar `src/lib/streak.ts`**

Criar o arquivo com:

```ts
import type { Progresso } from './types'

/**
 * Chave de dia 'YYYY-MM-DD' no fuso LOCAL. `toISOString().slice(0, 10)` daria o
 * dia em UTC e mudaria o streak de quem lê de madrugada ou à noite.
 */
export function diaLocal(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function diaAnterior(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  const data = new Date(ano, mes - 1, d)
  // Aritmética de calendário local: `setDate` atravessa horário de verão sem
  // deslizar uma hora, coisa que subtrair 86 400 000 ms não garante.
  data.setDate(data.getDate() - 1)
  return diaLocal(data)
}

/**
 * Dias (locais) em que alguma perícope foi concluída.
 *
 * Limitação aceita e desejada: `atualizadoEm` é a última escrita do progresso,
 * então reconcluir uma perícope antiga conta para o dia de hoje — que é
 * exatamente o que "li hoje" deve significar.
 */
export function diasComConclusao(progressos: Progresso[]): Set<string> {
  const dias = new Set<string>()
  for (const p of progressos) {
    if (p.status !== 'concluido') continue
    const data = new Date(p.atualizadoEm)
    // Data inválida (registro corrompido, string vazia) não vira dia nenhum.
    if (Number.isNaN(data.getTime())) continue
    dias.add(diaLocal(data))
  }
  return dias
}

export type Streak = {
  /** Dias consecutivos terminando hoje ou ontem; 0 quando o streak quebrou. */
  atual: number
  /** Maior sequência já feita — sempre >= `atual`. */
  recorde: number
}

/**
 * `atual` termina em hoje OU ontem: concluir ainda hoje mantém a sequência, e
 * só um dia inteiro pulado quebra. `recorde` é a maior corrida histórica.
 */
export function computeStreak(dias: Set<string>, hoje: Date): Streak {
  let recorde = 0
  let corrente = 0
  let anterior: string | null = null
  for (const dia of [...dias].sort()) {
    corrente = anterior !== null && diaAnterior(dia) === anterior ? corrente + 1 : 1
    if (corrente > recorde) recorde = corrente
    anterior = dia
  }

  const hojeDia = diaLocal(hoje)
  const ontem = diaAnterior(hojeDia)
  let ponta: string | null = dias.has(hojeDia) ? hojeDia : dias.has(ontem) ? ontem : null
  let atual = 0
  while (ponta !== null && dias.has(ponta)) {
    atual += 1
    ponta = diaAnterior(ponta)
  }

  return { atual, recorde }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/streak.test.ts`
Expected: PASS — 13 testes novos neste arquivo.

- [ ] **Step 5: Mostrar o streak em `src/pages/Home.tsx`**

Trocar a linha de import de `../lib/user-db` por:

```tsx
import {
  countConcluidasNaSequencia,
  getProximaOrdemNaSequencia,
  listAllProgresso,
} from '../lib/user-db'
```

Acrescentar o import do módulo logo depois:

```tsx
import { computeStreak, diasComConclusao, type Streak } from '../lib/streak'
```

Dentro do componente, logo depois de `const [err, setErr] = useState('')`:

```tsx
  const [streak, setStreak] = useState<Streak>({ atual: 0, recorde: 0 })
```

Dentro do efeito, logo depois de `setTracks(built)`:

```tsx
        // Deriva do progresso que já sincroniza entre aparelhos — nenhuma
        // entidade nova, e o streak segue o usuário para o celular novo.
        setStreak(computeStreak(diasComConclusao(await listAllProgresso()), new Date()))
```

E no JSX, logo depois do `<p className="lead">…</p>` e antes de `<div className="track-grid">`:

```tsx
      {streak.atual > 0 && (
        <p className="streak">
          <span aria-hidden>🔥</span>{' '}
          <strong>{streak.atual === 1 ? '1 dia seguido' : `${streak.atual} dias seguidos`}</strong>
          {streak.recorde > streak.atual && (
            <span className="streak-recorde"> · recorde: {streak.recorde}</span>
          )}
        </p>
      )}
```

(quando `atual === 0` não aparece nada: a Home não cobra ninguém.)

- [ ] **Step 6: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.lead { ... }`:

```css
.streak {
  font-family: var(--font-ui);
  font-size: 0.95rem;
  color: var(--ink);
  margin: -0.55rem 0 1.15rem;
}

.streak-recorde {
  color: var(--muted);
}
```

- [ ] **Step 7: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 137 antigos + 13 novos = 150 testes; lint, typecheck do worker e build sem erro.

- [ ] **Step 8: Verificação visual (pré-dispensada)**

O que deveria ser visto: na Home, entre o parágrafo de abertura e os dois cards, aparece "🔥 **3 dias seguidos**" quando houve conclusão hoje ou ontem e nos dias anteriores em sequência; com exatamente um dia lê-se "🔥 **1 dia seguido**"; se o recorde histórico for maior, vem " · recorde: 12" em cinza logo ao lado; quem nunca concluiu nada, ou quem quebrou a sequência ontem, não vê linha nenhuma.

- [ ] **Step 9: Commit**

```bash
git add src/lib/streak.ts src/lib/streak.test.ts src/pages/Home.tsx src/styles/app.css
git commit -m "feat: streak de dias seguidos na home"
```

---

### Task 2: `src/lib/reading-time.ts` — tempo estimado de leitura

**Files:**
- Create: `src/lib/reading-time.ts`
- Create: `src/lib/reading-time.test.ts`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes (Task 1): o `Track` de `Home.tsx`, que ganha o campo `minutos`.
- Produces:
  - `export const WPM = 180`
  - `export function contarPalavras(texto: string): number`
  - `export function readingMinutes(texto: string): number`
  - classe CSS `.ref-min`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/reading-time.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { contarPalavras, readingMinutes, WPM } from './reading-time'

/** Texto sintético com exatamente `n` palavras. */
function palavras(n: number): string {
  return Array.from({ length: n }, (_, i) => `p${i}`).join(' ')
}

describe('contarPalavras', () => {
  it('conta palavras separadas por espaço, tabulação e quebra de linha', () => {
    expect(contarPalavras('Capítulo 1\n1 No princípio\tDeus')).toBe(6)
  })

  it('espaços repetidos e bordas não viram palavras', () => {
    expect(contarPalavras('  Deus   criou  ')).toBe(2)
  })

  it('texto vazio ou só espaços conta zero', () => {
    expect(contarPalavras('')).toBe(0)
    expect(contarPalavras('   \n  ')).toBe(0)
  })
})

describe('readingMinutes', () => {
  it('texto vazio ainda vale 1 minuto', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('   ')).toBe(1)
  })

  it('180 palavras dão 1 minuto e 360 dão 2', () => {
    expect(readingMinutes(palavras(WPM))).toBe(1)
    expect(readingMinutes(palavras(WPM * 2))).toBe(2)
  })

  it('arredonda para o minuto mais próximo', () => {
    expect(readingMinutes(palavras(270))).toBe(2)
    expect(readingMinutes(palavras(260))).toBe(1)
  })

  it('texto curto nunca desce de 1 minuto', () => {
    expect(readingMinutes('No princípio, Deus criou os céus e a terra.')).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/reading-time.test.ts`
Expected: FAIL — o módulo `./reading-time` não existe.

- [ ] **Step 3: Implementar `src/lib/reading-time.ts`**

Criar o arquivo com:

```ts
/**
 * Palavras por minuto de leitura devocional. Mais lento que a leitura de tela
 * comum (~240 wpm) de propósito: texto bíblico se lê com pausa, e um número
 * otimista demais frustra mais do que ajuda.
 */
export const WPM = 180

/**
 * Contagem simples por espaços em branco. Os marcadores "Capítulo N" e os
 * números de versículo entram na conta — são poucos e o arredondamento come a
 * diferença.
 */
export function contarPalavras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length
}

/** Minutos inteiros, nunca menos de 1: "~0 min" não diz nada a ninguém. */
export function readingMinutes(texto: string): number {
  return Math.max(1, Math.round(contarPalavras(texto) / WPM))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/reading-time.test.ts`
Expected: PASS — 7 testes novos neste arquivo.

- [ ] **Step 5: Mostrar o tempo em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `../lib/paragraphize`:

```tsx
import { readingMinutes } from '../lib/reading-time'
```

Dentro do componente, logo depois do `useMemo` de `selecionados`:

```tsx
  // Só o texto bíblico entra na conta: contexto, resenha e reflexão são
  // leitura de primeira classe, mas o "~N min" é do texto da NAA.
  const minutos = useMemo(() => (p ? readingMinutes(p.texto_naa) : 1), [p])
```

Trocar a linha da referência dentro de `.ref-row` por:

```tsx
        <p className="ref">
          {refLabel(p)} · <span className="ref-min">~{minutos} min</span>
        </p>
```

- [ ] **Step 6: Mostrar o tempo no card da Home em `src/pages/Home.tsx`**

Acrescentar o import logo depois do import de `../lib/content`:

```tsx
import { readingMinutes } from '../lib/reading-time'
```

Acrescentar o campo ao tipo `Track`:

```tsx
type Track = {
  testament: Testament
  peri: Pericope
  done: number
  total: number
  allDone: boolean
  minutos: number
}
```

Trocar o `built.push({ ... })` do efeito por:

```tsx
          built.push({
            testament,
            peri,
            done,
            total: ordens.length,
            allDone: done >= ordens.length,
            minutos: readingMinutes(peri.texto_naa),
          })
```

E a linha de referência do card por:

```tsx
            <p className="ref">
              {refLabel(t.peri)} · ~{t.minutos} min
            </p>
```

- [ ] **Step 7: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.ref-row .ref { ... }`:

```css
.ref-min {
  white-space: nowrap;
}
```

- [ ] **Step 8: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 150 antigos + 7 novos = 157 testes; lint, typecheck do worker e build sem erro.

- [ ] **Step 9: Verificação visual (pré-dispensada)**

O que deveria ser visto: na leitura, sob o título, a linha de referência lê "Gênesis 1:1–2:3 · ~4 min", com o "~4 min" nunca quebrando no meio; no card de cada trilha da Home a referência ganha o mesmo sufixo; uma perícope de dois versículos mostra "~1 min".

- [ ] **Step 10: Commit**

```bash
git add src/lib/reading-time.ts src/lib/reading-time.test.ts src/pages/Leitura.tsx src/pages/Home.tsx src/styles/app.css
git commit -m "feat: tempo estimado de leitura na leitura e na home"
```

---

### Task 3: Skeleton loading em Leitura, Home e Índice

**Files:**
- Create: `src/components/Skeleton.tsx`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Indice.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes (Task 2): os returns antecipados `if (!p) return …` de `Leitura.tsx` e `if (!tracks.length) return …` de `Home.tsx`.
- Produces:
  - `export function SkeletonLeitura()` — componente sem props
  - `export function SkeletonHome()` — componente sem props
  - `export function SkeletonIndice()` — componente sem props
  - estado `carregando: boolean` em `Indice.tsx`
  - classes CSS `.skeleton`, `.skeleton-page`, `.skeleton-line`, `.skeleton-title`, `.skeleton-subtitle`, `.skeleton-crumb`, `.skeleton-ref`, `.skeleton-cta`, `.skeleton-block` e o keyframe `skeleton-shimmer`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Criar `src/components/Skeleton.tsx`**

Criar o arquivo com:

```tsx
/**
 * Silhuetas cinza com shimmer enquanto o conteúdo não chega. A primeira visita
 * baixa ~13 MiB de `pericopes.json`: é este esqueleto que o leitor vê nesse
 * intervalo (nas visitas seguintes o cache torna a troca instantânea).
 *
 * O shimmer é pura decoração — quem usa leitor de tela recebe o `role="status"`
 * com o rótulo — e o CSS desliga a animação sob `prefers-reduced-motion`.
 */

function Linhas({ n, curta = false }: { n: number; curta?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="skeleton skeleton-line"
          style={curta && i === n - 1 ? { width: '62%' } : undefined}
        />
      ))}
    </>
  )
}

export function SkeletonLeitura() {
  return (
    <article className="leitura skeleton-page" role="status" aria-label="Carregando a perícope…">
      <span className="skeleton skeleton-crumb" />
      <span className="skeleton skeleton-title" />
      <span className="skeleton skeleton-ref" />
      <div className="skeleton-block">
        <Linhas n={2} curta />
      </div>
      <div className="skeleton-block">
        <Linhas n={2} curta />
      </div>
      <div className="skeleton-block">
        <Linhas n={6} curta />
      </div>
    </article>
  )
}

export function SkeletonHome() {
  return (
    <section className="home skeleton-page" role="status" aria-label="Carregando as leituras…">
      <span className="skeleton skeleton-title" />
      <div className="track-grid">
        {[0, 1].map((i) => (
          <article key={i} className="track-card">
            <Linhas n={3} curta />
            <span className="skeleton skeleton-cta" />
          </article>
        ))}
      </div>
    </section>
  )
}

export function SkeletonIndice() {
  return (
    <div className="skeleton-page" role="status" aria-label="Carregando o índice…">
      {[0, 1, 2].map((g) => (
        <div key={g} className="skeleton-block">
          <span className="skeleton skeleton-subtitle" />
          <Linhas n={4} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.streak-recorde { ... }` (Task 1):

```css
/* esqueletos: a silhueta da página enquanto o JSON grande não chega */
.skeleton-page {
  /* nada aqui recebe seleção: é rascunho visual, não conteúdo */
  user-select: none;
}

.skeleton {
  display: block;
  border-radius: 6px;
  background-color: var(--line);
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--paper) 65%, transparent) 50%,
    transparent 100%
  );
  background-repeat: no-repeat;
  background-size: 60% 100%;
  background-position: -120% 0;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  to {
    background-position: 220% 0;
  }
}

.skeleton-line {
  height: 0.85rem;
  margin: 0 0 0.55rem;
}

.skeleton-title {
  height: 1.9rem;
  width: 78%;
  margin: 0.4rem 0 0.6rem;
}

.skeleton-subtitle {
  height: 1.1rem;
  width: 40%;
  margin: 0 0 0.7rem;
}

.skeleton-crumb {
  height: 0.75rem;
  width: 45%;
  margin: 0 0 0.75rem;
}

.skeleton-ref {
  height: 0.8rem;
  width: 32%;
  margin: 0 0 1.3rem;
}

.skeleton-cta {
  height: 2.75rem;
  margin-top: 0.9rem;
  border-radius: 999px;
}

.skeleton-block {
  margin: 1.35rem 0;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background-image: none;
  }
}
```

- [ ] **Step 3: Usar o esqueleto em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `SectionChips`:

```tsx
import { SkeletonLeitura } from '../components/Skeleton'
```

Trocar a linha do return antecipado por:

```tsx
  if (!p) return <SkeletonLeitura />
```

- [ ] **Step 4: Usar o esqueleto em `src/pages/Home.tsx`**

Acrescentar o import logo depois do import de `react-router-dom`:

```tsx
import { SkeletonHome } from '../components/Skeleton'
```

Trocar a linha do return antecipado por:

```tsx
  if (!tracks.length) return <SkeletonHome />
```

- [ ] **Step 5: Usar o esqueleto em `src/pages/Indice.tsx`**

Acrescentar o import logo depois do import de `react-router-dom`:

```tsx
import { SkeletonIndice } from '../components/Skeleton'
```

Acrescentar o estado logo depois de `const [todas, setTodas] = useState<Pericope[]>([])`:

```tsx
  const [carregando, setCarregando] = useState(true)
```

Trocar o primeiro `useEffect` (o das três chamadas soltas) por:

```tsx
  useEffect(() => {
    let vivo = true
    Promise.all([listLivros(), doneSet(), loadPericopes()])
      .then(([ls, feitas, tudo]) => {
        if (!vivo) return
        setLivros(ls)
        setDone(feitas)
        setTodas(tudo)
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])
```

E trocar a abertura do ternário de render, `      {livro || q ? (`, por:

```tsx
      {carregando ? (
        <SkeletonIndice />
      ) : livro || q ? (
```

(o `)}` final do ternário continua fechando os três ramos: nada mais muda no JSX.)

- [ ] **Step 6: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 157 testes (nenhum novo nesta task); lint, typecheck do worker e build sem erro.

- [ ] **Step 7: Verificação visual (pré-dispensada)**

O que deveria ser visto na primeira carga sem cache (rede lenta): a Home mostra um bloco de título e dois cards com três linhas cinza e um botão cinza, todos com um brilho suave percorrendo da esquerda para a direita; a leitura mostra migalha, título largo, referência curta, dois parágrafos de duas linhas e um bloco de seis linhas, com a última linha de cada bloco mais curta; o Índice mostra três grupos de subtítulo + quatro linhas; nada disso pisca "Carregando…" em texto; com o sistema em "reduzir movimento" os blocos ficam cinza parados, sem shimmer; recarregando com cache quente a troca é imediata.

- [ ] **Step 8: Commit**

```bash
git add src/components/Skeleton.tsx src/pages/Leitura.tsx src/pages/Home.tsx src/pages/Indice.tsx src/styles/app.css
git commit -m "feat: skeleton loading na leitura, na home e no índice"
```

---

### Task 4: `src/lib/tts.ts` — ouvir a perícope

**Files:**
- Create: `src/lib/tts.ts`
- Create: `src/lib/tts.test.ts`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes (Task 3): `blocks` (`TextoBlock[]`) e `verseClass(base, id)` de `Leitura.tsx`; `type VerseBlock` de `../lib/parse-texto`; o atributo `data-verse-id` já presente nos dois modos de render (pacote 3).
- Produces:
  - `export type TtsState = 'idle' | 'playing' | 'paused'`
  - `export type TtsVerse = { id: string; text: string }`
  - `export type TtsController = { play(verses: TtsVerse[]): void; pause(): void; resume(): void; stop(): void }`
  - `export function ttsSupported(): boolean`
  - `export function montarFila(verses: TtsVerse[]): TtsVerse[]`
  - `export function escolherVoz<T extends { lang: string }>(vozes: T[]): T | null`
  - `export function createTtsController(opts: { onVerse?: (verseId: string | null) => void; onState?: (s: TtsState) => void }): TtsController`
  - classes CSS `.tts-bar`, `.verse-speaking`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/tts.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTtsController,
  escolherVoz,
  montarFila,
  ttsSupported,
  type TtsState,
} from './tts'

type VozFalsa = { lang: string; name: string }

class FakeUtterance {
  text: string
  lang = ''
  voice: VozFalsa | null = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

class FakeSynth {
  fila: FakeUtterance[] = []
  cancelou = 0
  pausou = 0
  retomou = 0
  vozes: VozFalsa[] = []
  ouvintes: (() => void)[] = []

  getVoices() {
    return this.vozes
  }

  speak(u: FakeUtterance) {
    this.fila.push(u)
  }

  cancel() {
    this.cancelou += 1
    this.fila = []
  }

  pause() {
    this.pausou += 1
  }

  resume() {
    this.retomou += 1
  }

  addEventListener(tipo: string, fn: () => void) {
    if (tipo === 'voiceschanged') this.ouvintes.push(fn)
  }

  removeEventListener(tipo: string, fn: () => void) {
    if (tipo === 'voiceschanged') this.ouvintes = this.ouvintes.filter((f) => f !== fn)
  }

  /** Simula o browser resolvendo as vozes tarde (quirk conhecido do iOS). */
  emitirVoiceschanged() {
    for (const fn of [...this.ouvintes]) fn()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ttsSupported', () => {
  it('sem speechSynthesis no ambiente, não há TTS', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    vi.stubGlobal('SpeechSynthesisUtterance', undefined)
    expect(ttsSupported()).toBe(false)
  })

  it('com speechSynthesis e utterance, há TTS', () => {
    vi.stubGlobal('speechSynthesis', new FakeSynth())
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    expect(ttsSupported()).toBe(true)
  })
})

describe('escolherVoz', () => {
  it('prefere pt-BR quando existe', () => {
    const voz = escolherVoz([
      { lang: 'en-US', name: 'Alex' },
      { lang: 'pt-PT', name: 'Joana' },
      { lang: 'pt-BR', name: 'Luciana' },
    ])
    expect(voz?.name).toBe('Luciana')
  })

  it('cai em qualquer português quando não há pt-BR', () => {
    const voz = escolherVoz([
      { lang: 'en-US', name: 'Alex' },
      { lang: 'pt-PT', name: 'Joana' },
    ])
    expect(voz?.name).toBe('Joana')
  })

  it('sem voz portuguesa devolve null (deixa a padrão do sistema)', () => {
    expect(escolherVoz([{ lang: 'en-US', name: 'Alex' }])).toBeNull()
  })

  it('lista vazia devolve null', () => {
    expect(escolherVoz([])).toBeNull()
  })
})

describe('montarFila', () => {
  it('mantém a ordem da página e apara o texto', () => {
    expect(
      montarFila([
        { id: '1:1', text: '  No princípio…  ' },
        { id: '1:2', text: 'A terra…' },
      ]),
    ).toEqual([
      { id: '1:1', text: 'No princípio…' },
      { id: '1:2', text: 'A terra…' },
    ])
  })

  it('descarta versículos sem texto ou sem id', () => {
    expect(
      montarFila([
        { id: '1:1', text: '   ' },
        { id: '', text: 'órfão' },
        { id: '1:2', text: 'A terra…' },
      ]),
    ).toEqual([{ id: '1:2', text: 'A terra…' }])
  })

  it('lista vazia devolve fila vazia', () => {
    expect(montarFila([])).toEqual([])
  })
})

describe('createTtsController', () => {
  let synth: FakeSynth
  let estados: TtsState[]
  let versiculos: (string | null)[]

  beforeEach(() => {
    vi.useFakeTimers()
    synth = new FakeSynth()
    estados = []
    versiculos = []
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function controlador() {
    return createTtsController({
      onVerse: (id) => versiculos.push(id),
      onState: (s) => estados.push(s),
    })
  }

  it('play enfileira uma fala por versículo com a voz pt-BR', () => {
    synth.vozes = [
      { lang: 'en-US', name: 'Alex' },
      { lang: 'pt-BR', name: 'Luciana' },
    ]
    const ctrl = controlador()
    ctrl.play([
      { id: '1:1', text: 'No princípio…' },
      { id: '1:2', text: 'A terra…' },
    ])
    expect(synth.fila.map((u) => u.text)).toEqual(['No princípio…', 'A terra…'])
    expect(synth.fila[0].lang).toBe('pt-BR')
    expect(synth.fila[0].voice?.name).toBe('Luciana')
    expect(estados).toEqual(['playing'])
    ctrl.stop()
  })

  it('onstart marca o versículo e o fim da fila volta para idle', () => {
    synth.vozes = [{ lang: 'pt-BR', name: 'Luciana' }]
    const ctrl = controlador()
    ctrl.play([
      { id: '1:1', text: 'No princípio…' },
      { id: '1:2', text: 'A terra…' },
    ])
    const [u1, u2] = synth.fila
    u1.onstart?.()
    u2.onstart?.()
    u2.onend?.()
    expect(versiculos).toEqual(['1:1', '1:2', null])
    expect(estados).toEqual(['playing', 'idle'])
  })

  it('sem vozes no play, enfileira quando o browser avisa voiceschanged', () => {
    synth.vozes = []
    const ctrl = controlador()
    ctrl.play([{ id: '1:1', text: 'No princípio…' }])
    expect(synth.fila).toHaveLength(0)
    synth.vozes = [{ lang: 'pt-BR', name: 'Luciana' }]
    synth.emitirVoiceschanged()
    expect(synth.fila).toHaveLength(1)
    expect(synth.fila[0].voice?.name).toBe('Luciana')
    expect(synth.ouvintes).toHaveLength(0)
    ctrl.stop()
  })

  it('sem voiceschanged, o timeout de segurança fala com a voz padrão', () => {
    synth.vozes = []
    const ctrl = controlador()
    ctrl.play([{ id: '1:1', text: 'No princípio…' }])
    expect(synth.fila).toHaveLength(0)
    vi.advanceTimersByTime(250)
    expect(synth.fila).toHaveLength(1)
    expect(synth.fila[0].voice).toBeNull()
    expect(synth.fila[0].lang).toBe('pt-BR')
    ctrl.stop()
  })

  it('stop cancela a fila e limpa o realce', () => {
    synth.vozes = [{ lang: 'pt-BR', name: 'Luciana' }]
    const ctrl = controlador()
    ctrl.play([{ id: '1:1', text: 'No princípio…' }])
    synth.fila[0].onstart?.()
    // O próprio play já cancela o que houvesse antes: zera para medir o stop.
    synth.cancelou = 0
    ctrl.stop()
    expect(synth.cancelou).toBe(1)
    expect(versiculos.at(-1)).toBeNull()
    expect(estados.at(-1)).toBe('idle')
  })

  it('pause e resume trocam o estado e mandam no synth', () => {
    synth.vozes = [{ lang: 'pt-BR', name: 'Luciana' }]
    const ctrl = controlador()
    ctrl.play([{ id: '1:1', text: 'No princípio…' }])
    ctrl.pause()
    expect(synth.pausou).toBe(1)
    expect(estados.at(-1)).toBe('paused')
    ctrl.resume()
    expect(synth.retomou).toBe(1)
    expect(estados.at(-1)).toBe('playing')
    ctrl.stop()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: FAIL — o módulo `./tts` não existe.

- [ ] **Step 3: Implementar `src/lib/tts.ts`**

Criar o arquivo com:

```ts
export type TtsState = 'idle' | 'playing' | 'paused'

export type TtsVerse = { id: string; text: string }

export type TtsController = {
  play(verses: TtsVerse[]): void
  pause(): void
  resume(): void
  stop(): void
}

/** Sem `speechSynthesis` os controles nem aparecem — nunca um erro visível. */
export function ttsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  )
}

/** Fila de fala: um item por versículo com texto, na ordem da página. */
export function montarFila(verses: TtsVerse[]): TtsVerse[] {
  const fila: TtsVerse[] = []
  for (const v of verses) {
    const text = v.text.trim()
    if (!v.id || !text) continue
    fila.push({ id: v.id, text })
  }
  return fila
}

/**
 * pt-BR primeiro, qualquer português depois, `null` por último — `null` quer
 * dizer "deixa a voz padrão do sistema", que é melhor do que falar português
 * com voz inglesa.
 */
export function escolherVoz<T extends { lang: string }>(vozes: T[]): T | null {
  const norm = (lang: string) => (lang ?? '').toLowerCase().replace('_', '-')
  return (
    vozes.find((v) => norm(v.lang) === 'pt-br') ??
    vozes.find((v) => norm(v.lang).startsWith('pt')) ??
    null
  )
}

/** Quanto esperar pelo `voiceschanged` antes de falar com a voz padrão. */
const ESPERA_VOZES_MS = 250

export function createTtsController(opts: {
  onVerse?: (verseId: string | null) => void
  onState?: (s: TtsState) => void
}): TtsController {
  let fila: TtsVerse[] = []
  // Sessão de fala corrente: callbacks de utterances já canceladas conferem
  // este sinalizador antes de mexer na UI.
  let vivo = false
  let onVozes: (() => void) | null = null
  let timerVozes = 0

  const synth = () => (ttsSupported() ? window.speechSynthesis : null)
  const marcar = (id: string | null) => opts.onVerse?.(id)
  const emitir = (s: TtsState) => opts.onState?.(s)

  function soltarVozes() {
    const s = synth()
    if (onVozes && s) s.removeEventListener('voiceschanged', onVozes)
    onVozes = null
    if (timerVozes) {
      window.clearTimeout(timerVozes)
      timerVozes = 0
    }
  }

  function encerrar(avisar: boolean) {
    vivo = false
    fila = []
    soltarVozes()
    synth()?.cancel()
    if (avisar) {
      marcar(null)
      emitir('idle')
    }
  }

  function enfileirar(voz: SpeechSynthesisVoice | null) {
    const s = synth()
    if (!s) return
    const Utterance = window.SpeechSynthesisUtterance
    const total = fila.length
    fila.forEach((v, i) => {
      const u = new Utterance(v.text)
      u.lang = 'pt-BR'
      if (voz) u.voice = voz
      u.onstart = () => {
        if (vivo) marcar(v.id)
      }
      u.onend = () => {
        // Fim da fila: `stop` implícito, sem o leitor precisar apertar nada.
        if (vivo && i === total - 1) encerrar(true)
      }
      u.onerror = () => {
        // Voz que falha no meio (ou aba suspensa) some em silêncio.
        if (vivo) encerrar(true)
      }
      s.speak(u)
    })
  }

  function play(verses: TtsVerse[]) {
    const s = synth()
    if (!s) return
    encerrar(false)
    fila = montarFila(verses)
    if (!fila.length) return
    vivo = true
    emitir('playing')

    const vozes = s.getVoices()
    if (vozes.length) {
      enfileirar(escolherVoz(vozes))
      return
    }

    // Quirk conhecido do iOS/Chrome: `getVoices()` volta vazio até o browser
    // resolver a lista. A voz é resolvida AQUI, no play, nunca no mount.
    onVozes = () => {
      soltarVozes()
      if (!vivo) return
      enfileirar(escolherVoz(s.getVoices()))
    }
    s.addEventListener('voiceschanged', onVozes)
    // Rede de segurança: browser que nunca dispara o evento ainda fala, só que
    // com a voz padrão do sistema.
    timerVozes = window.setTimeout(() => {
      if (!vivo || !onVozes) return
      soltarVozes()
      enfileirar(escolherVoz(s.getVoices()))
    }, ESPERA_VOZES_MS)
  }

  return {
    play,
    pause() {
      const s = synth()
      if (!s || !vivo) return
      s.pause()
      emitir('paused')
    },
    resume() {
      const s = synth()
      if (!s || !vivo) return
      s.resume()
      emitir('playing')
    },
    stop() {
      encerrar(true)
    },
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: PASS — 15 testes novos neste arquivo.

- [ ] **Step 5: Ligar os controles em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `../lib/reading-time`:

```tsx
import { createTtsController, ttsSupported, type TtsController, type TtsState } from '../lib/tts'
```

Dentro do componente, logo depois de `const vAplicado = useRef<string | null>(null)`:

```tsx
  const ttsRef = useRef<TtsController | null>(null)
  const [ttsState, setTtsState] = useState<TtsState>('idle')
  const [falando, setFalando] = useState<string | null>(null)
  // Uma vez só: a capacidade do browser não muda no meio da sessão.
  const [temTts] = useState(() => ttsSupported())
```

Logo depois do `useMemo` de `minutos` (Task 2), acrescentar a fila de fala:

```tsx
  const versesParaFala = useMemo(
    () =>
      blocks
        .filter((b): b is VerseBlock => b.kind === 'verse')
        .map((b) => ({ id: b.id, text: b.text })),
    [blocks],
  )
```

Logo depois da chamada de `useKeyboardNav`, acrescentar os três efeitos:

```tsx
  useEffect(() => {
    if (!temTts) return
    const ctrl = createTtsController({ onVerse: setFalando, onState: setTtsState })
    ttsRef.current = ctrl
    return () => {
      // Sair da leitura cala a fala: nada de voz órfã lendo o que já saiu da tela.
      ctrl.stop()
      ttsRef.current = null
    }
  }, [temTts])

  useEffect(() => {
    // Trocar de perícope também para: continuar lendo o texto anterior sobre a
    // página nova seria desorientador.
    return () => ttsRef.current?.stop()
  }, [ordem])

  useEffect(() => {
    if (!falando) return
    const el = document.querySelector<HTMLElement>(`[data-verse-id="${falando}"]`)
    if (!el) return
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    el.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' })
  }, [falando])
```

Acrescentar o realce em `verseClass` — trocar a função inteira por:

```tsx
  function verseClass(base: string, id: string): string {
    const cor = destaques.get(id)
    const foco = selecionadosIds.has(id) ? ' verse-focus' : ''
    const fala = falando === id ? ' verse-speaking' : ''
    return `${base}${foco}${fala}${cor ? ` verse-hl-${cor}` : ''}`
  }
```

E acrescentar a barra de controles logo depois de `<h2>Texto (NAA)</h2>`:

```tsx
        {temTts && (
          <div className="tts-bar">
            {ttsState === 'idle' ? (
              <button
                type="button"
                className="read-tool"
                aria-label="Ouvir a perícope em voz alta"
                onClick={() => ttsRef.current?.play(versesParaFala)}
              >
                ▶ Ouvir
              </button>
            ) : (
              <>
                {ttsState === 'playing' ? (
                  <button
                    type="button"
                    className="read-tool active"
                    aria-label="Pausar a leitura em voz alta"
                    onClick={() => ttsRef.current?.pause()}
                  >
                    ⏸ Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="read-tool active"
                    aria-label="Retomar a leitura em voz alta"
                    onClick={() => ttsRef.current?.resume()}
                  >
                    ▶ Retomar
                  </button>
                )}
                <button
                  type="button"
                  className="read-tool"
                  aria-label="Parar a leitura em voz alta"
                  onClick={() => ttsRef.current?.stop()}
                >
                  ⏹
                </button>
              </>
            )}
          </div>
        )}
```

- [ ] **Step 6: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.verse-focus { ... }`:

```css
.tts-bar {
  display: flex;
  gap: 0.35rem;
  margin: -0.3rem 0 0.7rem;
}

/* realce da fala: sublinhado discreto, distinto do foco (fundo) e dos
   destaques de cor — os três podem coexistir no mesmo versículo. */
.verse.verse-speaking,
.verse-inline.verse-speaking {
  box-shadow: inset 0 -0.12em 0 var(--accent);
  border-radius: 4px;
}
```

- [ ] **Step 7: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 157 antigos + 15 novos = 172 testes; lint, typecheck do worker e build sem erro.

- [ ] **Step 8: Verificação visual (pré-dispensada)**

O que deveria ser visto num aparelho com voz pt instalada: sob "Texto (NAA)" aparece o botão "▶ Ouvir"; tocando nele a leitura começa em português e o botão vira "⏸ Pausar" ao lado de "⏹"; o versículo em reprodução ganha um sublinhado na cor de destaque e a página rola suavemente para centralizá-lo, versículo a versículo; "⏸ Pausar" congela a fala e vira "▶ Retomar"; "⏹" para tudo e o sublinhado some; ao terminar o último versículo a barra volta sozinha para "▶ Ouvir"; navegar para outra perícope (seta, swipe ou link) cala a voz na hora; num browser sem `speechSynthesis` a barra não existe e nada quebra; com "reduzir movimento" a rolagem do versículo é instantânea.

- [ ] **Step 9: Commit**

```bash
git add src/lib/tts.ts src/lib/tts.test.ts src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: ouvir a perícope em voz alta com realce do versículo"
```

---

### Task 5: `src/lib/use-wake-lock.ts` — tela acesa durante a leitura

**Files:**
- Create: `src/lib/use-wake-lock.ts`
- Create: `src/lib/use-wake-lock.test.ts`
- Modify: `src/pages/Leitura.tsx`

**Interfaces:**
- Consumes (Task 4): o estado `p` de `Leitura.tsx` (a página só pede o lock com perícope carregada).
- Produces:
  - `export type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> }`
  - `export type WakeLockLike = { request: (tipo: 'screen') => Promise<WakeLockSentinelLike> }`
  - `export function wakeLockDe(nav: Navigator | undefined): WakeLockLike | null`
  - `export function wakeLockSupported(nav: Navigator | undefined): boolean`
  - `export function useWakeLock(enabled: boolean): void`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/use-wake-lock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { wakeLockDe, wakeLockSupported } from './use-wake-lock'

/** Navigator sintético: só o que o guard olha. */
function nav(forma: unknown): Navigator {
  return forma as Navigator
}

describe('wakeLockSupported', () => {
  it('navigator ausente não suporta', () => {
    expect(wakeLockSupported(undefined)).toBe(false)
  })

  it('navigator sem wakeLock não suporta', () => {
    expect(wakeLockSupported(nav({}))).toBe(false)
  })

  it('wakeLock sem request não suporta', () => {
    expect(wakeLockSupported(nav({ wakeLock: {} }))).toBe(false)
  })

  it('wakeLock com request suporta e é devolvido por wakeLockDe', () => {
    const wakeLock = { request: async () => ({ released: false, release: async () => {} }) }
    expect(wakeLockSupported(nav({ wakeLock }))).toBe(true)
    expect(wakeLockDe(nav({ wakeLock }))).toBe(wakeLock)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/use-wake-lock.test.ts`
Expected: FAIL — o módulo `./use-wake-lock` não existe.

- [ ] **Step 3: Implementar `src/lib/use-wake-lock.ts`**

Criar o arquivo com:

```ts
import { useEffect } from 'react'

export type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
}

export type WakeLockLike = {
  request: (tipo: 'screen') => Promise<WakeLockSentinelLike>
}

/**
 * A Wake Lock API só existe em contexto seguro e em parte dos browsers — o
 * acesso passa por `unknown` de propósito, para o guard valer igual em
 * ambientes cuja `lib.dom` não declara `navigator.wakeLock`.
 */
export function wakeLockDe(nav: Navigator | undefined): WakeLockLike | null {
  const wl = (nav as unknown as { wakeLock?: WakeLockLike } | undefined)?.wakeLock
  return wl && typeof wl.request === 'function' ? wl : null
}

export function wakeLockSupported(nav: Navigator | undefined): boolean {
  return wakeLockDe(nav) !== null
}

/**
 * Mantém a tela acesa enquanto `enabled` e o documento visível. O sistema solta
 * o lock ao minimizar, então o hook re-adquire em `visibilitychange`. Todo erro
 * (`NotAllowedError` em modo de economia de bateria, aba em segundo plano, API
 * ausente) morre em silêncio: no pior caso a tela apaga como sempre apagou.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const wl = wakeLockDe(typeof navigator === 'undefined' ? undefined : navigator)
    if (!wl) return

    let vivo = true
    let sentinel: WakeLockSentinelLike | null = null

    const soltar = (s: WakeLockSentinelLike | null) => {
      if (s && !s.released) void s.release().catch(() => undefined)
    }

    const pedir = async () => {
      if (!vivo || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      try {
        const novo = await wl.request('screen')
        // O efeito pode ter sido limpo enquanto a promessa estava no ar.
        if (!vivo) {
          soltar(novo)
          return
        }
        sentinel = novo
      } catch {
        sentinel = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', onVisibility)
      const atual = sentinel
      sentinel = null
      soltar(atual)
    }
  }, [enabled])
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/use-wake-lock.test.ts`
Expected: PASS — 4 testes novos neste arquivo.

- [ ] **Step 5: Ligar o hook em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `../lib/tts`:

```tsx
import { useWakeLock } from '../lib/use-wake-lock'
```

Logo depois da chamada de `useKeyboardNav` e antes dos efeitos de TTS, acrescentar:

```tsx
  // Ler é o caso de uso: com a perícope aberta a tela fica acesa, sem toggle.
  useWakeLock(p !== null)
```

- [ ] **Step 6: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 172 antigos + 4 novos = 176 testes; lint, typecheck do worker e build sem erro.

- [ ] **Step 7: Verificação visual (pré-dispensada)**

O que deveria ser visto num aparelho: com uma perícope aberta e o dedo parado, a tela não apaga no tempo normal de bloqueio; sair para a Home ou para o Índice devolve o comportamento padrão (a tela apaga); minimizar o app e voltar mantém a tela acesa de novo (o lock é re-adquirido); com economia de bateria ligada a página funciona igual, sem aviso nenhum, só sem manter a tela; num browser sem a API nada muda.

- [ ] **Step 8: Commit**

```bash
git add src/lib/use-wake-lock.ts src/lib/use-wake-lock.test.ts src/pages/Leitura.tsx
git commit -m "feat: wake lock mantém a tela acesa durante a leitura"
```

---

### Task 6: Contexto colapsável com a escolha lembrada

**Files:**
- Create: `src/lib/contexto-collapse.ts`
- Create: `src/lib/contexto-collapse.test.ts`
- Modify: `src/components/SectionChips.tsx`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes (Task 5): a seção `#contexto` de `Leitura.tsx`; `irPara(id)` de `SectionChips.tsx`; `installLocalStorageMock()` de `./testing/storage-mock`.
- Produces:
  - `export const CONTEXTO_KEY = 'pericopes-contexto-aberto'`
  - `export function getContextoAberto(): boolean`
  - `export function setContextoAberto(aberto: boolean): void`
  - prop nova em `SectionChips`: `onIr?: (id: string) => void`
  - classes CSS `.collapse-h`, `.collapse-btn`, `.collapse-chevron`, `.collapse-chevron.open`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/contexto-collapse.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { CONTEXTO_KEY, getContextoAberto, setContextoAberto } from './contexto-collapse'
import { installLocalStorageMock } from './testing/storage-mock'

installLocalStorageMock()

describe('contexto-collapse', () => {
  beforeEach(() => localStorage.clear())

  it('sem escolha gravada, o contexto vem ABERTO', () => {
    expect(getContextoAberto()).toBe(true)
  })

  it('colapsar e reabrir persiste a escolha', () => {
    setContextoAberto(false)
    expect(getContextoAberto()).toBe(false)
    setContextoAberto(true)
    expect(getContextoAberto()).toBe(true)
  })

  it('grava exatamente "1" e "0"', () => {
    setContextoAberto(true)
    expect(localStorage.getItem(CONTEXTO_KEY)).toBe('1')
    setContextoAberto(false)
    expect(localStorage.getItem(CONTEXTO_KEY)).toBe('0')
  })

  it('valor estranho no storage cai no padrão aberto', () => {
    localStorage.setItem(CONTEXTO_KEY, 'talvez')
    expect(getContextoAberto()).toBe(true)
  })

  it('a escolha é global, não por perícope', () => {
    setContextoAberto(false)
    expect(getContextoAberto()).toBe(false)
    expect(getContextoAberto()).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/contexto-collapse.test.ts`
Expected: FAIL — o módulo `./contexto-collapse` não existe.

- [ ] **Step 3: Implementar `src/lib/contexto-collapse.ts`**

Criar o arquivo com:

```ts
export const CONTEXTO_KEY = 'pericopes-contexto-aberto'

/**
 * Contexto é leitura de primeira classe: o padrão é ABERTO, e só quem colapsou
 * de propósito ('0') recebe a seção fechada. Qualquer outro valor — storage
 * vazio, lixo de versão antiga — vale como aberto.
 */
export function getContextoAberto(): boolean {
  try {
    return localStorage.getItem(CONTEXTO_KEY) !== '0'
  } catch {
    return true
  }
}

/** Escolha global (não por perícope): colapsa uma vez, vale para todas. */
export function setContextoAberto(aberto: boolean): void {
  try {
    localStorage.setItem(CONTEXTO_KEY, aberto ? '1' : '0')
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/contexto-collapse.test.ts`
Expected: PASS — 5 testes novos neste arquivo.

- [ ] **Step 5: Avisar a página antes de rolar em `src/components/SectionChips.tsx`**

Trocar o tipo `Props` por:

```tsx
type Props = {
  /** Muda a cada perícope: força re-observar o DOM novo. */
  ordem: number
  abbrev: string
  /** Corrido↔Blocos troca a subárvore de versículos: precisa re-observar. */
  layout: ReadingLayout
  /** Avisa a página ANTES de rolar — é assim que o chip Contexto expande a
   * seção colapsada em vez de parar num título mudo. */
  onIr?: (id: string) => void
}
```

Trocar a assinatura do componente por:

```tsx
export default function SectionChips({ ordem, abbrev, layout, onIr }: Props) {
```

E trocar a função `irPara` por:

```tsx
  function irPara(id: string) {
    onIr?.(id)
    // Expandir o Contexto não move o topo dele — é a primeira seção da página
    // —, então rolar na mesma volta do evento já chega no lugar certo.
    document.getElementById(id)?.scrollIntoView({ behavior: rolagemSuave(), block: 'start' })
  }
```

- [ ] **Step 6: Colapsar a seção em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `../lib/contexto-ia`:

```tsx
import { getContextoAberto, setContextoAberto } from '../lib/contexto-collapse'
```

Dentro do componente, logo depois de `const [temTts] = useState(() => ttsSupported())` (Task 4):

```tsx
  const [contextoAberto, setContextoAbertoState] = useState(() => getContextoAberto())
```

Acrescentar as duas funções logo depois de `function fecharBarra() { ... }`:

```tsx
  function alternarContexto() {
    const proximo = !contextoAberto
    setContextoAbertoState(proximo)
    setContextoAberto(proximo)
  }

  function abrirContexto() {
    if (contextoAberto) return
    setContextoAbertoState(true)
    setContextoAberto(true)
  }
```

Trocar a linha do `<SectionChips …>` por:

```tsx
      <SectionChips
        ordem={p.ordem}
        abbrev={p.abbrev}
        layout={prefs.layout}
        onIr={(id) => {
          if (id === 'contexto') abrirContexto()
        }}
      />
```

E trocar a seção Contexto inteira por:

```tsx
      <section className="block block-plain" id="contexto">
        <h2 className="collapse-h">
          <button
            type="button"
            className="collapse-btn"
            aria-expanded={contextoAberto}
            aria-controls="contexto-corpo"
            onClick={alternarContexto}
          >
            <span className={`collapse-chevron${contextoAberto ? ' open' : ''}`} aria-hidden>
              ▸
            </span>
            Contexto
          </button>
        </h2>
        <div id="contexto-corpo" hidden={!contextoAberto}>
          {paragraphize(p.contexto_historico_literario, { maxParas: 2 }).map((para, i) => (
            <p key={i} className="prose">
              {para}
            </p>
          ))}
        </div>
      </section>
```

- [ ] **Step 7: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.leitura > .block-plain > h2 { ... }`:

```css
.collapse-h {
  margin-bottom: 0.35rem;
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.25rem;
  padding: 0.1rem 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.collapse-chevron {
  display: inline-block;
  color: var(--accent);
  font-size: 0.85em;
  transition: transform 0.18s ease;
}

.collapse-chevron.open {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .collapse-chevron {
    transition: none;
  }
}
```

- [ ] **Step 8: Rodar tudo, lint, typecheck e build**

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS — 176 antigos + 5 novos = 181 testes; lint, typecheck do worker e build sem erro.

- [ ] **Step 9: Verificação visual (pré-dispensada)**

O que deveria ser visto: na primeira visita a seção Contexto aparece ABERTA, com o título virando um botão com um chevron apontando para baixo à esquerda; tocando no título o corpo some e o chevron volta a apontar para a direita, sobrando só "▸ Contexto"; abrindo outra perícope a seção continua colapsada (a escolha é global e persiste entre sessões); tocando no chip "Contexto" da barra de seções com ela colapsada, a seção expande e a página rola até lá; o botão anuncia o estado para leitores de tela (`aria-expanded`); com "reduzir movimento" o chevron troca de posição sem animação.

- [ ] **Step 10: Commit**

```bash
git add src/lib/contexto-collapse.ts src/lib/contexto-collapse.test.ts src/components/SectionChips.tsx src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: contexto colapsável com a escolha lembrada"
```

---

## Cobertura do spec

| § do spec | Task |
| --- | --- |
| 1. Streak de dias na Home | Task 1 |
| 2. Tempo estimado de leitura | Task 2 |
| 3. Skeleton loading | Task 3 |
| 4. Ouvir a perícope (TTS) | Task 4 |
| 5. Wake lock | Task 5 |
| 6. Contexto colapsável | Task 6 |
| Tratamento de erros (`ttsSupported`/`wakeLockDe` ausentes ⇒ recurso some; `listAllProgresso` vazio ⇒ sem streak; datas inválidas ignoradas; `localStorage` em try/catch) | Tasks 1, 4, 5 e 6 |
| Testes (streak com datas locais, reading-time, fila e voz do TTS com mocks, persistência do contexto) | Tasks 1, 2, 4 e 6 |

## Contagem de testes por task

| Task | Novos | Total |
| --- | --- | --- |
| — (base da main) | — | 137 |
| 1. streak | 13 | 150 |
| 2. reading-time | 7 | 157 |
| 3. skeleton | 0 | 157 |
| 4. tts | 15 | 172 |
| 5. wake lock | 4 | 176 |
| 6. contexto colapsável | 5 | 181 |
