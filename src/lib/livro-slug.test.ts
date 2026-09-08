import { describe, expect, it } from 'vitest'
import { livroSlug } from './livro-slug'

describe('livroSlug', () => {
  it('tira acento, baixa a caixa e troca espaço por hífen', () => {
    expect(livroSlug('Gênesis')).toBe('genesis')
    expect(livroSlug('Êxodo')).toBe('exodo')
    expect(livroSlug('1 Samuel')).toBe('1-samuel')
    expect(livroSlug('1 Coríntios')).toBe('1-corintios')
  })

  // A razão de o slug vir do nome completo e não da abreviação: as abreviações
  // "Jó" e "Jo" colidem sem acento, e um livro sobrescreveria o outro no build.
  it('separa Jó de João', () => {
    expect(livroSlug('Jó')).toBe('jo')
    expect(livroSlug('João')).toBe('joao')
  })

  it('não deixa hífen sobrando nas pontas', () => {
    expect(livroSlug(' Atos ')).toBe('atos')
  })
})
