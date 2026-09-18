import { describe, expect, it } from 'vitest'
import {
  avisosCriacao,
  cursorDaJornada,
  historicoDeJornadas,
  jornadaDoTestamento,
  montarCatalogo,
  montarTrilhas,
  nomePadrao,
  patchEncerrarJornada,
  patchReiniciarJornada,
  progressoDaJornada,
  reconciliacaoDeConclusao,
  reconciliarJornadasEmLote,
  rotaCompletaDoEscopo,
  rotaDaJornada,
  tamanhoDoEscopo,
} from './jornadas'
import type { Jornada, PericopeIndex, PosicaoLeitura, Progresso } from './types'

const ANTES = '2026-01-01T00:00:00.000Z'
const DEPOIS = '2026-06-01T00:00:00.000Z'

function peri(ordem: number, livro: string, abbrev: string, cap = 1): PericopeIndex {
  return {
    ordem,
    livro,
    abbrev,
    capitulo_inicio: cap,
    versiculo_inicio: 1,
    capitulo_fim: cap,
    versiculo_fim: 10,
    titulo_pericope_pt: `${livro} ${cap}`,
    minutos: 3,
    narrado: false,
    seq: ordem,
  }
}

/** Catálogo mínimo: 2 de Gênesis, 2 de Salmos (VT) e 2 de Mateus (NT). */
const INDICE: PericopeIndex[] = [
  peri(0, 'Gênesis', 'Gn', 1),
  peri(1, 'Gênesis', 'Gn', 2),
  peri(2, 'Salmos', 'Sl', 1),
  peri(3, 'Salmos', 'Sl', 2),
  peri(4, 'Mateus', 'Mt', 1),
  peri(5, 'Mateus', 'Mt', 2),
]

function jornada(over: Partial<Jornada> = {}): Jornada {
  return {
    id: 'j1',
    nome: 'Teste',
    tipo: 'sequencia',
    escopo: 'vt',
    inicioOrdem: 0,
    contaDesde: null,
    criadoEm: ANTES,
    atualizadoEm: ANTES,
    arquivadaEm: null,
    concluidaEm: null,
    ...over,
  }
}

function concluida(ordem: number, quando: string): [number, Progresso] {
  return [
    ordem,
    { pericopeOrdem: ordem, status: 'concluido', historico: [quando], paraReler: false, atualizadoEm: quando },
  ]
}

