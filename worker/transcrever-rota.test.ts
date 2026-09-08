import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env.d'
import {
  COTA_USUARIO_SEGUNDOS,
  MAX_BYTES,
  MODELO,
  TETO_GLOBAL_SEGUNDOS,
} from './transcrever'

// A sessão é decidida pelo header `x-teste-user`: presente → logado com esse
// id; ausente → anônimo. Assim o teste exercita o handler de verdade sem
// passar pelo better-auth (que exigiria cookies assinados e um D1 real).
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

/**
 * D1 mínimo: guarda cada prepare/bind, responde `first()` com o que o teste
 * configurar em `uso` e conta os `run()` (a gravação do uso).
 */
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

function fakeEnv(opts: {
  uso?: { usuario: number; total: number }
  ai?: (modelo: string, input: unknown) => Promise<unknown>
}) {
  const { db, chamadas } = fakeDb(opts.uso ?? { usuario: 0, total: 0 })
  const run = vi.fn(opts.ai ?? (async () => ({ text: ' Amém. ' })))
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

function pedido(init: {
  user?: string
  tipo?: string | null
  duracao?: string | null
  corpo?: BodyInit | null
  contentLength?: string
}) {
  const headers = new Headers()
  if (init.user) headers.set('x-teste-user', init.user)
  if (init.tipo !== null) headers.set('content-type', init.tipo ?? 'audio/webm;codecs=opus')
  if (init.duracao !== null) headers.set('x-duracao-segundos', init.duracao ?? '7')
  if (init.contentLength) headers.set('content-length', init.contentLength)
  return new Request('http://localhost/api/transcrever', {
    method: 'POST',
    headers,
    body: init.corpo === undefined ? new Uint8Array([1, 2, 3, 4]) : init.corpo,
  })
}

const gravacoes = (chamadas: Chamada[]) => chamadas.filter((c) => /INSERT INTO transcricao_uso/i.test(c.sql))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-02T15:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/transcrever', () => {
  it('401 sem sessão, sem tocar no AI nem no D1', async () => {
    const { env, chamadas, run } = fakeEnv({})
    const res = await app.request(pedido({}), undefined, env)
    expect(res.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
    expect(chamadas).toEqual([])
  })

  it('415 para content-type fora da lista', async () => {
    const { env, run } = fakeEnv({})
    const res = await app.request(pedido({ user: 'u1', tipo: 'application/json' }), undefined, env)
    expect(res.status).toBe(415)
    expect(run).not.toHaveBeenCalled()
  })

  it('413 quando o Content-Length passa do teto, antes de ler o corpo', async () => {
    const { env, run } = fakeEnv({})
    const res = await app.request(
      pedido({ user: 'u1', contentLength: String(MAX_BYTES + 1) }),
      undefined,
      env,
    )
    expect(res.status).toBe(413)
    expect(run).not.toHaveBeenCalled()
  })

  it('413 quando o corpo lido passa do teto (sem Content-Length)', async () => {
    const { env, run } = fakeEnv({})
    const res = await app.request(
      pedido({ user: 'u1', corpo: new Uint8Array(MAX_BYTES + 1) }),
      undefined,
      env,
    )
    expect(res.status).toBe(413)
    expect(run).not.toHaveBeenCalled()
  })

  it('400 para duração ausente, inválida ou acima de MAX_SEGUNDOS', async () => {
    for (const duracao of [null, 'x', '0', '61', '2.5']) {
      const { env, run } = fakeEnv({})
      const res = await app.request(pedido({ user: 'u1', duracao }), undefined, env)
      expect(res.status, `duracao=${duracao}`).toBe(400)
      expect(run).not.toHaveBeenCalled()
    }
  })

  it('429 com voltaEm quando a cota do usuário estoura; não chama o AI nem grava', async () => {
    const { env, chamadas, run } = fakeEnv({
      uso: { usuario: COTA_USUARIO_SEGUNDOS - 3, total: 100 },
    })
    const res = await app.request(pedido({ user: 'u1', duracao: '4' }), undefined, env)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({
      erro: 'Cota diária de ditado esgotada',
      voltaEm: '2026-09-03T00:00:00.000Z',
    })
    expect(run).not.toHaveBeenCalled()
    expect(gravacoes(chamadas)).toEqual([])
  })

  it('503 com voltaEm quando o teto global estoura', async () => {
    const { env, chamadas, run } = fakeEnv({
      uso: { usuario: 0, total: TETO_GLOBAL_SEGUNDOS },
    })
    const res = await app.request(pedido({ user: 'u1', duracao: '1' }), undefined, env)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      erro: 'Ditado indisponível hoje',
      voltaEm: '2026-09-03T00:00:00.000Z',
    })
    expect(run).not.toHaveBeenCalled()
    expect(gravacoes(chamadas)).toEqual([])
  })

  it('502 quando o AI falha ou devolve sem `text`; nada é gravado', async () => {
    for (const ai of [
      async () => {
        throw new Error('boom')
      },
      async () => ({ segments: [] }),
    ]) {
      const { env, chamadas } = fakeEnv({ ai })
      const res = await app.request(pedido({ user: 'u1' }), undefined, env)
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ erro: 'Não foi possível transcrever' })
      expect(gravacoes(chamadas)).toEqual([])
    }
  })

  it('200 { texto } e grava o uso do dia (UTC) só depois do sucesso', async () => {
    const { env, chamadas, run } = fakeEnv({})
    const res = await app.request(
      pedido({ user: 'u1', duracao: '7', corpo: new Uint8Array([65, 66, 67]) }),
      undefined,
      env,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ texto: 'Amém.' })

    // Input do modelo: áudio em base64, português, transcrição.
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0]).toBe(MODELO)
    expect(run.mock.calls[0][1]).toEqual({ audio: 'QUJD', language: 'pt', task: 'transcribe' })

    // Consulta de cota: usuário + dia; gravação: usuário, dia, segundos.
    expect(chamadas[0].args).toEqual(['u1', '2026-09-02'])
    const grav = gravacoes(chamadas)
    expect(grav).toHaveLength(1)
    expect(grav[0].sql).toMatch(/ON CONFLICT\s*\(\s*user_id\s*,\s*dia\s*\)\s*DO UPDATE SET segundos = segundos \+/i)
    expect(grav[0].args).toEqual(['u1', '2026-09-02', 7])
  })

  it('a ordem das checagens: sessão antes do tipo, tipo antes da duração', async () => {
    const { env } = fakeEnv({})
    // Anônimo com tudo errado ainda é 401.
    expect(
      (await app.request(pedido({ tipo: 'text/plain', duracao: 'x' }), undefined, env)).status,
    ).toBe(401)
    // Logado, tipo errado e duração errada: 415 vence.
    expect(
      (await app.request(pedido({ user: 'u1', tipo: 'text/plain', duracao: 'x' }), undefined, env))
        .status,
    ).toBe(415)
  })
})

describe('as outras rotas seguem de pé', () => {
  it('GET /api/sync sem sessão continua 401 e o 404 padrão continua JSON', async () => {
    const { env } = fakeEnv({})
    expect((await app.request('/api/sync', undefined, env)).status).toBe(401)
    const res = await app.request('/api/nada', undefined, env)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'não encontrado' })
  })
})
