/**
 * Uma pergunta, uma resposta: **este acervo pode ser narrado?**
 *
 * A Sessão 4 grava noutra sessão e às vezes noutra máquina, e narrar é caro e
 * irreversível. Até aqui a resposta estava espalhada por seis scripts, e foi
 * assim que o congelamento passou semanas descrevendo um material que já não
 * existia: ninguém rodava tudo junto, então ninguém via a contradição.
 *
 * Este script roda todas as réguas contra `data/pericopes.json` — o mesmo
 * arquivo que `shard-catalogo.ts` publica e que a narração lê — e sai com
 * código 1 se alguma reprovar. Não conserta nada. Só responde.
 *
 * Usage: npx tsx scripts/pronto-para-narrar.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validarMaterial, type Material } from './validar-material.ts'
import { dirs } from './reenriquecimento.ts'
import { varrer } from './varrer-registro.ts'
import { colisoes } from './titulos-colididos.ts'
import { pendentes } from './invencoes-pendentes.ts'
import { todasPenduradas, penduradaSemPagar } from './frase-pendurada.ts'
import type { Achado } from './invencao-fila.ts'

const root = join(import.meta.dirname, '..')

type Regua = {
  nome: string
  falhas: string[]
  porque: string
  /** Falso quando a régua acha CANDIDATO e não defeito: ela conta, não reprova. */
  bloqueia: boolean
}

export function reguas(
  material: Record<string, unknown>[],
  entradas: Map<number, { texto: string }>,
  achados: Achado[],
): Regua[] {
  const r: Regua[] = []

  r.push({
    nome: 'o portão do material',
    bloqueia: true,
    porque: 'campo faltando, teto de parágrafos, citação inventada, número que o TTS lê literal',
    falhas: material.flatMap((m) => {
      const e = entradas.get(m.ordem as number)
      if (!e) return []
      const v = validarMaterial(e, m as unknown as Material, JSON.stringify(m))
      return v.problemas.map((p) => `${m.abbrev} ${m.capitulo_inicio}: ${p}`)
    }),
  })

  r.push({
    nome: 'invenção',
    bloqueia: true,
    porque: 'o material afirma o que a Escritura desmente — e isso vira áudio pago',
    falhas: pendentes(material, achados).vivas.map((v) => `${v.ref}: "${v.afirma.slice(0, 70)}…"`),
  })

  // **Conta, não reprova.** O molde acha a FORMA, e a forma serve também para a
  // frase que entrega — "Guarde o nome de Nabote: é na propriedade dele que…"
  // carrega o fato e não se corta. A campanha de setembro julgou 948 destas uma
  // a uma e marcou 283 como `entrega`, porque a frase SEGUINTE paga o que esta
  // anuncia — e nenhuma régua automática enxerga isso. Tratá-las como defeito
  // seguraria 503 perícopes boas na porta, que é o quinto caso desta sessão de
  // uma medida mecânica medindo a coisa errada.
  r.push({
    nome: 'frases no molde do ponteiro (candidatas, já julgadas)',
    bloqueia: false,
    porque: 'a forma que a campanha varreu; quem separa entrega de pendurada é leitura, não regex',
    falhas: material.flatMap((m) =>
      [
        ...todasPenduradas(String(m.contexto_historico_literario ?? '')),
        ...todasPenduradas(String(m.resenha ?? '')),
      ]
        .filter(penduradaSemPagar)
        .map((f) => `${m.abbrev} ${m.capitulo_inicio}: "${f.slice(0, 70)}…"`),
    ),
  })

  r.push({
    nome: 'registro',
    bloqueia: true,
    porque: 'coloquialismo que o dono não quer na voz do app',
    falhas: material.flatMap((m) => varrer(m).map((s) => `${m.abbrev} ${m.capitulo_inicio}: ${s.trecho ?? ''}`)),
  })

  r.push({
    nome: 'títulos que colidem',
    bloqueia: true,
    porque: 'dois títulos indistinguíveis são dois trechos que o leitor não separa',
    falhas: colisoes(
      material.map((m) => ({ ordem: m.ordem as number, titulo: String(m.titulo_pericope_pt) })),
    )
      .filter((c) => c.forca >= 0.7)
      .map((c) => `${c.a.ordem} × ${c.b.ordem}: "${c.a.titulo}" / "${c.b.titulo}"`),
  })

  return r
}

function main() {
  const material = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<
    string,
    unknown
  >[]
  const dEntrada = dirs(join(root, 'data/reenriquecimento')).entrada
  const entradas = new Map<number, { texto: string }>()
  for (const m of material) {
    const f = join(dEntrada, `${m.ordem}.json`)
    if (existsSync(f)) entradas.set(m.ordem as number, JSON.parse(readFileSync(f, 'utf8')))
  }
  const dirInv = join(root, 'data/invencao/saida')
  const achados = existsSync(dirInv)
    ? readdirSync(dirInv)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(dirInv, f), 'utf8')) as Achado)
    : []

  const rs = reguas(material, entradas, achados)
  console.log(`${material.length} perícopes em data/pericopes.json\n`)
  let total = 0
  for (const r of rs) {
    if (r.bloqueia) total += r.falhas.length
    const marca = !r.bloqueia ? '  --  ' : r.falhas.length === 0 ? '  ok  ' : ' FALHA'
    console.log(`${marca}  ${r.nome} — ${r.falhas.length}`)
    if (r.falhas.length && r.bloqueia) {
      console.log(`         (${r.porque})`)
      for (const f of r.falhas.slice(0, 12)) console.log(`         ${f}`)
      if (r.falhas.length > 12) console.log(`         … e mais ${r.falhas.length - 12}`)
    }
  }
  if (total === 0) {
    console.log('\nPRONTO PARA NARRAR.')
    return
  }
  console.log(`\n${total} pendência(s). O congelamento segura o que falhou; rode congelar.ts.`)
  process.exitCode = 1
}

if (process.argv[1]?.endsWith('pronto-para-narrar.ts')) main()
