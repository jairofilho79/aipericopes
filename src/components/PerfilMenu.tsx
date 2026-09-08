import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { mostrarPrefsDeLeitura } from '../lib/perfil-secoes'
import { signOutLocal } from '../lib/sync'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { usePopover } from '../lib/use-popover'
import LeituraPrefs from './LeituraPrefs'

const TEMAS: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
]

type Props = {
  /** O header trava o auto-ocultar enquanto o menu está aberto. */
  onOpenChange?: (aberto: boolean) => void
}

/**
 * Tema, tipografia, ajustes e conta num lugar só. Substitui o ThemeMenu solto
 * e o "Aa" da Leitura.
 *
 * O gatilho mostra "Perfil" mesmo deslogado, e nunca "Entrar": tema e
 * tipografia são localStorage e funcionam sem conta, então trocar o item por
 * "Entrar" tiraria as duas de quem não tem conta. Só o último item de dentro
 * do menu muda.
 */
export default function PerfilMenu({ onOpenChange }: Props) {
  const { data: session } = authClient.useSession()
  const { pathname } = useLocation()
  const { open, toggle, close, rootRef, btnRef, popRef } = usePopover()
  const [pref, setPref] = useState<ThemePref>(() => getThemePref())
  const [saindo, setSaindo] = useState(false)
  const [erroSaida, setErroSaida] = useState('')
  const erroSaidaTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    const onTheme = () => setPref(getThemePref())
    window.addEventListener('pericopes-theme', onTheme)
    return () => window.removeEventListener('pericopes-theme', onTheme)
  }, [])

  useEffect(() => () => window.clearTimeout(erroSaidaTimer.current), [])

  async function sair() {
    if (saindo) return
    setSaindo(true)
    setErroSaida('')
    try {
      await signOutLocal()
    } catch {
      // nunca deixar virar rejeição não tratada: o usuário precisa saber
      // (some sozinho depois de um tempo, como o flashAviso da Leitura)
      window.clearTimeout(erroSaidaTimer.current)
      setErroSaida('Não foi possível sair. Tente de novo.')
      erroSaidaTimer.current = window.setTimeout(() => setErroSaida(''), 4000)
    } finally {
      setSaindo(false)
    }
  }

  return (
    <span className="perfil-wrap" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="perfil-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        Perfil
      </button>
      {open && (
        <div
          className="readmenu-pop perfil-pop"
          ref={popRef}
          role="dialog"
          aria-modal="true"
          aria-label="Perfil"
        >
          <p className="perfil-secao">Tema</p>
          <div className="readmenu-row" role="group" aria-label="Tema">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`read-tool${pref === t.id ? ' active' : ''}`}
                aria-pressed={pref === t.id}
                // Uma escolha só: fecha na hora, ao contrário da tipografia,
                // onde a pessoa mexe em várias coisas antes de sair.
                onClick={() => {
                  setThemePref(t.id)
                  close()
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mostrarPrefsDeLeitura(pathname) && (
            <>
              <p className="perfil-secao">Leitura</p>
              <LeituraPrefs />
            </>
          )}

          <div className="perfil-sep" role="separator" />

          <Link className="perfil-item" to="/ajustes" onClick={close}>
            Ajustes
          </Link>

          {/* A página Sobre guarda a atribuição da Bíblia Livre e a divulgação
              de que a narração é voz de IA. Como nada disso aparece na tela de
              leitura, este item é o caminho até lá — tirá-lo daqui esconde a
              divulgação, não só um link. Fica ANTES de Entrar/Sair de
              propósito: o teste do menu ancora esses dois no último item. */}
          <Link className="perfil-item" to="/sobre" onClick={close}>
            Sobre
          </Link>

          {session ? (
            <>
              <button
                type="button"
                className="perfil-item"
                onClick={() => void sair()}
                disabled={saindo}
                title={session.user.email}
              >
                {saindo ? 'Saindo…' : 'Sair'}
              </button>
              {/* Montado desde antes do erro (mesmo padrão de
                  .verse-actions-aviso): uma região aria-live só anuncia
                  mudança de conteúdo se já existir no DOM antes da mudança.
                  Criar o nó já populado no mesmo update não é confiável em
                  leitores de tela. Vive dentro do popover, mas o `sair()` só
                  é alcançável com o popover aberto e nada nele fecha o menu,
                  então a região precede o erro que ela anuncia. Quem usa
                  toque também não vê `title` (precisa de hover), então a
                  falha precisa aparecer na tela, não só ser lida em voz
                  alta — por isso o texto fica visível, não .sr-only. */}
              <span className="nav-conta-erro" role="status" aria-live="polite">
                {erroSaida}
              </span>
            </>
          ) : (
            <Link className="perfil-item" to="/entrar" onClick={close}>
              Entrar
            </Link>
          )}
        </div>
      )}
    </span>
  )
}
