import { useEffect, useState } from 'react'

/**
 * Header auto-oculto: esconder ao rolar para baixo além do limiar,
 * mostrar ao rolar para cima ou perto do topo. Só ativo quando enabled.
 */
export function useHideOnScroll(enabled: boolean, threshold = 80): boolean {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setHidden(false)
      return
    }
    let lastY = window.scrollY
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        if (y <= threshold) setHidden(false)
        else if (y > lastY + 4) setHidden(true)
        else if (y < lastY - 4) setHidden(false)
        lastY = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [enabled, threshold])

  return hidden
}
