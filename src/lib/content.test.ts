import { describe, expect, it, vi } from 'vitest'
import { anteriorNoTestamento, loadIndex, progressoPorLivro, proximaNoTestamento, aceitaFiltro, contagemPorLivro, filtroDeOrdens, statusPorOrdem, mesmosStatus } from './content'
import type { Pericope, PericopeIndex, Progresso } from './types'

function respostaJson(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

function peri(ordem: number, abbrev: string): Pericope {
  return { ordem, abbrev, livro: abbrev, titulo_pericope_pt: `P${ordem}` } as Pericope
}

// Gn (VT) ordens 1-2; Mt (NT) ordens 3-4
const ALL = [peri(1, 'Gn'), peri(2, 'Gn'), peri(3, 'Mt'), peri(4, 'Mt')]

describe('anteriorNoTestamento', () => {
  it('volta uma perícope dentro do testamento', () => {
    expect(anteriorNoTestamento(ALL, 2)).toBe(1)
    expect(anteriorNoTestamento(ALL, 4)).toBe(3)
  })

  it('primeira do testamento não tem anterior (não cruza a fronteira)', () => {
    expect(anteriorNoTestamento(ALL, 1)).toBeNull()
    expect(anteriorNoTestamento(ALL, 3)).toBeNull()
  })

  it('ordem inexistente retorna null', () => {
    expect(anteriorNoTestamento(ALL, 99)).toBeNull()
  })

  it('espelha proximaNoTestamento na outra ponta', () => {
    expect(proximaNoTestamento(ALL, 2)).toBeNull()
    expect(proximaNoTestamento(ALL, 1)).toBe(2)
  })
})

function pl(ordem: number, livro: string): Pericope {
  return { ordem, livro, abbrev: livro.slice(0, 2), titulo_pericope_pt: `P${ordem}` } as Pericope
}

describe('progressoPorLivro', () => {
  const LISTA = [pl(1, 'Gênesis'), pl(2, 'Gênesis'), pl(3, 'Gênesis'), pl(4, 'Êxodo')]

  it('conta total e concluídas por livro, na ordem de aparição', () => {
    const m = progressoPorLivro(LISTA, new Set([1, 3, 4]))
    expect([...m.keys()]).toEqual(['Gênesis', 'Êxodo'])
    expect(m.get('Gênesis')).toEqual({ livro: 'Gênesis', total: 3, concluidas: 2, pct: 67 })
    expect(m.get('Êxodo')).toEqual({ livro: 'Êxodo', total: 1, concluidas: 1, pct: 100 })
  })

  it('livro sem nenhuma concluída fica em 0%', () => {
    const m = progressoPorLivro(LISTA, new Set())
    expect(m.get('Gênesis')?.pct).toBe(0)
    expect(m.get('Êxodo')?.concluidas).toBe(0)
  })

  it('lista vazia devolve mapa vazio', () => {
    expect(progressoPorLivro([], new Set([1]))).toEqual(new Map())
  })
})

describe('loadIndex', () => {
  it('busca o índice uma vez só e reaproveita', async () => {
    const idx: PericopeIndex[] = [
      {
        ordem: 0, livro: 'Gênesis', abbrev: 'Gn',
        capitulo_inicio: 1, versiculo_inicio: 1, capitulo_fim: 2, versiculo_fim: 3,
        titulo_pericope_pt: 'A criação', minutos: 5,
        seq: 0,
      },
    ]
    const fetchMock = vi.fn(async (_url: string) => respostaJson(idx))
    vi.stubGlobal('fetch', fetchMock)

    expect(await loadIndex()).toEqual(idx)
    expect(await loadIndex()).toEqual(idx)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('data/index.json')
  })
})

function prog(ordem: number, status: Progresso['status']): Progresso {
  return {
    pericopeOrdem: ordem,
    status,
    // Campos novos que a main trouxe. Este teste exercita só o predicado de
    // status, então os dois ficam no valor neutro.
    historico: [],
    paraReler: false,
    atualizadoEm: '2026-09-03T00:00:00.000Z',
  }
}

describe('aceitaFiltro', () => {
  it('"todos" aceita tudo, inclusive sem registro', () => {
    expect(aceitaFiltro(undefined, 'todos')).toBe(true)
    expect(aceitaFiltro('concluido', 'todos')).toBe(true)
  })

  it('"lidos" é só concluído', () => {
    expect(aceitaFiltro('concluido', 'lidos')).toBe(true)
    expect(aceitaFiltro('em_andamento', 'lidos')).toBe(false)
    expect(aceitaFiltro(undefined, 'lidos')).toBe(false)
  })

  it('"comecei" é só em_andamento', () => {
    expect(aceitaFiltro('em_andamento', 'comecei')).toBe(true)
    expect(aceitaFiltro('concluido', 'comecei')).toBe(false)
    expect(aceitaFiltro(undefined, 'comecei')).toBe(false)
  })

  it('"nao-lidos" é tudo que não concluiu — sem registro conta como não lido', () => {
    expect(aceitaFiltro(undefined, 'nao-lidos')).toBe(true)
    expect(aceitaFiltro('nao_iniciado', 'nao-lidos')).toBe(true)
    expect(aceitaFiltro('em_andamento', 'nao-lidos')).toBe(true)
    expect(aceitaFiltro('concluido', 'nao-lidos')).toBe(false)
  })

  it('"comecei" é subconjunto de "nao-lidos", de propósito', () => {
    expect(aceitaFiltro('em_andamento', 'comecei')).toBe(true)
    expect(aceitaFiltro('em_andamento', 'nao-lidos')).toBe(true)
  })
})

describe('filtroDeOrdens e contagemPorLivro', () => {
  const mapa = statusPorOrdem([prog(1, 'concluido'), prog(3, 'em_andamento')])

  it('o predicado lê o mapa e trata ausência como não iniciado', () => {
    const aceita = filtroDeOrdens(mapa, 'nao-lidos')
    expect(aceita(1)).toBe(false)
    expect(aceita(2)).toBe(true)
    expect(aceita(3)).toBe(true)
  })

  it('conta por livro só o que o predicado aceita', () => {
    const c = contagemPorLivro(ALL, filtroDeOrdens(mapa, 'nao-lidos'))
    expect(c.get('Gn')).toBe(1)
    expect(c.get('Mt')).toBe(2)
  })

  it('livro sem nada no recorte aparece com zero, não some do mapa', () => {
    const c = contagemPorLivro(ALL, filtroDeOrdens(mapa, 'comecei'))
    expect(c.get('Gn')).toBe(0)
    expect(c.get('Mt')).toBe(1)
  })
})

describe('mesmosStatus', () => {
  it('mapas com as mesmas ordens nos mesmos estados são iguais', () => {
    const a = statusPorOrdem([prog(1, 'concluido'), prog(3, 'em_andamento')])
    const b = statusPorOrdem([prog(1, 'concluido'), prog(3, 'em_andamento')])
    expect(mesmosStatus(a, b)).toBe(true)
  })

  it('tamanhos diferentes nunca são iguais', () => {
    const a = statusPorOrdem([prog(1, 'concluido')])
    const b = statusPorOrdem([prog(1, 'concluido'), prog(3, 'em_andamento')])
    expect(mesmosStatus(a, b)).toBe(false)
  })

  it('mesma ordem com status diferente não é igual', () => {
    const a = statusPorOrdem([prog(1, 'concluido')])
    const b = statusPorOrdem([prog(1, 'em_andamento')])
    expect(mesmosStatus(a, b)).toBe(false)
  })

  it('mesmo tamanho com ordens diferentes não é igual (size sozinho não pega)', () => {
    const a = statusPorOrdem([prog(1, 'concluido')])
    const b = statusPorOrdem([prog(2, 'concluido')])
    expect(mesmosStatus(a, b)).toBe(false)
  })
})

describe('listPericopes com q', () => {
  it('casa só o título: nome de livro e referência não entram mais pela busca', async () => {
    // `loadIndex` guarda o índice num módulo singleton; o teste de 'loadIndex'
    // acima já populou esse cache com outro fixture. resetModules() força uma
    // instância nova de content.ts, isolada do resto do arquivo.
    vi.resetModules()
    // capitulo/versiculo populados de propósito: com a fixture de `peri()`
    // (livro/ordem só) a asserção de "3:16" passaria de graça mesmo com a
    // implementação antiga, porque capitulo_inicio ficaria `undefined`. Aqui
    // "13:16" é o caso citado no comentário do código-fonte: a implementação
    // antiga casava "3:16" contra o INÍCIO de 13:16 por ser substring.
    const idx: PericopeIndex[] = [
      {
        ordem: 1,
        livro: 'Gn',
        abbrev: 'Gn',
        capitulo_inicio: 13,
        versiculo_inicio: 16,
        capitulo_fim: 13,
        versiculo_fim: 16,
        titulo_pericope_pt: 'P1',
        minutos: 1,
        seq: 0,
      },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(idx)))
    const { listPericopes } = await import('./content')

    // Estas duas são o ponto do estreitamento. Antes dele, `q` casava também
    // `p.livro` e o `${cap}:${ver}` do INÍCIO da perícope — "3:16" chegava a
    // casar 13:16 e 23:16.
    expect(await listPericopes({ q: 'Gn' })).toEqual([])
    expect(await listPericopes({ q: '3:16' })).toEqual([])
    // E o título continua casando, que é o que sobrou.
    expect((await listPericopes({ q: 'P1' })).map((p) => p.ordem)).toEqual([1])
  })
})

