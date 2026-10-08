import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type ConversaResumo,
  type MensagemConversa,
  enviarMensagemConversa,
  obterConversa,
} from '../lib/ia-client'
import {
  IconeEnviar,
  IconeFaisca,
  IconeParar,
  IconeVoltar,
} from '../components/icones'

export default function IaChat() {
  const { id } = useParams<{ id: string }>()

  const [carregando, setCarregando] = useState(true)
  const [conversa, setConversa] = useState<ConversaResumo | null>(null)
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([])

  const [textoInput, setTextoInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [streamResposta, setStreamResposta] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const fimMensagensRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    async function carregar() {
      setCarregando(true)
      const dados = await obterConversa(id!)
      if (dados) {
        setConversa(dados.conversa)
        setMensagens(dados.mensagens)
      }
      setCarregando(false)
    }
    void carregar()
  }, [id])

  useEffect(() => {
    fimMensagensRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, streamResposta])

  function pararResposta() {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setEnviando(false)
    setStreamResposta('')
    setErro('Resposta cancelada. Nenhuma alteração foi salva.')
  }

  async function handleEnviar(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!id || !textoInput.trim() || enviando) return

    const pergunta = textoInput.trim()
    setErro(null)
    setEnviando(true)
    setStreamResposta('')

    const ac = new AbortController()
    abortControllerRef.current = ac

    // Mensagem temporária para exibição imediata
    const msgTempUser: MensagemConversa = {
      id: `temp-${Date.now()}`,
      papel: 'user',
      conteudo: pergunta,
      criadoEm: new Date().toISOString(),
    }

    setMensagens((prev) => [...prev, msgTempUser])
    setTextoInput('')

    await enviarMensagemConversa({
      conversaId: id,
      conteudo: pergunta,
      signal: ac.signal,
      onToken: (token) => {
        setStreamResposta((prev) => prev + token)
      },
      onFim: (dados) => {
        setEnviando(false)
        setStreamResposta('')
        // Adiciona a resposta finalizada oficial
        const msgOficialIa: MensagemConversa = {
          id: dados.idResposta,
          papel: 'assistant',
          conteudo: dados.resposta,
          criadoEm: new Date().toISOString(),
        }
        setMensagens((prev) => [...prev, msgOficialIa])
      },
      onErro: (err) => {
        setEnviando(false)
        setStreamResposta('')
        setErro(err)
        // Se falhou, remove a mensagem temporária do usuário para não parecer que gravou,
        // e preserva a pergunta na caixa de texto para reenvio
        setMensagens((prev) => prev.filter((m) => m.id !== msgTempUser.id))
        setTextoInput(pergunta)
      },
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleEnviar()
    }
  }

  return (
    <div className="ia-chat-container">
      <header className="ia-chat-topo">
        <Link to="/perfil/conversas" className="linkish btn-voltar-chat" title="Voltar às conversas">
          <IconeVoltar size={20} />
        </Link>
        <div className="ia-chat-info">
          <h1 className="ia-chat-titulo">{conversa?.titulo ?? 'Conversa Bíblica'}</h1>
          {conversa?.pericopeOrdem && (
            <Link to={`/leitura/${conversa.pericopeOrdem}`} className="ia-chat-link-leitura">
              Ver perícope na leitura
            </Link>
          )}
        </div>
      </header>

      <main className="ia-chat-mensagens">
        {carregando ? (
          <p className="muted ia-chat-status-carregando">Carregando conversa...</p>
        ) : mensagens.length === 0 && !streamResposta ? (
          <div className="ia-chat-vazio">
            <IconeFaisca size={32} />
            <p>Faça sua pergunta sobre o texto bíblico.</p>
            <span className="muted">
              Você pode perguntar sobre o significado de palavras, contexto histórico ou aplicações.
            </span>
          </div>
        ) : (
          mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`ia-chat-bolha ${msg.papel === 'user' ? 'usuario' : 'assistente'}`}
            >
              {msg.papel === 'assistant' && (
                <span className="ia-chat-bolha-avatar" aria-hidden="true">
                  <IconeFaisca size={15} />
                </span>
              )}
              <div className="ia-chat-bolha-corpo">
                {msg.conteudo.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ))
        )}

        {enviando && streamResposta && (
          <div className="ia-chat-bolha assistente stream-ativo">
            <span className="ia-chat-bolha-avatar" aria-hidden="true">
              <IconeFaisca size={15} />
            </span>
            <div className="ia-chat-bolha-corpo">
              {streamResposta.split('\n\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <span className="ia-cursor-pulsante" aria-hidden="true" />
            </div>
          </div>
        )}

        {enviando && !streamResposta && (
          <div className="ia-chat-digitando muted">
            <span>A IA está pensando...</span>
          </div>
        )}

        {erro && (
          <div className="ia-erro-box ia-chat-erro" role="alert">
            <p>{erro}</p>
          </div>
        )}

        <div ref={fimMensagensRef} />
      </main>

      <footer className="ia-chat-composer">
        <form className="ia-chat-form" onSubmit={(e) => void handleEnviar(e)}>
          <textarea
            ref={textareaRef}
            className="ia-chat-textarea"
            value={textoInput}
            onChange={(e) => setTextoInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça sua pergunta sobre a Bíblia..."
            rows={1}
            disabled={enviando}
          />
          {enviando ? (
            <button
              type="button"
              className="ghost btn-parar-chat"
              onClick={pararResposta}
              title="Parar resposta"
            >
              <IconeParar size={18} />
            </button>
          ) : (
            <button
              type="submit"
              className="cta btn-enviar-chat"
              disabled={!textoInput.trim()}
              title="Enviar mensagem"
            >
              <IconeEnviar size={18} />
            </button>
          )}
        </form>
      </footer>
    </div>
  )
}
