import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { IconeVoltar } from './icones'
import { detectarPlataforma, type Plataforma } from '../lib/plataforma'

export type BotaoVoltarProps = {
  /** Rota de destino ao voltar (padrão: '/perfil') */
  to?: string
  /** Rótulo acessível (padrão: 'Voltar para o Perfil') */
  rotulo?: string
  /** Força plataforma para testes ou personalização ('ios' | 'android' | 'padrao') */
  plataforma?: Plataforma
  className?: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Botão de ícone para retorno nas subpáginas (especialmente útil no mobile).
 *
 * Adapta-se visualmente e semanticamente a cada plataforma:
 * - iOS: Chevron sutil ('‹'), área de toque mínima de 44px (HIG) e feedback
 *   tátil com atenuação de opacidade/leve escala.
 * - Android: Seta Material ('←'), área de toque mínima de 48px e feedback
 *   com realce circular de toque.
 */
export function BotaoVoltar({
  to = '/perfil',
  rotulo = 'Voltar para o Perfil',
  plataforma: propPlataforma,
  className,
  onClick,
}: BotaoVoltarProps) {
  const plataforma = propPlataforma ?? detectarPlataforma()
  const iconSize = plataforma === 'android' ? 22 : 20

  return (
    <Link
      to={to}
      className={`botao-voltar botao-voltar--${plataforma}${className ? ` ${className}` : ''}`}
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      data-plataforma={plataforma}
    >
      <IconeVoltar plataforma={plataforma} size={iconSize} />
    </Link>
  )
}

export default BotaoVoltar
