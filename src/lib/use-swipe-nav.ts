import { useEffect, useRef, type RefObject } from 'react'
import { hasOpenDialog } from './use-keyboard-nav'

/** Deslocamento horizontal mínimo para o gesto valer como navegação. */
export const SWIPE_MIN_X = 70

/** Acima disso o dedo estava passeando, não deslizando. */
export const SWIPE_MAX_MS = 600

/**
 * Decisão pura do gesto: horizontal o bastante, longo o bastante e rápido o
 * bastante. A razão 2:1 é o que separa "deslizar de lado" de "rolar meio
 * torto" — na dúvida a rolagem vertical ganha.
 */
export function shouldSwipe(dx: number, dy: number, dt: number): boolean {
  if (dt > SWIPE_MAX_MS) return false
  if (Math.abs(dx) < SWIPE_MIN_X) return false
  return Math.abs(dx) >= 2 * Math.abs(dy)
}

export type UseSwipeNavOpts = {
  onPrev: () => void
  onNext: () => void
  enabled: boolean
}

/**
 * Swipe horizontal no elemento raiz da leitura: para a esquerda ⇒ próxima,
 * para a direita ⇒ anterior. Listeners passivos e sem `preventDefault` — a
 * rolagem vertical e o back-swipe do sistema continuam intactos.
 */
export function useSwipeNav(
  ref: RefObject<HTMLElement | null>,
  { onPrev, onNext, enabled }: UseSwipeNavOpts,
): void {
  // Callbacks num ref: mudam a cada render (fecham sobre prev/next), mas não
  // podem re-assinar os listeners no meio de um gesto.
  const cbs = useRef({ onPrev, onNext })
  useEffect(() => {
    cbs.current = { onPrev, onNext }
  }, [onPrev, onNext])

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return

    let x0 = 0
    let y0 = 0
    let t0 = 0
    let ativo = false
    let dentroDosChips = false

    const onStart = (e: TouchEvent) => {
      // Multitoque é pinça/zoom, nunca navegação.
      if (e.touches.length !== 1) {
        ativo = false
        return
      }
      const t = e.touches[0]
      x0 = t.clientX
      y0 = t.clientY
      t0 = Date.now()
      ativo = true
      // Barra de chips rola horizontalmente por conta própria: um arrasto ali
      // é rolagem da barra, não swipe de navegação entre perícopes.
      dentroDosChips =
        (t.target as Element | null)?.closest?.('.section-chips') != null
    }

    const onCancel = () => {
      ativo = false
    }

    const onEnd = (e: TouchEvent) => {
      if (!ativo) return
      ativo = false
      if (dentroDosChips) return
      // Mesmo guard do teclado (por isso vem de lá, e não duplicado aqui): com
      // a barra de ações ou o popover de preferências abertos, o gesto é da
      // caixa aberta. Hoje o efeito seria inócuo — a barra fecha na navegação
      // —, mas as duas formas de navegar não podem discordar sobre isso.
      if (hasOpenDialog(document)) return
      if (e.changedTouches.length !== 1) return
      // Seleção de texto viva: o dedo estava arrastando as alças da seleção,
      // não pedindo a próxima perícope.
      if (window.getSelection()?.isCollapsed === false) return
      const t = e.changedTouches[0]
      const dx = t.clientX - x0
      if (!shouldSwipe(dx, t.clientY - y0, Date.now() - t0)) return
      if (dx < 0) cbs.current.onNext()
      else cbs.current.onPrev()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, enabled])
}
