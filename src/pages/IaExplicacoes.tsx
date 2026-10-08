import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import {
  type ExplicacaoSalva,
  apagarExplicacao,
  criarConversa,
  listarExplicacoes,
} from '../lib/ia-client'
import {
  IconeChat,
  IconeFaisca,
  IconeLixeira,
} from '../components/icones'
import BotaoVoltar from '../components/BotaoVoltar'

export default function IaExplicacoes() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  const [carregando, setCarregando] = useState(true)
  const [explicacoes, setExplicacoes] = useState<ExplicacaoSalva[]>([])
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [criandoChatId, setCriandoChatId] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const lista = await listarExplicacoes()
      setExplicacoes(lista)
      setCarregando(false)
    }
    if (session) void carregar()
  }, [session])

  async function handleApagar(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Deseja remover esta explicação do seu histórico?')) return
    const ok = await apagarExplicacao(id)
    if (ok) {
      setExplicacoes((prev) => prev.filter((item) => item.id !== id))
      if (selecionadaId === id) setSelecionadaId(null)
    }
  }

  async function handleContinuarChat(exp: ExplicacaoSalva, e: React.MouseEvent) {
    e.stopPropagation()
    setCriandoChatId(exp.id)
    try {
      const conv = await criarConversa({
        escopo: 'selecao',
        explicacaoId: exp.id,
        pericopeOrdem: exp.pericopeOrdem,
        livro: exp.livro,
        capituloInicio: exp.capituloInicio,
        versiculoInicio: exp.versiculoInicio,
        capituloFim: exp.capituloFim,
        versiculoFim: exp.versiculoFim,
      })
      if (conv) {
        navigate(`/ia/conversa/${conv.id}`)
      }
    } finally {
      setCriandoChatId(null)
    }
  }

  function formatarRef(exp: ExplicacaoSalva) {
    if (exp.capituloInicio === exp.capituloFim) {
      return exp.versiculoInicio === exp.versiculoFim
        ? `${exp.livro} ${exp.capituloInicio}:${exp.versiculoInicio}`
        : `${exp.livro} ${exp.capituloInicio}:${exp.versiculoInicio}-${exp.versiculoFim}`
    }
    return `${exp.livro} ${exp.capituloInicio}:${exp.versiculoInicio} - ${exp.capituloFim}:${exp.versiculoFim}`
  }

  function formatarData(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }

  if (!session) {
    return (
      <section className="ajustes">
        <div className="subpagina-topo">
          <BotaoVoltar to="/perfil" rotulo="Voltar para o Perfil" />
          <h1>Minhas Explicações</h1>
        </div>
        <p className="lead muted">Entre na sua conta para consultar suas explicações de IA.</p>
      </section>
    )
  }

  return (
    <section className="ajustes ia-historico-pagina">
      <div className="subpagina-topo">
        <BotaoVoltar to="/perfil" rotulo="Voltar para o Perfil" />
        <h1>Minhas Explicações com IA</h1>
      </div>

      <p className="muted">
        Histórico de passagens bíblicas que você consultou e suas explicações salvas.
      </p>

      {carregando ? (
        <p className="muted">Carregando explicações...</p>
      ) : explicacoes.length === 0 ? (
        <div className="ia-vazio-box">
          <IconeFaisca size={32} />
          <p>Nenhuma explicação salva ainda.</p>
          <span className="muted">
            Ao ler qualquer perícope, selecione um ou mais versículos e toque em{' '}
            <strong>Explicação rápida</strong>.
          </span>
        </div>
      ) : (
        <div className="ia-lista-cartoes">
          {explicacoes.map((exp) => {
            const aberta = selecionadaId === exp.id
            return (
              <article
                key={exp.id}
                className={`ia-cartao-item ${aberta ? 'aberto' : ''}`}
                onClick={() => setSelecionadaId(aberta ? null : exp.id)}
              >
                <div className="ia-cartao-cabecalho">
                  <div className="ia-cartao-meta">
                    <strong className="ia-cartao-ref">{formatarRef(exp)}</strong>
                    <span className="ia-cartao-data muted">{formatarData(exp.criadoEm)}</span>
                  </div>
                  <div className="ia-cartao-acoes-topo">
                    <button
                      type="button"
                      className="linkish btn-perigo"
                      onClick={(e) => void handleApagar(exp.id, e)}
                      title="Apagar explicação"
                    >
                      <IconeLixeira size={15} />
                    </button>
                  </div>
                </div>

                <p className="ia-cartao-trecho-preview">
                  "{exp.trechoTexto.length > 120 ? `${exp.trechoTexto.slice(0, 120)}...` : exp.trechoTexto}"
                </p>

                {aberta && (
                  <div className="ia-cartao-detalhe" onClick={(e) => e.stopPropagation()}>
                    <div className="ia-markdown-corpo">
                      {exp.resposta.split('\n\n').map((paragrafo, idx) => (
                        <p key={idx}>{paragrafo}</p>
                      ))}
                    </div>

                    <div className="ia-cartao-rodape-acoes">
                      <button
                        type="button"
                        className="cta btn-continuar-chat"
                        onClick={(e) => void handleContinuarChat(exp, e)}
                        disabled={criandoChatId === exp.id}
                      >
                        <IconeChat size={16} />
                        {criandoChatId === exp.id ? 'Abrindo...' : 'Continuar conversa'}
                      </button>

                      <Link
                        to={`/leitura/${exp.pericopeOrdem}`}
                        className="ghost btn-ir-leitura"
                      >
                        Ir para a leitura
                      </Link>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
