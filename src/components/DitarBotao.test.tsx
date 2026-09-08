// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Sessão controlada pelo teste: `sessao` null = anônimo.
let sessao: { user: { id: string } } | null = null
vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: sessao }) },
}))

// Revisão por IA controlada pelo teste: resolve com o que `revisado` disser.
const revisarDitado = vi.fn(async (_texto: string): Promise<string | null> => null)
vi.mock('../lib/revisar-ditado', () => ({
  revisarDitado: (t: string) => revisarDitado(t),
}))

import DitarBotao from './DitarBotao'
import { FakeReconhecimento } from '../lib/testing/reconhecimento-fake'

/**
 * MediaRecorder de mentira: registra start/stop, entrega um chunk no stop e
 * expõe a instância para o teste dirigir.
 */
class FakeRecorder {
  static instancias: FakeRecorder[] = []
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus'
  mimeType: string
  state = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(_stream: MediaStream, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? 'audio/webm'
    FakeRecorder.instancias.push(this)
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) })
    this.onstop?.()
  }
}

const tracks = [{ stop: vi.fn() }]
const getUserMedia = vi.fn(async () => ({ getTracks: () => tracks }) as unknown as MediaStream)

let root: Root
let host: HTMLDivElement
const onTexto = vi.fn()
const onRevisao = vi.fn()
const onAviso = vi.fn()

function montar(props: { disabled?: boolean } = {}) {
  act(() => {
    root.render(
      <DitarBotao onTexto={onTexto} onRevisao={onRevisao} onAviso={onAviso} {...props} />,
    )
  })
}
const botao = () => host.querySelector('button')
const status = () => host.querySelector('[role="status"]')?.textContent ?? null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-02T15:00:00.000Z'))
  sessao = { user: { id: 'u1' } }
  FakeRecorder.instancias = []
  tracks[0].stop.mockClear()
  FakeReconhecimento.instancias = []
  onTexto.mockClear()
  onRevisao.mockClear()
  onAviso.mockClear()
  revisarDitado.mockReset()
  revisarDitado.mockResolvedValue(null)
  getUserMedia.mockClear()
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// happy-dom não tem Web Speech API: por padrão os testes cobrem o fallback
// (MediaRecorder + Worker). O bloco "modo nativo" liga a API de mentira.
describe('DitarBotao — quando aparece (fallback)', () => {
  it('renderiza o microfone para quem está logado', () => {
    montar()
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
  })

  it('não renderiza nada sem sessão', () => {
    sessao = null
    montar()
    expect(host.innerHTML).toBe('')
  })

  it('não renderiza nada offline, e volta ao ficar online', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    montar()
    expect(host.innerHTML).toBe('')
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(botao()).not.toBeNull()
  })

  it('não renderiza nada sem MediaRecorder ou sem getUserMedia', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    montar()
    expect(host.innerHTML).toBe('')
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    montar()
    expect(host.innerHTML).toBe('')
  })
})

