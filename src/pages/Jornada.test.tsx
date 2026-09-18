// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Jornada as JornadaType, PericopeIndex, PosicaoLeitura, Progresso } from '../lib/types'

// Sessão controlada pelo teste: `sessao` null = deslogado.
let sessao: { user: { id: string } } | null = { user: { id: 'u1' } }
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: sessao }) },
}))

// loadIndex NUNCA lê public/data/index.json em teste (ausente na CI): um
// catálogo mínimo em memória, no mesmo espírito de jornadas.test.ts. Três
// livros (Gênesis, Salmos, Mateus) para o catálogo ter itens de tamanhos e
// testamentos diferentes para escolher no passo 1.
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
  // Mesmo algoritmo do refLabel real (src/lib/content.ts): ponto único quando
  // início e fim coincidem, faixa caso contrário — o fixture usa faixa
  // (versiculo_fim: 10), então o rótulo esperado nos testes reflete isso.
  refLabel: (p: PericopeIndex) =>
    p.capitulo_inicio === p.capitulo_fim && p.versiculo_inicio === p.versiculo_fim
      ? `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}`
      : `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}–${p.capitulo_fim}:${p.versiculo_fim}`,
}))

const getJornadaCorrente = vi.fn<() => Promise<JornadaType | undefined>>()
const listJornadas = vi.fn<() => Promise<JornadaType[]>>()
const listJornadasAtivas = vi.fn<() => Promise<JornadaType[]>>()
const arquivarJornada = vi.fn<(id: string) => Promise<JornadaType | undefined>>()
const listAllProgresso = vi.fn<() => Promise<Progresso[]>>()
const listAllPosicoes = vi.fn<() => Promise<PosicaoLeitura[]>>()
const atualizarJornada = vi.fn<(id: string, patch: Partial<JornadaType>) => Promise<JornadaType>>()
const criarJornada = vi.fn<
  (input: {
    nome: string
    tipo: JornadaType['tipo']
    escopo: string
    inicioOrdem: number
    contaDesde: string | null
  }) => Promise<JornadaType>
>()
const getPosicaoMaisRecente = vi.fn<(ordens: number[]) => Promise<PosicaoLeitura | undefined>>()
vi.mock('../lib/user-db', () => ({
  getJornadaCorrente: () => getJornadaCorrente(),
  listJornadas: () => listJornadas(),
  listJornadasAtivas: () => listJornadasAtivas(),
  arquivarJornada: (id: string) => arquivarJornada(id),
  listAllProgresso: () => listAllProgresso(),
  listAllPosicoes: () => listAllPosicoes(),
  atualizarJornada: (id: string, patch: Partial<JornadaType>) => atualizarJornada(id, patch),
  criarJornada: (input: Parameters<typeof criarJornada>[0]) => criarJornada(input),
  getPosicaoMaisRecente: (ordens: number[]) => getPosicaoMaisRecente(ordens),
}))

import Jornada from './Jornada'

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

function montar(entry = '/') {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Jornada />
      </MemoryRouter>,
    )
  })
}

// Deixa as promises encadeadas em carregar() resolverem antes de inspecionar o DOM.
async function assentar() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function botao(texto: string): HTMLButtonElement {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent === texto)
  if (!el) throw new Error(`botão "${texto}" não encontrado`)
  return el
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  sessao = { user: { id: 'u1' } }
  getJornadaCorrente.mockReset().mockResolvedValue(undefined)
  listJornadas.mockReset().mockResolvedValue([])
  listJornadasAtivas.mockReset().mockImplementation(async () => {
    const c = await getJornadaCorrente()
    return c ? [c] : []
  })
  arquivarJornada.mockReset().mockImplementation(async (id: string) => {
    return atualizarJornada(id, { arquivadaEm: new Date().toISOString() })
  })
  listAllProgresso.mockReset().mockResolvedValue([])
  listAllPosicoes.mockReset().mockResolvedValue([])
  atualizarJornada.mockReset().mockResolvedValue(jornada())
  criarJornada.mockReset().mockResolvedValue(jornada())
  getPosicaoMaisRecente.mockReset().mockResolvedValue(undefined)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('Jornada — sem sessão', () => {
  it('mostra só o convite, sem consultar o IndexedDB', async () => {
    sessao = null
    montar()
    await assentar()
    expect(host.textContent).toContain('Entre')
    expect(host.querySelector('a[href="/entrar"]')).not.toBeNull()
    expect(getJornadaCorrente).not.toHaveBeenCalled()
  })
})

