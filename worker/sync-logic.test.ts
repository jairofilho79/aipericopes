import { describe, expect, it } from 'vitest'
import { MAX_CORPO, corpoExcedeLimite, paginarPull, parseSyncPush } from './sync-logic'

const prog = { pericopeOrdem: 1, status: 'concluido', atualizadoEm: '2026-08-31T10:00:00.000Z' }
const nota = {
  id: 'a1',
  pericopeOrdem: 1,
  texto: 'oração',
  verseRef: null,
  criadoEm: '2026-08-31T09:00:00.000Z',
  atualizadoEm: '2026-08-31T10:00:00.000Z',
  apagadoEm: null,
}
const destaque = {
  id: '12:1:3',
  pericopeOrdem: 12,
  verseId: '1:3',
  cor: 'amarelo',
  criadoEm: '2026-08-31T09:00:00.000Z',
  atualizadoEm: '2026-08-31T10:00:00.000Z',
  apagadoEm: null,
}

const posicao = {
  pericopeOrdem: 7,
  tipo: 'versiculo',
  ref: '3:16',
  tempo: null,
  atualizadoEm: '2026-08-31T10:00:00.000Z',
  apagadoEm: null,
}

describe('parseSyncPush — posições de leitura', () => {
  it('aceita posição válida em cada tipo de ref do vocabulário', () => {
    expect(parseSyncPush({ posicoes: [posicao] })?.posicoes).toEqual([posicao])
    for (const ref of ['texto', 'contexto-0', 'reflexao-12', 'cabecalho-reflexoes', 'cap-3', 'titulo']) {
      expect(parseSyncPush({ posicoes: [{ ...posicao, tipo: 'secao', ref }] })?.posicoes).toHaveLength(1)
    }
  })
  it('aceita narração com tempo e lápide (apagadoEm ISO)', () => {
    const narr = { ...posicao, tipo: 'narracao', ref: 'resenha-2', tempo: 91.3 }
    expect(parseSyncPush({ posicoes: [narr] })?.posicoes).toEqual([narr])
    const lapide = { ...posicao, apagadoEm: '2026-08-31T11:00:00.000Z' }
    expect(parseSyncPush({ posicoes: [lapide] })?.posicoes).toEqual([lapide])
  })
  it('rejeita tipo desconhecido, ref fora do vocabulário e tempo inválido', () => {
    expect(parseSyncPush({ posicoes: [{ ...posicao, tipo: 'scroll' }] })).toBeNull()
    expect(parseSyncPush({ posicoes: [{ ...posicao, ref: 'x:1' }] })).toBeNull()
    expect(parseSyncPush({ posicoes: [{ ...posicao, ref: 'divagando' }] })).toBeNull()
    expect(parseSyncPush({ posicoes: [{ ...posicao, ref: '' }] })).toBeNull()
    expect(parseSyncPush({ posicoes: [{ ...posicao, tempo: Number.POSITIVE_INFINITY }] })).toBeNull()
    expect(parseSyncPush({ posicoes: [{ ...posicao, tempo: -1 }] })).toBeNull()
    expect(parseSyncPush({ posicoes: [{ ...posicao, tempo: '10' }] })).toBeNull()
  })
  it('rejeita lote de posições acima de 500 itens', () => {
    expect(parseSyncPush({ posicoes: Array(501).fill(posicao) })).toBeNull()
  })
})

describe('paginarPull — posições', () => {
  it('posições estourando: corta, avança o cursor e marca grupo incompleto quando tudo empata', () => {
    const T = '2026-01-01T00:00:05.000Z'
    const listas = {
      progresso: [] as ReturnType<typeof linha>[],
      anotacoes: [] as ReturnType<typeof linha>[],
      destaques: [] as ReturnType<typeof linha>[],
      posicoes: [linha(T, 1), linha(T, 2), linha(T, 3)],
      jornadas: [] as ReturnType<typeof linha>[],
    }
    const resultado = paginarPull(listas, 2)
    expect(resultado.cursor).toBe(T)
    expect(resultado.maisDados).toBe(true)
    expect(resultado.gruposIncompletos).toEqual(['posicoes'])
  })
})

