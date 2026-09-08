import { describe, expect, it } from 'vitest'
import { isEmailAllowed } from './allowlist'

describe('isEmailAllowed', () => {
  it('permite qualquer e-mail quando a lista está vazia/ausente', () => {
    expect(isEmailAllowed('a@b.com', undefined)).toBe(true)
    expect(isEmailAllowed('a@b.com', '')).toBe(true)
    expect(isEmailAllowed('a@b.com', '   ')).toBe(true)
  })
  it('restringe aos listados, sem case e com espaços', () => {
    const lista = ' Jairo@Gmail.com, outro@x.com '
    expect(isEmailAllowed('jairo@gmail.com', lista)).toBe(true)
    expect(isEmailAllowed('OUTRO@X.COM', lista)).toBe(true)
    expect(isEmailAllowed('intruso@x.com', lista)).toBe(false)
  })
})
