import { describe, expect, it } from 'vitest'
import { formatarTempo, inicioDaSecao, secaoDoChip } from './narracao-controles'
import bruto from './__fixtures__/manifesto-1600.json'
import type { Manifesto } from './manifesto'

const manifesto = bruto as Manifesto

describe('formatarTempo', () => {
  it('mm:ss sem zero à esquerda nos minutos', () => {
    expect(formatarTempo(0)).toBe('0:00')
    expect(formatarTempo(7)).toBe('0:07')
    expect(formatarTempo(267.198)).toBe('4:27')
    expect(formatarTempo(600)).toBe('10:00')
  })

  it('trunca, não arredonda: 59,9 s ainda é 0:59', () => {
    expect(formatarTempo(59.9)).toBe('0:59')
  })

  it('passa de uma hora com h:mm:ss', () => {
    expect(formatarTempo(3600)).toBe('1:00:00')
    expect(formatarTempo(3661)).toBe('1:01:01')
  })

  it('duração desconhecida (NaN/Infinity/negativo) vira o traço', () => {
    expect(formatarTempo(Number.NaN)).toBe('–:––')
    expect(formatarTempo(Number.POSITIVE_INFINITY)).toBe('–:––')
    expect(formatarTempo(-1)).toBe('–:––')
  })
})

describe('inicioDaSecao', () => {
  it('devolve o início do cabeçalho falado de cada seção do manifesto real', () => {
    expect(inicioDaSecao(manifesto, 'contexto')).toBe(7.182)
    expect(inicioDaSecao(manifesto, 'texto')).toBe(40.565)
    expect(inicioDaSecao(manifesto, 'resenha')).toBe(166.709)
    expect(inicioDaSecao(manifesto, 'reflexoes')).toBe(238.578)
  })

  it('é a PRIMEIRA unidade da seção, não qualquer uma', () => {
    const primeira = manifesto.unidades.find((u) => u.secao === 'texto')!
    const outra = manifesto.unidades.filter((u) => u.secao === 'texto')[1]!
    expect(inicioDaSecao(manifesto, 'texto')).toBe(primeira.inicio)
    expect(inicioDaSecao(manifesto, 'texto')).not.toBe(outra.inicio)
  })

  it('seção ausente devolve null', () => {
    const sem: Manifesto = { ...manifesto, unidades: manifesto.unidades.filter((u) => u.secao !== 'resenha') }
    expect(inicioDaSecao(sem, 'resenha')).toBeNull()
    expect(inicioDaSecao(null, 'texto')).toBeNull()
  })
})

// Os chips falam "reflexao" (singular, o id da seção na tela); o manifesto
// fala "reflexoes". O mapa é o único lugar onde os dois vocabulários se tocam.
describe('secaoDoChip', () => {
  it('traduz os quatro ids de chip para as seções do manifesto', () => {
    expect(secaoDoChip('contexto')).toBe('contexto')
    expect(secaoDoChip('texto')).toBe('texto')
    expect(secaoDoChip('resenha')).toBe('resenha')
    expect(secaoDoChip('reflexao')).toBe('reflexoes')
  })

  it('id desconhecido devolve null', () => {
    expect(secaoDoChip('titulo')).toBeNull()
    expect(secaoDoChip('reflexoes')).toBeNull()
    expect(secaoDoChip('')).toBeNull()
  })
})
