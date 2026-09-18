// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Jornada as JornadaType, PericopeIndex, Progresso } from '../lib/types'

// Sessão controlada pelo teste.
let sessao: { user: { id: string } } | null = { user: { id: 'u1' } }
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: sessao }) },
}))

// Catálogo mínimo em memória — mesmo padrão de Jornada.test.tsx.
function peri(ordem: number, livro: string, abbrev: string, cap = 1): PericopeIndex {
  return {
    ordem,
    livro,
    abbrev,
    capitulo_inicio: cap,
    versiculo_inicio: 1,
    capitulo_fim: cap,
    versiculo_fim: 10,
    titulo_pericope_pt: `${livro} ${cap}`,
    minutos: 3,
    narrado: false,
    seq: ordem,
  }
}
const INDICE: PericopeIndex[] = [
  peri(0, 'Gênesis', 'Gn', 1),
  peri(1, 'Gênesis', 'Gn', 2),
  peri(2, 'Salmos', 'Sl', 1),
  peri(3, 'Salmos', 'Sl', 2),
  peri(4, 'Mateus', 'Mt', 1),
  peri(5, 'Mateus', 'Mt', 2),
]
vi.mock('../lib/content', () => ({
  loadIndex: () => Promise.resolve(INDICE),
  refLabel: (p: PericopeIndex) =>
    p.capitulo_inicio === p.capitulo_fim && p.versiculo_inicio === p.versiculo_fim
      ? `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}`
      : `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}–${p.capitulo_fim}:${p.versiculo_fim}`,
}))

const listAllProgresso = vi.fn<() => Promise<Progresso[]>>()
const criarJornada = vi.fn<
  (input: {
    nome: string
    tipo: JornadaType['tipo']
    escopo: string
    inicioOrdem: number
    contaDesde: string | null
  }) => Promise<JornadaType>
>()
vi.mock('../lib/user-db', () => ({
  listAllProgresso: () => listAllProgresso(),
  criarJornada: (input: Parameters<typeof criarJornada>[0]) => criarJornada(input),
}))

import NovaJornada from './NovaJornada'

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

function montar(entry = '/jornada/nova') {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <NovaJornada />
      </MemoryRouter>,
    )
  })
}