// Depois do recorte do catálogo existe ordem 3000 entre ordens 1000: as 195
// perícopes novas entram na posição canônica sem renumerar as existentes, porque
// `ordem` é chave de progresso, anotação, destaque, jornada e do áudio no R2.
// A navegação já era imune a isso — `ordensDoTestamento` faz filter+map e
// `proximaNoTestamento` pega seq[i±1], ou seja, POSIÇÃO. Este teste trava o
// contrato: quem quebrar isso ordenando por `ordem` erra os três caminhos de
// navegação de uma vez (pager do rodapé, swipe e atalhos ←/→ passam todos por
// irAnterior/irProxima em Leitura.tsx).
describe('navegação com ordem não crescente (pós-recorte)', () => {
  const naVT = (ordem: number): Pericope =>
    ({ ordem, livro: 'Gênesis', abbrev: 'Gn', titulo_pericope_pt: `P${ordem}` }) as Pericope
  // Ordem de LEITURA correta, com ordem numérica fora de ordem de propósito.
  const lista = [naVT(1000), naVT(3000), naVT(1001), naVT(3001), naVT(1002)]

  it('próxima segue a posição no array, não o valor de ordem', () => {
    expect(proximaNoTestamento(lista, 1000)).toBe(3000)
    expect(proximaNoTestamento(lista, 3000)).toBe(1001)
    expect(proximaNoTestamento(lista, 3001)).toBe(1002)
  })

  it('anterior segue a posição no array', () => {
    expect(anteriorNoTestamento(lista, 1001)).toBe(3000)
    expect(anteriorNoTestamento(lista, 3000)).toBe(1000)
  })

  it('as pontas continuam sendo pontas', () => {
    expect(anteriorNoTestamento(lista, 1000)).toBeNull()
    expect(proximaNoTestamento(lista, 1002)).toBeNull()
  })
})
