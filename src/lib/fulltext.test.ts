import { describe, expect, it, vi } from 'vitest'
import { fatiarResultado, indexarLinhas, marcarTrecho, normalize, searchTexto, snippetAt, verseIdAtOffset } from './fulltext'
import { livroSlug } from './livro-slug'
import type { Pericope } from './types'

const TEXTO =
  'Capítulo 1\n1 No princípio, Deus criou o coração.\n2 A terra era sem forma.\nCapítulo 2\n1 Assim foram concluídos os céus.'

function peri(ordem: number, livro: string, abbrev: string, texto: string): Pericope {
  return {
    ordem,
    livro,
    abbrev,
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 2,
    versiculo_fim: 1,
    titulo_pericope_pt: `Título ${ordem}`,
    minutos: 1,
    seq: ordem,
    texto: texto,
    contexto_historico_literario: '',
    resenha: '',
    perguntas_reflexao: [],
  }
}

const FIXTURES: Pericope[] = [
  peri(0, 'Gênesis', 'Gn', TEXTO),
  peri(1, 'Salmos', 'Sl', 'Capítulo 23\n1 O Senhor é o meu pastor; nada me faltará.'),
  peri(2, 'João', 'Jo', 'Capítulo 3\n16 Porque Deus amou o mundo de tal maneira.'),
  ...Array.from({ length: 60 }, (_, i) =>
    peri(i + 3, 'Mateus', 'Mt', `Capítulo ${i + 1}\n1 A palavra abunda e alcança à alma. A ação faz a arte andar.`),
  ),
]

vi.mock('./content', async (importOriginal) => {
  const real = await importOriginal<typeof import('./content')>()
  return {
    ...real,
    loadIndex: async () => FIXTURES.map(({ texto: _t, ...meta }) => meta),
  }
})

vi.mock('./shards', () => ({
  carregarTexto: async (slug: string) =>
    new Map(
      FIXTURES.filter((p) => livroSlug(p.livro) === slug).map((p) => [p.ordem, { texto: p.texto }]),
    ),
  carregarEstudo: async () => new Map(),
  shardCarregado: () => true,
}))

const LONGO = `${'a'.repeat(60)} meio ${'b'.repeat(60)}`

describe('normalize', () => {
  it('tira acentos e caixa preservando o comprimento', () => {
    expect(normalize('Coração ÁGUIA çedilha')).toBe('coracao aguia cedilha')
    expect(normalize('Coração')).toHaveLength('Coração'.length)
  })

  it('string vazia continua vazia', () => {
    expect(normalize('')).toBe('')
  })
})

describe('indexarLinhas', () => {
  it('marca o versículo de cada linha atravessando capítulos', () => {
    expect(indexarLinhas(TEXTO).map((l) => l.verseId)).toEqual([
      null,
      '1:1',
      '1:2',
      null,
      '2:1',
    ])
  })

  it('os offsets acompanham o texto normalizado, linha a linha', () => {
    const linhas = indexarLinhas(TEXTO)
    const norm = linhas.map((l) => normalize(l.texto)).join('\n')
    expect(linhas.map((l) => l.inicio)).toEqual([0, 11, 49, 74, 85])
    expect(norm.slice(linhas[1].inicio, linhas[1].inicio + 4)).toBe('1 no')
    expect(norm.slice(linhas[4].inicio, linhas[4].inicio + 7)).toBe('1 assim')
  })

  it('linha sem número herda o versículo anterior', () => {
    const linhas = indexarLinhas('Capítulo 1\n1 Primeira.\ncontinuação solta\n2 Segunda.')
    expect(linhas.map((l) => l.verseId)).toEqual([null, '1:1', '1:1', '1:2'])
  })
})

describe('verseIdAtOffset', () => {
  const linhas = indexarLinhas(TEXTO)

  it('resolve o versículo de um offset no meio do texto', () => {
    expect(verseIdAtOffset(linhas, 20)).toBe('1:1')
    expect(verseIdAtOffset(linhas, 55)).toBe('1:2')
    expect(verseIdAtOffset(linhas, 90)).toBe('2:1')
  })

  it('offset num cabeçalho de capítulo cai no primeiro versículo seguinte', () => {
    expect(verseIdAtOffset(linhas, 0)).toBe('1:1')
    expect(verseIdAtOffset(linhas, 76)).toBe('2:1')
  })

  it('lista vazia ou offset negativo devolve null', () => {
    expect(verseIdAtOffset([], 0)).toBeNull()
    expect(verseIdAtOffset(linhas, -1)).toBeNull()
  })
})

describe('snippetAt', () => {
  it('ocorrência no começo de um texto curto não ganha reticências', () => {
    expect(snippetAt('No princípio Deus criou', 0, 2)).toBe('No princípio Deus criou')
  })

  it('ocorrência no fim não ganha reticência à direita', () => {
    const s = snippetAt(LONGO, LONGO.length - 3, 3)
    expect(s.startsWith('…')).toBe(true)
    expect(s.endsWith('…')).toBe(false)
  })

  it('ocorrência no meio ganha reticências dos dois lados', () => {
    const s = snippetAt(LONGO, LONGO.indexOf('meio'), 4)
    expect(s.startsWith('…')).toBe(true)
    expect(s.endsWith('…')).toBe(true)
    expect(s).toContain('meio')
  })
})