describe('Jornada — logado, sem jornada corrente', () => {
  it('mostra "nenhuma jornada ainda" e link para /jornada/nova', async () => {
    montar()
    await assentar()
    expect(host.textContent).toContain('Nenhuma jornada ainda')
    // "Comece uma jornada" agora é um <a> que navega para /jornada/nova
    const link = host.querySelector<HTMLAnchorElement>('a[href="/jornada/nova"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toContain('Comece uma jornada')
  })
})

describe('Jornada — passo 1: catálogo', () => {
  it('o link "Comece uma jornada" aponta para /jornada/nova', async () => {
    montar()
    await assentar()
    // Catálogo foi movido para /jornada/nova — a /jornada só mostra o link
    const link = host.querySelector<HTMLAnchorElement>('a[href="/jornada/nova"]')
    expect(link).not.toBeNull()
  })
})

describe('Jornada — logado, com jornada corrente', () => {
  it('mostra nome, progresso e barra', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ nome: 'Minha jornada' }))
    listAllProgresso.mockResolvedValue([{ pericopeOrdem: 0, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' }])
    montar()
    await assentar()
    expect(host.textContent).toContain('Minha jornada')
    expect(host.textContent).toContain('1 de 2')
    const fill = host.querySelector('.book-progress-fill') as HTMLElement | null
    expect(fill?.style.width).toBe('50%')
    const cta = host.querySelector<HTMLAnchorElement>('.card-acoes .cta')
    expect(cta?.textContent?.trim()).toBe('Continuar')
  })

  it('exibe botão Começar quando concluidas === 0 e botão Ouvir com fone quando narrado', async () => {
    INDICE[0]!.narrado = true
    getJornadaCorrente.mockResolvedValue(jornada({ nome: 'Nova jornada' }))
    listAllProgresso.mockResolvedValue([])
    montar()
    await assentar()

    const cta = host.querySelector<HTMLAnchorElement>('.card-acoes .cta')
    expect(cta?.textContent?.trim()).toBe('Começar')

    const ouvir = host.querySelector<HTMLAnchorElement>('.card-acoes .ouvir-botao')
    expect(ouvir).not.toBeNull()
    expect(ouvir?.textContent).toContain('Ouvir')
    expect(ouvir?.querySelector('svg')).not.toBeNull()
    INDICE[0]!.narrado = false
  })

  it('Reiniciar pede confirmação inline e só então grava o patch', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9' }))
    montar()
    await assentar()
    const reiniciar = botao('Reiniciar')
    act(() => reiniciar.click())
    expect(atualizarJornada).not.toHaveBeenCalled()
    expect(host.textContent).toContain('do zero?')

    const sim = botao('Sim')
    await act(async () => sim.click())
    expect(atualizarJornada).toHaveBeenCalledTimes(1)
    const [id, patch] = atualizarJornada.mock.calls[0]
    expect(id).toBe('j9')
    expect(patch.concluidaEm).toBeNull()
    expect(typeof patch.contaDesde).toBe('string')
  })

  it('Cancelar na confirmação de Reiniciar/Encerrar não grava nada', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9' }))
    montar()
    await assentar()
    const encerrar = botao('Encerrar')
    act(() => encerrar.click())
    const cancelar = botao('Cancelar')
    act(() => cancelar.click())
    expect(atualizarJornada).not.toHaveBeenCalled()
    expect(host.textContent).not.toContain('Encerrar esta jornada?')
  })

  it('Encerrar grava arquivadaEm e nada mais', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9' }))
    montar()
    await assentar()
    const encerrar = botao('Encerrar')
    act(() => encerrar.click())
    const sim = botao('Sim')
    await act(async () => sim.click())
    const [, patch] = atualizarJornada.mock.calls[0]
    expect(Object.keys(patch)).toEqual(['arquivadaEm'])
    expect(typeof patch.arquivadaEm).toBe('string')
  })

  it('mostra botão Ver apontando para o Explorar com a jornada e livro se aplicável', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9', tipo: 'livro', escopo: 'Gênesis' }))
    montar()
    await assentar()
    const verLink = host.querySelector('a.ghost[href="/explorar?jornada=j9&livro=G%C3%AAnesis"]')
    expect(verLink).not.toBeNull()
    expect(verLink?.textContent).toBe('Ver')
  })

  it('o convite mostra "Nova jornada" como link para /jornada/nova', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9' }))
    montar()
    await assentar()
    // "Nova jornada" agora é um <a> que navega para /jornada/nova
    const link = host.querySelector<HTMLAnchorElement>('a[href="/jornada/nova"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toContain('Nova jornada')
  })

  it('a carga de /jornada também reconcilia concluidaEm, igual a Home.tsx (Correção 5)', async () => {
    // Rota inteira (Gênesis: ordens 0 e 1) concluída, mas concluidaEm ainda
    // null — o mesmo cenário que Home.tsx reconcilia. A spec promete os dois
    // caminhos de carga idempotentes; sem isto, /jornada nunca fecharia a
    // jornada quando é a única tela visitada.
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9' }))
    listAllProgresso.mockResolvedValue([
      { pericopeOrdem: 0, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
      { pericopeOrdem: 1, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
    ])
    montar()
    await assentar()
    expect(atualizarJornada).toHaveBeenCalledTimes(1)
    const [id, patch] = atualizarJornada.mock.calls[0]
    expect(id).toBe('j9')
    expect(typeof patch.concluidaEm).toBe('string')
  })
})

