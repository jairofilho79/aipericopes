/**
 * Adapters de geração e streaming para os provedores suportados no BYOK:
 * - OpenAI (Chat Completions)
 * - OpenRouter (compatível com OpenAI)
 * - Cloudflare Workers AI REST (compatível com OpenAI)
 * - Anthropic (Messages API)
 * - Google Gemini (generateContent SSE)
 *
 * Implementa retentativas transparentes para erros transitórios (até 3 tentativas)
 * e classificação estrita para erros de quota, chave inválida e contexto excedido.
 */

import type { ProvedorId } from './ia-provedores'

export type MensagemIa = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class ErroIa extends Error {
  constructor(
    public tipo: 'quota' | 'autenticacao' | 'contexto' | 'temporario' | 'desconhecido',
    public mensagemAmigavel: string,
    public detalheOriginal?: string,
  ) {
    super(mensagemAmigavel)
    this.name = 'ErroIa'
  }
}

export type ChamadaIaParams = {
  provedor: ProvedorId
  modelo: string
  chave: string
  contaId?: string | null
  mensagens: MensagemIa[]
  signal?: AbortSignal
  fetchFn?: typeof fetch
}

/** Classifica erro HTTP e corpo para identificar quota esgotada ou erros permanentes vs transitórios. */
export function classificarErroHttp(status: number, corpoTexto: string): ErroIa {
  const corpoLower = corpoTexto.toLowerCase()

  // Erros de autenticação / chave
  if (status === 401 || status === 403) {
    return new ErroIa(
      'autenticacao',
      'Chave de IA recusada pelo provedor. Verifique sua chave nas configurações.',
      corpoTexto,
    )
  }

  // Quota esgotada ou saldo insuficiente
  if (
    status === 402 ||
    (status === 429 &&
      (corpoLower.includes('quota') ||
        corpoLower.includes('insufficient') ||
        corpoLower.includes('credit') ||
        corpoLower.includes('billing') ||
        corpoLower.includes('exceeded')))
  ) {
    return new ErroIa(
      'quota',
      'Sua chave atingiu o limite ou saldo disponível no provedor. Revise seu plano no serviço de IA.',
      corpoTexto,
    )
  }

  // Janela de contexto excedida
  if (
    status === 400 &&
    (corpoLower.includes('context_length') ||
      corpoLower.includes('maximum context') ||
      corpoLower.includes('too many tokens') ||
      corpoLower.includes('token count'))
  ) {
    return new ErroIa(
      'contexto',
      'O texto é grande demais para a capacidade deste modelo de IA.',
      corpoTexto,
    )
  }

  // Falhas temporárias (5xx, 429 sem quota, 529 overloaded)
  if (status >= 500 || status === 429 || status === 408) {
    return new ErroIa(
      'temporario',
      'O serviço do provedor de IA está temporariamente indisponível.',
      corpoTexto,
    )
  }

  return new ErroIa(
    'desconhecido',
    'Não foi possível concluir a solicitação com a IA.',
    corpoTexto,
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function prepararRequisicao(
  provedor: ProvedorId,
  modelo: string,
  chave: string,
  contaId: string | null | undefined,
  mensagens: MensagemIa[],
): { url: string; init: RequestInit } {
  switch (provedor) {
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${chave}`,
          },
          body: JSON.stringify({
            model: modelo,
            messages: mensagens,
            stream: true,
          }),
        },
      }

    case 'openrouter':
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${chave}`,
            'HTTP-Referer': 'https://aipericopes.com',
            'X-Title': 'aiPericopes',
          },
          body: JSON.stringify({
            model: modelo,
            messages: mensagens,
            stream: true,
          }),
        },
      }

    case 'cloudflare':
      return {
        url: `https://api.cloudflare.com/client/v4/accounts/${contaId}/ai/v1/chat/completions`,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${chave}`,
          },
          body: JSON.stringify({
            model: modelo,
            messages: mensagens,
            stream: true,
          }),
        },
      }

    case 'anthropic': {
      const systemMsg = mensagens.find((m) => m.role === 'system')?.content
      const normalMsgs = mensagens
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

      return {
        url: 'https://api.anthropic.com/v1/messages',
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': chave,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelo,
            max_tokens: 4096,
            system: systemMsg,
            messages: normalMsgs,
            stream: true,
          }),
        },
      }
    }

    case 'gemini': {
      const systemMsg = mensagens.find((m) => m.role === 'system')?.content
      const contents = mensagens
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }))

      const bodyObj: Record<string, unknown> = { contents }
      if (systemMsg) {
        bodyObj.systemInstruction = { parts: [{ text: systemMsg }] }
      }

      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(chave)}`,
        init: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(bodyObj),
        },
      }
    }
  }
}

