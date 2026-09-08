import { refLabel } from './content'
import type { Pericope } from './types'

export function promptConversa(p: Pericope): string {
  return `Quero conversar sobre o texto ${p.titulo_pericope_pt} (${refLabel(p)}) sobre o(s) seguinte(s) aspecto(s):`
}
