import { useState } from 'react'
import LeituraPrefs from '../components/LeituraPrefs'
import BotaoVoltar from '../components/BotaoVoltar'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

const TEMAS: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
]

/**
 * Centraliza todos os ajustes visuais: seletor de aparência (Sistema/Claro/Escuro)
 * e os controles de tipografia (tamanho, fonte, disposição, entrelinha, largura).
 *
 * Antes esses controles estavam dispersos na página Perfil, ocupando a maior
 * parte do espaço e empurrando Ajustes, Sobre e Entrar/Sair para baixo do fold.
 * A separação em rota própria dá endereço ao conjunto e libera o Perfil para
 * ser uma lista limpa de destinos.
 */
export default function Tema() {
  const [pref, setPref] = useState<ThemePref>(() => getThemePref())

  return (
    <section className="ajustes">
      <div className="subpagina-topo">
        <BotaoVoltar />
        <h1>Tema</h1>
      </div>

      <div className="pref-grupo" role="group" aria-labelledby="tema-aparencia">
        <p className="eyebrow" id="tema-aparencia">
          Aparência
        </p>
        <div className="readmenu-row">
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
      </div>

      <LeituraPrefs />
    </section>
  )
}