describe('rotaDaJornada', () => {
  it('sequencia vt pega só o VT', () => {
    expect(rotaDaJornada(jornada({ escopo: 'vt' }), INDICE)).toEqual([0, 1, 2, 3])
  })

  it('sequencia biblia pega tudo', () => {
    expect(rotaDaJornada(jornada({ escopo: 'biblia' }), INDICE)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('livro pega só o livro', () => {
    expect(rotaDaJornada(jornada({ tipo: 'livro', escopo: 'Salmos' }), INDICE)).toEqual([2, 3])
  })

  it('bloco pega os livros do bloco', () => {
    const j = jornada({ tipo: 'bloco', escopo: 'evangelhos', inicioOrdem: 4 })
    expect(rotaDaJornada(j, INDICE)).toEqual([4, 5])
  })

  it('corta no inicioOrdem, deixando fora o que veio antes', () => {
    expect(rotaDaJornada(jornada({ escopo: 'vt', inicioOrdem: 2 }), INDICE)).toEqual([2, 3])
  })

  it('inicioOrdem fora da rota degrada para o escopo inteiro, nunca para vazio', () => {
    // Acontece se o catálogo mudar debaixo de uma jornada antiga. Uma jornada
    // vazia seria pior: o leitor perderia o percurso sem entender por quê.
    expect(rotaDaJornada(jornada({ escopo: 'vt', inicioOrdem: 999 }), INDICE)).toEqual([0, 1, 2, 3])
  })
})

describe('progressoDaJornada', () => {
  it('conta e aponta a próxima não lida', () => {
    const progressos = new Map([concluida(0, DEPOIS)])
    const r = progressoDaJornada([0, 1, 2, 3], progressos, null)
    expect(r).toEqual({ total: 4, concluidas: 1, pct: 25, proximaOrdem: 1 })
  })

  it('modo reler ignora conclusões anteriores à âncora', () => {
    const progressos = new Map([concluida(0, ANTES), concluida(1, ANTES)])
    const r = progressoDaJornada([0, 1, 2, 3], progressos, DEPOIS)
    expect(r.concluidas).toBe(0)
    // O ponto: barra em 0 E cursor no início. Se divergissem, a jornada se
    // contradiria na mesma tela.
    expect(r.proximaOrdem).toBe(0)
  })

  it('rota inteira lida devolve proximaOrdem null', () => {
    const progressos = new Map([concluida(0, DEPOIS), concluida(1, DEPOIS)])
    const r = progressoDaJornada([0, 1], progressos, null)
    expect(r).toEqual({ total: 2, concluidas: 2, pct: 100, proximaOrdem: null })
  })

  it('rota vazia não divide por zero', () => {
    expect(progressoDaJornada([], new Map(), null)).toEqual({
      total: 0,
      concluidas: 0,
      pct: 0,
      proximaOrdem: null,
    })
  })
})

describe('cursorDaJornada', () => {
  const posicao = (ordem: number, quando: string): [number, PosicaoLeitura] => [
    ordem,
    { pericopeOrdem: ordem, tipo: 'versiculo', ref: '1:1', tempo: null, atualizadoEm: quando },
  ]

  it('prefere o checkpoint da proximaOrdem à primeira não concluída sem checkpoint', () => {
    // O leitor parou no meio da perícope 1 (a próxima não-lida) — o cursor
    // deve voltar para ela, não para a seguinte.
    const progressos = new Map([concluida(0, DEPOIS)])
    const posicoes = new Map([posicao(1, DEPOIS)])
    expect(cursorDaJornada([0, 1, 2, 3], progressos, posicoes, null)).toBe(1)
  })

  it('ignora checkpoint de perícope que vem DEPOIS da proximaOrdem na rota (bug do Explorar)', () => {
    // O leitor está na perícope 1 (próxima não-lida). Foi no Explorar e abriu
    // a 2 ou 3 sem concluir — o cursor não deve pular à frente da jornada.
    const progressos = new Map([concluida(0, DEPOIS)])
    const posicoes = new Map([posicao(2, DEPOIS)])
    expect(cursorDaJornada([0, 1, 2, 3], progressos, posicoes, null)).toBe(1)
  })

  it('checkpoint de perícope já lida (antes da proximaOrdem) é ignorado', () => {
    // A 0 está concluída e tem checkpoint: não deve voltar para ela.
    const progressos = new Map([concluida(0, DEPOIS)])
    const posicoes = new Map([posicao(0, DEPOIS)])
    expect(cursorDaJornada([0, 1, 2, 3], progressos, posicoes, null)).toBe(1)
  })

  it('ignora checkpoint de perícope que já conta como lida', () => {
    const progressos = new Map([concluida(0, DEPOIS), concluida(2, DEPOIS)])
    const posicoes = new Map([posicao(2, DEPOIS)])
    expect(cursorDaJornada([0, 1, 2, 3], progressos, posicoes, null)).toBe(1)
  })

  it('em modo reler, ignora checkpoint anterior à âncora', () => {
    // Senão a jornada de releitura devolveria o leitor no meio da passada
    // anterior — exatamente o que ela existe para não fazer.
    const posicoes = new Map([posicao(2, ANTES)])
    expect(cursorDaJornada([0, 1, 2, 3], new Map(), posicoes, DEPOIS)).toBe(0)
  })

  it('devolve null quando a rota acabou', () => {
    const progressos = new Map([concluida(0, DEPOIS), concluida(1, DEPOIS)])
    expect(cursorDaJornada([0, 1], progressos, new Map(), null)).toBeNull()
  })
})

describe('reconciliacaoDeConclusao', () => {
  const AGORA = '2026-07-01T00:00:00.000Z'

  it('rota acabou e concluidaEm era null → grava a conclusão', () => {
    expect(reconciliacaoDeConclusao({ concluidaEm: null }, null, AGORA)).toEqual({
      concluidaEm: AGORA,
    })
  })

  it('rota acabou e já estava concluída → nada a fazer', () => {
    expect(reconciliacaoDeConclusao({ concluidaEm: ANTES }, null, AGORA)).toBeNull()
  })

  it('rota NÃO acabou mas concluidaEm não é null → LIMPA (reabre)', () => {
    // Este é o caso que ficou morto no ciclo 1: getJornadaAtiva() excluía
    // concluidaEm !== null do filtro, então nenhuma jornada chegava aqui
    // com proximaOrdem não-nulo e concluidaEm preenchido ao mesmo tempo.
    // Com getJornadaCorrente() (sem esse filtro), este ramo é alcançável de
    // verdade — outra frente do app desmarcou uma perícope da rota.
    expect(reconciliacaoDeConclusao({ concluidaEm: ANTES }, 3, AGORA)).toEqual({
      concluidaEm: null,
    })
  })

  it('rota não acabou e nunca esteve concluída → nada a fazer', () => {
    expect(reconciliacaoDeConclusao({ concluidaEm: null }, 3, AGORA)).toBeNull()
  })
})

describe('nomePadrao', () => {
  it('usa o nome do livro, do bloco ou do testamento', () => {
    expect(nomePadrao('livro', 'Salmos', 2, INDICE)).toBe('Salmos')
    expect(nomePadrao('bloco', 'evangelhos', 4, INDICE)).toBe('Evangelhos')
    expect(nomePadrao('sequencia', 'nt', 4, INDICE)).toBe('Novo Testamento')
    expect(nomePadrao('sequencia', 'biblia', 0, INDICE)).toBe('A Bíblia toda')
  })

  it('acrescenta "a partir de" quando não começa no início da rota', () => {
    expect(nomePadrao('sequencia', 'vt', 2, INDICE)).toBe('Velho Testamento a partir de Salmos 1:1–1:10')
  })
})

// Task 7: tela de gestão da jornada (/jornada) — patches das duas ações e a
// separação entre a jornada corrente e o histórico.
describe('patchReiniciarJornada', () => {
  it('zera contaDesde a partir de agora e limpa concluidaEm', () => {
    expect(patchReiniciarJornada(DEPOIS)).toEqual({ contaDesde: DEPOIS, concluidaEm: null })
  })
})

describe('patchEncerrarJornada', () => {
  it('arquiva a partir de agora', () => {
    expect(patchEncerrarJornada(DEPOIS)).toEqual({ arquivadaEm: DEPOIS })
  })
})

describe('historicoDeJornadas', () => {
  it('só entram as arquivadas', () => {
    const arquivada = jornada({ id: 'a', arquivadaEm: DEPOIS })
    const corrente = jornada({ id: 'c', arquivadaEm: null })
    expect(historicoDeJornadas([arquivada, corrente])).toEqual([arquivada])
  })

  it('a jornada corrente CONCLUÍDA não entra no histórico', () => {
    // O caso que o texto original do brief ("arquivadaEm || concluidaEm")
    // erraria: a jornada corrente concluída tem concluidaEm preenchido e
    // arquivadaEm === null (ver getJornadaCorrente em user-db.ts) — ela
    // apareceria duplicada, no card principal E na lista quieta.
    const correnteConcluida = jornada({ id: 'c', arquivadaEm: null, concluidaEm: DEPOIS })
    expect(historicoDeJornadas([correnteConcluida])).toEqual([])
  })

  it('rota vazia (nenhuma jornada) devolve histórico vazio', () => {
    expect(historicoDeJornadas([])).toEqual([])
  })
})

// Task 8: catálogo de escopos e fluxo de criação (/jornada, passos 1 e 2).
describe('rotaCompletaDoEscopo', () => {
  it('devolve a rota inteira, sem cortar em lugar nenhum', () => {
    expect(rotaCompletaDoEscopo('sequencia', 'vt', INDICE)).toEqual([0, 1, 2, 3])
    expect(rotaCompletaDoEscopo('livro', 'Salmos', INDICE)).toEqual([2, 3])
  })
})

describe('tamanhoDoEscopo', () => {
  it('soma perícopes e minutos, em minutos abaixo de 1h', () => {
    // As duas de Gênesis do fixture têm 3 min cada — 6 min ao todo.
    expect(tamanhoDoEscopo(INDICE.slice(0, 2))).toMatchObject({
      total: 2,
      duracao: '~6 min',
      duracaoLeitura: '~6 min',
    })
  })

  it('vira horas arredondadas a partir de 1h', () => {
    const longa: PericopeIndex[] = [peri(0, 'X', 'X'), peri(1, 'X', 'X')].map((p, i) => ({
      ...p,
      minutos: i === 0 ? 40 : 50, // 90 min → 1h30, arredonda para 2h
      seq: i,
    }))
    expect(tamanhoDoEscopo(longa)).toMatchObject({
      total: 2,
      duracao: '~2 h',
      duracaoLeitura: '~2 h',
    })
  })

  it('escopo vazio não quebra: 0 perícopes, 0 min', () => {
    expect(tamanhoDoEscopo([])).toMatchObject({
      total: 0,
      duracao: '~0 min',
      duracaoLeitura: '~0 min',
      duracaoAudio: '~0 min',
    })
  })
})

describe('montarCatalogo', () => {
  const catalogo = montarCatalogo(INDICE)

  it('tem os quatro grupos, com a cardinalidade da escada', () => {
    // 66 livros e 8 blocos vêm de BIBLE_BOOKS/BLOCOS — o catálogo real, não
    // do índice de 6 perícopes do fixture, que só preenche o tamanho.
    expect(catalogo.curta).toHaveLength(66)
    expect(catalogo.media).toHaveLength(8)
    expect(catalogo.longa).toHaveLength(2)
    expect(catalogo.inteira).toHaveLength(1)
  })

  it('o card de um livro do fixture tem o tamanho certo', () => {
    const genesis = catalogo.curta.find((i) => i.escopo === 'Gênesis')
    expect(genesis).toMatchObject({
      tipo: 'livro',
      escopo: 'Gênesis',
      nome: 'Gênesis',
      total: 2,
      duracao: '~6 min',
      duracaoLeitura: '~6 min',
    })
  })

  it('um livro sem nenhuma perícope no fixture aparece com tamanho zero — nunca some do catálogo', () => {
    const juizes = catalogo.curta.find((i) => i.escopo === 'Juízes')
    expect(juizes).toMatchObject({
      tipo: 'livro',
      escopo: 'Juízes',
      nome: 'Juízes',
      total: 0,
      duracao: '~0 min',
      duracaoLeitura: '~0 min',
    })
  })

  it('o bloco pega as duas perícopes de Gênesis (Pentateuco)', () => {
    const pentateuco = catalogo.media.find((i) => i.escopo === 'pentateuco')
    expect(pentateuco).toMatchObject({
      tipo: 'bloco',
      escopo: 'pentateuco',
      nome: 'Pentateuco',
      total: 2,
      duracao: '~6 min',
    })
  })

  it('as sequências contam VT (4) e Bíblia (6)', () => {
    const vt = catalogo.longa.find((i) => i.escopo === 'vt')
    expect(vt).toMatchObject({
      tipo: 'sequencia',
      escopo: 'vt',
      nome: 'Velho Testamento',
      total: 4,
      duracao: '~12 min',
    })

    const tudo = catalogo.inteira[0]
    expect(tudo).toMatchObject({
      tipo: 'sequencia',
      escopo: 'biblia',
      nome: 'A Bíblia toda',
      total: 6,
      duracao: '~18 min',
    })
  })
})

describe('avisosCriacao', () => {
  const rotaGenesis = [0, 1]

  it('arquivaAtual é sempre false pois criação não arquiva jornadas existentes', () => {
    expect(avisosCriacao(null, 'continuar', rotaGenesis, new Map())).toEqual({
      arquivaAtual: false,
      escopoJaLido: false,
    })
    expect(avisosCriacao(jornada({ id: 'c' }), 'continuar', rotaGenesis, new Map())).toEqual({
      arquivaAtual: false,
      escopoJaLido: false,
    })
  })

  it('modo Continuar com o escopo já todo lido: avisa que a jornada nasceria concluída', () => {
    const progressos = new Map([concluida(0, DEPOIS), concluida(1, DEPOIS)])
    expect(avisosCriacao(null, 'continuar', rotaGenesis, progressos)).toEqual({
      arquivaAtual: false,
      escopoJaLido: true,
    })
  })

  it('modo Reler com o escopo já todo lido: SEM aviso — Reler sempre começa do zero', () => {
    const progressos = new Map([concluida(0, DEPOIS), concluida(1, DEPOIS)])
    expect(avisosCriacao(null, 'reler', rotaGenesis, progressos).escopoJaLido).toBe(false)
  })

  it('modo Continuar com o escopo parcialmente lido: sem aviso', () => {
    const progressos = new Map([concluida(0, DEPOIS)])
    expect(avisosCriacao(null, 'continuar', rotaGenesis, progressos).escopoJaLido).toBe(false)
  })

  it('com jornada existente e escopo lido: escopoJaLido true e arquivaAtual false', () => {
    const progressos = new Map([concluida(0, DEPOIS), concluida(1, DEPOIS)])
    expect(avisosCriacao(jornada({ id: 'c' }), 'continuar', rotaGenesis, progressos)).toEqual({
      arquivaAtual: false,
      escopoJaLido: true,
    })
  })
})

describe('reconciliarJornadasEmLote', () => {
  it('reconcilia conclusões e reaberturas para múltiplas jornadas de forma pura', () => {
    const jConcluida: Jornada = {
      id: 'j1',
      nome: 'J1',
      tipo: 'livro',
      escopo: 'Gênesis',
      inicioOrdem: 0,
      contaDesde: null,
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '',
      arquivadaEm: null,
      concluidaEm: null, // precisa marcar concluida
    }
    const jIncompleta: Jornada = {
      id: 'j2',
      nome: 'J2',
      tipo: 'livro',
      escopo: 'Salmos',
      inicioOrdem: 2,
      contaDesde: null,
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '',
      arquivadaEm: null,
      concluidaEm: '2026-01-02T00:00:00.000Z', // foi desmarcada, precisa reabrir
    }
    const jArquivada: Jornada = {
      id: 'j3',
      nome: 'J3',
      tipo: 'livro',
      escopo: 'Gênesis',
      inicioOrdem: 0,
      contaDesde: null,
      criadoEm: '2026-01-01T00:00:00.000Z',
      atualizadoEm: '',
      arquivadaEm: '2026-01-02T00:00:00.000Z', // arquivada: deve ser ignorada
      concluidaEm: null,
    }

    const progressos = new Map<number, Progresso>([
      concluida(0, DEPOIS),
      concluida(1, DEPOIS),
      // Salmos (ordens 2 e 3) não estão concluídos
    ])

    const patches = reconciliarJornadasEmLote(
      [jConcluida, jIncompleta, jArquivada],
      INDICE,
      progressos,
      '2026-09-11T00:00:00.000Z',
    )
    expect(patches).toEqual([
      { id: 'j1', patch: { concluidaEm: '2026-09-11T00:00:00.000Z' } },
      { id: 'j2', patch: { concluidaEm: null } },
    ])
  })
})

// Movidos de src/pages/Home.test.ts (Correção 2 da revisão final): as duas
// funções (jornadaDoTestamento, montarTrilhas) agora vivem em jornadas.ts,
// junto do resto da lógica pura de jornada — Home.tsx as exportava por
// engano, gerando dois avisos react/only-export-components.
//
// Índice local (3 de Gênesis, 2 de Mateus), diferente do INDICE do topo
// deste arquivo, porque os valores esperados abaixo (total: 3 no VT, ordens
// específicas) foram escritos em cima dele originalmente.
function periTrilha(ordem: number, livro: string, abbrev: string, cap = 1): PericopeIndex {
  return {
    ordem,
    livro,
    abbrev,
    capitulo_inicio: cap,
    versiculo_inicio: 1,
    capitulo_fim: cap,
    versiculo_fim: 10,
    titulo_pericope_pt: `${livro} ${cap}`,
    minutos: 3,
    narrado: false,
    seq: ordem,
  }
}

/** 3 de Gênesis (VT), 2 de Mateus (NT). */
const INDICE_TRILHAS: PericopeIndex[] = [
  periTrilha(0, 'Gênesis', 'Gn', 1),
  periTrilha(1, 'Gênesis', 'Gn', 2),
  periTrilha(2, 'Gênesis', 'Gn', 3),
  periTrilha(3, 'Mateus', 'Mt', 1),
  periTrilha(4, 'Mateus', 'Mt', 2),
]

function concluidaTrilha(ordem: number, quando: string): [number, Progresso] {
  return [
    ordem,
    { pericopeOrdem: ordem, status: 'concluido', historico: [quando], paraReler: false, atualizadoEm: quando },
  ]
}

function posicaoTrilha(ordem: number, ref: string, quando: string): [number, PosicaoLeitura] {
  return [ordem, { pericopeOrdem: ordem, tipo: 'versiculo', ref, tempo: null, atualizadoEm: quando }]
}

describe('jornadaDoTestamento', () => {
  it('monta uma jornada sintética sequencia/vt|nt nunca gravada', () => {
    const j = jornadaDoTestamento('vt', 0)
    expect(j.tipo).toBe('sequencia')
    expect(j.escopo).toBe('vt')
    expect(j.inicioOrdem).toBe(0)
    expect(j.contaDesde).toBeNull()
    // "nunca gravada": id vazio, não um crypto.randomUUID() de verdade —
    // não pode ser confundida com uma jornada real por engano em nenhum
    // comparador por id.
    expect(j.id).toBe('')
  })
})

describe('montarTrilhas', () => {
  it('conta "N de M" nas duas trilhas, sem nada concluído', () => {
    const tracks = montarTrilhas(INDICE_TRILHAS, new Map(), new Map())
    expect(tracks).toHaveLength(2)
    const vt = tracks.find((t) => t.testament === 'vt')
    const nt = tracks.find((t) => t.testament === 'nt')
    expect(vt?.prog).toEqual({ total: 3, concluidas: 0, pct: 0, proximaOrdem: 0 })
    expect(vt?.peri.ordem).toBe(0)
    expect(nt?.prog).toEqual({ total: 2, concluidas: 0, pct: 0, proximaOrdem: 3 })
    expect(nt?.peri.ordem).toBe(3)
  })

  it('conta as concluídas de cada trilha independentemente', () => {
    const progressos = new Map([
      concluidaTrilha(0, '2026-01-01T00:00:00.000Z'),
      concluidaTrilha(1, '2026-01-01T00:00:00.000Z'),
    ])
    const tracks = montarTrilhas(INDICE_TRILHAS, progressos, new Map())
    const vt = tracks.find((t) => t.testament === 'vt')
    const nt = tracks.find((t) => t.testament === 'nt')
    expect(vt?.prog).toEqual({ total: 3, concluidas: 2, pct: 67, proximaOrdem: 2 })
    // NT não tem nada concluído: as duas trilhas não podem vazar contagem
    // uma para a outra.
    expect(nt?.prog).toEqual({ total: 2, concluidas: 0, pct: 0, proximaOrdem: 3 })
  })

  it('fallback do cursor quando a rota terminou: aponta para a última ordem, não null', () => {
    // Trilha VT inteira concluída → cursorDaJornada devolve null (não há
    // "próxima ordem"); a Home usa então a última ordem da rota para o botão
    // "Rever" — o mesmo destino que a heurística antiga (tudo feito devolvia
    // a última ordem da sequência).
    const quando = '2026-01-01T00:00:00.000Z'
    const progressos = new Map([
      concluidaTrilha(0, quando),
      concluidaTrilha(1, quando),
      concluidaTrilha(2, quando),
    ])
    const tracks = montarTrilhas(INDICE_TRILHAS, progressos, new Map())
    const vt = tracks.find((t) => t.testament === 'vt')
    expect(vt?.prog.proximaOrdem).toBeNull()
    expect(vt?.peri.ordem).toBe(2) // última ordem da rota VT, não a primeira
  })

  it('usa o checkpoint quando ele está na proximaOrdem (primeira não concluída)', () => {
    // O leitor parou no meio da ordem 0 (a primeira não-lida do VT) — o
    // cursor deve voltar para ela. Checkpoint de ordens ALÉM da proximaOrdem
    // (visitadas via Explorar) são ignorados: veja teste 'bug do Explorar' em
    // cursorDaJornada.
    const posicoes = new Map([posicaoTrilha(0, '1:5', '2026-01-01T00:00:00.000Z')])
    const tracks = montarTrilhas(INDICE_TRILHAS, new Map(), posicoes)
    const vt = tracks.find((t) => t.testament === 'vt')
    expect(vt?.peri.ordem).toBe(0)
  })
})
