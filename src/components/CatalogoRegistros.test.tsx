// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CatalogoRegistros from './CatalogoRegistros'
import type { FiltroLeitura } from '../lib/content'
import type { Registro, RegistroProgresso } from '../lib/registros'

const REGISTROS: Registro[] = [
  { slug: 'lamento', nome: 'Lamento', ordens: [1, 2, 3] },
  { slug: 'louvor', nome: 'Louvor', ordens: [4, 5] },
  { slug: 'lei', nome: 'Lei', ordens: [6] },
]

function progresso(): Map<string, RegistroProgresso> {
  return new Map([
    ['lamento', { slug: 'lamento', total: 3, concluidas: 1, pct: 33 }],
    ['louvor', { slug: 'louvor', total: 2, concluidas: 2, pct: 100 }],
    ['lei', { slug: 'lei', total: 1, concluidas: 0, pct: 0 }],
  ])
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  document.body.removeChild(container)
})

describe('CatalogoRegistros', () => {
  it('desenha os registros na ordem recebida, com nome e contagem', () => {
    act(() => {
      root.render(
        <CatalogoRegistros
          registros={REGISTROS}
          progresso={progresso()}
          contagem={new Map([
            ['lamento', 3],
            ['louvor', 2],
            ['lei', 1],
          ])}
          filtro={'todos' as FiltroLeitura}
          onAbrir={() => {}}
        />,
      )
    })

    const nomes = Array.from(container.querySelectorAll('.livro-nome')).map((el) => el.textContent)
    expect(nomes).toEqual(['Lamento', 'Louvor', 'Lei'])

    const subs = Array.from(container.querySelectorAll('.livro-sub')).map((el) => el.textContent)
    expect(subs).toEqual(['1 de 3 perícopes', '2 de 2 perícopes', 'nenhuma lida ainda'])
  })

  it('a linha de registro não tem coluna de abreviação — um registro não tem abrev', () => {
    act(() => {
      root.render(
        <CatalogoRegistros
          registros={REGISTROS}
          progresso={progresso()}
          contagem={new Map([['lamento', 3]])}
          filtro={'todos' as FiltroLeitura}
          onAbrir={() => {}}
        />,
      )
    })

    expect(container.querySelector('.livro-abbrev')).toBeNull()
    // O rótulo ao lado da barra saiu junto: a contagem agora é a linha
    // secundária. `.book-progress-label` continua nos cabeçalhos de livro e
    // registro abertos, que esta lista não desenha.
    expect(container.querySelector('.book-progress-label')).toBeNull()
  })

  it('chamar onAbrir passa o slug certo', () => {
    const abertos: string[] = []
    act(() => {
      root.render(
        <CatalogoRegistros
          registros={REGISTROS}
          progresso={progresso()}
          contagem={new Map([
            ['lamento', 3],
            ['louvor', 2],
            ['lei', 1],
          ])}
          filtro={'todos' as FiltroLeitura}
          onAbrir={(slug) => abertos.push(slug)}
        />,
      )
    })

    const botoes = container.querySelectorAll('.livro-row')
    act(() => {
      ;(botoes[1] as HTMLButtonElement).click()
    })

    expect(abertos).toEqual(['louvor'])
  })

  it('a barra de progresso não muda com o filtro — é o progresso REAL, não o do recorte', () => {
    // Com "não lidos" ativo e um recorte que zera "louvor" (2 concluídas, 0 no
    // recorte), a barra continua em 100%: é a mesma invariante que
    // LivroAberto documenta para a barra de livro.
    act(() => {
      root.render(
        <CatalogoRegistros
          registros={REGISTROS}
          progresso={progresso()}
          contagem={new Map([
            ['lamento', 2],
            ['louvor', 0],
            ['lei', 1],
          ])}
          filtro={'nao-lidos' as FiltroLeitura}
          onAbrir={() => {}}
        />,
      )
    })

    const fills = Array.from(container.querySelectorAll('.book-progress-fill')) as HTMLElement[]
    expect(fills[1].style.width).toBe('100%')
  })
})
