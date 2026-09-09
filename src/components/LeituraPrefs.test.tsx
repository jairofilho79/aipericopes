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

/** Botão pelo texto visível, dentro do grupo cujo rótulo na tela é `grupo`. */
function botao(grupo: string, rotulo: string): HTMLButtonElement {
  const g = [...container.querySelectorAll('.pref-grupo')].find(
    (c) => c.querySelector('.eyebrow')?.textContent?.trim() === grupo,
  )
  if (!g) throw new Error(`grupo ausente: ${grupo}`)
  const alvo = [...g.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === rotulo || b.getAttribute('aria-label') === rotulo,
  )
  if (!alvo) throw new Error(`botão ausente: ${rotulo} em ${grupo}`)
  return alvo
}

describe('LeituraPrefs', () => {
  // Cada grupo tem rótulo VISÍVEL e é ele que dá o nome acessível: um
  // `aria-label` paralelo diria uma coisa ao leitor de tela e outra a quem
  // olha, e era o que fazia "Corrido | Blocos" não explicar nada na tela.
  it('mostra os cinco grupos, cada um nomeado pelo rótulo que está na tela', () => {
    montar()
    const grupos = [...container.querySelectorAll('[role="group"]')].map((g) => {
      const id = g.getAttribute('aria-labelledby') ?? ''
      return container.querySelector(`#${id}`)?.textContent?.trim()
    })
    expect(grupos).toEqual([
      'Tamanho do texto',
      'Fonte',
      'Disposição dos versículos',
      'Espaço entre linhas',
      'Largura do texto',
    ])
  })

  // Nenhum símbolo sozinho: ▼/▲ pareciam ordenação de tabela e só faziam
  // sentido pelo aria-label. A+/A− ficam, por serem convenção.
  it('os botões de entrelinha dizem no texto o que fazem', () => {
    montar()
    expect(botao('Espaço entre linhas', 'Mais junto')).toBeDefined()
    const antes = getReadingPrefs().leadingStep
    act(() => botao('Espaço entre linhas', 'Mais solto').click())
    expect(getReadingPrefs().leadingStep).toBe(antes + 1)
  })

  it('trocar o layout persiste e marca o botão', () => {
    montar()
    act(() => botao('Disposição dos versículos', 'Blocos').click())
    expect(getReadingPrefs().layout).toBe('blocos')
    expect(botao('Disposição dos versículos', 'Blocos').getAttribute('aria-pressed')).toBe('true')
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
