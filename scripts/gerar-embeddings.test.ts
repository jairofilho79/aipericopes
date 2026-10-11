import { describe, expect, it } from 'vitest'
import {
  matryoshkaL2,
  prepararTextoBiblico,
  prepararTextoTematico,
} from './gerar-embeddings'
import type { Pericope } from '../src/lib/types'

describe('gerar-embeddings', () => {
  const pericopeMock: Pericope = {
    ordem: 1,
    seq: 0,
    livro: 'Gênesis',
    abbrev: 'gn',
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 1,
    versiculo_fim: 5,
    titulo_pericope_pt: 'A criação da luz',
    sobrescrito: 'No princípio',
    texto: '1 No princípio criou Deus os céus e a terra.',
    minutos: 2,
    narrado: false,
    contexto_historico_literario: 'Contexto do antigo oriente próximo.',
    resenha: 'Deus cria pela palavra.',
    perguntas_reflexao: ['O que a luz representa para você?'],
    topicos_pregar: '1. A palavra de Deus',
  }

  it('prepara texto bíblico com título, epígrafe e texto', () => {
    const texto = prepararTextoBiblico(pericopeMock)
    expect(texto).toContain('A criação da luz')
    expect(texto).toContain('No princípio')
    expect(texto).toContain('1 No princípio criou Deus os céus e a terra.')
  })

  it('prepara texto temático com título, contexto, resenha e reflexão', () => {
    const texto = prepararTextoTematico(pericopeMock)
    expect(texto).toContain('A criação da luz')
    expect(texto).toContain('Contexto do antigo oriente próximo.')
    expect(texto).toContain('Deus cria pela palavra.')
    expect(texto).toContain('O que a luz representa para você?')
    expect(texto).toContain('1. A palavra de Deus')
  })

  it('aplica Matryoshka Truncation e L2 Normalization corretamente', () => {
    // Vetor de teste de 768 dimensões com valores arbitrários
    const vec768 = Array.from({ length: 768 }, (_, i) => (i + 1) * 0.1)
    const dim = 256
    const truncated = matryoshkaL2(vec768, dim)

    expect(truncated).toHaveLength(dim)

    // A norma L2 do vetor unitário deve ser 1.0 (tolerância de floating point)
    const sumSq = truncated.reduce((acc, v) => acc + v * v, 0)
    const norm = Math.sqrt(sumSq)
    expect(norm).toBeCloseTo(1.0, 5)
  })
})
