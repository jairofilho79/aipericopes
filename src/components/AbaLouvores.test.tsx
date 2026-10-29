// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AbaLouvores from './AbaLouvores'
import type { LouvorRecomendado } from '../lib/louvores'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MOCK_LOUVORES: LouvorRecomendado[] = [
  {
    id: 'cf01385d-9d14-4690-96ae-d6344d323afa',
    shortId: '545',
    number: '115',
    name: 'Jesus, o bom pastor',
    category: 'Crianças e Adolescentes',
    tags: 'CIAs, Coletânea',
    similarity: 82.6,
    similarityBiblico: 82.7,
    similarityTematico: 82.6,
    matchTipo: 'ambos',
  },
  {
    id: '7cf98f00-274e-48da-ad0a-b4bc061bc79c',
    number: '',
    name: 'O Senhor é Minha Luz',
    category: 'Geral',
    tags: 'Avulsos, Migrados',
    similarity: 78.5,
    similarityBiblico: 81.0,
    similarityTematico: 76.8,
    matchTipo: 'biblico',
  },
]

const MOCK_LOUVORES_VERSICULO: LouvorRecomendado[] = [
  {
    id: 'ad01d861-d5d9-4ed2-ab83-5f42dfa3a477',
    shortId: '454',
    number: '384',
    name: 'Bem sei que tudo podes',
    category: 'Consolo e Encorajamento',
    tags: 'Coletânea',
    similarity: 100.0,
    similarityBiblico: 100.0,
    similarityTematico: 100.0,
    matchTipo: 'citacao_direta',
    citacaoBiblica: 'Jó 42:2',
    mensagemCentral: 'A soberania de Deus.',
    temasHomileticos: ['Soberania de Deus'],
  },
]

let mockRetornoLouvores: LouvorRecomendado[] = MOCK_LOUVORES
let mockRetornoVersiculos: LouvorRecomendado[] = MOCK_LOUVORES_VERSICULO

