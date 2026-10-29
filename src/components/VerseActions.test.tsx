// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VerseActions from './VerseActions'

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar(extra: Partial<Parameters<typeof VerseActions>[0]> = {}) {
  act(() =>
    root.render(
      <VerseActions
        label="Gênesis 1:1"
        temDestaque={false}
        corAtual={null}
        aviso=""
        onCopiar={() => {}}
        onCompartilhar={() => {}}
        onDestacar={() => {}}
        onRemoverDestaque={() => {}}
        onAnotar={() => {}}
        onFechar={() => {}}
        {...extra}
      />,
    ),
  )
}

const botaoRefs = () => container.querySelector<HTMLButtonElement>('.btn-refs-chip')

describe('VerseActions — botão Refs', () => {
  it('não aparece quando o trecho não tem referências', () => {
    montar()
    expect(botaoRefs()).toBeNull()
  })

  it('mostra o contador e chama o callback ao tocar', () => {
    const ver = vi.fn()
    montar({ onVerReferencias: ver, qtdReferencias: 3 })
    expect(botaoRefs()?.textContent).toContain('Refs (3)')
    act(() => botaoRefs()!.click())
    expect(ver).toHaveBeenCalledTimes(1)
  })

  it('descreve no singular quando há uma nota só', () => {
    montar({ onVerReferencias: () => {}, qtdReferencias: 1 })
    expect(botaoRefs()?.getAttribute('title')).toContain('1 nota de referência')
  })
})
