// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Jornada as JornadaType, PericopeIndex, PosicaoLeitura, Progresso } from '../lib/types'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let sessao: { user: { id: string } } | null = { user: { id: 'u1' } }
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: sessao }) },
}))

function peri(ordem: number, livro: string, abbrev: string, cap = 1): PericopeIndex {
  return {
    ordem,
    seq: ordem,
    livro,
    abbrev,
    capitulo_inicio: cap,
    versiculo_inicio: 1,
    capitulo_fim: cap,
    versiculo_fim: 10,
    titulo_pericope_pt: `${livro} ${cap}`,
    minutos: 3,
    narrado: false,
  }
}

const INDICE: PericopeIndex[] = [
  peri(0, 'Gênesis', 'Gn', 1),
  peri(1, 'Gênesis', 'Gn', 2),
  peri(2, 'Mateus', 'Mt', 1),
  peri(3, 'Mateus', 'Mt', 2),
]

vi.mock('../lib/content', async () => {
  const actual = await vi.importActual<typeof import('../lib/content')>('../lib/content')
  return {
    ...actual,
    loadIndex: () => Promise.resolve(INDICE),
    refLabel: (p: PericopeIndex) => `${p.livro} ${p.capitulo_inicio}:1`,
  }
})

const listJornadasAtivas = vi.fn<() => Promise<JornadaType[]>>()
const listAllProgresso = vi.fn<() => Promise<Progresso[]>>()
const listAllPosicoes = vi.fn<() => Promise<PosicaoLeitura[]>>()
const atualizarJornada = vi.fn<(id: string, patch: Partial<JornadaType>) => Promise<JornadaType>>()

vi.mock('../lib/user-db', () => ({
  listJornadasAtivas: () => listJornadasAtivas(),
  listAllProgresso: () => listAllProgresso(),
  listAllPosicoes: () => listAllPosicoes(),
  atualizarJornada: (id: string, patch: Partial<JornadaType>) => atualizarJornada(id, patch),
}))

import Home from './Home'

function jornada(over: Partial<JornadaType> = {}): JornadaType {
  return {
    id: 'j1',
    nome: 'Gênesis',
    tipo: 'livro',
    escopo: 'Gênesis',
    inicioOrdem: 0,
    contaDesde: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    arquivadaEm: null,
    concluidaEm: null,
    ...over,
  }
}

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  sessao = { user: { id: 'u1' } }
  listJornadasAtivas.mockReset().mockResolvedValue([])
  listAllProgresso.mockReset().mockResolvedValue([])
  listAllPosicoes.mockReset().mockResolvedValue([])
  atualizarJornada.mockReset().mockResolvedValue(jornada())
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function montar() {
  act(() => {
    root.render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
  })
}

async function assentar() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 50))
  })
}

describe('Home — com jornadas ativas', () => {
  it('renderiza o carrossel com os cards de todas as jornadas ativas e o link Ver todas', async () => {
    const j1 = jornada({ id: 'j1', nome: 'Evangelhos de Cristo' })
    const j2 = jornada({ id: 'j2', nome: 'Salmos & Sabedoria', escopo: 'Mateus', inicioOrdem: 2 })
    listJornadasAtivas.mockResolvedValue([j1, j2])

    montar()
    await assentar()

    expect(host.textContent).toContain('Continue de onde parou')
    expect(host.textContent).toContain('Evangelhos de Cristo')
    expect(host.textContent).toContain('Salmos & Sabedoria')
    expect(host.textContent).toContain('Ver todas as jornadas')

    const carrossel = host.querySelector('.jornadas-carrossel')
    expect(carrossel).not.toBeNull()

    const dots = host.querySelectorAll('.jornadas-dot')
    expect(dots).toHaveLength(3) // 2 jornadas + 1 card "+ Nova jornada"
  })

  it('reconcilia e marca como concluída uma jornada cuja rota foi toda lida', async () => {
    const j = jornada({ id: 'j1', nome: 'Gênesis Completo' })
    listJornadasAtivas.mockResolvedValue([j])
    listAllProgresso.mockResolvedValue([
      { pericopeOrdem: 0, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
      { pericopeOrdem: 1, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
    ])

    montar()
    await assentar()

    expect(atualizarJornada).toHaveBeenCalledTimes(1)
    const [id, patch] = atualizarJornada.mock.calls[0]
    expect(id).toBe('j1')
    expect(patch.concluidaEm).not.toBeNull()
  })
})

describe('Home — sem jornadas ativas', () => {
  it('renderiza o fallback com as trilhas VT/NT e o convite Comece uma jornada', async () => {
    listJornadasAtivas.mockResolvedValue([])

    montar()
    await assentar()

    expect(host.textContent).toContain('Duas leituras em paralelo')
    expect(host.textContent).toContain('Velho Testamento')
    expect(host.textContent).toContain('Novo Testamento')
    expect(host.textContent).toContain('Comece uma jornada')
    expect(host.querySelector('.jornadas-carrossel')).toBeNull()
  })
})
