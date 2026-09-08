/**
 * Fila do caça-invenção (`.claude/skills/caca-invencao/`).
 *
 * Auditoria do que NÓS escrevemos sobre a Escritura, nunca da Escritura. Duas
 * listas por perícope: `invencoes` (o material afirma o que o texto nega) e
 * `sobrou` (versículo que nenhum campo trata).
 *
 * **O portão daqui é mais fraco de propósito, e é importante saber disso.** Ele
 * confere que a citação existe byte a byte e que a referência que a desmente
 * existe no repositório. O que ele NÃO consegue conferir é se a acusação está
 * certa — para isso é preciso ler. A invenção mais perigosa é gramatical,
 * plausível e não viola regra nenhuma: "ficaram de pé do amanhecer ao meio-dia"
 * soma Neemias 8:3 com 8:5 e cria um fato que não existe.
 *
 * Usage:
 *   npx tsx scripts/invencao-fila.ts preparar
 *   npx tsx scripts/invencao-fila.ts claim --tamanho=25
 *   npx tsx scripts/invencao-fila.ts conferir
 *   npx tsx scripts/invencao-fila.ts status
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, montarLote } from './reenriquecimento.ts'
import { montarDossie, textoDoCampo, type Dossie } from './leitura-fila.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/invencao')

export const FORMAS = new Set([
  'contradiz-versiculo',
  'contradiz-campo',
  'fato-inventado',
  'silencio-falso',
  'costume-sem-fonte',
])

export type Invencao = {
  campo: string
  afirma: string
  forma?: string
  desmentido_por?: string
  porque?: string
}
export type Sobra = { versiculos?: string; assunto?: string; porque?: string }
export type Achado = { ordem: number; invencoes?: Invencao[]; sobrou?: Sobra[] }

export function conferirAchado(d: Dossie, a: Achado): string[] {
  const p: string[] = []
  for (const i of a.invencoes ?? []) {
    const alvo = textoDoCampo(d, i.campo)
    if (alvo === null) p.push(`campo desconhecido "${i.campo}"`)
    else if (!i.afirma?.trim()) p.push('acusação sem a frase acusada')
    else if (!alvo.includes(i.afirma))
      // Sem isto, uma acusação parafraseada mandaria reescrever uma frase que
      // ninguém localizou — e o material acusado talvez nem exista.
      p.push(`a frase acusada não está em ${i.campo} — "${i.afirma.slice(0, 55)}…"`)
    else if (!FORMAS.has(i.forma ?? '')) p.push(`forma inválida: "${i.forma ?? ''}"`)
    else if (!i.desmentido_por?.trim())
      p.push(`acusação sem o que a desmente — "${i.afirma.slice(0, 45)}…"`)
  }
  for (const s of a.sobrou ?? []) {
    if (!s.versiculos?.trim()) p.push('sobra sem versículos')
    else if (!s.assunto?.trim()) p.push(`sobra sem assunto (${s.versiculos})`)
  }
  return p
}

function main() {
  const d = dirs(BASE)
  const cmd = process.argv[2]

  if (cmd === 'preparar') {
    criarDirs(d)
    const arr = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<
      string,
      unknown
    >[]
    let n = 0
    for (const p of arr) {
      const alvo = join(d.entrada, `${p.ordem}.json`)
      if (existsSync(alvo)) continue
      writeFileSync(alvo, JSON.stringify(montarDossie(p), null, 2))
      n++
    }
    console.log(`entrada: ${n} dossiês · ${readdirSync(d.entrada).length} no total`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(process.argv.find((a) => a.startsWith('--tamanho='))?.split('=')[1] ?? 25)
    const feitas = new Set(readdirSync(d.saida).map((f) => Number(f.slice(0, -5))))
    const travadas = new Set(readdirSync(d.travas).map(Number))
    const livres = readdirSync(d.entrada)
      .map((f) => Number(f.slice(0, -5)))
      .filter((o) => !feitas.has(o) && !travadas.has(o))
      .sort((a, b) => a - b)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const lote = montarLote(d, livres.slice(0, tamanho), id)
    if (!lote) return console.log('nada pendente')
    console.log(lote.arquivo)
    console.log(`lote ${lote.id}: ${lote.ordens.length}`)
    return
  }

  if (cmd === 'conferir' || cmd === 'status') {
    criarDirs(d)
    const arquivos = readdirSync(d.saida).filter((f) => f.endsWith('.json'))
    let invencoes = 0
    let sobras = 0
    let limpas = 0
    const porForma: Record<string, number> = {}
    const recusadas: string[] = []
    for (const f of arquivos) {
      const a = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as Achado
      const dossie = JSON.parse(readFileSync(join(d.entrada, `${a.ordem}.json`), 'utf8')) as Dossie
      const problemas = conferirAchado(dossie, a)
      if (problemas.length) {
        recusadas.push(`${a.ordem}: ${problemas.join(' | ')}`)
        continue
      }
      invencoes += a.invencoes?.length ?? 0
      sobras += a.sobrou?.length ?? 0
      if (!a.invencoes?.length && !a.sobrou?.length) limpas++
      for (const i of a.invencoes ?? []) porForma[i.forma!] = (porForma[i.forma!] ?? 0) + 1
    }
    console.log(
      `auditadas ${arquivos.length} de ${readdirSync(d.entrada).length} · limpas ${limpas} · recusadas ${recusadas.length}`,
    )
    console.log(`invenções ${invencoes} · sobras ${sobras}`)
    for (const [k, v] of Object.entries(porForma).sort((a, b) => b[1] - a[1]))
      console.log(`  ${k}: ${v}`)
    for (const r of recusadas.slice(0, 15)) console.log(`  ✗ ${r}`)
    return
  }
  console.error('uso: invencao-fila.ts preparar|claim|conferir|status')
  process.exit(1)
}

if (process.argv[1]?.endsWith('invencao-fila.ts')) main()
