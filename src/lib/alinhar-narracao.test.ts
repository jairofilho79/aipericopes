import { describe, expect, it } from 'vitest'
import { alinhar, tokens, type SecaoAlvos } from './alinhar-narracao'
import type { Manifesto } from './manifesto'
import fixture from './__fixtures__/manifesto-1600.json'

const real = fixture as unknown as Manifesto

/** Reconstrói os alvos da tela a partir do próprio manifesto: é o caso feliz
    (a tela mostra exatamente o que foi narrado, sem cabeçalho nem prefixo). */
function alvosDoManifesto(m: Manifesto, secao: 'contexto' | 'texto' | 'resenha' | 'reflexoes') {
  return m.unidades
    .filter((u) => u.secao === secao)
    .slice(1)
    .map((u, k) => ({
      id: `${secao}-${k}`,
      texto: u.texto.replace(/^(?:Capítulo|Reflexão)\s+\d+\.\s+/, ''),
    }))
}

describe('tokens', () => {
  it('é split(" ") puro — sem trim, sem filtro', () => {
    expect(tokens('a  b')).toEqual(['a', '', 'b'])
    expect(tokens('a b')).toEqual(['a', 'b'])
  })
})

describe('alinhar — manifesto real 1600', () => {
  it('alinha o texto bíblico versículo a versículo', () => {
    const alvos = alvosDoManifesto(real, 'texto')
    const r = alinhar(real, [{ secao: 'texto', alvos }])
    const versos = r.filter((a) => a.id.startsWith('texto-'))
    expect(versos).toHaveLength(17)
    expect(versos[0]!.id).toBe('texto-0')
    // "Capítulo 1." saiu: a 1ª palavra do 1º versículo é "Livro".
    expect(versos[0]!.palavras).toHaveLength(tokens(alvos[0]!.texto).length)
    expect(versos[0]!.inicio).toBeGreaterThan(42) // depois de "Capítulo 1."
  })

  it('alinha contexto com 1 unidade e 2 parágrafos na tela', () => {
    const uni = real.unidades.filter((u) => u.secao === 'contexto')[1]!
    const tk = tokens(uni.texto)
    const corte = 30
    const alvos = [
      { id: 'contexto-0', texto: tk.slice(0, corte).join(' ') },
      { id: 'contexto-1', texto: tk.slice(corte).join(' ') },
    ]
    const r = alinhar(real, [{ secao: 'contexto', alvos }])
    expect(r.map((a) => a.id)).toEqual(['titulo', 'referencia', 'cabecalho-contexto', 'contexto-0', 'contexto-1'])
    expect(r[3]!.palavras).toHaveLength(corte)
    expect(r[4]!.palavras).toHaveLength(tk.length - corte)
    // contíguo: o fim do primeiro é o início do segundo.
    expect(r[3]!.fim).toBe(r[4]!.inicio)
  })

  it('descarta o prefixo "Reflexão N."', () => {
    const alvos = alvosDoManifesto(real, 'reflexoes')
    const r = alinhar(real, [{ secao: 'reflexoes', alvos }])
    const perguntas = r.filter((a) => a.id.startsWith('reflexoes-'))
    expect(perguntas).toHaveLength(2)
    expect(perguntas[0]!.palavras).toHaveLength(tokens(alvos[0]!.texto).length)
    // "Reflexão N." não tem elemento na tela: não vira alvo nenhum.
    expect(r.map((a) => a.id)).toEqual(['titulo', 'referencia', 'cabecalho-reflexoes', 'reflexoes-0', 'reflexoes-1'])
  })

  it('as janelas de palavra são contíguas e cobrem o alvo inteiro', () => {
    const alvos = alvosDoManifesto(real, 'resenha')
    const r = alinhar(real, [{ secao: 'resenha', alvos }]).filter((a) => a.palavras.length)
    expect(r).toHaveLength(2)
    for (const a of r) {
      for (let k = 1; k < a.palavras.length; k++) {
        expect(a.palavras[k]!.inicio).toBe(a.palavras[k - 1]!.fim)
      }
      expect(a.palavras[0]!.inicio).toBe(a.inicio)
      expect(a.palavras[a.palavras.length - 1]!.fim).toBe(a.fim)
    }
  })

  it('as quatro seções juntas saem ordenadas por início, sem sobreposição', () => {
    const secoes: SecaoAlvos[] = (['contexto', 'texto', 'resenha', 'reflexoes'] as const).map(
      (s) => ({ secao: s, alvos: alvosDoManifesto(real, s) }),
    )
    // o contexto real tem 1 unidade só; aqui isso vira 1 alvo, e alinha igual.
    const r = alinhar(real, secoes)
    // título + referência + 4 cabeçalhos + "Capítulo 1." + conteúdo (1 + 17 + 2 + 2)
    expect(r.length).toBe(2 + 4 + 1 + (1 + 17 + 2 + 2))
    for (let k = 1; k < r.length; k++) expect(r[k]!.inicio).toBeGreaterThanOrEqual(r[k - 1]!.fim)
  })

  it('a seção titulo vira "titulo" e "referencia", sem palavras, mesmo sem alvos de conteúdo', () => {
    const r = alinhar(real, [])
    expect(r.map((a) => a.id)).toEqual(['titulo', 'referencia'])
    const t = r[0]!
    const ref = r[1]!
    expect(t.palavras).toEqual([])
    expect(ref.palavras).toEqual([])
    const uni = real.unidades.filter((u) => u.secao === 'titulo')
    // o título vai até o COMEÇO da referência (sem apagar no vão), não até o
    // fim da própria fala; a referência vai até o fim da última unidade.
    expect(t.inicio).toBe(uni[0]!.inicio)
    expect(t.fim).toBe(uni[1]!.inicio)
    expect(t.fim).toBeGreaterThan(uni[0]!.inicio + uni[0]!.dur)
    expect(ref.inicio).toBe(t.fim)
    expect(ref.fim).toBe(uni[1]!.inicio + uni[1]!.dur)
  })

  it('manifesto com uma unidade só de título não emite "referencia"', () => {
    const uni = real.unidades.filter((u) => u.secao === 'titulo')
    const so: Manifesto = { ...real, unidades: [uni[0]!, ...real.unidades.filter((u) => u.secao !== 'titulo')] }
    const r = alinhar(so, [])
    expect(r.map((a) => a.id)).toEqual(['titulo'])
    // sem 2ª unidade a janela é a da própria fala do título.
    expect(r[0]!).toMatchObject({ inicio: uni[0]!.inicio, fim: uni[0]!.inicio + uni[0]!.dur, palavras: [] })
  })

  it('o cabeçalho falado de cada seção vira "cabecalho-<secao>" até o 1º alvo de conteúdo', () => {
    const secoes: SecaoAlvos[] = (['contexto', 'texto', 'resenha', 'reflexoes'] as const).map(
      (s) => ({ secao: s, alvos: alvosDoManifesto(real, s) }),
    )
    const r = alinhar(real, secoes)
    for (const s of ['contexto', 'texto', 'resenha', 'reflexoes'] as const) {
      const k = r.findIndex((a) => a.id === `cabecalho-${s}`)
      expect(k, s).toBeGreaterThanOrEqual(0)
      const cab = r[k]!
      const hdr = real.unidades.find((u) => u.secao === s)!
      expect(cab.palavras).toEqual([])
      expect(cab.inicio).toBe(hdr.inicio)
      // sem vão até o conteúdo: o realce do cabeçalho passa o bastão direto.
      expect(cab.fim).toBe(r[k + 1]!.inicio)
      expect(cab.fim).toBeGreaterThan(hdr.inicio + hdr.dur)
    }
  })

  it('o "Capítulo N." descartado vira um alvo "cap-N" entre o cabeçalho e o 1º versículo', () => {
    const alvos = alvosDoManifesto(real, 'texto')
    const r = alinhar(real, [{ secao: 'texto', alvos }])
    expect(r.map((a) => a.id).slice(0, 5)).toEqual(['titulo', 'referencia', 'cabecalho-texto', 'cap-1', 'texto-0'])
    const cap = r[3]!
    const v1 = real.unidades.find((u) => u.secao === 'texto' && /^Capítulo/.test(u.texto))!
    expect(cap.palavras).toEqual([])
    expect(cap.inicio).toBe(v1.palavras![0]!.i)
    expect(cap.fim).toBe(v1.palavras![2]!.i) // "Livro", o 1º token que sobrou
    expect(r[4]!.inicio).toBe(cap.fim)
  })

  it('o cabeçalho é emitido mesmo quando o conteúdo da seção não alinha', () => {
    const r = alinhar(real, [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'nao bate' }] }])
    expect(r.map((a) => a.id)).toEqual(['titulo', 'referencia', 'cabecalho-resenha'])
    const hdr = real.unidades.find((u) => u.secao === 'resenha')!
    // sem conteúdo alinhado a janela é a da própria unidade falada.
    expect(r[2]!.inicio).toBe(hdr.inicio)
    expect(r[2]!.fim).toBe(hdr.inicio + hdr.dur)
  })
})

