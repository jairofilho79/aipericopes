import { describe, expect, it } from 'vitest'
import {
  estadoDeContexto,
  jornadaDoContexto,
  origemDaReferencia,
  passosAteOrigem,
  qsDeContexto,
  urlDaOrigem,
} from './contexto-leitura'

const sp = (qs: string) => new URLSearchParams(qs)

describe('origemDaReferencia', () => {
  it('lê origem e versículo quando via=ref', () => {
    expect(origemDaReferencia(sp('via=ref&origem=12&ov=1%3A1'))).toEqual({ ordem: 12, versiculoId: '1:1' })
  })
  it('ordem 0 é válida (Gênesis 1)', () => {
    expect(origemDaReferencia(sp('via=ref&origem=0'))?.ordem).toBe(0)
  })
  it('sem via=ref, ou com origem inválida, não há origem', () => {
    expect(origemDaReferencia(sp('origem=12'))).toBeNull()
    expect(origemDaReferencia(sp('via=ref'))).toBeNull()
    expect(origemDaReferencia(sp('via=ref&origem=abc'))).toBeNull()
    expect(origemDaReferencia(sp('via=ref&origem=-3'))).toBeNull()
    expect(origemDaReferencia(sp('via=ref&origem='))).toBeNull()
  })
  it('versículo malformado é descartado, a origem fica', () => {
    expect(origemDaReferencia(sp('via=ref&origem=3&ov=xx'))).toEqual({ ordem: 3, versiculoId: null })
  })
})

describe('urlDaOrigem', () => {
  it('foca o versículo de onde saiu', () => {
    expect(urlDaOrigem({ ordem: 3, versiculoId: '1:1' })).toBe('/leitura/3?v=1%3A1')
    expect(urlDaOrigem({ ordem: 3, versiculoId: null })).toBe('/leitura/3')
  })
})

describe('qsDeContexto', () => {
  it('vazio quando não há contexto, e ignora o que não é contexto', () => {
    expect(qsDeContexto(sp(''))).toBe('')
    expect(qsDeContexto(sp('v=1:2&ouvir=1&de=outra'))).toBe('')
  })
  it('mantém jornada e mock como sempre', () => {
    expect(qsDeContexto(sp('de=jornada&jornadaId=j1&mock=1'))).toBe('de=jornada&jornadaId=j1&mock=1')
  })
  it('leva a origem da referência (e a jornada dela) adiante', () => {
    expect(qsDeContexto(sp('via=ref&origem=5&ov=2:3&jid=j9&v=8:1'))).toBe('via=ref&origem=5&ov=2%3A3&jid=j9')
  })
  it('origem inválida não é carregada', () => {
    expect(qsDeContexto(sp('via=ref&origem=zzz&jid=j9'))).toBe('')
  })
})

describe('jornadaDoContexto', () => {
  it('prefere a jornada da leitura e cai para a da origem', () => {
    expect(jornadaDoContexto(sp('jornadaId=a&jid=b'))).toBe('a')
    expect(jornadaDoContexto(sp('jid=b'))).toBe('b')
    expect(jornadaDoContexto(sp(''))).toBeNull()
  })
})

describe('histórico', () => {
  it('passosAteOrigem: negativo quando a origem está atrás', () => {
    expect(passosAteOrigem({ refOrigemIdx: 2 }, 3)).toBe(-1)
    expect(passosAteOrigem({ refOrigemIdx: 2 }, 5)).toBe(-3)
  })
  it('null quando não dá para saber ou a origem não está atrás', () => {
    expect(passosAteOrigem(null, 3)).toBeNull()
    expect(passosAteOrigem({ refOrigemIdx: 2 }, null)).toBeNull()
    expect(passosAteOrigem({ refOrigemIdx: 4 }, 3)).toBeNull()
    expect(passosAteOrigem({ refOrigemIdx: 3 }, 3)).toBeNull()
  })
  it('estadoDeContexto só leva o estado enquanto há origem', () => {
    expect(estadoDeContexto({ refOrigemIdx: 1 }, sp('via=ref&origem=5'))).toEqual({ refOrigemIdx: 1 })
    expect(estadoDeContexto({ refOrigemIdx: 1 }, sp(''))).toBeUndefined()
    expect(estadoDeContexto(null, sp('via=ref&origem=5'))).toBeUndefined()
  })
})
