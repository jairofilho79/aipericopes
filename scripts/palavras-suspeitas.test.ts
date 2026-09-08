import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { versiculos, suspeitas, palavras } from './palavras-suspeitas.ts'

/** Uma palavra comum repetida o bastante para virar referência do índice. */
const encher = (w: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ ref: `GEN 1:${i + 1}`, texto: `e disse ${w} ao povo` }))

describe('versiculos', () => {
  it('lê o formato do VPL com BOM e CRLF, que é como o arquivo vem', () => {
    const r = versiculos('﻿GEN 1:1 No princípio criou Deus.\r\nGEN 1:2 E a terra era vazia.\r\n')
    expect(r).toEqual([
      { ref: 'GEN 1:1', texto: 'No princípio criou Deus.' },
      { ref: 'GEN 1:2', texto: 'E a terra era vazia.' },
    ])
  })

  it('ignora linha em branco e linha fora do formato', () => {
    expect(versiculos('\nlixo sem referência\nGEN 1:1 Texto.\n')).toHaveLength(1)
  })
})

describe('palavras', () => {
  it('separa por letra, guardando acento e ignorando pontuação', () => {
    expect(palavras('Não há cura; tua chaga é fatal!')).toEqual([
      'não', 'há', 'cura', 'tua', 'chaga', 'é', 'fatal',
    ])
  })
})

describe('suspeitas', () => {
  it('acha a palavra que aparece uma vez e está a uma letra de uma comum', () => {
    const versos = [...encher('coração', 25), { ref: 'ACT 4:32', texto: 'era de um só oração' }]
    const r = suspeitas(versos, new Set(), 20)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ ref: 'ACT 4:32', palavra: 'oração' })
    expect(r[0].vizinhas).toContain('coração')
  })

  it('não acusa palavra que o vocabulário de referência conhece', () => {
    const versos = [...encher('coração', 25), { ref: 'ACT 4:32', texto: 'era de um só oração' }]
    expect(suspeitas(versos, new Set(['oração']), 20)).toEqual([])
  })

  it('não acusa palavra que se repete — erro de digitação não é sistemático', () => {
    const versos = [
      ...encher('coração', 25),
      { ref: 'ACT 4:32', texto: 'era de um só oração' },
      { ref: 'ACT 5:1', texto: 'fizeram oração ali' },
    ]
    expect(suspeitas(versos, new Set(), 20)).toEqual([])
  })

  it('não acusa palavra curta, onde uma letra de diferença é coincidência', () => {
    const versos = [...encher('casa', 25), { ref: 'GEN 9:9', texto: 'asa' }]
    expect(suspeitas(versos, new Set(), 20)).toEqual([])
  })
})

// O VPL é fonte bruta, gitignored: existe na máquina de quem baixou a Bíblia
// Livre e não existe na CI. Já quebramos a CI uma vez lendo arquivo derivado
// num teste — e `describe.skipIf` não basta, porque o corpo do describe roda
// na coleta mesmo quando os testes são pulados. A leitura tem de ser guardada.
const VPL = 'data/bliv-tr_vpl.txt'
const TEM_VPL = existsSync(VPL)
describe.skipIf(!TEM_VPL)('contra o texto de verdade', () => {
  const versos = TEM_VPL ? versiculos(readFileSync(VPL, 'utf8')) : []

  it('lê os 31.102 versículos da Bíblia Livre', () => {
    expect(versos).toHaveLength(31102)
  })

  // A prova de que o método vale: estes dois foram achados por subagents
  // LENDO o texto, cada um no seu lote, sem saber deste detector. Se um dia
  // uma mudança aqui parar de pegá-los, o detector regrediu.
  it('reencontra os defeitos que a leitura achou por conta própria', () => {
    const achadas = new Map(suspeitas(versos).map((c) => [c.ref, c.palavra]))
    expect(achadas.get('LUK 21:15')).toBe('posam')
    expect(achadas.get('HOS 1:2')).toBe('munto')
  })

  // Achados só pelo detector, depois confirmados nas duas testemunhas.
  it('acha os que ninguém tinha lido ainda', () => {
    const achadas = new Map(suspeitas(versos).map((c) => [c.ref, c.palavra]))
    expect(achadas.get('REV 6:1')).toBe('coreiro')   // Cordeiro
    expect(achadas.get('REV 2:24')).toBe('dourina')  // doutrina
    expect(achadas.get('PHM 1:25')).toBe('cirsto')   // Cristo
    expect(achadas.get('AMO 9:14')).toBe('isarael')  // Israel
  })
})
