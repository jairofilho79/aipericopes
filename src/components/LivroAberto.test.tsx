// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LivroAberto from './LivroAberto'
import { bookByAbbrev } from '../lib/bible-books'
import type { FiltroLeitura } from '../lib/content'

/**
 * Atribuir `input.value` direto não aciona o setter nativo que o React usa
 * para detectar mudança, então o onChange sintético não roda e o estado não
 * muda — um teste feito assim passa sem testar nada. Chamar o setter do
 * prototype e disparar 'input' é o que faz o React ver a digitação.
 */
function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  if (!setter) throw new Error('setter nativo de value indisponível')
  setter.call(input, valor)
  input.dispatchEvent(new Event('input', { bubbles: true }))
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

describe('LivroAberto', () => {
  it('zera campos quando o livro muda (sem key do consumidor)', () => {
    const gn = bookByAbbrev('Gn')
    const jo = bookByAbbrev('Jo')
    if (!gn || !jo) throw new Error('Livros não encontrados')

    // Renderizar com Gênesis
    act(() => {
      root.render(
        <LivroAberto
          livro={gn}
          prog={undefined}
          itens={[]}
          concluidas={new Set()}
          filtro={'todos' as FiltroLeitura}
          cap={null}
          onCap={() => {}}
          onTrocar={() => {}}
          onIrParaVersiculo={() => {}}
        />
      )
    })

    // Encontrar inputs de capítulo e versículo
    const inputs = container.querySelectorAll('input[inputMode="numeric"]')
    const inputCap = inputs[0] as HTMLInputElement
    const inputVer = inputs[1] as HTMLInputElement
    if (!inputCap || !inputVer) throw new Error('Inputs não encontrados')

    // Digitar um capítulo válido
    act(() => {
      digitar(inputCap, '3')
    })

    // Prova de que o estado mudou: versículo deve estar habilitado agora
    expect(inputVer.disabled).toBe(false)

    // Re-renderizar com João (mesmo componente, livro diferente)
    act(() => {
      root.render(
        <LivroAberto
          livro={jo}
          prog={undefined}
          itens={[]}
          concluidas={new Set()}
          filtro={'todos' as FiltroLeitura}
          cap={null}
          onCap={() => {}}
          onTrocar={() => {}}
          onIrParaVersiculo={() => {}}
        />
      )
    })

    // Verificar que ambos os campos foram zerados
    const inputsAfter = container.querySelectorAll('input[inputMode="numeric"]')
    const inputCapAfter = inputsAfter[0] as HTMLInputElement
    const inputVerAfter = inputsAfter[1] as HTMLInputElement
    if (!inputCapAfter || !inputVerAfter) throw new Error('Inputs não encontrados após re-render')
    expect(inputCapAfter.value).toBe('')
    // Versículo volta a ficar desabilitado — invariante vista pelo outro lado
    expect(inputVerAfter.disabled).toBe(true)
  })
})