async function assentar() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function botao(texto: string): HTMLButtonElement {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  if (!el) throw new Error(`botão "${texto}" não encontrado`)
  return el
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  sessao = { user: { id: 'u1' } }
  listAllProgresso.mockReset().mockResolvedValue([])
  criarJornada.mockReset().mockResolvedValue(jornada())
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('NovaJornada — sem sessão', () => {
  it('mostra convite para entrar sem consultar o banco', async () => {
    sessao = null
    montar()
    await assentar()
    expect(host.textContent).toContain('Entre')
    expect(host.querySelector('a[href="/entrar"]')).not.toBeNull()
    expect(listAllProgresso).not.toHaveBeenCalled()
  })
})

describe('NovaJornada — catálogo (passo 1)', () => {
  it('mostra "Escolha um escopo" com os quatro grupos', async () => {
    montar()
    await assentar()
    expect(host.textContent).toContain('Escolha um escopo')
    expect(host.textContent).toContain('Curta — um livro')
    expect(host.textContent).toContain('Média — um bloco')
    expect(host.textContent).toContain('Longa — um testamento')
    expect(host.textContent).toContain('Inteira')
  })

  it('cada grupo tem cabeçalho clicável para collapse/expand', async () => {
    montar()
    await assentar()
    // Gênesis deve estar visível (seção expandida por padrão)
    expect(host.textContent).toContain('Gênesis')
    // Clicar no header da seção Curta colapsa a lista
    const headers = [...host.querySelectorAll<HTMLButtonElement>('.jornada-grupo-header')]
    expect(headers.length).toBeGreaterThan(0)
    act(() => headers[0]!.click())
    // Gênesis pode sumir se colapsado (depende do número de itens antes do corte)
    // — o que importa é que o estado mudou
    const chevronsApos = [...host.querySelectorAll('.jornada-grupo-chevron')].map((el) => el.textContent)
    expect(chevronsApos[0]).toBe('▶') // colapsado
  })

  it('link "← Jornadas" aponta para /jornada', async () => {
    montar()
    await assentar()
    const voltar = host.querySelector<HTMLAnchorElement>('a[href="/jornada"]')
    expect(voltar).not.toBeNull()
  })

  it('cada card mostra a contagem e a duração calculadas do índice', async () => {
    montar()
    await assentar()
    // Gênesis: 2 perícopes de 3 min = 6 min
    expect(host.textContent).toContain('2 perícopes · ~6 min')
  })

  it('clicar em um escopo abre o passo 2 (confirmação)', async () => {
    montar()
    await assentar()
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
    expect(host.textContent).toContain('Confirme sua jornada')
  })
})

describe('NovaJornada — passo 2: confirmação', () => {
  async function irAoPasso2() {
    montar()
    await assentar()
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
  }

  it('nome pré-preenchido, modo padrão Continuar', async () => {
    await irAoPasso2()
    const nomeInput = host.querySelector('input[type="text"]') as HTMLInputElement
    expect(nomeInput.value).toBe('Gênesis')
    const continuar = [...host.querySelectorAll('input[type="radio"]')].find(
      (r) => (r.nextSibling?.textContent ?? r.parentElement?.textContent)?.includes('Continuar'),
    ) as HTMLInputElement
    expect(continuar.checked).toBe(true)
  })

  it('tooltips (?) estão presentes nos campos Começar em, Terminar em e Modo', async () => {
    await irAoPasso2()
    const btnsAjuda = host.querySelectorAll('.tooltip-btn')
    expect(btnsAjuda.length).toBeGreaterThanOrEqual(3)
  })

  it('clicar no (?) exibe o balão de ajuda', async () => {
    await irAoPasso2()
    const btnAjuda = host.querySelector<HTMLButtonElement>('.tooltip-btn')!
    act(() => btnAjuda.click())
    expect(host.querySelector('.tooltip-balao')).not.toBeNull()
  })

  it('Criar jornada chama criarJornada com os dados corretos', async () => {
    await irAoPasso2()
    await act(async () => botao('Criar jornada').click())
    expect(criarJornada).toHaveBeenCalledTimes(1)
    expect(criarJornada.mock.calls[0][0]).toEqual({
      nome: 'Gênesis',
      tipo: 'livro',
      escopo: 'Gênesis',
      inicioOrdem: 0,
      contaDesde: null,
    })
  })

  it('modo Reler manda contaDesde como ISO, não null', async () => {
    await irAoPasso2()
    const reler = [...host.querySelectorAll('input[type="radio"]')].find(
      (r) => r.parentElement?.textContent === 'Reler',
    ) as HTMLInputElement
    act(() => reler.click())
    await act(async () => botao('Criar jornada').click())
    const patch = criarJornada.mock.calls[0][0]
    expect(patch.contaDesde).not.toBeNull()
    expect(typeof patch.contaDesde).toBe('string')
  })

  it('Cancelar volta ao catálogo', async () => {
    await irAoPasso2()
    act(() => botao('Cancelar').click())
    expect(host.textContent).not.toContain('Confirme sua jornada')
    expect(host.textContent).toContain('Escolha um escopo')
    expect(criarJornada).not.toHaveBeenCalled()
  })

  it('modo Continuar com o escopo já todo lido: avisa', async () => {
    listAllProgresso.mockResolvedValue([
      { pericopeOrdem: 0, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
      { pericopeOrdem: 1, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
    ])
    await irAoPasso2()
    expect(host.textContent).toContain('Você já leu tudo desse escopo')
  })
})

describe('NovaJornada — "Ver mais"', () => {
  it('seções com mais de 5 itens exibem "Ver mais" e expandem ao clicar', async () => {
    montar()
    await assentar()
    // Curta tem 66 livros no catálogo canônico > 5
    const grupoCurta = host.querySelector('.jornada-grupo--curta')!
    expect(grupoCurta).not.toBeNull()
    const btnVerMais = grupoCurta.querySelector<HTMLButtonElement>('.jornada-ver-mais')
    expect(btnVerMais).not.toBeNull()
    expect(btnVerMais?.textContent).toContain('Ver mais (61 ocultos)')

    // Inicialmente mostra apenas 5 botões de escopo
    const antes = grupoCurta.querySelectorAll('.jornada-escopo')
    expect(antes.length).toBe(5)

    // Clica no "Ver mais"
    act(() => btnVerMais!.click())

    // Agora exibe todos os 66 livros e o botão some
    const depois = grupoCurta.querySelectorAll('.jornada-escopo')
    expect(depois.length).toBe(66)
    expect(grupoCurta.querySelector('.jornada-ver-mais')).toBeNull()
  })

  it('seções com 5 ou menos itens não exibem "Ver mais"', async () => {
    montar()
    await assentar()
    // Longa tem 2 testamentos e Inteira tem 1 item
    const grupoLonga = host.querySelector('.jornada-grupo--longa')!
    expect(grupoLonga.querySelector('.jornada-ver-mais')).toBeNull()

    const grupoInteira = host.querySelector('.jornada-grupo--inteira')!
    expect(grupoInteira.querySelector('.jornada-ver-mais')).toBeNull()
  })
})
