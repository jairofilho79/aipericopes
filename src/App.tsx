import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Leitura from './pages/Leitura'
import Jornada from './pages/Jornada'
import Explorar from './pages/Explorar'
import Entrar from './pages/Entrar'
import Ajustes from './pages/Ajustes'
import Sobre from './pages/Sobre'
import { applyReadingPrefs, getReadingPrefs } from './lib/reading-prefs'
import { getStoredTheme, resolveTheme } from './lib/theme'
import { initSyncTriggers } from './lib/sync'
import { useHideOnScroll } from './lib/use-hide-on-scroll'
import { iniciarPrefetch } from './lib/prefetch-catalogo'
import PerfilMenu from './components/PerfilMenu'

function Shell() {
  const { pathname } = useLocation()
  const [perfilAberto, setPerfilAberto] = useState(false)
  // Com o menu aberto o header fica travado: rolar levaria o popover embora.
  const headerHidden = useHideOnScroll(pathname.startsWith('/leitura/') && !perfilAberto)

  useEffect(() => {
    applyReadingPrefs(getReadingPrefs())
  }, [])

  useEffect(() => {
    initSyncTriggers()
    iniciarPrefetch()
  }, [])

  // Sem preferência gravada, o app segue o sistema em tempo real. Só o
  // dataset muda: o Perfil mostra a preferência ("Sistema"), não o resolvido.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      if (getStoredTheme() !== null) return
      document.documentElement.dataset.theme = resolveTheme()
    }
    mq.addEventListener('change', onSystem)
    return () => mq.removeEventListener('change', onSystem)
  }, [])

  return (
    <div className="shell">
      <header className={`top${headerHidden ? ' top-hidden' : ''}`}>
        <NavLink to="/" className="brand">
          {/* favicon.svg e não brand/logo.png: o SVG é a fonte de verdade da
              marca — os PNGs são rasterizados dele por scripts/gerar-icones.sh,
              então aqui vale usar o original, que escala sem perda. */}
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={32}
            height={32}
          />
          {/* O wordmark executa a tese sozinho: a máquina é a cor, o texto é a
              tinta. Um <span> por parte porque só o "ai" recebe o âmbar. */}
          <span className="brand-wordmark">
            <span className="brand-ai">ai</span>Pericopes
          </span>
        </NavLink>
        {/* "Hoje" saiu: a marca à esquerda já é o mesmo <NavLink to="/">. */}
        <nav>
          <NavLink to="/jornada">Jornada</NavLink>
          <NavLink to="/explorar">Explorar</NavLink>
          {/* PerfilMenu absorve Ajustes, Sair e Entrar — a entrada solta de
              /ajustes que a fase de releitura pôs na nav mudou de lugar para
              dentro dele, como o comentário dela previa. */}
          <PerfilMenu onOpenChange={setPerfilAberto} />
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/leitura/:ordem" element={<Leitura />} />
          <Route path="/jornada" element={<Jornada />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/indice" element={<Navigate to="/explorar" replace />} />
          <Route path="/pesquisar" element={<Navigate to="/explorar" replace />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/sobre" element={<Sobre />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
