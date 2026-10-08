import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  IconeVoltar,
} from '../components/icones'

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
      <section className="ajustes">
        <header className="ajustes-topo">
          <Link to="/perfil" className="linkish">
            <IconeVoltar size={18} /> Voltar ao Perfil
          </Link>
          <h1>Chave de IA (BYOK)</h1>
        </header>
        <p className="muted">É necessário entrar na sua conta para configurar sua chave de IA.</p>
        <button type="button" className="cta" onClick={() => navigate('/entrar')}>
          Entrar na conta
        </button>
      </section>
    )
  }

  return (
    <section className="ajustes ia-chave-pagina">
      <header className="ajustes-topo">
        <Link to="/perfil" className="linkish">
          <IconeVoltar size={18} /> Perfil
        </Link>
        <h1>Chave de IA (BYOK)</h1>
      </header>

      <p className="muted">
        Configure sua própria chave de inteligência artificial para liberar a Explicação Rápida de
        versículos bíblicos e o chat de perguntas.
      </p>

      {carregando ? (
        <p className="muted">Carregando dados da chave...</p>
      ) : (
        <>
          {chaveAtual && (
            <div className="ia-chave-status-box">
              <div className="ia-chave-status-topo">
                <span className="ia-badge">
                  <IconeCheck size={14} /> Chave Ativa
                </span>
                <button
                  type="button"
                  className="linkish btn-perigo"
                  onClick={() => void handleRemover()}
                  disabled={removendo}
                >
                  <IconeLixeira size={15} /> Remover chave
                </button>
              </div>

              <div className="ia-chave-detalhes">
                <p>
                  <strong>Provedor:</strong>{' '}
                  {PROVEDORES.find((p) => p.id === chaveAtual.provedor)?.nome ?? chaveAtual.provedor}
                </p>
                <p>
                  <strong>Modelo:</strong> <code>{chaveAtual.modelo}</code>
                </p>
                <p>
                  <strong>Chave:</strong> •••••••• {chaveAtual.ultimos4}
                </p>
                {chaveAtual.contaId && (
                  <p>
                    <strong>Conta ID:</strong> {chaveAtual.contaId}
                  </p>
                )}
              </div>
            </div>
          )}

          <form className="ia-chave-form" onSubmit={(e) => void submeter(e)}>
            <h2>{chaveAtual ? 'Substituir ou atualizar chave' : 'Adicionar nova chave'}</h2>

            <div className="campo">
              <label htmlFor="ia-provedor-select">Provedor de IA</label>
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
              <span className="campo-dica">
                {PROVEDORES.find((p) => p.id === provedor)?.dica}
              </span>
            </div>

            {provedor === 'cloudflare' && (
              <div className="campo">
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
              </div>
            )}

            <div className="campo">
              <label htmlFor="ia-modelo-input">Modelo</label>
              <input
                id="ia-modelo-input"
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder={PROVEDORES.find((p) => p.id === provedor)?.modeloPadrao}
                disabled={salvando}
              />
              <span className="campo-dica">Você pode personalizar o ID exato do modelo.</span>
            </div>

            <div className="campo">
              <label htmlFor="ia-chave-input">Chave de API / Token</label>
              <div className="campo-senha-linha">
                <input
                  id="ia-chave-input"
                  type={mostrarChave ? 'text' : 'password'}
                  value={chave}
                  onChange={(e) => setChave(e.target.value)}
                  placeholder={PROVEDORES.find((p) => p.id === provedor)?.placeholder}
                  autoComplete="off"
                  disabled={salvando}
                  required
                />
                <button
                  type="button"
                  className="linkish btn-olho"
                  onClick={() => setMostrarChave(!mostrarChave)}
                >
                  {mostrarChave ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {erro && (
              <div className="ia-erro-box" role="alert">
                <p>{erro}</p>
              </div>
            )}

            {sucesso && (
              <div className="ia-sucesso-box" role="status">
                <IconeCheck size={16} /> Chave validada e gravada com sucesso!
              </div>
            )}

            <div className="ia-chave-submit-linha">
              <button type="submit" className="cta" disabled={salvando}>
                <IconeChave size={18} />
                {salvando ? 'Validando chave...' : 'Testar e Salvar'}
              </button>
            </div>

            <p className="ia-privacidade-nota muted">
              🔒 <strong>Segurança:</strong> Sua chave é criptografada no servidor via AES-GCM 256 e
              nunca é exposta. Ela é utilizada apenas para atender às suas próprias solicitações de
              estudo bíblico.
            </p>
          </form>
        </>
      )}
    </section>
  )
}
