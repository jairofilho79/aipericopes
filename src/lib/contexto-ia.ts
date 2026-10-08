import { refLabel } from './content'
import type { Pericope } from './types'

export type ChipsContexto = {
  contexto: boolean
  texto: boolean
  resenha: boolean
  reflexoes: boolean
}

export function promptConversa(p: Pericope): string {
  return `Quero conversar sobre o texto ${p.titulo_pericope_pt} (${refLabel(p)}) sobre o(s) seguinte(s) aspecto(s):`
}

export function montarPromptPericope(p: Pericope, chips: ChipsContexto): string {
  const inclusos: string[] = []
  if (chips.texto) inclusos.push('o texto bíblico')
  if (chips.contexto) inclusos.push('o contexto histórico')
  if (chips.resenha) inclusos.push('a resenha explicativa')
  if (chips.reflexoes) inclusos.push('as perguntas de reflexão')

  const lista = inclusos.join(', ')
  return `Quero conversar sobre ${p.titulo_pericope_pt} (${refLabel(p)}), considerando ${lista}. Gostaria de refletir sobre:`
}

export function montarMaterialApoio(p: Pericope, chips: ChipsContexto): string {
  const blocos: string[] = []
  if (chips.texto && p.texto) {
    blocos.push(`[Texto Bíblico - ${refLabel(p)}]\n${p.texto}`)
  }
  if (chips.contexto && p.contexto_historico_literario) {
    blocos.push(`[Contexto Histórico-Literário]\n${p.contexto_historico_literario}`)
  }
  if (chips.resenha && p.resenha) {
    blocos.push(`[Resenha]\n${p.resenha}`)
  }
  if (chips.reflexoes && p.perguntas_reflexao?.length) {
    blocos.push(`[Perguntas de Reflexão]\n${p.perguntas_reflexao.map((q, i) => `${i + 1}. ${q}`).join('\n')}`)
  }
  return blocos.join('\n\n')
}
