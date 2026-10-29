import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetReferencias,
  carregarReferenciasDoLivro,
  contarReferencias,
  encontrarPericopeDaReferencia,
  letraDaNota,
  obterNotasDoVersiculo,
  obterReferenciasDaPericope,
  obterReferenciasDosVersiculos,
  extrairVersiculos,
  formatarReferenciasParaIa,
  resolverAlvo,
  urlDaReferencia,
  versiculosDoAlvo,
  type ShardReferencias,
} from './referencias'
import type { PericopeIndex } from './types'

const SHARD: ShardReferencias = {
  livro: 'Gênesis',
  versiculos: {
    '1:1': [
      { p: 1, a: [['Provérbios', 8, '23'], ['Hebreus', 11, '13']] },
      { p: 3, a: [['Salmos', 33, '6,9']] },
    ],
    '1:3': [{ p: null, a: [['Salmos', 33, '9']] }],
    '2:1': [{ p: 2, a: [['Êxodo', 20, '11']] }],
  },
}

function resposta(corpo: unknown, status = 200, tipo = 'application/json'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? tipo : null) },
    json: async () => corpo,
  } as unknown as Response
}

function pericope(ordem: number, livro: string, ci: number, vi: number, cf: number, vf: number): PericopeIndex {
  return {
    ordem,
    seq: ordem,
    livro,
    abbrev: '',
    capitulo_inicio: ci,
    versiculo_inicio: vi,
    capitulo_fim: cf,
    versiculo_fim: vf,
    titulo_pericope_pt: `P${ordem}`,
    minutos: 1,
    narrado: false,
  }
}

describe('letraDaNota', () => {
  it('a..z e depois aa, ab…', () => {
    expect(letraDaNota(0)).toBe('a')
    expect(letraDaNota(1)).toBe('b')
    expect(letraDaNota(25)).toBe('z')
    expect(letraDaNota(26)).toBe('aa')
    expect(letraDaNota(27)).toBe('ab')
  })
})

describe('versiculosDoAlvo', () => {
  it('expande lista e faixa', () => {
    expect(versiculosDoAlvo('23')).toEqual([23])
    expect(versiculosDoAlvo('4,9')).toEqual([4, 9])
    expect(versiculosDoAlvo('7-10')).toEqual([7, 8, 9, 10])
    expect(versiculosDoAlvo('3-4,9')).toEqual([3, 4, 9])
  })
  it('faixa invertida fica só no primeiro número', () => {
    expect(versiculosDoAlvo('10-3')).toEqual([10])
  })
})

describe('carregamento e consultas', () => {
  beforeEach(() => {
    _resetReferencias()
    vi.unstubAllGlobals()
  })

  it('busca o shard pelo slug do livro e guarda em cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(SHARD))
    vi.stubGlobal('fetch', fetchMock)
    await carregarReferenciasDoLivro('Gênesis')
    await carregarReferenciasDoLivro('Gênesis')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/data\/referencias\/genesis\.json$/)
  })

  it('chamadas simultâneas compartilham a mesma requisição', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(SHARD))
    vi.stubGlobal('fetch', fetchMock)
    await Promise.all([carregarReferenciasDoLivro('Gênesis'), carregarReferenciasDoLivro('Gênesis')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('devolve null (e tenta de novo depois) em 404, HTML de fallback SPA ou rede caída', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(null, 404)))
    expect(await carregarReferenciasDoLivro('Gênesis')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta('<html>', 200, 'text/html')))
    expect(await carregarReferenciasDoLivro('Gênesis')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await carregarReferenciasDoLivro('Gênesis')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(SHARD)))
    expect(await carregarReferenciasDoLivro('Gênesis')).toEqual(SHARD)
  })

  it('atribui letras por versículo e monta os alvos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(SHARD)))
    const notas = await obterNotasDoVersiculo('Gênesis', 1, 1)
    expect(notas.map((n) => n.letra)).toEqual(['a', 'b'])
    expect(notas[0].alvos[0]).toMatchObject({ rotulo: 'Provérbios 8:23', versiculos: [23] })
    expect(notas[1].alvos[0]).toMatchObject({ rotulo: 'Salmos 33:6,9', versiculos: [6, 9] })
    expect(await obterNotasDoVersiculo('Gênesis', 1, 2)).toEqual([])
  })

  it('referências dos versículos escolhidos, sem os vazios', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(SHARD)))
    const refs = await obterReferenciasDosVersiculos('Gênesis', [
      { chapter: 1, verse: 1 },
      { chapter: 1, verse: 2 },
      { chapter: 1, verse: 3 },
    ])
    expect(refs.map((r) => `${r.capitulo}:${r.versiculo}`)).toEqual(['1:1', '1:3'])
    expect(await contarReferencias('Gênesis', [{ chapter: 1, verse: 1 }, { chapter: 1, verse: 3 }])).toBe(3)
  })

  it('referências da perícope respeitam os limites e a ordem de leitura', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(SHARD)))
    const refs = await obterReferenciasDaPericope(pericope(1, 'Gênesis', 1, 1, 1, 2))
    expect(refs.map((r) => `${r.capitulo}:${r.versiculo}`)).toEqual(['1:1'])
    const cruzando = await obterReferenciasDaPericope(pericope(1, 'Gênesis', 1, 3, 2, 1))
    expect(cruzando.map((r) => `${r.capitulo}:${r.versiculo}`)).toEqual(['1:3', '2:1'])
  })

  it('sem shard, tudo vem vazio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(null, 404)))
    expect(await obterReferenciasDosVersiculos('Gênesis', [{ chapter: 1, verse: 1 }])).toEqual([])
    expect(await contarReferencias('Gênesis', [{ chapter: 1, verse: 1 }])).toBe(0)
  })
})

