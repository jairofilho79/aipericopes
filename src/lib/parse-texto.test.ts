import { describe, expect, it } from 'vitest'
import { groupCorrido, parseTexto } from './parse-texto'

describe('groupCorrido', () => {
  it('agrupa versículos por capítulo, com rótulo', () => {
    const blocks = parseTexto('Capítulo 1\n1 No princípio\n2 A terra\nCapítulo 2\n1 Assim foram')
    const groups = groupCorrido(blocks)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ chapter: 1, label: 'Capítulo 1' })
    expect(groups[0].verses.map((v) => v.id)).toEqual(['1:1', '1:2'])
    expect(groups[1]).toMatchObject({ chapter: 2, label: 'Capítulo 2' })
    expect(groups[1].verses.map((v) => v.id)).toEqual(['2:1'])
  })

  it('versículos órfãos antes do primeiro capítulo formam grupo com label null', () => {
    const blocks = parseTexto('linha solta\nCapítulo 3\n1 Verso um')
    const groups = groupCorrido(blocks)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBeNull()
    expect(groups[0].verses).toHaveLength(1)
    expect(groups[0].verses[0].text).toBe('linha solta')
    expect(groups[1].label).toBe('Capítulo 3')
  })

  it('entrada vazia retorna []', () => {
    expect(groupCorrido([])).toEqual([])
    expect(groupCorrido(parseTexto(''))).toEqual([])
  })
})
