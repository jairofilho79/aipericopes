import type { Pericope } from './types'

export type Testament = 'vt' | 'nt'

/** Abbrevs do NT (cânon protestante, NAA). */
const NT_ABBREVS = new Set([
  'Mt',
  'Mc',
  'Lc',
  'Jo',
  'At',
  'Rm',
  '1Co',
  '2Co',
  'Gl',
  'Ef',
  'Fp',
  'Cl',
  '1Ts',
  '2Ts',
  '1Tm',
  '2Tm',
  'Tt',
  'Fm',
  'Hb',
  'Tg',
  '1Pe',
  '2Pe',
  '1Jo',
  '2Jo',
  '3Jo',
  'Jd',
  'Ap',
])

export function testamentOf(p: Pick<Pericope, 'abbrev'>): Testament {
  return NT_ABBREVS.has(p.abbrev) ? 'nt' : 'vt'
}

export function testamentLabel(t: Testament): string {
  return t === 'vt' ? 'Velho Testamento' : 'Novo Testamento'
}
