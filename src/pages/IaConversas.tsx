import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import {
  type ConversaResumo,
  apagarConversa,
  criarConversa,
  listarConversas,
} from '../lib/ia-client'
import {
  IconeChat,
  IconeLixeira,
} from '../components/icones'
import BotaoVoltar from '../components/BotaoVoltar'

export default function IaConversas() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  const [carregando, setCarregando] = useState(true)
  const [conversas, setConversas] = useState<ConversaResumo[]>([])
  const [criandoNova, setCriandoNova] = useState(false)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const lista = await listarConversas()
      setConversas(lista)
      setCarregando(false)
    }
    if (session) void carregar()
  }, [session])

  async function handleNovaConversa() {
    setCriandoNova(true)
    try {
      const c = await criarConversa({
        titulo: 'Nova conversa bíblica',
        escopo: 'avulsa',
      })
      if (c) {
        navigate(`/ia/conversa/${c.id}`)
      }
    } finally {
      setCriandoNova(false)
    }
  }

  async function handleApagar(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm('Deseja apagar esta conversa?')) return
    const ok = await apagarConversa(id)
    if (ok) {
      setConversas((prev) => prev.filter((item) => item.id !== id))
    }
  }

  function formatarData(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    } catch {
      return ''
    }
  }

  if (!session) {
    return (
      <section className="ajustes">
        <div className="subpagina-topo">
          <BotaoVoltar to="/perfil" rotulo="Voltar para o Perfil" />
          <h1>Conversas com IA</h1>
        </div>
        <p className="lead muted">Entre na sua conta para acessar suas conversas.</p>
      </section>
    )
  }

  return (
    <section className="ajustes ia-historico-pagina">
      <div className="subpagina-topo">
        <BotaoVoltar to="/perfil" rotulo="Voltar para o Perfil" />
        <h1>Conversas com IA</h1>
      </div>

      <div className="ia-conversas-topo-linha">
        <p className="muted">Suas conversas e dúvidas sobre a Bíblia.</p>
        <button
          type="button"
          className="cta btn-nova-conversa"
          onClick={() => void handleNovaConversa()}
          disabled={criandoNova}
        >
          <IconeChat size={16} /> Nova conversa
        </button>
      </div>

      {carregando ? (
        <p className="muted">Carregando conversas...</p>
      ) : conversas.length === 0 ? (
        <div className="ia-vazio-box">
          <IconeChat size={32} />
          <p>Nenhuma conversa encontrada.</p>
          <span className="muted">
            Você pode iniciar uma conversa a partir da leitura ou tocando em Nova conversa.
          </span>
        </div>
      ) : (
        <div className="ia-lista-cartoes">
          {conversas.map((c) => (
            <Link key={c.id} to={`/ia/conversa/${c.id}`} className="ia-cartao-item link-cartao">
              <div className="ia-cartao-cabecalho">
                <div className="ia-cartao-meta">
                  <strong className="ia-cartao-ref">{c.titulo}</strong>
                  <span className="ia-cartao-data muted">{formatarData(c.atualizadoEm)}</span>
                </div>
                <button
                  type="button"
                  className="linkish btn-perigo"
                  onClick={(e) => void handleApagar(c.id, e)}
                  title="Apagar conversa"
                >
                  <IconeLixeira size={15} />
                </button>
              </div>
              {c.livro && c.capituloInicio && (
                <span className="ia-cartao-subref muted">
                  Baseada em {c.livro} {c.capituloInicio}:{c.versiculoInicio}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
