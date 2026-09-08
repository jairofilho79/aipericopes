/**
 * Confere o que o leitor cético devolveu, ANTES de qualquer coisa ser apagada.
 *
 * A regra que faz o sistema inteiro ficar de pé: **um corte só vale se a frase
 * existir byte a byte no campo que o leitor nomeou.** Um leitor que parafraseia
 * a frase que quer cortar está inventando — talvez de boa fé, mas o resultado é
 * o mesmo: se a gente aceitasse, apagaria texto que ninguém leu.
 *
 * Também recusa dívida sem âncora: `faltou:` sem `ancora` é erudição de ouvido,
 * e é exatamente o risco que o piloto de contextos mediu (25 de 40 dependiam de
 * uma afirmação sobre costume antigo que nenhum portão conferia).
 *
 * uso: node .claude/skills/leitor-cetico/scripts/conferir.mjs <achados.json>
 *
 * formato do achados.json:
 *   [{ ordem, corta: [{campo, frase, porque}], faltou: [{campo, o_que, ancora, porque}] }]
 */
import { readFileSync } from 'node:fs'

const CAMPOS = new Set([
  'titulo_pericope_pt',
  'contexto_historico_literario',
  'resenha',
  'perguntas_reflexao',
  'topicos_pregar',
])

const arr = JSON.parse(readFileSync('data/pericopes.json', 'utf8'))
const porOrdem = new Map(arr.map((p) => [p.ordem, p]))
const achados = JSON.parse(readFileSync(process.argv[2], 'utf8'))

const texto = (p, campo) => {
  const v = p[campo]
  return Array.isArray(v) ? v.join('\n') : (v ?? '')
}

let cortesOk = 0
let dividasOk = 0
let enriqOk = 0
const recusas = []

for (const a of achados) {
  const p = porOrdem.get(a.ordem)
  if (!p) {
    recusas.push(`ordem ${a.ordem}: não existe`)
    continue
  }
  for (const c of a.corta ?? []) {
    if (!CAMPOS.has(c.campo)) {
      recusas.push(`${a.ordem} corta: campo desconhecido "${c.campo}"`)
    } else if (!texto(p, c.campo).includes(c.frase)) {
      // A causa quase sempre é aspa curva trocada por reta, ou reticências
      // colapsadas. Não normalizo: normalizar aqui é abrir a porta para o
      // corte aproximado, e o corte aproximado apaga a frase vizinha.
      recusas.push(`${a.ordem} corta: frase não está em ${c.campo} — "${c.frase.slice(0, 70)}…"`)
    } else if (!c.porque?.trim()) {
      recusas.push(`${a.ordem} corta: sem justificativa — "${c.frase.slice(0, 50)}…"`)
    } else cortesOk++
  }
  for (const f of a.faltou ?? []) {
    if (!CAMPOS.has(f.campo)) recusas.push(`${a.ordem} faltou: campo desconhecido "${f.campo}"`)
    else if (!f.ancora?.trim())
      recusas.push(`${a.ordem} faltou: sem âncora — "${(f.o_que ?? '').slice(0, 60)}…"`)
    else if (!f.o_que?.trim()) recusas.push(`${a.ordem} faltou: sem o quê`)
    else if (!['divida', 'dívida', 'enriquecimento'].includes((f.forca ?? '').toLowerCase()))
      // Sem separar as duas forças, tudo vira reescrita e material bom entra na
      // fila junto com o defeituoso.
      recusas.push(`${a.ordem} faltou: forca deve ser "divida" ou "enriquecimento" (veio "${f.forca ?? ''}")`)
    // Contadas SEPARADAS de propósito: somar as duas e imprimir "dívidas" faria
    // enriquecimento entrar na fila de reescrita junto com defeito — que é a
    // coisa exata que a separação existe para impedir.
    else if (['divida', 'dívida'].includes(f.forca.toLowerCase().trim())) dividasOk++
    else enriqOk++
  }
}

console.log(`perícopes lidas: ${achados.length}`)
console.log(`cortes aceitos:  ${cortesOk}`)
console.log(`dívidas aceitas: ${dividasOk}`)
console.log(`enriquecimentos:  ${enriqOk}  (anotar, NÃO mandar para reescrita)`)
console.log(`recusadas:       ${recusas.length}`)
for (const r of recusas) console.log(`  ✗ ${r}`)
process.exit(recusas.length ? 1 : 0)
