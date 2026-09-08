// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installLocalStorageMock } from '../lib/testing/storage-mock'

installLocalStorageMock()

import LeituraPrefs from './LeituraPrefs'
import { getReadingPrefs } from '../lib/reading-prefs'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar() {
  act(() => root.render(<LeituraPrefs />))
}

/** Botão pelo texto visível, dentro do grupo de `aria-label` dado. */
function botao(grupo: string, rotulo: string): HTMLButtonElement {
  const g = container.querySelector(`[aria-label="${grupo}"]`)
  if (!g) throw new Error(`grupo ausente: ${grupo}`)
  const alvo = [...g.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === rotulo || b.getAttribute('aria-label') === rotulo,
  )
  if (!alvo) throw new Error(`botão ausente: ${rotulo} em ${grupo}`)
  return alvo
}

describe('LeituraPrefs', () => {
  it('mostra os cinco grupos de controle', () => {
    montar()
    const grupos = [...container.querySelectorAll('[role="group"]')].map((g) =>
      g.getAttribute('aria-label'),
    )
    expect(grupos).toEqual([
      'Tamanho do texto',
      'Fonte',
      'Modo do texto bíblico',
      'Espaçamento entre linhas',
      'Largura do texto',
    ])
  })

  it('trocar o layout persiste e marca o botão', () => {
    montar()
    act(() => botao('Modo do texto bíblico', 'Blocos').click())
    expect(getReadingPrefs().layout).toBe('blocos')
    expect(botao('Modo do texto bíblico', 'Blocos').getAttribute('aria-pressed')).toBe('true')
  })

  it('aumentar o texto anda um degrau e re-renderiza sozinho', () => {
    montar()
    const antes = getReadingPrefs().sizeStep
    act(() => botao('Tamanho do texto', 'Aumentar texto').click())
    expect(getReadingPrefs().sizeStep).toBe(antes + 1)
  })

  it('no menor degrau o botão de diminuir fica desabilitado', () => {
    localStorage.setItem('pericopes-reading', JSON.stringify({ sizeStep: 0 }))
    montar()
    expect(botao('Tamanho do texto', 'Diminuir texto').disabled).toBe(true)
  })
})
