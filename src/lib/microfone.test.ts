import { afterEach, describe, expect, it, vi } from 'vitest'
import { estadoMicrofone, mensagemMicrofoneBloqueado, pedirMicrofone } from './microfone'

afterEach(() => vi.unstubAllGlobals())

describe('estadoMicrofone', () => {
  it('devolve o estado da Permissions API', async () => {
    const query = vi.fn(async () => ({ state: 'prompt' }))
    vi.stubGlobal('navigator', { permissions: { query } })
    expect(await estadoMicrofone()).toBe('prompt')
    expect(query).toHaveBeenCalledWith({ name: 'microphone' })
  })

  it('é desconhecido sem a API ou quando ela recusa o nome', async () => {
    vi.stubGlobal('navigator', {})
    expect(await estadoMicrofone()).toBe('desconhecido')
    vi.stubGlobal('navigator', {
      permissions: { query: async () => Promise.reject(new TypeError('microphone')) },
    })
    expect(await estadoMicrofone()).toBe('desconhecido')
  })
})

describe('pedirMicrofone', () => {
  it('pede áudio, solta as trilhas e devolve true', async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    expect(await pedirMicrofone()).toBe(true)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('negado (ou sem getUserMedia) é false', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => Promise.reject(new DOMException('', 'NotAllowedError')) },
    })
    expect(await pedirMicrofone()).toBe(false)
    vi.stubGlobal('navigator', {})
    expect(await pedirMicrofone()).toBe(false)
  })
})

describe('mensagemMicrofoneBloqueado', () => {
  it('aponta Privacidade no iPhone e os ajustes do navegador nos demais', () => {
    expect(mensagemMicrofoneBloqueado('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)')).toContain(
      'Privacidade ▸ Microfone ▸ Safari',
    )
    expect(mensagemMicrofoneBloqueado('Mozilla/5.0 (Linux; Android 15) Chrome/140')).toBe(
      'Microfone bloqueado. Libere nos ajustes do navegador',
    )
  })
})
