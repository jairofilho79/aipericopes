import { describe, it, expect } from 'vitest'
import { paragraphize, blocosDaResenha, alvosDaResenha, MAX_PARAGRAFOS } from './paragraphize'

describe('paragraphize', () => {
  it('respeita os parágrafos que já existem', () => {
    expect(paragraphize('Um.\n\nDois.\n\nTrês.')).toEqual(['Um.', 'Dois.', 'Três.'])
  })

  it('descarta o que passa do teto — e é por isso que MAX_PARAGRAFOS existe', () => {
    expect(paragraphize('Um.\n\nDois.\n\nTrês.\n\nQuatro.', { maxParas: 3 })).toHaveLength(3)
  })

  it('agrupa frases quando não há parágrafo marcado', () => {
    const r = paragraphize('Uma frase. Outra frase. Terceira frase. Quarta frase.', {
      sentencesPerPara: 2,
      maxParas: 3,
    })
    expect(r[0]).toBe('Uma frase. Outra frase.')
  })

  it('preserva a quebra de linha DENTRO do parágrafo — é ela que carrega a lista', () => {
    expect(paragraphize('Prosa.\n\n- Um item.\n- Outro item.')).toEqual([
      'Prosa.',
      '- Um item.\n- Outro item.',
    ])
  })

  it('mas continua colapsando espaço horizontal repetido dentro do parágrafo', () => {
    expect(paragraphize('Uma    frase   assim.\n\nOutra   aqui.')).toEqual([
      'Uma frase assim.',
      'Outra aqui.',
    ])
  })
})

describe('blocosDaResenha', () => {
  const prosa = (n: number) => `Parágrafo de prosa número ${n}, com o que a passagem diz.`

  it('devolve só prosa quando a resenha não traz a lista de palavras', () => {
    expect(blocosDaResenha([prosa(1), prosa(2), prosa(3)].join('\n\n'))).toEqual([
      { tipo: 'prosa', texto: prosa(1) },
      { tipo: 'prosa', texto: prosa(2) },
      { tipo: 'prosa', texto: prosa(3) },
    ])
  })

  it('abre o último parágrafo em um bloco por palavra, sem o traço', () => {
    const lista = [
      '- Estopa é a fibra que sobra quando se desfia o linho.',
      '- As luas novas eram a festa do primeiro dia de cada mês.',
    ].join('\n')
    expect(blocosDaResenha([prosa(1), prosa(2), lista].join('\n\n'))).toEqual([
      { tipo: 'prosa', texto: prosa(1) },
      { tipo: 'prosa', texto: prosa(2) },
      { tipo: 'palavra', texto: 'Estopa é a fibra que sobra quando se desfia o linho.' },
      { tipo: 'palavra', texto: 'As luas novas eram a festa do primeiro dia de cada mês.' },
    ])
  })

  it('só o ÚLTIMO parágrafo vira lista: traço no meio da prosa continua prosa', () => {
    const meio = 'A cidade fica sozinha — como uma cabana na vinha.'
    const r = blocosDaResenha([meio, prosa(2), prosa(3)].join('\n\n'))
    expect(r.every((b) => b.tipo === 'prosa')).toBe(true)
    expect(r[0].texto).toBe(meio)
  })

  it('o texto do bloco é o que se lê em voz alta — sem marcador nenhum', () => {
    const r = blocosDaResenha(
      [prosa(1), prosa(2), prosa(3), '- Hissopo é um ramo usado para aspergir sangue.'].join('\n\n'),
    )
    const palavras = r.filter((b) => b.tipo === 'palavra')
    expect(palavras).toEqual([{ tipo: 'palavra', texto: 'Hissopo é um ramo usado para aspergir sangue.' }])
  })

  it('respeita o teto: o parágrafo além de MAX_PARAGRAFOS.resenha não entra', () => {
    const r = blocosDaResenha(
      [prosa(1), prosa(2), prosa(3), '- Uma palavra qualquer aqui.', prosa(5)].join('\n\n'),
    )
    expect(MAX_PARAGRAFOS.resenha).toBe(4)
    expect(r.map((b) => b.texto)).not.toContain(prosa(5))
  })

  it('resenha vazia não quebra', () => {
    expect(blocosDaResenha('')).toEqual([])
  })
})

describe('alvosDaResenha', () => {
  const prosa = (n: number) => `Parágrafo de prosa número ${n}, com o que a passagem diz.`

  it('separa a prosa das palavras, e cada uma recebe o id da sua seção', () => {
    const r = alvosDaResenha(
      [prosa(1), prosa(2), '- Estopa é a fibra que sobra do linho.\n- Selá é uma marca musical.'].join(
        '\n\n',
      ),
    )
    expect(r.prosa).toEqual([
      { id: 'resenha-0', texto: prosa(1) },
      { id: 'resenha-1', texto: prosa(2) },
    ])
    expect(r.palavras).toEqual([
      { id: 'palavra-0', texto: 'Estopa é a fibra que sobra do linho.' },
      { id: 'palavra-1', texto: 'Selá é uma marca musical.' },
    ])
  })

  it('os índices são independentes: a primeira palavra é palavra-0, não palavra-2', () => {
    const r = alvosDaResenha([prosa(1), prosa(2), prosa(3), '- Um item.\n- Outro item.'].join('\n\n'))
    expect(r.prosa.map((a) => a.id)).toEqual(['resenha-0', 'resenha-1', 'resenha-2'])
    expect(r.palavras[0].id).toBe('palavra-0')
  })

  it('resenha sem lista devolve palavras vazio, e a prosa intacta', () => {
    const r = alvosDaResenha([prosa(1), prosa(2)].join('\n\n'))
    expect(r.palavras).toEqual([])
    expect(r.prosa).toHaveLength(2)
  })
})
