// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { JornadasCarrossel, type CardJornadaItem } from './JornadasCarrossel'
import type { Jornada, PericopeIndex } from '../lib/types'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function peri(ordem: number, livro: string, titulo: string, narrado = false): PericopeIndex {
  return {
    ordem,
    seq: ordem,
    livro,
    abbrev: 'Sl',
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 1,
    versiculo_fim: 6,
    titulo_pericope_pt: titulo,
    minutos: 3,
    narrado,
  }
}

function jornada(over: Partial<Jornada> = {}): Jornada {
  return {
    id: 'j1',
    nome: 'Evangelhos',
    tipo: 'bloco',
    escopo: 'evangelhos',
    inicioOrdem: 1,
    contaDesde: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    arquivadaEm: null,
    concluidaEm: null,
    ...over,
  }
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

describe('JornadasCarrossel', () => {
  it('renderiza os cards de jornada, os dots e o card de nova jornada', () => {
    const itens: CardJornadaItem[] = [
      {
        jornada: jornada({ id: 'j1', nome: 'Evangelhos' }),
        prog: { total: 100, concluidas: 20, pct: 20, proximaOrdem: 21 },
        periAtual: peri(21, 'Mateus', 'João Batista prega', true),
      },
      {
        jornada: jornada({ id: 'j2', nome: 'Salmos' }),
        prog: { total: 150, concluidas: 0, pct: 0, proximaOrdem: 1 },
        periAtual: peri(1, 'Salmos', 'O justo e os ímpios', false),
      },
    ]

    act(() => {
      root.render(
        <MemoryRouter>
          <JornadasCarrossel itens={itens} />
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('Evangelhos')
    expect(container.textContent).toContain('Salmos')
    expect(container.textContent).toContain('João Batista prega')
    expect(container.textContent).toContain('O justo e os ímpios')
    expect(container.textContent).toContain('Nova jornada')

    // 3 slides no total (2 jornadas + 1 card novo) = 3 dots
    const dots = container.querySelectorAll('[role="tab"]')
    expect(dots).toHaveLength(3)

    // Links de ação
    const links = Array.from(container.querySelectorAll('a'))
    const linkContinuar = links.find((l) => l.textContent?.includes('Continuar'))
    expect(linkContinuar?.getAttribute('href')).toBe('/leitura/21?jornadaId=j1')

    const linkComecar = links.find((l) => l.textContent?.includes('Começar'))
    expect(linkComecar?.getAttribute('href')).toBe('/leitura/1?jornadaId=j2')

    // Botão de ouvir
    const linkOuvir = links.find((l) => l.getAttribute('aria-label') === 'Ouvir João Batista prega')
    expect(linkOuvir?.getAttribute('href')).toBe('/leitura/21?ouvir=1&jornadaId=j1')

    // Card de nova jornada
    const linkNova = links.find((l) => l.getAttribute('href') === '/jornada?nova=1')
    expect(linkNova).not.toBeNull()
  })

  it('exibe badge de concluída e mensagem de conclusão quando rota terminou', () => {
    const itens: CardJornadaItem[] = [
      {
        jornada: jornada({ id: 'j-conc', nome: 'Jonas', concluidaEm: '2026-09-11T00:00:00.000Z' }),
        prog: { total: 4, concluidas: 4, pct: 100, proximaOrdem: null },
        periAtual: null,
      },
    ]

    act(() => {
      root.render(
        <MemoryRouter>
          <JornadasCarrossel itens={itens} />
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('✓ Concluída')
    expect(container.textContent).toContain('Jornada concluída!')
  })
})
