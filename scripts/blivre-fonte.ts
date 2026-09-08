/**
 * Leitura da fonte da Bíblia Livre (BLIVRE) no formato VPL — um versículo por
 * linha, `GEN 1:1 No princípio criou Deus os céus e a terra.`
 *
 * A fonte é o release oficial do projeto (github.com/blivre/BibliaLivre,
 * 2018.2.0), variante `tr` — Textus Receptus, a mesma linhagem textual da KJV,
 * de onde vêm os limites das perícopes. O JSON de terceiro que circula por aí
 * NÃO serve: diverge em 6.246 versículos, não traz os sobrescritos e tem um
 * buraco em Sl 46:3. Ver docs/licencas.md.
 *
 * O que sai daqui alimenta o ETL no lugar do antigo `data/NAA.json`.
 */
import { corrigirVersiculo } from './blivre-correcoes.ts'
import { separarEpigrafe } from './blivre-epigrafes.ts'
import { removerColchetes } from './blivre-texto.ts'

/** Código de três letras do VPL → livro do catálogo. */
export const MAPA_LIVROS: Record<string, { name: string; abbrev: string }> = {
  GEN: { name: 'Gênesis', abbrev: 'Gn' },
  EXO: { name: 'Êxodo', abbrev: 'Êx' },
  LEV: { name: 'Levítico', abbrev: 'Lv' },
  NUM: { name: 'Números', abbrev: 'Nm' },
  DEU: { name: 'Deuteronômio', abbrev: 'Dt' },
  JOS: { name: 'Josué', abbrev: 'Js' },
  JDG: { name: 'Juízes', abbrev: 'Jz' },
  RUT: { name: 'Rute', abbrev: 'Rt' },
  '1SA': { name: '1 Samuel', abbrev: '1Sm' },
  '2SA': { name: '2 Samuel', abbrev: '2Sm' },
  '1KI': { name: '1 Reis', abbrev: '1Rs' },
  '2KI': { name: '2 Reis', abbrev: '2Rs' },
  '1CH': { name: '1 Crônicas', abbrev: '1Cr' },
  '2CH': { name: '2 Crônicas', abbrev: '2Cr' },
  EZR: { name: 'Esdras', abbrev: 'Ed' },
  NEH: { name: 'Neemias', abbrev: 'Ne' },
  EST: { name: 'Ester', abbrev: 'Et' },
  JOB: { name: 'Jó', abbrev: 'Jó' },
  PSA: { name: 'Salmos', abbrev: 'Sl' },
  PRO: { name: 'Provérbios', abbrev: 'Pv' },
  ECC: { name: 'Eclesiastes', abbrev: 'Ec' },
  // 'Cantares', e não 'Cânticos': este nome vinha do campo `name` da NAA, a
  // versão que saiu do projeto por direitos autorais. A BLIVRE é da linhagem
  // Corrigida — a mesma da ARC e da ACF, que dizem *Cantares* —, então o nome
  // antigo tinha ficado órfão da tradução que o justificava.
  SOL: { name: 'Cantares', abbrev: 'Ct' },
  ISA: { name: 'Isaías', abbrev: 'Is' },
  JER: { name: 'Jeremias', abbrev: 'Jr' },
  LAM: { name: 'Lamentações', abbrev: 'Lm' },
  EZE: { name: 'Ezequiel', abbrev: 'Ez' },
  DAN: { name: 'Daniel', abbrev: 'Dn' },
  HOS: { name: 'Oséias', abbrev: 'Os' },
  JOE: { name: 'Joel', abbrev: 'Jl' },
  AMO: { name: 'Amós', abbrev: 'Am' },
  OBA: { name: 'Obadias', abbrev: 'Ob' },
  JON: { name: 'Jonas', abbrev: 'Jn' },
  MIC: { name: 'Miquéias', abbrev: 'Mq' },
  NAH: { name: 'Naum', abbrev: 'Na' },
  HAB: { name: 'Habacuque', abbrev: 'Hc' },
  ZEP: { name: 'Sofonias', abbrev: 'Sf' },
  HAG: { name: 'Ageu', abbrev: 'Ag' },
  ZEC: { name: 'Zacarias', abbrev: 'Zc' },
  MAL: { name: 'Malaquias', abbrev: 'Ml' },
  MAT: { name: 'Mateus', abbrev: 'Mt' },
  MAR: { name: 'Marcos', abbrev: 'Mc' },
  LUK: { name: 'Lucas', abbrev: 'Lc' },
  JOH: { name: 'João', abbrev: 'Jo' },
  ACT: { name: 'Atos', abbrev: 'At' },
  ROM: { name: 'Romanos', abbrev: 'Rm' },
  '1CO': { name: '1 Coríntios', abbrev: '1Co' },
  '2CO': { name: '2 Coríntios', abbrev: '2Co' },
  GAL: { name: 'Gálatas', abbrev: 'Gl' },
  EPH: { name: 'Efésios', abbrev: 'Ef' },
  PHI: { name: 'Filipenses', abbrev: 'Fp' },
  COL: { name: 'Colossenses', abbrev: 'Cl' },
  '1TH': { name: '1 Tessalonicenses', abbrev: '1Ts' },
  '2TH': { name: '2 Tessalonicenses', abbrev: '2Ts' },
  '1TI': { name: '1 Timóteo', abbrev: '1Tm' },
  '2TI': { name: '2 Timóteo', abbrev: '2Tm' },
  TIT: { name: 'Tito', abbrev: 'Tt' },
  PHM: { name: 'Filemom', abbrev: 'Fm' },
  HEB: { name: 'Hebreus', abbrev: 'Hb' },
  JAM: { name: 'Tiago', abbrev: 'Tg' },
  '1PE': { name: '1 Pedro', abbrev: '1Pe' },
  '2PE': { name: '2 Pedro', abbrev: '2Pe' },
  '1JO': { name: '1 João', abbrev: '1Jo' },
  '2JO': { name: '2 João', abbrev: '2Jo' },
  '3JO': { name: '3 João', abbrev: '3Jo' },
  JUD: { name: 'Judas', abbrev: 'Jd' },
  REV: { name: 'Apocalipse', abbrev: 'Ap' },
}

