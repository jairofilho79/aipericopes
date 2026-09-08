import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_CARACTERES_REVISAO, revisarDitado } from './revisar-ditado'

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('revisarDitado', () => {
  it('manda o texto em JSON com credenciais e devolve o revisado trimado', async () => {
    const fetchMock = vi.fn(async () => resposta(200, { texto: '  Se Deus quiser, amanhã.  ' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(revisarDitado('se deus quiser amanhã')).resolves.toBe('Se Deus quiser, amanhã.')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/revisar-ditado')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ texto: 'se deus quiser amanhã' })
    // O modelo pode demorar; o pedido carrega um sinal de timeout.
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('não chama a rede para texto vazio ou acima do limite', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(revisarDitado('   ')).resolves.toBeNull()
    await expect(revisarDitado('a'.repeat(MAX_CARACTERES_REVISAO + 1))).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('qualquer falha vira null: rede, status, corpo sem texto, texto vazio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline')
      }),
    )
    await expect(revisarDitado('amém')).resolves.toBeNull()

    for (const status of [400, 401, 429, 502, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => resposta(status, { erro: 'x' })))
      await expect(revisarDitado('amém')).resolves.toBeNull()
    }

    vi.stubGlobal('fetch', vi.fn(async () => resposta(200, { outro: 1 })))
    await expect(revisarDitado('amém')).resolves.toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => resposta(200, { texto: '  ' })))
    await expect(revisarDitado('amém')).resolves.toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => new Response('não é json', { status: 200 })))
    await expect(revisarDitado('amém')).resolves.toBeNull()
  })

  it('funciona sem AbortSignal.timeout (navegador antigo)', async () => {
    const original = AbortSignal.timeout
    // @ts-expect-error simulando ambiente sem a API
    AbortSignal.timeout = undefined
    try {
      const fetchMock = vi.fn(async () => resposta(200, { texto: 'Amém.' }))
      vi.stubGlobal('fetch', fetchMock)
      await expect(revisarDitado('amém')).resolves.toBe('Amém.')
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(init.signal).toBeUndefined()
    } finally {
      AbortSignal.timeout = original
    }
  })
})