describe('parseSyncPush — jornadas', () => {
  const valida = {
    id: 'j1',
    nome: 'Evangelhos',
    tipo: 'bloco',
    escopo: 'evangelhos',
    inicioOrdem: 4,
    contaDesde: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    arquivadaEm: null,
    concluidaEm: null,
    apagadoEm: null,
  }

  it('aceita uma jornada válida', () => {
    expect(parseSyncPush({ jornadas: [valida] })?.jornadas).toHaveLength(1)
  })

  it('aceita corpo sem a lista (cliente não atualizado)', () => {
    expect(parseSyncPush({ progresso: [] })?.jornadas).toEqual([])
  })

  it('recusa tipo fora do vocabulário', () => {
    expect(parseSyncPush({ jornadas: [{ ...valida, tipo: 'cronologica' }] })).toBeNull()
  })

  it('recusa inicioOrdem não-inteiro', () => {
    expect(parseSyncPush({ jornadas: [{ ...valida, inicioOrdem: 1.5 }] })).toBeNull()
  })

  it('recusa nome acima do teto', () => {
    expect(parseSyncPush({ jornadas: [{ ...valida, nome: 'x'.repeat(121) }] })).toBeNull()
  })

  it('recusa escopo vazio', () => {
    expect(parseSyncPush({ jornadas: [{ ...valida, escopo: '' }] })).toBeNull()
  })

  it('aceita contaDesde/arquivadaEm/concluidaEm como ISO ou null', () => {
    const j = { ...valida, contaDesde: '2026-02-01T00:00:00.000Z', concluidaEm: '2026-03-01T00:00:00.000Z' }
    expect(parseSyncPush({ jornadas: [j] })?.jornadas).toHaveLength(1)
    expect(parseSyncPush({ jornadas: [{ ...valida, contaDesde: 'ontem' }] })).toBeNull()
  })

  it('rejeita lote de jornadas acima de 500 itens', () => {
    expect(parseSyncPush({ jornadas: Array(501).fill(valida) })).toBeNull()
  })
})

describe('paginarPull — com jornadas', () => {
  const linhaJ = (serverEm: string) => ({ serverEm })

  it('devolve a lista de jornadas intacta quando ninguém estoura', () => {
    const r = paginarPull(
      { progresso: [], anotacoes: [], destaques: [], posicoes: [], jornadas: [linhaJ('a')] },
      10,
    )
    expect(r.jornadas).toHaveLength(1)
    expect(r.cursor).toBeNull()
    expect(r.maisDados).toBe(false)
  })

  it('corta jornadas acima do cursor quando outra entidade estoura', () => {
    const r = paginarPull(
      {
        progresso: [linhaJ('a'), linhaJ('b'), linhaJ('c')],
        anotacoes: [], destaques: [], posicoes: [],
        jornadas: [linhaJ('a'), linhaJ('z')],
      },
      2,
    )
    expect(r.cursor).toBe('b')
    expect(r.jornadas).toEqual([linhaJ('a')])
  })

  // Os dois testes acima nunca fazem `jornadas` ESTOURAR (n+1 linhas): o
  // primeiro cabe tudo, o segundo tem só 2 linhas com n=2. Nenhum dos dois
  // passa pela entrada `{ nome: 'jornadas', ... }` do array `fronteiras` —
  // uma mutação que apagasse essa linha passaria os dois igual. Os três
  // testes abaixo fecham essa lacuna: (a) jornadas estourando é quem decide
  // o cursor, (b) o grupo de jornadas maior que a página, (c) o caminho
  // completo de fechamento de grupo (fecharGrupo) para jornadas.
  it('jornadas estourando com fronteira MENOR que as outras entidades: o cursor é o de jornadas, e as outras são cortadas por ele', () => {
    // jornadas estoura (n=2, 3 linhas) com fronteira T2 — menor que a linha
    // de progresso em T2.5, que não estoura por si só mas tem que ser
    // cortada porque o cursor global (o mínimo das fronteiras) é T2. Sem a
    // entrada de jornadas em `fronteiras`, o estouro dela nunca seria visto:
    // o cursor sairia null (nenhuma entidade "estourando"), devolvendo as 3
    // linhas de jornadas inteiras e progresso intacto — o oposto disto.
    const jornadas = [
      linha('2026-01-01T00:00:01.000Z', 1),
      linha('2026-01-01T00:00:02.000Z', 2), // T2 — fronteira de jornadas
      linha('2026-01-01T00:00:03.000Z', 3), // a (n+1)-ésima
    ]
    const progresso = [
      linha('2026-01-01T00:00:01.500Z', 10),
      linha('2026-01-01T00:00:02.500Z', 11), // > T2, cortada mesmo sem estourar por si só
    ]
    const r = paginarPull(
      { progresso, anotacoes: [], destaques: [], posicoes: [], jornadas },
      2,
    )
    expect(r.cursor).toBe('2026-01-01T00:00:02.000Z')
    expect(r.maisDados).toBe(true)
    expect(r.jornadas.map((j) => j.v)).toEqual([1, 2])
    expect(r.progresso.map((p) => p.v)).toEqual([10])
  })

  it('grupo de jornadas maior que a página inteira: avança o cursor e marca gruposIncompletos', () => {
    // As n+1=3 linhas de jornadas compartilham o MESMO server_em — o mesmo
    // cenário de "grupo maior que a página" já coberto para destaques e
    // posições, agora para jornadas.
    const T = '2026-01-01T00:00:05.000Z'
    const jornadas = [linha(T, 1), linha(T, 2), linha(T, 3)]
    const r = paginarPull(
      { progresso: [], anotacoes: [], destaques: [], posicoes: [], jornadas },
      2,
    )
    expect(r.cursor).toBe(T)
    expect(r.maisDados).toBe(true)
    expect(r.gruposIncompletos).toEqual(['jornadas'])
  })
})

