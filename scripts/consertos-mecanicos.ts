/**
 * Propõe consertos onde a PRÓPRIA FONTE é a testemunha.
 *
 * A regra das duas testemunhas (KJV + Almeida 1911) existe para defeito de
 * tradução — quando o sentido está em jogo. Para erro puramente ortográfico
 * ela é canhão em passarinho, e existe uma testemunha melhor: a Bíblia Livre
 * escreve `princípio` 268 vezes e `principio` 3. Não há o que interpretar; há
 * o que contar.
 *
 * Este script só PROPÕE. Cada proposta traz a contagem que a sustenta, e a
 * decisão de virar receita em `blivre-correcoes.ts` é lida a olho — porque a
 * máquina erra bonito: em `é so eu filho` ela oferece `só`, quando o certo é
 * `seu`. A contagem prova que a palavra é rara, não que a substituta é a certa.
 *
 * Rode: `npx tsx scripts/consertos-mecanicos.ts`
 */
import { readFileSync } from 'node:fs'
import { DEFEITOS } from './defeitos-blivre.ts'
import { corrigirVersiculo } from './blivre-correcoes.ts'

const LINHA_VPL = /^([1-3A-Z]{3})\s(\d+):(\d+)\s(.+)$/
const PALAVRA = /\p{L}+/gu

/** Raro o bastante para ser erro; comum o bastante para ser a forma certa. */
export const RARO = 3
export const FATOR = 10

const semAcento = (p: string) => p.normalize('NFD').replace(/\p{M}/gu, '')

export type Proposta = {
  ref: string
  classe: string
  errada: string
  certa: string
  vezesErrada: number
  vezesCerta: number
  /** `acento` quando as letras são as mesmas; `letra` quando muda uma. */
  tipo: 'acento' | 'letra'
  texto: string
}

/** Uma edição de distância: troca, sobra ou falta de uma letra. */
export function distanciaUm(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  const [curta, longa] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let perdoou = false
  while (i < curta.length && j < longa.length) {
    if (curta[i] === longa[j]) { i++; j++; continue }
    if (perdoou) return false
    perdoou = true
    if (curta.length === longa.length) i++
    j++
  }
  return true
}

export function propor(
  versos: Map<string, { cod: string; cap: number; ver: number; texto: string }>,
): Proposta[] {
  const freq = new Map<string, number>()
  for (const v of versos.values()) {
    for (const [p] of v.texto.matchAll(PALAVRA)) {
      freq.set(p.toLowerCase(), (freq.get(p.toLowerCase()) ?? 0) + 1)
    }
  }
  // Índice das formas sem acento → grafias que a fonte usa, para achar em O(1)
  // a irmã acentuada de uma palavra pelada.
  const porEsqueleto = new Map<string, string[]>()
  for (const p of freq.keys()) {
    const e = semAcento(p)
    porEsqueleto.set(e, [...(porEsqueleto.get(e) ?? []), p])
  }

  const propostas: Proposta[] = []
  for (const { classe, refs } of DEFEITOS) {
    for (const ref of refs) {
      const v = versos.get(ref)
      if (!v) continue
      if (corrigirVersiculo(v.cod, v.cap, v.ver, v.texto) !== v.texto) continue

      for (const m of v.texto.matchAll(PALAVRA)) {
        const bruta = m[0]
        // `escrevê [-las]` parte em duas pela regex, e o pedaço da esquerda
        // parece palavra rara sem ser. Ênclise não é defeito.
        if (/^\s*\[?-/.test(v.texto.slice(m.index + bruta.length))) continue
        const p = bruta.toLowerCase()
        const vezesErrada = freq.get(p) ?? 0
        if (vezesErrada > RARO) continue

        const candidatas = new Set([
          ...(porEsqueleto.get(semAcento(p)) ?? []),
          ...[...freq.keys()].filter((q) => q.length >= 3 && distanciaUm(semAcento(p), semAcento(q))),
        ])
        for (const q of candidatas) {
          if (q === p) continue
          const vezesCerta = freq.get(q) ?? 0
          if (vezesCerta < vezesErrada * FATOR) continue
          propostas.push({
            ref, classe, errada: bruta, certa: casar(bruta, q),
            vezesErrada, vezesCerta,
            tipo: semAcento(p) === semAcento(q) ? 'acento' : 'letra',
            texto: v.texto,
          })
        }
      }
    }
  }
  return propostas
}

/** Devolve a candidata com a caixa da palavra que ela substitui. */
function casar(original: string, candidata: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return candidata[0].toUpperCase() + candidata.slice(1)
  }
  return candidata
}

export function lerVpl(vpl: string) {
  const m = new Map<string, { cod: string; cap: number; ver: number; texto: string }>()
  for (const linha of vpl.replace(/^﻿/, '').split(/\r?\n/)) {
    const g = LINHA_VPL.exec(linha)
    if (g) m.set(`${g[1]} ${g[2]}:${g[3]}`, { cod: g[1], cap: Number(g[2]), ver: Number(g[3]), texto: g[4] })
  }
  return m
}

if (process.argv[1]?.endsWith('consertos-mecanicos.ts')) {
  const propostas = propor(lerVpl(readFileSync('data/bliv-tr_vpl.txt', 'utf8')))
  const so = process.argv.includes('--letra') ? 'letra' : process.argv.includes('--acento') ? 'acento' : null
  for (const p of propostas) {
    if (so && p.tipo !== so) continue
    console.log(`${p.ref}\t${p.tipo}\t${p.errada} (${p.vezesErrada}) → ${p.certa} (${p.vezesCerta})\t${p.classe}`)
  }
  console.error(`\n${propostas.length} propostas em ${new Set(propostas.map((p) => p.ref)).size} versículos`)
}
