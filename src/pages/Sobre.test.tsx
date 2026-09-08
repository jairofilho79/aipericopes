// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: unknown }) => (
    <a href={to}>{children as never}</a>
  ),
}))

import Sobre from './Sobre'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Sobre />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const texto = () => container.textContent ?? ''

/**
 * Estes testes não guardam layout — guardam obrigação. Cada um deles existe
 * porque alguma coisa fora deste repo exige a frase: a licença da tradução,
 * as políticas de uso do fornecedor da voz. Se um deles quebrar, a resposta
 * não é ajustar o teste; é devolver a frase.
 */
describe('Sobre — a atribuição que a licença exige', () => {
  it('credita a Bíblia Livre com autores, ano e licença (CC BY 3.0 Brasil §4b)', () => {
    expect(texto()).toContain('Bíblia Livre')
    expect(texto()).toContain('Diego Santos')
    expect(texto()).toContain('Mario Sérgio')
    expect(texto()).toContain('Marco Teles')
    expect(texto()).toContain('Creative Commons Atribuição 3.0 Brasil')
  })

  it('linka a licença e a fonte da tradução', () => {
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('https://creativecommons.org/licenses/by/3.0/br/')
    expect(hrefs).toContain('https://sites.google.com/site/biblialivre/')
  })

  // §3b: havendo adaptação, a mudança tem de ser indicada.
  it('indica o que foi adaptado no texto', () => {
    expect(texto()).toContain('colchetes')
    expect(texto()).toContain('epígrafe')
  })
})

describe('Sobre — a divulgação que as políticas de uso exigem', () => {
  // "a clear disclosure to end users that the TTS voice they are hearing is
  // AI-generated and not a human voice". Sem rodeio: a frase é literal, e é a
  // ÚNICA no app inteiro — no tocador não há marca nenhuma, de propósito.
  it('diz que a voz é de IA e que não é locutor humano', () => {
    expect(texto()).toContain('voz de inteligência artificial')
    expect(texto()).toMatch(/não é a gravação de um locutor humano/i)
  })

  it('diz que o material de estudo foi escrito por modelo de linguagem', () => {
    expect(texto()).toMatch(/escritos por um modelo de\s+linguagem/i)
  })
})

describe('Sobre — a regra da cor', () => {
  // A tese do rebranding: âmbar é a voz do app, e a Escritura se distingue
  // pela AUSÊNCIA da marca. A regra tem de estar dita em algum lugar, não só
  // aplicada — senão é só decoração que ninguém decodifica.
  it('explica de onde vem o âmbar e o que ele significa', () => {
    expect(texto()).toContain('âmbar')
    expect(texto()).toMatch(/Escritura|texto bíblico/i)
  })
})
