import { describe, expect, it } from 'vitest'
import { computeStreak, diaLocal, diasComConclusao } from './streak'
import type { Progresso } from './types'

/** ISO como o `setProgresso` grava, ancorado numa hora LOCAL escolhida. */
function iso(y: number, m: number, d: number, hora = 12): string {
  return new Date(y, m - 1, d, hora).toISOString()
}

function concluida(ordem: number, quando: string): Progresso {
  return { pericopeOrdem: ordem, status: 'concluido', historico: [quando], paraReler: false, atualizadoEm: quando }
}

describe('diaLocal', () => {
  it('formata YYYY-MM-DD com zero à esquerda', () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(diaLocal(new Date(2026, 10, 30))).toBe('2026-11-30')
  })

  it('usa o dia do calendário local, não o UTC', () => {
    // 23h30 local já é o dia seguinte em boa parte dos fusos a leste; o streak
    // é do leitor, então continua sendo dia 10.
    expect(diaLocal(new Date(2026, 2, 10, 23, 30))).toBe('2026-03-10')
  })
})

describe('diasComConclusao', () => {
  it('só conta registros concluídos', () => {
    const dias = diasComConclusao([
      concluida(1, iso(2026, 8, 30)),
      { pericopeOrdem: 2, status: 'em_andamento', historico: [], paraReler: false, atualizadoEm: iso(2026, 8, 29) },
      { pericopeOrdem: 3, status: 'nao_iniciado', historico: [], paraReler: false, atualizadoEm: iso(2026, 8, 28) },
    ])
    expect([...dias]).toEqual(['2026-08-30'])
  })

  it('várias perícopes no mesmo dia viram um dia só', () => {
    const dias = diasComConclusao([
      concluida(1, iso(2026, 8, 30, 7)),
      concluida(2, iso(2026, 8, 30, 22)),
      concluida(3, iso(2026, 8, 31, 9)),
    ])
    expect(dias.size).toBe(2)
    expect(dias.has('2026-08-30')).toBe(true)
    expect(dias.has('2026-08-31')).toBe(true)
  })

  it('datas inválidas são ignoradas', () => {
    expect(diasComConclusao([concluida(1, 'ontem à noite'), concluida(2, '')]).size).toBe(0)
  })

  it('lista vazia devolve conjunto vazio', () => {
    expect(diasComConclusao([]).size).toBe(0)
  })

  it('conta TODAS as datas do histórico, não só a última', () => {
    const dias = diasComConclusao([
      {
        pericopeOrdem: 1,
        status: 'concluido',
        historico: [iso(2026, 8, 30), iso(2026, 3, 2)],
        paraReler: false,
        atualizadoEm: iso(2026, 8, 30),
      },
    ])
    expect([...dias].sort()).toEqual(['2026-03-02', '2026-08-30'])
  })

  it('desmarcar NÃO apaga o dia: o histórico sobrevive ao status', () => {
    // A garantia que sustenta "zerar não zera o seu recorde".
    const dias = diasComConclusao([
      {
        pericopeOrdem: 1,
        status: 'nao_iniciado',
        historico: [iso(2026, 8, 30)],
        paraReler: false,
        atualizadoEm: iso(2026, 9, 3),
      },
    ])
    expect([...dias]).toEqual(['2026-08-30'])
  })
})

describe('computeStreak', () => {
  const HOJE = new Date(2026, 8, 1)

  it('sem dias, tudo zero', () => {
    expect(computeStreak(new Set(), HOJE)).toEqual({ atual: 0, recorde: 0 })
  })

  it('sequência terminando hoje conta até hoje', () => {
    const dias = new Set(['2026-08-30', '2026-08-31', '2026-09-01'])
    expect(computeStreak(dias, HOJE)).toEqual({ atual: 3, recorde: 3 })
  })

  it('sequência terminando ontem se mantém', () => {
    // Ainda dá tempo de ler hoje: virar a meia-noite não quebra o streak.
    expect(computeStreak(new Set(['2026-08-30', '2026-08-31']), HOJE)).toEqual({
      atual: 2,
      recorde: 2,
    })
  })

  it('pular um dia inteiro zera o atual e preserva o recorde', () => {
    const dias = new Set(['2026-08-28', '2026-08-29', '2026-08-30'])
    expect(computeStreak(dias, HOJE)).toEqual({ atual: 0, recorde: 3 })
  })

  it('recorde maior que a sequência atual aparece separado', () => {
    const dias = new Set([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-08-31',
      '2026-09-01',
    ])
    expect(computeStreak(dias, HOJE)).toEqual({ atual: 2, recorde: 5 })
  })

  it('um único dia hoje vale 1 e 1', () => {
    expect(computeStreak(new Set(['2026-09-01']), HOJE)).toEqual({ atual: 1, recorde: 1 })
  })

  it('a sequência atravessa a virada do mês', () => {
    expect(computeStreak(new Set(['2026-08-31', '2026-09-01']), HOJE)).toEqual({
      atual: 2,
      recorde: 2,
    })
  })
})
