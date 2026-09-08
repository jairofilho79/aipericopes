import { useCallback, useEffect, useRef, useState } from 'react'

const FOCAVEIS = 'button:not([disabled])'

/**
 * Para onde o Tab deve pular para o foco não escapar do popover; null
 * quando o navegador pode seguir a ordem normal. Puro, para ser testável.
 */
export function alvoDoTab(
  pop: HTMLElement,
  ativo: Element | null,
  shift: boolean,
): HTMLElement | null {
  const focaveis = [...pop.querySelectorAll<HTMLElement>(FOCAVEIS)]
  if (focaveis.length === 0) return null
  const primeiro = focaveis[0]
  const ultimo = focaveis[focaveis.length - 1]
  // foco fora do popover (ex.: ainda no gatilho) com Shift+Tab entra pelo fim
  if (shift && (ativo === primeiro || !pop.contains(ativo))) return ultimo
  if (!shift && ativo === ultimo) return primeiro
  return null
}

/**
 * Popover ancorado num botão: abre/fecha, foco inicial no primeiro botão,
 * Tab preso dentro, Escape ou clique fora fecham e devolvem o foco ao gatilho.
 * Quem usa liga `rootRef` no wrapper, `btnRef` no gatilho e `popRef` no dialog.
 */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  /** Fecha devolvendo o foco ao gatilho — para quem fecha ao escolher uma opção. */
  const close = useCallback(() => {
    setOpen(false)
    btnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const pop = popRef.current
    pop?.querySelector<HTMLElement>(FOCAVEIS)?.focus()

    function fechar() {
      setOpen(false)
      // foco volta ao gatilho também quando o fechamento vem de toque fora
      btnRef.current?.focus()
    }
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) fechar()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        fechar()
        return
      }
      if (e.key !== 'Tab' || !pop) return
      const alvo = alvoDoTab(pop, document.activeElement, e.shiftKey)
      if (!alvo) return
      e.preventDefault()
      alvo.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, toggle, close, rootRef, btnRef, popRef }
}
