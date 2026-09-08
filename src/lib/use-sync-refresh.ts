import { useEffect, useRef } from 'react'
import { onSync } from './sync-event'

/**
 * Roda `fn` quando o sync trouxe novidade — é assim que uma tela já aberta
 * mostra o que foi feito em outro aparelho, sem esperar uma navegação.
 *
 * A função vai para um ref, e a inscrição acontece uma vez só: sem isso, ou o
 * efeito dependeria de uma `fn` recriada a cada render (inscrevendo e
 * desinscrevendo sem parar), ou o inscrito ficaria preso ao closure do
 * primeiro render, lendo estado velho.
 */
export function useSyncRefresh(fn: () => void): void {
  const atual = useRef(fn)
  useEffect(() => {
    atual.current = fn
  })
  useEffect(() => onSync(() => atual.current()), [])
}
