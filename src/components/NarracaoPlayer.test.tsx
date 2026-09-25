// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NarracaoPlayer from './NarracaoPlayer'
import { esquecerMapaTrilha } from '../lib/trilha'

/**
 * O que este arquivo trava é a resposta do componente à pergunta "há narração
 * desta perícope?" — os três estados de indisponibilidade que existem para o
 * app não ficar mudo, o cartão pré-play e a doca. A sincronia do realce (o
 * loop de quadros, o manifesto, a timeline) é testada em `alinhar-narracao`,
 * `narracao-timeline` e `narracao-controles`, sem `<audio>` no meio: happy-dom
 * não implementa reprodução de mídia, e forçá-la aqui testaria o mock.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  esquecerMapaTrilha()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  esquecerMapaTrilha()
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

/** `fetch` que responde o HEAD do áudio como a fábrica pedir. */
function stubHead(resposta: { ok: boolean } | 'rede') {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') {
      if (resposta === 'rede') return Promise.reject(new Error('offline'))
      return Promise.resolve({ ok: resposta.ok } as Response)
    }
    // O manifesto: ausente é o caso normal, e `carregarManifesto` já o trata.
    return Promise.resolve({ ok: false, headers: new Headers() } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function montar(props: { usada?: boolean } = {}) {
  await act(async () => {
    root.render(
      <NarracaoPlayer
        ordem={1600}
        secoes={[]}
        onAlvo={() => {}}
        usada={props.usada ?? false}
        alvoRotulo="João 3:16"
        minutos={5}
      />,
    )
  })
}

describe('NarracaoPlayer — disponibilidade', () => {
  it('anuncia a verificação enquanto o HEAD está em voo', async () => {
    // Promise que nunca resolve: é o estado 1 congelado.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    await montar()
    const esqueleto = container.querySelector('.ouvir-skeleton')
    // O `role` mora no invólucro estável, não no esqueleto que passa.
    expect(esqueleto?.parentElement?.getAttribute('role')).toBe('status')
    expect(esqueleto?.querySelector('.sr-only')?.textContent).toBe(
      'Verificando narração desta perícope…',
    )
  })

  /**
   * A regra que este teste trava é a IDENTIDADE do nó: uma região aria-live
   * criada no mesmo update da mensagem não é anunciada, porque o leitor de
   * tela só relata mudança de conteúdo em região que já estava no DOM. Não
   * basta existir um `role="status"` com o texto certo no fim — tem de ser o
   * mesmo elemento que já estava lá enquanto o HEAD voava.
   */
  it('a região viva precede a mensagem: mesmo nó antes e depois do HEAD', async () => {
    let responderHead: ((r: Response) => void) | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'HEAD') {
          return new Promise<Response>((res) => {
            responderHead = res
          })
        }
        return Promise.resolve({ ok: false, headers: new Headers() } as Response)
      }),
    )
    await montar()
    const regioes = container.querySelectorAll('[role="status"]')
    expect(regioes).toHaveLength(1)
    const regiao = regioes[0]!
    expect(regiao.textContent).not.toContain('ainda não foi gravada')

    await act(async () => {
      responderHead?.({ ok: false } as Response)
    })
    // Se fez fallback para VOZ_V3, resolve também o segundo HEAD
    if (responderHead) {
      await act(async () => {
        responderHead?.({ ok: false } as Response)
      })
    }

    expect(container.querySelector('[role="status"]')).toBe(regiao)
    expect(regiao.textContent).toBe('A narração desta perícope ainda não foi gravada.')
  })

  it('HEAD 404 diz que a narração ainda não foi gravada, sem botão', async () => {
    stubHead({ ok: false })
    await montar()
    const aviso = container.querySelector('.narracao-indisponivel')
    expect(aviso?.textContent).toBe('A narração desta perícope ainda não foi gravada.')
    expect(aviso?.parentElement?.getAttribute('role')).toBe('status')
    expect(container.querySelector('.narracao-retentar')).toBeNull()
    expect(container.querySelector('.ouvir-cartao')).toBeNull()
  })

  it('HEAD que falha de rede oferece "Tentar de novo", e o botão refaz o HEAD', async () => {
    const fetchMock = stubHead('rede')
    await montar()
    const aviso = container.querySelector('.narracao-indisponivel')
    expect(aviso?.textContent).toContain('Não foi possível carregar a narração desta perícope.')
    expect(aviso?.closest('[role="status"]')).not.toBeNull()
    const heads = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'HEAD').length
    expect(heads()).toBe(1)
    const retentar = container.querySelector<HTMLButtonElement>('.narracao-retentar')
    await act(async () => retentar?.click())
    expect(heads()).toBe(2)
  })

  it('com áudio e antes do primeiro play, um cartão só, com a duração no rótulo', async () => {
    stubHead({ ok: true })
    await montar()
    const cartoes = container.querySelectorAll('.ouvir-cartao')
    expect(cartoes).toHaveLength(1)
    expect(cartoes[0]!.getAttribute('aria-label')).toBe('Ouvir esta perícope, 5 minutos')
    expect(cartoes[0]!.querySelector('.ouvir-cartao-titulo')?.textContent).toBe(
      'Ouvir esta perícope',
    )
    expect(cartoes[0]!.querySelector('.ouvir-cartao-sub')?.textContent).toBe(
      '5 min · voz sintetizada, lida sobre o texto',
    )
    const icone = cartoes[0]!.querySelector('.ouvir-cartao-play svg')
    expect(icone).not.toBeNull()
    expect(icone?.querySelector('path')?.getAttribute('d')).toContain('M182.248,341.784')
    expect(container.querySelector('.narracao-doca')).toBeNull()
  })
})

