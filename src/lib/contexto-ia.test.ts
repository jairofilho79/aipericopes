import { describe, expect, it } from 'vitest'
import { montarMaterialApoio, montarPromptPericope } from './contexto-ia'
import type { Pericope } from './types'

const PERICOPE: Pericope = {
  ordem: 1,
  seq: 1,
  livro: 'Gênesis',
  abbrev: 'Gn',
  capitulo_inicio: 1,
  versiculo_inicio: 1,
  capitulo_fim: 1,
  versiculo_fim: 5,
  titulo_pericope_pt: 'A Criação',
  texto: '1 No princípio criou Deus os céus e a terra.',
  contexto_historico_literario: 'Contexto de Gênesis.',
  resenha: 'Resenha de Gênesis.',
  perguntas_reflexao: ['O que Deus criou primeiro?'],
  minutos: 1,
  narrado: false,
}

describe('contexto-ia', () => {
  it('monta o prompt da perícope incluindo referências cruzadas quando o chip está ativo', () => {
    const prompt = montarPromptPericope(PERICOPE, {
      texto: true,
      contexto: true,
      resenha: true,
      reflexoes: true,
      referencias: true,
    })

    expect(prompt).toContain('o texto bíblico')
    expect(prompt).toContain('o contexto histórico')
    expect(prompt).toContain('a resenha explicativa')
    expect(prompt).toContain('as perguntas de reflexão')
    expect(prompt).toContain('as referências cruzadas')
  })

  it('monta o material de apoio com bloco de referências cruzadas', () => {
    const refsTexto = '1:1: Provérbios 8:23, Hebreus 1:10; Salmos 33:6'
    const material = montarMaterialApoio(
      PERICOPE,
      {
        texto: true,
        contexto: true,
        resenha: false,
        reflexoes: false,
        referencias: true,
      },
      refsTexto,
    )

    expect(material).toContain('[Texto Bíblico - Gênesis 1:1–1:5]')
    expect(material).toContain('[Contexto Histórico-Literário]')
    expect(material).not.toContain('[Resenha]')
    expect(material).toContain('[Referências Cruzadas Bíblicas]')
    expect(material).toContain(refsTexto)
  })

  it('não inclui referências no material se o chip estiver desligado ou texto vazio', () => {
    const refsTexto = '1:1: Provérbios 8:23'
    const semChip = montarMaterialApoio(
      PERICOPE,
      {
        texto: true,
        contexto: false,
        resenha: false,
        reflexoes: false,
        referencias: false,
      },
      refsTexto,
    )
    expect(semChip).not.toContain('[Referências Cruzadas Bíblicas]')

    const semTexto = montarMaterialApoio(
      PERICOPE,
      {
        texto: true,
        contexto: false,
        resenha: false,
        reflexoes: false,
        referencias: true,
      },
      '',
    )
    expect(semTexto).not.toContain('[Referências Cruzadas Bíblicas]')
  })
})
