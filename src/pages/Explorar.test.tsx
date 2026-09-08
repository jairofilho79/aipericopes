// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const searchTexto = vi.fn(async () => [])

// `historico` e `paraReler` são OBRIGATÓRIOS em `Progresso` desde o merge da
// releitura. Sem eles o `npm test` passa (o vitest não checa tipo) e só o
// `tsc -b` do build quebra — foi exatamente o que aconteceu no commit 14b4f0d.
vi.mock('../lib/user-db', () => ({
  listAllProgresso: async () => [
    {
      pericopeOrdem: 1,
      status: 'concluido',
      historico: [],
      paraReler: false,
      atualizadoEm: '2026-09-03T00:00:00.000Z',
    },
  ],
}))

vi.mock('../lib/fulltext', async (original) => ({
  ...(await original<typeof import('../lib/fulltext')>()),
  searchTexto: (...args: unknown[]) => searchTexto(...(args as [])),
  indexPronto: () => true,
  progressoDoIndice: () => ({ feitos: 66, total: 66 }),
}))

// 60 títulos, todos casando "muitos": mais que LIMITE_RESULTADOS (50), para o
// teste do teto em "Títulos" (ver descrição do it() abaixo).
const MUITOS_TITULOS = Array.from({ length: 60 }, (_, i) => ({
  ordem: 1000 + i,
  livro: 'Provérbios',
  abbrev: 'Pv',
  capitulo_inicio: 1,
  versiculo_inicio: i + 1,
  capitulo_fim: 1,
  versiculo_fim: i + 1,
  titulo_pericope_pt: `Muitos resultados ${i}`,
  minutos: 1,
}))

// Fixture pequeno e estável entre testes: `loadRegistros` cacheia em módulo,
// então mockar a função inteira (em vez de mockar `fetch`) evita que um
// teste que rode antes deixe o cache do módulo real sujo para os seguintes.
// `lamento` carrega a `ordem: 1` — a mesma perícope do fixture de
// `loadIndex` abaixo — para os testes de registro aberto terem algo pra
// mostrar; `louvor` fica vazio para exercitar o rótulo "0".
const FIXTURE_REGISTROS = [
  { slug: 'lamento', nome: 'Lamento', ordens: [1] },
  { slug: 'louvor', nome: 'Louvor', ordens: [] },
]

vi.mock('../lib/registros', async (original) => ({
  ...(await original<typeof import('../lib/registros')>()),
  loadRegistros: async () => FIXTURE_REGISTROS,
}))

vi.mock('../lib/content', async (original) => {
  const real = await original<typeof import('../lib/content')>()
  const ALL = [
    {
      ordem: 1,
      livro: 'João',
      abbrev: 'Jo',
      capitulo_inicio: 3,
      versiculo_inicio: 1,
      capitulo_fim: 3,
      versiculo_fim: 21,
      titulo_pericope_pt: 'Jesus e Nicodemos',
      minutos: 4,
    },
  ]
  return {
    ...real,
    loadIndex: async () => ALL,
    listPericopes: async (opts?: { q?: string }) =>
      opts?.q === 'muitos' ? MUITOS_TITULOS : [],
    listPericopesByBookChapter: async () => ALL,
    findPericopeByRef: async () => ALL[0],
  }
})

import Explorar from './Explorar'
import { notificarSync } from '../lib/sync-event'

// Os dois últimos testes mexem no tempo (debounce de 300 ms da busca no texto).
// Sem timers falsos eles ficariam lentos e instáveis.
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

let host: HTMLDivElement
let root: Root