describe('NarracaoPlayer — doca', () => {
  it('depois do primeiro play a doca substitui o cartão', async () => {
    stubHead({ ok: true })
    await montar({ usada: true })
    const doca = container.querySelector('.narracao-doca')
    expect(doca).not.toBeNull()
    expect(container.querySelector('.ouvir-cartao')).toBeNull()
    expect(doca?.getAttribute('role')).toBe('region')
    expect(doca?.getAttribute('aria-label')).toBe('Narração')
    // Marcador de comportamento, não de estilo: `use-keyboard-nav` procura
    // `.narracao` para deixar ←/→ com o salto de ±10 s da doca.
    expect(doca?.classList.contains('narracao')).toBe(true)
  })

  it('três controles, cada um com o próprio rótulo, e nenhum de velocidade', async () => {
    stubHead({ ok: true })
    await montar({ usada: true })
    const rotulos = [
      ...container.querySelectorAll('.narracao-doca-controles button'),
    ].map((b) => b.getAttribute('aria-label'))
    expect(rotulos).toEqual(['Voltar 10 segundos', 'Tocar narração', 'Avançar 10 segundos'])
  })

  it('a linha de estado mostra o que está tocando e a barra de posição é rotulada', async () => {
    stubHead({ ok: true })
    await montar({ usada: true })
    expect(container.querySelector('.narracao-doca-alvo')?.textContent).toBe('João 3:16')
    const barra = container.querySelector('.narracao-doca-barra')
    expect(barra?.getAttribute('aria-label')).toBe('Posição na narração')
    expect(barra?.getAttribute('aria-valuetext')).toBe('0:00 de –:––')
  })

  it('mostra botão de música de fundo quando há cama no mapa', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return Promise.resolve({ ok: true } as Response)
      }
      if (String(url).includes('trilha.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ prefixo: 'trilha-v1', camas: { louvor: [1600] } }),
        } as Response)
      }
      return Promise.resolve({ ok: false, headers: new Headers() } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)
    await montar({ usada: true })
    const btnTrilha = container.querySelector('.narracao-doca-trilha')
    expect(btnTrilha).not.toBeNull()
    expect(btnTrilha?.getAttribute('aria-label')).toBe('Desligar música de fundo')
  })
})
