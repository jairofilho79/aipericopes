import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env.d'

// O better-auth engole a exceção de sendVerificationOTP no próprio logger
// (create-context: runInBackgroundOrAwait faz try/catch e só chama
// logger.error). Então o mock aqui reproduz o que a produção faz de verdade:
// o handler devolve 200 e a falha só chega pelo callback.
const estado = vi.hoisted(() => ({ falha: null as unknown, status: 200 }))

vi.mock('./auth', () => ({
  createAuth: (_env: Env, aoFalharEnvio?: (err: unknown) => void) => ({
    api: { getSession: async () => null },
    handler: async () => {
      if (estado.falha !== null) aoFalharEnvio?.(estado.falha)
      return new Response(JSON.stringify({ success: true }), {
        status: estado.status,
        headers: { 'content-type': 'application/json' },
      })
    },
  }),
}))

import app from './index'

const env = {} as Env

function pedirOtp() {
  return app.request(
    '/api/auth/email-otp/send-verification-otp',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'outra@pessoa.com', type: 'sign-in' }),
    },
    env,
  )
}

describe('POST /api/auth/* — envio de OTP que falhou não pode responder sucesso', () => {
  beforeEach(() => {
    estado.falha = null
    estado.status = 200
  })
  afterEach(() => vi.restoreAllMocks())

  it('responde 502 quando o envio do e-mail falhou por baixo do 200 do better-auth', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    estado.falha = new Error('Falha ao enviar e-mail (403): validation_error')

    const res = await pedirOtp()

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({
      erro: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.',
    })
  })

  it('deixa passar a resposta do better-auth quando nada falhou', async () => {
    const res = await pedirOtp()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
  })

  it('não mascara um erro que o próprio better-auth já sinalizou (rate limit)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    estado.falha = new Error('Falha ao enviar e-mail (403): validation_error')
    estado.status = 429

    const res = await pedirOtp()

    expect(res.status).toBe(429)
  })
})
