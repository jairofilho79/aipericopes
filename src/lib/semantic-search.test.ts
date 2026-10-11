import { describe, expect, it } from 'vitest'
import { dotProduct } from './semantic-search'

describe('semantic-search', () => {
  it('calcula produto escalar correto em Float32Array', () => {
    const dim = 4
    const query = new Float32Array([1, 0, 0, 0])
    const matrix = new Float32Array([
      // Vetor 0
      1, 0, 0, 0,
      // Vetor 1
      0, 1, 0, 0,
      // Vetor 2
      0.5, 0.5, 0, 0,
    ])

    expect(dotProduct(query, matrix, 0, dim)).toBeCloseTo(1.0, 5)
    expect(dotProduct(query, matrix, 4, dim)).toBeCloseTo(0.0, 5)
    expect(dotProduct(query, matrix, 8, dim)).toBeCloseTo(0.5, 5)
  })

  it('respeita offsets em matrizes contíguas de 256 dimensões', () => {
    const dim = 256
    const query = new Float32Array(dim)
    query[10] = 1.0 // 1 na posição 10

    const matrix = new Float32Array(dim * 2)
    // No primeiro vetor (offset 0), posição 10 é 0.8
    matrix[10] = 0.8
    // No segundo vetor (offset 256), posição 10 é 0.3
    matrix[dim + 10] = 0.3

    expect(dotProduct(query, matrix, 0, dim)).toBeCloseTo(0.8, 5)
    expect(dotProduct(query, matrix, dim, dim)).toBeCloseTo(0.3, 5)
  })
})
