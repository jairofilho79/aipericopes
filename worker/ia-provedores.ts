/**
 * Provedores de IA do BYOK. Cada um sabe validar uma chave com uma chamada
 * barata (listagem de modelos, sem custo) e traduzir o resultado em um estado
 * que a API entende. A geração de texto entra na Fase 2, no mesmo módulo.
 */

export type ProvedorId = 'openai' | 'openrouter' | 'anthropic' | 'gemini' | 'cloudflare'

export type ProvedorInfo = {
  id: ProvedorId
  nome: string
  modeloPadrao: string
  /** Prefixo/forma mínima esperada — só barra erro de digitação, não prova nada. */
  formatoChave: RegExp
  /** Provedor que, além da chave, exige o ID da conta (Cloudflare). */
  precisaConta?: boolean
}

export const PROVEDORES: Record<ProvedorId, ProvedorInfo> = {
  openai: { id: 'openai', nome: 'OpenAI', modeloPadrao: 'gpt-4o-mini', formatoChave: /^sk-[\w-]{20,}$/ },
  openrouter: {
    id: 'openrouter',
    nome: 'OpenRouter',
    modeloPadrao: 'google/gemini-2.5-flash',
    formatoChave: /^sk-or-[\w-]{20,}$/,
  },
  anthropic: {
    id: 'anthropic',
    nome: 'Anthropic (Claude)',
    modeloPadrao: 'claude-haiku-4-5',
    formatoChave: /^sk-ant-[\w-]{20,}$/,
  },
  gemini: { id: 'gemini', nome: 'Google Gemini', modeloPadrao: 'gemini-2.5-flash', formatoChave: /^[\w-]{30,}$/ },
  // Workers AI da conta do PRÓPRIO usuário (REST), não o binding `AI` do app.
  cloudflare: {
    id: 'cloudflare',
    nome: 'Cloudflare (Workers AI)',
    modeloPadrao: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    formatoChave: /^[\w-]{30,}$/,
    precisaConta: true,
  },
}

/** Account ID da Cloudflare: 32 caracteres hexadecimais. */
export const FORMATO_CONTA_CLOUDFLARE = /^[0-9a-f]{32}$/

export const MAX_TAM_CHAVE = 300
export const MAX_TAM_MODELO = 100

export function ehProvedor(v: unknown): v is ProvedorId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PROVEDORES, v)
}

export type PedidoChave = { provedor: ProvedorId; modelo: string; chave: string; contaId: string | null }

/** Corpo do PUT /api/ia/chave → pedido normalizado, ou null se inválido. */
export function parsePedidoChave(corpo: unknown): PedidoChave | null {
  const c = corpo as { provedor?: unknown; modelo?: unknown; chave?: unknown; contaId?: unknown } | null
  if (!c || !ehProvedor(c.provedor) || typeof c.chave !== 'string') return null
  const chave = c.chave.trim()
  if (!chave || chave.length > MAX_TAM_CHAVE || /\s/.test(chave)) return null
  if (!PROVEDORES[c.provedor].formatoChave.test(chave)) return null
  let modelo = typeof c.modelo === 'string' ? c.modelo.trim() : ''
  if (!modelo) modelo = PROVEDORES[c.provedor].modeloPadrao
  // `@` por causa dos IDs da Cloudflare (`@cf/meta/...`).
  if (modelo.length > MAX_TAM_MODELO || !/^[\w@./:-]+$/.test(modelo)) return null
  let contaId: string | null = null
  if (PROVEDORES[c.provedor].precisaConta) {
    contaId = typeof c.contaId === 'string' ? c.contaId.trim().toLowerCase() : ''
    if (!FORMATO_CONTA_CLOUDFLARE.test(contaId)) return null
  }
  return { provedor: c.provedor, modelo, chave, contaId }
}

export type ResultadoValidacao = 'ok' | 'invalida' | 'sem_credito' | 'indisponivel'

/** HTTP da chamada de teste → estado da chave. Pura, para testar sem rede. */
export function classificarStatus(status: number): ResultadoValidacao {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 403 || status === 400) return 'invalida'
  if (status === 402) return 'sem_credito'
  return 'indisponivel'
}

function pedidoValidacao(
  p: ProvedorId,
  chave: string,
  contaId: string | null,
): { url: string; init: RequestInit } {
  switch (p) {
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/models',
        init: { headers: { authorization: `Bearer ${chave}` } },
      }
    case 'openrouter':
      // /models é público; /key exige a chave e por isso valida de verdade.
      return {
        url: 'https://openrouter.ai/api/v1/key',
        init: { headers: { authorization: `Bearer ${chave}` } },
      }
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/models',
        init: { headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01' } },
      }
    case 'gemini':
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
        init: { headers: { 'x-goog-api-key': chave } },
      }
    case 'cloudflare':
      // Exige token com permissão de Workers AI E a conta certa: valida os dois.
      return {
        url: `https://api.cloudflare.com/client/v4/accounts/${contaId}/ai/models/search?per_page=1`,
        init: { headers: { authorization: `Bearer ${chave}` } },
      }
  }
}

/** Chamada de teste barata (sem gerar texto, sem custo). Nunca lança. */
export async function validarChave(
  p: ProvedorId,
  chave: string,
  contaId: string | null = null,
  fetchFn: typeof fetch = fetch,
): Promise<ResultadoValidacao> {
  const { url, init } = pedidoValidacao(p, chave, contaId)
  try {
    const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(8000) })
    return classificarStatus(res.status)
  } catch {
    return 'indisponivel'
  }
}
