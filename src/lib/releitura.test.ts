import { describe, expect, it } from 'vitest'
import { candidatosReler, DIAS_ESQUECIMENTO } from './releitura'
import type { Progresso } from './types'

const AGORA = new Date('2026-09-03T12:00:00.000Z')

function haDias(n: number): string {
  return new Date(AGORA.getTime() - n * 86_400_000).toISOString()
}

function lida(ordem: number, dias: number, vezes = 1, paraReler = false): Progresso {
  const historico = Array.from({ length: vezes }, (_, i) => haDias(dias + i * 400))
  return {
    pericopeOrdem: ordem,
    status: 'concluido',
    historico,
    paraReler,
    atualizadoEm: historico[0],
  }
}

describe('candidatosReler', () => {
  it('a fronteira é 365 dias: 366 entra, 364 não', () => {
    expect(DIAS_ESQUECIMENTO).toBe(365)
    const r = candidatosReler([lida(1, 366), lida(2, 364)], AGORA)
    expect(r.map((c) => c.ordem)).toEqual([1])
  })

  it('o pin entra mesmo recém-lida, e vem primeiro', () => {
    const r = candidatosReler([lida(1, 400), lida(2, 3, 1, true)], AGORA)
    expect(r.map((c) => c.ordem)).toEqual([2, 1])
  })

  it('não sugere o que não consta como lido', () => {
    const naoLida: Progresso = {
      pericopeOrdem: 9,
      status: 'nao_iniciado',
      historico: [haDias(900)],
      paraReler: false,
      atualizadoEm: haDias(1),
    }
    expect(candidatosReler([naoLida], AGORA)).toEqual([])
  })

  it('ordena da mais esquecida para a menos, desempatando por menos lida', () => {
    const r = candidatosReler([lida(1, 400, 3), lida(2, 500), lida(3, 400, 1)], AGORA)
    expect(r.map((c) => c.ordem)).toEqual([2, 3, 1])
  })

  it('reporta vezes e dias', () => {
    const [c] = candidatosReler([lida(1, 400, 2)], AGORA)
    expect(c.vezes).toBe(2)
    expect(c.dias).toBe(400)
  })
})