async function montar(url: string) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Explorar />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  searchTexto.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('Explorar', () => {
  it('em repouso desenha o catálogo dos 66 livros', async () => {
    await montar('/explorar')
    expect(host.querySelectorAll('.livro-row')).toHaveLength(66)
    expect(host.querySelector('.secao-resultado')).toBeNull()
  })

  it('referência abre a seção Referência e NÃO busca no texto', async () => {
    await montar('/explorar?q=Jo%203%3A16')
    const titulos = [...host.querySelectorAll('.secao-h')].map((h) => h.textContent ?? '')
    expect(titulos.some((t) => t.startsWith('Referência'))).toBe(true)
    expect(titulos.some((t) => t.startsWith('No texto'))).toBe(false)
    expect(searchTexto).not.toHaveBeenCalled()
  })

  it('texto livre não abre a seção Livros', async () => {
    await montar('/explorar?q=amor%20de%20Deus')
    const titulos = [...host.querySelectorAll('.secao-h')].map((h) => h.textContent ?? '')
    expect(titulos.some((t) => t.startsWith('Livros'))).toBe(false)
  })

  it('livro aberto mostra o formulário de capítulo e versículo', async () => {
    await montar('/explorar?livro=Jo%C3%A3o')
    expect(host.querySelector('.ref-form')).not.toBeNull()
    expect(host.querySelector('.selected-book-name')?.textContent).toBe('João')
  })

  it('o filtro atravessa: com "lidos", o catálogo conta só concluídas', async () => {
    await montar('/explorar?f=lidos')
    const rotulos = [...host.querySelectorAll('.book-progress-label')].map((n) => n.textContent)
    expect(rotulos.filter((r) => r === '1')).toHaveLength(1)
  })

  // Os dois casos abaixo travam decisões que custaram uma rodada de revisão
  // cada. Sem eles, uma regressão nos dois passa despercebida.

  it('livro aberto e busca são estados exclusivos: com os dois na URL, a busca vence', async () => {
    // O bug era chegar em ?livro=X&q=algo e a caixa de busca ficar MUDA: o
    // render é `livro ? <LivroAberto/> : …`, então nenhuma seção aparecia.
    await montar('/explorar?livro=Jo%C3%A3o&q=amor')
    expect(host.querySelector('.ref-sticky')).toBeNull()
    expect(host.querySelectorAll('.secao-resultado').length).toBeGreaterThan(0)
  })

  it('sync de outro aparelho não reinicia a busca no texto', async () => {
    // `statusPorOrdem` devolve sempre um Map novo; sem `mesmosStatus` essa
    // identidade chegava às dependências do efeito de busca e toda sincronização
    // derrubava a busca em voo, com novo debounce e novo "Buscando…".
    await montar('/explorar?q=amor%20de%20Deus')
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    const antes = searchTexto.mock.calls.length
    // Dois `act` separados, não um: `carregarProgresso` é assíncrono (tem
    // `await listAllProgresso()`), então o `setStatus` só assenta num
    // microtask depois de `notificarSync()` retornar. Adiantar o relógio no
    // MESMO `act` corria o risco de o efeito de busca nem ter visto o Map
    // novo ainda — o teste passaria por acidente de escalonamento, não
    // porque `mesmosStatus` está funcionando.
    await act(async () => {
      notificarSync()
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(searchTexto.mock.calls.length).toBe(antes)
  })

  it('Títulos tem teto de 50, mesmo com mais casos no índice', async () => {
    // O conserto tinha número medido: sem teto, `q="a"` montava ~2.600 links
    // por tecla. O mock de `listPericopes` devolve 60 para "muitos" — acima
    // do teto — só para este teste; os outros continuam recebendo [].
    await montar('/explorar?q=muitos')
    const secoes = [...host.querySelectorAll<HTMLElement>('.secao-resultado')]
    const secaoTitulos = secoes.find((s) => s.querySelector('.secao-h')?.textContent?.startsWith('Títulos'))
    expect(secaoTitulos).toBeDefined()
    expect(secaoTitulos?.querySelectorAll('.peri-list li')).toHaveLength(50)
    expect(secaoTitulos?.querySelector('.secao-h')?.textContent).toContain('(primeiros)')
  })

  // ---- Eixo "Registros" ----

  it('em repouso, o seletor de eixo aparece, com "Livros" ativo por padrão', async () => {
    await montar('/explorar')
    const abas = [...host.querySelectorAll('.eixo-tab')]
    expect(abas.map((a) => a.textContent)).toEqual(['Livros', 'Registros'])
    expect(host.querySelector('.eixo-tab.active')?.textContent).toBe('Livros')
  })

  it('?eixo=registros desenha o catálogo dos registros em vez dos 66 livros', async () => {
    await montar('/explorar?eixo=registros')
    expect(host.querySelector('.eixo-tab.active')?.textContent).toBe('Registros')
    const linhas = [...host.querySelectorAll('.livro-row .livro-nome')].map((n) => n.textContent)
    expect(linhas).toEqual(['Lamento', 'Louvor'])
  })

  it('o seletor de eixo NÃO aparece com busca ativa', async () => {
    await montar('/explorar?q=amor%20de%20Deus')
    expect(host.querySelector('.eixo-tabs')).toBeNull()
  })

  it('o seletor de eixo NÃO aparece com livro aberto', async () => {
    await montar('/explorar?livro=Jo%C3%A3o')
    expect(host.querySelector('.eixo-tabs')).toBeNull()
  })

  it('o seletor de eixo NÃO aparece com registro aberto', async () => {
    await montar('/explorar?registro=lamento')
    expect(host.querySelector('.eixo-tabs')).toBeNull()
  })

  it('?registro=<slug> abre o registro e a caixa de busca fica vazia', async () => {
    await montar('/explorar?registro=lamento')
    expect(host.querySelector('.selected-book-name')?.textContent).toBe('Lamento')
    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('')
  })

  it('precedência: ?q=amor&registro=lamento — a busca vence, o registro é ignorado', async () => {
    await montar('/explorar?q=amor&registro=lamento')
    expect(host.querySelector('.selected-book-name')).toBeNull()
    expect(host.querySelectorAll('.secao-resultado').length).toBeGreaterThan(0)
  })

  it('precedência: ?livro=João&registro=lamento — o livro vence', async () => {
    await montar('/explorar?livro=Jo%C3%A3o&registro=lamento')
    expect(host.querySelector('.selected-book-name')?.textContent).toBe('João')
    expect(host.querySelector('.ref-form')).not.toBeNull()
  })

  it('precedência de três: ?livro=João&q=amor&registro=lamento — a busca vence', async () => {
    // Mesmo caso do teste "livro aberto e busca são estados exclusivos"
    // acima, estendido com `registro` na URL: a hierarquia inteira
    // (`consulta.termo > livro > registro`) precisa valer de uma vez, não
    // só par a par.
    await montar('/explorar?livro=Jo%C3%A3o&q=amor&registro=lamento')
    expect(host.querySelector('.ref-sticky')).toBeNull()
    expect(host.querySelectorAll('.secao-resultado').length).toBeGreaterThan(0)
  })

  it('?registro=slug-que-nao-existe não quebra a tela: cai no repouso', async () => {
    await montar('/explorar?registro=slug-que-nao-existe')
    expect(host.querySelectorAll('.livro-row')).toHaveLength(66)
    expect(host.querySelector('.eixo-tabs')).not.toBeNull()
  })

  it('o recorte de leitura estreita a lista dentro do registro aberto', async () => {
    // `ordem: 1` já está "concluído" no mock de `listAllProgresso` — com
    // "não lidos" ativo, nada do registro sobrevive ao recorte.
    await montar('/explorar?registro=lamento&f=nao-lidos')
    expect(host.querySelector('.selected-book-name')?.textContent).toBe('Lamento')
    expect(host.querySelector('.muted')?.textContent).toBe(
      'Nenhuma perícope deste registro sobrevive ao recorte.',
    )
  })

  it('voltar do registro devolve o catálogo de registros, não o de livros', async () => {
    await montar('/explorar?eixo=registros&registro=lamento')
    const botao = host.querySelector('.trocar-livro') as HTMLButtonElement
    await act(async () => {
      botao.click()
    })
    expect(host.querySelector('.selected-book-name')).toBeNull()
    const linhas = [...host.querySelectorAll('.livro-row .livro-nome')].map((n) => n.textContent)
    expect(linhas).toEqual(['Lamento', 'Louvor'])
  })
})
