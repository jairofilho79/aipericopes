import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetCacheLouvores,
  carregarMapaLouvores,
  louvoresCarregados,
  obterLouvoresDaPericope,
  type LouvorRecomendado,
} from './louvores'

const MOCK_LOUVORES: Record<string, LouvorRecomendado[]> = {
  '3068': [
    {
      id: 'cf01385d-9d14-4690-96ae-d6344d323afa',
      number: '115',
      name: 'Jesus, o bom pastor',
      category: 'Crianças e Adolescentes',
      tags: 'CIAs, Coletânea',
      similarity: 82.6,
    },
    {
      id: '9a8a6376-07aa-483f-aea1-e4d08fd607a0',
      number: '',
      name: 'A Luz do mundo',
      category: 'Dedicação',
      tags: 'PES',
      similarity: 80.2,
    },
  ],
}

function mockResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (header: string) => (header.toLowerCase() === 'content-type' ? contentType : null),
    },
    json: async () => body,
  } as unknown as Response
}

describe('louvores.ts loader', () => {
  beforeEach(() => {
    _resetCacheLouvores()
    vi.unstubAllGlobals()
  })

  it('carrega pericopes-louvores.json sob demanda e retorna louvores da perícope', async () => {
    const fetchMock = vi.fn(async () => mockResponse(MOCK_LOUVORES))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await obterLouvoresDaPericope(3068)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toContain('data/pericopes-louvores.json')
    expect(resultado).toHaveLength(2)
    expect(resultado[0].name).toBe('Jesus, o bom pastor')
    expect(resultado[0].similarity).toBe(82.6)
    expect(louvoresCarregados()).toBe(true)
  })

  it('mantém cache em memória e não faz múltiplos fetches', async () => {
    const fetchMock = vi.fn(async () => mockResponse(MOCK_LOUVORES))
    vi.stubGlobal('fetch', fetchMock)

    await obterLouvoresDaPericope(3068)
    await obterLouvoresDaPericope(3068)
    await carregarMapaLouvores()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('desduplica requisições concorrentes em voo', async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return mockResponse(MOCK_LOUVORES)
    })
    vi.stubGlobal('fetch', fetchMock)

    const [res1, res2] = await Promise.all([
      obterLouvoresDaPericope(3068),
      obterLouvoresDaPericope(3068),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(res1).toEqual(res2)
  })

  it('retorna array vazio quando a perícope não possui louvores associados', async () => {
    const fetchMock = vi.fn(async () => mockResponse(MOCK_LOUVORES))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await obterLouvoresDaPericope(9999)

    expect(resultado).toEqual([])
  })

  it('retorna array vazio e não quebra quando o fetch falha', async () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () => mockResponse(null, 500))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await obterLouvoresDaPericope(3068)

    expect(resultado).toEqual([])
    erroConsole.mockRestore()
  })

  it('retorna array vazio se o servidor retornar HTML (ex: fallback SPA)', async () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () => mockResponse('<!DOCTYPE html>...', 200, 'text/html'))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await obterLouvoresDaPericope(3068)

    expect(resultado).toEqual([])
    erroConsole.mockRestore()
  })
})
