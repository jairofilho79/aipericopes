import { describe, expect, it } from 'vitest'
import { parseConsulta } from './consulta'
import { BIBLE_BOOKS } from './bible-books'

describe('parseConsulta — referência', () => {
  it('abbrev + capítulo + versículo', () => {
    const c = parseConsulta('Jo 3:16')
    expect(c.ref?.livro.name).toBe('João')
    expect(c.ref?.cap).toBe(3)
    expect(c.ref?.ver).toBe(16)
  })

  it('não busca no texto quando é referência — "jo 3:16" não é um trecho', () => {
    expect(parseConsulta('Jo 3:16').buscarNoTexto).toBe(false)
  })

  it('a seção Livros mostra o livro da referência', () => {
    expect(parseConsulta('Jo 3:16').livros.map((b) => b.name)).toEqual(['João'])
  })

  it('só capítulo, sem versículo', () => {
    const c = parseConsulta('Salmos 23')
    expect(c.ref?.livro.name).toBe('Salmos')
    expect(c.ref?.cap).toBe(23)
    expect(c.ref?.ver).toBeNull()
  })

  it('aceita ponto OU vírgula como separador de versículo', () => {
    expect(parseConsulta('Jo 3.16').ref?.ver).toBe(16)
    expect(parseConsulta('Jo 3,16').ref?.ver).toBe(16)
  })

  it('o espaço do ordinal não conta: "1 co 13" é 1 Coríntios 13', () => {
    const c = parseConsulta('1 co 13')
    expect(c.ref?.livro.name).toBe('1 Coríntios')
    expect(c.ref?.cap).toBe(13)
  })

  it('nome completo com ordinal', () => {
    expect(parseConsulta('1 Samuel 3').ref?.livro.name).toBe('1 Samuel')
  })
})

describe('parseConsulta — a colisão jo/jó', () => {
  it('abbrev é sensível a acento: "jo 3:16" é João', () => {
    expect(parseConsulta('jo 3:16').ref?.livro.name).toBe('João')
  })

  it('abbrev é sensível a acento: "jó 3:16" é Jó', () => {
    expect(parseConsulta('jó 3:16').ref?.livro.name).toBe('Jó')
  })

  it('"jo" sozinho não é referência e lista os oito livros que contêm "jo"', () => {
    const c = parseConsulta('jo')
    expect(c.ref).toBeNull()
    expect(c.livros.map((b) => b.name)).toEqual([
      'Josué', 'Jó', 'Joel', 'Jonas', 'João', '1 João', '2 João', '3 João',
    ])
  })

  it('fronteira de palavra: "josue 3" é Josué, não João seguido de "sue 3"', () => {
    expect(parseConsulta('josue 3').ref?.livro.name).toBe('Josué')
  })

  it('empate jo/Jó: abbrev de João vence o nome de Jó', () => {
    expect(parseConsulta('jo 1').ref?.livro.name).toBe('João')
    expect(parseConsulta('jó 1').ref?.livro.name).toBe('Jó')
  })

  it('entrada decomposta (NFD) não vira referência errada', () => {
    // `.normalize('NFD')` explícito, não o acento decomposto digitado no
    // fonte: guardado literalmente, qualquer ferramenta que normalize o
    // arquivo para NFC (comum em editores e formatadores) colapsa a linha
    // numa cópia da de baixo, e o teste passa a validar a mesma entrada duas
    // vezes sem que ninguém perceba.
    const decomposto = 'jó 1'.normalize('NFD')
    expect(parseConsulta(decomposto).ref?.livro.name).toBe('Jó')
    // e a forma pré-composta continua igual
    expect(parseConsulta('jó 1').ref?.livro.name).toBe('Jó')
  })
})

describe('parseConsulta — fora de faixa', () => {
  it('capítulo alto demais explica em vez de sumir', () => {
    const c = parseConsulta('João 99')
    expect(c.ref).toBeNull()
    expect(c.refForaDeFaixa?.motivo).toBe('João tem 21 capítulos.')
    expect(c.buscarNoTexto).toBe(false)
    expect(c.livros.map((b) => b.name)).toEqual(['João'])
  })

  it('versículo alto demais explica', () => {
    const c = parseConsulta('João 3:99')
    expect(c.refForaDeFaixa?.motivo).toBe('João 3 tem 36 versículos.')
  })
})

describe('parseConsulta — texto livre', () => {
  it('sem token de livro, busca no texto', () => {
    const c = parseConsulta('amor de Deus')
    expect(c.ref).toBeNull()
    expect(c.livros).toEqual([])
    expect(c.buscarNoTexto).toBe(true)
  })

  it('nome de livro sozinho é ambíguo: livro E busca no texto', () => {
    const c = parseConsulta('josué')
    expect(c.ref).toBeNull()
    expect(c.livros.map((b) => b.name)).toEqual(['Josué'])
    expect(c.buscarNoTexto).toBe(true)
  })

  it('abaixo de MIN_CHARS não busca no texto', () => {
    expect(parseConsulta('am').buscarNoTexto).toBe(false)
  })

  it('vazio é vazio', () => {
    const c = parseConsulta('   ')
    expect(c.termo).toBe('')
    expect(c.livros).toEqual([])
    expect(c.buscarNoTexto).toBe(false)
  })

  it('referência sem livro cai no texto — "3:16" sozinho tem 66 respostas', () => {
    const c = parseConsulta('3:16')
    expect(c.ref).toBeNull()
    expect(c.buscarNoTexto).toBe(true)
  })
})

