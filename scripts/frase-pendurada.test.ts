import { describe, expect, it } from 'vitest'
import { aplicarVeredito, pendurada, penduradaSemPagar, todasPenduradas } from './frase-pendurada.ts'

describe('pendurada', () => {
  it('acha a frase-molde no fim do campo', () => {
    expect(pendurada('Jacó mora em Canaã.\n\nRepare em qual irmão fala primeiro.')).toBe(
      'Repare em qual irmão fala primeiro.',
    )
  })

  it('ignora a mesma palavra no meio do texto', () => {
    // No meio, a frase costuma estar amarrada ao que vem depois; cortá-la
    // perderia ligação, e foi isso que os leitores recusaram em Dt 1 e 2Sm 1.
    expect(pendurada('Repare que o texto muda. Depois disso, Jacó parte de Berseba.')).toBeNull()
  })

  it('acha a que anuncia e entrega — quem decide é o julgamento, não o regex', () => {
    const boa = 'Guarde isso ao ler: o pai tem só mais um filho daquela mulher.'
    expect(pendurada(`A casa é dividida por mães. ${boa}`)).toBe(boa)
  })
})

describe('aplicarVeredito', () => {
  const ctx = 'A casa é dividida por mães. Repare em quem fala primeiro.'
  const frase = 'Repare em quem fala primeiro.'

  it('entrega não muda nada', () => {
    expect(aplicarVeredito(ctx, frase, { ordem: 1, veredito: 'entrega' })).toBe(ctx)
  })

  it('corta remove a frase e não deixa espaço solto', () => {
    expect(aplicarVeredito(ctx, frase, { ordem: 1, veredito: 'corta' })).toBe(
      'A casa é dividida por mães.',
    )
  })

  it('responde troca a frase pela que entrega o fato', () => {
    const novo = 'Judá é quem fala primeiro, e é ele quem propôs vender José.'
    expect(aplicarVeredito(ctx, frase, { ordem: 1, veredito: 'responde', novo })).toBe(
      `A casa é dividida por mães. ${novo}`,
    )
  })

  it('recusa trocar uma frase pendurada por outra', () => {
    expect(() =>
      aplicarVeredito(ctx, frase, {
        ordem: 1,
        veredito: 'responde',
        novo: 'Repare também em quem cala.',
      }),
    ).toThrow(/anuncia e não paga/)
  })

  it('recusa quando a frase não está mais no contexto', () => {
    expect(() => aplicarVeredito(ctx, 'frase que não existe', { ordem: 1, veredito: 'corta' })).toThrow(
      /não está mais/,
    )
  })

  it('recusa responde sem a frase nova', () => {
    expect(() => aplicarVeredito(ctx, frase, { ordem: 1, veredito: 'responde' })).toThrow(/sem frase nova/)
  })
})

describe('o anúncio impessoal', () => {
  it('pega "Duas coisas ajudam" no fim do campo', () => {
    expect(pendurada('Jotão falou do monte. Duas coisas ajudam aqui.')).toBe(
      'Duas coisas ajudam aqui.',
    )
  })

  it('pega também quando o anúncio PAGA — quem separa é o julgamento', () => {
    // Várias das 23 entregam de fato. Entram como candidatas do mesmo jeito;
    // filtrar por regex aqui repetiria o erro de decidir sem ler.
    const paga = 'Uma informação ajuda: a família do morto cobrava a morte, e cobrava rápido.'
    expect(pendurada(`O contexto é a cidade de refúgio. ${paga}`)).toBe(paga)
  })
})

describe('todasPenduradas', () => {
  it('acha as duas quando o parágrafo tem duas', () => {
    // O caso de 2Sm 2:1 e Êx 14: consertada a última, a de trás vira a nova
    // última e ninguém volta lá — por isso a resenha precisa da lista.
    const t = 'Repare em quantas perguntas ele faz. Davi sobe a Hebrom. Note quem o unge.'
    expect(todasPenduradas(t)).toEqual(['Repare em quantas perguntas ele faz.', 'Note quem o unge.'])
  })

  it('devolve vazio quando não há nenhuma', () => {
    expect(todasPenduradas('Davi sobe a Hebrom e é ungido rei sobre Judá.')).toEqual([])
  })
})

describe('o corte que quebra o texto', () => {
  const ctx = 'Saul reinou. Guarde essa palavra, tremendo. Ela explica o que ele vai fazer.'
  const frase = 'Guarde essa palavra, tremendo.'

  it('recusa cortar quando a frase seguinte se apoia nesta', () => {
    // 1Sm 13:1: cortada a marca, "Ela explica…" fica sem antecedente. O texto
    // segue gramatical e vira sem sentido, que é pior que o defeito original.
    expect(() => aplicarVeredito(ctx, frase, { ordem: 522, veredito: 'corta' })).toThrow(
      /se apoia nesta/,
    )
  })

  it('deixa responder no lugar, porque a frase nova vira o antecedente', () => {
    const novo = 'A palavra é "rejeitou".'
    expect(aplicarVeredito(ctx, frase, { ordem: 522, veredito: 'responde', novo })).toContain(novo)
  })

})

