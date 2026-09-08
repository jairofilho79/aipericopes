import { describe, expect, it } from 'vitest'

import { mostrarPrefsDeLeitura } from './perfil-secoes'

describe('mostrarPrefsDeLeitura', () => {
  it('vale na Leitura', () => {
    expect(mostrarPrefsDeLeitura('/leitura/1')).toBe(true)
    expect(mostrarPrefsDeLeitura('/leitura/842')).toBe(true)
  })

  it('não vale fora dela', () => {
    expect(mostrarPrefsDeLeitura('/')).toBe(false)
    expect(mostrarPrefsDeLeitura('/indice')).toBe(false)
    expect(mostrarPrefsDeLeitura('/pesquisar')).toBe(false)
    expect(mostrarPrefsDeLeitura('/ajustes')).toBe(false)
  })

  it('não confunde uma rota que só começa parecido', () => {
    expect(mostrarPrefsDeLeitura('/leituras-antigas')).toBe(false)
  })
})