describe('parseSyncPush', () => {
  it('aceita payload válido', () => {
    expect(parseSyncPush({ progresso: [prog], anotacoes: [nota] })).toEqual({
      progresso: [{ ...prog, historico: [], paraReler: false }],
      anotacoes: [nota],
      destaques: [],
      posicoes: [],
      jornadas: [],
    })
  })
  it('aceita listas ausentes como vazias', () => {
    expect(parseSyncPush({})).toEqual({
      progresso: [],
      anotacoes: [],
      destaques: [],
      posicoes: [],
      jornadas: [],
    })
  })
  it('rejeita status desconhecido, tipos errados e não-objeto', () => {
    expect(parseSyncPush({ progresso: [{ ...prog, status: 'x' }] })).toBeNull()
    expect(parseSyncPush({ anotacoes: [{ ...nota, texto: 5 }] })).toBeNull()
    expect(parseSyncPush(null)).toBeNull()
    expect(parseSyncPush('a')).toBeNull()
  })
  it('rejeita lotes acima de 500 itens e texto acima de 20000 chars', () => {
    expect(parseSyncPush({ progresso: Array(501).fill(prog) })).toBeNull()
    expect(parseSyncPush({ anotacoes: [{ ...nota, texto: 'x'.repeat(20001) }] })).toBeNull()
  })
  it('exige timestamps no formato ISO canônico (toISOString)', () => {
    expect(
      parseSyncPush({ progresso: [{ ...prog, atualizadoEm: '2026-08-31T09:00:00-03:00' }] }),
    ).toBeNull()
    expect(
      parseSyncPush({ progresso: [{ ...prog, atualizadoEm: '2026-08-31T10:00:00Z' }] }),
    ).toBeNull()
    expect(
      parseSyncPush({ progresso: [{ ...prog, atualizadoEm: '2026-08-31T10:00:00.000Z' }] }),
    ).toEqual({
      progresso: [{ ...prog, atualizadoEm: '2026-08-31T10:00:00.000Z', historico: [], paraReler: false }],
      anotacoes: [],
      destaques: [],
      posicoes: [],
      jornadas: [],
    })
  })
})

describe('parseSyncPush — destaques', () => {
  it('aceita destaque válido', () => {
    expect(parseSyncPush({ destaques: [destaque] })).toEqual({
      progresso: [],
      anotacoes: [],
      destaques: [destaque],
      posicoes: [],
      jornadas: [],
    })
  })
  it('aceita lápide (apagadoEm ISO)', () => {
    const lapide = { ...destaque, apagadoEm: '2026-08-31T11:00:00.000Z' }
    expect(parseSyncPush({ destaques: [lapide] })?.destaques).toEqual([lapide])
  })
  it('rejeita cor fora do enum, verseId malformado, id vazio e datas inválidas', () => {
    expect(parseSyncPush({ destaques: [{ ...destaque, cor: 'roxo' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, verseId: '1' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, verseId: 'x:1' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, id: '' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, criadoEm: '2026-08-31' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, apagadoEm: 'ontem' }] })).toBeNull()
  })
  it('rejeita lote de destaques acima de 500 itens', () => {
    expect(parseSyncPush({ destaques: Array(501).fill(destaque) })).toBeNull()
  })
})

