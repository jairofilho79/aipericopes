// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AlvosReferencia from './AlvosReferencia'
import type { PericopeIndex } from '../lib/types'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const pericope = (ordem: number, livro: string, ci: number, vi_: number, cf: number, vf: number): PericopeIndex => ({
  ordem,
  seq: ordem,
  livro,
  abbrev: '',
  capitulo_inicio: ci,
  versiculo_inicio: vi_,
  capitulo_fim: cf,
  versiculo_fim: vf,
  titulo_pericope_pt: `P${ordem}`,
  minutos: 1,
  narrado: false,
})

const INDICE: PericopeIndex[] = [
  pericope(1, 'Gênesis', 1, 1, 1, 5),
  pericope(2, 'Gênesis', 1, 6, 1, 10),
]

const ALVO_OUTRA = {
  livro: 'Gênesis',
  capitulo: 1,
  versiculo: '8',
  versiculos: [8],
  rotulo: 'Gênesis 1:8',
}

const ALVO_MESMA = {
  livro: 'Gênesis',
  capitulo: 1,
  versiculo: '3',
  versiculos: [3],
  rotulo: 'Gênesis 1:3',
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AlvosReferencia', () => {
  it('renderiza link para outra perícope com via=ref e dispara onAbrir ao clicar', async () => {
    const onAbrir = vi.fn()
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AlvosReferencia
            alvos={[ALVO_OUTRA]}
            origem={{ ordem: 1, versiculoId: '1:1' }}
            indice={INDICE}
            onAbrir={onAbrir}
          />
        </MemoryRouter>,
      )
    })

    const link = container.querySelector<HTMLAnchorElement>('.ref-sheet-abrir')
    expect(link).not.toBeNull()
    expect(link?.tagName).toBe('A')
    expect(link?.getAttribute('href')).toContain('/leitura/2')
    expect(link?.getAttribute('href')).toContain('via=ref')
    expect(link?.getAttribute('href')).toContain('origem=1')
    expect(link?.getAttribute('href')).toContain('ov=1%3A1')
    expect(link?.getAttribute('href')).toContain('v=1%3A8')

    act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onAbrir).toHaveBeenCalled()
  })

  it('quando o alvo é na mesma perícope, renderiza botão Ver e rola até o elemento sem navegar', async () => {
    const onAbrir = vi.fn()
    const versoEl = document.createElement('button')
    versoEl.setAttribute('data-verse-id', '1:3')
    versoEl.scrollIntoView = vi.fn()
    document.body.appendChild(versoEl)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AlvosReferencia
            alvos={[ALVO_MESMA]}
            origem={{ ordem: 1, versiculoId: '1:1' }}
            indice={INDICE}
            onAbrir={onAbrir}
          />
        </MemoryRouter>,
      )
    })

    const btn = container.querySelector<HTMLButtonElement>('.ref-sheet-abrir')
    expect(btn).not.toBeNull()
    expect(btn?.tagName).toBe('BUTTON')
    expect(btn?.textContent).toContain('Ver')

    act(() => {
      btn?.click()
    })

    expect(onAbrir).toHaveBeenCalled()
    expect(versoEl.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(versoEl.classList.contains('retomada-flash')).toBe(true)

    versoEl.remove()
  })
})
