/**
 * A leitura do acervo inteiro, do lugar de quem vai OUVIR.
 *
 * **Por que existe.** Com todas as réguas verdes, li 62 perícopes por amostra
 * e achei 31 defeitos em 22 delas — 35%. Nenhum era mentira (a auditoria de
 * invenção fechou em zero) e nenhum impedia narrar. Eram desgaste: causa
 * inventada para um fato verdadeiro, o contexto entregando o achado da resenha
 * em paráfrase, promessa de pagamento fora da perícope. Régua nenhuma pega
 * isso, porque não há forma para casar — é conteúdo.
 *
 * **A diferença desta fila para a da amostra:** aqui o leitor não relata, ele
 * CONSERTA. Relatar mil achados produz um documento que ninguém aplica.
 *
 * **A regra que governa o portão:** tirar é barato, acrescentar é caro. Corte
 * e hedge ("era caro" no lugar de "era caro porque X") entram sem cerimônia.
 * Texto que CRESCE precisa declarar `apoio` citando o texto da perícope, e a
 * citação é conferida — porque acrescentar é onde a invenção nasce, e o acervo
 * acabou de fechar em zero.
 *
 * Usage:
 *   npx tsx scripts/leitura-larga.ts preparar
 *   npx tsx scripts/leitura-larga.ts claim --tamanho=20
 *   npx tsx scripts/leitura-larga.ts aplicar
 *   npx tsx scripts/leitura-larga.ts status
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, montarLote } from './reenriquecimento.ts'
import { maiorTrechoRepetido, validarMaterial, type Material } from './validar-material.ts'
import { penduradaSemPagar, todasPenduradas } from './frase-pendurada.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/leitura-larga')

export const TIPOS = [
  'nao-sustenta',
  'repeticao',
  'liga-pericope',
  'enrolacao',
  'nao-explica',
  'so-na-tela',
] as const

export type Achado = {
  campo: 'contexto_historico_literario' | 'resenha' | 'topicos_pregar' | 'titulo_pericope_pt'
  tipo: (typeof TIPOS)[number]
  /** A frase acusada, byte a byte como está no material. */
  frase: string
  veredito: 'corta' | 'troca'
  novo?: string
  /** Obrigatório quando o texto CRESCE. Citação literal do texto da perícope. */
  apoio?: string
  porque: string
}
export type Veredito = { ordem: number; achados: Achado[] }