/**
 * Um versículo: `t` é o corpo, `e` é o sobrescrito (sobe para a epígrafe do
 * topo) e `r` é o rótulo estrutural (fica na linha do versículo).
 */
export type VersiculoBlivre = { t: string; e?: string; r?: string }

export type LivroBlivre = {
  abbrev: string
  name: string
  /** `chapters[c - 1][v - 1]` — densa, sem buraco (o parser garante). */
  chapters: VersiculoBlivre[][]
}

const LINHA = /^([A-Z0-9]{3}) (\d+):(\d+) ?(.*)$/

/**
 * Converte o VPL inteiro. Lança em qualquer buraco de numeração ou código
 * desconhecido: uma Bíblia com furo é pior que um build que não passa.
 */
export function converterVpl(bruto: string): LivroBlivre[] {
  const livros: LivroBlivre[] = []
  const porCodigo = new Map<string, LivroBlivre>()

  for (const linha of bruto.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!linha.trim()) continue
    const m = LINHA.exec(linha)
    if (!m) throw new Error(`Linha fora do formato VPL: "${linha.slice(0, 60)}"`)

    const [, cod, capStr, verStr, corpo] = m
    const capitulo = Number(capStr)
    const versiculo = Number(verStr)

    const mapeado = MAPA_LIVROS[cod]
    if (!mapeado) throw new Error(`Código de livro desconhecido no VPL: ${cod}`)

    let livro = porCodigo.get(cod)
    if (!livro) {
      livro = { abbrev: mapeado.abbrev, name: mapeado.name, chapters: [] }
      porCodigo.set(cod, livro)
      livros.push(livro)
    }

    if (capitulo !== livro.chapters.length && capitulo !== livro.chapters.length + 1) {
      throw new Error(
        `Capítulo fora de sequência: ${mapeado.abbrev} ${capitulo} depois de ${livro.chapters.length}` +
          ` — falta ${mapeado.abbrev} ${livro.chapters.length + 1}`,
      )
    }
    if (capitulo === livro.chapters.length + 1) livro.chapters.push([])

    const cap = livro.chapters[capitulo - 1]
    if (versiculo !== cap.length + 1) {
      throw new Error(
        `Versículo fora de sequência: ${mapeado.abbrev} ${capitulo}:${versiculo} depois de ` +
          `${cap.length} — falta ${mapeado.abbrev} ${capitulo}:${cap.length + 1}`,
      )
    }

    // A ordem importa duas vezes: corrigir ANTES de separar a epígrafe (o Sl 125
    // recupera o sobrescrito e o Sl 80 conserta o dele), e separar a epígrafe
    // ANTES de tirar os colchetes (o rótulo do Sl 119 e de Cantares VEM entre
    // colchetes).
    const corrigido = corrigirVersiculo(cod, capitulo, versiculo, corpo.trim())
    const { epigrafe, tipo, texto } = separarEpigrafe(cod, capitulo, versiculo, corrigido)
    const limpo = removerColchetes(texto)
    if (!epigrafe) cap.push({ t: limpo })
    else if (tipo === 'sobrescrito') cap.push({ t: limpo, e: epigrafe })
    else cap.push({ t: limpo, r: epigrafe })
  }

  return livros
}
