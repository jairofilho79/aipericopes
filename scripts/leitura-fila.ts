/**
 * Fila em disco do leitor cético (`.claude/skills/leitor-cetico/`).
 *
 * O leitor NÃO reescreve nada: ele devolve achados. Por isso esta fila é a mais
 * barata das quatro — a saída é um julgamento, e julgamento errado não apaga
 * texto enquanto não passar pelo portão daqui.
 *
 * O portão tem três regras, e cada uma existe por causa de um jeito diferente
 * de estragar o acervo:
 *
 * 1. **Corte só vale com citação byte a byte.** Leitor que parafraseia a frase
 *    que quer cortar está inventando, e aceitar isso apagaria frase que ninguém
 *    leu — inclusive a vizinha, se a citação for aproximada.
 * 2. **Dívida só vale com âncora.** O piloto de contextos mediu o risco: 25 de
 *    40 dependiam de uma afirmação sobre costume antigo que nenhum portão
 *    conferia. Material rico e material inventado são feitos da mesma matéria.
 * 3. **Dívida declara a força.** Sem separar dívida de enriquecimento, tudo
 *    vira reescrita e material bom entra na fila junto com o defeituoso — o
 *    Salmo 34 rendeu duas observações ótimas e não tem defeito nenhum.
 *
 * Usage:
 *   npx tsx scripts/leitura-fila.ts preparar
 *   npx tsx scripts/leitura-fila.ts claim --tamanho=12 [--espalhar]
 *   npx tsx scripts/leitura-fila.ts conferir
 *   npx tsx scripts/leitura-fila.ts status
 *   npx tsx scripts/leitura-fila.ts resumo
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, espalharPorLivro, montarLote, pendentes } from './reenriquecimento.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/leitura')

export const CAMPOS = [
  'titulo_pericope_pt',
  'contexto_historico_literario',
  'resenha',
  'perguntas_reflexao',
  'topicos_pregar',
] as const
export type Campo = (typeof CAMPOS)[number]

export type Dossie = {
  ordem: number
  abbrev: string
  livro: string
  ref: string
  texto: string
} & Record<Campo, string | string[]>

export type Corte = { campo: string; frase: string; porque?: string }
export type Divida = { campo: string; forca?: string; o_que?: string; ancora?: string; porque?: string }
export type Achado = { ordem: number; corta?: Corte[]; faltou?: Divida[] }

const FORCAS = new Set(['divida', 'dívida', 'enriquecimento'])

/** Junta lista em texto: `perguntas_reflexao` é array, e a citação pode cair em qualquer item. */
export function textoDoCampo(d: Dossie, campo: string): string | null {
  if (!(CAMPOS as readonly string[]).includes(campo)) return null
  const v = d[campo as Campo]
  return Array.isArray(v) ? v.join('\n') : (v ?? '')
}

export function conferirAchado(d: Dossie, a: Achado): string[] {
  const p: string[] = []
  for (const c of a.corta ?? []) {
    const alvo = textoDoCampo(d, c.campo)
    if (alvo === null) p.push(`corta: campo desconhecido "${c.campo}"`)
    // Não normalizo aspa curva nem reticências: normalizar aqui abre a porta
    // para o corte aproximado, e o corte aproximado leva a frase vizinha junto.
    else if (!c.frase?.trim()) p.push('corta: frase vazia')
    else if (!alvo.includes(c.frase))
      p.push(`corta: frase não está em ${c.campo} — "${c.frase.slice(0, 60)}…"`)
    else if (!c.porque?.trim()) p.push(`corta: sem justificativa — "${c.frase.slice(0, 45)}…"`)
  }
  for (const f of a.faltou ?? []) {
    if (textoDoCampo(d, f.campo) === null) p.push(`faltou: campo desconhecido "${f.campo}"`)
    else if (!f.o_que?.trim()) p.push('faltou: sem o quê')
    else if (!f.ancora?.trim()) p.push(`faltou: sem âncora — "${f.o_que.slice(0, 50)}…"`)
    else if (!FORCAS.has((f.forca ?? '').toLowerCase().trim()))
      p.push(`faltou: forca deve ser divida ou enriquecimento (veio "${f.forca ?? ''}")`)
  }
  return p
}

export function ehDivida(f: Divida): boolean {
  const x = (f.forca ?? '').toLowerCase().trim()
  return x === 'divida' || x === 'dívida'
}

export function montarDossie(p: Record<string, unknown>): Dossie {
  const faixa =
    p.capitulo_inicio === p.capitulo_fim
      ? `${p.capitulo_inicio}:${p.versiculo_inicio}-${p.versiculo_fim}`
      : `${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`
  const d = {
    ordem: p.ordem as number,
    abbrev: p.abbrev as string,
    livro: p.livro as string,
    ref: `${p.livro} ${faixa}`,
    texto: p.texto as string,
  } as Dossie
  for (const c of CAMPOS) d[c] = p[c] as string | string[]
  return d
}

function main() {
  const d = dirs(BASE)
  const cmd = process.argv[2]
  const arg = (nome: string) =>
    process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1]

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
    console.log(`entrada: ${n} dossiês novos · ${readdirSync(d.entrada).length} no total`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(arg('tamanho') ?? 12)
    const livres = pendentes(d)
    const escolhidas = process.argv.includes('--espalhar')
      ? espalharPorLivro(d, livres, tamanho)
      : livres.slice(0, tamanho)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const lote = montarLote(d, escolhidas, id)
    if (!lote) {
      console.log('nada pendente')
      return
    }
    console.log(lote.arquivo)
    console.log(`lote ${lote.id}: ${lote.ordens.length} perícopes · ${lote.ordens.join(', ')}`)
    return
  }

  if (cmd === 'conferir' || cmd === 'resumo') {
    const arquivos = existsSync(d.saida)
      ? readdirSync(d.saida).filter((f) => f.endsWith('.json'))
      : []
    let cortes = 0
    let dividas = 0
    let enriq = 0
    let limpas = 0
    const recusadas: string[] = []
    for (const f of arquivos) {
      const a = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as Achado
      const dossie = JSON.parse(
        readFileSync(join(d.entrada, `${a.ordem}.json`), 'utf8'),
      ) as Dossie
      const problemas = conferirAchado(dossie, a)
      if (problemas.length) {
        recusadas.push(`${a.ordem}: ${problemas.join(' | ')}`)
        continue
      }
      cortes += a.corta?.length ?? 0
      dividas += (a.faltou ?? []).filter(ehDivida).length
      enriq += (a.faltou ?? []).filter((x) => !ehDivida(x)).length
      if (!a.corta?.length && !a.faltou?.length) limpas++
    }
    console.log(`lidas ${arquivos.length} · limpas ${limpas} · recusadas ${recusadas.length}`)
    console.log(`cortes ${cortes} · dívidas ${dividas} · enriquecimentos ${enriq}`)
    for (const r of recusadas.slice(0, 20)) console.log(`  ✗ ${r}`)
    return
  }

  if (cmd === 'status') {
    criarDirs(d)
    console.log(
      `entrada ${readdirSync(d.entrada).length} · saída ${readdirSync(d.saida).length} · travadas ${readdirSync(d.travas).length} · pendentes ${pendentes(d).length}`,
    )
    return
  }

  console.error('uso: leitura-fila.ts preparar|claim|conferir|resumo|status')
  process.exit(1)
}

if (process.argv[1]?.endsWith('leitura-fila.ts')) main()
