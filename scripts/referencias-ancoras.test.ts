import { describe, expect, it } from 'vitest'
import {
  alinharAncora,
  chaveLivro,
  montarShardLivro,
  normalizar,
  normalizarVersiculo,
  type AncoraArc,
  type NotaArc,
} from './referencias-ancoras'

const anc = (p: Partial<AncoraArc>): AncoraArc => ({
  id: 'x',
  ordem: 0,
  palavra_idx: 0,
  antes: '',
  depois: '',
  total_palavras: 10,
  ...p,
})

describe('normalizar', () => {
  it('ignora caixa, acento e pontuação', () => {
    expect(normalizar('Princípio,')).toBe('principio')
    expect(normalizar('"Criou"')).toBe('criou')
  })
})

describe('alinharAncora', () => {
  const v = 'No princípio criou Deus os céus e a terra.'.split(' ')

  it('acha o ponto exato quando a palavra anterior e a posterior batem', () => {
    const r = alinharAncora(v, anc({ palavra_idx: 3, antes: 'criou', depois: 'Deus', total_palavras: 9 }))
    expect(r).toEqual({ pos: 3, qualidade: 'exata' })
  })

  it('aceita casamento parcial quando a redação mudou depois da palavra', () => {
    const r = alinharAncora(v, anc({ palavra_idx: 3, antes: 'criou', depois: 'o Senhor', total_palavras: 9 }))
    expect(r).toEqual({ pos: 3, qualidade: 'parcial' })
  })

  it('estima pela posição proporcional quando nada casa, sem ir para o fim', () => {
    const r = alinharAncora(v, anc({ palavra_idx: 1, antes: 'xyz', depois: 'abc', total_palavras: 9 }))
    expect(r.qualidade).toBe('estimada')
    expect(r.pos).toBeLessThan(3)
  })

  it('a estimativa se encaixa na pontuação mais próxima', () => {
    const t = 'disse ele: faze isto, e farás aquilo'.split(' ')
    const r = alinharAncora(t, anc({ palavra_idx: 5, antes: 'xyz', depois: 'abc', total_palavras: 7 }))
    expect(r).toEqual({ pos: 4, qualidade: 'estimada' })
  })

  it('palavra_idx 0 ancora no início do versículo', () => {
    const r = alinharAncora(v, anc({ palavra_idx: 0, antes: '', depois: 'No', total_palavras: 9 }))
    expect(r).toEqual({ pos: 0, qualidade: 'exata' })
  })

  it('entre ocorrências repetidas escolhe a mais próxima da posição esperada', () => {
    const t = 'e disse e fez e viu'.split(' ')
    const r = alinharAncora(t, anc({ palavra_idx: 4, antes: 'e', depois: 'viu', total_palavras: 6 }))
    expect(r.pos).toBe(5)
  })

  it('respeita a ordem: não volta antes da nota anterior', () => {
    const t = 'e disse e fez'.split(' ')
    const r = alinharAncora(t, anc({ palavra_idx: 1, antes: 'e', depois: 'disse', total_palavras: 4 }), 2)
    expect(r.pos).toBeGreaterThanOrEqual(2)
  })
})

describe('normalizarVersiculo', () => {
  it('limpa pontuação sobrando e preserva listas e faixas', () => {
    expect(normalizarVersiculo('15;')).toBe('15')
    expect(normalizarVersiculo('7-11')).toBe('7-11')
    expect(normalizarVersiculo('4,9')).toBe('4,9')
    expect(normalizarVersiculo(null)).toBeNull()
    expect(normalizarVersiculo('abc')).toBeNull()
  })
})

describe('chaveLivro', () => {
  it('une "1Crônicas" e "1 Crônicas"', () => {
    expect(chaveLivro('1 Crônicas')).toBe(chaveLivro('1Crônicas'))
  })
})

describe('montarShardLivro', () => {
  const catalogo = new Map([
    ['Provérbios', 'Provérbios'],
    ['1Crônicas', '1 Crônicas'],
  ])
  const notas = new Map<string, NotaArc>([
    ['n1', { id: 'n1', alvos: [{ livro: 'Provérbios', capitulo: 8, versiculo: '23' }] }],
    ['n2', { id: 'n2', alvos: [{ livro: '1Crônicas', capitulo: 1, versiculo: '15;' }, { livro: '?', capitulo: 0, versiculo: '1' }] }],
  ])
  const ancoras = {
    '1:1': [
      anc({ id: 'n1', ordem: 0, palavra_idx: 1, antes: 'No', depois: 'princípio', total_palavras: 9 }),
      anc({ id: 'explicativa', ordem: 1, palavra_idx: 2, antes: 'princípio', depois: 'criou', total_palavras: 9 }),
      anc({ id: 'n2', ordem: 2, palavra_idx: 3, antes: 'criou', depois: 'Deus', total_palavras: 9 }),
    ],
    '9:9': [anc({ id: 'n1', ordem: 0, palavra_idx: 1, antes: 'a', depois: 'b', total_palavras: 3 })],
  }
  const texto = new Map([['1:1', 'No princípio criou Deus os céus e a terra.']])

  it('descarta notas explicativas e alvos inválidos, e normaliza nomes', () => {
    const { shard, stats } = montarShardLivro('Gênesis', ancoras, notas, texto, catalogo)
    expect(shard.versiculos['1:1']).toEqual([
      { p: 1, a: [['Provérbios', 8, '23']] },
      { p: 3, a: [['1 Crônicas', 1, '15']] },
    ])
    expect(stats.alvosDescartados).toBe(1)
  })

  it('mantém a nota de um versículo ausente no catálogo, sem posição', () => {
    const { shard, stats } = montarShardLivro('Gênesis', ancoras, notas, texto, catalogo)
    expect(shard.versiculos['9:9']).toEqual([{ p: null, a: [['Provérbios', 8, '23']] }])
    expect(stats.semVersiculo).toBe(1)
  })
})
