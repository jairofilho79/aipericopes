/**
 * Lógica pura da revisão do ditado (POST /api/revisar-ditado): o texto que o
 * reconhecimento nativo do aparelho despejou sem pontuação passa por um
 * modelo de linguagem pequeno que só pontua, capitaliza e corrige erros
 * óbvios de reconhecimento. Limites, cotas, prompt e a limpeza da resposta
 * vivem aqui; o handler em index.ts só orquestra HTTP + D1 + AI.
 */

/**
 * Teto de um pedido. Uma anotação ditada tem algumas centenas de caracteres;
 * 6000 (~1500 tokens de entrada, outro tanto de saída) cobre um sermão
 * inteiro e barra abuso barato.
 */
export const MAX_CARACTERES = 6000

/** Cota por usuário e por dia (UTC): 30 mil caracteres é anotar o dia todo. */
export const COTA_USUARIO_CARACTERES = 30_000

/**
 * Teto global por dia (UTC), somando todos os usuários. 300 mil caracteres de
 * entrada geram na ordem de 100 mil tokens de saída, ≈ 3,5k neurons neste
 * modelo; somado aos 180 minutos do whisper (transcrever.ts) fica abaixo dos
 * 10k neurons/dia do free tier do Workers AI — a rota NUNCA vira fatura.
 * Acima disto responde 503 e volta à meia-noite UTC.
 */
export const TETO_GLOBAL_CARACTERES = 300_000

export const MODELO = '@cf/meta/llama-3.1-8b-instruct-fast'

/**
 * Corpo do pedido → texto trimado, ou null se não for `{ texto: string }`
 * com conteúdo e dentro do teto. O teto é medido no texto trimado: espaço
 * em volta não custa token.
 */
export function parseTexto(corpo: unknown): string | null {
  const t = (corpo as { texto?: unknown } | null)?.texto
  if (typeof t !== 'string') return null
  const texto = t.trim()
  if (!texto || texto.length > MAX_CARACTERES) return null
  return texto
}

export const PROMPT = [
  'Você revisa transcrições de ditado em português do Brasil de anotações de estudo bíblico.',
  'Devolva o MESMO texto, apenas com a pontuação (vírgulas, pontos, interrogação) e as',
  'maiúsculas corretas — inclusive em Deus, Jesus, Senhor, Espírito Santo, Bíblia e nomes bíblicos.',
  'Corrija APENAS palavras claramente mal reconhecidas pelo ditado (por exemplo "cê" no lugar de',
  '"se", "agente" no lugar de "a gente").',
  'Não reescreva, não resuma, não acrescente nem remova ideias, não traduza, não comente,',
  'não use markdown. Responda somente com o texto revisado.',
].join(' ')

export type Mensagem = { role: 'system' | 'user'; content: string }

export function montarMensagens(texto: string): Mensagem[] {
  return [
    { role: 'system', content: PROMPT },
    { role: 'user', content: texto },
  ]
}

/**
 * Input do modelo. `max_tokens` cresce com o texto: em português um token
 * cobre ~3–4 caracteres, então metade do comprimento já é folga de sobra
 * para a saída (que é o mesmo texto com sinais a mais); o +64 cobre textos
 * curtíssimos. Temperatura zero — revisão não quer criatividade.
 */
export function montarInput(texto: string): {
  messages: Mensagem[]
  max_tokens: number
  temperature: 0
} {
  return {
    messages: montarMensagens(texto),
    max_tokens: Math.min(2048, Math.ceil(texto.length / 2) + 64),
    temperature: 0,
  }
}

/** Fora desta faixa (em relação ao original) o modelo reescreveu ou resumiu. */
const FATOR_MIN = 0.6
const FATOR_MAX = 1.6

// Prefixos que modelos instruídos adoram pôr antes da resposta, apesar do prompt.
const PREFIXO = /^(?:texto\s+revisado|revis[ãa]o|resposta|aqui\s+est[áa](?:\s+o\s+texto(?:\s+revisado)?)?)\s*:\s*/i
// Aspas/crases envolvendo a resposta inteira.
const ENVOLTORIO = /^(?:```[a-z]*\n?|["“”'`«])([\s\S]*?)(?:\n?```|["“”'`»])$/

/**
 * Resposta do Workers AI → texto revisado, ou null quando não presta: sem
 * `response` string, vazia depois da limpeza, ou de tamanho fora de
 * 0,6×–1,6× do original — sinal de que o modelo reescreveu/resumiu, e aí o
 * cliente fica melhor com o texto que já tem.
 */
export function limparSaida(saida: unknown, original: string): string | null {
  const r = (saida as { response?: unknown } | null)?.response
  if (typeof r !== 'string') return null
  let texto = r.trim()
  texto = texto.replace(PREFIXO, '')
  const m = ENVOLTORIO.exec(texto)
  if (m) texto = m[1].trim()
  if (!texto) return null
  const fator = texto.length / original.length
  if (fator < FATOR_MIN || fator > FATOR_MAX) return null
  return texto
}

export type DecisaoCota = 'ok' | 'usuario' | 'global'

/**
 * Decide se o pedido cabe nas cotas do dia. As duas são inclusivas: o pedido
 * que fecha exatamente o teto ainda passa. Quando as duas estouram, a do
 * usuário prevalece — é a mensagem útil para quem está do outro lado.
 */
export function decidirCota(args: {
  usoUsuario: number
  usoGlobal: number
  caracteres: number
}): DecisaoCota {
  if (args.usoUsuario + args.caracteres > COTA_USUARIO_CARACTERES) return 'usuario'
  if (args.usoGlobal + args.caracteres > TETO_GLOBAL_CARACTERES) return 'global'
  return 'ok'
}
