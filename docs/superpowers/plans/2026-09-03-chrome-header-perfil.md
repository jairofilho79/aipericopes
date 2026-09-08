# Chrome: header, menu Perfil e limpeza da Leitura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concentrar tema, tipografia, ajustes e conta num menu `Perfil` no header, e retirar o pill `.ref-nav` da Leitura.

**Architecture:** As preferências de leitura ganham um evento de módulo (o mesmo padrão de `sync-event.ts`), o que permite o menu viver no header e a Leitura continuar reagindo a `prefs.layout`. O corpo do `ReadingMenu` é extraído para um `LeituraPrefs` autônomo, que o `PerfilMenu` consome como seção contextual. A troca acontece de uma vez numa única task de cutover, para o app nunca ficar sem jeito de ajustar tipografia.

**Tech Stack:** React 19 + react-router-dom, TypeScript, Vite, Vitest com `happy-dom` por arquivo, CSS puro em `src/styles/app.css`.

**Spec:** `docs/superpowers/specs/2026-09-03-chrome-header-perfil-design.md`

## Global Constraints

- **Nenhum teste pode ler `public/data/index.json`, nem montar `Home`, `Indice` ou `Pesquisar`.** O arquivo é derivado e gitignored (`.gitignore:29`); a CI roda `npm test` (`.github/workflows/deploy-worker.yml:19`) antes de `npm run build` (linha 21), que é quem o gera. Teste que o leia passa local e quebra a CI com `ENOENT`.
- **Testes de componente seguem o padrão do repo:** `// @vitest-environment happy-dom` na primeira linha, `createRoot` + `act` de `react-dom/client` e `react`. **Não existe `@testing-library/react` no projeto** — não instalar.
- **`localStorage` em teste exige `installLocalStorageMock()`** de `src/lib/testing/storage-mock.ts`, chamado no topo do arquivo (Node 25 expõe um `localStorage` embutido sem métodos).
- **`src/styles/app.css` é tocado por outras sessões.** Acrescentar blocos, não reescrever. As únicas remoções autorizadas são as nomeadas neste plano: `.theme-menu`, `.theme-toggle`, `.ref-nav`, `.ref-arrow`, e duas declarações do bloco `.section-chips`.
- **Ordem de merge acordada: jornadas → releitura → esta fase.** Ao chegar em `App.tsx`, a nav já estará em `[marca] Jornada · Índice · Pesquisar · Entrar|Sair` — `Hoje` já removido e `Jornada` já presente pela fase de jornadas. A rota `/ajustes` já existirá, vinda da fase de releitura.
- **Rodar `npm test` de dentro de uma worktree limpa.** Na `main` o vitest também coleta `.worktrees/develop` e a contagem infla (66 arquivos/706 testes em vez de 39/435).
- Comentários e nomes em português, como o resto do repo.

---

### Task 1: Evento de mudança das preferências de leitura

O menu vai morar no header, fora da rota; a Leitura continua precisando de `prefs.layout` para decidir corrido/blocos (`Leitura.tsx:910`). Sem um canal de aviso, as duas cópias do estado se desencontram. `applyReadingPrefs` já é o ponto único por onde toda mudança passa — é lá que o aviso entra, exatamente como `applyTheme` já faz para o tema.

**Files:**
- Modify: `src/lib/reading-prefs.ts` (acrescentar no fim do arquivo, e uma linha dentro de `applyReadingPrefs`)
- Create: `src/lib/use-reading-prefs.ts`
- Test: `src/lib/reading-prefs.test.ts` (acrescentar um `describe` no fim)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `onReadingPrefs(fn: () => void): () => void` — inscreve e devolve o desinscritor.
  - `useReadingPrefs(): ReadingPrefs` — hook que reflete as prefs correntes.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar no fim de `src/lib/reading-prefs.test.ts`. O import de `onReadingPrefs` e `setReadingMeasure` entra na lista de imports que já existe no topo do arquivo:

```ts
describe('onReadingPrefs', () => {
  beforeEach(() => localStorage.clear())

  it('avisa os inscritos a cada aplicação de prefs', () => {
    let avisos = 0
    const desinscrever = onReadingPrefs(() => {
      avisos++
    })
    setReadingLayout('blocos')
    expect(avisos).toBe(1)
    setReadingMeasure('larga')
    expect(avisos).toBe(2)
    desinscrever()
  })

  it('desinscrito para de receber', () => {
    let avisos = 0
    const desinscrever = onReadingPrefs(() => {
      avisos++
    })
    desinscrever()
    setReadingLayout('blocos')
    expect(avisos).toBe(0)
  })

  it('dois inscritos recebem o mesmo aviso', () => {
    const vistos: string[] = []
    const off1 = onReadingPrefs(() => vistos.push('a'))
    const off2 = onReadingPrefs(() => vistos.push('b'))
    setReadingLayout('blocos')
    expect(vistos).toEqual(['a', 'b'])
    off1()
    off2()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/reading-prefs.test.ts`
Expected: FAIL — `onReadingPrefs is not exported by ./reading-prefs` (erro de importação; os três testes nem chegam a rodar).

- [ ] **Step 3: Implementar o evento em `reading-prefs.ts`**

