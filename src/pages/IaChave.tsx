import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import {
  type ChaveIaPublica,
  obterChaveIa,
  removerChaveIa,
  salvarChaveIa,
} from '../lib/ia-client'
import {
  IconeChave,
  IconeCheck,
  IconeLixeira,
} from '../components/icones'
import BotaoVoltar from '../components/BotaoVoltar'

type ProvedorOpcao = {
  id: 'openai' | 'openrouter' | 'anthropic' | 'gemini' | 'cloudflare'
  nome: string
  modeloPadrao: string
  dica: string
  placeholder: string
}

const PROVEDORES: ProvedorOpcao[] = [
  {
    id: 'openai',
    nome: 'OpenAI',
    modeloPadrao: 'gpt-4o-mini',
    dica: 'Chave no formato sk-... do painel da OpenAI (platform.openai.com).',
    placeholder: 'sk-...',
  },
  {
    id: 'anthropic',
    nome: 'Anthropic (Claude)',
    modeloPadrao: 'claude-haiku-4-5',
    dica: 'Chave no formato sk-ant-... do console da Anthropic (console.anthropic.com).',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'gemini',
    nome: 'Google Gemini',
    modeloPadrao: 'gemini-2.5-flash',
    dica: 'Chave de API obtida no Google AI Studio (aistudio.google.com).',
    placeholder: 'AIzaSy...',
  },
  {
    id: 'openrouter',
    nome: 'OpenRouter',
    modeloPadrao: 'google/gemini-2.5-flash',
    dica: 'Chave no formato sk-or-... do OpenRouter (openrouter.ai).',
    placeholder: 'sk-or-...',
  },
  {
    id: 'cloudflare',
    nome: 'Cloudflare (Workers AI)',
    modeloPadrao: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    dica: 'API Token com permissão Workers AI + Account ID da sua conta Cloudflare.',
    placeholder: 'Token de API da Cloudflare...',
  },
]

