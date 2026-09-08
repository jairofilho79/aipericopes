import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env.d'
import {
  COTA_USUARIO_CARACTERES,
  MAX_CARACTERES,
  MODELO,
  PROMPT,
  TETO_GLOBAL_CARACTERES,
} from './revisar'

// Mesmo truque de transcrever-rota.test.ts: a sessão vem do header
// `x-teste-user`, sem passar pelo better-auth.
vi.mock('./auth', () => ({
  createAuth: () => ({
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get('x-teste-user')
        return id ? { user: { id } } : null
      },
    },
    handler: async () => new Response('auth mock', { status: 500 }),
  }),
}))

import app from './index'

type Chamada = { sql: string; args: unknown[] }

function fakeDb(uso: { usuario: number; total: number }) {
  const chamadas: Chamada[] = []
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          chamadas.push({ sql, args })
          return {
            first: async () => uso,
            run: async () => ({ success: true }),
          }
        },
      }
    },
  }
  return { db: db as unknown as D1Database, chamadas }
}

const ORIGINAL = 'deus é amor e a gente precisa lembrar disso cê sabe'
const REVISADO = 'Deus é amor, e a gente precisa lembrar disso, se sabe.'

function fakeEnv(opts: {
  uso?: { usuario: number; total: number }
  ai?: (modelo: string, input: unknown) => Promise<unknown>
}) {
  const { db, chamadas } = fakeDb(opts.uso ?? { usuario: 0, total: 0 })
  const run = vi.fn(opts.ai ?? (async () => ({ response: ` ${REVISADO} ` })))
  const env: Env = {
    DB: db,
    AUDIO: {} as Env['AUDIO'],
    AI: { run } as unknown as Env['AI'],
    BETTER_AUTH_SECRET: 'x',
    APP_URL: 'http://localhost:8787',
    EMAIL_FROM: 'x',
  }
  return { env, chamadas, run }
}

function pedido(init: { user?: string; corpo?: string; texto?: unknown }) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (init.user) headers.set('x-teste-user', init.user)
  const body =
    init.corpo !== undefined ? init.corpo : JSON.stringify({ texto: init.texto ?? ORIGINAL })
  return new Request('http://localhost/api/revisar-ditado', { method: 'POST', headers, body })
}

const gravacoes = (chamadas: Chamada[]) =>
  chamadas.filter((c) => /INSERT INTO revisao_uso/i.test(c.sql))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-02T15:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/revisar-ditado', () => {
  it('401 sem sessão, sem tocar no AI nem no D1', async () => {
    const { env, chamadas, run } = fakeEnv({})
    const res = await app.request(pedido({}), undefined, env)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'não autenticado' })
    expect(run).not.toHaveBeenCalled()
    expect(chamadas).toEqual([])
  })

  it('400 para corpo não-JSON, sem texto, vazio ou acima do teto', async () => {
    const casos: Parameters<typeof pedido>[0][] = [
      { user: 'u1', corpo: 'isto não é json' },
      { user: 'u1', corpo: '{}' },
      { user: 'u1', texto: 7 },
      { user: 'u1', texto: '   ' },
      { user: 'u1', texto: 'a'.repeat(MAX_CARACTERES + 1) },
    ]
    for (const caso of casos) {
      const { env, chamadas, run } = fakeEnv({})
      const res = await app.request(pedido(caso), undefined, env)
      expect(res.status, JSON.stringify(caso).slice(0, 60)).toBe(400)
      expect(await res.json()).toEqual({ erro: 'Texto inválido' })
      expect(run).not.toHaveBeenCalled()
      expect(chamadas).toEqual([])
    }
  })

  it('429 com voltaEm quando a cota do usuário estoura; não chama o AI nem grava', async () => {
    const { env, chamadas, run } = fakeEnv({
      uso: { usuario: COTA_USUARIO_CARACTERES - ORIGINAL.length + 1, total: 100 },
    })
    const res = await app.request(pedido({ user: 'u1' }), undefined, env)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({
      erro: 'Cota diária de revisão esgotada',
      voltaEm: '2026-09-03T00:00:00.000Z',
    })
    expect(run).not.toHaveBeenCalled()
    expect(gravacoes(chamadas)).toEqual([])
  })

  it('503 com voltaEm quando o teto global estoura', async () => {
    const { env, chamadas, run } = fakeEnv({
      uso: { usuario: 0, total: TETO_GLOBAL_CARACTERES },
    })
    const res = await app.request(pedido({ user: 'u1' }), undefined, env)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      erro: 'Revisão indisponível hoje',
      voltaEm: '2026-09-03T00:00:00.000Z',
    })
    expect(run).not.toHaveBeenCalled()
    expect(gravacoes(chamadas)).toEqual([])
  })

  it('502 quando o AI falha, devolve sem `response`, vazio ou tamanho fora da faixa; nada é gravado', async () => {
    for (const ai of [
      async () => {
        throw new Error('boom')
      },
      async () => ({ text: REVISADO }),
      async () => ({ response: '   ' }),
      async () => ({ response: 'Deus é amor.' }),
      async () => ({ response: `${REVISADO} ${REVISADO} ${REVISADO}` }),
    ]) {
      const { env, chamadas, run } = fakeEnv({ ai })
      const res = await app.request(pedido({ user: 'u1' }), undefined, env)
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ erro: 'Não foi possível revisar' })
      expect(run).toHaveBeenCalledTimes(1)
      expect(gravacoes(chamadas)).toEqual([])
    }
  })

  it('200 { texto } limpo e grava o uso do dia (UTC) em caracteres, só depois do sucesso', async () => {
    const { env, chamadas, run } = fakeEnv({})
    const res = await app.request(pedido({ user: 'u1', texto: `  ${ORIGINAL}  ` }), undefined, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ texto: REVISADO })

    // Input do modelo: prompt estrito no system, texto trimado no user.
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0]).toBe(MODELO)
    expect(run.mock.calls[0][1]).toEqual({
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: ORIGINAL },
      ],
      max_tokens: Math.ceil(ORIGINAL.length / 2) + 64,
      temperature: 0,
    })

    // Consulta de cota: usuário + dia; gravação: usuário, dia, caracteres.
    expect(chamadas[0].sql).toMatch(/FROM revisao_uso WHERE dia = \?2/)
    expect(chamadas[0].args).toEqual(['u1', '2026-09-02'])
    const grav = gravacoes(chamadas)
    expect(grav).toHaveLength(1)
    expect(grav[0].sql).toMatch(
      /ON CONFLICT\s*\(\s*user_id\s*,\s*dia\s*\)\s*DO UPDATE SET caracteres = caracteres \+/i,
    )
    expect(grav[0].args).toEqual(['u1', '2026-09-02', ORIGINAL.length])
  })

  it('a cota é inclusiva: fechar exatamente o teto ainda passa', async () => {
    const { env } = fakeEnv({
      uso: { usuario: COTA_USUARIO_CARACTERES - ORIGINAL.length, total: 0 },
    })
    const res = await app.request(pedido({ user: 'u1' }), undefined, env)
    expect(res.status).toBe(200)
  })

  it('a rota de transcrever segue de pé', async () => {
    const { env } = fakeEnv({})
    expect((await app.request('/api/transcrever', { method: 'POST' }, env)).status).toBe(401)
  })
})
