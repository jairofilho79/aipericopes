// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installLocalStorageMock } from '../lib/testing/storage-mock'

installLocalStorageMock()

let mockSearch = ''

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...resto }: { to: string; children: unknown }) => (
    <a href={to} {...resto}>
      {children as never}
    </a>
  ),
  useSearchParams: () => [new URLSearchParams(mockSearch), vi.fn()],
}))

import LeituraTopo from './LeituraTopo'

let container: HTMLDivElement
let root: Root
const rafOriginal = window.requestAnimationFrame
const cafOriginal = window.cancelAnimationFrame

beforeEach(() => {
  mockSearch = ''
  localStorage.clear()
  // O `window` é o mesmo para todos os testes do arquivo: sem zerar aqui, o
  // topo montaria já com o `scrollY` que o teste anterior deixou, e uma
  // rolagem para o MESMO ponto não é rolagem nenhuma — o teste passaria sem
  // nunca ter exercitado o auto-ocultar.
  posicionarScroll(0)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // O rAF real do happy-dom não roda dentro de act(); um setTimeout no lugar
  // preserva o que o hook depende (o callback é assíncrono, e a guarda de
  // reentrância só solta depois que ele roda) e ainda é determinístico.
  // Troca direta, e não vi.stubGlobal: um unstubAllGlobals levaria embora o
  // localStorage em memória que o LeituraPrefs daqui de dentro precisa.
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(0), 0)
  window.cancelAnimationFrame = (id) => window.clearTimeout(id)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.requestAnimationFrame = rafOriginal
  window.cancelAnimationFrame = cafOriginal
})

function montar(livro: string | null, posicao: { n: number; m: number } | null = null) {
  act(() => root.render(<LeituraTopo livro={livro} posicao={posicao} />))
}

const header = () => container.querySelector('header') as HTMLElement
const voltar = () => container.querySelector('.leitura-top-voltar') as HTMLAnchorElement
const aa = () => container.querySelector('.leitura-top-aa') as HTMLButtonElement
const popover = () => container.querySelector('.pop-tipografia')

function posicionarScroll(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
}

async function rolarPara(y: number) {
  posicionarScroll(y)
  await act(async () => {
    window.dispatchEvent(new Event('scroll'))
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('LeituraTopo — a saída da Leitura', () => {
  it('com livro, o chevron volta para o livro no catálogo', () => {
    montar('Gênesis')
    expect(voltar().getAttribute('href')).toBe('/explorar?livro=G%C3%AAnesis')
    expect(voltar().textContent).toContain('Gênesis')
  })

  it('com ?de=jornada, o chevron volta para /jornada', () => {
    mockSearch = 'de=jornada'
    montar('Gênesis')
    expect(voltar().getAttribute('href')).toBe('/jornada')
    expect(voltar().textContent).toContain('Jornada')
    expect(voltar().getAttribute('aria-label')).toBe('Voltar para Jornada')
  })

  it('com ?de=jornada&mock=1, preserva o mock no destino', () => {
    mockSearch = 'de=jornada&mock=1'
    montar('Jonas')
    expect(voltar().getAttribute('href')).toBe('/jornada?mock=1')
  })

  // O header do App não renderiza em /leitura/*: nos estados de carga e de
  // erro este topo é a ÚNICA navegação da página. Sem link, a única saída
  // seria o botão voltar do navegador — que num PWA standalone não existe.
  it('sem perícope, ainda oferece um destino nomeado', () => {
    montar(null)
    expect(voltar().getAttribute('href')).toBe('/explorar')
    expect(voltar().textContent).toContain('Explorar')
    expect(voltar().getAttribute('aria-label')).toBe('Voltar para Explorar')
    expect(container.querySelector('.leitura-top-perfil')).not.toBeNull()
  })

  it('sem posição, o centro fica vazio em vez de inventar "1 de 1"', () => {
    montar(null)
    expect(container.querySelector('.leitura-top-pos')?.textContent).toBe('')
  })
})

describe('LeituraTopo — o auto-ocultar contra o popover', () => {
  it('rolar para baixo esconde o topo', async () => {
    montar('Gênesis')
    await rolarPara(200)
    expect(header().className).toContain('top-hidden')
  })

  // `.top-hidden` é translateY(-100%) MAIS visibility: hidden, e o popover é
  // filho do header. Uma rolagem sem pointerdown (roda, trackpad, PageDown)
  // não fecha o popover pelo clique-fora: se o header se escondesse, o painel
  // sairia da tela com o foco dentro dele.
  it('com o "Aa" aberto, rolar não esconde o topo', async () => {
    montar('Gênesis')
    act(() => aa().click())
    expect(popover()).not.toBeNull()

    await rolarPara(200)
    expect(header().className).not.toContain('top-hidden')
    expect(popover()).not.toBeNull()
  })

  it('fechado o "Aa", o auto-ocultar volta a valer', async () => {
    montar('Gênesis')
    act(() => aa().click())
    await rolarPara(200)
    act(() => aa().click())
    await rolarPara(400)
    expect(header().className).toContain('top-hidden')
  })
})