describe('parseConsulta — cobertura dos 66', () => {
  it('todo nome de livro + capítulo 1 vira referência para o livro certo', () => {
    for (const b of BIBLE_BOOKS) {
      expect(parseConsulta(`${b.name} 1`).ref?.livro.name).toBe(b.name)
    }
  })

  it('todo abbrev + capítulo 1 vira referência para o livro certo', () => {
    for (const b of BIBLE_BOOKS) {
      expect(parseConsulta(`${b.abbrev} 1`).ref?.livro.name).toBe(b.name)
    }
  })
})

/**
 * Os cinco pares de capítulos que precisaram de conserto em 2026-09-03 (versos
 * que estavam no capítulo errado). `bible-books.ts` guarda `versesPerChapter`
 * à mão e ficou com os números antigos por algumas horas — tempo em que a busca
 * recusava `Sl 110:7` dizendo "Salmos 110 tem 5 versículos", uma afirmação
 * falsa sobre a Bíblia, e aceitava `Sl 111:12`, que não existe.
 *
 * `scripts/auditar-cobertura.ts` compara os 1189 capítulos contra a fonte e é
 * quem PEGA uma divergência nova — mas lê `data/BLIVRE.json`, que é gitignored,
 * então não roda na CI. Estes casos são a metade que roda: não descobrem
 * divergência nova, impedem que estes dez valores voltem sem ninguém notar.
 *
 * Os dez sobreviveram à troca da NAA pela Bíblia Livre: as duas concordam
 * nestes capítulos.
 */
describe('versificação dos capítulos consertados', () => {
  it('os versículos que existem são aceitos como referência', () => {
    for (const q of ['2Sm 22:51', 'Sl 110:7', 'Is 4:6', 'Is 12:6', 'Os 3:5']) {
      expect(parseConsulta(q).ref, q).not.toBeNull()
    }
  })

  it('os versículos que não existem são recusados, com o número certo', () => {
    const esperado: [string, string][] = [
      ['2Sm 23:40', '2 Samuel 23 tem 39 versículos.'],
      ['Sl 111:12', 'Salmos 111 tem 10 versículos.'],
      ['Is 5:31', 'Isaías 5 tem 30 versículos.'],
      // Is 13 não produz sintoma pela busca (a perícope cobre o capítulo
      // inteiro), e por isso passou despercebido na primeira medição: só
      // apareceu comparando os 1189 capítulos contra a NAA.
      ['Is 13:23', 'Isaías 13 tem 22 versículos.'],
      ['Os 4:20', 'Oséias 4 tem 19 versículos.'],
    ]
    for (const [q, motivo] of esperado) {
      const c = parseConsulta(q)
      expect(c.ref, q).toBeNull()
      expect(c.refForaDeFaixa?.motivo, q).toBe(motivo)
    }
  })
})

/**
 * Os cinco pontos em que a NAA e a Bíblia Livre discordam — os únicos cinco em
 * 31.102 versículos. A BLIVRE segue a KJV, que é de onde vêm os limites das
 * perícopes, e `bible-books.ts` teve de trocar de lado junto com a fonte.
 *
 * Em três deles a NAA numerava em separado o que a KJV mantém dentro do
 * versículo anterior; num, o inverso; e o Ap 12:18 nem existe na BLIVRE.
 * Nenhum texto se perde em nenhum dos casos — muda o número, não o conteúdo.
 */
describe('versificação onde a Bíblia Livre diverge da NAA', () => {
  it('aceita o último versículo que a BLIVRE de fato tem', () => {
    for (const q of ['1Sm 20:42', '1Rs 22:53', '2Co 13:14', '3Jo 1:14', 'Ap 12:17']) {
      expect(parseConsulta(q).ref, q).not.toBeNull()
    }
  })

  it('recusa o versículo que só a NAA tinha, com o número certo', () => {
    const esperado: [string, string][] = [
      ['1Sm 20:43', '1 Samuel 20 tem 42 versículos.'],
      ['1Rs 22:54', '1 Reis 22 tem 53 versículos.'],
      ['3Jo 1:15', '3 João 1 tem 14 versículos.'],
      ['Ap 12:18', 'Apocalipse 12 tem 17 versículos.'],
      // O caso inverso: a NAA fechava a carta em 13:13 e a BLIVRE tem o 14,
      // então quem passa a não existir é o 15.
      ['2Co 13:15', '2 Coríntios 13 tem 14 versículos.'],
    ]
    for (const [q, motivo] of esperado) {
      const c = parseConsulta(q)
      expect(c.ref, q).toBeNull()
      expect(c.refForaDeFaixa?.motivo, q).toBe(motivo)
    }
  })
})
