import { describe, expect, it } from 'vitest'
import { assinatura, pendentes } from './invencoes-pendentes.ts'

const pericope = (extra = {}) => ({
  ordem: 619,
  abbrev: '1Rs',
  capitulo_inicio: 2,
  versiculo_inicio: 13,
  titulo_pericope_pt: 'O pedido de Adonias',
  contexto_historico_literario: 'Salomão já reina.',
  resenha: 'Logo em seguida pede a mulher que dormia ao lado do rei morto.',
  perguntas_reflexao: ['Por quê?'],
  topicos_pregar: '**Um** ponto',
  ...extra,
})

const acusa = (afirma: string) => ({
  ordem: 619,
  invencoes: [
    { campo: 'resenha', afirma, forma: 'contradiz-versiculo', desmentido_por: '1Rs 1:4', porque: 'x' },
  ],
})

describe('pendentes', () => {
  it('mantém viva a acusação cuja frase ainda está no material', () => {
    const r = pendentes(
      [pericope()],
      [acusa('Logo em seguida pede a mulher que dormia ao lado do rei morto.')],
    )
    expect(r.vivas).toHaveLength(1)
    expect(r.vivas[0].ref).toBe('1Rs 2:13')
  })

  it('descarta a acusação cuja frase já foi consertada', () => {
    // A entrada da fila é uma fotografia: o auditor viu o texto velho. Sem esta
    // conferência contra o material ATUAL, eu reescreveria o que já está certo.
    const r = pendentes([pericope({ resenha: 'Logo em seguida pede Abisague.' })], [
      acusa('Logo em seguida pede a mulher que dormia ao lado do rei morto.'),
    ])
    expect(r.vivas).toHaveLength(0)
    expect(r.jaConsertadas).toBe(1)
  })

  it('conta uma vez quando dois auditores acusam a mesma frase', () => {
    const uma = acusa('Logo em seguida pede a mulher que dormia ao lado do rei morto.')
    const r = pendentes([pericope()], [uma, uma])
    expect(r.vivas).toHaveLength(1)
    expect(r.repetidas).toBe(1)
  })

  it('descarta acusação em campo que não existe', () => {
    const r = pendentes([pericope()], [{ ordem: 619, invencoes: [{ campo: 'introducao', afirma: 'x' }] }])
    expect(r.vivas).toHaveLength(0)
  })
})

describe('assinatura', () => {
  it('ignora acento, caixa e palavras curtas', () => {
    expect(assinatura('A UNÇÃO era feita em público')).toBe(assinatura('a uncao era feita em publico'))
  })

  it('separa frases que falam de coisas diferentes', () => {
    expect(assinatura('ungir era em público')).not.toBe(assinatura('coração não é sentimento'))
  })
})