export default function IaChave() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [chaveAtual, setChaveAtual] = useState<ChaveIaPublica | null>(null)

  const [provedor, setProvedor] = useState<ProvedorOpcao['id']>('openai')
  const [chave, setChave] = useState('')
  const [modelo, setModelo] = useState('')
  const [contaId, setContaId] = useState('')
  const [mostrarChave, setMostrarChave] = useState(false)

  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const c = await obterChaveIa()
      setChaveAtual(c)
      if (c) {
        setProvedor(c.provedor)
        setModelo(c.modelo)
        if (c.contaId) setContaId(c.contaId)
      } else {
        setModelo(PROVEDORES[0].modeloPadrao)
      }
      setCarregando(false)
    }
    void carregar()
  }, [])

  function trocarProvedor(novoId: ProvedorOpcao['id']) {
    setProvedor(novoId)
    const p = PROVEDORES.find((item) => item.id === novoId)
    if (p) setModelo(p.modeloPadrao)
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!chave.trim()) {
      setErro('Digite a chave de API.')
      return
    }
    if (provedor === 'cloudflare' && !contaId.trim()) {
      setErro('Digite o Account ID da Cloudflare (32 caracteres).')
      return
    }

    setSalvando(true)
    setErro(null)
    setSucesso(false)

    const res = await salvarChaveIa({
      provedor,
      modelo: modelo.trim() || undefined,
      chave: chave.trim(),
      contaId: provedor === 'cloudflare' ? contaId.trim() : undefined,
    })

    setSalvando(false)

    if (!res.ok) {
      setErro(res.erro ?? 'Não foi possível validar a chave.')
      return
    }

    setChaveAtual(res.chave ?? null)
    setChave('')
    setSucesso(true)
    setTimeout(() => setSucesso(false), 4000)
  }

  async function handleRemover() {
    if (!confirm('Deseja realmente remover sua chave de IA? O histórico continuará salvo.')) return
    setRemovendo(true)
    const ok = await removerChaveIa()
    setRemovendo(false)
    if (ok) {
      setChaveAtual(null)
      setChave('')
    }
  }

  if (!session) {
    return (
      <section className="ajustes ia-chave-pagina">
        <div className="subpagina-topo">
          <BotaoVoltar to="/perfil" rotulo="Voltar para o Perfil" />
          <h1>Chave de IA (BYOK)</h1>
        </div>
        <p className="lead muted">
          É necessário entrar na sua conta para configurar sua chave de inteligência artificial.
        </p>
        <button type="button" className="cta" onClick={() => navigate('/entrar')}>
          Entrar na conta
        </button>
      </section>
    )
  }

  return (
    <section className="ajustes ia-chave-pagina">
      <div className="subpagina-topo">
        <BotaoVoltar to="/perfil" rotulo="Voltar para o Perfil" />
        <h1>Chave de IA (BYOK)</h1>
      </div>

      <p className="lead ia-chave-intro">
        Configure sua própria chave de inteligência artificial para liberar a Explicação Rápida de
        versículos bíblicos e o chat de perguntas.
      </p>

      {carregando ? (
        <p className="muted ia-chave-carregando">Carregando dados da chave...</p>
      ) : (
        <>
          {chaveAtual && (
            <div className="ia-chave-status-card">
              <div className="ia-chave-status-header">
                <div className="ia-badge-ativo">
                  <IconeCheck size={14} /> Chave ativa e configurada
                </div>
                <button
                  type="button"
                  className="btn-remover-chave"
                  onClick={() => void handleRemover()}
                  disabled={removendo}
                  title="Remover esta chave"
                >
                  <IconeLixeira size={14} />
                  <span>{removendo ? 'Removendo...' : 'Remover'}</span>
                </button>
              </div>

              <div className="ia-chave-info-grid">
                <div className="ia-chave-info-item">
                  <span className="ia-chave-info-label">Provedor</span>
                  <span className="ia-chave-info-val">
                    {PROVEDORES.find((p) => p.id === chaveAtual.provedor)?.nome ?? chaveAtual.provedor}
                  </span>
                </div>
                <div className="ia-chave-info-item">
                  <span className="ia-chave-info-label">Modelo</span>
                  <code className="ia-chave-info-code">{chaveAtual.modelo}</code>
                </div>
                <div className="ia-chave-info-item">
                  <span className="ia-chave-info-label">Chave de API</span>
                  <span className="ia-chave-info-val ia-chave-mascara">•••••••• {chaveAtual.ultimos4}</span>
                </div>
                {chaveAtual.contaId && (
                  <div className="ia-chave-info-item">
                    <span className="ia-chave-info-label">Conta ID</span>
                    <span className="ia-chave-info-val">{chaveAtual.contaId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <form className="ia-chave-form" onSubmit={(e) => void submeter(e)}>
            <h2>{chaveAtual ? 'Substituir ou atualizar chave' : 'Adicionar nova chave'}</h2>

            <div className="ia-campo">
              <label htmlFor="ia-provedor-select">Provedor de IA</label>
              <div className="ia-select-wrapper">
                <select
                  id="ia-provedor-select"
                  value={provedor}
                  onChange={(e) => trocarProvedor(e.target.value as ProvedorOpcao['id'])}
                  disabled={salvando}
                >
                  {PROVEDORES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <span className="ia-campo-dica">
                {PROVEDORES.find((p) => p.id === provedor)?.dica}
              </span>
            </div>

            {provedor === 'cloudflare' && (
              <div className="ia-campo">
                <label htmlFor="ia-conta-id">Cloudflare Account ID</label>
                <input
                  id="ia-conta-id"
                  type="text"
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                  placeholder="32 caracteres hexadecimais"
                  disabled={salvando}
                  required
                />
                <span className="ia-campo-dica">
                  ID de 32 caracteres da conta Cloudflare (disponível no painel da Cloudflare).
                </span>
              </div>
            )}

            <div className="ia-campo">
              <label htmlFor="ia-modelo-input">
                <span>Modelo</span>
                <span className="ia-campo-tag">Personalizável</span>
              </label>
              <input
                id="ia-modelo-input"
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder={PROVEDORES.find((p) => p.id === provedor)?.modeloPadrao}
                disabled={salvando}
              />
              <span className="ia-campo-dica">
                Você pode manter o modelo padrão recomendado ou personalizar o identificador exato.
              </span>
            </div>

            <div className="ia-campo">
              <label htmlFor="ia-chave-input">Chave de API / Token</label>
              <div className="ia-chave-input-container">
                <input
                  id="ia-chave-input"
                  type={mostrarChave ? 'text' : 'password'}
                  value={chave}
                  onChange={(e) => setChave(e.target.value)}
                  placeholder={PROVEDORES.find((p) => p.id === provedor)?.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={salvando}
                  required
                />
                <button
                  type="button"
                  className="ia-btn-toggle-senha"
                  onClick={() => setMostrarChave(!mostrarChave)}
                  aria-label={mostrarChave ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {mostrarChave ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <span className="ia-campo-dica">
                Sua chave é transmitida com segurança e criptografada via AES-GCM 256.
              </span>
            </div>

            {erro && (
              <div className="ia-status-mensagem ia-status-erro" role="alert">
                <span className="ia-status-icone" aria-hidden="true">⚠️</span>
                <div>{erro}</div>
              </div>
            )}

            {sucesso && (
              <div className="ia-status-mensagem ia-status-sucesso" role="status">
                <IconeCheck size={18} />
                <div>Chave testada, validada e gravada com sucesso!</div>
              </div>
            )}

            <div className="ia-chave-submit-linha">
              <button type="submit" className="cta ia-chave-submit-btn" disabled={salvando}>
                <IconeChave size={18} />
                <span>{salvando ? 'Validando chave com o provedor...' : 'Testar e Salvar'}</span>
              </button>
            </div>

            <div className="ia-seguranca-callout">
              <div className="ia-seguranca-icone" aria-hidden="true">
                🔒
              </div>
              <div className="ia-seguranca-texto">
                <strong>Segurança e Criptografia AES-GCM 256</strong>
                <p>
                  Sua chave é criptografada no servidor via AES-GCM 256 e nunca é exposta.
                  Ela é associada exclusivamente ao seu usuário (AAD) e decifrada apenas no
                  momento de atender às suas solicitações.
                </p>
              </div>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
