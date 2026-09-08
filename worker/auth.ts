import { APIError, betterAuth } from 'better-auth'
import { emailOTP } from 'better-auth/plugins'
import { D1Dialect } from 'kysely-d1'
import { isEmailAllowed } from './allowlist'
import { sendOtpEmail } from './email'
import type { Env } from './env.d'

// Origens de desenvolvimento local só são confiáveis quando o próprio
// APP_URL configurado é local — em produção (APP_URL real) elas nunca
// entram na lista.
const LOCAL_DEV_ORIGINS = ['http://localhost:8787', 'http://localhost:5173']

/** `ja…@exemplo.com` — o suficiente para depurar sem logar o e-mail inteiro. */
function mascararEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 0) return `${email.slice(0, 2)}…`
  return `${email.slice(0, 2)}…${email.slice(at)}`
}

/**
 * O envio do OTP, com a falha visível para quem chamou.
 *
 * O better-auth roda `sendVerificationOTP` dentro de `runInBackgroundOrAwait`,
 * que faz try/catch e despeja a exceção no próprio logger — a rota responde
 * `{ success: true }` mesmo quando nada saiu. Foi assim que um 403 do Resend
 * ("onboarding@resend.dev só entrega para o dono da conta") virou um "código
 * enviado" na tela, sem código nenhum a caminho. `aoFalhar` é o fio que leva
 * essa falha de volta para a rota, que a transforma em 502.
 *
 * O bloqueio pela allowlist NÃO é falha de envio: ele continua silencioso de
 * propósito, senão a resposta diria a um estranho quais e-mails existem.
 */
export function criarEnviadorOtp(env: Env, aoFalhar: (err: unknown) => void) {
  return async ({ email, otp }: { email: string; otp: string }): Promise<void> => {
    if (!isEmailAllowed(email, env.ALLOWED_EMAILS)) {
      console.log(`allowlist: bloqueado envio para ${mascararEmail(email)}`)
      return // resposta genérica de sucesso, sem enviar
    }
    try {
      await sendOtpEmail(env, email, otp)
    } catch (err) {
      aoFalhar(err)
      throw err // o better-auth ainda registra; o aviso acima é o que a rota lê
    }
  }
}

/**
 * `aoFalharEnvio` é chamado antes de `handler` resolver enquanto não houver
 * `advanced.backgroundTasks.handler` configurado: sem ele o better-auth
 * *espera* o envio (ver createAuth em better-auth/dist/context). Se algum dia
 * quisermos envio de fundo de verdade, a rota precisa mudar junto.
 */
export function createAuth(env: Env, aoFalharEnvio: (err: unknown) => void = () => {}) {
  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: '/api/auth',
    trustedOrigins: env.APP_URL.startsWith('http://localhost')
      ? [env.APP_URL, ...LOCAL_DEV_ORIGINS]
      : [env.APP_URL],
    database: {
      dialect: new D1Dialect({ database: env.DB }),
      type: 'sqlite',
    },
    session: {
      expiresIn: 60 * 60 * 24 * 90, // 90 dias (spec)
      updateAge: 60 * 60 * 24, // renovação rolante diária
    },
    // Sem isto o better-auth não resolve o IP do cliente atrás da Cloudflare e
    // cai num único balde compartilhado por rota — o rate limit vira global.
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'rateLimit',
      // Chave do customRules é o path já normalizado contra o basePath
      // (ver api/rate-limiter: normalizePathname(req.url, basePath)), ou seja
      // sem o prefixo /api/auth. Envio de OTP custa e-mail: aperta a mão.
      customRules: {
        '/email-otp/send-verification-otp': { window: 600, max: 5 },
      },
    },
    // Segundo gate autoritativo: o OTP é gravado (e pode ser verificado)
    // antes de sendVerificationOTP rodar, então um e-mail bloqueado ainda
    // teria um código válido em circulação caso alguém o obtivesse. Este
    // hook impede a criação da conta na hora, independente do gate de
    // envio abaixo.
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            if (!isEmailAllowed(user.email, env.ALLOWED_EMAILS)) {
              throw new APIError('FORBIDDEN', {
                message: 'e-mail não permitido',
                code: 'EMAIL_NOT_ALLOWED',
              })
            }
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        sendVerificationOTP: criarEnviadorOtp(env, aoFalharEnvio),
      }),
    ],
  })
}
