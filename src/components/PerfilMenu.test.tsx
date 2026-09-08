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

// Rota controlada pelo teste, para exercitar a seção contextual.
let rota = '/'
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: rota }),
  Link: ({ to, children, ...resto }: { to: string; children: unknown }) => (
    <a href={to} {...resto}>
      {children as never}
    </a>
  ),
}))

vi.mock('../lib/sync', () => ({ signOutLocal: vi.fn(async () => {}) }))

import PerfilMenu from './PerfilMenu'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  sessao = null
  rota = '/'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar() {
  act(() => root.render(<PerfilMenu />))
}

function abrir() {
  montar()
  act(() => container.querySelector<HTMLButtonElement>('.perfil-btn')!.click())
}

function textos(seletor: string): string[] {
  return [...container.querySelectorAll(seletor)].map((e) => e.textContent?.trim() ?? '')
}

describe('PerfilMenu — o gatilho', () => {
  it('a nav mostra "Perfil" deslogado', () => {
    montar()
    expect(container.querySelector('.perfil-btn')?.textContent?.trim()).toBe('Perfil')
  })

  it('a nav mostra "Perfil" logado, e não o e-mail', () => {
    sessao = { user: { id: 'u1', email: 'a@b.c' } }
    montar()
    expect(container.querySelector('.perfil-btn')?.textContent?.trim()).toBe('Perfil')
  })

  it('começa fechado', () => {
    montar()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('PerfilMenu — conteúdo', () => {
  it('deslogado, o último item é Entrar', () => {
    abrir()
    expect(textos('.perfil-item').at(-1)).toBe('Entrar')
  })

  it('logado, o último item é Sair', () => {
    sessao = { user: { id: 'u1', email: 'a@b.c' } }
    abrir()
    expect(textos('.perfil-item').at(-1)).toBe('Sair')
  })

  it('Ajustes aparece deslogado — a tela funciona sem conta', () => {
    abrir()
    expect(textos('.perfil-item')).toContain('Ajustes')
    const link = [...container.querySelectorAll('a.perfil-item')].find(
      (a) => a.textContent?.trim() === 'Ajustes',
    )
    expect(link?.getAttribute('href')).toBe('/ajustes')
  })

  // A atribuição da Bíblia Livre e a divulgação da voz de IA só existem na
  // página Sobre — nada disso aparece na tela de leitura, por decisão de
  // produto. Este item é o caminho até lá; sem ele, a divulgação fica
  // inalcançável pelo menu, que é o mesmo que não existir.
  it('Sobre aparece deslogado — é o caminho até a divulgação', () => {
    abrir()
    const link = [...container.querySelectorAll('a.perfil-item')].find(
      (a) => a.textContent?.trim() === 'Sobre',
    )
    expect(link?.getAttribute('href')).toBe('/sobre')
  })

  it('fora da Leitura não mostra a seção de tipografia', () => {
    abrir()
    expect(container.querySelector('[aria-label="Tamanho do texto"]')).toBeNull()
    expect(textos('.perfil-secao')).toEqual(['Tema'])
  })

  it('na Leitura mostra a seção de tipografia', () => {
    rota = '/leitura/1'
    abrir()
    expect(container.querySelector('[aria-label="Tamanho do texto"]')).not.toBeNull()
    expect(textos('.perfil-secao')).toEqual(['Tema', 'Leitura'])
  })

  it('o tema corrente vem marcado, e escolher outro fecha o menu', () => {
    abrir()
    const escuro = [...container.querySelectorAll('[aria-label="Tema"] button')].find(
      (b) => b.textContent?.trim() === 'Escuro',
    ) as HTMLButtonElement
    act(() => escuro.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('PerfilMenu — onOpenChange', () => {
  it('avisa o header ao abrir e ao fechar', () => {
    const vistos: boolean[] = []
    act(() => root.render(<PerfilMenu onOpenChange={(v) => vistos.push(v)} />))
    act(() => container.querySelector<HTMLButtonElement>('.perfil-btn')!.click())
    act(() => container.querySelector<HTMLButtonElement>('.perfil-btn')!.click())
    expect(vistos).toEqual([false, true, false])
  })
})
