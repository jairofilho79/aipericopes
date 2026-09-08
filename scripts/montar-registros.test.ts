import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { montarRegistros } from './montar-registros'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('montarRegistros', () => {
  it('produz a forma do contrato: nomes copiados e registros por slug', () => {
    const fonte = {
      nomes: { juizo: 'Juízo', consolo: 'Consolo' },
      registros: { juizo: [3, 1], consolo: [2] },
    }
    const saida = montarRegistros(fonte, [1, 2, 3])
    expect(saida).toEqual({
      nomes: { juizo: 'Juízo', consolo: 'Consolo' },
      registros: { juizo: [1, 3], consolo: [2] },
    })
  })

  it('só copia de nomes os slugs que de fato aparecem em registros', () => {
    // A fonte pode carregar rótulo de um registro extinto; o derivado não.
    const fonte = {
      nomes: { juizo: 'Juízo', obsoleto: 'Não usado' },
      registros: { juizo: [1] },
    }
    const saida = montarRegistros(fonte, [1])
    expect(saida.nomes).toEqual({ juizo: 'Juízo' })
  })

  it('perícope sem registro faz o script falhar, não sair em silêncio', () => {
    const fonte = {
      nomes: { juizo: 'Juízo' },
      registros: { juizo: [1] },
    }
    expect(() => montarRegistros(fonte, [1, 2])).toThrow(/1 perícope/)
  })

  it('slug de registros sem rótulo em nomes faz o script falhar', () => {
    const fonte = {
      nomes: {},
      registros: { juizo: [1] },
    }
    expect(() => montarRegistros(fonte, [1])).toThrow(/juizo/)
  })

  it('os 17 registros da fonte real cobrem as 2823 perícopes reais', () => {
    const fonte: { nomes: Record<string, string>; registros: Record<string, number[]> } =
      JSON.parse(readFileSync(join(root, 'data/trilha-registros.json'), 'utf8'))
    const pericopes: { ordem: number }[] = JSON.parse(
      readFileSync(join(root, 'data/pericopes.json'), 'utf8'),
    )

    expect(Object.keys(fonte.registros)).toHaveLength(17)

    const saida = montarRegistros(fonte, pericopes.map((p) => p.ordem))
    const totalOrdens = Object.values(saida.registros).reduce((n, ordens) => n + ordens.length, 0)
    expect(totalOrdens).toBe(2823)
    expect(Object.keys(saida.registros)).toHaveLength(17)
  })
})
