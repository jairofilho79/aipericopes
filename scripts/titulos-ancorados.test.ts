import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { ancorar, conteudo, inventario, nomesProprios } from './titulos-ancorados.ts'

const TEXTO_JO_20 =
  'Capítulo 20 19 Vinda pois já a tarde, o primeiro dia da semana, e fechadas as portas ' +
  'onde os Discípulos, por medo dos judeus, tinham se reunido, veio Jesus, e pôs-se no meio ' +
  'deles, e disse-lhes: Tenhais paz!'

describe('ancorar', () => {
  it('reprova o título que não usa nada do texto', () => {
    const v = ancorar('Enviados de dentro do esconderijo', TEXTO_JO_20)
    expect(v.ancorado).toBe(false)
  })

  it('aprova o mesmo trecho quando o título pega o que está lá', () => {
    const v = ancorar('Portas trancadas, e Jesus no meio', TEXTO_JO_20)
    expect(v.ancorado).toBe(true)
  })

  // O caso que fez a regra mudar: o título dizia `abstenções` e o texto,
  // `abstenham`. Sem radical, um título bom era reprovado.
  it('casa flexão e derivação pelo radical', () => {
    const texto = 'que se abstenham das contaminações dos ídolos, e do sangue, dos gentios'
    expect(ancorar('Quatro abstenções pedidas aos gentios', texto).ancorado).toBe(true)
  })

  it('um nome próprio do texto basta sozinho', () => {
    const texto = 'Capítulo 16 1 E quando Davi passou, eis que Ziba o saía a receber.'
    const v = ancorar('Ziba no caminho', texto)
    expect(v.nomes).toContain('ziba')
    expect(v.ancorado).toBe(true)
  })

  // `Deus` e `Senhor` aparecem em quase toda perícope: ancorar neles não
  // distingue nenhuma, e era assim que título vago passava por específico.
  it('não conta Deus nem Senhor como nome que ancora', () => {
    const texto = 'Capítulo 1 1 E disse Deus ao Senhor: assim será.'
    expect(ancorar('O Senhor e Deus', texto).nomes).toEqual([])
  })

  it('ignora as palavras de ligação', () => {
    expect(conteudo('A porta que se abriu para o povo')).toEqual(['porta', 'abriu', 'povo'])
  })

  it('não toma por nome próprio a palavra que abre a frase', () => {
    expect([...nomesProprios('Capítulo 3 1 Depois disto veio Paulo. Eles ouviram.')]).toEqual([
      'paulo',
    ])
  })
})

const CATALOGO = 'data/pericopes.json'
describe.skipIf(!existsSync(CATALOGO))('contra o catálogo de verdade', () => {
  it('mede quantos títulos estão soltos, e trava o número', () => {
    const d = JSON.parse(readFileSync(CATALOGO, 'utf8')) as {
      titulo_pericope_pt: string
      texto: string
    }[]
    const soltos = d.filter((p) => !ancorar(p.titulo_pericope_pt, p.texto).ancorado).length
    // Chegou a zero em 05/09/2026, depois de 1.263 títulos reescritos. Deixa de
    // ser trava para baixo e passa a ser trava seca: título novo nasce ancorado.
    expect(soltos).toBe(0)
  })
})

describe('inventario', () => {
  it('acusa a série de três sem nada depois', () => {
    expect(inventario('A mesa de acácia, com pratos, colheres e tigelas')).toBe(true)
  })

  // A série vira premissa quando há oração do outro lado do dois-pontos.
  it('absolve a série que serve de premissa a uma oração', () => {
    expect(inventario('Mirra, canela e cássia: o azeite da santa unção')).toBe(false)
  })

  it('absolve o par', () => {
    expect(inventario('Arão funde o bezerro, e Moisés quebra as tábuas')).toBe(false)
  })
})

describe('inventario — a série fechada por aposto', () => {
  it('absolve os três topônimos quando o fim diz o que eles são', () => {
    expect(inventario('Bezer, Ramote e Golã, cidades do homicida')).toBe(false)
  })

  it('continua acusando a série que termina em item solto', () => {
    expect(inventario('Jetro propõe chefes de mil, cem, cinquenta e dez')).toBe(true)
  })
})

describe('inventario — numeral composto', () => {
  it('não conta "vinte e oito" como dois itens', () => {
    expect(inventario('Vinte e oito anos, três versículos')).toBe(false)
  })

  it('continua acusando a série de coisas', () => {
    expect(inventario('A mesa, os pratos e as colheres')).toBe(true)
  })
})

describe('inventario — a vírgula separa o que o "e" junta', () => {
  it('junta o numeral composto ligado por "e"', () => {
    expect(inventario('A Lei veio quatrocentos e trinta anos depois da promessa')).toBe(false)
  })

  // A regressão que este par pegou: quando a junção passou a valer também
  // através da vírgula, uma lista de quatro números virava um número só.
  it('não junta a série de numerais separada por vírgula', () => {
    expect(inventario('Jetro propõe chefes de mil, cem, cinquenta e dez')).toBe(true)
  })
})
