/**
 * Script auxiliar para subagentes salvarem e validarem revisões editoriais.
 * 
 * Uso pelo subagente:
 *   1. O subagente escreve o JSON em data/revisoes/{ordem}.json
 *   2. Executa: npx tsx scripts/salvar-revisao.ts data/revisoes/{ordem}.json
 *   3. Se houver erro de validação mecânica ou âncora de título, retorna erro legível para o subagente corrigir.
 *   4. Se passar, atualiza data/enriched/{ordem}.json, data/pericopes.json, roteiro.jsonl e pipeline-estado.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validarMaterial, type Material } from './validar-material.ts'
import { ancorar } from './titulos-ancorados.ts'
import { blocosDaResenha } from '../src/lib/paragraphize.ts'
import { atualizarEstado, sincronizarRoteiro } from './esteira.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pericopesPath = join(root, 'data', 'pericopes.json')

function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Uso: npx tsx scripts/salvar-revisao.ts <data/revisoes/1630.json | 1630>')
    process.exit(1)
  }

  let arquivo = arg
  if (/^\d+$/.test(arg)) {
    arquivo = join(root, 'data', 'revisoes', `${arg}.json`)
  }

  if (!existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`)
    process.exit(1)
  }

  const bruto = readFileSync(arquivo, 'utf8')
  let mat: Material
  try {
    mat = JSON.parse(bruto)
  } catch (err: any) {
    console.error(`JSON inválido em ${arquivo}: ${err.message}`)
    process.exit(1)
  }

  const ordem = mat.ordem
  const enrichedPath = join(root, 'data', 'enriched', `${ordem}.json`)
  if (!existsSync(enrichedPath)) {
    console.error(`data/enriched/${ordem}.json não encontrado.`)
    process.exit(1)
  }

  const periOriginal = JSON.parse(readFileSync(enrichedPath, 'utf8'))
  const textoBiblico = periOriginal.texto

  // 1. Validação Mecânica (validarMaterial)
  const vMec = validarMaterial({ texto: textoBiblico, livro: periOriginal.livro }, mat, bruto)
  if (vMec.problemas.length > 0) {
    console.error(`❌ REPROVADO na validação mecânica:\n- ${vMec.problemas.join('\n- ')}`)
    process.exit(1)
  }

  // 2. Validação de Âncora do Título
  const vAncora = ancorar(mat.titulo_pericope_pt, textoBiblico)
  if (!vAncora.ancorado) {
    console.error(
      `❌ REPROVADO: Título "${mat.titulo_pericope_pt}" não está ancorado no texto bíblico da perícope (deve conter pelo menos 1 nome próprio ou 2 palavras de conteúdo da passagem).`,
    )
    process.exit(1)
  }

  // 3. Atualiza data/enriched/{ordem}.json
  const atualizado = { ...periOriginal, ...mat }
  writeFileSync(enrichedPath, JSON.stringify(atualizado, null, 2), 'utf8')

  // 4. Atualiza data/pericopes.json
  const pericopes = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
  const idx = pericopes.findIndex((p) => p.ordem === ordem)
  if (idx !== -1) {
    pericopes[idx] = {
      ...pericopes[idx],
      titulo_pericope_pt: mat.titulo_pericope_pt,
      contexto_historico_literario: mat.contexto_historico_literario,
      resenha: mat.resenha,
      perguntas_reflexao: mat.perguntas_reflexao,
      topicos_pregar: mat.topicos_pregar,
    }
    writeFileSync(pericopesPath, JSON.stringify(pericopes, null, 2), 'utf8')
  }

  // 5. Sincroniza roteiro.jsonl
  sincronizarRoteiro(ordem, mat, periOriginal.livro)

  // 6. Atualiza pipeline-estado.json
  atualizarEstado(ordem, { revisado: true }, { livro: periOriginal.livro, ref: `${periOriginal.abbrev} (ordem ${ordem})` })

  console.log(`✅ [${ordem}] Revisão de "${mat.titulo_pericope_pt}" validada e salva com sucesso! Pronto para áudio.`)
}

main()