describe('encontrarPericopeDaReferencia', () => {
  const indice = [
    pericope(1, 'Gênesis', 1, 1, 2, 3),
    pericope(2, 'Gênesis', 2, 4, 2, 25),
    pericope(3, 'Êxodo', 1, 1, 1, 22),
    pericope(4, 'Êxodo', 3, 1, 3, 22),
  ]

  it('acha a perícope que contém o versículo, inclusive nos limites', () => {
    expect(encontrarPericopeDaReferencia(indice, 'Gênesis', 1, 1)?.ordem).toBe(1)
    expect(encontrarPericopeDaReferencia(indice, 'Gênesis', 2, 3)?.ordem).toBe(1)
    expect(encontrarPericopeDaReferencia(indice, 'Gênesis', 2, 4)?.ordem).toBe(2)
    expect(encontrarPericopeDaReferencia(indice, 'Êxodo', 3, 22)?.ordem).toBe(4)
  })

  it('vão entre perícopes cai na anterior mais próxima do mesmo livro', () => {
    expect(encontrarPericopeDaReferencia(indice, 'Êxodo', 2, 5)?.ordem).toBe(3)
  })

  it('antes da primeira usa a primeira; livro inexistente é null', () => {
    expect(encontrarPericopeDaReferencia(indice, 'Êxodo', 1, 0)?.ordem).toBe(3)
    expect(encontrarPericopeDaReferencia(indice, 'Judas', 1, 1)).toBeNull()
  })

  it('resolverAlvo usa o primeiro versículo da lista', () => {
    const r = resolverAlvo(indice, {
      livro: 'Gênesis',
      capitulo: 2,
      versiculo: '4,9',
      versiculos: [4, 9],
      rotulo: 'Gênesis 2:4,9',
    })
    expect(r?.pericope.ordem).toBe(2)
    expect(r?.versiculoId).toBe('2:4')
  })
})

describe('urlDaReferencia', () => {
  it('leva origem, versículo de origem e versículo de destino', () => {
    expect(urlDaReferencia({ ordem: 12, versiculoId: '11:13', origem: { ordem: 3, versiculoId: '1:1' } })).toBe(
      '/leitura/12?via=ref&origem=3&ov=1%3A1&v=11%3A13',
    )
  })

  it('leva a jornada da origem quando há', () => {
    const url = urlDaReferencia({
      ordem: 12,
      versiculoId: '11:13',
      origem: { ordem: 3, versiculoId: '1:1' },
      jornadaId: 'j1',
    })
    expect(new URL(url, 'http://x').searchParams.get('jid')).toBe('j1')
  })
})

describe('extrairVersiculos', () => {
  const texto = 'Capítulo 1\n1 No princípio\n2 E a terra\nCapítulo 2\n1 Assim foram\n2 E acabou Deus'
  it('pega só o capítulo certo e os versículos pedidos', () => {
    expect(extrairVersiculos(texto, 2, [1])).toEqual([{ verso: 1, texto: 'Assim foram' }])
    expect(extrairVersiculos(texto, 1, [1, 2]).map((v) => v.verso)).toEqual([1, 2])
    expect(extrairVersiculos(texto, 1, [9])).toEqual([])
  })
})

describe('formatarReferenciasParaIa', () => {
  it('resume notas de versículos em formato conciso para IA', () => {
    const refs = [
      {
        capitulo: 1,
        versiculo: 1,
        notas: [
          {
            letra: 'a',
            posicao: 1,
            alvos: [
              { livro: 'Provérbios', capitulo: 8, versiculo: '23', versiculos: [23], rotulo: 'Provérbios 8:23' },
              { livro: 'Hebreus', capitulo: 1, versiculo: '10', versiculos: [10], rotulo: 'Hebreus 1:10' },
            ],
          },
          {
            letra: 'b',
            posicao: 3,
            alvos: [{ livro: 'Salmos', capitulo: 33, versiculo: '6', versiculos: [6], rotulo: 'Salmos 33:6' }],
          },
        ],
      },
      {
        capitulo: 1,
        versiculo: 2,
        notas: [
          {
            letra: 'a',
            posicao: 3,
            alvos: [{ livro: 'Jeremias', capitulo: 4, versiculo: '23', versiculos: [23], rotulo: 'Jeremias 4:23' }],
          },
        ],
      },
    ]

    const resumo = formatarReferenciasParaIa(refs)
    expect(resumo).toBe(
      '1:1: Provérbios 8:23, Hebreus 1:10; Salmos 33:6\n1:2: Jeremias 4:23',
    )
  })

  it('retorna string vazia quando não há notas', () => {
    expect(formatarReferenciasParaIa([])).toBe('')
    expect(formatarReferenciasParaIa([{ capitulo: 1, versiculo: 1, notas: [] }])).toBe('')
  })
})