describe('a limpeza depois do corte', () => {
  it('não deixa dois espaços quando a frase sai do meio do parágrafo', () => {
    const t = 'Saul reinou. Repare em quem fala. O povo se reuniu em Gilgal.'
    expect(aplicarVeredito(t, 'Repare em quem fala.', { ordem: 1, veredito: 'corta' })).toBe(
      'Saul reinou. O povo se reuniu em Gilgal.',
    )
  })

  it('não deixa parágrafo vazio quando a frase era o parágrafo inteiro', () => {
    const t = 'Saul reinou.\n\nRepare em quem fala.\n\nO povo se reuniu.'
    expect(aplicarVeredito(t, 'Repare em quem fala.', { ordem: 1, veredito: 'corta' })).toBe(
      'Saul reinou.\n\nO povo se reuniu.',
    )
  })
})

describe('penduradaSemPagar', () => {
  it('deixa passar a frase que tem a forma do tique mas entrega', () => {
    // Recusadas pela primeira versão do portão, e as duas estão certas.
    expect(penduradaSemPagar('Guarde o nome de Nabote: é na propriedade dele que tudo acontece.')).toBe(false)
    expect(penduradaSemPagar('Guarde isso ao ler: o pai tem só mais um filho daquela mulher.')).toBe(false)
  })

  it('barra a que anuncia e não paga', () => {
    expect(penduradaSemPagar('Repare em quem fala primeiro.')).toBe(true)
    expect(penduradaSemPagar('Duas coisas ajudam aqui.')).toBe(true)
  })

  it('não aceita dois-pontos com quase nada depois', () => {
    expect(penduradaSemPagar('Repare nisto: é importante.')).toBe(true)
  })

  it('deixa passar frase que nem tem a forma do tique', () => {
    expect(penduradaSemPagar('Davi escreve a ordem, e Urias a entrega.')).toBe(false)
  })
})

describe('o cabeçalho de lista', () => {
  const ctx =
    'O capítulo fecha. Duas informações são plantadas aqui. A primeira é que Mardoqueu está à porta.'
  const frase = 'Duas informações são plantadas aqui.'

  it('recusa responder, porque a enumeração já é o pagamento', () => {
    // Responder faz o texto dizer a mesma coisa duas vezes seguidas — pior que
    // o defeito original.
    expect(() =>
      aplicarVeredito(ctx, frase, {
        ordem: 1037,
        veredito: 'responde',
        novo: 'Duas informações são plantadas aqui: que Mardoqueu está à porta.',
      }),
    ).toThrow(/cabeçalho de lista/)
  })

  it('recusa cortar, porque a lista ficaria sem abertura', () => {
    expect(() => aplicarVeredito(ctx, frase, { ordem: 1037, veredito: 'corta' })).toThrow(
      /cabeçalho de lista/,
    )
  })

  it('deixa passar entrega', () => {
    expect(aplicarVeredito(ctx, frase, { ordem: 1037, veredito: 'entrega' })).toBe(ctx)
  })
})

describe('corta_e_nomeia', () => {
  // Jó 1:13: o "Ele" seguinte podia grudar em "o SENHOR", que fecha a citação
  // logo antes. Responder ali só cabia inventando "O foco volta para Jó." —
  // rubrica de teatro, que é o defeito com outra roupa.
  const ctx = 'bendito seja o nome do SENHOR". Repare no que Jó não faz. Ele não culpa os sabeus.'
  const frase = 'Repare no que Jó não faz.'

  it('tira o ponteiro e troca o pronome pelo nome', () => {
    expect(aplicarVeredito(ctx, frase, { ordem: 1058, veredito: 'corta_e_nomeia', sujeito: 'Jó' })).toBe(
      'bendito seja o nome do SENHOR". Jó não culpa os sabeus.',
    )
  })

  it('troca só o pronome que abre, e não o do meio da frase', () => {
    const t = 'A cena vira. Repare nisso. Ele não culpa ninguém, e ele repete o nome.'
    expect(aplicarVeredito(t, 'Repare nisso.', { ordem: 1, veredito: 'corta_e_nomeia', sujeito: 'Jó' })).toBe(
      'A cena vira. Jó não culpa ninguém, e ele repete o nome.',
    )
  })

  it('recusa quando a frase seguinte não começa por pronome', () => {
    const t = 'A cena vira. Repare nisso. O narrador confirma o veredito.'
    expect(() =>
      aplicarVeredito(t, 'Repare nisso.', { ordem: 1, veredito: 'corta_e_nomeia', sujeito: 'Jó' }),
    ).toThrow(/não começa por pronome/)
  })

  it('recusa sem sujeito', () => {
    expect(() => aplicarVeredito(ctx, frase, { ordem: 1058, veredito: 'corta_e_nomeia' })).toThrow(
      /sem sujeito/,
    )
  })
})

describe('a frase nova que repete a vizinha', () => {
  it('recusa quando a nova repete seis palavras seguidas da frase seguinte', () => {
    const ctx =
      'O altar tem nome. Repare no nome. Ele não deu ao altar o nome da vitória nem o de Josué.'
    expect(() =>
      aplicarVeredito(ctx, 'Repare no nome.', {
        ordem: 116,
        veredito: 'responde',
        novo: 'O nome não é o nome da vitória nem o de Josué, mas outro.',
      }),
    ).toThrow(/repete \d+ palavras/)
  })

  it('deixa passar quando só compartilha vocabulário solto', () => {
    const ctx = 'O altar tem nome. Repare no nome. Ele não deu ao altar o nome da vitória.'
    expect(
      aplicarVeredito(ctx, 'Repare no nome.', {
        ordem: 116,
        veredito: 'responde',
        novo: 'Moisés chamou o altar de "O SENHOR é minha bandeira".',
      }),
    ).toContain('minha bandeira')
  })
})
