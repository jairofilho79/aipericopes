// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { hasOpenDialog, isMediaTarget, isTypingTarget, shouldHandleKey } from './use-keyboard-nav'

/** Dispara o evento de verdade para que `ev.target` seja o elemento certo. */
function decidir(
  key: string,
  alvo: HTMLElement,
  init: KeyboardEventInit = {},
): 'prev' | 'next' | null {
  let saida: 'prev' | 'next' | null = null
  const handler = (e: Event) => {
    saida = shouldHandleKey(e as KeyboardEvent)
  }
  document.addEventListener('keydown', handler)
  alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  document.removeEventListener('keydown', handler)
  return saida
}

function montar<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  document.body.append(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isTypingTarget', () => {
  it('input, textarea e select são alvos de digitação', () => {
    expect(isTypingTarget(montar('input'))).toBe(true)
    expect(isTypingTarget(montar('textarea'))).toBe(true)
    expect(isTypingTarget(montar('select'))).toBe(true)
  })

  it('elemento contenteditable é alvo de digitação', () => {
    const div = montar('div')
    div.setAttribute('contenteditable', 'true')
    expect(isTypingTarget(div)).toBe(true)
  })

  it('botão, artigo e null não são alvos de digitação', () => {
    expect(isTypingTarget(montar('button'))).toBe(false)
    expect(isTypingTarget(montar('article'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('shouldHandleKey', () => {
  it('← devolve prev e → devolve next', () => {
    const alvo = montar('article')
    expect(decidir('ArrowLeft', alvo)).toBe('prev')
    expect(decidir('ArrowRight', alvo)).toBe('next')
  })

  it('qualquer modificador cancela', () => {
    const alvo = montar('article')
    expect(decidir('ArrowLeft', alvo, { metaKey: true })).toBeNull()
    expect(decidir('ArrowRight', alvo, { ctrlKey: true })).toBeNull()
    expect(decidir('ArrowLeft', alvo, { altKey: true })).toBeNull()
    expect(decidir('ArrowRight', alvo, { shiftKey: true })).toBeNull()
  })

  it('evento já tratado por outro handler é ignorado', () => {
    const ev = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    ev.preventDefault()
    expect(shouldHandleKey(ev)).toBeNull()
  })

  it('seta dentro de um campo de texto é ignorada', () => {
    expect(decidir('ArrowLeft', montar('input'))).toBeNull()
    expect(decidir('ArrowRight', montar('textarea'))).toBeNull()
  })

  it('outras teclas devolvem null', () => {
    const alvo = montar('article')
    expect(decidir('Escape', alvo)).toBeNull()
    expect(decidir('a', alvo)).toBeNull()
    expect(decidir('ArrowDown', alvo)).toBeNull()
  })
})

describe('hasOpenDialog', () => {
  it('detecta um role="dialog" no documento e volta a false quando ele sai', () => {
    expect(hasOpenDialog(document)).toBe(false)
    const pop = montar('div')
    pop.setAttribute('role', 'dialog')
    expect(hasOpenDialog(document)).toBe(true)
    pop.remove()
    expect(hasOpenDialog(document)).toBe(false)
  })
})

// A linha de chips rola de lado, e ←/→ é como se rola ela pelo teclado. Se a
// navegação entre perícopes engolir a seta ali, quem usa teclado fica sem
// alcançar os chips que estão fora da faixa visível.
describe('shouldHandleKey — linha de chips', () => {
  function chipNaLinha(): HTMLElement {
    const linha = montar('div')
    linha.className = 'section-chips-row'
    const chip = document.createElement('button')
    chip.className = 'section-chip'
    linha.append(chip)
    return chip
  }

  it('deixa a seta para a rolagem da própria linha', () => {
    expect(decidir('ArrowLeft', chipNaLinha())).toBeNull()
    expect(decidir('ArrowRight', chipNaLinha())).toBeNull()
  })

  it('fora da linha, a seta continua navegando entre perícopes', () => {
    const solto = montar('button')
    expect(decidir('ArrowLeft', solto)).toBe('prev')
    expect(decidir('ArrowRight', solto)).toBe('next')
  })
})

// O player de narração usa ←/→ como salto de ±10 s. Engolir a seta ali
// trocaria de perícope, desmontando o áudio e perdendo a posição.
describe('isMediaTarget', () => {
  it('elemento audio é alvo de mídia', () => {
    expect(isMediaTarget(montar('audio'))).toBe(true)
  })

  it('elemento dentro do player (.narracao) é alvo de mídia', () => {
    const wrapper = montar('div')
    wrapper.className = 'narracao'
    const rotulo = document.createElement('span')
    wrapper.append(rotulo)
    expect(isMediaTarget(rotulo)).toBe(true)
  })

  it('botão fora do player e null não são alvo de mídia', () => {
    expect(isMediaTarget(montar('button'))).toBe(false)
    expect(isMediaTarget(null)).toBe(false)
  })
})

describe('shouldHandleKey — player de narração', () => {
  function audioDoPlayer(): HTMLAudioElement {
    const wrapper = montar('div')
    wrapper.className = 'narracao'
    const audio = document.createElement('audio')
    wrapper.append(audio)
    document.body.append(wrapper)
    return audio
  }

  it('foco dentro do player deixa a seta para o salto dele', () => {
    expect(decidir('ArrowLeft', audioDoPlayer())).toBeNull()
    expect(decidir('ArrowRight', audioDoPlayer())).toBeNull()
  })

  it('fora do player, a seta continua navegando entre perícopes', () => {
    const solto = montar('button')
    expect(decidir('ArrowLeft', solto)).toBe('prev')
    expect(decidir('ArrowRight', solto)).toBe('next')
  })
})
