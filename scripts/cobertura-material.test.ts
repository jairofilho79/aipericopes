import { describe, it, expect } from 'vitest'
import { blocosMudos, densidadeDeNomes, versos } from './cobertura-material.ts'

const LV18 =
  'Capítulo 18\n' +
  '6 Nenhum homem se achegue a nenhuma próxima de sua carne, para descobrir sua nudez.\n' +
  '7 A nudez de teu pai, ou a nudez de tua mãe, não descobrirás.\n' +
  '19 E não chegarás à mulher na separação de sua impureza.\n' +
  '20 Além disso, não terás ato carnal com a mulher de teu próximo.\n' +
  '21 E não dês de tua descendência para fazê-la passar pelo fogo a Moloque.\n'

const MATERIAL_ESTREITO =
  'A casa como lugar seguro. A lista trata de quem mora perto: pai, mãe, e a nudez ' +
  'que não se descobre. No meio dela aparece a ordem de não entregar descendência ao fogo de Moloque.'

describe('blocosMudos', () => {
  // O caso que originou a regra: a tese cobre o parentesco e Moloque, e passa
  // em silêncio pelos versículos que não cabem nela.
  it('acha o bloco seguido de que o material não fala', () => {
    const b = blocosMudos(LV18, MATERIAL_ESTREITO)
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ de: '18:19', ate: '18:20' })
  })

  it('não acusa quando a tese alcança o trecho inteiro', () => {
    const largo = `${MATERIAL_ESTREITO} Fala também da impureza da mulher e do ato carnal com a do próximo.`
    expect(blocosMudos(LV18, largo)).toEqual([])
  })

  // Versículo solto não é bloco: o sinal de UM versículo é fraco demais, porque
  // frase inteira pode ser feita de palavras comuns.
  it('não acusa versículo solto', () => {
    const so20 = `${MATERIAL_ESTREITO} Fala da impureza e da separação da mulher.`
    expect(blocosMudos(LV18, so20)).toEqual([])
  })
})

describe('densidadeDeNomes', () => {
  it('marca alto na genealogia', () => {
    const g = 'Capítulo 1\n1 Adão, Sete, Enos,\n2 Cainã, Maalalel, Jarede,\n3 Enoque, Matusalém, Lameque,\n'
    expect(densidadeDeNomes(g)).toBeGreaterThan(0.9)
  })

  it('marca baixo no discurso', () => {
    expect(densidadeDeNomes(LV18)).toBeLessThan(0.3)
  })
})

describe('perícope que atravessa capítulo', () => {
  // A unidade do material é a PERÍCOPE, não o capítulo — e 63 delas cruzam a
  // fronteira. Sem o capítulo, o versículo 26 de um e o 1 do seguinte deixavam
  // de ser vizinhos ou passavam a ser, conforme os números calhassem.
  const doisCapitulos =
    'Capítulo 25\n26 Fonte turva.\n27 Comer mel demais.\n' +
    'Capítulo 26\n1 Como neve no verão.\n2 Como pardal que voa.\n'

  it('não junta o fim de um capítulo com o começo do outro', () => {
    const b = blocosMudos(doisCapitulos, 'nada em comum aqui')
    expect(b.map((x) => [x.de, x.ate])).toEqual([
      ['25:26', '25:27'],
      ['26:1', '26:2'],
    ])
  })

  it('numera o versículo com o capítulo na frente', () => {
    expect(versos(doisCapitulos).map((v) => `${v.capitulo}:${v.numero}`)).toEqual([
      '25:26',
      '25:27',
      '26:1',
      '26:2',
    ])
  })
})

describe('versos', () => {
  it('lê o número e ignora a linha do capítulo', () => {
    expect(versos('Capítulo 3\n1 Primeiro.\n2 Segundo.')).toEqual([
      { capitulo: 3, numero: 1, texto: 'Primeiro.' },
      { capitulo: 3, numero: 2, texto: 'Segundo.' },
    ])
  })
})
