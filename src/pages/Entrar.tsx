import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { syncNow } from '../lib/sync'

type Etapa = 'email' | 'codigo' | 'verificando'

export default function Entrar() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const autoTried = useRef(false)

  // magic link: /entrar?email=…&code=…
  useEffect(() => {
    const qEmail = searchParams.get('email')
    const qCode = searchParams.get('code')
    if (!qEmail || !qCode || autoTried.current) return
    autoTried.current = true
    setEmail(qEmail)
    setEtapa('verificando')
    verificar(qEmail, qCode)
  }, [searchParams])

  useEffect(() => {
    if (session) {
      syncNow()
      navigate('/', { replace: true })
    }
  }, [session, navigate])

  async function verificar(em: string, otp: string) {
    setErro('')
    const { error } = await authClient.signIn.emailOtp({ email: em, otp })
    if (error) {
      setEtapa('codigo')
      setErro('Código inválido ou expirado. Peça um novo código se necessário.')
    }
    // sucesso: useSession muda e o efeito acima redireciona
  }

  async function onPedirCodigo(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEnviando(true)
    setErro('')
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível enviar o e-mail agora. Tente novamente.')
      return
    }
    setEtapa('codigo')
  }

  async function onVerificar(e: FormEvent) {
    e.preventDefault()
    if (codigo.trim().length !== 6) return
    setEtapa('verificando')
    await verificar(email.trim(), codigo.trim())
  }

  return (
    <section className="entrar">
      <h1>Entrar</h1>
      {etapa === 'email' && (
        <form className="entrar-form" onSubmit={onPedirCodigo}>
          <p className="lead">
            Digite seu e-mail. Enviaremos um código de 6 dígitos e um link de acesso.
          </p>
          <label>
            E-mail
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </label>
          <button type="submit" className="cta" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      )}
      {etapa === 'codigo' && (
        <form className="entrar-form" onSubmit={onVerificar}>
          <p className="lead">
            Enviamos um código para <strong>{email}</strong>. Digite-o abaixo — ou toque no
            link do e-mail.
          </p>
          <label>
            Código de 6 dígitos
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={codigo}
              // Sem maxLength: ele truncaria a colagem ANTES de tirarmos os
              // separadores, e "123 456" viraria "12345". Tira não-dígito e só
              // então corta em 6.
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
          </label>
          <button type="submit" className="cta" disabled={codigo.length !== 6}>
            Entrar
          </button>
          <button type="button" className="linkish" onClick={() => setEtapa('email')}>
            Usar outro e-mail
          </button>
        </form>
      )}
      {etapa === 'verificando' && <p className="muted">Verificando…</p>}
      {erro && (
        <p className="entrar-erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  )
}