describe('DitarBotao — fluxo (fallback)', () => {
  it('toque grava (contador), toque de novo para, transcreve e entrega o texto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ texto: 'Amém' })),
    )
    montar()
    await act(async () => {
      botao()!.click()
    })
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(FakeRecorder.instancias).toHaveLength(1)
    expect(FakeRecorder.instancias[0].mimeType).toBe('audio/webm;codecs=opus')
    expect(botao()?.getAttribute('aria-label')).toBe('Parar e transcrever')
    expect(botao()?.classList.contains('gravando')).toBe(true)
    expect(status()).toBe('0:00 / 1:00')

    await act(async () => {
      vi.advanceTimersByTime(7_300)
    })
    expect(status()).toBe('0:07 / 1:00')

    await act(async () => {
      botao()!.click()
    })
    // Tracks soltas; enquanto transcreve o botão fica desabilitado.
    expect(tracks[0].stop).toHaveBeenCalled()
    await act(async () => {
      await Promise.resolve()
    })
    expect(onTexto).toHaveBeenCalledWith('Amém')
    expect(onAviso).not.toHaveBeenCalled()
    expect(botao()?.disabled).toBe(false)
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect((init.headers as Record<string, string>)['X-Duracao-Segundos']).toBe('8')
  })

  it('para sozinho em 60 s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ texto: 'x' })))
    montar()
    await act(async () => {
      botao()!.click()
    })
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(FakeRecorder.instancias[0].state).toBe('inactive')
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  it('microfone negado e microfone ausente viram avisos', async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error('negado'), { name: 'NotAllowedError' }),
    )
    montar()
    await act(async () => {
      botao()!.click()
    })
    expect(onAviso).toHaveBeenCalledWith('Permita o microfone para ditar')
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')

    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error('nenhum'), { name: 'NotFoundError' }),
    )
    await act(async () => {
      botao()!.click()
    })
    expect(onAviso).toHaveBeenCalledWith('Nenhum microfone encontrado')
  })

  it('erro do servidor vai para onAviso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ erro: 'x' }, { status: 502 })))
    montar()
    await act(async () => {
      botao()!.click()
    })
    await act(async () => {
      botao()!.click()
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(onAviso).toHaveBeenCalledWith('Não foi possível transcrever')
    expect(onTexto).not.toHaveBeenCalled()
  })

  it('cota esgotada: avisa, desabilita com a hora da volta e reabilita quando ela passa', async () => {
    const voltaEm = '2026-09-03T00:00:00.000Z'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ erro: 'x', voltaEm }, { status: 429 })),
    )
    montar()
    await act(async () => {
      botao()!.click()
    })
    await act(async () => {
      botao()!.click()
    })
    await act(async () => {
      await Promise.resolve()
    })
    const hora = new Date(voltaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    expect(onAviso).toHaveBeenCalledWith(`Ditado volta às ${hora}`)
    expect(botao()?.disabled).toBe(true)
    expect(botao()?.getAttribute('aria-label')).toBe(`Ditado volta às ${hora}`)
    expect(status()).toBe(`Ditado volta às ${hora}`)

    // 9 horas depois (meia-noite UTC) o botão volta sozinho.
    await act(async () => {
      vi.advanceTimersByTime(9 * 60 * 60 * 1000)
    })
    expect(botao()?.disabled).toBe(false)
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
    expect(status()).toBeNull()
  })

  it('desmontar no meio da gravação solta o microfone e descarta o áudio', async () => {
    const fetchMock = vi.fn(async () => Response.json({ texto: 'x' }))
    vi.stubGlobal('fetch', fetchMock)
    montar()
    await act(async () => {
      botao()!.click()
    })
    act(() => root.unmount())
    expect(tracks[0].stop).toHaveBeenCalled()
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onTexto).not.toHaveBeenCalled()
    // afterEach desmonta de novo: precisa de um root vivo.
    root = createRoot(host)
  })
})

