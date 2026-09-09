// @vitest-environment happy-dom
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LivroAberto from './LivroAberto'
import { bookByAbbrev } from '../lib/bible-books'
import type { FiltroLeitura } from '../lib/content'
import type { ItemPericope } from '../lib/item-pericope'

const ITENS: ItemPericope[] = [
  { ordem: 1, titulo: 'A criação', ref: 'Gn 1:1-2:3' },
  { ordem: 2, titulo: 'O jardim', ref: 'Gn 2:4-25' },
]

let container: HTMLDivElement
let root: Root

function montar(filtro: FiltroLeitura, itens: ItemPericope[] = ITENS) {
  const gn = bookByAbbrev('Gn')
  if (!gn) throw new Error('Gênesis não encontrado')
  act(() => {
    root.render(
      // `ListaPericopes` monta <Link>: sem router, o render lança.
      <MemoryRouter>
        <LivroAberto
          livro={gn}
          prog={{ livro: 'Gênesis', total: 50, concluidas: 12, pct: 24 }}
          itens={itens}
          concluidas={new Set([1])}
          filtro={filtro}
          onTrocar={() => {}}
        />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

describe('LivroAberto', () => {
  it('não tem formulário de capítulo/versículo — o campo do topo resolve referência', () => {
    montar('todos')
    expect(container.querySelector('.ref-form')).toBeNull()
    expect(container.querySelectorAll('input')).toHaveLength(0)
    // O que sobra é a mesma forma de RegistroAberto: cabeçalho e lista.
    expect(container.querySelector('.selected-book-name')?.textContent).toBe('Gênesis')
    expect(container.querySelectorAll('.peri-list li')).toHaveLength(2)
  })

  it('a barra do cabeçalho é do livro inteiro e mantém o rótulo "N de M"', () => {
    // Com um recorte que deixa uma perícope só, a barra continua em 24% —
    // e o rótulo ao lado dela não virou a linha secundária do catálogo.
    montar('lidos', [ITENS[0]])
    const fill = container.querySelector('.book-progress-fill') as HTMLElement
    expect(fill.style.width).toBe('24%')
    expect(container.querySelector('.book-progress-label')?.textContent).toBe('12 de 50')
  })

  it('a contagem diz "em Gênesis" sem recorte e "no recorte" com ele', () => {
    montar('todos')
    expect(container.querySelector('.peri-count')?.textContent).toBe('2 perícopes em Gênesis')
    montar('nao-lidos', [ITENS[0]])
    expect(container.querySelector('.peri-count')?.textContent).toBe('1 perícope no recorte')
  })
})
