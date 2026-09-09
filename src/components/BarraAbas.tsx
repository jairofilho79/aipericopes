import { NavLink } from 'react-router-dom'
import { IconeCasa, IconeBussola, IconeTrilha, IconePessoa } from './icones-nav'

/**
 * As quatro abas do app. Barra fixa no rodapé no celular, nav de texto ao lado
 * da marca a partir de 640px — a diferença é toda de CSS, o markup é um só.
 *
 * `.active` e `aria-current="page"` saem do próprio NavLink; nada aqui calcula
 * rota ativa. `to="/"` dispensa `end`: no React Router 7 a raiz só casa exata.
 */
export default function BarraAbas() {
  return (
    <nav className="tab-bar" aria-label="Navegação principal">
      <NavLink to="/" className="tab">
        <IconeCasa />
        <span className="tab-rotulo">Hoje</span>
        <span className="tab-indicador" aria-hidden="true" />
      </NavLink>
      <NavLink to="/explorar" className="tab">
        <IconeBussola />
        <span className="tab-rotulo">Explorar</span>
        <span className="tab-indicador" aria-hidden="true" />
      </NavLink>
      <NavLink to="/jornada" className="tab">
        <IconeTrilha />
        <span className="tab-rotulo">Jornada</span>
        <span className="tab-indicador" aria-hidden="true" />
      </NavLink>
      <NavLink to="/perfil" className="tab">
        <IconePessoa />
        <span className="tab-rotulo">Perfil</span>
        <span className="tab-indicador" aria-hidden="true" />
      </NavLink>
    </nav>
  )
}
