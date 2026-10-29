// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReferenciasDoVersiculo } from '../lib/referencias'
import type { PericopeIndex } from '../lib/types'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const alvo = (livro: string, capitulo: number, versiculo: number) => ({
  livro,
  capitulo,
  versiculo: String(versiculo),
  versiculos: [versiculo],
  rotulo: `${livro} ${capitulo}:${versiculo}`,
})

const DA_PERICOPE: ReferenciasDoVersiculo[] = [
  {
    capitulo: 1,
    versiculo: 1,
    notas: [
      { letra: 'a', posicao: 1, alvos: [alvo('Provérbios', 8, 23), alvo('Hebreus', 11, 13)] },
      { letra: 'b', posicao: 3, alvos: [alvo('Salmos', 33, 6)] },
    ],
  },
  { capitulo: 1, versiculo: 3, notas: [{ letra: 'a', posicao: 2, alvos: [alvo('Salmos', 33, 9)] }] },
]
const DO_FOCO: ReferenciasDoVersiculo[] = [DA_PERICOPE[1]]

const daPericope = vi.fn(async (): Promise<ReferenciasDoVersiculo[]> => DA_PERICOPE)
const dosVersiculos = vi.fn(async (): Promise<ReferenciasDoVersiculo[]> => DO_FOCO)

vi.mock('../lib/referencias', async (original) => ({
  ...(await original<typeof import('../lib/referencias')>()),
  obterReferenciasDaPericope: () => daPericope(),
  obterReferenciasDosVersiculos: () => dosVersiculos(),
}))

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

const INDICE = [
  pericope(1, 'Gênesis', 1, 1, 1, 5),
  pericope(10, 'Provérbios', 8, 1, 8, 36),
  pericope(11, 'Hebreus', 11, 1, 11, 40),
  pericope(12, 'Salmos', 33, 1, 33, 22),
]

vi.mock('../lib/content', () => ({ loadIndex: async () => INDICE }))
vi.mock('../lib/referencias-previa', () => ({ previaDoAlvo: async () => null }))

import AbaReferencias from './AbaReferencias'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  daPericope.mockClear()
  dosVersiculos.mockClear()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function montar(props: Partial<Parameters<typeof AbaReferencias>[0]> = {}) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AbaReferencias pericope={INDICE[0]} {...props} />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10))
  })
}

describe('AbaReferencias', () => {
  it('sem foco, lista a perícope inteira agrupada por versículo, com as letras das notas', async () => {
    await montar()
    expect(daPericope).toHaveBeenCalled()
    expect(dosVersiculos).not.toHaveBeenCalled()
    const titulos = [...container.querySelectorAll('.refs-verso-titulo')].map((t) => t.textContent)
    expect(titulos).toEqual(['Gênesis 1:1', 'Gênesis 1:3'])
    const letras = [...container.querySelectorAll('.refs-letra')].map((l) => l.textContent)
    expect(letras).toEqual(['a', 'b', 'a'])
    expect(container.textContent).toContain('4 referências cruzadas da ARC em 2 versículos')
  })

  it('cada alvo tem um "Abrir" que leva à perícope de destino com a origem na URL', async () => {
    await montar()
    const abrir = container.querySelector<HTMLAnchorElement>('a[aria-label="Abrir a perícope de Provérbios 8:23"]')
    expect(abrir).not.toBeNull()
    const url = new URL(abrir!.getAttribute('href')!, 'http://x')
    expect(url.pathname).toBe('/leitura/10')
    expect(url.searchParams.get('via')).toBe('ref')
    expect(url.searchParams.get('origem')).toBe('1')
    expect(url.searchParams.get('ov')).toBe('1:1')
    expect(url.searchParams.get('v')).toBe('8:23')
  })

  it('ao abrir uma referência, grava o versículo de saída na URL da entrada atual', async () => {
    window.history.replaceState(null, '', '/leitura/1')
    await montar()
    await act(async () => {
      container
        .querySelector<HTMLAnchorElement>('a[aria-label="Abrir a perícope de Hebreus 11:13"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(new URL(window.location.href).searchParams.get('v')).toBe('1:1')
  })

  it('leva a jornada da leitura para o destino (jid)', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/leitura/1?jornadaId=j7']}>
          <AbaReferencias pericope={INDICE[0]} />
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    const abrir = container.querySelector<HTMLAnchorElement>('a[aria-label="Abrir a perícope de Salmos 33:6"]')!
    expect(new URL(abrir.getAttribute('href')!, 'http://x').searchParams.get('jid')).toBe('j7')
  })

  it('com foco, mostra só os versículos escolhidos e oferece voltar à perícope toda', async () => {
    const limpar = vi.fn()
    await montar({ versiculosFoco: [{ chapter: 1, verse: 3 }], onLimparFoco: limpar })
    expect(dosVersiculos).toHaveBeenCalled()
    expect(container.textContent).toContain('Referências de Gênesis 1:3')
    expect([...container.querySelectorAll('.refs-verso-titulo')].map((t) => t.textContent)).toEqual(['Gênesis 1:3'])
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.louvores-foco-limpar-btn')!.click()
    })
    expect(limpar).toHaveBeenCalled()
  })

  it('sem referências, diz isso', async () => {
    daPericope.mockResolvedValueOnce([])
    await montar()
    expect(container.textContent).toContain('Nenhuma referência cruzada nesta perícope.')
  })
})