describe('parseSyncPush — verseRef da anotação', () => {
  it('aceita string, null e ausente (ausente vira null)', () => {
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: '1:3-2:2' }] })?.anotacoes).toEqual([
      { ...nota, verseRef: '1:3-2:2' },
    ])
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: null }] })?.anotacoes).toEqual([nota])
    const semCampo = { ...nota } as Record<string, unknown>
    delete semCampo.verseRef
    expect(parseSyncPush({ anotacoes: [semCampo] })?.anotacoes).toEqual([nota])
  })
  it('rejeita verseRef de tipo errado ou acima de 32 chars', () => {
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: 7 }] })).toBeNull()
    expect(parseSyncPush({ anotacoes: [{ ...nota, verseRef: 'x'.repeat(33) }] })).toBeNull()
  })
})

describe('parseSyncPush — invariante do id do destaque', () => {
  // Um id que não deriva de (pericopeOrdem, verseId) vira destaque indeletável:
  // a Leitura pinta o versículo pelo verseId mas apaga pelo id derivado, então
  // o "remover" não acha a linha e o pull seguinte traz a marca de volta.
  it('rejeita id que não é `${pericopeOrdem}:${verseId}`', () => {
    expect(parseSyncPush({ destaques: [{ ...destaque, id: '99:1:3' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, id: '12:9:9' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, id: 'qualquer-coisa' }] })).toBeNull()
    expect(parseSyncPush({ destaques: [{ ...destaque, id: ' 12:1:3' }] })).toBeNull()
  })
  it('aceita o id derivado, inclusive na perícope de ordem 0', () => {
    const zero = { ...destaque, id: '0:1:3', pericopeOrdem: 0 }
    expect(parseSyncPush({ destaques: [zero] })?.destaques).toEqual([zero])
  })
})

describe('parseSyncPush — pericopeOrdem', () => {
  it('rejeita fracionário, fora do inteiro seguro, negativo e não-finito', () => {
    for (const ordem of [1.5, 1e308, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseSyncPush({ progresso: [{ ...prog, pericopeOrdem: ordem }] })).toBeNull()
      expect(parseSyncPush({ anotacoes: [{ ...nota, pericopeOrdem: ordem }] })).toBeNull()
    }
  })
  it('rejeita destaque fracionário mesmo com id derivado coerente', () => {
    expect(
      parseSyncPush({ destaques: [{ ...destaque, pericopeOrdem: 1.5, id: '1.5:1:3' }] }),
    ).toBeNull()
  })
  it('aceita 0 — é a ordem da primeira perícope de Gênesis', () => {
    expect(parseSyncPush({ progresso: [{ ...prog, pericopeOrdem: 0 }] })?.progresso).toEqual([
      { ...prog, pericopeOrdem: 0, historico: [], paraReler: false },
    ])
  })
})

describe('corpoExcedeLimite', () => {
  it('barra pelo Content-Length, antes de bufferizar o corpo', () => {
    expect(corpoExcedeLimite(String(MAX_CORPO + 1))).toBe(true)
    expect(corpoExcedeLimite(String(MAX_CORPO))).toBe(false)
  })
  it('deixa passar header ausente ou não numérico — quem mede é o segundo estágio', () => {
    expect(corpoExcedeLimite(null)).toBe(false)
    expect(corpoExcedeLimite(undefined)).toBe(false)
    expect(corpoExcedeLimite('abacaxi')).toBe(false)
  })
  it('barra pelo corpo já lido, para o chunked que chega sem header', () => {
    expect(corpoExcedeLimite(null, MAX_CORPO + 1)).toBe(true)
    expect(corpoExcedeLimite(null, MAX_CORPO)).toBe(false)
    expect(corpoExcedeLimite(null, 42)).toBe(false)
  })
  it('cabe o pior payload legal do protocolo, com folga', () => {
    // 500 anotações × 20.000 unidades UTF-16, cada uma custando até 3 bytes em
    // UTF-8, mais o overhead das três listas. Rejeitar um payload legal seria
    // pior que não ter teto: o cliente abandona o lote e a linha nunca sobe.
    const piorCasoLegal = 500 * 20_000 * 3 + 500 * 280 + 500 * 250 + 500 * 90
    expect(corpoExcedeLimite(String(piorCasoLegal))).toBe(false)
  })
})

