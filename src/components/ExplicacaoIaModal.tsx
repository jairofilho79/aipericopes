import { useEffect, useRef, useState } from 'react'
import {
  IconeChat,
  IconeCheck,
  IconeCopiar,
  IconeFaisca,
  IconeFechar,
  IconeParar,
  IconeRecarregar,
} from './icones'
import { solicitarExplicacao, criarConversa } from '../lib/ia-client'
import { useNavigate } from 'react-router-dom'

type Props = {
  aberto: boolean
  onFechar: () => void
  livro: string
  refLabel: string
  pericopeOrdem: number
  capituloInicio: number
  versiculoInicio: number
  capituloFim: number
  versiculoFim: number
  versiculos: string[]
  trechoTexto: string
}

export default function ExplicacaoIaModal({
  aberto,
  onFechar,
  livro,
  refLabel,
  pericopeOrdem,
  capituloInicio,
  versiculoInicio,
  capituloFim,
  versiculoFim,
  versiculos,
  trechoTexto,
}: Props) {
  const navigate = useNavigate()
  const [carregando, setCarregando] = useState(false)
  const [textoStream, setTextoStream] = useState('')
  const [explicacaoId, setExplicacaoId] = useState<string | null>(null)
  const [salvaAnteriormente, setSalvaAnteriormente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [criandoChat, setCriandoChat] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      setTextoStream('')
      setErro(null)
      setExplicacaoId(null)
      setSalvaAnteriormente(false)
      return
    }

    // Inicia a requisição ao abrir
    iniciarExplicacao(false)

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [aberto, pericopeOrdem, versiculos])

  // ESC fecha o modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    if (aberto) {
      document.addEventListener('keydown', onKey)
      dialogRef.current?.focus()
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, onFechar])

  function iniciarExplicacao(gerarNova: boolean) {
    abortControllerRef.current?.abort()
    const ac = new AbortController()
    abortControllerRef.current = ac

    setCarregando(true)
    setErro(null)
    setTextoStream('')
    setExplicacaoId(null)
    setSalvaAnteriormente(false)

    void solicitarExplicacao({
      pericopeOrdem,
      livro,
      capituloInicio,
      versiculoInicio,
      capituloFim,
      versiculoFim,
      versiculos,
      trechoTexto,
      gerarNova,
      signal: ac.signal,
      onToken: (token) => {
        setTextoStream((prev) => prev + token)
      },
      onFim: (dados) => {
        setCarregando(false)
        setTextoStream(dados.resposta)
        setExplicacaoId(dados.id)
        setSalvaAnteriormente(dados.salva)
      },
      onErro: (err) => {
        setCarregando(false)
        setErro(err)
      },
    })
  }

  function pararGeracao() {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setCarregando(false)
    setTextoStream('')
    setErro('Geração interrompida.')
  }

  async function copiarTexto() {
    if (!textoStream) return
    await navigator.clipboard.writeText(textoStream)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function continuarConversa() {
    if (!explicacaoId || criandoChat) return
    setCriandoChat(true)
    try {
      const conversa = await criarConversa({
        escopo: 'selecao',
        explicacaoId,
        pericopeOrdem,
        livro,
        capituloInicio,
        versiculoInicio,
        capituloFim,
        versiculoFim,
      })
      if (conversa) {
        onFechar()
        navigate(`/ia/conversa/${conversa.id}`)
      }
    } catch {
      // noop
    } finally {
      setCriandoChat(false)
    }
  }

  if (!aberto) return null

  return (
    <div className="ia-modal-overlay" onClick={onFechar}>
      <div
        className="ia-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ia-modal-titulo"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="ia-modal-header">
          <div className="ia-modal-header-info">
            <span className="ia-badge">
              <IconeFaisca size={14} /> Explicação com IA
            </span>
            <h2 id="ia-modal-titulo" className="ia-modal-titulo">
              {livro} {refLabel}
            </h2>
          </div>
          <button
            type="button"
            className="ghost btn-fechar-modal"
            onClick={onFechar}
            aria-label="Fechar explicação"
          >
            <IconeFechar size={18} />
          </button>
        </div>

        <div className="ia-modal-corpo">
          {trechoTexto && (
            <div className="ia-passagem-card">
              <div className="ia-passagem-topo">
                <span className="ia-badge">Texto bíblico</span>
                <strong className="ia-passagem-ref">{livro} {refLabel}</strong>
              </div>
              <blockquote className="ia-passagem-texto">
                {trechoTexto}
              </blockquote>
            </div>
          )}

          {carregando && !textoStream && (
            <div className="ia-loading-box">
              <div className="ia-spinner" aria-hidden="true" />
              <p className="muted">Preparando explicação detalhada...</p>
            </div>
          )}

          {salvaAnteriormente && (
            <div className="ia-aviso-salva">
              <span>Esta explicação já estava salva no seu histórico.</span>
              <button
                type="button"
                className="linkish btn-gerar-nova"
                onClick={() => iniciarExplicacao(true)}
              >
                <IconeRecarregar size={14} /> Gerar nova
              </button>
            </div>
          )}

          {erro && (
            <div className="ia-erro-box" role="alert">
              <p>{erro}</p>
              <div className="ia-erro-acoes">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => iniciarExplicacao(true)}
                >
                  <IconeRecarregar size={15} /> Tentar novamente
                </button>
              </div>
            </div>
          )}

          {textoStream && (
            <div className="ia-texto-conteudo">
              <div className="ia-markdown-corpo">
                {formatarMarkdownSimples(textoStream)}
              </div>
            </div>
          )}
        </div>

        <div className="ia-modal-footer">
          {carregando ? (
            <button type="button" className="ghost btn-parar" onClick={pararGeracao}>
              <IconeParar size={16} /> Parar
            </button>
          ) : (
            <>
              {textoStream && (
                <div className="ia-modal-footer-acoes">
                  <button
                    type="button"
                    className="cta btn-continuar-chat"
                    onClick={() => void continuarConversa()}
                    disabled={criandoChat || !explicacaoId}
                  >
                    <IconeChat size={17} />
                    {criandoChat ? 'Abrindo conversa...' : 'Continuar conversa'}
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void copiarTexto()}
                    title="Copiar texto"
                  >
                    {copiado ? <IconeCheck size={16} /> : <IconeCopiar size={16} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Formata markdown com títulos h3 e quebras de parágrafo preservando segurança sem HTML raw. */
function formatarMarkdownSimples(md: string) {
  const blocos = md.split(/(###\s+[^\n]+)/g)

  return blocos.map((bloco, idx) => {
    const limpo = bloco.trim()
    if (!limpo) return null

    if (limpo.startsWith('### ')) {
      const titulo = limpo.replace(/^###\s+/, '')
      return (
        <h3 key={idx} className="ia-secao-titulo">
          {titulo}
        </h3>
      )
    }

    const paragrafos = limpo.split(/\n\s*\n/)
    return (
      <div key={idx} className="ia-secao-texto">
        {paragrafos.map((p, pIdx) => (
          <p key={pIdx}>{formatarNegritos(p.trim())}</p>
        ))}
      </div>
    )
  })
}

function formatarNegritos(texto: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>
    }
    return parte
  })
}
