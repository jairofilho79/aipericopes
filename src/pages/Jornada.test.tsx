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
const listAllProgresso = vi.fn<() => Promise<Progresso[]>>()
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
  listAllProgresso: () => listAllProgresso(),
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

function montar() {
  act(() => {
    root.render(
      <MemoryRouter>
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
  listAllProgresso.mockReset().mockResolvedValue([])
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
  it('mostra "nenhuma jornada ainda" e o botão abre o catálogo (passo 1)', async () => {
    montar()
    await assentar()
    expect(host.textContent).toContain('Nenhuma jornada ainda')
    expect(botao('Comece uma jornada')).not.toBeUndefined()
    act(() => botao('Comece uma jornada').click())
    expect(host.textContent).toContain('Escolha um escopo')
    // Os quatro degraus da escada, cada um com pelo menos um item do fixture.
    expect(host.textContent).toContain('Curta — um livro')
    expect(host.textContent).toContain('Média — um bloco')
    expect(host.textContent).toContain('Longa — um testamento')
    expect(host.textContent).toContain('Inteira')
    expect(host.textContent).toContain('Gênesis')
    expect(host.textContent).toContain('Pentateuco')
    expect(host.textContent).toContain('Velho Testamento')
    expect(host.textContent).toContain('A Bíblia toda')
  })
})

describe('Jornada — passo 1: catálogo', () => {
  it('cada card mostra a contagem e a duração calculadas do índice', async () => {
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    // Gênesis: 2 perícopes de 3 min = 6 min (abaixo de 1h, mostra minutos).
    expect(host.textContent).toContain('2 perícopes · ~6 min')
  })

  it('Cancelar no passo 1 volta para o convite', async () => {
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    act(() => botao('Cancelar').click())
    expect(host.textContent).not.toContain('Escolha um escopo')
    expect(botao('Comece uma jornada')).not.toBeUndefined()
  })
})

describe('Jornada — passo 2: confirmação', () => {
  async function irAoPasso2() {
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
  }

  it('nome pré-preenchido com nomePadrao, modo padrão Continuar, sem checkpoint', async () => {
    await irAoPasso2()
    expect(host.textContent).toContain('Confirme sua jornada')
    const nomeInput = host.querySelector('input[type="text"]') as HTMLInputElement
    expect(nomeInput.value).toBe('Gênesis')
    // Sem checkpoint dentro do escopo (mock resolve undefined): só "Do início".
    expect(host.textContent).toContain('Do início')
    expect(host.textContent).not.toContain('De onde parei')
    const continuar = [...host.querySelectorAll('input[type="radio"]')].find(
      (r) => (r.nextSibling?.textContent ?? r.parentElement?.textContent)?.includes('Continuar'),
    ) as HTMLInputElement
    expect(continuar.checked).toBe(true)
  })

  it('Criar jornada chama criarJornada com o início padrão e contaDesde null', async () => {
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

  it('nome editado à mão é o que vai para criarJornada', async () => {
    await irAoPasso2()
    const nomeInput = host.querySelector('input[type="text"]') as HTMLInputElement
    // O setter nativo, não a atribuição direta: React troca o setter de
    // `.value` da instância para rastrear mudanças, e uma atribuição comum
    // atualiza o valor visível E o rastreador ao mesmo tempo — o evento
    // "input" que vem a seguir não vê diferença nenhuma e o onChange nunca
    // dispara. O setter nativo do protótipo contorna o rastreador do React.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(nomeInput, 'Minha releitura de Gênesis')
      nomeInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => botao('Criar jornada').click())
    expect(criarJornada.mock.calls[0][0].nome).toBe('Minha releitura de Gênesis')
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

  it('Cancelar no passo 2 volta ao convite, sem gravar nada', async () => {
    await irAoPasso2()
    act(() => botao('Cancelar').click())
    expect(host.textContent).not.toContain('Confirme sua jornada')
    expect(criarJornada).not.toHaveBeenCalled()
  })

  it('"de onde parei" só aparece quando há checkpoint no escopo, e escolhê-la muda o início', async () => {
    // Checkpoint na 2ª perícope de Gênesis (ordem 1) — dentro da rota.
    getPosicaoMaisRecente.mockResolvedValue({
      pericopeOrdem: 1,
      tipo: 'versiculo',
      ref: '1:1',
      tempo: null,
      atualizadoEm: '2026-02-01T00:00:00.000Z',
    })
    await irAoPasso2()
    expect(host.textContent).toContain('De onde parei — Gênesis 2:1–2:10')

    const deOndeParei = [...host.querySelectorAll('input[type="radio"]')].find((r) =>
      r.parentElement?.textContent?.startsWith('De onde parei'),
    ) as HTMLInputElement
    act(() => deOndeParei.click())
    await act(async () => botao('Criar jornada').click())
    expect(criarJornada.mock.calls[0][0].inicioOrdem).toBe(1)
  })
})

describe('Jornada — passo 2: escopo vazio', () => {
  it('escopo sem nenhuma perícope (livro do catálogo sem itens): inicioOrdem vai 0, nunca undefined', async () => {
    // "Juízes" não está no fixture INDICE — like montarCatalogo mantém todo
    // livro de BIBLE_BOOKS mesmo com zero perícopes (jornadas.test.ts), o
    // card é clicável e rotaCompleta fica []. Sem o `?? 0` em inicioOrdem,
    // isto grava `inicioOrdem: undefined`, o Worker reprova e sync.ts
    // abandona o lote inteiro do outbox.
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    const juizes = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Juízes'),
    )!
    await act(async () => juizes.click())
    expect(host.textContent).toContain('Confirme sua jornada')
    await act(async () => botao('Criar jornada').click())
    expect(criarJornada).toHaveBeenCalledTimes(1)
    expect(criarJornada.mock.calls[0][0].inicioOrdem).toBe(0)
  })
})

describe('Jornada — avisos do passo 2', () => {
  it('havendo jornada corrente, avisa que ela será arquivada', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'c1', nome: 'Minha jornada atual' }))
    montar()
    await assentar()
    act(() => botao('Nova jornada').click())
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
    expect(host.textContent).toContain('Isto arquiva')
    expect(host.textContent).toContain('Minha jornada atual')
    expect(host.textContent).toContain('que fica no histórico')
  })

  it('sem jornada corrente, nenhum aviso de arquivamento', async () => {
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
    expect(host.textContent).not.toContain('Isto arquiva')
  })

  it('modo Continuar com o escopo já todo lido: avisa, e o aviso some ao trocar para Reler', async () => {
    listAllProgresso.mockResolvedValue([
      { pericopeOrdem: 0, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
      { pericopeOrdem: 1, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
    ])
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
    expect(host.textContent).toContain('Você já leu tudo desse escopo')

    const reler = [...host.querySelectorAll('input[type="radio"]')].find(
      (r) => r.parentElement?.textContent === 'Reler',
    ) as HTMLInputElement
    act(() => reler.click())
    expect(host.textContent).not.toContain('Você já leu tudo desse escopo')
  })

  it('escopo parcialmente lido: sem aviso', async () => {
    listAllProgresso.mockResolvedValue([
      { pericopeOrdem: 0, status: 'concluido', historico: ['2026-02-01T00:00:00.000Z'], paraReler: false, atualizadoEm: '2026-02-01T00:00:00.000Z' },
    ])
    montar()
    await assentar()
    act(() => botao('Comece uma jornada').click())
    const genesis = [...host.querySelectorAll<HTMLButtonElement>('button.jornada-escopo')].find((b) =>
      b.textContent?.startsWith('Gênesis'),
    )!
    await act(async () => genesis.click())
    expect(host.textContent).not.toContain('Você já leu tudo desse escopo')
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

  it('o convite mostra "Nova jornada" em vez de "Comece uma jornada"', async () => {
    getJornadaCorrente.mockResolvedValue(jornada({ id: 'j9' }))
    montar()
    await assentar()
    expect(botao('Nova jornada')).not.toBeUndefined()
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
