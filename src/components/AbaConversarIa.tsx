import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Pericope } from '../lib/types'
import {
  type ChipsContexto,
  montarMaterialApoio,
  montarPromptPericope,
  promptConversa,
} from '../lib/contexto-ia'
import { criarConversa, enviarMensagemConversa } from '../lib/ia-client'
import {
  IconeCadeado,
  IconeChat,
  IconeCheck,
  IconeChave,
  IconeCopiar,
  IconeEntrar,
  IconeEnviar,
  IconeFaisca,
} from './icones'

type Props = {
  pericope: Pericope
  logado: boolean
  temChaveIa: boolean
}

export default function AbaConversarIa({ pericope, logado, temChaveIa }: Props) {
  const navigate = useNavigate()

  // Estado clássico para deslogado ou sem chave
  const [copiado, setCopiado] = useState(false)

  // Chips do compositor para quem tem chave (todos marcados por padrão)
  const [chips, setChips] = useState<ChipsContexto>({
    contexto: true,
    texto: true, // fixo / obrigatório
    resenha: true,
    reflexoes: true,
  })

  const [textoPrompt, setTextoPrompt] = useState(() => montarPromptPericope(pericope, chips))
  const [editadoManual, setEditadoManual] = useState(false)
  const [iniciandoChat, setIniciandoChat] = useState(false)

  // Quando muda a perícope, reinicia o prompt
  useEffect(() => {
    setTextoPrompt(montarPromptPericope(pericope, chips))
    setEditadoManual(false)
  }, [pericope.ordem])

  async function copiarTextoClassico() {
    await navigator.clipboard.writeText(promptConversa(pericope))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function alternarChip(chave: keyof ChipsContexto) {
    if (chave === 'texto') return // Texto bíblico bloqueado

    if (editadoManual) {
      const ok = confirm(
        'Alterar as seções vai refazer o texto do prompt e descartar suas edições manuais. Deseja continuar?',
      )
      if (!ok) return
    }

    const novos = { ...chips, [chave]: !chips[chave] }
    setChips(novos)
    setEditadoManual(false)
    setTextoPrompt(montarPromptPericope(pericope, novos))
  }

  async function handleIniciarConversa(e: React.FormEvent) {
    e.preventDefault()
    if (!textoPrompt.trim() || iniciandoChat) return

    setIniciandoChat(true)
    try {
      const materialApoio = montarMaterialApoio(pericope, chips)
      const flags = Object.entries(chips)
        .filter(([, v]) => v)
        .map(([k]) => k)

      const conv = await criarConversa({
        titulo: `Conversa sobre ${pericope.titulo_pericope_pt}`,
        escopo: 'pericope',
        contextoFlags: flags,
        pericopeOrdem: pericope.ordem,
        livro: pericope.livro,
        capituloInicio: pericope.capitulo_inicio,
        versiculoInicio: pericope.versiculo_inicio,
        capituloFim: pericope.capitulo_fim,
        versiculoFim: pericope.versiculo_fim,
      })

      if (conv) {
        // Envia a primeira mensagem com o texto e o material de apoio
        void enviarMensagemConversa({
          conversaId: conv.id,
          conteudo: textoPrompt.trim(),
          contextoApoio: materialApoio,
          onToken: () => {},
          onFim: () => {},
          onErro: () => {},
        })
        navigate(`/ia/conversa/${conv.id}`)
      }
    } finally {
      setIniciandoChat(false)
    }
  }

  // 1. Deslogado
  if (!logado) {
    return (
      <div className="conversar-bloco">
        <p className="muted">
          Leve este trecho para uma conversa com IA: o texto abaixo já vem pronto para colar.
        </p>
        <pre className="contexto-ia-text">{promptConversa(pericope)}</pre>
        <div className="conversar-acoes-linha">
          <button type="button" className="ghost copy-btn" onClick={() => void copiarTextoClassico()}>
            {copiado ? <IconeCheck size={16} /> : <IconeCopiar size={16} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <Link to="/entrar" className="ghost btn-entrar-aba">
            <IconeEntrar size={16} /> Entrar para conversar no app
          </Link>
        </div>
      </div>
    )
  }

  // 2. Logado sem chave de IA
  if (!temChaveIa) {
    return (
      <div className="conversar-bloco">
        <div className="ia-banner-convite">
          <div className="ia-banner-info">
            <strong>
              <IconeFaisca size={16} /> Converse sobre esta perícope com IA
            </strong>
            <p className="muted">
              Configure sua própria chave de IA (OpenAI, Anthropic, Gemini, OpenRouter ou Cloudflare)
              para tirar dúvidas e conversar livremente dentro do aplicativo.
            </p>
          </div>
          <Link to="/perfil/ia" className="cta btn-configurar-chave-banner">
            <IconeChave size={16} /> Adicionar chave de IA
          </Link>
        </div>

        <p className="muted">Ou copie o texto padrão para utilizar no seu chatbot de preferência:</p>
        <pre className="contexto-ia-text">{promptConversa(pericope)}</pre>
        <button type="button" className="ghost copy-btn" onClick={() => void copiarTextoClassico()}>
          {copiado ? <IconeCheck size={16} /> : <IconeCopiar size={16} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    )
  }

  // 3. Logado COM chave de IA: Compositor rico com os 4 chips
  return (
    <div className="conversar-bloco conversar-com-ia">
      <div className="ia-compositor-cabecalho">
        <strong>
          <IconeChat size={16} /> Conversar sobre esta perícope
        </strong>
        <p className="muted">
          Selecione quais materiais incluir e personalize sua pergunta antes de enviar:
        </p>
      </div>

      <div className="ia-chips-seletor" role="group" aria-label="Materiais da perícope incluídos">
        <button
          type="button"
          className={`ia-chip-btn ${chips.contexto ? 'ativo' : ''}`}
          onClick={() => alternarChip('contexto')}
          aria-pressed={chips.contexto}
        >
          Contexto
        </button>

        <button
          type="button"
          className="ia-chip-btn ativo bloqueado"
          aria-pressed="true"
          disabled
          title="O texto bíblico é obrigatório na conversa"
        >
          <IconeCadeado size={12} /> Texto Bíblico
        </button>

        <button
          type="button"
          className={`ia-chip-btn ${chips.resenha ? 'ativo' : ''}`}
          onClick={() => alternarChip('resenha')}
          aria-pressed={chips.resenha}
        >
          Resenha
        </button>

        <button
          type="button"
          className={`ia-chip-btn ${chips.reflexoes ? 'ativo' : ''}`}
          onClick={() => alternarChip('reflexoes')}
          aria-pressed={chips.reflexoes}
        >
          Reflexões
        </button>
      </div>

      <form className="ia-compositor-form" onSubmit={(e) => void handleIniciarConversa(e)}>
        <textarea
          className="ia-compositor-textarea"
          value={textoPrompt}
          onChange={(e) => {
            setTextoPrompt(e.target.value)
            setEditadoManual(true)
          }}
          rows={3}
          placeholder="Digite sua pergunta ou edite o prompt inicial..."
          disabled={iniciandoChat}
        />

        <div className="ia-compositor-rodape">
          <button type="submit" className="cta btn-iniciar-chat" disabled={iniciandoChat}>
            <IconeEnviar size={16} />
            {iniciandoChat ? 'Iniciando conversa...' : 'Conversar com IA'}
          </button>
        </div>
      </form>
    </div>
  )
}
