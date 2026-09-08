import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import {
  AINDA_PODEM_MUDAR,
  pericopesAfetadas,
  TODAS_AS_REFS,
  DEFEITOS,
  CODIGOS_VPL,
  type Faixa,
} from './defeitos-blivre.ts'
import { CORRECOES, OMISSOES, PONTO_FINAL_PERDIDO } from './blivre-correcoes.ts'

const mapa = new Map([['EXO', 'Êx'], ['GEN', 'Gn']])
const faixa = (ordem: number, abbrev: string, ci: number, vi: number, cf: number, vf: number): Faixa => ({
  ordem, abbrev, capitulo_inicio: ci, versiculo_inicio: vi, capitulo_fim: cf, versiculo_fim: vf,
})

describe('DEFEITOS', () => {
  it('toda referência está no formato do VPL e usa código conhecido', () => {
    for (const ref of TODAS_AS_REFS) {
      const m = /^(\S+) (\d+):(\d+)$/.exec(ref)
      expect(m, `malformada: ${ref}`).not.toBeNull()
      expect(CODIGOS_VPL as readonly string[]).toContain(m![1])
    }
  })

  it('nenhuma referência aparece em duas classes — seria correção dupla', () => {
    expect(new Set(TODAS_AS_REFS).size).toBe(TODAS_AS_REFS.length)
  })

  it('as classes batem com o que o doc registra', () => {
    expect(DEFEITOS.map((d) => d.refs.length).reduce((a, b) => a + b)).toBe(485)
  })
})

describe('pericopesAfetadas', () => {
  it('acha a perícope que contém o versículo defeituoso', () => {
    // Êx 19:4 — "asas de águas" — dentro de uma perícope que abre em 19:1.
    const r = pericopesAfetadas([faixa(118, 'Êx', 19, 1, 19, 25)], mapa, ['EXO 19:4'])
    expect([...r]).toEqual([118])
  })

  it('não acha quando o versículo cai fora da faixa, mesmo no mesmo livro', () => {
    expect(pericopesAfetadas([faixa(119, 'Êx', 20, 1, 20, 17)], mapa, ['EXO 19:4']).size).toBe(0)
  })

  it('respeita a fronteira exata, nos dois extremos', () => {
    expect(pericopesAfetadas([faixa(1, 'Êx', 19, 4, 19, 9)], mapa, ['EXO 19:4']).size).toBe(1)
    expect(pericopesAfetadas([faixa(1, 'Êx', 19, 5, 19, 9)], mapa, ['EXO 19:4']).size).toBe(0)
    expect(pericopesAfetadas([faixa(1, 'Êx', 18, 1, 19, 4)], mapa, ['EXO 19:4']).size).toBe(1)
    expect(pericopesAfetadas([faixa(1, 'Êx', 18, 1, 19, 3)], mapa, ['EXO 19:4']).size).toBe(0)
  })

  it('funciona em perícope que atravessa capítulos', () => {
    expect(pericopesAfetadas([faixa(7, 'Êx', 18, 1, 20, 26)], mapa, ['EXO 19:4']).size).toBe(1)
  })

  it('lança quando o código VPL é desconhecido — dataset mudou, não ignore', () => {
    expect(() => pericopesAfetadas([], mapa, ['XXX 1:1'])).toThrow(/desconhecido/)
  })

  it('lança quando a referência está malformada', () => {
    expect(() => pericopesAfetadas([], mapa, ['EXO 19'])).toThrow(/malformada/)
  })
})

describe('as referências existem na fonte', () => {
  // 44 referências do catálogo apontavam para o vazio: o arquivo usa MAR, JOH
  // e EZE, e elas diziam MRK, JHN e EZK. O congelamento não percebia, porque
  // traduz código→abreviação pela mesma lista errada; mas uma correção
  // registrada com a sigla errada morreria em silêncio.
  const VPL = 'data/bliv-tr_vpl.txt'
  const TEM_VPL = existsSync(VPL)
  const refs = TEM_VPL
    ? new Set(
        readFileSync(VPL, 'utf8')
          .replace(/^﻿/, '')
          .split(/\r?\n/)
          .map((l) => /^(\S+ \d+:\d+)\s/.exec(l)?.[1])
          .filter((r): r is string => Boolean(r)),
      )
    : new Set<string>()

  it.skipIf(!TEM_VPL)('toda referência do catálogo casa com um versículo de verdade', () => {
    const orfas = TODAS_AS_REFS.filter((r) => !refs.has(r))
    expect(orfas, `sem versículo correspondente: ${orfas.join(', ')}`).toEqual([])
  })

  it.skipIf(!TEM_VPL)('CODIGOS_VPL usa as siglas do arquivo, não as de outro padrão', () => {
    const doArquivo = new Set([...refs].map((r) => r.split(' ')[0]))
    for (const c of CODIGOS_VPL) expect(doArquivo, c).toContain(c)
  })
})

describe('AINDA_PODEM_MUDAR', () => {
  it('só lista referências que estão no catálogo', () => {
    const fora = AINDA_PODEM_MUDAR.filter((r) => !TODAS_AS_REFS.includes(r))
    expect(fora, `não estão no catálogo: ${fora.join(', ')}`).toEqual([])
  })

  // Se uma delas ganhar receita, ela deixa de poder mudar e sai daqui — senão o
  // congelamento segura perícope à toa e a Sessão 4 paga por isso em atraso.
  it('nenhuma delas já tem receita', () => {
    const refs = new Set([
      ...[...CORRECOES, ...OMISSOES].map((c) => c.ref),
      ...PONTO_FINAL_PERDIDO,
    ])
    const jaFeitas = AINDA_PODEM_MUDAR.filter((r) => refs.has(r))
    expect(jaFeitas, `já têm receita e deviam sair da lista: ${jaFeitas.join(', ')}`).toEqual([])
  })
})
