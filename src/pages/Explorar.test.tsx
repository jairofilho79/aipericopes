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
})
