// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installLocalStorageMock } from '../lib/testing/storage-mock'

installLocalStorageMock()

// Sessão controlada pelo teste: `sessao` null = anônimo.
let sessao: { user: { id: string; email: string } } | null = null
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: sessao }) },
}))

// Só `Link`: a página não consulta a rota corrente — é esse o ponto dela.
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...resto }: { to: string; children: unknown }) => (
    <a href={to} {...resto}>
      {children as never}
    </a>
  ),
}))

vi.mock('../lib/sync', () => ({ signOutLocal: vi.fn(async () => {}) }))

import Perfil from './Perfil'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  sessao = null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar() {
  act(() => root.render(<Perfil />))
}

function textos(seletor: string): string[] {
  return [...container.querySelectorAll(seletor)].map((e) => e.textContent?.trim() ?? '')
}

function temas(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Tema"] button')]
}

describe('Perfil — tema', () => {
  it('mostra os três temas', () => {
    montar()
    expect(temas().map((b) => b.textContent?.trim())).toEqual(['Sistema', 'Claro', 'Escuro'])
  })

  it('sem preferência gravada, o marcado é Sistema', () => {
    montar()
    expect(temas().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })

  it('a preferência gravada vem marcada ao montar', () => {
    localStorage.setItem('pericopes-theme', 'dark')
    montar()
    expect(temas().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })

  // Sem o listener de `pericopes-theme` que o popover tinha, a marcação só
  // acompanha o clique se a própria página atualizar o estado.
  it('escolher um tema move a marcação e aplica o tema', () => {
    montar()
    act(() => temas()[2].click())
    expect(temas().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('Perfil — conteúdo', () => {
  // O popover só mostrava tipografia vindo da Leitura. A página não tem de
  // onde vir: é um endereço, e mostra sempre.
  it('a tipografia aparece sem depender de rota', () => {
    montar()
    expect(container.querySelector('[aria-label="Tamanho do texto"]')).not.toBeNull()
    expect(textos('.perfil-secao')).toEqual(['Tema', 'Leitura'])
  })

  it('Ajustes aparece deslogado — a tela funciona sem conta', () => {
    montar()
    const link = [...container.querySelectorAll('a.perfil-item')].find(
      (a) => a.textContent?.trim() === 'Ajustes',
    )
    expect(link?.getAttribute('href')).toBe('/ajustes')
  })

  // A atribuição da Bíblia Livre e a divulgação da voz de IA só existem na
  // página Sobre — nada disso aparece na tela de leitura, por decisão de
  // produto. Este item é o caminho até lá; sem ele, a divulgação fica
  // inalcançável, que é o mesmo que não existir.
  it('Sobre aparece deslogado — é o caminho até a divulgação', () => {
    montar()
    const link = [...container.querySelectorAll('a.perfil-item')].find(
      (a) => a.textContent?.trim() === 'Sobre',
    )
    expect(link?.getAttribute('href')).toBe('/sobre')
  })
})

describe('Perfil — conta', () => {
  it('deslogado, o último item é Entrar', () => {
    montar()
    expect(textos('.perfil-item').at(-1)).toBe('Entrar')
    expect(
      [...container.querySelectorAll('a.perfil-item')]
        .find((a) => a.textContent?.trim() === 'Entrar')
        ?.getAttribute('href'),
    ).toBe('/entrar')
  })

  it('logado, o último item é Sair', () => {
    sessao = { user: { id: 'u1', email: 'a@b.c' } }
    montar()
    expect(textos('.perfil-item').at(-1)).toBe('Sair')
  })

  // A região aria-live tem que preceder o erro que anuncia: leitor de tela
  // não anuncia nó criado já populado no mesmo update.
  it('a região de erro de saída existe antes de qualquer erro', () => {
    sessao = { user: { id: 'u1', email: 'a@b.c' } }
    montar()
    const regiao = container.querySelector('.nav-conta-erro')
    expect(regiao).not.toBeNull()
    expect(regiao?.getAttribute('role')).toBe('status')
    expect(regiao?.getAttribute('aria-live')).toBe('polite')
    expect(regiao?.textContent).toBe('')
  })
})
