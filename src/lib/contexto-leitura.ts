/**
 * O "contexto" que acompanha quem lê: de onde veio e por onde está andando.
 * Vive na query string (sobrevive a refresh e deep link), e o pager, o swipe e
 * o teclado precisam levá-lo adiante para o botão de voltar não se perder ao
 * trocar de perícope.
 *
 *   de=jornada | jornadaId=…   — leitura dentro de uma jornada (muda a ROTA do pager)
 *   mock=1                     — dados de demonstração
 *   via=ref | origem | ov      — chegou por uma referência cruzada: a perícope e o
 *                                versículo ("cap:ver") de onde saiu
 *   jid                        — jornada em que a perícope de ORIGEM estava; só
 *                                nomeia o destino "Jornada" do botão de voltar e
 *                                NÃO muda a rota do pager (o destino pode nem
 *                                pertencer a essa jornada)
 */

const VERSICULO = /^\d+:\d+$/

export type OrigemRef = { ordem: number; versiculoId: string | null }

/** Query com o contexto a carregar para a próxima perícope (sem `?`; vazia se não há). */
export function qsDeContexto(sp: URLSearchParams): string {
  const out = new URLSearchParams()
  if (sp.get('de') === 'jornada') out.set('de', 'jornada')
  const jornadaId = sp.get('jornadaId')
  if (jornadaId) out.set('jornadaId', jornadaId)
  if (sp.has('mock')) out.set('mock', '1')
  const origem = origemDaReferencia(sp)
  if (origem) {
    out.set('via', 'ref')
    out.set('origem', String(origem.ordem))
    if (origem.versiculoId) out.set('ov', origem.versiculoId)
    const jid = sp.get('jid')
    if (jid) out.set('jid', jid)
  }
  return out.toString()
}

/** `?via=ref` válido: a perícope de origem e o versículo onde a pessoa estava. Null se não veio por referência. */
export function origemDaReferencia(sp: URLSearchParams): OrigemRef | null {
  if (sp.get('via') !== 'ref') return null
  const bruto = sp.get('origem')
  if (!bruto) return null // ausente ou vazio: Number('') e Number(null) dariam 0
  const ordem = Number(bruto)
  if (!Number.isInteger(ordem) || ordem < 0) return null
  const ov = sp.get('ov')
  return { ordem, versiculoId: ov && VERSICULO.test(ov) ? ov : null }
}

/** Rota para voltar à perícope de origem, já focando o versículo de onde saiu. */
export function urlDaOrigem(origem: OrigemRef): string {
  return `/leitura/${origem.ordem}${origem.versiculoId ? `?v=${encodeURIComponent(origem.versiculoId)}` : ''}`
}

/** Jornada a nomear no botão de voltar: a da própria leitura ou, vindo por referência, a da origem. */
export function jornadaDoContexto(sp: URLSearchParams): string | null {
  return sp.get('jornadaId') ?? sp.get('jid')
}

// ---------------------------------------------------------------- histórico

/**
 * Estado a gravar na entrada de histórico que SAI para uma referência: qual era
 * o índice da entrada de origem. É o que permite voltar com `navigate(-n)`
 * (desfazendo a pilha, sem empilhar a origem de novo).
 */
export function estadoDeSaida(): { refOrigemIdx: number } | undefined {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? { refOrigemIdx: idx } : undefined
}

/** Leva o estado de saída adiante enquanto a pessoa segue no contexto da referência (pager, swipe, teclado). */
export function estadoDeContexto(
  state: unknown,
  sp: URLSearchParams,
): { refOrigemIdx: number } | undefined {
  if (!origemDaReferencia(sp)) return undefined
  const idx = (state as { refOrigemIdx?: unknown } | null)?.refOrigemIdx
  return typeof idx === 'number' ? { refOrigemIdx: idx } : undefined
}

/**
 * Quantos passos de histórico separam a entrada atual da origem (negativo, para
 * `navigate`), ou null quando não dá para saber — refresh sem estado, link
 * aberto de fora — e a volta tem de ser por URL.
 */
export function passosAteOrigem(state: unknown, idxAtual: unknown): number | null {
  const origem = (state as { refOrigemIdx?: unknown } | null)?.refOrigemIdx
  if (typeof origem !== 'number' || typeof idxAtual !== 'number') return null
  return idxAtual > origem ? origem - idxAtual : null
}

/** Índice da entrada de histórico atual (react-router grava `idx`), ou null fora do navegador. */
export function idxDoHistorico(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

/**
 * Antes de sair para uma referência, grava o versículo de onde se saiu na URL da
 * entrada ATUAL. Assim, ao voltar (botão, gesto do sistema ou navigate(-n)) a
 * perícope de origem abre já rolada e focada nele, pelo mesmo `?v=` de sempre.
 */
export function marcarVersiculoNaUrl(versiculoId: string): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('v', versiculoId)
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // sem histórico (teste, ambiente restrito): a volta por URL cobre
  }
}
