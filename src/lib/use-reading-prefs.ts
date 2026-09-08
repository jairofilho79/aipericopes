import { useEffect, useState } from 'react'
import { getReadingPrefs, onReadingPrefs, type ReadingPrefs } from './reading-prefs'

/**
 * As preferências de leitura correntes, sincronizadas entre quem as edita (o
 * menu Perfil, no header) e quem as consome (a Leitura, que decide
 * corrido/blocos por `layout`).
 *
 * Não devolve setter de propósito: quem muda chama os `setReading*` de
 * `reading-prefs.ts`, que aplicam e avisam. Um setter aqui abriria um segundo
 * caminho de escrita que não persiste.
 */
export function useReadingPrefs(): ReadingPrefs {
  const [prefs, setPrefs] = useState<ReadingPrefs>(getReadingPrefs)
  useEffect(() => onReadingPrefs(() => setPrefs(getReadingPrefs())), [])
  return prefs
}