// Helper: uma "linha" mínima com o server_em que paginarPull precisa para
// decidir o corte. `v` é só um marcador pra dar pra reconhecer cada linha
// nas asserções — o conteúdo de verdade (id, cor, etc.) é irrelevante aqui.
function linha(serverEm: string, v: number) {
  return { serverEm, v }
}

describe('paginarPull', () => {
  it('sem estouro em nenhuma entidade: devolve tudo, cursor null, maisDados false', () => {
    const listas = {
      progresso: [linha('2026-01-01T00:00:00.000Z', 1), linha('2026-01-01T00:00:01.000Z', 2)],
      anotacoes: [linha('2026-01-01T00:00:00.500Z', 3)],
      destaques: [] as ReturnType<typeof linha>[],
      posicoes: [] as ReturnType<typeof linha>[],
      jornadas: [] as ReturnType<typeof linha>[],
    }
    const resultado = paginarPull(listas, 3)
    expect(resultado).toEqual({
      ...listas,
      cursor: null,
      maisDados: false,
      gruposIncompletos: [],
    })
  })

  it('uma entidade estourando (n+1 linhas): corta essa entidade em n e usa o server_em da última mantida como cursor', () => {
    const destaques = [
      linha('2026-01-01T00:00:01.000Z', 1),
      linha('2026-01-01T00:00:02.000Z', 2),
      linha('2026-01-01T00:00:03.000Z', 3),
      linha('2026-01-01T00:00:04.000Z', 4), // a (n+1)-ésima: só serve pra provar que há mais
    ]
    const listas = {
      progresso: [linha('2026-01-01T00:00:00.000Z', 10)],
      anotacoes: [] as ReturnType<typeof linha>[],
      destaques,
      posicoes: [] as ReturnType<typeof linha>[],
      jornadas: [] as ReturnType<typeof linha>[],
    }
    const resultado = paginarPull(listas, 3)
    expect(resultado.cursor).toBe('2026-01-01T00:00:03.000Z')
    expect(resultado.maisDados).toBe(true)
    expect(resultado.destaques.map((d) => d.v)).toEqual([1, 2, 3])
    // progresso não estourou, mas seu server_em já cabe dentro do cursor —
    // continua intacto.
    expect(resultado.progresso).toEqual(listas.progresso)
  })

  it('duas entidades estourando em fronteiras diferentes: o cursor é o mínimo, e a outra entidade é recortada por ele também', () => {
    // progresso estoura e a última linha mantida por ele fica em T2 (a menor
    // das duas fronteiras). destaques estoura com fronteira maior, T4.
    const progresso = [
      linha('2026-01-01T00:00:01.000Z', 1),
      linha('2026-01-01T00:00:02.000Z', 2), // T2 — fronteira do progresso
      linha('2026-01-01T00:00:03.000Z', 3), // a (n+1)-ésima
    ]
    const destaques = [
      linha('2026-01-01T00:00:01.500Z', 10),
      linha('2026-01-01T00:00:02.500Z', 11), // > T2, deve ser cortada mesmo sem estourar por si só
      linha('2026-01-01T00:00:04.000Z', 12), // T4 — fronteira do destaques
      linha('2026-01-01T00:00:05.000Z', 13), // a (n+1)-ésima
    ]
    const listas = {
      progresso,
      anotacoes: [] as ReturnType<typeof linha>[],
      destaques,
      posicoes: [] as ReturnType<typeof linha>[],
      jornadas: [] as ReturnType<typeof linha>[],
    }
    const resultado = paginarPull(listas, 2)
    expect(resultado.cursor).toBe('2026-01-01T00:00:02.000Z') // T2, o mínimo das duas fronteiras
    expect(resultado.maisDados).toBe(true)
    expect(resultado.progresso.map((p) => p.v)).toEqual([1, 2])
    // destaques é recortado pelo cursor global (T2), não pela própria fronteira (T4)
    expect(resultado.destaques.map((d) => d.v)).toEqual([10])
  })

  it('grupo de mesmo server_em maior que a página inteira: avança o cursor (sem travar) e exige o fechamento do grupo', () => {
    // As n+1=3 linhas buscadas de destaques compartilham o MESMO server_em —
    // não dá pra saber, sem outra query, se o grupo continua além da janela.
    // Recortar aqui produziria cursor == since (nenhum progresso, loop
    // infinito no cliente). Em vez disso o cursor avança até o valor do grupo
    // e a entidade é marcada em `gruposIncompletos`: o chamador TEM que
    // rebuscar o grupo inteiro, senão o resto dele some pra sempre.
    const T = '2026-01-01T00:00:05.000Z'
    const destaques = [linha(T, 1), linha(T, 2), linha(T, 3)]
    const listas = {
      progresso: [] as ReturnType<typeof linha>[],
      anotacoes: [],
      destaques,
      posicoes: [] as ReturnType<typeof linha>[],
      jornadas: [] as ReturnType<typeof linha>[],
    }
    const resultado = paginarPull(listas, 2)
    expect(resultado.cursor).toBe(T)
    expect(resultado.maisDados).toBe(true)
    expect(resultado.gruposIncompletos).toEqual(['destaques'])
  })

  it('a entidade que empatou tudo mas perdeu o mínimo não pede fechamento (foi cortada fora inteira)', () => {
    // destaques empata tudo em T5, mas progresso estoura com fronteira T2 <
    // T5: o cursor é T2, todas as linhas de destaques ficam acima dele e são
    // descartadas. Nada de grupo em aberto — elas voltam na próxima página.
    const progresso = [
      linha('2026-01-01T00:00:01.000Z', 1),
      linha('2026-01-01T00:00:02.000Z', 2),
      linha('2026-01-01T00:00:03.000Z', 3),
    ]
    const T5 = '2026-01-01T00:00:05.000Z'
    const listas = {
      progresso,
      anotacoes: [] as ReturnType<typeof linha>[],
      destaques: [linha(T5, 10), linha(T5, 11), linha(T5, 12)],
      posicoes: [] as ReturnType<typeof linha>[],
      jornadas: [] as ReturnType<typeof linha>[],
    }
    const resultado = paginarPull(listas, 2)
    expect(resultado.cursor).toBe('2026-01-01T00:00:02.000Z')
    expect(resultado.gruposIncompletos).toEqual([])
    expect(resultado.destaques).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Ida-e-volta completa: o que os testes unitários acima NÃO pegam.
//
// Eles olham UMA chamada de paginarPull sobre a janela que ela recebeu. O que
// mata dado de verdade é o ciclo: o cliente guarda o cursor devolvido e a
// próxima página consulta `server_em > cursor` — ESTRITAMENTE maior. Se o
// cursor avançar por cima de um `server_em` cujas linhas não foram todas
// entregues, essas linhas nunca mais são consultadas. Nenhum teste de uma
// chamada só consegue ver isso, porque a perda mora nas linhas que ficaram
// FORA da janela buscada.
//
// Os testes abaixo simulam a rota inteira (a query real + paginarPull + o
// fechamento do grupo incompleto) sobre um conjunto FIXO de linhas, rodando
// até `maisDados` ser falso, e cobram a única invariante que importa: toda
// linha entregue exatamente uma vez.
// ---------------------------------------------------------------------------

type LinhaRT = { serverEm: string; v: number }
type BancoRT = {
  progresso: LinhaRT[]
  anotacoes: LinhaRT[]
  destaques: LinhaRT[]
  posicoes: LinhaRT[]
  jornadas: LinhaRT[]
}

const ENTIDADES_RT = ['progresso', 'anotacoes', 'destaques', 'posicoes', 'jornadas'] as const

/** `SELECT ... WHERE server_em > since ORDER BY server_em LIMIT n+1`, em memória. */
function janela(linhas: LinhaRT[], since: string, n: number): LinhaRT[] {
  return linhas
    .filter((l) => l.serverEm > since)
    .sort((a, b) => (a.serverEm < b.serverEm ? -1 : a.serverEm > b.serverEm ? 1 : 0))
    .slice(0, n + 1)
}

/** `SELECT ... WHERE server_em = ?` (sem LIMIT), em memória. */
function grupo(linhas: LinhaRT[], serverEm: string): LinhaRT[] {
  return linhas.filter((l) => l.serverEm === serverEm)
}

/**
 * Uma rodada de GET /api/sync: as três queries paginadas, paginarPull, e —
 * para cada entidade que voltou em `gruposIncompletos` — a rebusca do grupo
 * inteiro do cursor. É o mesmo desenho de worker/index.ts.
 */
function rodadaDePull(banco: BancoRT, since: string, n: number) {
  const paginado = paginarPull(
    {
      progresso: janela(banco.progresso, since, n),
      anotacoes: janela(banco.anotacoes, since, n),
      destaques: janela(banco.destaques, since, n),
      posicoes: janela(banco.posicoes, since, n),
      jornadas: janela(banco.jornadas, since, n),
    },
    n,
  )
  const entregue: BancoRT = {
    progresso: paginado.progresso,
    anotacoes: paginado.anotacoes,
    destaques: paginado.destaques,
    posicoes: paginado.posicoes,
    jornadas: paginado.jornadas,
  }
  for (const nome of paginado.gruposIncompletos) {
    entregue[nome] = grupo(banco[nome], paginado.cursor as string)
  }
  // `agora` do servidor no caminho sem truncamento: posterior a tudo.
  return { ...entregue, cursor: paginado.cursor ?? '9999-12-31T23:59:59.999Z', maisDados: paginado.maisDados }
}

/** Roda o loop de páginas do cliente até o fim e devolve tudo o que chegou. */
function pullCompleto(banco: BancoRT, n: number): BancoRT {
  const entregues: BancoRT = { progresso: [], anotacoes: [], destaques: [], posicoes: [], jornadas: [] }
  let since = ''
  for (let pagina = 0; pagina < 200; pagina++) {
    const res = rodadaDePull(banco, since, n)
    for (const nome of ENTIDADES_RT) entregues[nome].push(...res[nome])
    expect(res.cursor > since).toBe(true) // o cursor SEMPRE avança — nunca trava
    since = res.cursor
    if (!res.maisDados) return entregues
  }
  throw new Error('o pull não convergiu em 200 páginas')
}

/** Cobra a invariante: cada linha do banco entregue exatamente uma vez. */
function esperaEntregaExata(banco: BancoRT, n: number) {
  const entregues = pullCompleto(banco, n)
  for (const nome of ENTIDADES_RT) {
    expect(entregues[nome].map((l) => l.v).sort((a, b) => a - b)).toEqual(
      banco[nome].map((l) => l.v).sort((a, b) => a - b),
    )
  }
}

function serie(inicio: number, quantidade: number, serverEm: string): LinhaRT[] {
  return Array.from({ length: quantidade }, (_, i) => ({ serverEm, v: inicio + i }))
}

describe('paginarPull — ida e volta sobre o conjunto inteiro', () => {
  it('grupo de mesmo server_em maior que a janela: entrega o grupo INTEIRO, não só a janela', () => {
    // 25 linhas num único server_em, página de 10 → a janela busca 11. Sem
    // fechar o grupo, o cursor avança para T tendo entregue 11 linhas, e as
    // outras 14 nunca mais são consultadas (a próxima query é server_em > T).
    const banco: BancoRT = {
      progresso: [],
      anotacoes: [],
      destaques: serie(1, 25, '2026-01-01T00:00:05.000Z'),
      posicoes: [],
      jornadas: [],
    }
    esperaEntregaExata(banco, 10)
    expect(pullCompleto(banco, 10).destaques).toHaveLength(25)
  })

  it('mesmo cenário, agora em jornadas: fecharGrupo cobre jornadas, não só destaques/posições', () => {
    // Idêntico ao teste acima, mas a entidade que estoura em grupo gigante é
    // jornadas — cobre o ramo `entidade === 'jornadas'` do laço de
    // gruposIncompletos em worker/index.ts (aqui simulado por rodadaDePull),
    // que antes desta rodada de correção era só o `else` catch-all.
    const banco: BancoRT = {
      progresso: [],
      anotacoes: [],
      destaques: [],
      posicoes: [],
      jornadas: serie(1, 25, '2026-01-01T00:00:05.000Z'),
    }
    esperaEntregaExata(banco, 10)
    expect(pullCompleto(banco, 10).jornadas).toHaveLength(25)
  })

  it('grupo gigante entre grupos normais: nem o grupo nem os vizinhos se perdem', () => {
    const banco: BancoRT = {
      progresso: [],
      anotacoes: [],
      destaques: [
        ...serie(1, 4, '2026-01-01T00:00:01.000Z'),
        ...serie(100, 25, '2026-01-01T00:00:02.000Z'), // maior que a página inteira
        ...serie(200, 7, '2026-01-01T00:00:03.000Z'),
      ],
      posicoes: [],
      jornadas: [],
    }
    esperaEntregaExata(banco, 10)
  })

  it('três entidades com grupos de tamanhos diferentes: ninguém fica pra trás', () => {
    const banco: BancoRT = {
      progresso: [
        ...serie(1, 3, '2026-01-01T00:00:01.000Z'),
        ...serie(10, 12, '2026-01-01T00:00:04.000Z'), // estoura n=5 sozinho
        ...serie(30, 2, '2026-01-01T00:00:09.000Z'),
      ],
      anotacoes: [
        ...serie(50, 6, '2026-01-01T00:00:02.000Z'),
        ...serie(60, 6, '2026-01-01T00:00:05.000Z'),
        ...serie(70, 1, '2026-01-01T00:00:08.000Z'),
      ],
      destaques: [
        ...serie(80, 1, '2026-01-01T00:00:03.000Z'),
        ...serie(90, 20, '2026-01-01T00:00:06.000Z'),
        ...serie(120, 4, '2026-01-01T00:00:07.000Z'),
      ],
      posicoes: [
        ...serie(200, 2, '2026-01-01T00:00:01.500Z'),
        ...serie(210, 9, '2026-01-01T00:00:04.500Z'), // estoura n=5 sozinho
      ],
      jornadas: [],
    }
    esperaEntregaExata(banco, 5)
  })

  it('duas entidades empatando TODAS no mesmo server_em: os dois grupos são fechados', () => {
    const T = '2026-01-01T00:00:05.000Z'
    const banco: BancoRT = {
      progresso: serie(1, 9, T),
      anotacoes: [],
      destaques: serie(100, 14, T),
      posicoes: [],
      jornadas: [],
    }
    esperaEntregaExata(banco, 3)
  })

  it('caminho comum (tudo cabe numa página) continua entregando tudo de uma vez', () => {
    const banco: BancoRT = {
      progresso: serie(1, 3, '2026-01-01T00:00:01.000Z'),
      anotacoes: serie(10, 2, '2026-01-01T00:00:02.000Z'),
      destaques: serie(20, 4, '2026-01-01T00:00:03.000Z'),
      posicoes: serie(30, 2, '2026-01-01T00:00:04.000Z'),
      jornadas: serie(40, 2, '2026-01-01T00:00:05.000Z'),
    }
    const entregues = pullCompleto(banco, 100)
    expect(entregues).toEqual(banco)
  })
})

describe('validProgresso: historico e paraReler', () => {
  const base = { pericopeOrdem: 1, status: 'concluido', atualizadoEm: '2026-08-31T10:00:00.000Z' }

  it('aceita o corpo ANTIGO, sem os campos novos', () => {
    // Um service worker em cache continua sincronizando.
    expect(parseSyncPush({ progresso: [base] })?.progresso).toHaveLength(1)
  })

  it('aceita historico e paraReler válidos', () => {
    const r = parseSyncPush({
      progresso: [{ ...base, historico: ['2026-08-31T10:00:00.000Z'], paraReler: true }],
    })
    expect(r?.progresso[0].historico).toEqual(['2026-08-31T10:00:00.000Z'])
    expect(r?.progresso[0].paraReler).toBe(true)
  })

  it('rejeita data não canônica no histórico', () => {
    expect(parseSyncPush({ progresso: [{ ...base, historico: ['2026-08-31'] }] })).toBeNull()
  })

  it('rejeita histórico acima do teto', () => {
    const grande = Array.from({ length: 51 }, (_, i) =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    )
    expect(parseSyncPush({ progresso: [{ ...base, historico: grande }] })).toBeNull()
  })

  it('rejeita histórico que não é array e paraReler que não é boolean', () => {
    expect(parseSyncPush({ progresso: [{ ...base, historico: 'x' }] })).toBeNull()
    expect(parseSyncPush({ progresso: [{ ...base, paraReler: 1 }] })).toBeNull()
  })
})
