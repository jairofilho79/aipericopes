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
  referencias: true,
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
  narrado: false,
  texto: 'Capítulo 102\n1 Ó SENHOR, ouve minha oração.\n2 Não escondas de mim o teu rosto.',
  sobrescrito: 'Oração do aflito, quando ele se viu desfalecido',
  titulo_pericope_pt: 'Oração do aflito',
  contexto_historico_literario: 'Contexto do salmo 102.',
  resenha: 'Resenha do salmo 102.',
  perguntas_reflexao: ['Reflexão 1?'],
}

const PERICOPE_MATEUS_3: Pericope = {
  ordem: 1607,
  seq: 1607,
  livro: 'Mateus',
  abbrev: 'Mt',
  capitulo_inicio: 3,
  versiculo_inicio: 13,
  capitulo_fim: 3,
  versiculo_fim: 15,
  minutos: 1,
  narrado: false,
  texto:
    'Capítulo 3\n13 Então Jesus veio da Galileia ao Jordão.\n14 Mas João lhe impedia.\n15 Porém Jesus lhe respondeu: Permite por agora, porque assim nos convém cumprir toda a justiça. Então ele o permitiu.',
  titulo_pericope_pt: 'O batismo de Jesus',
  contexto_historico_literario: 'Contexto de Mateus 3.',
  resenha: 'Resenha de Mateus 3.',
  perguntas_reflexao: ['Reflexão?'],
  palavras_jesus: {
    '3:15': ['Permite por agora, porque assim nos convém cumprir toda a justiça.'],
  },
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
    narrado: false,
  },
  {
    ordem: 1607,
    seq: 1607,
    livro: 'Mateus',
    abbrev: 'Mt',
    capitulo_inicio: 3,
    versiculo_inicio: 13,
    capitulo_fim: 3,
    versiculo_fim: 15,
    titulo_pericope_pt: 'O batismo de Jesus',
    minutos: 1,
    narrado: false,
  },
]

vi.mock('../lib/content', () => ({
  loadIndex: async () => INDICE,
  getPericope: async (ordem: number) =>
    ordem === 1607 ? PERICOPE_MATEUS_3 : ordem === 3146 ? PERICOPE_102 : undefined,
  anteriorNoTestamento: () => null,
  proximaNoTestamento: () => null,
  refLabel: () => 'Salmos 102:1–2',
  testamentOf: () => 'AT',
  testamentLabel: () => 'Antigo Testamento',
  posicaoNoLivro: () => ({ atual: 1, total: 1 }),
}))

let mockJornada: unknown = undefined
const getJornada = vi.fn(async () => mockJornada)

vi.mock('../lib/user-db', () => ({
  getJornada: () => getJornada(),
  listAnotacoes: async () => [],
  listDestaques: async () => [],
  getProgresso: async () => null,
  setProgresso: async () => {},
  concluirProgresso: async () => {},
  desmarcarProgresso: async () => {},
  setParaReler: async () => {},
  useSyncRefresh: () => {},
  saveAnotacao: async () => {},
  deleteAnotacao: async () => {},
  setDestaque: async () => {},
  removeDestaque: async () => {},
  destaqueId: () => '',
  getVerseFocus: () => null,
  setVerseFocus: () => {},
  getPosicao: async () => null,
  setPosicaoLocal: async () => {},
  clearPosicao: async () => {},
  enqueuePosicao: async () => {},
}))

vi.mock('../lib/verse-highlight', () => ({
  getVerseFocus: () => null,
  setVerseFocus: () => {},
}))

vi.mock('../components/NarracaoPlayer', () => ({
  default: () => <div data-testid="narracao-player" />,
  IconePlay: () => <span>Play</span>,
  IconePausa: () => <span>Pausa</span>,
}))

vi.mock('../components/LeituraTopo', () => ({
  default: ({ jornadaNome, origemRotulo }: { jornadaNome?: string; origemRotulo?: string | null }) => (
    <header data-testid="leitura-topo" data-jornada-nome={jornadaNome} data-origem-rotulo={origemRotulo ?? ''} />
  ),
}))

vi.mock('../components/SectionChips', () => ({
  default: () => <nav data-testid="section-chips" />,
}))

vi.mock('../lib/use-reading-prefs', () => ({
  useReadingPrefs: () => prefsMock,
}))

vi.mock('../lib/use-swipe-nav', () => ({ useSwipeNav: () => {} }))
vi.mock('../lib/use-keyboard-nav', () => ({ useKeyboardNav: () => {} }))
vi.mock('../lib/use-sync-refresh', () => ({ useSyncRefresh: () => {} }))
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: null }) },
}))

