import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildOtpLink, otpEmailHtml, sendOtpEmail } from './email'
import type { Env } from './env.d'

describe('buildOtpLink', () => {
  it('monta /entrar com email e code escapados', () => {
    expect(buildOtpLink('https://app.dev', 'a+b@x.com', '123456')).toBe(
      'https://app.dev/entrar?email=a%2Bb%40x.com&code=123456',
    )
  })
  it('não duplica barra final do APP_URL', () => {
    expect(buildOtpLink('https://app.dev/', 'a@x.com', '111111')).toBe(
      'https://app.dev/entrar?email=a%40x.com&code=111111',
    )
  })
})

describe('otpEmailHtml', () => {
  it('contém o código e o link', () => {
    const html = otpEmailHtml('654321', 'https://app.dev/entrar?email=a%40x.com&code=654321')
    expect(html).toContain('654321')
    expect(html).toContain('https://app.dev/entrar?email=a%40x.com&code=654321')
  })
})

describe('sendOtpEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sem RESEND_API_KEY: registra o código via console.log e não chama fetch', async () => {
    const fetchMock = vi.fn()
    const consoleSpy = vi.spyOn(console, 'log')
    vi.stubGlobal('fetch', fetchMock)

    const env: Env = {
      DB: {} as D1Database,
      AUDIO: {} as R2Bucket,
      AI: {} as Ai,
      BETTER_AUTH_SECRET: 'secret',
      APP_URL: 'https://app.dev',
      EMAIL_FROM: 'noreply@pericopes.dev',
    }

    await sendOtpEmail(env, 'user@example.com', '123456')

    expect(consoleSpy).toHaveBeenCalledWith(
      '[dev] OTP para user@example.com: 123456 — https://app.dev/entrar?email=user%40example.com&code=123456',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('com RESEND_API_KEY e resposta ok: chama fetch com parâmetros corretos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const env: Env = {
      DB: {} as D1Database,
      AUDIO: {} as R2Bucket,
      AI: {} as Ai,
      BETTER_AUTH_SECRET: 'secret',
      APP_URL: 'https://app.dev',
      EMAIL_FROM: 'noreply@pericopes.dev',
      RESEND_API_KEY: 'test-key-123',
    }

    await sendOtpEmail(env, 'user@example.com', '123456')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key-123',
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"to":["user@example.com"]'),
    })

    const callBody = fetchMock.mock.calls[0][1]?.body
    const bodyObj = JSON.parse(callBody as string)
    expect(bodyObj.from).toBe('noreply@pericopes.dev')
    expect(bodyObj.to).toEqual(['user@example.com'])
    expect(bodyObj.subject).toContain('123456')
    expect(bodyObj.html).toContain('123456')
    expect(bodyObj.html).toContain('https://app.dev/entrar?email=user%40example.com&code=123456')
  })

  it('com fetch respondendo ok: false (status 500): rejeita com throw', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })
    vi.stubGlobal('fetch', fetchMock)

    const env: Env = {
      DB: {} as D1Database,
      AUDIO: {} as R2Bucket,
      AI: {} as Ai,
      BETTER_AUTH_SECRET: 'secret',
      APP_URL: 'https://app.dev',
      EMAIL_FROM: 'noreply@pericopes.dev',
      RESEND_API_KEY: 'test-key-123',
    }

    await expect(sendOtpEmail(env, 'user@example.com', '123456')).rejects.toThrow(
      /Falha ao enviar e-mail \(500\)/,
    )
  })
})
