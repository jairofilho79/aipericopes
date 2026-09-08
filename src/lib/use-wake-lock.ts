import { useEffect } from 'react'

export type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
}

export type WakeLockLike = {
  request: (tipo: 'screen') => Promise<WakeLockSentinelLike>
}

/**
 * A Wake Lock API só existe em contexto seguro e em parte dos browsers — o
 * acesso passa por `unknown` de propósito, para o guard valer igual em
 * ambientes cuja `lib.dom` não declara `navigator.wakeLock`.
 */
export function wakeLockDe(nav: Navigator | undefined): WakeLockLike | null {
  const wl = (nav as unknown as { wakeLock?: WakeLockLike } | undefined)?.wakeLock
  return wl && typeof wl.request === 'function' ? wl : null
}

export function wakeLockSupported(nav: Navigator | undefined): boolean {
  return wakeLockDe(nav) !== null
}

/**
 * Mantém a tela acesa enquanto `enabled` e o documento visível. O sistema solta
 * o lock ao minimizar, então o hook re-adquire em `visibilitychange`. Todo erro
 * (`NotAllowedError` em modo de economia de bateria, aba em segundo plano, API
 * ausente) morre em silêncio: no pior caso a tela apaga como sempre apagou.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const wl = wakeLockDe(typeof navigator === 'undefined' ? undefined : navigator)
    if (!wl) return

    let vivo = true
    let sentinel: WakeLockSentinelLike | null = null
    // Guarda contra pedidos concorrentes: `visibilitychange` pode disparar de
    // novo enquanto um `request()` anterior ainda está no ar, e sem isso os
    // dois criam sentinelas em paralelo (uma delas vaza, sem nunca ser solta).
    let emVoo = false

    const soltar = (s: WakeLockSentinelLike | null) => {
      if (s && !s.released) void s.release().catch(() => undefined)
    }

    const pedir = async () => {
      if (!vivo || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      if (emVoo) return
      emVoo = true
      try {
        const novo = await wl.request('screen')
        // O efeito pode ter sido limpo, OU outro pedido pode ter vencido a
        // corrida enquanto esta promessa estava no ar — nos dois casos esta
        // sentinela é supérflua e não pode substituir a que já está viva.
        if (!vivo || (sentinel && !sentinel.released)) {
          soltar(novo)
          return
        }
        sentinel = novo
      } catch {
        // Falha aqui não pode zerar uma sentinela viva de um pedido que
        // tenha vencido a corrida antes deste `catch` rodar.
      } finally {
        emVoo = false
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', onVisibility)
      const atual = sentinel
      sentinel = null
      soltar(atual)
    }
  }, [enabled])
}
