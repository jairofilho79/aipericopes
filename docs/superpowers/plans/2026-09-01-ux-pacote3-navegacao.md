# Pacote 3 — Navegação e busca: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sete melhorias de navegação e busca, 100% no cliente: swipe entre perícopes, atalhos de teclado ←/→, barra de chips de seção com referência viva, busca full-text no texto bíblico com resolução de versículo, virtualização CSS do índice e barra de progresso por livro.

**Architecture:** Nenhuma mudança no Worker, no D1 ou no esquema de sync — este pacote é inteiro cliente. Três módulos puros novos em `src/lib/` (`use-swipe-nav.ts`, `use-keyboard-nav.ts`, `fulltext.ts`), um componente novo (`src/components/SectionChips.tsx`), uma função nova exportada de `src/lib/content.ts` (`progressoPorLivro`), e mudanças concentradas em `Leitura.tsx`, `Pesquisar.tsx`, `Indice.tsx` e `src/styles/app.css`. Cada hook expõe a decisão como função pura testável (`shouldSwipe`, `shouldHandleKey`, `isTypingTarget`, `hasOpenDialog`) e guarda só o encanamento de listener/observer no `useEffect`.

**Tech Stack:** React 19, react-router-dom 7, Vitest 4 (+ happy-dom), Vite 8 + vite-plugin-pwa. Sem biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-08-31-ux-pacote3-navegacao-design.md`

## Global Constraints

- Estilo de código do repo: sem ponto-e-vírgula, aspas simples, indentação de 2 espaços, vírgula final.
- Convenções pt-BR na UI: rótulos em sentence-case, ellipsis `…` (nunca `...`), nomes de domínio em português (`Perícope`, `Anotação`, `atualizadoEm`).
- CSS plano em `src/styles/app.css` com classes kebab-case; nada de CSS Modules, CSS-in-JS ou framework.
- `localStorage`, `IntersectionObserver`, `ResizeObserver` e afins nunca quebram a leitura: guard de feature (`typeof X === 'undefined'` ou `?.`) na entrada e cleanup completo (`removeEventListener`, `disconnect`, `cancelAnimationFrame`, `clearTimeout`) em todo `useEffect`.
- Testes com Vitest; arquivos que precisam de DOM levam `// @vitest-environment happy-dom` no topo.
- Contexto, resenha, reflexão e tópicos são leitura de primeira classe: os chips de seção e a navegação valem para a página inteira, não só para o texto NAA.
- Comandos: testes `npm test`, lint `npm run lint`, build `npm run build`. A suíte parte de **103 testes verdes**; toda task termina com a suíte verde e com lint e build limpos.
- A checagem visual interativa (`npm run dev` + navegador) é **pré-dispensada nesta sessão headless**: onde o passo pedir verificação visual, rodar `npm run build` e registrar a descrição do que deveria ser visto.

---

### Task 1: `use-swipe-nav` — swipe horizontal entre perícopes

**Files:**
- Create: `src/lib/use-swipe-nav.ts`
- Create: `src/lib/use-swipe-nav.test.ts`
- Modify: `src/pages/Leitura.tsx`

**Interfaces:**
- Consumes: `anteriorNoTestamento`/`proximaNoTestamento` já resolvidos no estado `prev`/`next` de `Leitura.tsx`; `useNavigate` de `react-router-dom`.
- Produces:
  - `export const SWIPE_MIN_X = 70`
  - `export const SWIPE_MAX_MS = 600`
  - `export function shouldSwipe(dx: number, dy: number, dt: number): boolean`
  - `export type UseSwipeNavOpts = { onPrev: () => void; onNext: () => void; enabled: boolean }`
  - `export function useSwipeNav(ref: RefObject<HTMLElement | null>, opts: UseSwipeNavOpts): void`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/use-swipe-nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { shouldSwipe, SWIPE_MAX_MS, SWIPE_MIN_X } from './use-swipe-nav'

