/**
 * Manifesto de sincronização da narração (gerado noutra sessão, servido do R2
 * pelo Worker). `inicio`/`dur` e `palavras[].i`/`.d` são segundos ABSOLUTOS
 * dentro do m4a costurado — é o eixo do `timeupdate`.
 */
/**
 * `palavras` é a lista que fecha a resenha. Ela é seção PRÓPRIA no áudio, e não
 * um pedaço da resenha, porque na tela ela se distingue pela cor e pelo rótulo
 * — e no áudio não há cor. Sem um cabeçalho falado, o ouvinte ouviria a prosa
 * terminar e um verbete começar sem aviso.
 *
 * Uma unidade de seção desconhecida invalida o manifesto INTEIRO (ver
 * `manifestoValido`), e manifesto inválido vira `null`, que é o app inteiro sem
 * realce e sem erro em lugar nenhum. Por isso este vocabulário e o do gerador
 * de narração precisam andar juntos.
 */
export type SecaoManifesto =
  | 'titulo'
  | 'contexto'
  | 'texto'
  | 'resenha'
  | 'palavras'
  | 'reflexoes'

export type PalavraManifesto = { t: string; i: number; d: number }

export type UnidadeManifesto = {
  i: number
  secao: SecaoManifesto
  texto: string
  inicio: number
  dur: number
  /** Ausente em manifesto anterior ao realinhamento: sem ele, não há realce. */
  palavras?: PalavraManifesto[]
}

export type Manifesto = {
  ordem: number
  dur_total: number
  unidades: UnidadeManifesto[]
}

const SECOES: readonly string[] = [
  'titulo',
  'contexto',
  'texto',
  'resenha',
  'palavras',
  'reflexoes',
]

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function palavraValida(v: unknown): v is PalavraManifesto {
  const p = v as PalavraManifesto
  return !!p && typeof p === 'object' && typeof p.t === 'string' && num(p.i) && num(p.d)
}

function unidadeValida(v: unknown): v is UnidadeManifesto {
  const u = v as UnidadeManifesto
  if (!u || typeof u !== 'object') return false
  if (typeof u.texto !== 'string' || !SECOES.includes(u.secao)) return false
  if (!num(u.i) || !num(u.inicio) || !num(u.dur)) return false
  if (u.palavras !== undefined) {
    if (!Array.isArray(u.palavras) || !u.palavras.every(palavraValida)) return false
  }
  return true
}

/** Guarda de forma: o manifesto vem da rede, então nada aqui é presumido. */
export function manifestoValido(v: unknown): v is Manifesto {
  const m = v as Manifesto
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false
  if (!num(m.ordem) || !num(m.dur_total)) return false
  return Array.isArray(m.unidades) && m.unidades.every(unidadeValida)
}

/**
 * Prefixo da narração publicada no R2, e a única fonte dele no app — o player
 * monta a URL do `.m4a` a partir daqui, e esta função a do `.json`.
 *
 * Cada regeração ganha um prefixo NOVO em vez de regravar o anterior: o Worker
 * serve `/api/audio/*` como `immutable` com um ano de cache, então sobrescrever
 * a mesma chave nunca chegaria em quem já ouviu aquela perícope.
 *
 * O nome diz de qual master local o áudio saiu — `tts-corpus/gam-ash/`. O
 * prefixo anterior se chamava `nt-ml`, nome de uma primeira tentativa de
 * narração que foi abandonada; o conteúdo servido dali era o do `gam-ash`, e o
 * nome mentia. Achar o master certo custou meio dia. Se um dia trocar a voz,
 * troque o nome junto.
 *
 * `gam-ash1` era o mesmo áudio de `nt-ml`, reprocessado para o alvo de loudness
 * de streaming; a publicação original saiu do TTS em -24 LUFS e soava fraca ao
 * lado de qualquer outra mídia no mesmo aparelho. Os offsets do manifesto são
 * os mesmos: a receita não desloca amostras. Ver
 * `scripts/normalizar-narracao.sh`.
 *
 * ── POR QUE O SUFIXO VIROU 2 ──
 *
 * `gam-ash1` é a narração da NAA, e ela NÃO PODE ser encontrada por este app.
 * O bucket ainda a guarda (6.155 objetos, 8,64 GB) e as chaves são por
 * `ordem`, exatamente o que buscamos aqui — então apontar para `gam-ash1`
 * faria o tocador aparecer e ler a NAA em voz alta por cima do texto da
 * Bíblia Livre na tela, com o título antigo e o realce fora de sincronia.
 * Três problemas de uma vez: direito autoral, conteúdo errado e interface
 * quebrada.
 *
 * Mesma voz (`ash`) e mesmo motor: só a gravação muda, porque o texto mudou.
 * O `1` é a era NAA; o `2` é a era Bíblia Livre. Enquanto a Sessão 4 não
 * publicar nada em `gam-ash2/`, não há manifesto e o tocador não aparece —
 * que é o comportamento certo.
 *
 * Há teste travando isto. Não volte para `gam-ash1`.
 */
export const VOZ = 'gam-ash2'

/**
 * Busca o manifesto da perícope. Qualquer falha — 404, rede, corpo estranho —
 * devolve `null`: sem manifesto o áudio ainda toca, só que sem realce.
 */
export async function carregarManifesto(
  ordem: number,
  signal?: AbortSignal,
): Promise<Manifesto | null> {
  try {
    // `res.ok`, não `status === 200`: o Worker devolve 206 em GET do R2.
    const res = await fetch(`/api/audio/${VOZ}/${ordem}.json`, { signal })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null
    const corpo: unknown = await res.json()
    return manifestoValido(corpo) ? corpo : null
  } catch {
    return null
  }
}
