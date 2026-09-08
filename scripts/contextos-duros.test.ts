import { describe, it, expect } from 'vitest'
import { diagnosticar, temNomeProprio } from './contextos-duros.ts'

describe('diagnosticar', () => {
  it('acusa o parágrafo final que só manda reparar', () => {
    const c = 'Jacó atravessou o rio com a coxa machucada.\n\nRepare em duas coisas na chegada.'
    expect(diagnosticar(c).fechaApontando).toBe(true)
    expect(diagnosticar(c).duro).toBe(false)
  })

  // A regra punia a escrita certa: quem nomeia as duas coisas na mesma
  // respiração estava sendo reprovado, e um agente trocou a frase boa por uma
  // MAIS vaga para passar. Promessa paga no mesmo período não é promessa.
  it('absolve a promessa paga por travessão no mesmo período', () => {
    const c =
      'As duas coisas que se rompem no versículo 11 — as fontes do abismo e as comportas dos céus — são as águas que o segundo dia separou. O côvado media 45 centímetros.'
    expect(diagnosticar(c).promessaVaga).toBe(false)
    expect(diagnosticar(c).duro).toBe(true)
  })

  it('continua acusando a promessa que ninguém paga', () => {
    const c = 'Duas coisas ficam proibidas nela e uma é obrigatória. Guarde isso enquanto lê, no ano 3.'
    expect(diagnosticar(c).promessaVaga).toBe(true)
  })

  it('acusa o contexto sem nome próprio e sem número', () => {
    expect(diagnosticar('O trecho fala de fé e de espera diante de Deus.').semDadoDuro).toBe(true)
  })

  it('aceita nome próprio como dado duro', () => {
    expect(temNomeProprio('A cidade de Harã ficava na rota do norte.')).toBe(true)
  })

  it('não toma Deus nem Senhor por nome que ancora', () => {
    expect(temNomeProprio('E disse Deus ao Senhor que assim seria.')).toBe(false)
  })
})
