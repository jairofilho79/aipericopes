/**
 * Monta o dossiê de uma perícope para o leitor cético: o texto bíblico e os
 * cinco campos, e nada mais. O leitor não deve ver ordem de produção, notas de
 * revisão nem histórico — ele julga o que o usuário final vê.
 *
 * uso: node .claude/skills/leitor-cetico/scripts/dossie.mjs <ordem> [<ordem>...]
 */
import { readFileSync } from 'node:fs'

const arr = JSON.parse(readFileSync('data/pericopes.json', 'utf8'))
const porOrdem = new Map(arr.map((p) => [p.ordem, p]))

for (const a of process.argv.slice(2)) {
  const p = porOrdem.get(Number(a))
  if (!p) {
    console.error(`ordem ${a} não existe`)
    continue
  }
  const faixa =
    p.capitulo_inicio === p.capitulo_fim
      ? `${p.capitulo_inicio}:${p.versiculo_inicio}-${p.versiculo_fim}`
      : `${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`
  console.log(`\n${'='.repeat(70)}\nordem ${p.ordem} · ${p.livro} ${faixa}\n${'='.repeat(70)}`)
  console.log(`\n--- TEXTO BÍBLICO ---\n${p.texto}`)
  for (const campo of [
    'titulo_pericope_pt',
    'contexto_historico_literario',
    'resenha',
    'perguntas_reflexao',
    'topicos_pregar',
  ]) {
    const v = p[campo]
    console.log(`\n--- ${campo} ---\n${Array.isArray(v) ? v.map((x) => `- ${x}`).join('\n') : v}`)
  }
}
