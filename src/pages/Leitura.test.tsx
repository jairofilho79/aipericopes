// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadingPrefs } from '../lib/reading-prefs'
import type { Pericope, PericopeIndex } from '../lib/types'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let prefsMock: ReadingPrefs = {
  font: 'serif',
  sizeStep: 1,
  layout: 'blocos',
  measure: 'media',
  leadingStep: 1,
}

vi.mock('../lib/reading-prefs', () => ({
  getReadingPrefs: () => prefsMock,
  setReadingPrefs: () => {},
  onReadingPrefs: () => () => {},
}))

vi.mock('../lib/use-wake-lock', () => ({
  useWakeLock: () => {},
}))

const PERICOPE_102: Pericope = {
  ordem: 3146,
  seq: 1222,
  livro: 'Salmos',
  abbrev: 'Sl',
  capitulo_inicio: 102,
  versiculo_inicio: 1,
  capitulo_fim: 102,
  versiculo_fim: 2,
  minutos: 1,
  texto: 'Capítulo 102\n1 Ó SENHOR, ouve minha oração.\n2 Não escondas de mim o teu rosto.',
  sobrescrito: 'Oração do aflito, quando ele se viu desfalecido',
  titulo_pericope_pt: 'Oração do aflito',
  contexto_historico_literario: 'Contexto do salmo 102.',
  resenha: 'Resenha do salmo 102.',
  perguntas_reflexao: ['Reflexão 1?'],
}

const INDICE: PericopeIndex[] = [
  {
    ordem: 3146,
    seq: 1222,
    livro: 'Salmos',
    abbrev: 'Sl',
    capitulo_inicio: 102,
    versiculo_inicio: 1,
    capitulo_fim: 102,
    versiculo_fim: 2,
    titulo_pericope_pt: 'Oração do aflito',
    minutos: 1,
  },
]

vi.mock('../lib/content', () => ({
  loadIndex: async () => INDICE,
  getPericope: async (ordem: number) => (ordem === 3146 ? PERICOPE_102 : undefined),
  anteriorNoTestamento: () => null,
  proximaNoTestamento: () => null,
  refLabel: () => 'Salmos 102:1–2',
  testamentOf: () => 'AT',
  testamentLabel: () => 'Antigo Testamento',
}))

vi.mock('../lib/user-db', () => ({
  listAnotacoes: async () => [],
  listDestaques: async () => [],
  getProgresso: async () => null,
  setProgresso: async () => {},
  useSyncRefresh: () => {},
  saveAnotacao: async () => {},
  deleteAnotacao: async () => {},
  setDestaque: async () => {},
  removeDestaque: async () => {},
  getVerseFocus: () => null,
  setVerseFocus: () => {},
  getPosicao: async () => null,
  setPosicao: async () => {},
  enqueuePosicao: async () => {},
}))

vi.mock('../components/NarracaoPlayer', () => ({
  default: () => <div data-testid="narracao-player" />,
  IconePlay: () => <span>Play</span>,
  IconePausa: () => <span>Pausa</span>,
}))

vi.mock('../components/SectionChips', () => ({
  default: () => <nav data-testid="section-chips" />,
}))

vi.mock('../components/VerseActions', () => ({
  default: () => null,
}))

vi.mock('../components/DitarBotao', () => ({
  default: () => null,
}))

import Leitura from './Leitura'

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

async function renderLeitura() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/leitura/3146']}>
        <Routes>
          <Route path="/leitura/:ordem" element={<Leitura />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  // Aguarda microtarefas das chamadas assíncronas do useEffect (loadIndex, getPericope, etc.)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

describe('Leitura — ordem visual do sobrescrito e capítulo na UI', () => {
  it('no layout padrão (por versículo), renderiza Texto -> Capítulo -> Sobrescrito -> Versículo', async () => {
    prefsMock = { ...prefsMock, layout: 'blocos' }
    await renderLeitura()

    const cabecalhoTexto = container.querySelector('[data-fala-id="cabecalho-texto"]')
    const cap102 = container.querySelector('[data-fala-id="cap-102"]')
    const sobrescrito = container.querySelector('[data-fala-id="sobrescrito"]')
    const verso1 = container.querySelector('[data-verse-id="102:1"]')

    expect(cabecalhoTexto).not.toBeNull()
    expect(cap102).not.toBeNull()
    expect(sobrescrito).not.toBeNull()
    expect(verso1).not.toBeNull()

    expect(cabecalhoTexto!.textContent).toContain('Texto')
    expect(cap102!.textContent).toContain('Capítulo 102')
    expect(sobrescrito!.textContent).toContain('Oração do aflito')
    expect(verso1!.textContent).toContain('Ó SENHOR, ouve minha oração')

    // Ordem no DOM: DOCUMENT_POSITION_FOLLOWING (4)
    // cabecalhoTexto precede cap102
    expect(Boolean(cabecalhoTexto!.compareDocumentPosition(cap102!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // cap102 precede sobrescrito
    expect(Boolean(cap102!.compareDocumentPosition(sobrescrito!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // sobrescrito precede verso1
    expect(Boolean(sobrescrito!.compareDocumentPosition(verso1!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('no layout corrido, também renderiza Texto -> Capítulo -> Sobrescrito -> Versículos', async () => {
    prefsMock = { ...prefsMock, layout: 'corrido' }
    await renderLeitura()

    const cabecalhoTexto = container.querySelector('[data-fala-id="cabecalho-texto"]')
    const cap102 = container.querySelector('[data-fala-id="cap-102"]')
    const sobrescrito = container.querySelector('[data-fala-id="sobrescrito"]')
    const verso1 = container.querySelector('[data-verse-id="102:1"]')

    expect(cabecalhoTexto).not.toBeNull()
    expect(cap102).not.toBeNull()
    expect(sobrescrito).not.toBeNull()
    expect(verso1).not.toBeNull()

    // cabecalhoTexto precede cap102
    expect(Boolean(cabecalhoTexto!.compareDocumentPosition(cap102!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // cap102 precede sobrescrito
    expect(Boolean(cap102!.compareDocumentPosition(sobrescrito!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // sobrescrito precede verso1
    expect(Boolean(sobrescrito!.compareDocumentPosition(verso1!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })
})