vi.mock('../lib/louvores', () => ({
  obterLouvoresDaPericope: vi.fn(async () => mockRetornoLouvores),
  obterLouvoresDosVersiculos: vi.fn(async () => mockRetornoVersiculos),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  mockRetornoLouvores = MOCK_LOUVORES
  mockRetornoVersiculos = MOCK_LOUVORES_VERSICULO
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AbaLouvores', () => {
  it('renderiza os cards de louvor com número, título, categoria, tags, afinidade e link externo', async () => {
    await act(async () => {
      root.render(<AbaLouvores pericope={{ ordem: 3068 } as any} />)
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    const cards = container.querySelectorAll('.louvor-card')
    expect(cards).toHaveLength(2)

    // Primeiro card: Com número
    const card1 = cards[0]
    expect(card1.querySelector('.louvor-badge-numero')?.textContent).toBe('Nº 115')
    expect(card1.querySelector('.louvor-titulo')?.textContent).toBe('Jesus, o bom pastor')
    expect(card1.querySelector('.louvor-badge-afinidade')?.textContent).toBe('82.6% de afinidade')
    expect(card1.querySelector('.louvor-categoria')?.textContent).toBe('Crianças e Adolescentes')
    const tagsCard1 = Array.from(card1.querySelectorAll('.louvor-tag')).map((el) => el.textContent)
    expect(tagsCard1).toEqual(['CIAs', 'Coletânea'])

    const link1 = card1.querySelector('a.louvor-link-externo') as HTMLAnchorElement
    expect(link1).not.toBeNull()
    expect(link1.href).toBe('https://v2.plpcg.com/louvor/545')
    expect(link1.textContent).toContain('Abrir no PLPCG')
    expect(link1.target).toBe('_blank')
    expect(link1.rel).toBe('noopener noreferrer')

    // Segundo card: Sem número (S/N) com fallback para UUID e badge de tipo 'Texto'
    const card2 = cards[1]
    expect(card2.querySelector('.louvor-badge-numero')?.textContent).toBe('S/N')
    expect(card2.querySelector('.louvor-badge-numero')?.className).toContain('louvor-badge-numero--sn')
    expect(card2.querySelector('.louvor-titulo')?.textContent).toBe('O Senhor é Minha Luz')
    expect(card2.querySelector('.louvor-badge-afinidade')?.textContent).toBe('78.5% de afinidade')
    expect(card2.querySelector('.louvor-badge-tipo')?.textContent).toBe('Texto')

    const link2 = card2.querySelector('a.louvor-link-externo') as HTMLAnchorElement
    expect(link2.href).toBe('https://v2.plpcg.com/louvor/7cf98f00-274e-48da-ad0a-b4bc061bc79c')
  })

  it('permite alternar entre os filtros de match bíblico e temático', async () => {
    await act(async () => {
      root.render(<AbaLouvores pericope={{ ordem: 3068 } as any} />)
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    const btns = Array.from(container.querySelectorAll('.louvores-filtro-btn'))
    const btnBiblico = btns.find((b) => b.textContent?.includes('Só Texto Bíblico'))
    expect(btnBiblico).toBeDefined()

    await act(async () => {
      btnBiblico?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const cards = container.querySelectorAll('.louvor-card')
    expect(cards[0].querySelector('.louvor-badge-afinidade')?.textContent).toContain('bíblico')
  })

  it('renderiza banner de foco quando versículos são selecionados', async () => {
    const onLimpar = vi.fn()
    await act(async () => {
      root.render(
        <AbaLouvores
          pericope={{ ordem: 1097, livro: 'Jó' } as any}
          versiculosFoco={[{ id: '42:2', chapter: 42, verse: 2, text: 'Bem sei que tudo podes' }]}
          onLimparVersiculosFoco={onLimpar}
        />,
      )
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    const banner = container.querySelector('.louvores-foco-banner')
    expect(banner).not.toBeNull()
    expect(container.querySelector('.louvores-foco-titulo')?.textContent).toContain('Louvores para Jó 42:2')

    // Primeiro louvor é citação direta com 100% Citação
    const cards = container.querySelectorAll('.louvor-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].querySelector('.louvor-titulo')?.textContent).toBe('Bem sei que tudo podes')
    expect(cards[0].querySelector('.louvor-badge-afinidade')?.textContent).toBe('100% Citação')
    expect(cards[0].querySelector('.louvor-tag--citacao')?.textContent).toContain('Jó 42:2')

    // Botão de limpar
    const limparBtn = container.querySelector('.louvores-foco-limpar-btn') as HTMLButtonElement
    expect(limparBtn).not.toBeNull()
    await act(async () => {
      limparBtn.click()
    })
    expect(onLimpar).toHaveBeenCalledTimes(1)
  })

  it('exibe mensagem quando não há louvores associados à perícope', async () => {
    mockRetornoLouvores = []

    await act(async () => {
      root.render(<AbaLouvores pericope={{ ordem: 1234 } as any} />)
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(container.textContent).toContain('Nenhum louvor associado a esta perícope.')
  })

  it('permite carregar mais louvores quando há mais de 6 itens', async () => {
    mockRetornoLouvores = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      number: `${i + 1}`,
      name: `Louvor ${i + 1}`,
      category: 'Geral',
      tags: '',
      similarity: 80 - i,
      matchTipo: 'tematico' as const,
    }))

    await act(async () => {
      root.render(<AbaLouvores pericope={{ ordem: 2031 } as any} />)
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    // Inicialmente mostra 6
    let cards = container.querySelectorAll('.louvor-card')
    expect(cards).toHaveLength(6)

    const carregarMaisBtn = container.querySelector('.louvores-carregar-mais-btn') as HTMLButtonElement
    expect(carregarMaisBtn).not.toBeNull()
    expect(carregarMaisBtn.textContent).toContain('Ver mais louvores (+4)')

    await act(async () => {
      carregarMaisBtn.click()
    })

    // Agora mostra todos os 10
    cards = container.querySelectorAll('.louvor-card')
    expect(cards).toHaveLength(10)
    expect(container.querySelector('.louvores-carregar-mais-btn')).toBeNull()
  })
})
