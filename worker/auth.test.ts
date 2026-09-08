import { APIError } from 'better-auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuth, criarEnviadorOtp } from './auth'
import type { Env } from './env.d'

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    // Nunca usados nestes testes: nenhum deles chega a executar uma query.
    DB: {} as Env['DB'],
    AUDIO: {} as Env['AUDIO'],
    AI: {} as Env['AI'],
    BETTER_AUTH_SECRET: 'test-secret',
    APP_URL: 'http://localhost:8787',
    EMAIL_FROM: 'aiPericopes <onboarding@resend.dev>',
    ...overrides,
  }
}

describe('createAuth — databaseHooks.user.create.before (gate de criação de conta)', () => {
  it('bloqueia a criação quando o e-mail não está na allowlist', async () => {
    const auth = createAuth(fakeEnv({ ALLOWED_EMAILS: 'permitido@x.com' }))
    const before = auth.options.databaseHooks?.user?.create?.before
    expect(before).toBeTypeOf('function')

    await expect(before!({ email: 'intruso@x.com' } as never)).rejects.toBeInstanceOf(APIError)
  })

  it('permite a criação quando o e-mail está na allowlist', async () => {
    const auth = createAuth(fakeEnv({ ALLOWED_EMAILS: 'permitido@x.com' }))
    const before = auth.options.databaseHooks?.user?.create?.before

    await expect(before!({ email: 'permitido@x.com' } as never)).resolves.toBeUndefined()
  })

  it('permite qualquer e-mail quando ALLOWED_EMAILS não está definido (cadastro aberto)', async () => {
    const auth = createAuth(fakeEnv())
    const before = auth.options.databaseHooks?.user?.create?.before

    await expect(before!({ email: 'qualquer@x.com' } as never)).resolves.toBeUndefined()
  })
})

describe('createAuth — rate limit / IP', () => {
  it('resolve o IP do cliente pelos headers da Cloudflare (senão o balde vira global)', () => {
    const auth = createAuth(fakeEnv())
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
      'cf-connecting-ip',
      'x-forwarded-for',
    ])
  })

  it('aperta o envio de OTP com uma regra por rota', () => {
    const auth = createAuth(fakeEnv())
    // A chave é o path normalizado contra o basePath (sem o prefixo /api/auth).
    expect(auth.options.rateLimit?.customRules?.['/email-otp/send-verification-otp']).toEqual({
      window: 600,
      max: 5,
    })
  })

  it('mantém o rate limit ligado e persistido no D1', () => {
    const auth = createAuth(fakeEnv())
    expect(auth.options.rateLimit?.enabled).toBe(true)
    expect(auth.options.rateLimit?.storage).toBe('database')
  })
})

describe('createAuth — trustedOrigins', () => {
  it('inclui os localhost de dev quando APP_URL é local', () => {
    const auth = createAuth(fakeEnv({ APP_URL: 'http://localhost:8787' }))
    expect(auth.options.trustedOrigins).toEqual([
      'http://localhost:8787',
      'http://localhost:8787',
      'http://localhost:5173',
    ])
  })

  it('não inclui localhost quando APP_URL é de produção', () => {
    const auth = createAuth(fakeEnv({ APP_URL: 'https://biblia-pericopes.workers.dev' }))
    expect(auth.options.trustedOrigins).toEqual(['https://biblia-pericopes.workers.dev'])
  })
})

describe('criarEnviadorOtp — a falha de envio não pode virar sucesso na tela', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const envComResend = () => fakeEnv({ RESEND_API_KEY: 'chave' })

  it('avisa o chamador quando o Resend recusa o envio (403 do remetente sandbox)', async () => {
    // O 403 real que a produção devolveu: onboarding@resend.dev só entrega
    // para o dono da conta. Antes deste aviso o erro morria no logger do
    // better-auth e a rota respondia 200.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => '{"statusCode":403,"name":"validation_error"}',
      }),
    )
    const falhas: unknown[] = []
    const enviar = criarEnviadorOtp(envComResend(), (err) => falhas.push(err))

    await expect(enviar({ email: 'outra@pessoa.com', otp: '123456' })).rejects.toThrow(
      /Falha ao enviar e-mail \(403\)/,
    )
    expect(falhas).toHaveLength(1)
    expect(String(falhas[0])).toMatch(/403/)
  })

  it('não avisa nada quando o envio dá certo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const falhas: unknown[] = []
    const enviar = criarEnviadorOtp(envComResend(), (err) => falhas.push(err))

    await expect(enviar({ email: 'dono@x.com', otp: '123456' })).resolves.toBeUndefined()
    expect(falhas).toEqual([])
  })

  it('e-mail fora da allowlist não é falha de envio: segue silencioso e sem avisar', async () => {
    // Aqui o silêncio é de propósito (não revelar quem está cadastrado).
    // Se isto virasse 502, a allowlist viraria um oráculo de enumeração.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const falhas: unknown[] = []
    const enviar = criarEnviadorOtp(
      fakeEnv({ RESEND_API_KEY: 'chave', ALLOWED_EMAILS: 'dono@x.com' }),
      (err) => falhas.push(err),
    )

    await expect(enviar({ email: 'intruso@x.com', otp: '123456' })).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(falhas).toEqual([])
  })
})