describe('alinhar — recusas', () => {
  const uma = (u: Partial<Manifesto['unidades'][number]>): Manifesto => ({
    ordem: 1,
    dur_total: 10,
    unidades: [
      { i: 0, secao: 'resenha', texto: 'Resenha.', inicio: 0, dur: 1, palavras: [{ t: 'Resenha.', i: 0, d: 1 }] },
      {
        i: 1,
        secao: 'resenha',
        texto: 'um dois',
        inicio: 2,
        dur: 2,
        palavras: [{ t: 'um', i: 2, d: 1 }, { t: 'dois', i: 3, d: 1 }],
        ...u,
      },
    ],
  })

  /** Só o conteúdo: o cabeçalho falado sai mesmo quando a seção não alinha. */
  const conteudo = (r: ReturnType<typeof alinhar>) => r.filter((a) => !a.id.startsWith('cabecalho-'))

  it('texto da tela diferente do narrado derruba a seção', () => {
    const r = alinhar(uma({}), [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um tres' }] }])
    expect(conteudo(r)).toEqual([])
    expect(r.map((a) => a.id)).toEqual(['cabecalho-resenha'])
  })

  it('contagem diferente derruba a seção', () => {
    const r = alinhar(uma({}), [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um' }] }])
    expect(conteudo(r)).toEqual([])
  })

  it('unidade sem palavras derruba a seção', () => {
    const r = alinhar(uma({ palavras: undefined }), [
      { secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um dois' }] },
    ])
    expect(conteudo(r)).toEqual([])
  })

  it('palavras que não reproduzem o texto derrubam a seção', () => {
    const m = uma({ palavras: [{ t: 'um', i: 2, d: 1 }, { t: 'DOIS', i: 3, d: 1 }] })
    const r = alinhar(m, [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um dois' }] }])
    expect(conteudo(r)).toEqual([])
  })

  it('o cabeçalho não depende de `palavras`: sai também no manifesto antigo', () => {
    const m = uma({})
    m.unidades[0]!.palavras = undefined
    const r = alinhar(m, [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um dois' }] }])
    expect(r.map((a) => a.id)).toEqual(['cabecalho-resenha', 'r-0'])
    expect(r[0]!).toMatchObject({ inicio: 0, fim: 2, palavras: [] })
  })

  it('uma seção quebrada não derruba as outras', () => {
    const secoes: SecaoAlvos[] = [
      { secao: 'texto', alvos: [{ id: 'v', texto: 'nao bate' }] },
      { secao: 'resenha', alvos: alvosDoManifesto(real, 'resenha') },
    ]
    const r = alinhar(real, secoes)
    expect(r.filter((a) => a.palavras.length).map((a) => a.id)).toEqual(
      alvosDoManifesto(real, 'resenha').map((a) => a.id),
    )
  })

  it('seção ausente do manifesto sai vazia, sem lançar (nem cabeçalho)', () => {
    const r = alinhar(uma({}), [{ secao: 'contexto', alvos: [{ id: 'c-0', texto: 'oi' }] }])
    expect(r).toEqual([])
  })

  it('prefixo que NÃO é prefixo é preservado', () => {
    // A tela diz literalmente "Capítulo 3. começa aqui" — não é o marcador
    // fundido, é o texto. Descartar mutilaria o alinhamento.
    const m: Manifesto = {
      ordem: 1,
      dur_total: 10,
      unidades: [
        { i: 0, secao: 'texto', texto: 'Texto Bíblico.', inicio: 0, dur: 1, palavras: [{ t: 'Texto', i: 0, d: 0.5 }, { t: 'Bíblico.', i: 0.5, d: 0.5 }] },
        {
          i: 1,
          secao: 'texto',
          texto: 'Capítulo 3. começa aqui',
          inicio: 2,
          dur: 4,
          palavras: [
            { t: 'Capítulo', i: 2, d: 1 },
            { t: '3.', i: 3, d: 1 },
            { t: 'começa', i: 4, d: 1 },
            { t: 'aqui', i: 5, d: 1 },
          ],
        },
      ],
    }
    const r = alinhar(m, [{ secao: 'texto', alvos: [{ id: 'v', texto: 'Capítulo 3. começa aqui' }] }])
    // e, como não é marcador, também não ganha o alvo "cap-3".
    expect(r.map((a) => a.id)).toEqual(['cabecalho-texto', 'v'])
    expect(r[1]!.palavras).toHaveLength(4)
  })

  it('"Capítulo N." no meio de um alvo é descartado do fluxo, mas não vira cap-N', () => {
    // Hipotético: o marcador fundido caindo dentro de um parágrafo, e não na
    // fronteira de um versículo. Emitir cap-N ali abriria um buraco nas
    // janelas de palavra do alvo — melhor descartar em silêncio.
    const m: Manifesto = {
      ordem: 1,
      dur_total: 10,
      unidades: [
        { i: 0, secao: 'texto', texto: 'Texto Bíblico.', inicio: 0, dur: 1, palavras: [{ t: 'Texto', i: 0, d: 0.5 }, { t: 'Bíblico.', i: 0.5, d: 0.5 }] },
        { i: 1, secao: 'texto', texto: 'antes', inicio: 2, dur: 1, palavras: [{ t: 'antes', i: 2, d: 1 }] },
        {
          i: 2,
          secao: 'texto',
          texto: 'Capítulo 3. depois',
          inicio: 4,
          dur: 3,
          palavras: [
            { t: 'Capítulo', i: 4, d: 1 },
            { t: '3.', i: 5, d: 1 },
            { t: 'depois', i: 6, d: 1 },
          ],
        },
      ],
    }
    const r = alinhar(m, [{ secao: 'texto', alvos: [{ id: 'v', texto: 'antes depois' }] }])
    expect(r.map((a) => a.id)).toEqual(['cabecalho-texto', 'v'])
    expect(r[1]!.palavras).toHaveLength(2)
  })
})

describe('alinhar — a narração normalizou o que a tela mostra cru', () => {
  const uma = (u: Partial<Manifesto['unidades'][number]>): Manifesto => ({
    ordem: 1,
    dur_total: 10,
    unidades: [
      { i: 0, secao: 'resenha', texto: 'Resenha.', inicio: 0, dur: 1, palavras: [{ t: 'Resenha.', i: 0, d: 1 }] },
      { i: 1, secao: 'resenha', texto: 'um dois', inicio: 2, dur: 2, palavras: [{ t: 'um', i: 2, d: 1 }, { t: 'dois', i: 3, d: 1 }], ...u },
    ],
  })
  const conteudo = (r: ReturnType<typeof alinhar>) => r.filter((a) => !a.id.startsWith('cabecalho-'))

  it('"SENHOR" na tela e "Senhor" na fala alinham', () => {
    const m = uma({
      texto: 'diz o Senhor,',
      palavras: [{ t: 'diz', i: 2, d: 1 }, { t: 'o', i: 3, d: 1 }, { t: 'Senhor,', i: 4, d: 1 }],
    })
    const r = conteudo(alinhar(m, [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'diz o SENHOR,' }] }]))
    expect(r.map((a) => a.id)).toEqual(['r-0'])
    expect(r[0]!.palavras).toHaveLength(3)
  })

  it('colchete editorial da NAA, que a voz não fala, não derruba a seção', () => {
    const m = uma({
      texto: 'Ditas estas coisas',
      palavras: [{ t: 'Ditas', i: 2, d: 1 }, { t: 'estas', i: 3, d: 1 }, { t: 'coisas', i: 4, d: 1 }],
    })
    const r = conteudo(alinhar(m, [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: '[Ditas estas coisas]' }] }]))
    expect(r.map((a) => a.id)).toEqual(['r-0'])
    expect(r[0]!.palavras).toHaveLength(3)
  })

  it('palavra de verdade diferente continua derrubando a seção', () => {
    const r = conteudo(alinhar(uma({}), [{ secao: 'resenha', alvos: [{ id: 'r-0', texto: 'um tres' }] }]))
    expect(r).toEqual([])
  })

  it('descarta "Capítulo N." mesmo quando o token seguinte só difere na caixa', () => {
    const m: Manifesto = {
      ordem: 1,
      dur_total: 10,
      unidades: [
        { i: 0, secao: 'texto', texto: 'Texto bíblico.', inicio: 0, dur: 1, palavras: [{ t: 'Texto', i: 0, d: 0.5 }, { t: 'bíblico.', i: 0.5, d: 0.5 }] },
        {
          i: 1,
          secao: 'texto',
          texto: 'Capítulo 1. Senhor disse',
          inicio: 2,
          dur: 4,
          palavras: [{ t: 'Capítulo', i: 2, d: 1 }, { t: '1.', i: 3, d: 1 }, { t: 'Senhor', i: 4, d: 1 }, { t: 'disse', i: 5, d: 1 }],
        },
      ],
    }
    const r = alinhar(m, [{ secao: 'texto', alvos: [{ id: 'v-1', texto: 'SENHOR disse' }] }])
    expect(r.map((a) => a.id)).toEqual(['cabecalho-texto', 'cap-1', 'v-1'])
    expect(r[2]!.palavras).toHaveLength(2)
  })
})
