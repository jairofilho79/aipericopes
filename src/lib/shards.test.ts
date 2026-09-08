// ATENÇÃO: os caches de módulo de shards.ts nunca são resetados entre os
// testes. Cada teste precisa usar um slug de livro diferente — repetir um slug
// faz o teste passar sem chegar a exercitar o código (falso positivo silencioso).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarEstudo, carregarTexto, shardCarregado } from './shards'

function resposta(body: unknown, contentType = 'application/json'): Response {
  return {
    ok: true,
    headers: { get: (nome: string) => (nome === 'content-type' ? contentType : null) },
    json: async () => body,
  } as unknown as Response
}

function respostaJson(body: unknown): Response {
  return resposta(body)
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('carregarTexto', () => {
  it('mapeia ordem → texto e busca o arquivo do livro', async () => {
    const fetchMock = vi.fn(async () =>
      respostaJson([{ ordem: 7, texto: 'No princípio' }]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const mapa = await carregarTexto('genesis')

    expect(mapa.get(7)).toEqual({ texto: 'No princípio' })
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toContain('data/texto/genesis.json')
  })

  it('carrega o sobrescrito junto com o texto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respostaJson([{ ordem: 3049, texto: 'Capítulo 3\n1 Ah SENHOR', sobrescrito: 'Salmo de Davi' }]),
      ),
    )

    expect((await carregarTexto('salmos')).get(3049)).toEqual({
      texto: 'Capítulo 3\n1 Ah SENHOR',
      sobrescrito: 'Salmo de Davi',
    })
  })

  it('não busca o mesmo livro duas vezes', async () => {
    const fetchMock = vi.fn(async () => respostaJson([{ ordem: 1, texto: 'a' }]))
    vi.stubGlobal('fetch', fetchMock)

    await carregarTexto('exodo')
    await carregarTexto('exodo')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(shardCarregado('texto', 'exodo')).toBe(true)
  })

  it('uma falha não fica grudada: a próxima tentativa busca de novo', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(respostaJson([{ ordem: 2, texto: 'b' }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(carregarTexto('levitico')).rejects.toThrow('offline')
    expect(shardCarregado('texto', 'levitico')).toBe(false)
    expect((await carregarTexto('levitico')).get(2)).toEqual({ texto: 'b' })
  })
})

describe('resposta que não é um shard', () => {
  // O Cloudflare devolve o index.html com HTTP 200 para caminhos inexistentes
  // (not_found_handling: single-page-application): o guard de res.ok passa e o
  // parse explodiria com um SyntaxError em inglês na tela de leitura.
  it('HTML com status 200 vira erro em pt-BR, não SyntaxError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta('<!doctype html><html lang="pt-BR">', 'text/html; charset=utf-8')),
    )

    await expect(carregarTexto('deuteronomio')).rejects.toThrow('Falha ao carregar texto de deuteronomio')
    expect(shardCarregado('texto', 'deuteronomio')).toBe(false)
  })

  it('JSON que não é uma lista de linhas também é recusado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ erro: 'nao é um shard' })))

    await expect(carregarTexto('josue')).rejects.toThrow('Falha ao carregar texto de josue')
    expect(shardCarregado('texto', 'josue')).toBe(false)
  })

  it('corpo que não parseia como JSON vira erro em pt-BR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => {
              throw new SyntaxError('Unexpected end of JSON input')
            },
          }) as unknown as Response,
      ),
    )

    await expect(carregarEstudo('juizes')).rejects.toThrow('Falha ao carregar estudo de juizes')
  })
})

describe('carregarEstudo', () => {
  it('mapeia ordem → bloco de estudo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respostaJson([
          {
            ordem: 3,
            contexto_historico_literario: 'ctx',
            resenha: 'res',
            perguntas_reflexao: ['q1'],
          },
        ]),
      ),
    )

    const mapa = await carregarEstudo('numeros')

    expect(mapa.get(3)?.resenha).toBe('res')
    expect(mapa.get(3)?.perguntas_reflexao).toEqual(['q1'])
  })
})