/**
 * Lê SSE do leitor e emite os pedaços de texto gerados.
 */
export async function* extrairTokensSse(
  provedor: ProvedorId,
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader()
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
        if (!payload || payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const token = extrairTextoJson(provedor, json)
          if (token) yield token
        } catch {
          // Linha de SSE com formatação não-JSON ou parcial ignorada
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      const payload = buffer.trim().slice(5).trim()
      if (payload && payload !== '[DONE]') {
        try {
          const json = JSON.parse(payload)
          const token = extrairTextoJson(provedor, json)
          if (token) yield token
        } catch {
          // ignora
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function extrairTextoJson(provedor: ProvedorId, json: Record<string, unknown>): string | null {
  if (provedor === 'openai' || provedor === 'openrouter' || provedor === 'cloudflare') {
    const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined
    return choices?.[0]?.delta?.content ?? null
  }

  if (provedor === 'anthropic') {
    if (json.type === 'content_block_delta') {
      const delta = json.delta as { type?: string; text?: string } | undefined
      return delta?.text ?? null
    }
    return null
  }

  if (provedor === 'gemini') {
    const candidates = json.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> }
    }> | undefined
    return candidates?.[0]?.content?.parts?.[0]?.text ?? null
  }

  return null
}

/**
 * Inicia a chamada com retentativa (até 3 tentativas para erros temporários).
 * Uma vez iniciado o streaming, emite os pedaços de texto.
 */
export async function* chamarIaStream(params: ChamadaIaParams): AsyncGenerator<string, void, unknown> {
  const { provedor, modelo, chave, contaId, mensagens, signal, fetchFn = fetch } = params
  const { url, init } = prepararRequisicao(provedor, modelo, chave, contaId, mensagens)

  let ultimaFalha: ErroIa | null = null
  const MAX_TENTATIVAS = 3

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    if (signal?.aborted) {
      throw new ErroIa('temporario', 'Operação cancelada.')
    }

    try {
      const res = await fetchFn(url, { ...init, signal })
      if (!res.ok) {
        const corpoErro = await res.text().catch(() => '')
        const erroClassificado = classificarErroHttp(res.status, corpoErro)

        // Se for quota, autenticação ou contexto, NÃO retenta: erro definitivo!
        if (erroClassificado.tipo !== 'temporario') {
          throw erroClassificado
        }

        ultimaFalha = erroClassificado
        if (tentativa < MAX_TENTATIVAS) {
          await delay(tentativa * 1000)
          continue
        }
        throw erroClassificado
      }

      if (!res.body) {
        throw new ErroIa('temporario', 'Resposta sem corpo de streaming.')
      }

      // Stream conectado com sucesso! Agora emite os tokens.
      for await (const token of extrairTokensSse(provedor, res.body)) {
        if (signal?.aborted) return
        yield token
      }
      return // Sucesso completo!
    } catch (err) {
      if (err instanceof ErroIa) {
        if (err.tipo !== 'temporario') throw err
        ultimaFalha = err
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        ultimaFalha = new ErroIa('temporario', 'Falha temporária de conexão com a IA.', msg)
      }

      if (tentativa < MAX_TENTATIVAS) {
        await delay(tentativa * 1000)
      } else {
        throw ultimaFalha
      }
    }
  }

  throw ultimaFalha ?? new ErroIa('temporario', 'Não foi possível conectar à IA após 3 tentativas.')
}
