/**
 * Monta public/data/trilha.json — que cama musical toca sob cada perícope.
 *
 * Fonte: data/trilha-registros.json (o registro emocional de cada perícope,
 * classificado na Sessão 5 e conferido por amostra). O derivado não é
 * versionado, como o resto de public/data.
 *
 * A ALTERNÂNCIA é a razão de existir deste script. Cinco registros têm uma
 * segunda cama porque produzem as filas mais longas na ordem de leitura — o
 * tabernáculo de Êxodo são 13 perícopes seguidas de Santuário, quase 70 minutos
 * da mesma música. Dentro de uma fila do mesmo registro, a posição par usa a
 * primeira cama e a ímpar usa a segunda.
 *
 * Determinístico de propósito: a mesma perícope soa igual toda vez que for
 * aberta. Sorteio na hora de tocar destruiria a memória sonora que uma paleta
 * pequena e reconhecível existe para construir — e um leitor que volta a uma
 * passagem espera reencontrá-la, não estreá-la.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Trocar isto cria um acervo NOVO no R2; nunca regrave um prefixo publicado. */
export const PREFIXO = 'trilha-v1'

export type Fonte = {
  variantes: string[]
  registros: Record<string, number[]>
}

/**
 * Ordens na ordem de leitura → cama de cada uma. `registroDe` é a
 * classificação; `variantes` são os registros que têm segunda cama.
 */
export function camaPorPericope(
  leitura: number[],
  registroDe: Map<number, string>,
  variantes: Set<string>,
): Map<number, string> {
  const saida = new Map<number, string>()
  for (let i = 0; i < leitura.length; ) {
    const reg = registroDe.get(leitura[i])
    let j = i
    while (j + 1 < leitura.length && registroDe.get(leitura[j + 1]) === reg) j++
    if (reg) {
      for (let k = i; k <= j; k++) {
        const alterna = variantes.has(reg) && (k - i) % 2 === 1
        saida.set(leitura[k], alterna ? `${reg}-2` : reg)
      }
    }
    i = j + 1
  }
  return saida
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const fonte: Fonte = JSON.parse(readFileSync(join(root, 'data/trilha-registros.json'), 'utf8'))
  const pericopes: { ordem: number; seq: number }[] = JSON.parse(
    readFileSync(join(root, 'data/pericopes.json'), 'utf8'),
  )

  const registroDe = new Map<number, string>()
  for (const [reg, ordens] of Object.entries(fonte.registros)) {
    for (const o of ordens) registroDe.set(o, reg)
  }

  const leitura = [...pericopes].sort((a, b) => a.seq - b.seq).map((p) => p.ordem)
  const semRegistro = leitura.filter((o) => !registroDe.has(o))
  if (semRegistro.length) {
    // Sem registro não há cama, e uma perícope muda de som quando o vizinho
    // muda de registro. Falhar aqui é melhor que publicar um buraco silencioso.
    throw new Error(`${semRegistro.length} perícopes sem registro: ${semRegistro.slice(0, 5)}`)
  }

  const cama = camaPorPericope(leitura, registroDe, new Set(fonte.variantes))
  const camas: Record<string, number[]> = {}
  for (const [ordem, c] of cama) (camas[c] ??= []).push(ordem)
  for (const c of Object.keys(camas)) camas[c].sort((a, b) => a - b)

  const outDir = join(root, 'public/data')
  mkdirSync(outDir, { recursive: true })
  const saida = { prefixo: PREFIXO, camas: Object.fromEntries(Object.entries(camas).sort()) }
  writeFileSync(join(outDir, 'trilha.json'), JSON.stringify(saida))
  console.log(`[trilha] ${cama.size} perícopes em ${Object.keys(camas).length} camas (${PREFIXO})`)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) main()
