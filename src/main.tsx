import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource-variable/eb-garamond'
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/source-sans-3'
import './styles/app.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
