import type { Env } from './env.d'

export function buildOtpLink(appUrl: string, email: string, otp: string): string {
  const base = appUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({ email, code: otp })
  return `${base}/entrar?${params.toString()}`
}

export function otpEmailHtml(otp: string, link: string): string {
  return [
    '<div style="font-family:Georgia,serif;max-width:28rem;margin:0 auto;padding:1.5rem">',
    '<h2 style="color:#92500a">aiPericopes</h2>',
    '<p>Seu código de acesso:</p>',
    `<p style="font-size:2rem;letter-spacing:0.3em;font-weight:700">${otp}</p>`,
    `<p><a href="${link}" style="display:inline-block;background:#92500a;color:#fffaf0;padding:0.7rem 1.2rem;border-radius:8px;text-decoration:none">Entrar no aiPericopes</a></p>`,
    '<p style="color:#5f574a;font-size:0.85rem">O código vale por 10 minutos. Se você não pediu este e-mail, ignore-o.</p>',
    '</div>',
  ].join('\n')
}

export async function sendOtpEmail(env: Env, to: string, otp: string): Promise<void> {
  const link = buildOtpLink(env.APP_URL, to, otp)
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] OTP para ${to}: ${otp} — ${link}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: `${otp} é o seu código — aiPericopes`,
      html: otpEmailHtml(otp, link),
    }),
  })
  if (!res.ok) {
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${await res.text()}`)
  }
}
