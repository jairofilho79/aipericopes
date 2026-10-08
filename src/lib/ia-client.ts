/**
 * Cliente HTTP e SSE para a funcionalidade de BYOK de IA no frontend.
 */

export type ChaveIaPublica = {
  provedor: 'openai' | 'openrouter' | 'anthropic' | 'gemini' | 'cloudflare'
  modelo: string
  contaId: string | null
  ultimos4: string
  status: 'ativa' | 'sem_credito' | 'invalida'
  validadaEm: string
}

export type ExplicacaoSalva = {
  id: string
  pericopeOrdem: number
  livro: string
  capituloInicio: number
  versiculoInicio: number
  capituloFim: number
  versiculoFim: number
  versiculos: string[]
  trechoTexto: string
  prompt?: string
  resposta: string
  provedor: string
  modelo: string
  criadoEm: string
}

export type ConversaResumo = {
  id: string
  titulo: string
  escopo: 'selecao' | 'pericope' | 'avulsa'
  explicacaoId: string | null
  pericopeOrdem: number | null
  livro: string | null
  capituloInicio: number | null
  versiculoInicio: number | null
  capituloFim: number | null
  versiculoFim: number | null
  trechoTexto?: string | null
  criadoEm: string
  atualizadoEm: string
}

export type MensagemConversa = {
  id: string
  papel: 'user' | 'assistant'
  conteudo: string
  criadoEm: string
}

export async function obterChaveIa(): Promise<ChaveIaPublica | null> {
  const res = await fetch('/api/ia/chave')
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { chave?: ChaveIaPublica | null } | null
  return json?.chave ?? null
}

export async function salvarChaveIa(params: {
  provedor: string
  modelo?: string
  chave: string
  contaId?: string
}): Promise<{ ok: boolean; chave?: ChaveIaPublica; erro?: string }> {
  const res = await fetch('/api/ia/chave', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  })

  const json = (await res.json().catch(() => null)) as {
    chave?: ChaveIaPublica
    erro?: string
  } | null

  if (!res.ok) {
    return { ok: false, erro: json?.erro ?? 'Não foi possível validar a chave' }
  }

  return { ok: true, chave: json?.chave }
}

export async function removerChaveIa(): Promise<boolean> {
  const res = await fetch('/api/ia/chave', { method: 'DELETE' })
  return res.ok
}

export async function listarExplicacoes(): Promise<ExplicacaoSalva[]> {
  const res = await fetch('/api/ia/explicacoes')
  if (!res.ok) return []
  const json = (await res.json().catch(() => null)) as { explicacoes?: ExplicacaoSalva[] } | null
  return json?.explicacoes ?? []
}

export async function obterExplicacao(id: string): Promise<ExplicacaoSalva | null> {
  const res = await fetch(`/api/ia/explicacoes/${encodeURIComponent(id)}`)
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { explicacao?: ExplicacaoSalva } | null
  return json?.explicacao ?? null
}