Acrescentar no **fim** de `src/lib/reading-prefs.ts`:

```ts
/**
 * Aviso de "as preferências de leitura mudaram", para o menu (que vive no
 * header, fora da rota) e a Leitura (que usa `layout` para decidir
 * corrido/blocos) nunca discordarem.
 *
 * O alvo é um EventTarget próprio do módulo, não a `window`: mesmo motivo de
 * `sync-event.ts` — funciona igual em teste, não ocupa nome global e deixa
 * claro que só quem importa daqui participa.
 */
const alvo = new EventTarget()

const PREFS_EVENT = 'pericopes-reading-prefs'

/** Inscreve `fn` e devolve a função que desinscreve. */
export function onReadingPrefs(fn: () => void): () => void {
  alvo.addEventListener(PREFS_EVENT, fn)
  return () => alvo.removeEventListener(PREFS_EVENT, fn)
}
```

E, dentro de `applyReadingPrefs`, **depois** do bloco `try/catch` do `localStorage` (última linha da função):

```ts
  alvo.dispatchEvent(new Event(PREFS_EVENT))
```

O `const alvo` fica no fim do arquivo mas é usado por `applyReadingPrefs`, que está antes: `const` em escopo de módulo é içado para efeito de closure e a função só roda depois da avaliação do módulo, então isto é válido. Preferir isto a espalhar a declaração no meio das constantes de configuração do topo.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/reading-prefs.test.ts`
Expected: PASS — os três testes novos, mais os que já existiam no arquivo.

- [ ] **Step 5: Criar o hook**

Create `src/lib/use-reading-prefs.ts`:

```ts
import { useEffect, useState } from 'react'
import { getReadingPrefs, onReadingPrefs, type ReadingPrefs } from './reading-prefs'

/**
 * As preferências de leitura correntes, sincronizadas entre quem as edita (o
 * menu Perfil, no header) e quem as consome (a Leitura, que decide
 * corrido/blocos por `layout`).
 *
 * Não devolve setter de propósito: quem muda chama os `setReading*` de
 * `reading-prefs.ts`, que aplicam e avisam. Um setter aqui abriria um segundo
 * caminho de escrita que não persiste.
 */
export function useReadingPrefs(): ReadingPrefs {
  const [prefs, setPrefs] = useState<ReadingPrefs>(getReadingPrefs)
  useEffect(() => onReadingPrefs(() => setPrefs(getReadingPrefs())), [])
  return prefs
}
```

- [ ] **Step 6: Rodar a suíte inteira e o typecheck**

Run: `npm test && npx tsc -b`
Expected: PASS, sem erro de tipo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reading-prefs.ts src/lib/use-reading-prefs.ts src/lib/reading-prefs.test.ts
git commit -m "feat: evento de mudança das preferências de leitura

applyReadingPrefs passa a avisar inscritos, como applyTheme já faz. É o
seam que permite o menu de tipografia viver no header sem a Leitura
perder de vista o prefs.layout."
```

---

### Task 2: Extrair `LeituraPrefs` e adotar o seam

O corpo do `ReadingMenu` (os cinco grupos de controle) precisa existir separado do popover, para o `PerfilMenu` consumir. `LeituraPrefs` nasce **autônomo** — lê as prefs pelo hook e chama os setters direto — para não propagar `prefs`/`onPrefs` por dois níveis de componente.

Nada muda visualmente nesta task. É pura reorganização, e o app continua com o `Aa` no mesmo lugar.

**Files:**
- Create: `src/components/LeituraPrefs.tsx`
- Create: `src/components/LeituraPrefs.test.tsx`
- Modify: `src/components/ReadingMenu.tsx` (perde as props e o corpo)
- Modify: `src/pages/Leitura.tsx:142` (estado local vira o hook), `:828` (chamada sem props)

**Interfaces:**
- Consumes: `useReadingPrefs(): ReadingPrefs` da Task 1.
- Produces: `<LeituraPrefs />` — componente sem props, default export de `src/components/LeituraPrefs.tsx`.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/LeituraPrefs.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installLocalStorageMock } from '../lib/testing/storage-mock'

installLocalStorageMock()

import LeituraPrefs from './LeituraPrefs'
import { getReadingPrefs } from '../lib/reading-prefs'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar() {
  act(() => root.render(<LeituraPrefs />))
}

/** Botão pelo texto visível, dentro do grupo de `aria-label` dado. */
function botao(grupo: string, rotulo: string): HTMLButtonElement {
  const g = container.querySelector(`[aria-label="${grupo}"]`)
  if (!g) throw new Error(`grupo ausente: ${grupo}`)
  const alvo = [...g.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === rotulo || b.getAttribute('aria-label') === rotulo,
  )
  if (!alvo) throw new Error(`botão ausente: ${rotulo} em ${grupo}`)
  return alvo
}

