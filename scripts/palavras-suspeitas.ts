/**
 * Acha erro de digitação na Bíblia Livre sem que ninguém precise ler o texto.
 *
 * **Por que existe.** Vinte subagents lendo perícope por perícope acharam 77
 * defeitos em quatro livros do Novo Testamento. Ler funciona, mas é caro e só
 * cobre o que já foi lido — e o padrão dos achados é sempre o mesmo:
 * `surpeenderam`, `ficarm`, `tetraca`, `exupulsassem`, `posam`, `oração` por
 * *coração*. Todas aparecem **uma vez só** no corpus inteiro e estão a **uma
 * letra** de uma palavra que aparece muito. Isso é detectável por máquina.
 *
 * O detector se validou sozinho: reachou `LUK 21:15 posam` e `HOS 1:2 munto`,
 * que já tinham sido achados na leitura, e trouxe oito que ninguém tinha visto
 * — entre eles `REV 6:1 Coreiro` por *Cordeiro*, na primeira aparição da figura
 * central do Apocalipse.
 *
 * **Isto levanta candidatos, não corrige nada.** A maioria é falso positivo:
 * nome próprio (`Timom`, `Ápia`), palavra rara legítima (`escada`, `álamo`,
 * `descascou`) e forma verbal pouco usada. A regra das duas testemunhas vale
 * igual — KJV e Almeida 1911 decidem, e um humano olha antes.
 *
 * Usage:
 *   npx tsx scripts/palavras-suspeitas.ts [--vpl=data/bliv-tr_vpl.txt]
 *     [--comum=20] [--vocab=arquivo.json,outro.json]
 *
 * `--vocab` recebe arquivos de texto ou JSON de onde se extrai só a lista de
 * formas (nenhum conteúdo é copiado). Uma palavra que existe em outra tradução
 * do português é palavra de verdade, e sai da lista de candidatos. Sem
 * `--vocab` o detector funciona, só devolve mais ruído.
 */
import { readFileSync } from 'node:fs'

export type Candidato = { ref: string; palavra: string; vizinhas: string[] }

const LINHA_VPL = /^(\S+ \d+:\d+)\s+(.*)$/

/** `COD C:V texto` com BOM e CRLF, que é como o arquivo vem. */
export function versiculos(vpl: string): { ref: string; texto: string }[] {
  return vpl
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => LINHA_VPL.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ ref: m[1], texto: m[2] }))
}

export function palavras(texto: string): string[] {
  return texto.toLowerCase().match(/\p{L}+/gu) ?? []
}

/** Índice de deleções: `casa` responde por `casa`, `asa`, `csa`, `caa`, `cas`. */
function comUmaLetraAMenos(w: string): string[] {
  return [w, ...Array.from({ length: w.length }, (_, i) => w.slice(0, i) + w.slice(i + 1))]
}

export const COMUM_PADRAO = 20
export const CURTA_DEMAIS = 4

/**
 * Formas que aparecem uma vez só e estão a uma edição de uma forma frequente.
 * `vocabulario` são palavras sabidamente reais — elas nunca viram candidata.
 */
export function suspeitas(
  versos: { ref: string; texto: string }[],
  vocabulario: Set<string> = new Set(),
  comum = COMUM_PADRAO,
): Candidato[] {
  const freq = new Map<string, number>()
  const primeira = new Map<string, string>()
  for (const { ref, texto } of versos) {
    for (const w of palavras(texto)) {
      freq.set(w, (freq.get(w) ?? 0) + 1)
      if (!primeira.has(w)) primeira.set(w, ref)
    }
  }

  const indice = new Map<string, string[]>()
  for (const [w, n] of freq) {
    if (n < comum) continue
    for (const chave of comUmaLetraAMenos(w)) indice.set(chave, [...(indice.get(chave) ?? []), w])
  }

  const achadas: Candidato[] = []
  for (const [w, n] of freq) {
    if (n !== 1 || w.length < CURTA_DEMAIS || vocabulario.has(w)) continue
    const vizinhas = new Set<string>()
    for (const chave of comUmaLetraAMenos(w)) {
      for (const c of indice.get(chave) ?? []) if (c !== w) vizinhas.add(c)
    }
    if (vizinhas.size) achadas.push({ ref: primeira.get(w)!, palavra: w, vizinhas: [...vizinhas] })
  }
  return achadas
}

function main(): void {
  const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1]
  const versos = versiculos(readFileSync(arg('vpl') ?? 'data/bliv-tr_vpl.txt', 'utf8'))
  const vocabulario = new Set(
    (arg('vocab')?.split(',') ?? []).flatMap((f) => {
      try {
        return palavras(readFileSync(f, 'utf8'))
      } catch {
        console.error(`vocabulário não lido: ${f}`)
        return []
      }
    }),
  )
  const achadas = suspeitas(versos, vocabulario, Number(arg('comum') ?? COMUM_PADRAO))
  console.log(
    `${versos.length} versículos · vocabulário de referência com ${vocabulario.size} formas · ${achadas.length} candidato(s)`,
  )
  for (const { ref, palavra, vizinhas } of achadas) {
    console.log(`  ${ref.padEnd(12)}${palavra.padEnd(20)}→ ${vizinhas.slice(0, 3).join('/')}`)
  }
}

// O caminho do projeto tem espaços, e `file://${argv[1]}` não bate com
// a URL escapada de import.meta — o idioma do resto do repo é o sufixo.
if (process.argv[1]?.endsWith('palavras-suspeitas.ts')) main()