// Referências cruzadas: cada teste escolhe o que a perícope tem. O padrão é nada.
let refsMock: { capitulo: number; versiculo: number; notas: { letra: string; posicao: number | null; alvos: unknown[] }[] }[] = []
vi.mock('../lib/referencias', async (original) => ({
  ...(await original<typeof import('../lib/referencias')>()),
  obterReferenciasDaPericope: async () => refsMock,
}))
vi.mock('../lib/referencias-previa', () => ({ previaDoAlvo: async () => null }))

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

describe('Leitura — contexto de jornada via query param', () => {
  it('quando jornadaId está presente, carrega a jornada e passa o nome para o LeituraTopo', async () => {
    mockJornada = {
      id: 'j1',
      nome: 'Salmos de Esperança',
      tipo: 'livro',
      escopo: 'Salmos',
      inicioOrdem: 3146,
      contaDesde: null,
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      arquivadaEm: null,
      concluidaEm: null,
    }

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/leitura/3146?jornadaId=j1']}>
          <Routes>
            <Route path="/leitura/:ordem" element={<Leitura />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const topo = container.querySelector('[data-testid="leitura-topo"]')
    expect(topo).not.toBeNull()
    expect(topo?.getAttribute('data-jornada-nome')).toBe('Salmos de Esperança')
  })
})

describe('Leitura — aba de Louvores', () => {
  it('renderiza o botão da aba Louvores e exibe o painel de louvores ao clicar', async () => {
    await renderLeitura()

    const tabs = Array.from(container.querySelectorAll('.notes-tab'))
    const tabLouvores = tabs.find((t) => t.textContent?.includes('Louvores'))
    expect(tabLouvores).toBeDefined()
    expect(tabLouvores?.getAttribute('aria-selected')).toBe('false')

    await act(async () => {
      tabLouvores?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(tabLouvores?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.louvores-painel')).not.toBeNull()
  })
})

describe('Leitura — Palavras de Jesus em vermelho (Red Letter)', () => {
  it('renderiza frases de Jesus com a classe .palavra-jesus no modo padrão', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/leitura/1607']}>
          <Routes>
            <Route path="/leitura/:ordem" element={<Leitura />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const verso15 = container.querySelector('[data-verse-id="3:15"]')
    expect(verso15).not.toBeNull()

    const falaJesus = verso15?.querySelector('.palavra-jesus')
    expect(falaJesus).not.toBeNull()
    expect(falaJesus?.textContent).toBe(
      'Permite por agora, porque assim nos convém cumprir toda a justiça.',
    )

    // O texto do narrador antes e depois está fora do span .palavra-jesus
    expect(verso15?.textContent).toContain('Porém Jesus lhe respondeu:')
    expect(verso15?.textContent).toContain('Então ele o permitiu.')
  })

  it('renderiza frases de Jesus com a classe .palavra-jesus no layout corrido', async () => {
    prefsMock = { ...prefsMock, layout: 'corrido' }
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/leitura/1607']}>
          <Routes>
            <Route path="/leitura/:ordem" element={<Leitura />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const verso15 = container.querySelector('[data-verse-id="3:15"]')
    expect(verso15).not.toBeNull()

    const falaJesus = verso15?.querySelector('.palavra-jesus')
    expect(falaJesus).not.toBeNull()
    expect(falaJesus?.textContent).toBe(
      'Permite por agora, porque assim nos convém cumprir toda a justiça.',
    )
  })
})

describe('Leitura — letrinhas de referência cruzada', () => {
  const ALVO = {
    livro: 'Marcos',
    capitulo: 1,
    versiculo: '9',
    versiculos: [9],
    rotulo: 'Marcos 1:9',
  }

  async function renderMateus() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/leitura/1607']}>
          <Routes>
            <Route path="/leitura/:ordem" element={<Leitura />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  }

  beforeEach(() => {
    prefsMock = { ...prefsMock, layout: 'blocos', referencias: true }
    refsMock = [{ capitulo: 3, versiculo: 14, notas: [{ letra: 'a', posicao: 2, alvos: [ALVO] }] }]
  })

  afterEach(() => {
    refsMock = []
  })

  it.each(['blocos', 'corrido'] as const)('coloca a letra colada na palavra certa no layout %s', async (layout) => {
    prefsMock = { ...prefsMock, layout }
    await renderMateus()
    const callout = container.querySelector('[data-verse-id="3:14"] .ref-callout')
    expect(callout).not.toBeNull()
    expect(callout?.getAttribute('data-letra')).toBe('a')
    expect(callout?.previousSibling?.textContent).toBe('Mas João')
  })

  it('a letra não vira texto: o texto do versículo segue idêntico', async () => {
    await renderMateus()
    const verso = container.querySelector('[data-verse-id="3:14"] .verse-text')
    expect(verso?.textContent).toBe('Mas João lhe impedia.')
  })

  it('com a preferência desligada, nenhuma letra aparece', async () => {
    prefsMock = { ...prefsMock, referencias: false }
    await renderMateus()
    expect(container.querySelector('.ref-callout')).toBeNull()
  })

  it('a letra nunca fica dentro do vermelho das palavras de Jesus', async () => {
    refsMock = [{ capitulo: 3, versiculo: 15, notas: [{ letra: 'a', posicao: 7, alvos: [ALVO] }] }]
    await renderMateus()
    const callout = container.querySelector('[data-verse-id="3:15"] .ref-callout')
    expect(callout).not.toBeNull()
    expect(callout?.closest('.palavra-jesus')).toBeNull()
    expect(container.querySelector('[data-verse-id="3:15"] .verse-text')?.textContent).toContain(
      'Permite por agora, porque assim nos convém cumprir toda a justiça.',
    )
  })

  it('tocar na letra abre as referências e NÃO seleciona o versículo', async () => {
    await renderMateus()
    const callout = container.querySelector<HTMLElement>('[data-verse-id="3:14"] .ref-callout')!
    await act(async () => {
      callout.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const painel = container.querySelector('.ref-sheet')
    expect(painel).not.toBeNull()
    expect(painel?.textContent).toContain('Mateus 3:14')
    expect(painel?.textContent).toContain('Marcos 1:9')
    expect(container.querySelector('[data-verse-id="3:14"]')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('tocar no versículo fora da letra seleciona e fecha as referências', async () => {
    await renderMateus()
    await act(async () => {
      container
        .querySelector<HTMLElement>('[data-verse-id="3:14"] .ref-callout')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('.ref-sheet')).not.toBeNull()
    await act(async () => {
      container
        .querySelector<HTMLElement>('[data-verse-id="3:13"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('.ref-sheet')).toBeNull()
    expect(container.querySelector('[data-verse-id="3:13"]')?.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Leitura — aba Referências', () => {
  it('a aba existe e abre o painel de referências da perícope', async () => {
    refsMock = [
      {
        capitulo: 3,
        versiculo: 14,
        notas: [{ letra: 'a', posicao: 2, alvos: [{ livro: 'Marcos', capitulo: 1, versiculo: '9', versiculos: [9], rotulo: 'Marcos 1:9' }] }],
      },
    ]
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/leitura/1607']}>
          <Routes>
            <Route path="/leitura/:ordem" element={<Leitura />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    const aba = Array.from(container.querySelectorAll('.notes-tab')).find((t) => t.textContent?.includes('Referências'))
    expect(aba).toBeDefined()
    await act(async () => {
      aba?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(aba?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.refs-painel')).not.toBeNull()
    refsMock = []
  })
})

describe('Leitura — chegou por uma referência cruzada', () => {
  async function renderEm(url: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/leitura/:ordem" element={<Leitura />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  }
  const topo = () => container.querySelector('[data-testid="leitura-topo"]')

  it('entrega ao topo o rótulo da perícope e do versículo de origem', async () => {
    await renderEm('/leitura/1607?via=ref&origem=3146&ov=102%3A1')
    expect(topo()?.getAttribute('data-origem-rotulo')).toBe('Salmos 102:1')
  })

  it('sem via=ref, não há origem', async () => {
    await renderEm('/leitura/1607?origem=3146&ov=102%3A1')
    expect(topo()?.getAttribute('data-origem-rotulo')).toBe('')
  })

  it('origem que não existe no índice não quebra: o topo cai no nome genérico', async () => {
    await renderEm('/leitura/1607?via=ref&origem=999999&ov=1%3A1')
    expect(topo()?.getAttribute('data-origem-rotulo')).toBe('')
  })

  it('a jornada da origem (jid) nomeia o destino "Jornada" sem virar a rota da leitura', async () => {
    mockJornada = {
      id: 'j1',
      nome: 'Salmos de Esperança',
      tipo: 'livro',
      escopo: 'Salmos',
      inicioOrdem: 3146,
      contaDesde: null,
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '2026-01-01T00:00:00.000Z',
      arquivadaEm: null,
      concluidaEm: null,
    }
    await renderEm('/leitura/1607?via=ref&origem=3146&ov=102%3A1&jid=j1')
    expect(topo()?.getAttribute('data-jornada-nome')).toBe('Salmos de Esperança')
    mockJornada = undefined
  })
})
