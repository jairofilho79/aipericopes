// @vitest-environment happy-dom
// @ts-expect-error React act environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BotaoVoltar } from './BotaoVoltar'

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...resto }: { to: string; children: unknown }) => (
    <a href={to} {...resto}>
      {children as never}
    </a>
  ),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('BotaoVoltar', () => {
  it('aponta para /perfil por padrão', () => {
    act(() => root.render(<BotaoVoltar />))
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/perfil')
    expect(link?.getAttribute('aria-label')).toBe('Voltar para o Perfil')
  })

  it('permite rota e rótulo customizados', () => {
    act(() => root.render(<BotaoVoltar to="/jornada" rotulo="Voltar para Jornada" />))
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/jornada')
    expect(link?.getAttribute('aria-label')).toBe('Voltar para Jornada')
    expect(link?.getAttribute('title')).toBe('Voltar para Jornada')
  })

  it('renderiza estilo e ícone de iOS quando plataforma for ios', () => {
    act(() => root.render(<BotaoVoltar plataforma="ios" />))
    const link = container.querySelector('a')
    expect(link?.classList.contains('botao-voltar--ios')).toBe(true)
    expect(link?.getAttribute('data-plataforma')).toBe('ios')
    // No iOS usa chevron (polyline points="15 18 9 12 15 6")
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('points')).toBe('15 18 9 12 15 6')
    // Não tem linha horizontal de haste (comum da seta Material)
    expect(container.querySelector('line')).toBeNull()
  })

  it('renderiza estilo e ícone de Android quando plataforma for android', () => {
    act(() => root.render(<BotaoVoltar plataforma="android" />))
    const link = container.querySelector('a')
    expect(link?.classList.contains('botao-voltar--android')).toBe(true)
    expect(link?.getAttribute('data-plataforma')).toBe('android')
    // No Android usa seta Material com linha horizontal (line x1="19" y1="12" x2="5" y2="12")
    const line = container.querySelector('line')
    expect(line?.getAttribute('x1')).toBe('19')
    expect(line?.getAttribute('x2')).toBe('5')
  })

  it('dispara onClick quando clicado', () => {
    const fn = vi.fn()
    act(() => root.render(<BotaoVoltar onClick={fn} />))
    const link = container.querySelector('a')
    act(() => link?.click())
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
