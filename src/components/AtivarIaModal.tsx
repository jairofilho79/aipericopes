import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { IconeChave, IconeEntrar, IconeFaisca, IconeFechar } from './icones'

type Props = {
  aberto: boolean
  logado: boolean
  onFechar: () => void
}

export default function AtivarIaModal({ aberto, logado, onFechar }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

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

  if (!aberto) return null

  return (
    <div className="ia-modal-overlay" onClick={onFechar}>
      <div
        className="ia-modal-sheet ia-modal-pequeno"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ia-ativar-titulo"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="ia-modal-header">
          <div className="ia-modal-header-info">
            <span className="ia-badge">
              <IconeFaisca size={14} /> Inteligência Artificial
            </span>
            <h2 id="ia-ativar-titulo" className="ia-modal-titulo">
              {logado ? 'Adicione sua chave de IA' : 'Entre para usar com IA'}
            </h2>
          </div>
          <button
            type="button"
            className="ghost btn-fechar-modal"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <IconeFechar size={18} />
          </button>
        </div>

        <div className="ia-modal-corpo">
          {logado ? (
            <div className="ia-ativar-info">
              <p>
                Com o <strong>BYOK (Traga sua própria chave)</strong>, você tem acesso a explicações
                detalhadas dos versículos e pode conversar tirando dúvidas a qualquer momento.
              </p>
              <p className="muted">
                Suportamos <strong>OpenAI</strong>, <strong>Anthropic (Claude)</strong>,{' '}
                <strong>Google Gemini</strong>, <strong>OpenRouter</strong> e{' '}
                <strong>Cloudflare Workers AI</strong>. Sua chave é guardada de forma criptografada
                no servidor.
              </p>
              <div className="ia-ativar-botoes">
                <Link to="/perfil/ia" className="cta" onClick={onFechar}>
                  <IconeChave size={18} />
                  Configurar chave de IA
                </Link>
              </div>
            </div>
          ) : (
            <div className="ia-ativar-info">
              <p>
                Faça login para salvar suas anotações, histórico de leitura e configurar sua chave de
                IA para desbloquear explicações instantâneas e chats bíblicos.
              </p>
              <div className="ia-ativar-botoes">
                <Link to="/entrar" className="cta" onClick={onFechar}>
                  <IconeEntrar size={18} />
                  Entrar na conta
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
