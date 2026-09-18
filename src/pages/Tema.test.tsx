// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installLocalStorageMock } from '../lib/testing/storage-mock'

installLocalStorageMock()

vi.mock('../lib/use-reading-prefs', () => ({
  useReadingPrefs: () => ({
    sizeStep: 2,
    font: 'sans',
    layout: 'corrido',
    leadingStep: 1,
    measure: 'normal',
  }),
}))

import Tema from './Tema'

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
  act(() => root.render(<Tema />))
}

function textos(seletor: string): string[] {
  return [...container.querySelectorAll(seletor)].map((e) => e.textContent?.trim() ?? '')
}

function botoesTema(): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-labelledby="tema-aparencia"] button',
    ),
  ]
}

describe('Tema — aparência', () => {
  it('mostra os três temas', () => {
    montar()
    expect(botoesTema().map((b) => b.textContent?.trim())).toEqual(['Sistema', 'Claro', 'Escuro'])
  })

  it('sem preferência gravada, o marcado é Sistema', () => {
    montar()
    expect(botoesTema().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ])
  })

  it('a preferência gravada vem marcada ao montar', () => {
    localStorage.setItem('pericopes-theme', 'dark')
    montar()
    expect(botoesTema().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ])
  })

  it('escolher um tema move a marcação e aplica o tema', () => {
    montar()
    act(() => botoesTema()[2].click())
    expect(botoesTema().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ])
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('Tema — tipografia', () => {
  // Cada ajuste tem de dizer na tela o que configura, num nível só de rótulo:
  // é o que separa uma página de ajustes de um paredão de botões.
  it('os grupos de tipografia aparecem com rótulos visíveis', () => {
    montar()
    expect(textos('.pref-grupo .eyebrow')).toEqual([
      'Aparência',
      'Tamanho do texto',
      'Fonte',
      'Disposição dos versículos',
      'Espaço entre linhas',
      'Largura do texto',
    ])
  })

  // Rótulo visível E nome acessível são o mesmo texto: `aria-labelledby`
  // apontando para o <p>, não um `aria-label` paralelo que pode divergir dele.
  it('o nome de cada grupo sai do rótulo que está na tela', () => {
    montar()
    const nomes = [...container.querySelectorAll('.pref-grupo')].map((g) => {
      const id = g.getAttribute('aria-labelledby')
      return id ? (container.querySelector(`#${id}`)?.textContent?.trim() ?? '') : ''
    })
    expect(nomes).toEqual(textos('.pref-grupo .eyebrow'))
  })
})
