// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { alvoDoTab } from './use-popover'

/** Popover com botões A, B, C (o do meio desabilitado quando pedido). */
function montar(desabilitarMeio = false) {
  const pop = document.createElement('div')
  const botoes = ['A', 'B', 'C'].map((t) => {
    const b = document.createElement('button')
    b.textContent = t
    pop.append(b)
    return b
  })
  if (desabilitarMeio) botoes[1].disabled = true
  document.body.append(pop)
  return { pop, botoes }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('alvoDoTab', () => {
  it('Tab no último volta ao primeiro', () => {
    const { pop, botoes } = montar()
    expect(alvoDoTab(pop, botoes[2], false)).toBe(botoes[0])
  })

  it('Shift+Tab no primeiro vai ao último', () => {
    const { pop, botoes } = montar()
    expect(alvoDoTab(pop, botoes[0], true)).toBe(botoes[2])
  })

  it('no meio, deixa o navegador seguir a ordem normal', () => {
    const { pop, botoes } = montar()
    expect(alvoDoTab(pop, botoes[1], false)).toBeNull()
    expect(alvoDoTab(pop, botoes[1], true)).toBeNull()
  })

  it('foco fora do popover com Shift+Tab entra pelo fim', () => {
    const { pop, botoes } = montar()
    const gatilho = document.createElement('button')
    document.body.append(gatilho)
    expect(alvoDoTab(pop, gatilho, true)).toBe(botoes[2])
    expect(alvoDoTab(pop, document.body, true)).toBe(botoes[2])
  })

  it('botões desabilitados não contam como extremos', () => {
    const { pop, botoes } = montar(true)
    expect(alvoDoTab(pop, botoes[2], false)).toBe(botoes[0])
    expect(alvoDoTab(pop, botoes[0], true)).toBe(botoes[2])
  })

  it('sem botões focáveis não há para onde pular', () => {
    const pop = document.createElement('div')
    document.body.append(pop)
    expect(alvoDoTab(pop, document.body, false)).toBeNull()
    expect(alvoDoTab(pop, document.body, true)).toBeNull()
  })
})
