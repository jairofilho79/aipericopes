import { describe, it, expect } from 'vitest'
import { montarPericope, cacheDesatualizado } from './montar-catalogo.ts'

const raw = {
  ordem: 90,
  livro: 'Êxodo',
  abbrev: 'Êx',
  capitulo_inicio: 6,
  versiculo_inicio: 28,
  capitulo_fim: 7,
  versiculo_fim: 7,
  texto: 'Capítulo 6\n28 No dia em que...\nCapítulo 7\n1 O SENHOR disse...',
  titulo_en: 'God Commands Moses and Aaron',
}

/** Cache gravado antes da correção de limites: texto e range antigos. */
const cacheVelho = {
  ordem: 90,
  livro: 'Êxodo',
  abbrev: 'Êx',
  capitulo_inicio: 7,
  versiculo_inicio: 1,
  capitulo_fim: 7,
  versiculo_fim: 7,
  texto: 'Capítulo 7\n1 O SENHOR disse...',
  titulo_pericope_pt: 'A ordem de Deus para Moisés e Arão',
  contexto_historico_literario: 'contexto escrito pela IA',
  resenha: 'resenha escrita pela IA',
  perguntas_reflexao: ['p1', 'p2'],
  topicos_pregar: '**Ponto 1**',
}

describe('montarPericope', () => {
  it('tira limites e texto do raw, nunca do cache', () => {
    const p = montarPericope(raw, cacheVelho)
    expect(p.capitulo_inicio).toBe(6)
    expect(p.versiculo_inicio).toBe(28)
    expect(p.texto).toBe(raw.texto)
  })

  it('preserva o material editorial do cache', () => {
    const p = montarPericope(raw, cacheVelho)
    expect(p.titulo_pericope_pt).toBe('A ordem de Deus para Moisés e Arão')
    expect(p.contexto_historico_literario).toBe('contexto escrito pela IA')
    expect(p.resenha).toBe('resenha escrita pela IA')
    expect(p.perguntas_reflexao).toEqual(['p1', 'p2'])
    expect(p.topicos_pregar).toBe('**Ponto 1**')
  })

  it('omite topicos_pregar quando o cache não tem', () => {
    const { topicos_pregar: _omitido, ...semTopicos } = cacheVelho
    expect(montarPericope(raw, semTopicos)).not.toHaveProperty('topicos_pregar')
  })
})

describe('cacheDesatualizado', () => {
  it('detecta limite trocado', () => {
    expect(cacheDesatualizado(raw, cacheVelho)).toBe(true)
  })

  it('detecta texto trocado mesmo com limites iguais', () => {
    const mesmoRange = { ...cacheVelho, capitulo_inicio: 6, versiculo_inicio: 28 }
    expect(cacheDesatualizado(raw, mesmoRange)).toBe(true)
  })

  it('não acusa quando cache e raw batem', () => {
    const emDia = { ...cacheVelho, capitulo_inicio: 6, versiculo_inicio: 28, texto: raw.texto }
    expect(cacheDesatualizado(raw, emDia)).toBe(false)
  })

  it('trata cache ausente como desatualizado', () => {
    expect(cacheDesatualizado(raw, null)).toBe(true)
  })
})
