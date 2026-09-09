import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LeituraPrefs from '../components/LeituraPrefs'
import { authClient } from '../lib/auth-client'
import { signOutLocal } from '../lib/sync'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

const TEMAS: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
]

/**
 * Tema, tipografia, ajustes e conta num lugar só. Sucede o popover
 * PerfilMenu: mesma tese ("um lugar só"), container diferente.
 *
 * Ser rota em vez de popover é o que resolve o defeito que motivou a
 * mudança: a divulgação obrigatória (voz de IA, licença do texto bíblico)
 * ficava a dois toques dentro de um menu, e um deles num alvo pequeno.
 *
 * A tipografia aparece sempre, sem perguntar de onde a pessoa veio: um
 * endereço próprio não tem contexto de origem para consultar.
 */
export default function Perfil() {
  const { data: session } = authClient.useSession()
  const [pref, setPref] = useState<ThemePref>(() => getThemePref())
  const [saindo, setSaindo] = useState(false)
  const [erroSaida, setErroSaida] = useState('')
  const erroSaidaTimer = useRef<number | undefined>(undefined)

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
    <section className="ajustes">
      <h1>Perfil</h1>

      <p className="perfil-secao">Tema</p>
      <div className="readmenu-row" role="group" aria-label="Tema">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`read-tool${pref === t.id ? ' active' : ''}`}
            aria-pressed={pref === t.id}
            onClick={() => {
              setThemePref(t.id)
              setPref(t.id)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="perfil-secao">Leitura</p>
      <LeituraPrefs />

      <div className="perfil-sep" role="separator" />

      <Link className="perfil-item" to="/ajustes">
        Ajustes
      </Link>

      {/* A página Sobre guarda a atribuição da Bíblia Livre e a divulgação
          de que a narração é voz de IA. Como nada disso aparece na tela de
          leitura, este item é o caminho até lá — tirá-lo daqui esconde a
          divulgação, não só um link. Fica ANTES de Entrar/Sair de propósito:
          o teste da página ancora esses dois no último item. */}
      <Link className="perfil-item" to="/sobre">
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
              .verse-actions-aviso): uma região aria-live só anuncia mudança
              de conteúdo se já existir no DOM antes da mudança. Criar o nó já
              populado no mesmo update não é confiável em leitores de tela.
              Numa página isso é ainda mais claro que no popover de antes: a
              região monta junto com a rota, muito antes de haver um toque em
              "Sair". Quem usa toque também não vê `title` (precisa de hover),
              então a falha precisa aparecer na tela, não só ser lida em voz
              alta — por isso o texto fica visível, não .sr-only. */}
          <span className="nav-conta-erro" role="status" aria-live="polite">
            {erroSaida}
          </span>
        </>
      ) : (
        <Link className="perfil-item" to="/entrar">
          Entrar
        </Link>
      )}
    </section>
  )
}