const limpar = (t: string) =>
  t
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const chave = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function aplicarLeitura(
  p: Record<string, unknown>,
  v: Veredito,
  entrada: { texto: string },
): { cortes: number; trocas: number } {
  const original = JSON.parse(JSON.stringify(p)) as Record<string, unknown>
  // Só o que ESTE conserto introduzir reprova. A campanha da frase pendurada
  // julgou 948 destas e deixou 283 de pé porque a frase seguinte paga.
  const jaHavia = new Set(
    [
      ...todasPenduradas(String(p.contexto_historico_literario ?? '')),
      ...todasPenduradas(String(p.resenha ?? '')),
    ].filter(penduradaSemPagar),
  )
  const tamanhoAntes = Object.fromEntries(
    ['contexto_historico_literario', 'resenha'].map((c) => [c, String(p[c] ?? '').length]),
  )
  let cortes = 0
  let trocas = 0

  // **Todo `throw` daqui para baixo desfaz.** A primeira versão só restaurava
  // no bloco final, e um erro no terceiro achado deixava os dois primeiros
  // aplicados — com o portão do material nunca rodando em cima do resultado.
  // Aconteceu em nove perícopes: nenhuma quebrou, porque cada conserto é válido
  // por si, mas o portão só sabia disso por sorte.
  const desfazer = (msg: string): never => {
    Object.assign(p, original)
    throw new Error(msg)
  }

  for (const a of v.achados ?? []) {
    if (!TIPOS.includes(a.tipo)) desfazer(`${v.ordem}: tipo inválido "${a.tipo}"`)
    const campo = String(p[a.campo] ?? '')
    if (!campo.includes(a.frase))
      desfazer(`${v.ordem}: a frase não está em ${a.campo} — "${a.frase.slice(0, 55)}…"`)
    if (a.veredito === 'corta') {
      p[a.campo] = limpar(campo.replace(a.frase, ''))
      cortes++
      continue
    }
    const novo = a.novo?.trim()
    if (!novo) desfazer(`${v.ordem}: "troca" sem texto novo`)
    // Tirar é barato; acrescentar é caro. Mas "crescer" não é qualquer byte a
    // mais: trocar "sempre firmava" por "costumava firmar" cresce dois
    // caracteres e não afirma nada de novo — a primeira versão do portão
    // recusou seis consertos legítimos por 1, 2, 5, 7 e 11 caracteres, que é
    // medir a coisa errada com precisão de régua. Uma AFIRMAÇÃO nova ocupa uma
    // oração, e uma oração destas tem uns sessenta caracteres.
    if (novo.length > a.frase.length + 60) {
      if (!a.apoio?.trim())
        desfazer(
          `${v.ordem}: a troca acrescenta ${novo.length - a.frase.length} caracteres e não declara apoio`,
        )
      const cits = [...a.apoio.matchAll(/[“"]([^”"]{10,})[”"]/g)].map((m) => m[1])
      if (!cits.length)
        desfazer(`${v.ordem}: o apoio não cita nada — ponha entre aspas o trecho do texto`)
      for (const c of cits)
        if (!chave(String(entrada.texto)).includes(chave(c)))
          desfazer(
            `${v.ordem}: o apoio cita "${c.slice(0, 45)}…", que não está no texto desta perícope`,
          )
    }
    p[a.campo] = campo.replace(a.frase, novo)
    trocas++
  }

  if (cortes + trocas === 0) return { cortes, trocas }

  // Esvaziar o campo é a saída preguiçosa: o defeito some e a explicação vai
  // junto. Um conserto tira UMA coisa, não metade do campo.
  for (const [c, antes] of Object.entries(tamanhoAntes))
    if (String(p[c] ?? '').length < antes * 0.7)
      desfazer(
        `${v.ordem}: ${c} encolheu de ${antes} para ${String(p[c] ?? '').length} — tire o defeito, não a explicação`,
      )
  for (const f of todasPenduradas(String(p.contexto_historico_literario)).concat(
    todasPenduradas(String(p.resenha)),
  ))
    if (penduradaSemPagar(f) && !jaHavia.has(f))
      desfazer(`${v.ordem}: o conserto deixou uma frase que anuncia e não paga — "${f}"`)
  const rep = maiorTrechoRepetido(String(p.contexto_historico_literario), String(p.resenha))
  if (rep > 8) desfazer(`${v.ordem}: a resenha passou a repetir o contexto em ${rep} palavras`)
  const r = validarMaterial(entrada, p as unknown as Material, JSON.stringify(p))
  if (r.problemas.length) desfazer(`${v.ordem}: ${r.problemas.join('; ')}`)
  return { cortes, trocas }
}

function pendentesAqui(d: ReturnType<typeof dirs>): number[] {
  const feito = new Set([
    ...(existsSync(d.saida) ? readdirSync(d.saida) : []),
    ...(existsSync(join(d.base, 'aplicados')) ? readdirSync(join(d.base, 'aplicados')) : []),
  ])
  const travadas = new Set(existsSync(d.travas) ? readdirSync(d.travas) : [])
  return readdirSync(d.entrada)
    .filter((f) => f.endsWith('.json') && !feito.has(f) && !travadas.has(f.slice(0, -5)))
    .map((f) => Number(f.slice(0, -5)))
    .sort((a, b) => a - b)
}

function main() {
  const d = dirs(BASE)
  const cmd = process.argv[2]
  const arr = () =>
    JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<string, unknown>[]
  const dEntrada = dirs(join(root, 'data/reenriquecimento')).entrada

  if (cmd === 'preparar') {
    criarDirs(d)
    let n = 0
    for (const p of arr()) {
      writeFileSync(
        join(d.entrada, `${p.ordem}.json`),
        JSON.stringify(
          {
            ordem: p.ordem,
            ref: `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`,
            titulo_pericope_pt: p.titulo_pericope_pt,
            contexto_historico_literario: p.contexto_historico_literario,
            resenha: p.resenha,
            perguntas_reflexao: p.perguntas_reflexao,
            topicos_pregar: p.topicos_pregar,
            texto: p.texto,
          },
          null,
          2,
        ),
      )
      n++
    }
    console.log(`entrada: ${n}`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(process.argv.find((a) => a.startsWith('--tamanho='))?.split('=')[1] ?? 20)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const lote = montarLote(d, pendentesAqui(d).slice(0, tamanho), id)
    if (!lote) return console.log('nada pendente')
    console.log(lote.arquivo)
    console.log(`lote ${lote.id}: ${lote.ordens.length}`)
    return
  }

  if (cmd === 'aplicar') {
    const lista = arr()
    const porOrdem = new Map(lista.map((p) => [p.ordem as number, p]))
    const aplicados = join(d.base, 'aplicados')
    mkdirSync(aplicados, { recursive: true })
    const erros: string[] = []
    const feitos: string[] = []
    const porTipo: Record<string, number> = {}
    let cortes = 0
    let trocas = 0
    let limpas = 0
    for (const f of readdirSync(d.saida).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as Veredito
      const p = porOrdem.get(v.ordem)
      if (!p) {
        erros.push(`${v.ordem}: não existe`)
        continue
      }
      // **Um achado por vez, cada um com o portão inteiro.** A primeira versão
      // aplicava a perícope como bloco: um conserto errado derrubava os outros
      // quatro do mesmo arquivo, e 22 consertos bons foram perdidos assim numa
      // rodada. O portão continua sendo o mesmo — só o que ele reprova é que
      // ficou menor.
      const entrada = JSON.parse(readFileSync(join(dEntrada, `${v.ordem}.json`), 'utf8'))
      if (!(v.achados ?? []).length) limpas++
      for (const a of v.achados ?? []) {
        try {
          const r = aplicarLeitura(p, { ordem: v.ordem, achados: [a] }, entrada)
          porTipo[a.tipo] = (porTipo[a.tipo] ?? 0) + 1
          cortes += r.cortes
          trocas += r.trocas
        } catch (e) {
          erros.push((e as Error).message)
        }
      }
      feitos.push(f)
    }
    if (feitos.length)
      writeFileSync(join(root, 'data/pericopes.json'), `${JSON.stringify(lista, null, 2)}\n`)
    for (const f of feitos) renameSync(join(d.saida, f), join(aplicados, f))
    console.log(
      `perícopes ${feitos.length} (${limpas} sem achado) · cortes ${cortes} · trocas ${trocas}`,
    )
    for (const [k, n] of Object.entries(porTipo).sort((a, b) => b[1] - a[1]))
      console.log(`  ${k}: ${n}`)
    if (erros.length) {
      console.log(`\nrecusados ${erros.length}:`)
      for (const e of erros.slice(0, 25)) console.log(`  ${e}`)
      if (erros.length > 25) console.log(`  … e mais ${erros.length - 25}`)
    }
    return
  }

  criarDirs(d)
  const total = readdirSync(d.entrada).filter((f) => f.endsWith('.json')).length
  const aps = existsSync(join(d.base, 'aplicados')) ? readdirSync(join(d.base, 'aplicados')).length : 0
  console.log(
    `entrada ${total} · saída ${readdirSync(d.saida).length} · aplicados ${aps} · pendentes ${pendentesAqui(d).length}`,
  )
}

if (process.argv[1]?.endsWith('leitura-larga.ts')) main()
