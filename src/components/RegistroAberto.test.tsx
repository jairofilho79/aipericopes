// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import RegistroAberto from './RegistroAberto'
import type { Registro, RegistroProgresso } from '../lib/registros'
import type { PericopeIndex } from '../lib/types'

function peri(ordem: number, seq: number, livro: string, titulo: string): PericopeIndex {
  return {
    ordem,
    seq,
    livro,
    abbrev: livro.slice(0, 2),
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 1,
    versiculo_fim: 5,
    titulo_pericope_pt: titulo,
    minutos: 1,
    narrado: false,
  }
}

/** N itens do mesmo livro, ordem/seq densos a partir de `desde`. */
function lote(n: number, livro: string, desde = 0): PericopeIndex[] {
  return Array.from({ length: n }, (_, i) => peri(desde + i, desde + i, livro, `Título ${desde + i}`))
}

const REGISTRO: Registro = {
  slug: 'lamento',
  nome: 'Lamento',
  ordens: Array.from({ length: 150 }, (_, i) => i),
}

const PROG: RegistroProgresso = { slug: 'lamento', total: 150, concluidas: 10, pct: 7 }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  document.body.removeChild(container)
})

function renderizar(props: Partial<Parameters<typeof RegistroAberto>[0]> = {}) {
  const base = {
    registro: REGISTRO,
    prog: PROG,
    itens: lote(150, 'Gênesis'),
    concluidas: new Set<number>(),
    onTrocar: () => {},
  }
  act(() => {
    root.render(
      <MemoryRouter>
        <RegistroAberto {...base} {...props} />
      </MemoryRouter>,
    )
  })
}

describe('RegistroAberto', () => {
  it('mostra as primeiras 100 e o botão "Ver mais 100"', () => {
    renderizar()
    expect(container.querySelectorAll('.peri-list li').length).toBe(100)
    const botao = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver mais 100'),
    )
    expect(botao).toBeTruthy()
  })

  it('clicar em "Ver mais" revela mais 100, e ao chegar no fim o botão some', () => {
    renderizar()
    const botao = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver mais 100'),
    ) as HTMLButtonElement
    act(() => {
      botao.click()
    })

    // Só há 150 no total: as 50 que faltavam apareceram, sem passar de 150.
    expect(container.querySelectorAll('.peri-list li').length).toBe(150)
    const botaoDepois = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver mais'),
    )
    expect(botaoDepois).toBeUndefined()
  })

  it('trocar a prop `registro` faz o contador voltar para 100 (sem `key`)', () => {
    renderizar()
    const botao = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver mais 100'),
    ) as HTMLButtonElement
    act(() => {
      botao.click()
    })
    expect(container.querySelectorAll('.peri-list li').length).toBe(150)

    const outroRegistro: Registro = {
      slug: 'louvor',
      nome: 'Louvor',
      ordens: Array.from({ length: 150 }, (_, i) => 1000 + i),
    }
    renderizar({
      registro: outroRegistro,
      prog: { slug: 'louvor', total: 150, concluidas: 0, pct: 0 },
      itens: lote(150, 'Êxodo', 1000),
    })

    expect(container.querySelectorAll('.peri-list li').length).toBe(100)
  })

  it('agrupa por transição de livro: mesmo livro em dois trechos separados vira dois cabeçalhos', () => {
    const itens = [...lote(2, 'Gênesis', 0), ...lote(2, 'Êxodo', 2), ...lote(2, 'Gênesis', 4)]
    renderizar({ itens, registro: { ...REGISTRO, ordens: itens.map((p) => p.ordem) } })

    const cabecalhos = Array.from(container.querySelectorAll('.book-group-head')).map(
      (el) => el.textContent,
    )
    expect(cabecalhos).toEqual(['Gênesis', 'Êxodo', 'Gênesis'])
  })

  it('lista vazia mostra uma frase, não uma tela em branco', () => {
    renderizar({ itens: [], registro: { ...REGISTRO, ordens: [] } })
    expect(container.querySelector('.peri-list')).toBeNull()
    expect(container.textContent).toMatch(/nenhuma/i)
  })
})
