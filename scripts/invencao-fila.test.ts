import { describe, expect, it } from 'vitest'
import { conferirAchado } from './invencao-fila.ts'
import type { Dossie } from './leitura-fila.ts'

const dossie = () =>
  ({
    ordem: 619,
    abbrev: '1Rs',
    livro: '1 Reis',
    ref: '1 Reis 2:13-25',
    texto: 'E Adonias veio a Bate-Seba.',
    titulo_pericope_pt: 'O pedido de Adonias',
    contexto_historico_literario: 'Salomão já reina.',
    resenha: 'Logo em seguida pede a mulher que dormia ao lado do rei morto.',
    perguntas_reflexao: ['Por quê?', 'E depois?'],
    topicos_pregar: '**Um** ponto',
  }) as Dossie

const acusacao = (extra = {}) => ({
  campo: 'resenha',
  afirma: 'Logo em seguida pede a mulher que dormia ao lado do rei morto.',
  forma: 'contradiz-versiculo',
  desmentido_por: '1Rs 1:4 — "mas o rei nunca a conheceu."',
  porque: 'o texto nega a intimidade',
  ...extra,
})

describe('conferirAchado', () => {
  it('aceita a acusação que cita a frase byte a byte e diz o que a desmente', () => {
    expect(conferirAchado(dossie(), { ordem: 619, invencoes: [acusacao()] })).toEqual([])
  })

  it('recusa acusação parafraseada', () => {
    // Sem isto, mandaria reescrever uma frase que ninguém localizou — e o
    // material acusado talvez nem exista.
    const p = conferirAchado(dossie(), {
      ordem: 619,
      invencoes: [acusacao({ afirma: 'pede a mulher que dormia com o rei' })],
    })
    expect(p[0]).toContain('não está em resenha')
  })

  it('recusa acusação sem o que a desmente', () => {
    const p = conferirAchado(dossie(), {
      ordem: 619,
      invencoes: [acusacao({ desmentido_por: '  ' })],
    })
    expect(p[0]).toContain('sem o que a desmente')
  })

  it('recusa forma fora da lista', () => {
    const p = conferirAchado(dossie(), { ordem: 619, invencoes: [acusacao({ forma: 'estranho' })] })
    expect(p[0]).toContain('forma inválida')
  })

  it('recusa sobra sem versículos ou sem assunto', () => {
    expect(
      conferirAchado(dossie(), { ordem: 619, sobrou: [{ assunto: 'x', porque: 'y' }] })[0],
    ).toContain('sem versículos')
    expect(
      conferirAchado(dossie(), { ordem: 619, sobrou: [{ versiculos: '2:20', porque: 'y' }] })[0],
    ).toContain('sem assunto')
  })

  it('achado limpo passa — nada encontrado é resposta boa', () => {
    expect(conferirAchado(dossie(), { ordem: 619, invencoes: [], sobrou: [] })).toEqual([])
  })
})