describe('shouldSwipe', () => {
  it('gesto horizontal amplo e rápido dispara nos dois sentidos', () => {
    expect(shouldSwipe(-120, 10, 200)).toBe(true)
    expect(shouldSwipe(120, -10, 200)).toBe(true)
  })

  it('deslocamento horizontal curto não dispara', () => {
    expect(shouldSwipe(-40, 0, 200)).toBe(false)
    expect(shouldSwipe(69, 0, 200)).toBe(false)
  })

  it('gesto diagonal não dispara (rolagem tem precedência)', () => {
    expect(shouldSwipe(100, 60, 200)).toBe(false)
    expect(shouldSwipe(-100, -80, 200)).toBe(false)
  })

  it('gesto lento demais não dispara', () => {
    expect(shouldSwipe(200, 5, 900)).toBe(false)
    expect(shouldSwipe(200, 5, SWIPE_MAX_MS + 1)).toBe(false)
  })

  it('os limites exatos contam como swipe', () => {
    expect(shouldSwipe(SWIPE_MIN_X, 0, SWIPE_MAX_MS)).toBe(true)
    expect(shouldSwipe(-SWIPE_MIN_X, 35, 300)).toBe(true)
  })

  it('gesto parado não dispara', () => {
    expect(shouldSwipe(0, 0, 0)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/use-swipe-nav.test.ts`
Expected: FAIL — o módulo `./use-swipe-nav` não existe.

- [ ] **Step 3: Implementar `src/lib/use-swipe-nav.ts`**

Criar o arquivo com:

```ts
import { useEffect, useRef, type RefObject } from 'react'

/** Deslocamento horizontal mínimo para o gesto valer como navegação. */
export const SWIPE_MIN_X = 70

/** Acima disso o dedo estava passeando, não deslizando. */
export const SWIPE_MAX_MS = 600

/**
 * Decisão pura do gesto: horizontal o bastante, longo o bastante e rápido o
 * bastante. A razão 2:1 é o que separa "deslizar de lado" de "rolar meio
 * torto" — na dúvida a rolagem vertical ganha.
 */
export function shouldSwipe(dx: number, dy: number, dt: number): boolean {
  if (dt > SWIPE_MAX_MS) return false
  if (Math.abs(dx) < SWIPE_MIN_X) return false
  return Math.abs(dx) >= 2 * Math.abs(dy)
}

export type UseSwipeNavOpts = {
  onPrev: () => void
  onNext: () => void
  enabled: boolean
}

/**
 * Swipe horizontal no elemento raiz da leitura: para a esquerda ⇒ próxima,
 * para a direita ⇒ anterior. Listeners passivos e sem `preventDefault` — a
 * rolagem vertical e o back-swipe do sistema continuam intactos.
 */
export function useSwipeNav(
  ref: RefObject<HTMLElement | null>,
  { onPrev, onNext, enabled }: UseSwipeNavOpts,
): void {
  // Callbacks num ref: mudam a cada render (fecham sobre prev/next), mas não
  // podem re-assinar os listeners no meio de um gesto.
  const cbs = useRef({ onPrev, onNext })
  useEffect(() => {
    cbs.current = { onPrev, onNext }
  }, [onPrev, onNext])

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return

    let x0 = 0
    let y0 = 0
    let t0 = 0
    let ativo = false

    const onStart = (e: TouchEvent) => {
      // Multitoque é pinça/zoom, nunca navegação.
      if (e.touches.length !== 1) {
        ativo = false
        return
      }
      const t = e.touches[0]
      x0 = t.clientX
      y0 = t.clientY
      t0 = Date.now()
      ativo = true
    }

    const onCancel = () => {
      ativo = false
    }

    const onEnd = (e: TouchEvent) => {
      if (!ativo) return
      ativo = false
      if (e.changedTouches.length !== 1) return
      // Seleção de texto viva: o dedo estava arrastando as alças da seleção,
      // não pedindo a próxima perícope.
      if (window.getSelection()?.isCollapsed === false) return
      const t = e.changedTouches[0]
      const dx = t.clientX - x0
      if (!shouldSwipe(dx, t.clientY - y0, Date.now() - t0)) return
      if (dx < 0) cbs.current.onNext()
      else cbs.current.onPrev()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, enabled])
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/use-swipe-nav.test.ts`
Expected: PASS — 6 testes novos neste arquivo.

- [ ] **Step 5: Ligar o hook em `src/pages/Leitura.tsx`**

Trocar a primeira linha de imports por (só `useCallback` entra):

```tsx
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
```

Trocar a linha do `react-router-dom` por:

```tsx
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
```

Acrescentar o import do hook logo depois do import de `reading-position`:

```tsx
import { useSwipeNav } from '../lib/use-swipe-nav'
```

Dentro do componente, logo depois de `const [searchParams] = useSearchParams()`:

```tsx
  const navigate = useNavigate()
  const rootRef = useRef<HTMLElement>(null)
```

Logo depois do `useEffect` da posição de rolagem (o que termina em `}, [ordem])`, acrescentar:

```tsx
  const irAnterior = useCallback(() => {
    if (prev) navigate(`/leitura/${prev.ordem}`)
  }, [navigate, prev])

  const irProxima = useCallback(() => {
    if (next) navigate(`/leitura/${next.ordem}`)
  }, [navigate, next])

  useSwipeNav(rootRef, { onPrev: irAnterior, onNext: irProxima, enabled: p !== null })
```

E pendurar o ref no elemento raiz — trocar a abertura do `<article>` por:

```tsx
    <article className="leitura" ref={rootRef}>
```

- [ ] **Step 6: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 103 antigos + 6 novos = 109 testes; lint e build sem erro.

- [ ] **Step 7: Verificação visual (pré-dispensada)**

O que deveria ser visto num aparelho de toque: deslizar o dedo da direita para a esquerda sobre o texto abre a próxima perícope; da esquerda para a direita volta para a anterior; rolar verticalmente não navega; segurar e arrastar para selecionar texto e soltar não navega; na primeira/última perícope do testamento o gesto não faz nada.

- [ ] **Step 8: Commit**

```bash
git add src/lib/use-swipe-nav.ts src/lib/use-swipe-nav.test.ts src/pages/Leitura.tsx
git commit -m "feat: swipe horizontal navega entre perícopes na leitura"
```

---

### Task 2: `use-keyboard-nav` — atalhos ←/→

**Files:**
- Create: `src/lib/use-keyboard-nav.ts`
- Create: `src/lib/use-keyboard-nav.test.ts`
- Modify: `src/pages/Leitura.tsx`

**Interfaces:**
- Consumes (Task 1): `irAnterior`/`irProxima` já definidos em `Leitura.tsx`.
- Produces:
  - `export function isTypingTarget(el: EventTarget | null): boolean`
  - `export function hasOpenDialog(doc: Document): boolean`
  - `export function shouldHandleKey(ev: KeyboardEvent): 'prev' | 'next' | null`
  - `export type UseKeyboardNavOpts = { onPrev: () => void; onNext: () => void; enabled: boolean }`
  - `export function useKeyboardNav(opts: UseKeyboardNavOpts): void`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/use-keyboard-nav.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { hasOpenDialog, isTypingTarget, shouldHandleKey } from './use-keyboard-nav'

/** Dispara o evento de verdade para que `ev.target` seja o elemento certo. */
function decidir(
  key: string,
  alvo: HTMLElement,
  init: KeyboardEventInit = {},
): 'prev' | 'next' | null {
  let saida: 'prev' | 'next' | null = null
  const handler = (e: Event) => {
    saida = shouldHandleKey(e as KeyboardEvent)
  }
  document.addEventListener('keydown', handler)
  alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  document.removeEventListener('keydown', handler)
  return saida
}

function montar<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  document.body.append(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isTypingTarget', () => {
  it('input, textarea e select são alvos de digitação', () => {
    expect(isTypingTarget(montar('input'))).toBe(true)
    expect(isTypingTarget(montar('textarea'))).toBe(true)
    expect(isTypingTarget(montar('select'))).toBe(true)
  })

  it('elemento contenteditable é alvo de digitação', () => {
    const div = montar('div')
    div.setAttribute('contenteditable', 'true')
    expect(isTypingTarget(div)).toBe(true)
  })

  it('botão, artigo e null não são alvos de digitação', () => {
    expect(isTypingTarget(montar('button'))).toBe(false)
    expect(isTypingTarget(montar('article'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('shouldHandleKey', () => {
  it('← devolve prev e → devolve next', () => {
    const alvo = montar('article')
    expect(decidir('ArrowLeft', alvo)).toBe('prev')
    expect(decidir('ArrowRight', alvo)).toBe('next')
  })

  it('qualquer modificador cancela', () => {
    const alvo = montar('article')
    expect(decidir('ArrowLeft', alvo, { metaKey: true })).toBeNull()
    expect(decidir('ArrowRight', alvo, { ctrlKey: true })).toBeNull()
    expect(decidir('ArrowLeft', alvo, { altKey: true })).toBeNull()
    expect(decidir('ArrowRight', alvo, { shiftKey: true })).toBeNull()
  })

  it('evento já tratado por outro handler é ignorado', () => {
    const ev = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    ev.preventDefault()
    expect(shouldHandleKey(ev)).toBeNull()
  })

  it('seta dentro de um campo de texto é ignorada', () => {
    expect(decidir('ArrowLeft', montar('input'))).toBeNull()
    expect(decidir('ArrowRight', montar('textarea'))).toBeNull()
  })

  it('outras teclas devolvem null', () => {
    const alvo = montar('article')
    expect(decidir('Escape', alvo)).toBeNull()
    expect(decidir('a', alvo)).toBeNull()
    expect(decidir('ArrowDown', alvo)).toBeNull()
  })
})

describe('hasOpenDialog', () => {
  it('detecta um role="dialog" no documento e volta a false quando ele sai', () => {
    expect(hasOpenDialog(document)).toBe(false)
    const pop = montar('div')
    pop.setAttribute('role', 'dialog')
    expect(hasOpenDialog(document)).toBe(true)
    pop.remove()
    expect(hasOpenDialog(document)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/use-keyboard-nav.test.ts`
Expected: FAIL — o módulo `./use-keyboard-nav` não existe.

- [ ] **Step 3: Implementar `src/lib/use-keyboard-nav.ts`**

Criar o arquivo com:

```ts
import { useEffect, useRef } from 'react'

/** Foco num campo editável: as setas são do cursor de texto, não da navegação. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
}

/**
 * Popover de preferências ou barra de ações de versículo abertos (ambos são
 * `role="dialog"`): eles têm precedência, e o Escape deles é que manda.
 */
export function hasOpenDialog(doc: Document): boolean {
  return doc.querySelector('[role="dialog"]') !== null
}

/** Decisão pura do atalho, sem tocar em nada do DOM além do alvo do evento. */
export function shouldHandleKey(ev: KeyboardEvent): 'prev' | 'next' | null {
  if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return null
  if (ev.defaultPrevented) return null
  if (isTypingTarget(ev.target)) return null
  if (ev.key === 'ArrowLeft') return 'prev'
  if (ev.key === 'ArrowRight') return 'next'
  return null
}

export type UseKeyboardNavOpts = {
  onPrev: () => void
  onNext: () => void
  enabled: boolean
}

/** ←/→ navegam entre perícopes enquanto a leitura está aberta. */
export function useKeyboardNav({ onPrev, onNext, enabled }: UseKeyboardNavOpts): void {
  const cbs = useRef({ onPrev, onNext })
  useEffect(() => {
    cbs.current = { onPrev, onNext }
  }, [onPrev, onNext])

  useEffect(() => {
    if (!enabled) return
    const onKey = (ev: KeyboardEvent) => {
      if (hasOpenDialog(document)) return
      const acao = shouldHandleKey(ev)
      if (!acao) return
      // Só aqui: a seta virou navegação, então ninguém mais deve reagir a ela.
      ev.preventDefault()
      if (acao === 'prev') cbs.current.onPrev()
      else cbs.current.onNext()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled])
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/use-keyboard-nav.test.ts`
Expected: PASS — 9 testes novos neste arquivo.

- [ ] **Step 5: Ligar o hook em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `use-swipe-nav`:

```tsx
import { useKeyboardNav } from '../lib/use-keyboard-nav'
```

Logo depois da chamada de `useSwipeNav` (Task 1), acrescentar:

```tsx
  useKeyboardNav({ onPrev: irAnterior, onNext: irProxima, enabled: p !== null })
```

- [ ] **Step 6: Documentar o atalho nos títulos dos botões de navegação**

Em `.ref-nav`, acrescentar `title` aos dois `Link` (o `aria-label` continua igual):

```tsx
          {prev && (
            <Link
              className="read-tool ref-arrow"
              aria-label={`Anterior: ${prev.titulo}`}
              title={`Anterior: ${prev.titulo} · atalho ←`}
              to={`/leitura/${prev.ordem}`}
            >
              ←
            </Link>
          )}
          {next && (
            <Link
              className="read-tool ref-arrow"
              aria-label={`Próxima: ${next.titulo}`}
              title={`Próxima: ${next.titulo} · atalho →`}
              to={`/leitura/${next.ordem}`}
            >
              →
            </Link>
          )}
```

E no `<nav className="pager">` do rodapé, acrescentar `title` aos dois `Link`:

```tsx
          {prev ? (
            <Link
              className="ghost pager-link"
              aria-label={`Anterior: ${prev.titulo}`}
              title="Atalho: ←"
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
              title="Atalho: →"
              to={`/leitura/${next.ordem}`}
            >
              {next.titulo} →
            </Link>
          ) : (
            <span aria-hidden />
          )}
```

- [ ] **Step 7: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 109 antigos + 9 novos = 118 testes; lint e build sem erro.

- [ ] **Step 8: Verificação visual (pré-dispensada)**

O que deveria ser visto num teclado físico: numa perícope, ← abre a anterior e → a próxima; com o cursor dentro do textarea de anotação as setas movem o cursor e não navegam; com o popover "Aa" ou a barra de ações de versículo abertos as setas não fazem nada (e Escape fecha); ⌘←/Ctrl+→ continuam sendo do navegador; passar o mouse nas setas do topo e nos links do rodapé mostra o atalho no tooltip.

- [ ] **Step 9: Commit**

```bash
git add src/lib/use-keyboard-nav.ts src/lib/use-keyboard-nav.test.ts src/pages/Leitura.tsx
git commit -m "feat: atalhos de teclado ←/→ entre perícopes"
```

---

### Task 3: Ids de seção, `SectionChips` e referência viva

**Files:**
- Create: `src/components/SectionChips.tsx`
- Modify: `src/pages/Leitura.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `Pericope.abbrev` e `Pericope.ordem` (já disponíveis como `p` em `Leitura.tsx`); atributo `data-verse-id` nos botões de versículo (criado nesta task); classes `.top` / `.top-hidden` do header (`src/App.tsx` + `app.css`).
- Produces:
  - `export const SECTIONS: { id: string; label: string }[]` em `SectionChips.tsx`
  - `export default function SectionChips({ ordem, abbrev }: { ordem: number; abbrev: string })`
  - ids de seção no DOM da leitura: `#contexto`, `#texto`, `#resenha`, `#reflexao`, `#notas`
  - atributo `data-verse-id="<c>:<v>"` em todo botão de versículo (ambos os modos de render)
  - variável CSS `--top-h` no `documentElement` (altura medida do header)
  - classes CSS `.section-chips`, `.section-chips-row`, `.section-chip`, `.section-chip.active`, `.section-ref`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Criar `src/components/SectionChips.tsx`**

Criar o arquivo com:

```tsx
import { useEffect, useState } from 'react'

/** Ordem canônica das seções — é ela que decide qual chip fica ativo quando
 * mais de uma seção cruza a faixa de leitura ao mesmo tempo. */
export const SECTIONS: { id: string; label: string }[] = [
  { id: 'contexto', label: 'Contexto' },
  { id: 'texto', label: 'Texto' },
  { id: 'resenha', label: 'Resenha' },
  { id: 'reflexao', label: 'Reflexão' },
]

const VERSE_ID = /^\d+:\d+$/

function rolagemSuave(): ScrollBehavior {
  // Guard: matchMedia falta em ambiente sem DOM completo.
  const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return reduzido ? 'auto' : 'smooth'
}

type Props = {
  /** Muda a cada perícope: força re-observar o DOM novo. */
  ordem: number
  abbrev: string
}

export default function SectionChips({ ordem, abbrev }: Props) {
  const [ativo, setAtivo] = useState<string>(SECTIONS[0].id)
  const [refViva, setRefViva] = useState<string | null>(null)

  // O header é sticky e some ao rolar: os chips precisam saber a altura dele
  // para encostar embaixo sem sobrepor. O CSS zera esse offset quando o header
  // está escondido (`.shell:has(.top-hidden)`).
  useEffect(() => {
    const top = document.querySelector<HTMLElement>('.top')
    const raiz = document.documentElement
    if (!top) return
    const aplicar = () => raiz.style.setProperty('--top-h', `${top.offsetHeight}px`)
    aplicar()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', aplicar)
      return () => {
        window.removeEventListener('resize', aplicar)
        raiz.style.removeProperty('--top-h')
      }
    }
    const ro = new ResizeObserver(aplicar)
    ro.observe(top)
    return () => {
      ro.disconnect()
      raiz.style.removeProperty('--top-h')
    }
  }, [])

  // Chip ativo: um único observer sobre as quatro seções.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const alvos = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (!alvos.length) return
    const visiveis = new Set<string>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visiveis.add(e.target.id)
          else visiveis.delete(e.target.id)
        }
        const primeira = SECTIONS.find((s) => visiveis.has(s.id))
        if (primeira) setAtivo(primeira.id)
      },
      // Faixa fina no primeiro terço da viewport: o que está ali é o que o
      // leitor está lendo agora.
      { rootMargin: '-15% 0px -67% 0px', threshold: 0 },
    )
    for (const el of alvos) obs.observe(el)
    return () => obs.disconnect()
  }, [ordem])

  // Referência viva: segundo observer, só enquanto o Texto está ativo.
  useEffect(() => {
    if (ativo !== 'texto') {
      setRefViva(null)
      return
    }
    if (typeof IntersectionObserver === 'undefined') return
    const alvos = Array.from(document.querySelectorAll<HTMLElement>('[data-verse-id]'))
    if (!alvos.length) return
    const visiveis = new Set<HTMLElement>()
    let raf = 0
    const atualizar = () => {
      raf = 0
      const primeiro = alvos.find((el) => visiveis.has(el))
      const id = primeiro?.dataset.verseId ?? ''
      // Versículos órfãos do parser ("x:N") não viram referência.
      setRefViva(VERSE_ID.test(id) ? `${abbrev} ${id}` : null)
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement
          if (e.isIntersecting) visiveis.add(el)
          else visiveis.delete(el)
        }
        // rAF: uma rolagem rápida dispara dezenas de callbacks; só a última pinta.
        if (!raf) raf = requestAnimationFrame(atualizar)
      },
      { rootMargin: '-10% 0px -55% 0px', threshold: 0 },
    )
    for (const el of alvos) obs.observe(el)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      obs.disconnect()
    }
  }, [ativo, abbrev, ordem])

  function irPara(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: rolagemSuave(), block: 'start' })
  }

  return (
    <nav className="section-chips" aria-label="Seções da perícope">
      <div className="section-chips-row">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`section-chip${ativo === s.id ? ' active' : ''}`}
            aria-current={ativo === s.id ? 'true' : undefined}
            onClick={() => irPara(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* Sem aria-live de propósito: o rótulo muda a cada rolagem e viraria
          tagarelice para o leitor de tela. */}
      <span className="section-ref">{refViva ?? ''}</span>
    </nav>
  )
}
```

- [ ] **Step 2: Dar ids às seções e `data-verse-id` aos versículos em `src/pages/Leitura.tsx`**

Acrescentar o import logo depois do import de `ReadingMenu`:

```tsx
import SectionChips from '../components/SectionChips'
```

Acrescentar o componente logo depois do `</div>` que fecha a `div.ref-row` e antes da seção Contexto:

```tsx
      <SectionChips ordem={p.ordem} abbrev={p.abbrev} />
```

Acrescentar o `id` às cinco seções — trocar cada abertura de `<section>` pela versão com id:

```tsx
      <section className="block block-plain" id="contexto">
```

```tsx
      <section className="block block-plain" id="texto">
```

```tsx
      <section className="block block-plain" id="resenha">
```

```tsx
      <section className="block block-plain" id="reflexao">
```

```tsx
      <section className="block notes" id="notas">
```

(a ordem no arquivo é Contexto, Texto (NAA), Resenha, Reflexão, notas — cada `<section>` recebe o id da sua vez.)

Acrescentar `data-verse-id` aos dois botões de versículo. No modo corrido:

```tsx
                        <button
                          type="button"
                          className={verseClass('verse-inline', b.id)}
                          data-verse-id={b.id}
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
                    data-verse-id={b.id}
                    aria-pressed={selecionadosIds.has(b.id)}
                    aria-label={verseAria(b)}
                    onClick={() => selectVerse(b.id)}
                  >
```

- [ ] **Step 3: CSS da barra de chips em `src/styles/app.css`**

Acrescentar logo depois do bloco `.ref-nav { ... }` / `.ref-arrow { ... }` (antes de `.texto-biblico, .prose, .perguntas`):

```css
/* barra de âncoras: sticky abaixo do header, e colada no topo quando ele some.
   z-index 4 fica abaixo do .top (5) e da .verse-actions (8) de propósito. */
.section-chips {
  position: sticky;
  top: var(--top-h, 0px);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 -1.05rem 0.9rem;
  padding: 0.4rem 1.05rem;
  background: color-mix(in srgb, var(--paper) 82%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
  font-family: var(--font-ui);
  transition: top 0.25s ease;
}

.shell:has(.top-hidden) .section-chips {
  top: 0;
}

.section-chips-row {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.section-chips-row::-webkit-scrollbar {
  display: none;
}

.section-chip {
  flex: 0 0 auto;
  min-height: 2.25rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}

.section-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--cta-ink);
}

.section-ref {
  flex: 0 0 auto;
  font-size: 0.8rem;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .section-chips {
    transition: none;
  }
}
```

- [ ] **Step 4: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 118 testes (nenhum novo nesta task); lint e build sem erro.

- [ ] **Step 5: Verificação visual (pré-dispensada)**

O que deveria ser visto: abaixo do título e da linha de referência aparece uma barra discreta com os chips Contexto · Texto · Resenha · Reflexão; tocar num chip rola até a seção; rolando a página o chip da seção corrente fica preenchido com a cor de destaque; enquanto o Texto está ativo, à direita da barra aparece "Gn 3:7" acompanhando o primeiro versículo visível, e o rótulo some ao sair do Texto; ao rolar para baixo o header some e a barra sobe encostando no topo, sem nunca ficar por cima do header quando ele reaparece; com o sistema em "reduzir movimento" a rolagem do chip é instantânea; numa tela estreita a fileira de chips rola na horizontal.

- [ ] **Step 6: Commit**

```bash
git add src/components/SectionChips.tsx src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: chips de seção com chip ativo e referência viva na leitura"
```

---

### Task 4: `src/lib/fulltext.ts` — índice e busca no texto bíblico

**Files:**
- Create: `src/lib/fulltext.ts`
- Create: `src/lib/fulltext.test.ts`

**Interfaces:**
- Consumes: `loadPericopes()` e `refLabel(p)` de `./content`; `Pericope` de `./types`.
- Produces:
  - `export const MIN_CHARS = 3`
  - `export const LIMITE_RESULTADOS = 50`
  - `export type FulltextHit = { ordem: number; titulo: string; refLabel: string; verseId: string; snippet: string }`
  - `export type LinhaIndexada = { texto: string; verseId: string | null; inicio: number }`
  - `export function normalize(s: string): string`
  - `export function indexarLinhas(raw: string): LinhaIndexada[]`
  - `export function linhaIndexAtOffset(linhas: LinhaIndexada[], offset: number): number`
  - `export function verseIdAtOffset(linhas: LinhaIndexada[], offset: number): string | null`
  - `export function snippetAt(texto: string, pos: number, len: number, tamanho?: number): string`
  - `export function marcarTrecho(snippet: string, q: string): { antes: string; marcado: string; depois: string }`
  - `export function indexPronto(): boolean`
  - `export async function searchTexto(q: string, limit?: number): Promise<FulltextHit[]>`
  - A Task 5 consome `MIN_CHARS`, `LIMITE_RESULTADOS`, `FulltextHit`, `indexPronto`, `marcarTrecho` e `searchTexto`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/fulltext.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  indexarLinhas,
  marcarTrecho,
  normalize,
  searchTexto,
  snippetAt,
  verseIdAtOffset,
} from './fulltext'
import type { Pericope } from './types'

const TEXTO =
  'Capítulo 1\n1 No princípio, Deus criou o coração.\n2 A terra era sem forma.\nCapítulo 2\n1 Assim foram concluídos os céus.'

function peri(ordem: number, livro: string, abbrev: string, texto: string): Pericope {
  return {
    ordem,
    livro,
    abbrev,
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 2,
    versiculo_fim: 1,
    titulo_pericope_pt: `Título ${ordem}`,
    texto_naa: texto,
    contexto_historico_literario: '',
    resenha: '',
    perguntas_reflexao: [],
  }
}

const FIXTURES: Pericope[] = [
  peri(0, 'Gênesis', 'Gn', TEXTO),
  peri(1, 'Salmos', 'Sl', 'Capítulo 23\n1 O Senhor é o meu pastor; nada me faltará.'),
  peri(2, 'João', 'Jo', 'Capítulo 3\n16 Porque Deus amou o mundo de tal maneira.'),
]

vi.mock('./content', async (importOriginal) => {
  const real = await importOriginal<typeof import('./content')>()
  return { ...real, loadPericopes: async () => FIXTURES }
})

const LONGO = `${'a'.repeat(60)} meio ${'b'.repeat(60)}`

describe('normalize', () => {
  it('tira acentos e caixa preservando o comprimento', () => {
    expect(normalize('Coração ÁGUIA çedilha')).toBe('coracao aguia cedilha')
    expect(normalize('Coração')).toHaveLength('Coração'.length)
  })

  it('string vazia continua vazia', () => {
    expect(normalize('')).toBe('')
  })
})

describe('indexarLinhas', () => {
  it('marca o versículo de cada linha atravessando capítulos', () => {
    expect(indexarLinhas(TEXTO).map((l) => l.verseId)).toEqual([
      null,
      '1:1',
      '1:2',
      null,
      '2:1',
    ])
  })

  it('os offsets acompanham o texto normalizado, linha a linha', () => {
    const linhas = indexarLinhas(TEXTO)
    const norm = linhas.map((l) => normalize(l.texto)).join('\n')
    expect(linhas.map((l) => l.inicio)).toEqual([0, 11, 49, 74, 85])
    expect(norm.slice(linhas[1].inicio, linhas[1].inicio + 4)).toBe('1 no')
    expect(norm.slice(linhas[4].inicio, linhas[4].inicio + 7)).toBe('1 assim')
  })

  it('linha sem número herda o versículo anterior', () => {
    const linhas = indexarLinhas('Capítulo 1\n1 Primeira.\ncontinuação solta\n2 Segunda.')
    expect(linhas.map((l) => l.verseId)).toEqual([null, '1:1', '1:1', '1:2'])
  })
})

describe('verseIdAtOffset', () => {
  const linhas = indexarLinhas(TEXTO)

  it('resolve o versículo de um offset no meio do texto', () => {
    expect(verseIdAtOffset(linhas, 20)).toBe('1:1')
    expect(verseIdAtOffset(linhas, 55)).toBe('1:2')
    expect(verseIdAtOffset(linhas, 90)).toBe('2:1')
  })

  it('offset num cabeçalho de capítulo cai no primeiro versículo seguinte', () => {
    expect(verseIdAtOffset(linhas, 0)).toBe('1:1')
    expect(verseIdAtOffset(linhas, 76)).toBe('2:1')
  })

  it('lista vazia ou offset negativo devolve null', () => {
    expect(verseIdAtOffset([], 0)).toBeNull()
    expect(verseIdAtOffset(linhas, -1)).toBeNull()
  })
})

describe('snippetAt', () => {
  it('ocorrência no começo de um texto curto não ganha reticências', () => {
    expect(snippetAt('No princípio Deus criou', 0, 2)).toBe('No princípio Deus criou')
  })

  it('ocorrência no fim não ganha reticência à direita', () => {
    const s = snippetAt(LONGO, LONGO.length - 3, 3)
    expect(s.startsWith('…')).toBe(true)
    expect(s.endsWith('…')).toBe(false)
  })

  it('ocorrência no meio ganha reticências dos dois lados', () => {
    const s = snippetAt(LONGO, LONGO.indexOf('meio'), 4)
    expect(s.startsWith('…')).toBe(true)
    expect(s.endsWith('…')).toBe(true)
    expect(s).toContain('meio')
  })
})

describe('marcarTrecho', () => {
  it('acha o trecho com e sem acento', () => {
    const esperado = { antes: 'Deus criou o ', marcado: 'coração', depois: '.' }
    expect(marcarTrecho('Deus criou o coração.', 'coracao')).toEqual(esperado)
    expect(marcarTrecho('Deus criou o coração.', 'CORAÇÃO')).toEqual(esperado)
  })

  it('termo ausente devolve o snippet inteiro sem marcação', () => {
    expect(marcarTrecho('Deus criou.', 'peixe')).toEqual({
      antes: 'Deus criou.',
      marcado: '',
      depois: '',
    })
  })
})

describe('searchTexto', () => {
  it('acha com e sem acento e resolve o versículo da ocorrência', async () => {
    const semAcento = await searchTexto('coracao')
    expect(semAcento).toHaveLength(1)
    expect(semAcento[0].ordem).toBe(0)
    expect(semAcento[0].verseId).toBe('1:1')
    expect(semAcento[0].titulo).toBe('Título 0')
    expect(semAcento[0].refLabel).toBe('Gênesis 1:1–2:1')
    expect(semAcento[0].snippet).toContain('coração')

    const comAcento = await searchTexto('coração')
    expect(comAcento.map((h) => h.verseId)).toEqual(['1:1'])

    const segundoCapitulo = await searchTexto('concluidos')
    expect(segundoCapitulo.map((h) => h.verseId)).toEqual(['2:1'])
  })

  it('respeita o mínimo de caracteres e o limite de resultados', async () => {
    expect(await searchTexto('de')).toEqual([])
    expect(await searchTexto('   ')).toEqual([])
    expect(await searchTexto('deus')).toHaveLength(2)
    expect(await searchTexto('deus', 1)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/fulltext.test.ts`
Expected: FAIL — o módulo `./fulltext` não existe.

- [ ] **Step 3: Implementar `src/lib/fulltext.ts`**

Criar o arquivo com:

```ts
import { loadPericopes, refLabel } from './content'

/** Abaixo disso a busca varre o corpus inteiro à toa. */
export const MIN_CHARS = 3

/** Teto de resultados: além disso a lista deixa de ser navegável. */
export const LIMITE_RESULTADOS = 50

export type FulltextHit = {
  ordem: number
  titulo: string
  refLabel: string
  /** "capitulo:versiculo" — o mesmo id do TextoBlock, pronto para `?v=`. */
  verseId: string
  snippet: string
}

export type LinhaIndexada = {
  /** Linha crua (aparada), do jeito que o leitor lê. */
  texto: string
  /** Versículo a que a linha pertence; null só em cabeçalho de capítulo. */
  verseId: string | null
  /** Offset da linha dentro do texto normalizado da perícope. */
  inicio: number
}

/**
 * NFD + remoção de diacríticos + minúsculas. Para o texto da NAA (acentos
 * pré-compostos) o comprimento é preservado caractere a caractere, que é o que
 * permite mapear um offset do normalizado de volta ao cru. Onde isso pudesse
 * falhar (texto já decomposto), `marcarTrecho` desiste da marcação em vez de
 * cortar no lugar errado.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Quebra o `texto_naa` em linhas indexadas, com as mesmas regras do
 * `parseTextoNaa`: "Capítulo N" reinicia o capítulo corrente e não é versículo;
 * "N texto" abre um versículo; qualquer outra linha continua o versículo
 * anterior.
 */
export function indexarLinhas(raw: string): LinhaIndexada[] {
  const out: LinhaIndexada[] = []
  let chapter = 0
  let inicio = 0

  for (const line of raw.split('\n')) {
    const texto = line.trim()
    const ch = /^Capítulo\s+(\d+)\s*$/i.exec(texto)
    if (ch) {
      chapter = Number(ch[1])
      out.push({ texto, verseId: null, inicio })
    } else {
      const v = /^(\d+)\s+(.+)$/.exec(texto)
      const verseId = v
        ? chapter
          ? `${chapter}:${Number(v[1])}`
          : `0:${Number(v[1])}`
        : (out[out.length - 1]?.verseId ?? null)
      out.push({ texto, verseId, inicio })
    }
    // +1 do '\n' que rejunta as linhas normalizadas.
    inicio += normalize(texto).length + 1
  }

  return out
}

/** Índice da linha que contém o offset, ou -1. */
export function linhaIndexAtOffset(linhas: LinhaIndexada[], offset: number): number {
  if (offset < 0) return -1
  let achado = -1
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].inicio > offset) break
    achado = i
  }
  return achado
}

/** Versículo do offset; num cabeçalho de capítulo, o primeiro versículo depois. */
export function verseIdAtOffset(linhas: LinhaIndexada[], offset: number): string | null {
  const i = linhaIndexAtOffset(linhas, offset)
  if (i < 0) return null
  for (let k = i; k < linhas.length; k++) {
    if (linhas[k].verseId) return linhas[k].verseId
  }
  return null
}

/** ~`tamanho` caracteres em volta da ocorrência, cortando em espaço e com `…`. */
export function snippetAt(texto: string, pos: number, len: number, tamanho = 90): string {
  const p = Math.max(0, Math.min(pos, texto.length))
  const sobra = Math.max(0, tamanho - len)
  let ini = Math.max(0, p - Math.floor(sobra / 2))
  let fim = Math.min(texto.length, ini + Math.max(tamanho, len))

  if (ini > 0) {
    const esp = texto.indexOf(' ', ini)
    if (esp !== -1 && esp < p) ini = esp + 1
  }
  if (fim < texto.length) {
    const esp = texto.lastIndexOf(' ', fim)
    if (esp !== -1 && esp > p + len) fim = esp
  }

  const corpo = texto.slice(ini, fim).trim()
  return `${ini > 0 ? '…' : ''}${corpo}${fim < texto.length ? '…' : ''}`
}

/**
 * Parte o snippet em antes/marcado/depois para o render pintar o meio com
 * `<mark>`. A comparação é normalizada — acha com e sem acento — e só vale se o
 * normalizado tiver o mesmo comprimento do cru; senão devolve tudo em `antes`.
 */
export function marcarTrecho(
  snippet: string,
  q: string,
): { antes: string; marcado: string; depois: string } {
  const semMarca = { antes: snippet, marcado: '', depois: '' }
  const alvo = normalize(snippet)
  if (alvo.length !== snippet.length) return semMarca
  const agulha = normalize(q.trim())
  if (!agulha) return semMarca
  const i = alvo.indexOf(agulha)
  if (i < 0) return semMarca
  return {
    antes: snippet.slice(0, i),
    marcado: snippet.slice(i, i + agulha.length),
    depois: snippet.slice(i + agulha.length),
  }
}

type Entrada = {
  ordem: number
  titulo: string
  ref: string
  textoNorm: string
  linhas: LinhaIndexada[]
}

let indice: Entrada[] | null = null
let construindo: Promise<Entrada[]> | null = null

/** Já dá para buscar sem esperar a construção do índice? */
export function indexPronto(): boolean {
  return indice !== null
}

/**
 * Índice preguiçoso em cache de módulo: uma segunda cópia normalizada dos 2647
 * `texto_naa` (~13 MiB de heap extra, aceito de propósito). Construído na
 * primeira busca, nunca no carregamento da leitura, e uma vez só — chamadas
 * concorrentes compartilham a mesma promessa.
 */
async function buildIndex(): Promise<Entrada[]> {
  if (indice) return indice
  if (construindo) return construindo
  construindo = (async () => {
    const all = await loadPericopes()
    const out = all.map((p) => {
      const linhas = indexarLinhas(p.texto_naa)
      return {
        ordem: p.ordem,
        titulo: p.titulo_pericope_pt,
        ref: refLabel(p),
        textoNorm: linhas.map((l) => normalize(l.texto)).join('\n'),
        linhas,
      }
    })
    indice = out
    construindo = null
    return out
  })()
  return construindo
}

/**
 * Primeira ocorrência por perícope, com o versículo resolvido pelo offset.
 * Roda síncrona no main thread: 2647 `indexOf` num corpus já normalizado é
 * rápido o bastante para o debounce de 300 ms da UI absorver.
 */
export async function searchTexto(q: string, limit = LIMITE_RESULTADOS): Promise<FulltextHit[]> {
  const agulha = normalize(q.trim())
  if (agulha.length < MIN_CHARS) return []
  const idx = await buildIndex()

  const hits: FulltextHit[] = []
  for (const e of idx) {
    if (hits.length >= limit) break
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

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/fulltext.test.ts`
Expected: PASS — 15 testes novos neste arquivo.

- [ ] **Step 5: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 118 antigos + 15 novos = 133 testes; lint e build sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fulltext.ts src/lib/fulltext.test.ts
git commit -m "feat: módulo fulltext com índice preguiçoso e resolução de versículo"
```

---

### Task 5: Modo "No texto" em `Pesquisar`

**Files:**
- Modify: `src/pages/Pesquisar.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes (Task 4): `MIN_CHARS`, `LIMITE_RESULTADOS`, `indexPronto`, `marcarTrecho`, `searchTexto`, `type FulltextHit`.
- Produces:
  - estado local `modo: 'ref' | 'texto'` em `Pesquisar.tsx`
  - classes CSS `.modo-busca`, `.modo-btn`, `.modo-btn.active`, `.hit-snippet`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Imports e estado em `src/pages/Pesquisar.tsx`**

Acrescentar o import depois do import de `../lib/content`:

```tsx
import {
  indexPronto,
  LIMITE_RESULTADOS,
  marcarTrecho,
  MIN_CHARS,
  searchTexto,
  type FulltextHit,
} from '../lib/fulltext'
```

Dentro do componente, logo depois de `const [miss, setMiss] = useState('')`:

```tsx
  const [modo, setModo] = useState<'ref' | 'texto'>('ref')
  const [texto, setTexto] = useState('')
  const [hits, setHits] = useState<FulltextHit[]>([])
  const [buscando, setBuscando] = useState(false)
  const [preparando, setPreparando] = useState(false)

  const termo = texto.trim()
```

- [ ] **Step 2: Efeito de busca com debounce**

Acrescentar logo depois do `useEffect` que carrega `listPericopesByBookChapter`:

```tsx
  // Debounce de 300 ms: digitar não pode disparar uma varredura por tecla.
  useEffect(() => {
    if (modo !== 'texto' || termo.length < MIN_CHARS) {
      setHits([])
      setBuscando(false)
      setPreparando(false)
      return
    }
    let vivo = true
    setBuscando(true)
    // A primeira busca paga a construção do índice; as seguintes, não.
    setPreparando(!indexPronto())
    const timer = window.setTimeout(() => {
      searchTexto(termo)
        .then((r) => {
          if (vivo) setHits(r)
        })
        .catch(() => {
          if (vivo) setHits([])
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
  }, [modo, termo])
```

- [ ] **Step 3: Alternância de modo e painel de resultados no JSX**

Substituir a linha `      {selected ? (` por todo o bloco abaixo (a linha final reabre o ternário existente, então o resto do JSX continua igual):

```tsx
      <div className="modo-busca" role="group" aria-label="Modo de busca">
        <button
          type="button"
          className={`modo-btn${modo === 'ref' ? ' active' : ''}`}
          aria-pressed={modo === 'ref'}
          onClick={() => setModo('ref')}
        >
          Referência
        </button>
        <button
          type="button"
          className={`modo-btn${modo === 'texto' ? ' active' : ''}`}
          aria-pressed={modo === 'texto'}
          onClick={() => setModo('texto')}
        >
          No texto
        </button>
      </div>

      {modo === 'texto' ? (
        <>
          <div className="filters">
            <input
              type="search"
              placeholder="Buscar no texto bíblico…"
              value={texto}
              autoFocus
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Buscar no texto bíblico"
            />
          </div>

          {termo.length > 0 && termo.length < MIN_CHARS && (
            <p className="muted">Digite ao menos {MIN_CHARS} letras.</p>
          )}
          {preparando && <p className="muted">Preparando busca…</p>}
          {!preparando && buscando && <p className="muted">Buscando…</p>}

          {!buscando && termo.length >= MIN_CHARS && (
            <p className="peri-count">
              {hits.length === 0
                ? 'Nenhum resultado'
                : `${hits.length} resultado${hits.length === 1 ? '' : 's'}${
                    hits.length === LIMITE_RESULTADOS ? ' (primeiros)' : ''
                  }`}
            </p>
          )}

          <ul className="peri-list">
            {hits.map((h) => {
              const { antes, marcado, depois } = marcarTrecho(h.snippet, termo)
              return (
                <li key={h.ordem}>
                  <Link to={`/leitura/${h.ordem}${h.verseId ? `?v=${h.verseId}` : ''}`}>
                    <strong>{h.titulo}</strong>
                    <span>{h.refLabel}</span>
                    <span className="hit-snippet">
                      {antes}
                      {marcado && <mark>{marcado}</mark>}
                      {depois}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      ) : selected ? (
```

- [ ] **Step 4: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.catalog-hint { ... }`:

```css
.modo-busca {
  display: flex;
  gap: 0.35rem;
  margin: 0.75rem 0 0.25rem;
}

.modo-btn {
  flex: 0 0 auto;
  min-height: 2.5rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 0.9rem;
  cursor: pointer;
}

.modo-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--cta-ink);
}

/* mais específico que `.peri-list li a span`, senão o trecho fica miúdo e cinza */
.peri-list li a span.hit-snippet {
  font-family: var(--font-body);
  font-size: 0.92rem;
  color: var(--ink);
}

.hit-snippet mark {
  padding: 0 0.1em;
  border-radius: 3px;
  background: var(--focus-bg);
  color: inherit;
}
```

- [ ] **Step 5: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 133 testes (nenhum novo nesta task); lint e build sem erro.

- [ ] **Step 6: Verificação visual (pré-dispensada)**

O que deveria ser visto: em Pesquisar, dois botões "Referência" e "No texto" no topo, com o ativo preenchido e `aria-pressed`; em "No texto" o catálogo de livros dá lugar a um campo de busca; com 1–2 letras aparece "Digite ao menos 3 letras."; na primeira busca aparece "Preparando busca…" por um instante; digitar "coracao" e "coração" devolve a mesma lista, cada item com título, referência e um trecho com a palavra realçada; tocar num resultado abre a leitura já rolada no versículo certo; uma busca muito comum mostra "50 resultados (primeiros)"; voltar para "Referência" restaura a tela de livros como estava.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Pesquisar.tsx src/styles/app.css
git commit -m "feat: busca no texto bíblico com trecho realçado em Pesquisar"
```

---

### Task 6: Virtualização CSS do Índice

**Files:**
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: as classes existentes `.peri-list`, `.peri-list.compact` e `.book-group` (usadas por `Indice.tsx` e `Pesquisar.tsx`).
- Produces: regras `content-visibility` / `contain-intrinsic-size` nessas classes. A Task 7 acrescenta markup dentro de `.book-group`, mas não depende destas regras.

- [ ] **Step 1: Regras de virtualização em `src/styles/app.css`**

Acrescentar logo depois do bloco `.peri-list.compact li a { ... }`:

```css
/* Virtualização barata, sem biblioteca: o navegador pula layout e paint dos
   itens fora da viewport e usa o tamanho estimado no lugar. Navegador sem
   suporte simplesmente ignora as duas propriedades — degradação limpa.
   O ganho é no livro aberto e na busca, onde a lista tem centenas de itens. */
.peri-list > li {
  content-visibility: auto;
  contain-intrinsic-size: auto 72px;
}

.peri-list.compact > li {
  contain-intrinsic-size: auto 48px;
}

.book-group {
  content-visibility: auto;
  contain-intrinsic-size: auto 320px;
}
```

- [ ] **Step 2: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 133 testes (nenhum novo nesta task); lint e build sem erro.

- [ ] **Step 3: Verificação visual (pré-dispensada)**

O que deveria ser visto: no Índice, abrir um livro grande (Salmos, por exemplo) e rolar a lista inteira sem engasgo; a barra de rolagem pode dar um pequeno ajuste enquanto os itens entram em cena, mas nenhum item fica em branco ao parar de rolar; o Índice sem filtro (5 por livro) continua idêntico; a lista de resultados de Pesquisar continua idêntica.

- [ ] **Step 4: Commit**

```bash
git add src/styles/app.css
git commit -m "perf: virtualização por content-visibility nas listas de perícopes"
```

---

### Task 7: Barra de progresso por livro no Índice

**Files:**
- Modify: `src/lib/content.ts`
- Modify: `src/lib/content.test.ts`
- Modify: `src/pages/Indice.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `doneSet(): Promise<Set<number>>` de `../lib/user-db` (já usado em `Indice.tsx`); `Pericope` de `./types`.
- Produces:
  - `export type LivroProgresso = { livro: string; total: number; concluidas: number; pct: number }`
  - `export function progressoPorLivro(all: Pericope[], done: Set<number>): Map<string, LivroProgresso>`
  - componente local `BookProgress({ prog }: { prog: LivroProgresso })` em `Indice.tsx`
  - classes CSS `.book-group-head`, `.book-progress-wrap`, `.book-progress`, `.book-progress-fill`, `.book-progress-label`
  - Nenhuma outra task depende destes nomes.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/content.test.ts`, trocar a linha de import de `./content` por:

```ts
import { anteriorNoTestamento, progressoPorLivro, proximaNoTestamento } from './content'
```

E acrescentar no fim do arquivo:

```ts
function pl(ordem: number, livro: string): Pericope {
  return { ordem, livro, abbrev: livro.slice(0, 2), titulo_pericope_pt: `P${ordem}` } as Pericope
}

describe('progressoPorLivro', () => {
  const LISTA = [pl(1, 'Gênesis'), pl(2, 'Gênesis'), pl(3, 'Gênesis'), pl(4, 'Êxodo')]

  it('conta total e concluídas por livro, na ordem de aparição', () => {
    const m = progressoPorLivro(LISTA, new Set([1, 3, 4]))
    expect([...m.keys()]).toEqual(['Gênesis', 'Êxodo'])
    expect(m.get('Gênesis')).toEqual({ livro: 'Gênesis', total: 3, concluidas: 2, pct: 67 })
    expect(m.get('Êxodo')).toEqual({ livro: 'Êxodo', total: 1, concluidas: 1, pct: 100 })
  })

  it('livro sem nenhuma concluída fica em 0%', () => {
    const m = progressoPorLivro(LISTA, new Set())
    expect(m.get('Gênesis')?.pct).toBe(0)
    expect(m.get('Êxodo')?.concluidas).toBe(0)
  })

  it('lista vazia devolve mapa vazio', () => {
    expect(progressoPorLivro([], new Set([1]))).toEqual(new Map())
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: FAIL — `progressoPorLivro` não existe em `./content`.

- [ ] **Step 3: Implementar `progressoPorLivro` em `src/lib/content.ts`**

Acrescentar no fim do arquivo:

```ts
export type LivroProgresso = {
  livro: string
  total: number
  concluidas: number
  /** 0–100, arredondado; 0 quando o livro não tem nenhuma perícope. */
  pct: number
}

/**
 * Contagem por livro na ordem de primeira aparição da lista recebida — a mesma
 * ordem em que o Índice agrupa, então o mapa serve direto para os cabeçalhos.
 */
export function progressoPorLivro(
  all: Pericope[],
  done: Set<number>,
): Map<string, LivroProgresso> {
  const out = new Map<string, LivroProgresso>()
  for (const p of all) {
    const atual = out.get(p.livro) ?? { livro: p.livro, total: 0, concluidas: 0, pct: 0 }
    atual.total += 1
    if (done.has(p.ordem)) atual.concluidas += 1
    out.set(p.livro, atual)
  }
  for (const v of out.values()) {
    v.pct = v.total ? Math.round((v.concluidas / v.total) * 100) : 0
  }
  return out
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: PASS — 4 antigos + 3 novos = 7 testes neste arquivo.

- [ ] **Step 5: Usar a barra em `src/pages/Indice.tsx`**

Trocar a linha de import de `../lib/content` por:

```tsx
import {
  listLivros,
  listPericopes,
  progressoPorLivro,
  refLabel,
  type LivroProgresso,
} from '../lib/content'
```

Acrescentar o componente logo depois de `PeriLink`:

```tsx
function BookProgress({ prog }: { prog: LivroProgresso }) {
  return (
    <span className="book-progress-wrap">
      {/* a barra é decoração: quem lê com leitor de tela recebe o "N de M" */}
      <span className="book-progress" aria-hidden>
        <span className="book-progress-fill" style={{ width: `${prog.pct}%` }} />
      </span>
      <span className="book-progress-label">
        {prog.concluidas} de {prog.total}
      </span>
    </span>
  )
}
```

Acrescentar as duas linhas logo depois do `useMemo` de `grouped`:

```tsx
  const progresso = useMemo(() => progressoPorLivro(items, done), [items, done])
  const progAberto = livro ? (progresso.get(livro) ?? null) : null
```

Substituir o bloco do ternário de render (do `{livro || q ? (` até o `)}` que fecha o `.map` dos grupos) por:

```tsx
      {livro || q ? (
        <>
          {progAberto && (
            <div className="book-group-head">
              <h2>{livro}</h2>
              <BookProgress prog={progAberto} />
            </div>
          )}
          <ul className="peri-list">
            {items.map((p) => (
              <li key={p.ordem}>
                <PeriLink p={p} done={done.has(p.ordem)} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        [...(grouped?.entries() ?? [])].map(([book, list]) => {
          const prog = progresso.get(book)
          return (
            <div key={book} className="book-group">
              <div className="book-group-head">
                <h2>
                  <button type="button" className="linkish" onClick={() => setLivro(book)}>
                    {book}
                  </button>
                </h2>
                {prog && <BookProgress prog={prog} />}
              </div>
              <ul className="peri-list compact">
                {list.slice(0, 5).map((p) => (
                  <li key={p.ordem}>
                    <PeriLink p={p} done={done.has(p.ordem)} />
                  </li>
                ))}
              </ul>
              {list.length > 5 && (
                <button type="button" className="ghost" onClick={() => setLivro(book)}>
                  Ver todas ({list.length})
                </button>
              )}
            </div>
          )
        })
      )}
```

(o cabeçalho do livro aberto só aparece com `livro` selecionado; com apenas `q` a lista continua chapada, porque uma barra sobre resultados de busca contaria o filtro, não o livro.)

- [ ] **Step 6: CSS em `src/styles/app.css`**

Acrescentar logo depois do bloco `.book-group { ... }`:

```css
.book-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.35rem;
}

.book-group-head h2 {
  margin: 0;
}

.book-progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-progress {
  width: 6rem;
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}

.book-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.book-progress-label {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 7: Rodar tudo, lint e build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS — 133 antigos + 3 novos = 136 testes; lint e build sem erro.

- [ ] **Step 8: Verificação visual (pré-dispensada)**

O que deveria ser visto: no Índice sem filtro, cada livro tem o nome à esquerda e, à direita, uma barrinha fina de 4px com a parte concluída na cor de destaque e o texto "12 de 50" ao lado; ao abrir um livro, o mesmo cabeçalho aparece acima da lista completa; marcar uma perícope como concluída e voltar ao Índice avança a barra; um livro sem nada concluído mostra a trilha vazia e "0 de N"; com apenas o campo de busca preenchido não aparece nenhuma barra.

- [ ] **Step 9: Commit**

```bash
git add src/lib/content.ts src/lib/content.test.ts src/pages/Indice.tsx src/styles/app.css
git commit -m "feat: barra de progresso por livro no índice"
```

---

## Cobertura do spec

| § do spec | Task |
| --- | --- |
| 1. Swipe entre perícopes | Task 1 |
| 2. Chips de âncora | Task 3 |
| 3. Atalhos de teclado | Task 2 |
| 4. Referência viva | Task 3 |
| 5. Busca full-text no texto bíblico | Tasks 4 (módulo + testes) e 5 (UI) |
| 6. Virtualização do Índice | Task 6 |
| 7. Barra de progresso por livro | Task 7 |
| Tratamento de erros (guards de `IntersectionObserver`, "Preparando busca…", cleanup) | Tasks 3, 4 e 5 |