describe('DitarBotao — modo nativo', () => {
  const rec = () => FakeReconhecimento.instancias[0]
  const previa = () => host.querySelector('.ditar-status')
  /** Permissions API de mentira: `null` = navegador sem ela. */
  function permissoes(estado: 'granted' | 'denied' | 'prompt' | null) {
    Object.defineProperty(navigator, 'permissions', {
      value: estado ? { query: async () => ({ state: estado }) } : undefined,
      configurable: true,
    })
  }

  beforeEach(() => {
    vi.stubGlobal('SpeechRecognition', FakeReconhecimento)
    permissoes(null)
  })

  it('aparece sem sessão e sem MediaRecorder, mas não offline', () => {
    sessao = null
    vi.stubGlobal('MediaRecorder', undefined)
    montar()
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    act(() => window.dispatchEvent(new Event('offline')))
    expect(host.innerHTML).toBe('')
  })

  it('toque começa a ouvir em pt-BR; finais vão para onTexto, parciais para a prévia', () => {
    sessao = null
    montar()
    act(() => botao()!.click())
    expect(rec().starts).toBe(1)
    expect(rec().lang).toBe('pt-BR')
    expect(rec().continuous).toBe(true)
    expect(botao()?.getAttribute('aria-label')).toBe('Parar ditado')
    expect(botao()?.getAttribute('aria-pressed')).toBe('true')
    expect(botao()?.classList.contains('gravando')).toBe(true)
    expect(previa()?.textContent).toBe('Ouvindo…')
    // Sem contador nem aria-live: a prévia muda a cada sílaba.
    expect(previa()?.getAttribute('aria-live')).toBeNull()

    act(() => rec().resultado([['o senhor é o meu', false]]))
    expect(previa()?.textContent).toBe('o senhor é o meu…')
    expect(previa()?.classList.contains('ditar-previa')).toBe(true)
    expect(onTexto).not.toHaveBeenCalled()

    // O final entra já com a pontuação heurística.
    act(() => rec().resultado([['o senhor é o meu pastor', true]]))
    expect(onTexto).toHaveBeenCalledWith('O Senhor é o meu pastor.')
    expect(previa()?.textContent).toBe('Ouvindo…')
    // Sem teto: um minuto depois continua ouvindo.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(rec().stops).toBe(0)
    expect(botao()?.getAttribute('aria-label')).toBe('Parar ditado')
  })

  it('reinicia quando o aparelho encerra sozinho, e não depois de parar', async () => {
    montar()
    act(() => botao()!.click())
    // iOS encerra depois de uma pausa: a pessoa não pediu, então volta a ouvir.
    act(() => rec().fim())
    expect(rec().starts).toBe(2)
    expect(botao()?.getAttribute('aria-label')).toBe('Parar ditado')

    act(() => botao()!.click())
    expect(rec().stops).toBe(1)
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
    expect(previa()).toBeNull()
    // O último final ainda chega depois do stop e entra no texto.
    act(() => rec().resultado([['amém', true]]))
    expect(onTexto).toHaveBeenCalledWith('Amém.')
    await act(async () => rec().fim())
    expect(rec().starts).toBe(2)
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
  })

  it('ao parar com sessão, revisa o trecho inteiro e entrega a revisão quando ela muda algo', async () => {
    let resolver: (t: string | null) => void = () => {}
    revisarDitado.mockImplementation(() => new Promise((r) => (resolver = r)))
    montar()
    act(() => botao()!.click())
    act(() => rec().resultado([['se deus quiser', true]]))
    // O reinício automático do iOS não fecha a sessão de ditado da pessoa.
    act(() => rec().fim())
    expect(revisarDitado).not.toHaveBeenCalled()
    act(() => rec().resultado([['amém', true]]))
    act(() => botao()!.click())
    expect(revisarDitado).not.toHaveBeenCalled()
    // Só no onend, quando o último final já entrou.
    act(() => rec().fim())
    expect(revisarDitado).toHaveBeenCalledWith('Se Deus quiser. Amém.')
    expect(status()).toBe('Revisando…')
    expect(botao()?.disabled).toBe(true)
    await act(async () => resolver('Se Deus quiser, amém.'))
    expect(onRevisao).toHaveBeenCalledWith('Se Deus quiser. Amém.', 'Se Deus quiser, amém.')
    expect(status()).toBeNull()
    expect(botao()?.disabled).toBe(false)
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
  })

  it('revisão igual ou falha não chama onRevisao', async () => {
    revisarDitado.mockResolvedValue('Amém.')
    montar()
    act(() => botao()!.click())
    act(() => rec().resultado([['amém', true]]))
    act(() => botao()!.click())
    await act(async () => rec().fim())
    expect(revisarDitado).toHaveBeenCalledWith('Amém.')
    expect(onRevisao).not.toHaveBeenCalled()

    revisarDitado.mockResolvedValue(null)
    act(() => botao()!.click())
    act(() => rec().resultado([['glória', true]]))
    act(() => botao()!.click())
    await act(async () => rec().fim())
    expect(revisarDitado).toHaveBeenLastCalledWith('Glória.')
    expect(onRevisao).not.toHaveBeenCalled()
    expect(botao()?.disabled).toBe(false)
  })

  it('sem sessão, ou sem nada ditado, não revisa', async () => {
    sessao = null
    montar()
    act(() => botao()!.click())
    act(() => rec().resultado([['amém', true]]))
    act(() => botao()!.click())
    await act(async () => rec().fim())
    expect(onTexto).toHaveBeenCalledWith('Amém.')
    expect(revisarDitado).not.toHaveBeenCalled()
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')

    sessao = { user: { id: 'u1' } }
    montar()
    act(() => botao()!.click())
    act(() => botao()!.click())
    await act(async () => rec().fim())
    expect(revisarDitado).not.toHaveBeenCalled()
  })

  it('desmontar durante a revisão ignora o resultado', async () => {
    let resolver: (t: string | null) => void = () => {}
    revisarDitado.mockImplementation(() => new Promise((r) => (resolver = r)))
    montar()
    act(() => botao()!.click())
    act(() => rec().resultado([['amém', true]]))
    act(() => botao()!.click())
    act(() => rec().fim())
    expect(revisarDitado).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    await act(async () => resolver('Amém!'))
    expect(onRevisao).not.toHaveBeenCalled()
    root = createRoot(host)
  })

  it('microfone negado pelo aparelho: sai do "ouvindo" na hora, mostra onde liberar e não reinicia', async () => {
    montar()
    await act(async () => botao()!.click())
    act(() => rec().erro('not-allowed'))
    // Sem esperar o onend — no iOS ele não vem depois deste erro.
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
    expect(status()).toContain('Microfone bloqueado')
    expect(onAviso).not.toHaveBeenCalled()
    act(() => rec().fim())
    expect(rec().starts).toBe(1)
    expect(status()).toContain('Microfone bloqueado')
    // Tocar de novo confere a permissão de novo; ainda negada, fica no aviso.
    permissoes('denied')
    await act(async () => botao()!.click())
    expect(rec().starts).toBe(1)
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(status()).toContain('Microfone bloqueado')
  })

  it('outros erros viram aviso e voltam ao ocioso sem esperar o onend', async () => {
    montar()
    await act(async () => botao()!.click())
    act(() => rec().erro('network'))
    expect(onAviso).toHaveBeenCalledWith('Sem conexão para ditar')
    expect(botao()?.getAttribute('aria-label')).toBe('Ditar anotação')
    act(() => rec().fim())
    expect(rec().starts).toBe(1)
  })

  it('permissão ainda não pedida: sobe o prompt (getUserMedia), solta o microfone e só então ouve', async () => {
    permissoes('prompt')
    let liberar: (v: MediaStream) => void = () => {}
    getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>((r) => (liberar = r)))
    montar()
    await act(async () => {}) // efeito lê a permissão
    await act(async () => botao()!.click())
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(status()).toBe('Permita o microfone…')
    expect(botao()?.disabled).toBe(true)
    expect(FakeReconhecimento.instancias[0].starts).toBe(0)
    await act(async () => liberar({ getTracks: () => tracks } as unknown as MediaStream))
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
    expect(rec().starts).toBe(1)
    expect(previa()?.textContent).toBe('Ouvindo…')
    // Da próxima vez não pergunta mais.
    act(() => botao()!.click())
    act(() => rec().fim())
    await act(async () => botao()!.click())
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(rec().starts).toBe(2)
  })

  it('prompt recusado vira o aviso de bloqueio, sem começar a ouvir', async () => {
    permissoes('prompt')
    getUserMedia.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
    montar()
    await act(async () => {})
    await act(async () => botao()!.click())
    expect(FakeReconhecimento.instancias[0].starts).toBe(0)
    expect(status()).toContain('Microfone bloqueado')
    expect(botao()?.disabled).toBe(false)
  })

  it('permissão já concedida (ou API ausente) começa a ouvir no próprio toque', () => {
    permissoes('granted')
    montar()
    act(() => botao()!.click())
    expect(rec().starts).toBe(1)
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('silêncio não avisa nem para', () => {
    montar()
    act(() => botao()!.click())
    act(() => rec().erro('no-speech'))
    expect(onAviso).not.toHaveBeenCalled()
    act(() => rec().fim())
    expect(rec().starts).toBe(2)
  })

  it('desmontar no meio do ditado chama stop() e não reinicia', () => {
    montar()
    act(() => botao()!.click())
    act(() => root.unmount())
    expect(rec().stops).toBe(1)
    rec().fim()
    expect(rec().starts).toBe(1)
    root = createRoot(host)
  })
})