describe('marcarTrecho', () => {
  it('acha o trecho com e sem acento', () => {
    const esperado = { antes: 'Deus criou o ', marcado: 'coração', depois: '.' }
    expect(marcarTrecho('Deus criou o coração.', 'coracao')).toEqual(esperado)
    expect(marcarTrecho('Deus criou o coração.', 'CORAÇÃO')).toEqual(esperado)
  })

  it('termo ausente devolve o snippet inteiro sem marcação', () => {
    expect(marcarTrecho('Deus criou.', 'peixe')).toEqual({
      antes: 'Deus criou.',
      marcado: '',
      depois: '',
    })
  })
})

describe('searchTexto', () => {
  it('acha com e sem acento e resolve o versículo da ocorrência', async () => {
    const semAcento = await searchTexto('coracao')
    expect(semAcento).toHaveLength(1)
    expect(semAcento[0].ordem).toBe(0)
    expect(semAcento[0].verseId).toBe('1:1')
    expect(semAcento[0].titulo).toBe('Título 0')
    expect(semAcento[0].refLabel).toBe('Gênesis 1:1–2:1')
    expect(semAcento[0].snippet).toContain('coração')

    const comAcento = await searchTexto('coração')
    expect(comAcento.map((h) => h.verseId)).toEqual(['1:1'])

    const segundoCapitulo = await searchTexto('concluidos')
    expect(segundoCapitulo.map((h) => h.verseId)).toEqual(['2:1'])
  })

  it('respeita o mínimo de caracteres e o limite de resultados', async () => {
    expect(await searchTexto('de')).toEqual([])
    expect(await searchTexto('   ')).toEqual([])
    expect(await searchTexto('deus')).toHaveLength(2)
    expect(await searchTexto('deus', 1)).toHaveLength(1)
  })
})

describe('buildIndex — recuperação de falha', () => {
  it('uma falha transitória no carregamento não trava a busca pela sessão inteira', async () => {
    vi.resetModules()
    let chamadas = 0
    vi.doMock('./content', async (importOriginal) => {
      const real = await importOriginal<typeof import('./content')>()
      return {
        ...real,
        loadIndex: async () => {
          chamadas += 1
          if (chamadas === 1) throw new Error('offline')
          return FIXTURES.map(({ texto: _t, ...meta }) => meta)
        },
      }
    })

    const { searchTexto: searchTextoFresco } = await import('./fulltext')

    await expect(searchTextoFresco('coracao')).rejects.toThrow('offline')
    const hits = await searchTextoFresco('coracao')
    expect(hits).toHaveLength(1)
    expect(hits[0].verseId).toBe('1:1')

    vi.doUnmock('./content')
    vi.resetModules()
  })
})

// "(primeiros)" só faz sentido quando existe um segundo lote. Buscando
// exatamente o limite não dá para saber — daí a busca pedir `limite + 1`.
describe('fatiarResultado', () => {
  const lista = (n: number) => Array.from({ length: n }, (_, i) => i)

  it('menos que o limite: entrega tudo e não anuncia corte', () => {
    expect(fatiarResultado(lista(3), 50)).toEqual({ hits: [0, 1, 2], truncado: false })
  })

  it('exatamente o limite não é corte', () => {
    const r = fatiarResultado(lista(50), 50)
    expect(r.hits).toHaveLength(50)
    expect(r.truncado).toBe(false)
  })

  it('limite + 1 é corte, e o extra não vaza para a lista', () => {
    const r = fatiarResultado(lista(51), 50)
    expect(r.hits).toHaveLength(50)
    expect(r.truncado).toBe(true)
  })
})

describe('searchTexto com filtro', () => {
  it('o teto conta os aceitos, não os varridos', async () => {
    // As 60 fixtures de Mateus (ordens 3–62) casam "palavra"; as outras não.
    const semFiltro = await searchTexto('palavra', 20)
    expect(semFiltro).toHaveLength(20)
    expect(Math.max(...semFiltro.map((h) => h.ordem))).toBe(22)

    const pares = await searchTexto('palavra', 20, (ordem) => ordem % 2 === 0)
    expect(pares).toHaveLength(20)
    expect(pares.every((h) => h.ordem % 2 === 0)).toBe(true)
    // O decisivo: a varredura passou do 20º ACHADO para juntar 20 ACEITOS.
    // Se o filtro fosse aplicado depois do teto, sobrariam só os 10 pares
    // entre as ordens 3 e 22.
    expect(Math.max(...pares.map((h) => h.ordem))).toBe(42)
  })

  it('sem o parâmetro, o comportamento não muda', async () => {
    expect(await searchTexto('palavra', 3)).toEqual(
      await searchTexto('palavra', 3, undefined),
    )
  })
})
