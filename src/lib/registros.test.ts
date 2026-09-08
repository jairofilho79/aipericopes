import { describe, expect, it, vi } from 'vitest'
import {
  agruparPorLivro,
  contagemPorRegistro,
  progressoPorRegistro,
  registroPorSlug,
  type Registro,
} from './registros'
import type { PericopeIndex } from './types'

function respostaJson(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

/**
 * 17 tamanhos distintos, de propósito: a asserção de ordenação decrescente
 * fica inequívoca (nenhum empate escondendo uma ordenação por chance).
 */
const TAMANHOS = [5, 12, 3, 8, 20, 1, 15, 7, 9, 2, 18, 4, 6, 10, 13, 11, 14]

function fixtureRegistrosJson(): { nomes: Record<string, string>; registros: Record<string, number[]> } {
  const nomes: Record<string, string> = {}
  const registros: Record<string, number[]> = {}
  let cursor = 1
  TAMANHOS.forEach((n, i) => {
    const slug = `r${i + 1}`
    nomes[slug] = `Registro ${i + 1}`
    registros[slug] = Array.from({ length: n }, () => cursor++)
  })
  return { nomes, registros }
}

describe('loadRegistros', () => {
  it('devolve os 17 ordenados por ordens.length decrescente', async () => {
    vi.resetModules()
    const fixture = fixtureRegistrosJson()
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(fixture)))
    const { loadRegistros } = await import('./registros')

    const regs = await loadRegistros()

    expect(regs).toHaveLength(17)
    const tamanhos = regs.map((r) => r.ordens.length)
    expect(tamanhos).toEqual([...tamanhos].sort((a, b) => b - a))
    // O maior tamanho (20) é o de 'r5' — checa que slug/nome/ordens vieram
    // mapeados corretamente, não só o tamanho.
    expect(regs[0]).toEqual({ slug: 'r5', nome: 'Registro 5', ordens: fixture.registros.r5 })
  })

  it('chamadas concorrentes compartilham uma única promessa (um só fetch)', async () => {
    vi.resetModules()
    const fixture = fixtureRegistrosJson()
    const fetchMock = vi.fn(async (_url: string) => respostaJson(fixture))
    vi.stubGlobal('fetch', fetchMock)
    const { loadRegistros } = await import('./registros')

    const [a, b] = await Promise.all([loadRegistros(), loadRegistros()])

    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('data/registros.json')
  })

  it('fetch com ok:false rejeita e não envenena o cache — a próxima chamada tenta de novo', async () => {
    vi.resetModules()
    const fixture = fixtureRegistrosJson()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce(respostaJson(fixture))
    vi.stubGlobal('fetch', fetchMock)
    const { loadRegistros } = await import('./registros')

    await expect(loadRegistros()).rejects.toThrow()

    const regs = await loadRegistros()
    expect(regs).toHaveLength(17)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

function reg(slug: string, ordens: number[]): Registro {
  return { slug, nome: `Nome de ${slug}`, ordens }
}

describe('registroPorSlug', () => {
  const REGS = [reg('a', [1]), reg('b', [2])]

  it('acha pelo slug', () => {
    expect(registroPorSlug(REGS, 'b')).toEqual(REGS[1])
  })

  it('slug inexistente devolve undefined', () => {
    expect(registroPorSlug(REGS, 'zzz')).toBeUndefined()
  })
})

describe('progressoPorRegistro', () => {
  const REGS = [reg('a', [1, 2, 3]), reg('b', [4, 5])]

  it('pct arredondado', () => {
    const m = progressoPorRegistro(REGS, new Set([1]))
    expect(m.get('a')).toEqual({ slug: 'a', total: 3, concluidas: 1, pct: 33 })
  })

  it('registro sem nenhuma concluída dá 0', () => {
    const m = progressoPorRegistro(REGS, new Set())
    expect(m.get('b')).toEqual({ slug: 'b', total: 2, concluidas: 0, pct: 0 })
  })

  it('nunca obedece a recorte: só olha se a ordem está concluída, ordens fora do registro não pesam', () => {
    const m = progressoPorRegistro(REGS, new Set([1, 2, 3, 4, 5, 999]))
    expect(m.get('a')).toEqual({ slug: 'a', total: 3, concluidas: 3, pct: 100 })
    expect(m.get('b')).toEqual({ slug: 'b', total: 2, concluidas: 2, pct: 100 })
  })
})

describe('contagemPorRegistro', () => {
  const REGS = [reg('a', [1, 2, 3]), reg('b', [4, 5])]

  it('conta só o que o predicado aceita', () => {
    const c = contagemPorRegistro(REGS, (o) => o <= 2)
    expect(c.get('a')).toBe(2)
    expect(c.get('b')).toBe(0)
  })

  it('registro que perde tudo para o recorte continua no mapa, com 0', () => {
    const c = contagemPorRegistro(REGS, () => false)
    expect(c.size).toBe(2)
    expect(c.get('a')).toBe(0)
    expect(c.get('b')).toBe(0)
  })
})

function pi(ordem: number, seq: number, livro: string): PericopeIndex {
  return {
    ordem,
    seq,
    livro,
    abbrev: livro.slice(0, 2),
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 1,
    versiculo_fim: 1,
    titulo_pericope_pt: `P${ordem}`,
    minutos: 1,
  }
}

describe('agruparPorLivro', () => {
  it('preserva a ordem de leitura', () => {
    const itens = [pi(1, 0, 'Gênesis'), pi(2, 1, 'Gênesis'), pi(3, 2, 'Êxodo')]
    const g = agruparPorLivro(itens)
    expect(g.map((x) => x.livro)).toEqual(['Gênesis', 'Êxodo'])
    expect(g[0].itens.map((p) => p.ordem)).toEqual([1, 2])
    expect(g[1].itens.map((p) => p.ordem)).toEqual([3])
  })

  it('o mesmo livro em dois trechos separados da lista vira DOIS grupos (agrupa por transição, não por Map)', () => {
    const itens = [pi(1, 0, 'Gênesis'), pi(2, 1, 'Êxodo'), pi(3, 2, 'Gênesis')]
    const g = agruparPorLivro(itens)
    expect(g.map((x) => x.livro)).toEqual(['Gênesis', 'Êxodo', 'Gênesis'])
    expect(g).toHaveLength(3)
    expect(g[0].itens.map((p) => p.ordem)).toEqual([1])
    expect(g[2].itens.map((p) => p.ordem)).toEqual([3])
  })

  it('lista vazia devolve vazio', () => {
    expect(agruparPorLivro([])).toEqual([])
  })
})
