import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Leitura from './pages/Leitura'
import Jornada from './pages/Jornada'
import Explorar from './pages/Explorar'
import Entrar from './pages/Entrar'
import Ajustes from './pages/Ajustes'
import Sobre from './pages/Sobre'
import Perfil from './pages/Perfil'
import { applyReadingPrefs, getReadingPrefs } from './lib/reading-prefs'
import { getStoredTheme, resolveTheme } from './lib/theme'
import { initSyncTriggers } from './lib/sync'
import { iniciarPrefetch } from './lib/prefetch-catalogo'
import BarraAbas from './components/BarraAbas'

function Shell() {
  const { pathname } = useLocation()
  // Na Leitura quem é o header é o LeituraTopo, que traz o próprio
  // auto-ocultar. Sem header aqui, a barra de abas some junto — ela vive
  // dentro dele — e a marca também, como a spec de navegação pede.
  const naLeitura = pathname.startsWith('/leitura/')

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
      {!naLeitura && (
        <header className="top">
          <NavLink to="/" className="brand">
            {/* <span> e não <img>: a marca tem um arquivo por tema, e um
                background-image trocado no [data-theme] do <html> segue o tema
                sozinho — inclusive quando o sistema muda com a preferência em
                "Sistema" —, sem nenhum estado de React no meio. */}
            <span className="brand-mark" aria-hidden="true" />
            {/* O wordmark executa a tese sozinho: a máquina é a cor, o texto é a
                tinta. Um <span> por parte porque só o "ai" recebe o âmbar. */}
            <span className="brand-wordmark">
              <span className="brand-ai">ai</span>Pericopes
            </span>
          </NavLink>
          {/* Hoje, Explorar, Jornada, Perfil: barra fixa no rodapé no celular,
              nav de texto ao lado da marca a partir de 640px. */}
          <BarraAbas />
        </header>
      )}
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
          <Route path="/perfil" element={<Perfil />} />
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