export async function apagarExplicacao(id: string): Promise<boolean> {
  const res = await fetch(`/api/ia/explicacoes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return res.ok
}

export async function criarConversa(params: {
  titulo?: string
  escopo: 'selecao' | 'pericope' | 'avulsa'
  explicacaoId?: string
  contextoFlags?: string[]
  pericopeOrdem?: number
  livro?: string
  capituloInicio?: number
  versiculoInicio?: number
  capituloFim?: number
  versiculoFim?: number
}): Promise<ConversaResumo | null> {
  const res = await fetch('/api/ia/conversas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { conversa?: ConversaResumo } | null
  return json?.conversa ?? null
}

export async function listarConversas(): Promise<ConversaResumo[]> {
  const res = await fetch('/api/ia/conversas')
  if (!res.ok) return []
  const json = (await res.json().catch(() => null)) as { conversas?: ConversaResumo[] } | null
  return json?.conversas ?? []
}

export async function obterConversa(
  id: string,
): Promise<{ conversa: ConversaResumo; mensagens: MensagemConversa[] } | null> {
  const res = await fetch(`/api/ia/conversas/${encodeURIComponent(id)}`)
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as {
    conversa?: ConversaResumo
    mensagens?: MensagemConversa[]
  } | null
  if (!json?.conversa) return null
  return { conversa: json.conversa, mensagens: json.mensagens ?? [] }
}

export async function apagarConversa(id: string): Promise<boolean> {
  const res = await fetch(`/api/ia/conversas/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return res.ok
}

/** Consome stream SSE da explicação rápida ou retorna a explicação salva */
export async function solicitarExplicacao(params: {
  pericopeOrdem: number
  livro: string
  capituloInicio: number
  versiculoInicio: number
  capituloFim: number
  versiculoFim: number
  versiculos: string[]
  trechoTexto: string
  gerarNova?: boolean
  onToken: (token: string) => void
  onFim: (dados: { id: string; resposta: string; salva: boolean }) => void
  onErro: (erro: string) => void
  signal?: AbortSignal
}): Promise<void> {
  try {
    const res = await fetch('/api/ia/explicar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pericopeOrdem: params.pericopeOrdem,
        livro: params.livro,
        capituloInicio: params.capituloInicio,
        versiculoInicio: params.versiculoInicio,
        capituloFim: params.capituloFim,
        versiculoFim: params.versiculoFim,
        versiculos: params.versiculos,
        trechoTexto: params.trechoTexto,
        gerarNova: params.gerarNova,
      }),
      signal: params.signal,
    })

    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { erro?: string } | null
      params.onErro(json?.erro ?? 'Não foi possível gerar a explicação agora.')
      return
    }

    const contentType = res.headers.get('content-type') ?? ''

    // Se já tinha salva, devolve JSON direto
    if (contentType.includes('application/json')) {
      const json = (await res.json().catch(() => null)) as {
        salva?: boolean
        explicacao?: ExplicacaoSalva
      } | null
      if (json?.explicacao) {
        params.onFim({
          id: json.explicacao.id,
          resposta: json.explicacao.resposta,
          salva: true,
        })
      } else {
        params.onErro('Resposta inválida do servidor.')
      }
      return
    }

    // Se é SSE
    if (!res.body) {
      params.onErro('Sem conexão com o fluxo de resposta.')
      return
    }

    await lerStreamSse(res.body, params.onToken, params.onFim, params.onErro)
  } catch (err) {
    if (params.signal?.aborted) return
    const msg = err instanceof Error ? err.message : String(err)
    params.onErro(msg || 'Falha na conexão.')
  }
}

/** Consome stream SSE para nova mensagem no chat */
export async function enviarMensagemConversa(params: {
  conversaId: string
  conteudo: string
  contextoApoio?: string
  onToken: (token: string) => void
  onFim: (dados: { idResposta: string; resposta: string }) => void
  onErro: (erro: string) => void
  signal?: AbortSignal
}): Promise<void> {
  try {
    const res = await fetch(`/api/ia/conversas/${encodeURIComponent(params.conversaId)}/mensagens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conteudo: params.conteudo,
        contextoApoio: params.contextoApoio,
      }),
      signal: params.signal,
    })

    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { erro?: string } | null
      params.onErro(json?.erro ?? 'Não foi possível enviar a mensagem.')
      return
    }

    if (!res.body) {
      params.onErro('Sem conexão com o fluxo de resposta.')
      return
    }

    await lerStreamSse(
      res.body,
      params.onToken,
      (dados) => {
        params.onFim({
          idResposta: dados.id,
          resposta: dados.resposta,
        })
      },
      params.onErro,
    )
  } catch (err) {
    if (params.signal?.aborted) return
    const msg = err instanceof Error ? err.message : String(err)
    params.onErro(msg || 'Falha na conexão.')
  }
}

async function lerStreamSse(
  body: ReadableStream<Uint8Array>,
  onToken: (token: string) => void,
  onFim: (dados: { id: string; resposta: string; salva: boolean }) => void,
  onErro: (erro: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const linhas = buffer.split('\n')
      buffer = linhas.pop() ?? ''

      for (const linha of linhas) {
        const l = linha.trim()
        if (!l.startsWith('data:')) continue
        const payload = l.slice(5).trim()
        if (!payload) continue

        try {
          const evento = JSON.parse(payload) as
            | { tipo: 'token'; conteudo: string }
            | { tipo: 'fim'; id: string; resposta: string }
            | { tipo: 'erro'; mensagem: string }

          if (evento.tipo === 'token') {
            onToken(evento.conteudo)
          } else if (evento.tipo === 'fim') {
            onFim({ id: evento.id, resposta: evento.resposta, salva: false })
          } else if (evento.tipo === 'erro') {
            onErro(evento.mensagem)
          }
        } catch {
          // ignora fragmento
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
