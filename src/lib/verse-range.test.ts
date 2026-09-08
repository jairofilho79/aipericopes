import { describe, expect, it } from 'vitest'
import { parseTexto } from './parse-texto'
import {
  nextSelection,
  parseVerseRef,
  rangeLabel,
  rangeRef,
  verseRefLabel,
  versesInRange,
} from './verse-range'
import type { Pericope } from './types'

const TEXTO = 'Capítulo 1\n1 Um\n2 Dois\n3 Três\nCapítulo 2\n1 Quatro\n2 Cinco'
const blocks = parseTexto(TEXTO)
const gn = { abbrev: 'Gn' } as Pericope

describe('versesInRange', () => {
  it('intervalo simples no mesmo capítulo', () => {
    expect(versesInRange(blocks, '1:1', '1:3').map((v) => v.id)).toEqual(['1:1', '1:2', '1:3'])
  })

  it('atravessa capítulo', () => {
    expect(versesInRange(blocks, '1:3', '2:1').map((v) => v.id)).toEqual(['1:3', '2:1'])
  })

  it('ids invertidos são normalizados', () => {
    expect(versesInRange(blocks, '2:2', '1:2').map((v) => v.id)).toEqual([
      '1:2',
      '1:3',
      '2:1',
      '2:2',
    ])
  })

  it('um único versículo', () => {
    expect(versesInRange(blocks, '1:2', '1:2').map((v) => v.id)).toEqual(['1:2'])
  })

  it('id inexistente devolve lista vazia', () => {
    expect(versesInRange(blocks, '1:1', '9:9')).toEqual([])
    expect(versesInRange([], '1:1', '1:1')).toEqual([])
  })
})

describe('rangeRef e parseVerseRef', () => {
  it('um versículo vira "c:v" e um intervalo vira "c:v-c:v"', () => {
    expect(rangeRef(versesInRange(blocks, '1:2', '1:2'))).toBe('1:2')
    expect(rangeRef(versesInRange(blocks, '1:2', '2:1'))).toBe('1:2-2:1')
  })

  it('lista vazia não tem ref', () => {
    expect(rangeRef([])).toBeNull()
  })

  it('parseVerseRef lê os dois formatos e rejeita lixo', () => {
    expect(parseVerseRef('1:2')).toEqual({ start: '1:2', end: '1:2' })
    expect(parseVerseRef('1:2-2:1')).toEqual({ start: '1:2', end: '2:1' })
    expect(parseVerseRef('abacaxi')).toBeNull()
    expect(parseVerseRef('1:2-')).toBeNull()
  })
})

describe('rótulos', () => {
  it('versículo único, intervalo no mesmo capítulo e intervalo cruzando capítulo', () => {
    expect(rangeLabel(gn, versesInRange(blocks, '1:2', '1:2'))).toBe('Gn 1:2')
    expect(rangeLabel(gn, versesInRange(blocks, '1:1', '1:3'))).toBe('Gn 1:1–3')
    expect(rangeLabel(gn, versesInRange(blocks, '1:3', '2:2'))).toBe('Gn 1:3–2:2')
  })

  it('verseRefLabel reconstrói o rótulo a partir do vínculo salvo', () => {
    expect(verseRefLabel('Gn', '1:3')).toBe('Gn 1:3')
    expect(verseRefLabel('Gn', '1:3-1:7')).toBe('Gn 1:3–7')
    expect(verseRefLabel('Gn', '1:30-2:2')).toBe('Gn 1:30–2:2')
    expect(verseRefLabel('Gn', 'lixo')).toBe('lixo')
  })

  it('sem versículos válidos o rótulo é só a abreviação', () => {
    expect(rangeLabel(gn, [])).toBe('Gn')
  })
})

describe('nextSelection', () => {
  it('sem seleção, o toque seleciona só aquele versículo', () => {
    expect(nextSelection(blocks, null, '1:2')).toEqual({ start: '1:2', end: '1:2' })
  })

  it('toque fora da seleção estende o intervalo', () => {
    expect(nextSelection(blocks, { start: '1:1', end: '1:1' }, '2:1')).toEqual({
      start: '1:1',
      end: '2:1',
    })
  })

  it('toque dentro de um intervalo recolhe para aquele versículo', () => {
    expect(nextSelection(blocks, { start: '1:1', end: '2:1' }, '1:3')).toEqual({
      start: '1:3',
      end: '1:3',
    })
  })

  it('toque no único selecionado desseleciona', () => {
    expect(nextSelection(blocks, { start: '1:2', end: '1:2' }, '1:2')).toBeNull()
  })

  it('id fora do texto não muda a seleção; seleção órfã reinicia no toque', () => {
    expect(nextSelection(blocks, { start: '1:1', end: '1:1' }, '9:9')).toEqual({
      start: '1:1',
      end: '1:1',
    })
    expect(nextSelection(blocks, { start: '7:7', end: '7:7' }, '1:2')).toEqual({
      start: '1:2',
      end: '1:2',
    })
  })
})
