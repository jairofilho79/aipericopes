import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { concluidaDesde, concluidasDesde, contaComoLida } from './conclusao'
import { concluirProgresso, setProgresso } from './user-db'
import type { Progresso } from './types'

function linha(ordem: number, status: Progresso['status'], quando: string): Progresso {
  return {
    pericopeOrdem: ordem,
    status,
    historico: status === 'concluido' ? [quando] : [],
    paraReler: false,
    atualizadoEm: quando,
  }
}

const JAN = '2026-01-10T12:00:00.000Z'
const AGO = '2026-08-02T12:00:00.000Z'

describe('contaComoLida', () => {
  it('desde null: qualquer conclusão conta, de qualquer época', () => {
    expect(contaComoLida(linha(1, 'concluido', JAN), null)).toBe(true)
  })

  it('exige status concluido, não só a data', () => {
    // Desmarcar tira da jornada: é o que a palavra promete e é o único jeito
    // de desfazer um engano.
    expect(contaComoLida(linha(1, 'em_andamento', AGO), null)).toBe(false)
    expect(contaComoLida(linha(1, 'nao_iniciado', AGO), null)).toBe(false)
  })

  it('linha ausente nunca conta', () => {
    expect(contaComoLida(undefined, null)).toBe(false)
  })

  it('o limite é inclusivo: conclusão exatamente em `desde` conta', () => {
    expect(contaComoLida(linha(1, 'concluido', AGO), AGO)).toBe(true)
  })

  it('conclusão anterior a `desde` não conta', () => {
    expect(contaComoLida(linha(1, 'concluido', JAN), AGO)).toBe(false)
  })

  it('lê a data do histórico, não do atualizadoEm', () => {
    // Desmarcar e remarcar mexem no atualizadoEm; a jornada tem que enxergar
    // a data da CONCLUSÃO.
    const p: Progresso = {
      pericopeOrdem: 1,
      status: 'concluido',
      historico: [JAN],
      paraReler: false,
      atualizadoEm: '2026-09-03T12:00:00.000Z',
    }
    expect(contaComoLida(p, AGO)).toBe(false)
    expect(contaComoLida(p, JAN)).toBe(true)
  })
})

describe('concluidaDesde / concluidasDesde', () => {
  it('concluidaDesde lê a linha gravada', async () => {
    await concluirProgresso(9200)
    expect(await concluidaDesde(9200, null)).toBe(true)
    expect(await concluidaDesde(9201, null)).toBe(false)
  })

  it('concluidasDesde devolve só as ordens pedidas que passam no predicado', async () => {
    await concluirProgresso(9210)
    await setProgresso(9211, 'em_andamento')
    await concluirProgresso(9212)
    const r = await concluidasDesde([9210, 9211, 9212, 9213], null)
    expect([...r].sort()).toEqual([9210, 9212])
    // O Set serve às duas coisas que a jornada precisa e não podem divergir:
    // .size alimenta a barra, .has() alimenta o cursor.
    expect(r.size).toBe(2)
    expect(r.has(9211)).toBe(false)
  })

  it('concluidasDesde faz UMA leitura, não N: lista vazia devolve Set vazio', async () => {
    expect((await concluidasDesde([], null)).size).toBe(0)
  })
})
