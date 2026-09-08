# Pacote 1 de UX de Leitura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nove melhorias de leitura 100% no cliente: texto corrido por padrão, posição de leitura restaurada, popover "Aa", modo imersivo, fontes self-hosted, navegação anterior/próxima, concluir→card próxima, alinhamento à esquerda no mobile e safe areas iOS.

**Architecture:** Tudo no cliente React (Vite + PWA). Funções puras novas em `src/lib/` (agrupamento corrido, posição de leitura, perícope anterior), um componente novo `src/components/ReadingMenu.tsx`, um hook `src/lib/use-hide-on-scroll.ts`, e mudanças em `Leitura.tsx`, `App.tsx`, `app.css`, `index.html` e `main.tsx`. Nenhuma mudança em Worker, D1 ou sync.

**Tech Stack:** React 19, react-router-dom 7, Vitest 4 (+ happy-dom para testes com DOM), @fontsource-variable, vite-plugin-pwa/workbox.

**Spec:** `docs/superpowers/specs/2026-08-31-ux-leitura-pacote1-design.md`

## Global Constraints

- Pacote 100% cliente: **nenhuma** mudança em `worker/`, `migrations/`, `wrangler.jsonc` ou API.
- Tipografia (alinhamento, fontes, tamanho) vale para TODAS as seções em prosa (contexto, resenha, reflexão, tópicos), não só o texto NAA; o modo corrido/blocos é exclusivo do texto bíblico.
- Modo padrão do texto NAA: `'corrido'`; prefs antigas em localStorage sem `layout` recebem `'corrido'`.
- localStorage indisponível/corrompido nunca quebra a leitura: try/catch retornando padrão (padrão dos módulos existentes `reading-prefs.ts` / `verse-highlight.ts`).
- Textos de UI em pt-BR.
- Header auto-oculto SÓ na rota `/leitura/:ordem`; respeitar `prefers-reduced-motion`.
- Rolagem automática até versículo destacado SÓ quando vier de `?v=` na URL; caso contrário vale posição salva, senão topo.
- Comandos: testes `npm test`, lint `npm run lint`, build `npm run build`. A suíte atual tem 46 testes — todos devem continuar verdes em toda task.
- Testes que tocam DOM/localStorage usam pragma `// @vitest-environment happy-dom` no topo do arquivo (o ambiente padrão do projeto é node; não criar vitest.config).

---

### Task 1: Fundações — `groupCorrido` + preferência `layout`

**Files:**
- Modify: `src/lib/parse-texto.ts`
- Modify: `src/lib/reading-prefs.ts`
- Create: `src/lib/parse-texto.test.ts`
- Create: `src/lib/reading-prefs.test.ts`
- Modify: `package.json` (devDependency `happy-dom`)

**Interfaces:**
- Consumes: `parseTextoNaa(raw): TextoBlock[]` existente.
- Produces: `groupCorrido(blocks: TextoBlock[]): CorridoGroup[]` com `CorridoGroup = { chapter: number; label: string | null; verses: VerseBlock[] }` e `VerseBlock = Extract<TextoBlock, { kind: 'verse' }>`; `type ReadingLayout = 'corrido' | 'blocos'`; `ReadingPrefs` ganha campo `layout: ReadingLayout`; `setReadingLayout(layout: ReadingLayout): ReadingPrefs`. Tasks 2 e 3 dependem destes nomes exatos.

- [ ] **Step 1: Instalar happy-dom**

```bash
npm install -D happy-dom
```

- [ ] **Step 2: Escrever os testes que falham — `groupCorrido`**

Criar `src/lib/parse-texto.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupCorrido, parseTextoNaa } from './parse-texto'

describe('groupCorrido', () => {
  it('agrupa versículos por capítulo, com rótulo', () => {
    const blocks = parseTextoNaa('Capítulo 1\n1 No princípio\n2 A terra\nCapítulo 2\n1 Assim foram')
    const groups = groupCorrido(blocks)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ chapter: 1, label: 'Capítulo 1' })
    expect(groups[0].verses.map((v) => v.id)).toEqual(['1:1', '1:2'])
    expect(groups[1]).toMatchObject({ chapter: 2, label: 'Capítulo 2' })
    expect(groups[1].verses.map((v) => v.id)).toEqual(['2:1'])
  })

  it('versículos órfãos antes do primeiro capítulo formam grupo com label null', () => {
    const blocks = parseTextoNaa('linha solta\nCapítulo 3\n1 Verso um')
    const groups = groupCorrido(blocks)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBeNull()
    expect(groups[0].verses).toHaveLength(1)
    expect(groups[0].verses[0].text).toBe('linha solta')
    expect(groups[1].label).toBe('Capítulo 3')
  })

  it('entrada vazia retorna []', () => {
    expect(groupCorrido([])).toEqual([])
    expect(groupCorrido(parseTextoNaa(''))).toEqual([])
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/parse-texto.test.ts`
Expected: FAIL — `groupCorrido` não exportado.

- [ ] **Step 4: Implementar `groupCorrido`**

Acrescentar ao fim de `src/lib/parse-texto.ts`:

```ts
export type VerseBlock = Extract<TextoBlock, { kind: 'verse' }>

export type CorridoGroup = {
  chapter: number
  label: string | null
  verses: VerseBlock[]
}

/** Um grupo fluido por capítulo, para o modo de leitura corrido. */
export function groupCorrido(blocks: TextoBlock[]): CorridoGroup[] {
  const groups: CorridoGroup[] = []
  let current: CorridoGroup | null = null
  for (const b of blocks) {
    if (b.kind === 'chapter') {
      current = { chapter: b.chapter, label: b.label, verses: [] }
      groups.push(current)
    } else {
      if (!current) {
        current = { chapter: b.chapter, label: null, verses: [] }
        groups.push(current)
      }
      current.verses.push(b)
    }
  }
  return groups
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/parse-texto.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Escrever os testes que falham — `layout` em reading-prefs**

Criar `src/lib/reading-prefs.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { getReadingPrefs, setReadingLayout } from './reading-prefs'

describe('reading-prefs layout', () => {
  beforeEach(() => localStorage.clear())

  it('padrão é corrido', () => {
    expect(getReadingPrefs().layout).toBe('corrido')
  })

  it('prefs antigas sem layout recebem corrido', () => {
    localStorage.setItem('pericopes-reading', JSON.stringify({ sizeStep: 3, font: 'sans' }))
    const prefs = getReadingPrefs()
    expect(prefs).toMatchObject({ sizeStep: 3, font: 'sans', layout: 'corrido' })
  })

  it('setReadingLayout persiste e valor inválido volta ao padrão', () => {
    setReadingLayout('blocos')
    expect(getReadingPrefs().layout).toBe('blocos')
    localStorage.setItem('pericopes-reading', JSON.stringify({ layout: 'zigue' }))
    expect(getReadingPrefs().layout).toBe('corrido')
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/reading-prefs.test.ts`
Expected: FAIL — `layout`/`setReadingLayout` não existem.

- [ ] **Step 8: Implementar `layout` em `reading-prefs.ts`**

Mudanças em `src/lib/reading-prefs.ts`:

```ts
export type ReadingLayout = 'corrido' | 'blocos'

export type ReadingPrefs = {
  sizeStep: number
  font: ReadingFont
  layout: ReadingLayout
}
```

`DEFAULTS` vira `{ sizeStep: 2, font: 'serif', layout: 'corrido' }`.

Em `getReadingPrefs`, após o cálculo de `font`:

```ts
    const layout: ReadingLayout = parsed.layout === 'blocos' ? 'blocos' : 'corrido'
    return { sizeStep, font, layout }
```

Nova função no fim do arquivo (mesmo padrão de `setReadingFont`):

```ts
export function setReadingLayout(layout: ReadingLayout): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.layout = layout
  applyReadingPrefs(prefs)
  return prefs
}
```

`applyReadingPrefs` não muda (layout não tem variável CSS; só persiste junto).

- [ ] **Step 9: Rodar tudo e ver verde**

Run: `npm test`
Expected: PASS — 46 antigos + 6 novos.

- [ ] **Step 10: Commit**

```bash
git add src/lib/parse-texto.ts src/lib/parse-texto.test.ts src/lib/reading-prefs.ts src/lib/reading-prefs.test.ts package.json package-lock.json
git commit -m "feat: groupCorrido e preferência de layout corrido/blocos"
```

---

### Task 2: Renderização do texto corrido em `Leitura.tsx`

**Files:**
- Modify: `src/pages/Leitura.tsx` (seção "Texto (NAA)", ~linhas 207–234; imports)
- Modify: `src/styles/app.css` (após o bloco `.verse-text`, ~linha 616)

**Interfaces:**
- Consumes: `groupCorrido`, `CorridoGroup` (Task 1); `prefs.layout` (Task 1); estado `focusId`/`selectVerse` existentes.
- Produces: classes CSS `.corrido-group`, `.corrido`, `.verse-inline` (o modo blocos mantém `.verse`). O destaque em ambos os modos usa a classe `verse-focus`.

- [ ] **Step 1: Renderização condicional por layout**

Em `src/pages/Leitura.tsx`:

1. Acrescentar `Fragment` ao import do React: `import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react'`.
2. Acrescentar `groupCorrido` ao import de parse-texto: `import { groupCorrido, parseTextoNaa } from '../lib/parse-texto'`.
3. Substituir o conteúdo de `<div className="texto-biblico">` por:

```tsx
        <div className="texto-biblico">
          {prefs.layout === 'corrido'
            ? groupCorrido(blocks).map((g, gi) => (
                <div key={g.label ? `c-${g.chapter}` : `orfao-${gi}`} className="corrido-group">
                  {g.label && <h3 className="cap-label">{g.label}</h3>}
                  <p className="corrido">
                    {g.verses.map((b) => (
                      <Fragment key={b.id}>
                        <button
                          type="button"
                          className={`verse-inline${focusId === b.id ? ' verse-focus' : ''}`}
                          aria-pressed={focusId === b.id}
                          aria-label={
                            b.verse
                              ? `Versículo ${b.chapter}:${b.verse}${focusId === b.id ? ', em leitura' : ''}`
                              : b.text.slice(0, 40)
                          }
                          onClick={() => selectVerse(b.id)}
                        >
                          {b.verse > 0 && <sup className="verse-num">{b.verse}</sup>}
                          <span className="verse-text">{b.text}</span>
                        </button>{' '}
                      </Fragment>
                    ))}
                  </p>
                </div>
              ))
            : blocks.map((b) =>
                b.kind === 'chapter' ? (
                  <h3 key={`c-${b.chapter}`} className="cap-label">
                    {b.label}
                  </h3>
                ) : (
                  <button
                    key={b.id}
                    type="button"
                    className={`verse${focusId === b.id ? ' verse-focus' : ''}`}
                    aria-pressed={focusId === b.id}
                    aria-label={
                      b.verse
                        ? `Versículo ${b.chapter}:${b.verse}${focusId === b.id ? ', em leitura' : ''}`
                        : b.text.slice(0, 40)
                    }
                    onClick={() => selectVerse(b.id)}
                  >
                    {b.verse > 0 && <sup className="verse-num">{b.verse}</sup>}
                    <span className="verse-text">{b.text}</span>
                  </button>
                ),
              )}
        </div>
```

4. No effect de rolagem até o versículo (~linha 117–121), trocar o seletor `.verse.verse-focus` por `.verse-focus` (funciona nos dois modos):

```tsx
    const el = document.querySelector('.verse-focus')
```

- [ ] **Step 2: CSS do modo corrido**

Em `src/styles/app.css`, logo após a regra `.verse-text` (~linha 616), acrescentar:

```css
.corrido-group {
  margin: 0 0 0.9rem;
}

.corrido {
  margin: 0;
  max-width: var(--measure);
  font-family: inherit;
  line-height: 1.75;
}

.verse-inline {
  display: inline;
  font: inherit;
  color: inherit;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 0;
  margin: 0;
  text-align: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.verse-inline:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}

.verse-inline:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.verse-inline.verse-focus {
  background: var(--focus-bg);
  box-shadow: 0 0 0 3px var(--focus-bg);
}
```

(`.texto-biblico` já define `font-family: var(--read-font)` e `font-size: var(--read-size)` — `.corrido` herda.)

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev` e abrir `http://localhost:5173/leitura/1`.
Expected: texto flui em parágrafo por capítulo, número sobrescrito, toque destaca o versículo (fundo verde suave) e novo toque remove. Definir `localStorage['pericopes-reading']` com `{"layout":"blocos"}` no console + reload mostra o modo blocos antigo.

- [ ] **Step 4: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: texto bíblico corrido em parágrafos (padrão) com modo blocos opcional"
```

---

### Task 3: Popover "Aa" (`ReadingMenu.tsx`)

**Files:**
- Create: `src/components/ReadingMenu.tsx`
- Modify: `src/pages/Leitura.tsx` (remove `.read-toolbar` e handlers `onSize`/`onFont`, ~linhas 142–148 e 171–196)
- Modify: `src/lib/theme.ts` (evento de sincronização)
- Modify: `src/App.tsx` (ouvir o evento)
- Modify: `src/styles/app.css` (remove `.read-toolbar`; adiciona `.ref-row`, `.readmenu*`)

**Interfaces:**
- Consumes: `bumpReadingSize`, `setReadingFont`, `setReadingLayout`, `FONT_OPTIONS`, `SIZE_STEPS`, `ReadingPrefs`, `ReadingLayout` (reading-prefs); `resolveTheme`, `toggleTheme`, `Theme` (theme).
- Produces: `<ReadingMenu prefs={prefs} onPrefs={setPrefs} />`; evento `window` `'pericopes-theme'` disparado por `applyTheme`. A Task 5 acrescenta vizinhos à `.ref-row` criada aqui.

- [ ] **Step 1: Evento de tema em `theme.ts`**

Em `applyTheme`, após `localStorage.setItem(KEY, theme)`:

```ts
  window.dispatchEvent(new Event('pericopes-theme'))
```

- [ ] **Step 2: App ouve o evento**

Em `src/App.tsx`, junto aos outros effects:

```tsx
  useEffect(() => {
    const onTheme = () => setTheme(resolveTheme())
    window.addEventListener('pericopes-theme', onTheme)
    return () => window.removeEventListener('pericopes-theme', onTheme)
  }, [])
```

(`resolveTheme` já está importado de `./lib/theme`.)

Atenção ao effect existente `useEffect(() => { applyTheme(theme) }, [theme])`: `applyTheme` agora dispara o evento, que chama `setTheme(resolveTheme())` — como o valor resolvido é igual ao aplicado, o React não re-renderiza (mesmo valor) e não há loop.

- [ ] **Step 3: Criar `src/components/ReadingMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import {
  bumpReadingSize,
  FONT_OPTIONS,
  setReadingFont,
  setReadingLayout,
  SIZE_STEPS,
  type ReadingLayout,
  type ReadingPrefs,
} from '../lib/reading-prefs'
import { resolveTheme, toggleTheme, type Theme } from '../lib/theme'

type Props = {
  prefs: ReadingPrefs
  onPrefs: (p: ReadingPrefs) => void
}

const LAYOUTS: { id: ReadingLayout; label: string }[] = [
  { id: 'corrido', label: 'Corrido' },
  { id: 'blocos', label: 'Blocos' },
]

export default function ReadingMenu({ prefs, onPrefs }: Props) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => resolveTheme())
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="readmenu" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="read-tool readmenu-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Aa
      </button>
      {open && (
        <div className="readmenu-pop" role="dialog" aria-label="Preferências de leitura">
          <div className="readmenu-row" role="group" aria-label="Tamanho do texto">
            <button
              type="button"
              className="read-tool"
              disabled={prefs.sizeStep === 0}
              aria-label="Diminuir texto"
              onClick={() => onPrefs(bumpReadingSize(-1))}
            >
              A−
            </button>
            <button
              type="button"
              className="read-tool"
              disabled={prefs.sizeStep === SIZE_STEPS.length - 1}
              aria-label="Aumentar texto"
              onClick={() => onPrefs(bumpReadingSize(1))}
            >
              A+
            </button>
          </div>
          <div className="readmenu-row" role="group" aria-label="Fonte">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`read-tool${prefs.font === f.id ? ' active' : ''}`}
                aria-pressed={prefs.font === f.id}
                onClick={() => onPrefs(setReadingFont(f.id))}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="readmenu-row" role="group" aria-label="Modo do texto bíblico">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`read-tool${prefs.layout === l.id ? ' active' : ''}`}
                aria-pressed={prefs.layout === l.id}
                onClick={() => onPrefs(setReadingLayout(l.id))}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="readmenu-row" role="group" aria-label="Tema">
            <button
              type="button"
              className="read-tool"
              onClick={() => {
                toggleTheme()
                setTheme(resolveTheme())
              }}
            >
              {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Usar em `Leitura.tsx`**

1. Import: `import ReadingMenu from '../components/ReadingMenu'`.
2. Remover do import de reading-prefs os símbolos que ficaram sem uso na página (`bumpReadingSize`, `FONT_OPTIONS`, `setReadingFont`, `ReadingFont`) — manter `getReadingPrefs` e `ReadingPrefs`.
3. Remover as funções `onSize` e `onFont`.
4. Substituir `<p className="ref">{refLabel(p)}</p>` + todo o `<div className="read-toolbar">…</div>` por:

```tsx
      <div className="ref-row">
        <p className="ref">{refLabel(p)}</p>
        <ReadingMenu prefs={prefs} onPrefs={setPrefs} />
      </div>
```

- [ ] **Step 5: CSS**

Em `src/styles/app.css`: remover as regras `.read-toolbar`, `.read-size, .read-fonts` e `.read-size-label` (~linhas 479–510; **manter** `.read-tool` e variantes — são reutilizadas). No lugar, adicionar:

```css
.ref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0 0 1rem;
}

.ref-row .ref {
  margin: 0;
}

.readmenu {
  position: relative;
}

.readmenu-btn {
  font-family: var(--font-display);
  min-width: 2.75rem;
  min-height: 2.5rem;
}

.readmenu-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  z-index: 6;
  min-width: 230px;
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 10px 28px rgb(0 0 0 / 0.14);
}

.readmenu-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
```

Se `.ref` tiver `margin` próprio na regra existente (~linha 264), a sobrescrita `.ref-row .ref { margin: 0 }` acima já cobre.

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev` → `/leitura/1`.
Expected: botão "Aa" ao lado da referência; popover com tamanho/fonte/modo/tema; fecha com Esc (foco volta ao botão), toque fora e novo toque no botão; trocar tema pelo popover atualiza o rótulo do botão do header ("Claro"/"Escuro") sem reload.

- [ ] **Step 7: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add src/components/ReadingMenu.tsx src/pages/Leitura.tsx src/lib/theme.ts src/App.tsx src/styles/app.css
git commit -m "feat: popover Aa com tamanho, fonte, modo e tema"
```

---

### Task 4: Posição de leitura restaurada

**Files:**
- Create: `src/lib/reading-position.ts`
- Create: `src/lib/reading-position.test.ts`
- Modify: `src/pages/Leitura.tsx` (effects de rolagem, ~linhas 113–121)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `getReadingPosition(ordem: number): number | null`, `setReadingPosition(ordem: number, y: number): void`, `clearReadingPosition(ordem: number): void` — a Task 6 chama `clearReadingPosition` ao concluir.

- [ ] **Step 1: Testes que falham**

Criar `src/lib/reading-position.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { clearReadingPosition, getReadingPosition, setReadingPosition } from './reading-position'

describe('reading-position', () => {
  beforeEach(() => localStorage.clear())

  it('salva e lê por perícope', () => {
    setReadingPosition(12, 340.7)
    expect(getReadingPosition(12)).toBe(341)
    expect(getReadingPosition(13)).toBeNull()
  })

  it('clear remove só a perícope pedida', () => {
    setReadingPosition(1, 100)
    setReadingPosition(2, 200)
    clearReadingPosition(1)
    expect(getReadingPosition(1)).toBeNull()
    expect(getReadingPosition(2)).toBe(200)
  })

  it('JSON corrompido é tratado como vazio', () => {
    localStorage.setItem('pericopes-reading-pos', '{nope')
    expect(getReadingPosition(1)).toBeNull()
    setReadingPosition(1, 50)
    expect(getReadingPosition(1)).toBe(50)
  })

  it('valores negativos são normalizados para 0', () => {
    setReadingPosition(3, -20)
    expect(getReadingPosition(3)).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/reading-position.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/lib/reading-position.ts`**

Mesmo padrão de `verse-highlight.ts`:

```ts
const KEY = 'pericopes-reading-pos'

type Store = Record<string, { y: number }>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
}

export function getReadingPosition(ordem: number): number | null {
  const entry = read()[String(ordem)]
  return entry && typeof entry.y === 'number' && Number.isFinite(entry.y) ? entry.y : null
}

export function setReadingPosition(ordem: number, y: number) {
  const store = read()
  store[String(ordem)] = { y: Math.max(0, Math.round(y)) }
  write(store)
}

export function clearReadingPosition(ordem: number) {
  const store = read()
  delete store[String(ordem)]
  write(store)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/reading-position.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Integrar em `Leitura.tsx`**

1. Import: `import { getReadingPosition, setReadingPosition } from '../lib/reading-position'`.
2. Substituir o effect `useEffect(() => { window.scrollTo(0, 0) }, [ordem, p])` por:

```tsx
  // Prioridade de rolagem ao abrir: ?v= na URL > posição salva > topo.
  useEffect(() => {
    if (!p) return
    if (verseParam && /^\d+:\d+$/.test(verseParam)) return
    window.scrollTo(0, getReadingPosition(ordem) ?? 0)
  }, [ordem, p, verseParam])
```

3. Restringir a rolagem até o versículo destacado ao caso `?v=` (o destaque visual continua nos dois casos):

```tsx
  useEffect(() => {
    if (!focusId || !p) return
    if (!(verseParam && /^\d+:\d+$/.test(verseParam))) return
    const el = document.querySelector('.verse-focus')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusId, p, verseParam])
```

4. Novo effect de gravação com throttle (~500 ms), por perícope:

```tsx
  useEffect(() => {
    let last = 0
    let timer: number | undefined
    const save = () => setReadingPosition(ordem, window.scrollY)
    const onScroll = () => {
      const now = Date.now()
      if (now - last > 500) {
        last = now
        save()
      } else {
        window.clearTimeout(timer)
        timer = window.setTimeout(save, 500)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [ordem])
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev` → `/leitura/1`, rolar até a resenha, navegar para "Hoje", voltar a `/leitura/1`.
Expected: página reabre na resenha (sem animação). Abrir `/leitura/1?v=1:3` rola até o versículo. Perícope nunca visitada abre no topo.

- [ ] **Step 7: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reading-position.ts src/lib/reading-position.test.ts src/pages/Leitura.tsx
git commit -m "feat: restaurar posição de leitura por perícope"
```

---

### Task 5: Navegação anterior/próxima

**Files:**
- Modify: `src/lib/content.ts` (após `proximaNoTestamento`, ~linha 70)
- Create: `src/lib/content.test.ts`
- Modify: `src/pages/Leitura.tsx` (estado de vizinhos; `.ref-row`; seção `.actions`)
- Modify: `src/styles/app.css` (`.ref-nav`, `.pager`)

**Interfaces:**
- Consumes: `ordensDoTestamento`, `proximaNoTestamento`, `testamentOf` existentes; `.ref-row` e `ReadingMenu` (Task 3).
- Produces: `anteriorNoTestamento(all: Pericope[], ordem: number): number | null`; em `Leitura.tsx`, estados `prev`/`next` do tipo `Vizinha = { ordem: number; titulo: string } | null` — a Task 6 usa `next` para o card de conclusão. O estado antigo `nextOrdem` é substituído por `next`.

- [ ] **Step 1: Testes que falham**

Criar `src/lib/content.test.ts` (ambiente node; fixtures mínimas com cast):

```ts
import { describe, expect, it } from 'vitest'
import { anteriorNoTestamento, proximaNoTestamento } from './content'
import type { Pericope } from './types'

function peri(ordem: number, abbrev: string): Pericope {
  return { ordem, abbrev, livro: abbrev, titulo_pericope_pt: `P${ordem}` } as Pericope
}

// Gn (VT) ordens 1-2; Mt (NT) ordens 3-4
const ALL = [peri(1, 'Gn'), peri(2, 'Gn'), peri(3, 'Mt'), peri(4, 'Mt')]

describe('anteriorNoTestamento', () => {
  it('volta uma perícope dentro do testamento', () => {
    expect(anteriorNoTestamento(ALL, 2)).toBe(1)
    expect(anteriorNoTestamento(ALL, 4)).toBe(3)
  })

  it('primeira do testamento não tem anterior (não cruza a fronteira)', () => {
    expect(anteriorNoTestamento(ALL, 1)).toBeNull()
    expect(anteriorNoTestamento(ALL, 3)).toBeNull()
  })

  it('ordem inexistente retorna null', () => {
    expect(anteriorNoTestamento(ALL, 99)).toBeNull()
  })

  it('espelha proximaNoTestamento na outra ponta', () => {
    expect(proximaNoTestamento(ALL, 2)).toBeNull()
    expect(proximaNoTestamento(ALL, 1)).toBe(2)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: FAIL — `anteriorNoTestamento` não exportado.

- [ ] **Step 3: Implementar em `content.ts`**

Logo após `proximaNoTestamento`:

```ts
export function anteriorNoTestamento(all: Pericope[], ordem: number): number | null {
  const found = all.find((p) => p.ordem === ordem)
  if (!found) return null
  const seq = ordensDoTestamento(all, testamentOf(found))
  const i = seq.indexOf(ordem)
  if (i <= 0) return null
  return seq[i - 1]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/content.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Estado de vizinhos em `Leitura.tsx`**

1. Import: acrescentar `anteriorNoTestamento` ao import de `../lib/content`.
2. Substituir `const [nextOrdem, setNextOrdem] = useState<number | null>(null)` por:

```tsx
  type Vizinha = { ordem: number; titulo: string }
  const [prev, setPrev] = useState<Vizinha | null>(null)
  const [next, setNext] = useState<Vizinha | null>(null)
```

(declarar o `type Vizinha` fora do componente, junto ao `type NotesTab`.)

3. No effect de carga, substituir `setNextOrdem(proximaNoTestamento(all, ordem))` por:

```tsx
        const vizinha = (o: number | null): Vizinha | null => {
          if (o == null) return null
          const v = all.find((x) => x.ordem === o)
          return v ? { ordem: v.ordem, titulo: v.titulo_pericope_pt } : null
        }
        setPrev(vizinha(anteriorNoTestamento(all, ordem)))
        setNext(vizinha(proximaNoTestamento(all, ordem)))
```

4. No rodapé (`.actions`), substituir o link `Próxima →` existente (bloco `{nextOrdem != null && (...)}`) por:

```tsx
          <nav className="pager" aria-label="Navegação entre perícopes">
            {prev ? (
              <Link className="ghost pager-link" to={`/leitura/${prev.ordem}`}>
                ← {prev.titulo}
              </Link>
            ) : (
              <span aria-hidden />
            )}
            {next ? (
              <Link className="ghost pager-link pager-next" to={`/leitura/${next.ordem}`}>
                {next.titulo} →
              </Link>
            ) : (
              <span aria-hidden />
            )}
          </nav>
```

5. Na `.ref-row` (Task 3), inserir as setas antes do `ReadingMenu`:

```tsx
      <div className="ref-row">
        <p className="ref">{refLabel(p)}</p>
        <div className="ref-nav">
          {prev && (
            <Link className="read-tool ref-arrow" aria-label={`Anterior: ${prev.titulo}`} to={`/leitura/${prev.ordem}`}>
              ←
            </Link>
          )}
          {next && (
            <Link className="read-tool ref-arrow" aria-label={`Próxima: ${next.titulo}`} to={`/leitura/${next.ordem}`}>
              →
            </Link>
          )}
          <ReadingMenu prefs={prefs} onPrefs={setPrefs} />
        </div>
      </div>
```

- [ ] **Step 6: CSS**

Em `app.css`, após as regras `.readmenu*`:

```css
.ref-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.ref-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  min-height: 2.5rem;
  text-decoration: none;
}

.pager {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.75rem;
  font-family: var(--font-ui);
}

.pager-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  max-width: 48%;
}

.pager-next {
  text-align: end;
  margin-left: auto;
}
```

- [ ] **Step 7: Verificar manualmente**

Run: `npm run dev` → `/leitura/2`.
Expected: setas ← → junto à referência; rodapé com títulos das vizinhas; `/leitura/1` (primeira de Gênesis) sem seta/link de anterior.

- [ ] **Step 8: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add src/lib/content.ts src/lib/content.test.ts src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: navegação anterior/próxima no topo e rodapé da leitura"
```

---

### Task 6: Concluir → card "Próxima"

**Files:**
- Modify: `src/pages/Leitura.tsx` (função `markDone`; bloco de status em `.actions`)
- Modify: `src/styles/app.css` (`.done-card`)

**Interfaces:**
- Consumes: `next: Vizinha | null` (Task 5); `clearReadingPosition` (Task 4).
- Produces: nada consumido adiante.

- [ ] **Step 1: `markDone` limpa a posição**

```tsx
  async function markDone() {
    await setProgresso(ordem, 'concluido')
    clearReadingPosition(ordem)
    setStatus('concluido')
  }
```

Acrescentar `clearReadingPosition` ao import de `../lib/reading-position`.

- [ ] **Step 2: Card no lugar do badge**

No bloco `.actions`, substituir o par botão/badge por:

```tsx
          {status !== 'concluido' ? (
            <button type="button" className="cta" onClick={markDone}>
              Marcar como concluída
            </button>
          ) : next ? (
            <Link className="done-card" to={`/leitura/${next.ordem}`}>
              <span className="badge">Concluída ✓</span>
              <span className="done-next">
                Próxima: <strong>{next.titulo}</strong> →
              </span>
            </Link>
          ) : (
            <p className="badge">Concluída ✓</p>
          )}
```

(o `<nav className="pager">` da Task 5 permanece logo abaixo.)

- [ ] **Step 3: CSS**

Em `app.css`, junto a `.badge` (~linha 714):

```css
.done-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 1px solid var(--focus-line);
  border-radius: var(--radius);
  background: var(--focus-bg);
  color: var(--ink);
  text-decoration: none;
  font-family: var(--font-ui);
}

.done-card .badge {
  margin: 0;
}

.done-next {
  font-size: 0.95rem;
}
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev` → perícope não concluída → "Marcar como concluída".
Expected: botão vira card "Concluída ✓ · Próxima: <título> →"; toque navega e a nova perícope abre no topo (posição limpa). Última perícope de um testamento concluída mostra só "Concluída ✓". Reabrir perícope já concluída mostra o card direto.

- [ ] **Step 5: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: concluir mostra card com a próxima perícope"
```

---

### Task 7: Fontes self-hosted (@fontsource-variable)

**Files:**
- Modify: `package.json` (5 dependências novas)
- Modify: `src/main.tsx` (imports de fonte)
- Modify: `src/styles/app.css` (remove `@import`; atualiza stacks nas linhas 1 e nas vars `--font-display`/`--font-body`/`--font-ui`/`--read-font`)
- Modify: `src/lib/reading-prefs.ts` (stacks em `FONT_OPTIONS`)
- Modify: `index.html` (remove os 2 `preconnect`; atualiza o mapa `fonts` do script inline)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: famílias com sufixo ` Variable` usadas em CSS e prefs. Nomes exatos: `'Literata Variable'`, `'Source Serif 4 Variable'`, `'Source Sans 3 Variable'`, `'Fraunces Variable'`, `'DM Sans Variable'`.

- [ ] **Step 1: Instalar**

```bash
npm install @fontsource-variable/literata @fontsource-variable/source-serif-4 @fontsource-variable/source-sans-3 @fontsource-variable/fraunces @fontsource-variable/dm-sans
```

- [ ] **Step 2: Importar no `src/main.tsx`** (antes de `./styles/app.css`)

```tsx
import '@fontsource-variable/literata'
import '@fontsource-variable/source-serif-4'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/dm-sans'
```

- [ ] **Step 3: Atualizar `app.css`**

1. Apagar a linha 1 (`@import url('https://fonts.googleapis.com/...')`).
2. Nas variáveis do `:root`:

```css
  --font-display: 'Fraunces Variable', Georgia, serif;
  --font-body: 'Source Serif 4 Variable', Georgia, serif;
  --font-ui: 'DM Sans Variable', system-ui, sans-serif;
  --read-font: 'Source Serif 4 Variable', Georgia, serif;
```

- [ ] **Step 4: Atualizar `FONT_OPTIONS` em `reading-prefs.ts`**

```ts
export const FONT_OPTIONS: { id: ReadingFont; label: string; stack: string }[] = [
  { id: 'serif', label: 'Serif', stack: "'Source Serif 4 Variable', Georgia, serif" },
  { id: 'literata', label: 'Literata', stack: "'Literata Variable', Georgia, serif" },
  { id: 'sans', label: 'Sans', stack: "'Source Sans 3 Variable', 'DM Sans Variable', system-ui, sans-serif" },
]
```

- [ ] **Step 5: Atualizar `index.html`**

1. Remover as duas linhas `<link rel="preconnect" ...>` (fonts.googleapis.com / fonts.gstatic.com).
2. No script inline, atualizar o mapa:

```js
          var fonts = {
            serif: "'Source Serif 4 Variable', Georgia, serif",
            literata: "'Literata Variable', Georgia, serif",
            sans: "'Source Sans 3 Variable', 'DM Sans Variable', system-ui, sans-serif",
          }
```

- [ ] **Step 6: Build e verificar precache**

Run: `npm run build && ls dist/assets/*.woff2 | head && grep -c woff2 dist/sw.js`
Expected: arquivos `.woff2` no build; contagem > 0 no `sw.js` (workbox já usa `globPatterns` com woff2; `maximumFileSizeToCacheInBytes` de 16 MB tem folga).

- [ ] **Step 7: Verificar manualmente**

Run: `npm run dev` → aba Network sem nenhuma requisição a `fonts.googleapis.com`/`fonts.gstatic.com`; tipografia visualmente igual (Fraunces no título, serifada no texto).

- [ ] **Step 8: Lint e testes**

Run: `npm run lint && npm test`
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/styles/app.css src/lib/reading-prefs.ts index.html
git commit -m "feat: fontes self-hosted via fontsource — tipografia offline no PWA"
```

---

### Task 8: Modo imersivo (header auto-oculto)

**Files:**
- Create: `src/lib/use-hide-on-scroll.ts`
- Modify: `src/App.tsx` (componente interno com `useLocation`)
- Modify: `src/styles/app.css` (`.top` transition + `.top-hidden`)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `useHideOnScroll(enabled: boolean, threshold?: number): boolean`.

- [ ] **Step 1: Criar `src/lib/use-hide-on-scroll.ts`**

```ts
import { useEffect, useState } from 'react'

/**
 * Header auto-oculto: esconder ao rolar para baixo além do limiar,
 * mostrar ao rolar para cima ou perto do topo. Só ativo quando enabled.
 */
export function useHideOnScroll(enabled: boolean, threshold = 80): boolean {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setHidden(false)
      return
    }
    let lastY = window.scrollY
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        if (y <= threshold) setHidden(false)
        else if (y > lastY + 4) setHidden(true)
        else if (y < lastY - 4) setHidden(false)
        lastY = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [enabled, threshold])

  return hidden
}
```

- [ ] **Step 2: Usar em `App.tsx`**

`useLocation` só funciona dentro do Router, então o miolo vira componente interno. Estrutura final de `App.tsx` (mantendo todo o conteúdo atual do header/main):

```tsx
import { useLocation } from 'react-router-dom' // somar ao import existente

function Shell() {
  // ...todo o corpo atual de App() exceto o <BrowserRouter> externo:
  // estados de theme/session, effects, e o JSX de <div className="shell">
  const { pathname } = useLocation()
  const headerHidden = useHideOnScroll(pathname.startsWith('/leitura/'))
  // no JSX:
  // <header className={`top${headerHidden ? ' top-hidden' : ''}`}>
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
```

Import do hook: `import { useHideOnScroll } from './lib/use-hide-on-scroll'`.

- [ ] **Step 3: CSS**

Na regra `.top` existente (~linha 112), acrescentar `transition: transform 0.25s ease;` e depois dela:

```css
.top-hidden {
  transform: translateY(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .top {
    transition: none;
  }
}
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev` → `/leitura/1` em viewport mobile (devtools).
Expected: rolar para baixo esconde o header (desliza para cima); rolar para cima em qualquer ponto o traz de volta; perto do topo sempre visível. Em `/`, `/indice`, `/pesquisar` o header nunca esconde.

- [ ] **Step 5: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/use-hide-on-scroll.ts src/App.tsx src/styles/app.css
git commit -m "feat: modo imersivo — header auto-oculto na leitura"
```

---

### Task 9: Safe areas iOS + alinhamento à esquerda no mobile

**Files:**
- Modify: `index.html` (viewport meta)
- Modify: `src/styles/app.css` (media query de justificado ~linhas 644–652; paddings `.shell` e `.top`)

**Interfaces:**
- Consumes: nada.
- Produces: nada consumido adiante.

- [ ] **Step 1: Viewport**

Em `index.html`:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 2: Remover justificado no mobile**

Em `app.css`, apagar o bloco inteiro:

```css
/* ponytail: mobile long-form reading comfort */
@media (max-width: 767.98px) {
  .prose,
  .perguntas,
  .verse {
    text-align: justify;
    -webkit-hyphens: auto;
    hyphens: auto;
  }
}
```

(sem substituto: `text-align` volta ao padrão `start` herdado, em todas as seções de prosa e nos dois modos do texto bíblico.)

- [ ] **Step 3: Safe areas**

Em `app.css`:

1. Na regra `.shell`, trocar o padding por (ordem CSS: top, right, bottom, left):

```css
  padding: 0 max(var(--shell-pad), env(safe-area-inset-right, 0px))
    calc(3rem + env(safe-area-inset-bottom, 0px))
    max(var(--shell-pad), env(safe-area-inset-left, 0px));
```

2. Na regra `.top`, somar o inset ao padding-top (o header é sticky no topo):

```css
  padding-top: calc(0.85rem + env(safe-area-inset-top, 0px));
```

3. Na variante `.shell:has(.leitura) .top`, idem:

```css
  padding-block: calc(0.55rem + env(safe-area-inset-top, 0px)) 0.4rem;
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev` → devtools em modo iPhone (com "device frame"/insets se disponível) e desktop.
Expected: desktop/Android sem nenhuma mudança visual (insets = 0); prosa e versículos alinhados à esquerda no mobile; nenhuma barra horizontal.

- [ ] **Step 5: Lint, testes, build**

Run: `npm run lint && npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add index.html src/styles/app.css
git commit -m "feat: safe areas iOS e alinhamento à esquerda no mobile"
```

---

## Checklist manual final (pós-merge, no iPhone instalado)

1. Modo avião → fontes tipográficas corretas offline (não Georgia).
2. Notch e barra home respeitados (nada colado nas bordas).
3. Rolar para baixo esconde o header; para cima devolve.
4. Fechar o app no meio da leitura e reabrir → posição restaurada.
5. Concluir → card "Próxima" e navegação começa no topo.
6. Alternar corrido/blocos, fonte, tamanho e tema pelo "Aa".