describe('LeituraPrefs', () => {
  it('mostra os cinco grupos de controle', () => {
    montar()
    const grupos = [...container.querySelectorAll('[role="group"]')].map((g) =>
      g.getAttribute('aria-label'),
    )
    expect(grupos).toEqual([
      'Tamanho do texto',
      'Fonte',
      'Modo do texto bíblico',
      'Espaçamento entre linhas',
      'Largura do texto',
    ])
  })

  it('trocar o layout persiste e marca o botão', () => {
    montar()
    act(() => botao('Modo do texto bíblico', 'Blocos').click())
    expect(getReadingPrefs().layout).toBe('blocos')
    expect(botao('Modo do texto bíblico', 'Blocos').getAttribute('aria-pressed')).toBe('true')
  })

  it('aumentar o texto anda um degrau e re-renderiza sozinho', () => {
    montar()
    const antes = getReadingPrefs().sizeStep
    act(() => botao('Tamanho do texto', 'Aumentar texto').click())
    expect(getReadingPrefs().sizeStep).toBe(antes + 1)
  })

  it('no menor degrau o botão de diminuir fica desabilitado', () => {
    localStorage.setItem('pericopes-reading', JSON.stringify({ sizeStep: 0 }))
    montar()
    expect(botao('Tamanho do texto', 'Diminuir texto').disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/LeituraPrefs.test.tsx`
Expected: FAIL — `Failed to resolve import "./LeituraPrefs"`.

- [ ] **Step 3: Criar `LeituraPrefs.tsx`**

Create `src/components/LeituraPrefs.tsx`. É o corpo de `ReadingMenu.tsx` (os cinco `readmenu-row`), com as prefs vindas do hook e sem o `onPrefs`:

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
} from '../lib/reading-prefs'
import { useReadingPrefs } from '../lib/use-reading-prefs'

const LAYOUTS: { id: ReadingLayout; label: string }[] = [
  { id: 'corrido', label: 'Corrido' },
  { id: 'blocos', label: 'Blocos' },
]

/**
 * Os controles de tipografia, sem casca. Autônomo de propósito: lê pelo hook e
 * chama os setters direto, para o Perfil não ter que carregar prefs/onPrefs
 * por dois níveis. Os setters já aplicam, persistem e avisam.
 */
export default function LeituraPrefs() {
  const prefs = useReadingPrefs()

  return (
    <>
      <div className="readmenu-row" role="group" aria-label="Tamanho do texto">
        <button
          type="button"
          className="read-tool"
          disabled={prefs.sizeStep === 0}
          aria-label="Diminuir texto"
          onClick={() => bumpReadingSize(-1)}
        >
          A−
        </button>
        <button
          type="button"
          className="read-tool"
          disabled={prefs.sizeStep === SIZE_STEPS.length - 1}
          aria-label="Aumentar texto"
          onClick={() => bumpReadingSize(1)}
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
            onClick={() => setReadingFont(f.id)}
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
            onClick={() => setReadingLayout(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="readmenu-row" role="group" aria-label="Espaçamento entre linhas">
        <button
          type="button"
          className="read-tool"
          disabled={prefs.leadingStep === 0}
          aria-label="Diminuir espaçamento"
          onClick={() => bumpReadingLeading(-1)}
        >
          ▼
        </button>
        <button
          type="button"
          className="read-tool"
          disabled={prefs.leadingStep === LEADING_STEPS.length - 1}
          aria-label="Aumentar espaçamento"
          onClick={() => bumpReadingLeading(1)}
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
            onClick={() => setReadingMeasure(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/LeituraPrefs.test.tsx`
Expected: PASS — os quatro testes.

- [ ] **Step 5: `ReadingMenu` passa a consumir `LeituraPrefs`**

Substituir **todo** o conteúdo de `src/components/ReadingMenu.tsx` por:

```tsx
import { usePopover } from '../lib/use-popover'
import LeituraPrefs from './LeituraPrefs'

export default function ReadingMenu() {
  const { open, toggle, rootRef, btnRef, popRef } = usePopover()

  return (
    <div className="readmenu" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="read-tool readmenu-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        Aa
      </button>
      {open && (
        <div
          className="readmenu-pop"
          ref={popRef}
          role="dialog"
          aria-modal="true"
          aria-label="Preferências de leitura"
        >
          <LeituraPrefs />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Leitura adota o hook**

Em `src/pages/Leitura.tsx`:

Trocar a linha 142:
```tsx
  const [prefs, setPrefs] = useState<ReadingPrefs>(() => getReadingPrefs())
```
por:
```tsx
  const prefs = useReadingPrefs()
```

Trocar a linha 828:
```tsx
          <ReadingMenu prefs={prefs} onPrefs={setPrefs} />
```
por:
```tsx
          <ReadingMenu />
```

Nos imports do topo, **apagar a linha 34 inteira**:
```tsx
import { getReadingPrefs, type ReadingPrefs } from '../lib/reading-prefs'
```
Os dois símbolos eram usados só na linha 142. Acrescentar no lugar:
```tsx
import { useReadingPrefs } from '../lib/use-reading-prefs'
```

**Não mexer no import de `react`:** `useState` aparece outras 22 vezes no arquivo.

- [ ] **Step 7: Rodar tudo**

Run: `npm test && npm run lint && npx tsc -b`
Expected: PASS nos três. O `lint` (oxlint) é quem acusa import não usado se o passo anterior deixou algum para trás.

- [ ] **Step 8: Commit**

```bash
git add src/components/LeituraPrefs.tsx src/components/LeituraPrefs.test.tsx \
        src/components/ReadingMenu.tsx src/pages/Leitura.tsx
git commit -m "refactor: extrai LeituraPrefs do ReadingMenu e adota o seam

Os cinco grupos de controle passam a viver soltos, autônomos pelo hook,
para o Perfil poder consumi-los. Nada muda na tela."
```

---

### Task 3: O componente `PerfilMenu`

Ainda **não** montado no app — esta task entrega o componente testado, e a Task 4 faz a troca. Assim o cutover é uma edição pequena sobre código já verificado.

**Files:**
- Create: `src/components/PerfilMenu.tsx`
- Create: `src/components/PerfilMenu.test.tsx`
- Modify: `src/styles/app.css` (bloco novo no fim do arquivo)

**Interfaces:**
- Consumes: `<LeituraPrefs />` (Task 2); `usePopover()` de `src/lib/use-popover.ts`; `signOutLocal()` de `src/lib/sync.ts`; `getThemePref`, `setThemePref`, `type ThemePref` de `src/lib/theme.ts`; `authClient` de `src/lib/auth-client.ts`.
- Produces:
  - `<PerfilMenu onOpenChange={(aberto: boolean) => void} />` — default export.
  - `mostrarPrefsDeLeitura(pathname: string): boolean` — named export, puro.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/components/PerfilMenu.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installLocalStorageMock } from '../lib/testing/storage-mock'

installLocalStorageMock()

// Sessão controlada pelo teste: `sessao` null = anônimo.
let sessao: { user: { id: string; email: string } } | null = null
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: sessao }) },
}))

// Rota controlada pelo teste, para exercitar a seção contextual.
let rota = '/'
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: rota }),
  Link: ({ to, children, ...resto }: { to: string; children: unknown }) => (
    <a href={to} {...resto}>
      {children as never}
    </a>
  ),
}))

vi.mock('../lib/sync', () => ({ signOutLocal: vi.fn(async () => {}) }))

import PerfilMenu, { mostrarPrefsDeLeitura } from './PerfilMenu'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  sessao = null
  rota = '/'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar() {
  act(() => root.render(<PerfilMenu />))
}

function abrir() {
  montar()
  act(() => container.querySelector<HTMLButtonElement>('.perfil-btn')!.click())
}

function textos(seletor: string): string[] {
  return [...container.querySelectorAll(seletor)].map((e) => e.textContent?.trim() ?? '')
}

describe('mostrarPrefsDeLeitura', () => {
  it('vale na Leitura', () => {
    expect(mostrarPrefsDeLeitura('/leitura/1')).toBe(true)
    expect(mostrarPrefsDeLeitura('/leitura/842')).toBe(true)
  })

  it('não vale fora dela', () => {
    expect(mostrarPrefsDeLeitura('/')).toBe(false)
    expect(mostrarPrefsDeLeitura('/indice')).toBe(false)
    expect(mostrarPrefsDeLeitura('/pesquisar')).toBe(false)
    expect(mostrarPrefsDeLeitura('/ajustes')).toBe(false)
  })

  it('não confunde uma rota que só começa parecido', () => {
    expect(mostrarPrefsDeLeitura('/leituras-antigas')).toBe(false)
  })
})

describe('PerfilMenu — o gatilho', () => {
  it('a nav mostra "Perfil" deslogado', () => {
    montar()
    expect(container.querySelector('.perfil-btn')?.textContent?.trim()).toBe('Perfil')
  })

  it('a nav mostra "Perfil" logado, e não o e-mail', () => {
    sessao = { user: { id: 'u1', email: 'a@b.c' } }
    montar()
    expect(container.querySelector('.perfil-btn')?.textContent?.trim()).toBe('Perfil')
  })

  it('começa fechado', () => {
    montar()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('PerfilMenu — conteúdo', () => {
  it('deslogado, o último item é Entrar', () => {
    abrir()
    expect(textos('.perfil-item').at(-1)).toBe('Entrar')
  })

  it('logado, o último item é Sair', () => {
    sessao = { user: { id: 'u1', email: 'a@b.c' } }
    abrir()
    expect(textos('.perfil-item').at(-1)).toBe('Sair')
  })

  it('Ajustes aparece deslogado — a tela funciona sem conta', () => {
    abrir()
    expect(textos('.perfil-item')).toContain('Ajustes')
    const link = [...container.querySelectorAll('a.perfil-item')].find(
      (a) => a.textContent?.trim() === 'Ajustes',
    )
    expect(link?.getAttribute('href')).toBe('/ajustes')
  })

  it('fora da Leitura não mostra a seção de tipografia', () => {
    abrir()
    expect(container.querySelector('[aria-label="Tamanho do texto"]')).toBeNull()
    expect(textos('.perfil-secao')).toEqual(['Tema'])
  })

  it('na Leitura mostra a seção de tipografia', () => {
    rota = '/leitura/1'
    abrir()
    expect(container.querySelector('[aria-label="Tamanho do texto"]')).not.toBeNull()
    expect(textos('.perfil-secao')).toEqual(['Tema', 'Leitura'])
  })

  it('o tema corrente vem marcado, e escolher outro fecha o menu', () => {
    abrir()
    const escuro = [...container.querySelectorAll('[aria-label="Tema"] button')].find(
      (b) => b.textContent?.trim() === 'Escuro',
    ) as HTMLButtonElement
    act(() => escuro.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('PerfilMenu — onOpenChange', () => {
  it('avisa o header ao abrir e ao fechar', () => {
    const vistos: boolean[] = []
    act(() => root.render(<PerfilMenu onOpenChange={(v) => vistos.push(v)} />))
    act(() => container.querySelector<HTMLButtonElement>('.perfil-btn')!.click())
    act(() => container.querySelector<HTMLButtonElement>('.perfil-btn')!.click())
    expect(vistos).toEqual([false, true, false])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/PerfilMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "./PerfilMenu"`.

- [ ] **Step 3: Criar `PerfilMenu.tsx`**

Create `src/components/PerfilMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { signOutLocal } from '../lib/sync'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { usePopover } from '../lib/use-popover'
import LeituraPrefs from './LeituraPrefs'

const TEMAS: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'sepia', label: 'Sépia' },
  { id: 'dark', label: 'Escuro' },
]

/**
 * A tipografia só aparece onde há prosa de leitura na tela: ajustar entrelinha
 * no Índice não mostraria efeito nenhum. Puro, para ser testável.
 */
export function mostrarPrefsDeLeitura(pathname: string): boolean {
  return pathname.startsWith('/leitura/')
}

type Props = {
  /** O header trava o auto-ocultar enquanto o menu está aberto. */
  onOpenChange?: (aberto: boolean) => void
}

/**
 * Tema, tipografia, ajustes e conta num lugar só. Substitui o ThemeMenu solto
 * e o "Aa" da Leitura.
 *
 * O gatilho mostra "Perfil" mesmo deslogado, e nunca "Entrar": tema e
 * tipografia são localStorage e funcionam sem conta, então trocar o item por
 * "Entrar" tiraria as duas de quem não tem conta. Só o último item de dentro
 * do menu muda.
 */
export default function PerfilMenu({ onOpenChange }: Props) {
  const { data: session } = authClient.useSession()
  const { pathname } = useLocation()
  const { open, toggle, close, rootRef, btnRef, popRef } = usePopover()
  const [pref, setPref] = useState<ThemePref>(() => getThemePref())
  const [saindo, setSaindo] = useState(false)
  const [erroSaida, setErroSaida] = useState('')
  const erroSaidaTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    const onTheme = () => setPref(getThemePref())
    window.addEventListener('pericopes-theme', onTheme)
    return () => window.removeEventListener('pericopes-theme', onTheme)
  }, [])

  useEffect(() => () => window.clearTimeout(erroSaidaTimer.current), [])

  async function sair() {
    if (saindo) return
    setSaindo(true)
    setErroSaida('')
    try {
      await signOutLocal()
    } catch {
      // nunca deixar virar rejeição não tratada: o usuário precisa saber
      // (some sozinho depois de um tempo, como o flashAviso da Leitura)
      window.clearTimeout(erroSaidaTimer.current)
      setErroSaida('Não foi possível sair. Tente de novo.')
      erroSaidaTimer.current = window.setTimeout(() => setErroSaida(''), 4000)
    } finally {
      setSaindo(false)
    }
  }

  return (
    <span className="perfil-wrap" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="perfil-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        Perfil
      </button>
      {open && (
        <div
          className="readmenu-pop perfil-pop"
          ref={popRef}
          role="dialog"
          aria-modal="true"
          aria-label="Perfil"
        >
          <p className="perfil-secao">Tema</p>
          <div className="readmenu-row" role="group" aria-label="Tema">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`read-tool${pref === t.id ? ' active' : ''}`}
                aria-pressed={pref === t.id}
                // Uma escolha só: fecha na hora, ao contrário da tipografia,
                // onde a pessoa mexe em várias coisas antes de sair.
                onClick={() => {
                  setThemePref(t.id)
                  close()
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mostrarPrefsDeLeitura(pathname) && (
            <>
              <p className="perfil-secao">Leitura</p>
              <LeituraPrefs />
            </>
          )}

          <div className="perfil-sep" role="separator" />

          <Link className="perfil-item" to="/ajustes" onClick={close}>
            Ajustes
          </Link>

          {session ? (
            <>
              <button
                type="button"
                className="perfil-item"
                onClick={() => void sair()}
                disabled={saindo}
                title={session.user.email}
              >
                {saindo ? 'Saindo…' : 'Sair'}
              </button>
              {/* Sempre montado (mesmo padrão de .verse-actions-aviso): uma
                  região aria-live só anuncia mudança de conteúdo se já
                  existir no DOM antes da mudança. Criar o nó já populado
                  no mesmo update não é confiável em leitores de tela. Quem
                  usa toque também não vê `title` (precisa de hover), então
                  a falha precisa aparecer na tela, não só ser lida em voz
                  alta — por isso o texto fica visível, não .sr-only. */}
              <span className="nav-conta-erro" role="status" aria-live="polite">
                {erroSaida}
              </span>
            </>
          ) : (
            <Link className="perfil-item" to="/entrar" onClick={close}>
              Entrar
            </Link>
          )}
        </div>
      )}
    </span>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/PerfilMenu.test.tsx`
Expected: PASS — os treze testes.

- [ ] **Step 5: Acrescentar o CSS**

Acrescentar no **fim** de `src/styles/app.css` (bloco novo; não mexer nas regras existentes):

```css
/* ── Menu Perfil ─────────────────────────────────────────────────────────
   Reúne tema, tipografia, Ajustes e conta. É o popover mais alto do app:
   ~520px na Leitura, contra os ~240px do antigo "Aa". Daí as três medidas
   abaixo. */
.perfil-wrap {
  position: relative;
}

/* 260px e não os 230px do .readmenu-pop porque a 230px a linha de fontes
   (Serif/Literata/Sans) e a de tema (quatro rótulos) quebram em duas linhas.
   max-height + rolagem porque num aparelho de 568px de altura os ~520px não
   cabem abaixo do header; overscroll-behavior impede a rolagem de vazar para
   a página atrás quando chega ao fim. */
.perfil-pop {
  min-width: 260px;
  max-height: calc(100dvh - 5rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.perfil-secao {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.perfil-sep {
  height: 1px;
  background: var(--line);
  margin: 0.15rem 0;
}

.perfil-item {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  padding-inline: 0.55rem;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.perfil-item:hover,
.perfil-item:focus-visible {
  border-color: var(--line);
  background: color-mix(in srgb, var(--paper) 70%, transparent);
  outline: none;
}

.perfil-item:disabled {
  cursor: default;
  opacity: 0.6;
}

/* O gatilho é um <button> no meio de <a>s: sem herdar font e cor ele destoa
   dos vizinhos da nav. Aberto, acende como o link ativo acende. */
.top nav .perfil-btn {
  font: inherit;
  color: var(--muted);
  background: none;
  border: 0;
  padding-inline: 0.15rem;
  min-height: 2.5rem;
  white-space: nowrap;
  cursor: pointer;
}

.top nav .perfil-btn[aria-expanded='true'] {
  color: var(--accent);
  font-weight: 600;
}
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test && npm run lint && npx tsc -b`
Expected: PASS nos três.

- [ ] **Step 7: Commit**

```bash
git add src/components/PerfilMenu.tsx src/components/PerfilMenu.test.tsx src/styles/app.css
git commit -m "feat: componente PerfilMenu

Tema, tipografia (contextual à Leitura), Ajustes e conta num popover só.
Ainda não montado no header — a troca é a próxima task."
```

---

### Task 4: A troca — header ganha o Perfil, Leitura perde o pill

Cutover numa task só, de propósito: separar "montar o Perfil" de "tirar o Aa" deixaria o app ou com tipografia em dois lugares ou sem nenhum. Um revisor não consegue aprovar metade disso.

**Files:**
- Modify: `src/App.tsx` (nav, imports, remoção do estado de `sair`, `useHideOnScroll`)
- Modify: `src/pages/Leitura.tsx` (remover o bloco `.ref-nav`, linhas ~806-829)
- Delete: `src/components/ThemeMenu.tsx`, `src/components/ReadingMenu.tsx`
- Modify: `src/styles/app.css` (remover `.theme-menu`, `.theme-toggle`, `.ref-nav`, `.ref-arrow` e as referências a elas nas media queries)

**Interfaces:**
- Consumes: `<PerfilMenu onOpenChange={...} />` e `mostrarPrefsDeLeitura` (Task 3).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Conferir o ponto de partida da nav**

Run: `sed -n '60,110p' src/App.tsx`
Expected: a nav já sem `Hoje` e já com `Jornada` apontando para `/jornada`, vinda da fase de jornadas. **Se `Hoje` ainda estiver lá**, a fase de jornadas não mesclou ainda — parar e avisar antes de seguir, porque o merge vai conflitar.

- [ ] **Step 2: Trocar a nav em `App.tsx`**

Substituir o `<ThemeMenu />` e todo o bloco `<nav>` por:

```tsx
        <nav>
          <NavLink to="/jornada">Jornada</NavLink>
          <NavLink to="/indice">Índice</NavLink>
          <NavLink to="/pesquisar">Pesquisar</NavLink>
          <PerfilMenu onOpenChange={setPerfilAberto} />
        </nav>
```

Remover do `Shell`: a função `sair()` e os estados `saindo`, `erroSaida`, `erroSaidaTimer` (tudo migrou para o `PerfilMenu` na Task 3), mais o bloco `<span className="nav-conta-wrap">` que o `<nav>` novo já substituiu.

Nos imports, apagar a linha 15 (`import ThemeMenu from './components/ThemeMenu'`) e trocar a linha 11:
```tsx
import { initSyncTriggers, signOutLocal } from './lib/sync'
```
por:
```tsx
import { initSyncTriggers } from './lib/sync'
```
`signOutLocal` passa a ser importado só pelo `PerfilMenu`; `initSyncTriggers` continua sendo usado pelo `useEffect` do `Shell`.

Conferir também se `useRef` ainda é usado em `App.tsx` depois de sair o `erroSaidaTimer` — se não for, tirá-lo do import de `react`. `useState` continua em uso pelo `perfilAberto`.

Acrescentar o estado novo e trocar a chamada do hook:

```tsx
  const [perfilAberto, setPerfilAberto] = useState(false)
  const headerHidden = useHideOnScroll(pathname.startsWith('/leitura/') && !perfilAberto)
```

`setPerfilAberto` vem do `useState` e é referência estável, então o `useEffect` de `onOpenChange` dentro do `PerfilMenu` não entra em laço.

Acrescentar o import: `import PerfilMenu from './components/PerfilMenu'`.

- [ ] **Step 3: Tirar o pill da Leitura**

Em `src/pages/Leitura.tsx`, remover o bloco inteiro `<div className="ref-nav"> … </div>` (as duas `<Link>` de seta e o `<ReadingMenu />`), deixando o `.ref-row` só com o `<p className={tituloClass('ref', 'referencia')}>`.

Remover o import de `ReadingMenu`. **Não** remover o import de `Link`: ele segue em uso no `crumb` (linha ~793) e no pager (linha ~1131).

`prev` e `next` continuam necessários — o pager do rodapé usa os dois. Não removê-los.

- [ ] **Step 4: Apagar os componentes órfãos**

```bash
git rm src/components/ThemeMenu.tsx src/components/ReadingMenu.tsx
```

- [ ] **Step 5: Limpar o CSS órfão**

Em `src/styles/app.css`, remover:
- o bloco `.theme-menu` e o comentário do `.theme-pop` logo acima dele, o bloco `.theme-pop` e o bloco `.theme-toggle`;
- dentro de `@media (max-width: 379.98px)`, a regra `.theme-toggle`;
- dentro de `@media (min-width: 640px)`, a regra `.theme-menu`, e ajustar `grid-template-columns` de `.top` de `auto minmax(0, 1fr) auto` para `auto minmax(0, 1fr)`;
- o comentário e os blocos `.ref-nav`, `.ref-nav .read-tool` e `.ref-arrow`.

Manter `.readmenu`, `.readmenu-pop`, `.readmenu-row`, `.read-tool` e `.readmenu-btn`: o `.readmenu-pop` e o `.readmenu-row` seguem em uso pelo Perfil.

Ajustar o comentário do `.ref-row` (que hoje explica o `flex-wrap` pelo grupo `←/→/Aa`) para refletir que a linha agora tem só a referência:

```css
/* Linha de meta do cabeçalho da perícope: só a referência e a estimativa de
   tempo. O grupo ←/→/Aa que justificava o flex-wrap saiu — as setas foram
   para o pager do rodapé e o swipe, e o "Aa" para o menu Perfil. */
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test && npm run lint && npx tsc -b`
Expected: PASS nos três. O `lint` acusa qualquer import órfão deixado nos passos 2 e 3.

- [ ] **Step 7: Conferir no app rodando**

Run: `npm run dev` e abrir `http://localhost:5173/leitura/1`.

Verificar, **em janela estreita (≤430px) e com a aba em primeiro plano**:
1. A nav é `Jornada · Índice · Pesquisar · Perfil`, em duas linhas com a marca.
2. O Perfil abre com Tema **e** Leitura; em `/indice`, só com Tema.
3. Rolar com o Perfil aberto **não** esconde o header.
4. Fechar o Perfil e rolar para baixo: o header some normalmente.
5. Mudar o tamanho do texto pelo Perfil muda o texto atrás, ao vivo.
6. Mudar Corrido/Blocos re-renderiza o texto bíblico (é o teste do seam da Task 1).
7. Deslogado, o menu mostra `Ajustes` e `Entrar`.
8. O cabeçalho da perícope não tem mais o pill; o pager do rodapé e o swipe navegam; `←`/`→` no teclado navegam.

- [ ] **Step 8: Commit**

```bash
git add -A src/App.tsx src/pages/Leitura.tsx src/styles/app.css src/components
git commit -m "feat: header ganha o menu Perfil e a Leitura perde o pill

Nav vira [marca] Jornada · Índice · Pesquisar · Perfil. O ThemeMenu solto
e o Aa deixam de existir; tema, tipografia, Ajustes e conta passam a morar
no Perfil. O auto-ocultar do header fica travado enquanto o menu está
aberto, senão rolar levaria o popover embora.

As setas do pill saem: o pager do rodapé, o swipe e os atalhos ←/→ de
use-keyboard-nav já cobriam a navegação."
```

---

### Task 5: Barra de chips — o vazamento e a transição

Fecha o achado do spike registrado na spec. **Não** é bug de posicionamento: `var(--top-h)` sempre resolveu, e `.shell:has(.top-hidden)` não casar com o header visível é o comportamento correto.

**Files:**
- Modify: `src/styles/app.css` (bloco `.section-chips`, duas declarações)
- Modify: `docs/superpowers/backlog-pos-pacotes.md` (corrigir a entrada)

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Corrigir o fundo e tirar a transição**

No bloco `.section-chips` de `src/styles/app.css`, trocar:

```css
  background: color-mix(in srgb, var(--paper) 82%, transparent);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
```
por:
```css
  background: var(--paper);
```

e **remover** a linha:
```css
  transition: top 0.25s ease;
```

Trocar o comentário acima do bloco por:

```css
/* barra de âncoras: sticky abaixo do header, e colada no topo quando ele some.
   z-index 4 fica abaixo do .top (5) e da .verse-actions (8) de propósito.

   Fundo OPACO, não translúcido: com 82% + blur(6px) o texto que passava por
   baixo aparecia borrado na faixa de padding acima do pill, e a barra parecia
   descolada do header — o vão aparente era texto vazando, não espaço.

   Sem `transition: top`: o offset vem de --top-h, medido em JS, e o header
   anima um `transform` em paralelo. Animar os dois separadamente deixa a barra,
   durante 250ms, num offset que não corresponde a estado nenhum. Quando o
   header desliza, o certo é a barra saltar. */
```

Remover também o bloco inteiro em `src/styles/app.css:1022-1026`, que fica órfão sem a transição:

```css
@media (prefers-reduced-motion: reduce) {
  .section-chips {
    transition: none;
  }
}
```

Cuidado para não confundir com o outro `@media (prefers-reduced-motion: reduce)` do arquivo (linha ~216), que trata de `.top` / `.top-hidden` — **esse fica**, porque o header continua animando o `transform`.

- [ ] **Step 2: Conferir no app rodando**

Run: `npm run dev` e abrir `http://localhost:5173/leitura/1` **em primeiro plano**, janela estreita.

1. Rolar para baixo até o header sumir: a barra de chips encosta no topo, sem vão.
2. Rolar 4px para cima: o header volta e a barra desce para logo abaixo dele, **sem faixa de texto borrado entre os dois**.
3. Nenhum texto aparece atravessando a barra em nenhum momento da rolagem.

Se o fundo opaco ficar pesado demais visualmente, o degrau seguinte é
`color-mix(in srgb, var(--paper) 96%, transparent)` mantendo o `backdrop-filter`
— mas só depois de confirmar que 96% não volta a vazar.

- [ ] **Step 3: Corrigir a entrada do backlog**

Em `docs/superpowers/backlog-pos-pacotes.md`, na seção "Navegação / Índice / Busca", substituir o item **"Barra de chips sobrepõe o header ao rolar"** por:

```markdown
- ~~Barra de chips sobrepõe o header ao rolar.~~ RESOLVIDO em 2026-09-03, e o
  diagnóstico anterior estava errado nos dois pontos. Investigado ao vivo:
  `--top-h` vale 55px e herda corretamente até `.section-chips`; existe
  exatamente UMA regra declarando `top` no elemento; e a `CSSTransition` que o
  browser gera tem keyframes `0px → 55px`, ou seja, `var(--top-h)` sempre
  resolveu. `.shell:has(.top-hidden)` não casar com o header visível é o
  comportamento CORRETO, não o defeito — as três investigações anteriores foram
  atrás da peça errada. Os dois sintomas relatados eram outra coisa: "a barra
  cobre o header" era o header auto-ocultando (`use-hide-on-scroll`, como
  projetado), e "a barra fica descolada" era o texto vazando pela faixa de
  padding translúcida — `color-mix(… 82%, transparent)` mais `blur(6px)`. O
  fundo virou opaco. A `transition: top` saiu junto, por animar um offset vindo
  de custom property medida em JS em paralelo ao `transform` do header. Spec:
  `docs/superpowers/specs/2026-09-03-chrome-header-perfil-design.md`.
```

Na mesma seção, o item do flash de 1 frame diz "**Mas ver o item abaixo** — o benefício visível não pôde ser confirmado". Acrescentar ao fim dele: `Confirmado em 2026-09-03: o item abaixo era outro problema, e a correção do flash está certa.`

- [ ] **Step 4: Rodar tudo**

Run: `npm test && npm run lint && npx tsc -b`
Expected: PASS nos três (nenhum teste cobre CSS; é confirmação de não-regressão).

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css docs/superpowers/backlog-pos-pacotes.md
git commit -m "fix: barra de chips opaca e sem transição de top

O sintoma de 'barra descolada do header' era texto vazando pela faixa
translúcida (82% + blur), não offset errado. Fundo vira opaco.

A transition: top sai por animar um offset vindo de custom property
medida em JS, em paralelo ao transform do header: durante 250ms a barra
ficava num offset que não correspondia a estado nenhum.

Corrige a entrada do backlog, que diagnosticava var(--top-h) e a regra
:has() — ambos corretos o tempo todo."
```

---

## Verificação final

- [ ] `npm test` — de uma worktree limpa, baseline 39 arquivos/435 testes **mais** os 20 novos (3 em `reading-prefs.test.ts`, 4 em `LeituraPrefs.test.tsx`, 13 em `PerfilMenu.test.tsx`).
- [ ] `npm run lint`
- [ ] `npx tsc -b`
- [ ] `npm run build` — prova que o `prebuild`/`shard` e o service worker seguem íntegros.
- [ ] `grep -rn "ThemeMenu\|ReadingMenu\|ref-nav\|ref-arrow\|theme-toggle\|theme-menu" src/` volta vazio.
- [ ] Avisar `biblia-pericopes-f2`, `biblia-pericopes-a4` e `biblia-pericopes-09` por `SendMessage` que `App.tsx` foi mesclado.
