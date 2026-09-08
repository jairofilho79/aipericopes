// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { CONTEXTO_KEY, getContextoAberto, setContextoAberto } from './contexto-collapse'
import { installLocalStorageMock } from './testing/storage-mock'

installLocalStorageMock()

describe('contexto-collapse', () => {
  beforeEach(() => localStorage.clear())

  it('sem escolha gravada, o contexto vem ABERTO', () => {
    expect(getContextoAberto()).toBe(true)
  })

  it('colapsar e reabrir persiste a escolha', () => {
    setContextoAberto(false)
    expect(getContextoAberto()).toBe(false)
    setContextoAberto(true)
    expect(getContextoAberto()).toBe(true)
  })

  it('grava exatamente "1" e "0"', () => {
    setContextoAberto(true)
    expect(localStorage.getItem(CONTEXTO_KEY)).toBe('1')
    setContextoAberto(false)
    expect(localStorage.getItem(CONTEXTO_KEY)).toBe('0')
  })

  it('valor estranho no storage cai no padrão aberto', () => {
    localStorage.setItem(CONTEXTO_KEY, 'talvez')
    expect(getContextoAberto()).toBe(true)
  })

  it('a escolha é global, não por perícope', () => {
    setContextoAberto(false)
    expect(getContextoAberto()).toBe(false)
    expect(getContextoAberto()).toBe(false)
  })
})
