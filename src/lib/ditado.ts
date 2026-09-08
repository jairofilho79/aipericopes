/**
 * Ditado das anotações — caminho de fallback. O principal é o reconhecimento
 * nativo do aparelho (reconhecimento-fala.ts); onde a Web Speech API não
 * existe (Firefox), o DitarBotao grava e manda para POST /api/transcrever, e
 * é isso que vive aqui: escolha do formato de gravação, a chamada ao Worker e
 * o contador/cota. `inserirNoCursor` serve aos dois caminhos. Tudo puro (ou
 * só com `fetch`) para o DitarBotao ficar com o mínimo de lógica.
 */

// Cópia deliberada de MAX_SEGUNDOS em worker/transcrever.ts: o app não pode
// importar de worker/ (tsconfig/bundle separados). Mantenha os dois iguais.
export const MAX_SEGUNDOS_DITADO = 60

// Ordem de preferência: Opus em webm é o que Chrome/Firefox/Edge gravam
// melhor; mp4 (AAC) é o único que o Safari/iOS aceita; ogg/opus cobre
// Firefox antigo. Todos estão na lista que o Worker aceita.
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

/** Primeiro formato da lista que este navegador sabe gravar, ou null. */
export function escolherMime(): string | null {
  const MR = (globalThis as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } })
    .MediaRecorder
  if (!MR?.isTypeSupported) return null
  return MIMES.find((m) => MR.isTypeSupported!(m)) ?? null
}

// Depois do cursor, pontuação de fecho não quer espaço antes dela.
const SEM_ESPACO_DEPOIS = /^[\s.,;:!?)\]}»”]/

/**
 * Insere `trecho` no lugar da seleção [inicioSel, fimSel) de `texto`, pondo um
 * espaço antes/depois só quando falta: nunca duplica espaço, nunca abre um
 * texto vazio com espaço, e respeita quebra de linha e pontuação. Devolve o
 * texto novo e onde o cursor deve ficar (logo depois do que entrou).
 */
export function inserirNoCursor(
  texto: string,
  inicioSel: number,
  fimSel: number,
  trecho: string,
): { texto: string; cursor: number } {
  const limpo = trecho.trim()
  const inicio = Math.max(0, Math.min(inicioSel, texto.length))
  const fim = Math.max(inicio, Math.min(fimSel, texto.length))
  if (!limpo) return { texto, cursor: fim }
  const antes = texto.slice(0, inicio)
  const depois = texto.slice(fim)
  const espacoAntes = antes.length > 0 && !/\s$/.test(antes) ? ' ' : ''
  const espacoDepois = depois.length > 0 && !SEM_ESPACO_DEPOIS.test(depois) ? ' ' : ''
  const inserido = espacoAntes + limpo + espacoDepois
  return { texto: antes + inserido + depois, cursor: antes.length + inserido.length }
}

/**
 * Troca a última ocorrência de `original` em `texto` por `revisado` — é o que
 * a revisão por IA faz com o trecho que acabou de ser ditado. Da última para
 * a primeira porque o ditado entrou perto do cursor, no fim. Se o trecho não
 * está mais lá (a pessoa já editou), devolve null e nada muda. O cursor vai
 * para o fim do que entrou.
 */
export function substituirTrecho(
  texto: string,
  original: string,
  revisado: string,
): { texto: string; cursor: number } | null {
  if (!original) return null
  const inicio = texto.lastIndexOf(original)
  if (inicio < 0) return null
  const antes = texto.slice(0, inicio)
  return {
    texto: antes + revisado + texto.slice(inicio + original.length),
    cursor: antes.length + revisado.length,
  }
}

/** Contador ao lado do microfone: `0:07 / 1:00`. */
export function formatarContador(segundos: number): string {
  const s = Math.min(Math.max(0, Math.floor(segundos)), MAX_SEGUNDOS_DITADO)
  const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
  return `${mmss(s)} / ${mmss(MAX_SEGUNDOS_DITADO)}`
}

/** Hora local (HH:mm) em que a cota volta. */
export function formatarHoraVolta(voltaEmIso: string): string {
  return new Date(voltaEmIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function mensagemEsgotado(voltaEmIso: string): string {
  return `Ditado volta às ${formatarHoraVolta(voltaEmIso)}`
}

/**
 * Quanto falta até a cota voltar, em ms — nunca negativo, e zero para um ISO
 * inválido (melhor voltar ao ocioso e deixar o servidor responder de novo do
 * que travar o botão para sempre).
 */
export function msAteVolta(voltaEmIso: string, agora = Date.now()): number {
  const alvo = Date.parse(voltaEmIso)
  if (Number.isNaN(alvo)) return 0
  return Math.max(0, alvo - agora)
}

export type ResultadoTranscricao =
  | { ok: true; texto: string }
  | { ok: false; mensagem: string; voltaEm?: string }

const MENSAGENS: Record<number, string> = {
  401: 'Entre para ditar',
  413: 'Gravação grande demais',
  415: 'Formato de áudio não suportado',
}

/**
 * Manda o áudio para o Worker e traduz o resultado em texto ou numa mensagem
 * curta para o flashAviso. `segundos` é a duração medida no cliente; vai
 * arredondada para cima (o servidor cobra inteiros) e presa ao teto.
 */
export async function transcrever(
  blob: Blob,
  mime: string,
  segundos: number,
): Promise<ResultadoTranscricao> {
  const duracao = Math.min(MAX_SEGUNDOS_DITADO, Math.max(1, Math.ceil(segundos)))
  let res: Response
  try {
    res = await fetch('/api/transcrever', {
      method: 'POST',
      body: blob,
      headers: { 'content-type': mime, 'X-Duracao-Segundos': String(duracao) },
      credentials: 'include',
    })
  } catch {
    return { ok: false, mensagem: 'Sem conexão para transcrever' }
  }
  const corpo = (await res.json().catch(() => null)) as
    | { texto?: unknown; voltaEm?: unknown }
    | null
  if (res.ok && typeof corpo?.texto === 'string') return { ok: true, texto: corpo.texto }
  if (res.status === 429 || res.status === 503) {
    if (typeof corpo?.voltaEm === 'string') {
      return { ok: false, mensagem: mensagemEsgotado(corpo.voltaEm), voltaEm: corpo.voltaEm }
    }
    return {
      ok: false,
      mensagem: res.status === 429 ? 'Cota de ditado esgotada por hoje' : 'Ditado indisponível hoje',
    }
  }
  return { ok: false, mensagem: MENSAGENS[res.status] ?? 'Não foi possível transcrever' }
}
