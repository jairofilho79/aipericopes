import { describe, expect, it } from 'vitest'
import { textoSobrescrito } from './sobrescrito'

describe('textoSobrescrito', () => {
  it('fecha com ponto o sobrescrito cru do catálogo', () => {
    expect(textoSobrescrito('Salmo de Davi, para o regente')).toBe('Salmo de Davi, para o regente.')
  })

  it('não dobra o ponto se já terminar em pontuação de frase', () => {
    expect(textoSobrescrito('Cântico dos degraus.')).toBe('Cântico dos degraus.')
    expect(textoSobrescrito('E agora?')).toBe('E agora?')
  })
})
