// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TempoEstimado } from './TempoEstimado'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('TempoEstimado', () => {
  it('renderiza tempos de leitura e áudio com seus respectivos ícones', () => {
    act(() => {
      root.render(<TempoEstimado leitura={5} audio={6} />)
    })

    expect(host.textContent).toContain('~5 min')
    expect(host.textContent).toContain('~6 min')
    const svgs = host.querySelectorAll('svg')
    expect(svgs.length).toBe(2) // 1 livro, 1 fones
    expect(host.querySelector('.tempo-estimado-leitura')).not.toBeNull()
    expect(host.querySelector('.tempo-estimado-audio')).not.toBeNull()
  })

  it('renderiza durações em horas a partir de 60 min', () => {
    act(() => {
      root.render(<TempoEstimado leitura={120} audio={180} />)
    })

    expect(host.textContent).toContain('~2 h')
    expect(host.textContent).toContain('~3 h')
  })

  it('aceita strings pré-formatadas diretamente', () => {
    act(() => {
      root.render(<TempoEstimado leitura="~15 min" audio="~22 min" />)
    })

    expect(host.textContent).toContain('~15 min')
    expect(host.textContent).toContain('~22 min')
  })

  it('renderiza apenas leitura quando áudio não fornecido', () => {
    act(() => {
      root.render(<TempoEstimado leitura={4} />)
    })

    expect(host.textContent).toContain('~4 min')
    expect(host.querySelector('.tempo-estimado-leitura')).not.toBeNull()
    expect(host.querySelector('.tempo-estimado-audio')).toBeNull()
    const svgs = host.querySelectorAll('svg')
    expect(svgs.length).toBe(1)
  })

  it('renderiza nada quando nem leitura nem áudio fornecidos', () => {
    act(() => {
      root.render(<TempoEstimado />)
    })

    expect(host.innerHTML).toBe('')
  })

  it('permite ocultar ícones individualmente', () => {
    act(() => {
      root.render(<TempoEstimado leitura={3} audio={4} semIconeLeitura semIconeAudio />)
    })

    expect(host.textContent).toContain('~3 min')
    expect(host.textContent).toContain('~4 min')
    const svgs = host.querySelectorAll('svg')
    expect(svgs.length).toBe(0)
  })
})