describe('Jornada — histórico', () => {
  it('lista as jornadas arquivadas com o progresso final, e a corrente não aparece ali', async () => {
    const corrente = jornada({ id: 'c', nome: 'Corrente' })
    const antiga = jornada({
      id: 'a',
      nome: 'Antiga',
      arquivadaEm: '2026-03-01T00:00:00.000Z',
      concluidaEm: '2026-03-01T00:00:00.000Z',
    })
    getJornadaCorrente.mockResolvedValue(corrente)
    listJornadas.mockResolvedValue([corrente, antiga])
    montar()
    await assentar()
    expect(host.textContent).toContain('Anteriores')
    expect(host.textContent).toContain('Antiga')
    // "Corrente" aparece só uma vez, no card do topo — não duplicada no histórico.
    const ocorrencias = host.textContent?.split('Corrente').length ?? 0
    expect(ocorrencias - 1).toBe(1)
  })

  it('sem histórico, a seção "Anteriores" não aparece', async () => {
    montar()
    await assentar()
    expect(host.textContent).not.toContain('Anteriores')
  })
})

describe('Jornada — multi-jornadas ativas simultâneas', () => {
  it('renderiza múltiplos cards com links contextuais e ações individuais', async () => {
    const j1 = jornada({ id: 'j1', nome: 'Gênesis Inicial', escopo: 'Gênesis', inicioOrdem: 0 })
    const j2 = jornada({ id: 'j2', nome: 'Salmos de Louvor', escopo: 'Salmos', tipo: 'livro', inicioOrdem: 2 })
    listJornadasAtivas.mockResolvedValue([j1, j2])
    listJornadas.mockResolvedValue([j1, j2])
    montar()
    await assentar()

    expect(host.textContent).toContain('Gênesis Inicial')
    expect(host.textContent).toContain('Salmos de Louvor')

    const links = [...host.querySelectorAll<HTMLAnchorElement>('a.cta')]
    const linkJ1 = links.find((a) => a.href.includes('jornadaId=j1'))
    const linkJ2 = links.find((a) => a.href.includes('jornadaId=j2'))
    expect(linkJ1).not.toBeUndefined()
    expect(linkJ2).not.toBeUndefined()
    expect(linkJ1?.href).toContain('/leitura/0')
    expect(linkJ2?.href).toContain('/leitura/2')

    // Confirmação de encerramento afeta apenas o card selecionado
    const botoesEncerrar = [...host.querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent === 'Encerrar',
    )
    expect(botoesEncerrar.length).toBe(2)
    act(() => botoesEncerrar[0]!.click())

    expect(host.textContent).toContain('Encerrar esta jornada?')
    const sim = botao('Sim')
    await act(async () => sim.click())

    expect(atualizarJornada).toHaveBeenCalledWith('j1', expect.objectContaining({
      arquivadaEm: expect.any(String),
    }))
  })
})

describe('Jornada — renomear jornada inline', () => {
  it('abre campo de edição, cancela sem salvar e salva com novo nome', async () => {
    const j1 = jornada({ id: 'j1', nome: 'Nome Original' })
    listJornadasAtivas.mockResolvedValue([j1])
    listJornadas.mockResolvedValue([j1])
    montar()
    await assentar()

    const btnRenomear = host.querySelector<HTMLButtonElement>('.jornada-btn-renomear')!
    expect(btnRenomear).not.toBeNull()
    act(() => btnRenomear.click())

    const input = host.querySelector<HTMLInputElement>('input.jornada-input-nome')!
    expect(input).not.toBeNull()
    expect(input.value).toBe('Nome Original')

    // Cancelar fecha sem atualizar
    act(() => botao('Cancelar').click())
    expect(host.querySelector('input.jornada-input-nome')).toBeNull()
    expect(atualizarJornada).not.toHaveBeenCalled()

    // Abrir de novo e submeter alteração
    act(() => host.querySelector<HTMLButtonElement>('.jornada-btn-renomear')!.click())
    const input2 = host.querySelector<HTMLInputElement>('input.jornada-input-nome')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(input2, 'Nome Atualizado')
      input2.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const form = host.querySelector('form.jornada-form-renomear')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(atualizarJornada).toHaveBeenCalledWith('j1', { nome: 'Nome Atualizado' })
  })
})
