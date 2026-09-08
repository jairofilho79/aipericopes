import { describe, expect, it } from 'vitest'
import { pontuarFrase } from './pontuar-ditado'

describe('pontuarFrase', () => {
  it('maiúscula inicial e ponto final', () => {
    expect(pontuarFrase('amém')).toBe('Amém.')
    expect(pontuarFrase('  o pastor   cuida das ovelhas ')).toBe('O pastor cuida das ovelhas.')
  })

  it('vazio devolve vazio', () => {
    expect(pontuarFrase('')).toBe('')
    expect(pontuarFrase('   ')).toBe('')
  })

  it('não duplica pontuação de fecho', () => {
    expect(pontuarFrase('Amém.')).toBe('Amém.')
    expect(pontuarFrase('glória!')).toBe('Glória!')
    expect(pontuarFrase('e então…')).toBe('E então…')
  })

  it('corrige "cê" por "se", só como palavra inteira, preservando a inicial', () => {
    expect(pontuarFrase('cê deus quiser')).toBe('Se Deus quiser.')
    expect(pontuarFrase('ele disse que cê fosse')).toBe('Ele disse que se fosse.')
    expect(pontuarFrase('Cê engana')).toBe('Se engana.')
    expect(pontuarFrase('mercê')).toBe('Mercê.')
  })

  it('capitaliza nomes sagrados, palavra inteira, sem tocar em derivados', () => {
    expect(pontuarFrase('o senhor é o meu pastor')).toBe('O Senhor é o meu pastor.')
    expect(pontuarFrase('jesus cristo e o espírito santo')).toBe('Jesus Cristo e o Espírito Santo.')
    expect(pontuarFrase('a bíblia fala de deus')).toBe('A Bíblia fala de Deus.')
    expect(pontuarFrase('deuses e senhores')).toBe('Deuses e senhores.')
    expect(pontuarFrase('bíblias')).toBe('Bíblias.')
  })

  it('pergunta quando começa com "será que" ou "por que"', () => {
    expect(pontuarFrase('será que ele volta')).toBe('Será que ele volta?')
    expect(pontuarFrase('por que deus permite isso')).toBe('Por que Deus permite isso?')
    expect(pontuarFrase('porque deus quis')).toBe('Porque Deus quis.')
  })
})
