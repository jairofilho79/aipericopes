export type EstudoShard = {
  contexto_historico_literario: string
  resenha: string
  perguntas_reflexao: string[]
  topicos_pregar?: string
}

type Tipo = 'texto' | 'estudo'

// Cache de módulo por (tipo, slug). O Cache Storage do service worker já evita
// a rede na segunda vez; este mapa evita também o parse do JSON.
const prontos = new Map<string, Map<number, unknown>>()
const emVoo = new Map<string, Promise<Map<number, unknown>>>()

function chave(tipo: Tipo, slug: string): string {
  return `${tipo}/${slug}`
}

export function shardCarregado(tipo: Tipo, slug: string): boolean {
  return prontos.has(chave(tipo, slug))
}

/**
 * `res.ok` não basta: o Cloudflare serve o index.html com HTTP 200 para
 * qualquer caminho inexistente (not_found_handling: single-page-application).
 * Sem esta checagem o HTML passaria pelo guard e estouraria no res.json(),
 * levando um SyntaxError em inglês até a tela de leitura.
 */
async function lerLinhas(res: Response, tipo: Tipo, slug: string): Promise<{ ordem: number }[]> {
  const falha = (): Error => new Error(`Falha ao carregar ${tipo} de ${slug}`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) throw falha()
  let corpo: unknown
  try {
    corpo = await res.json()
  } catch {
    throw falha()
  }
  if (!Array.isArray(corpo)) throw falha()
  return corpo as { ordem: number }[]
}

async function carregar(tipo: Tipo, slug: string): Promise<Map<number, unknown>> {
  const k = chave(tipo, slug)
  const pronto = prontos.get(k)
  if (pronto) return pronto
  const voando = emVoo.get(k)
  if (voando) return voando

  const p = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${tipo}/${slug}.json`)
    if (!res.ok) throw new Error(`Falha ao carregar ${tipo} de ${slug}`)
    const linhas = await lerLinhas(res, tipo, slug)
    const mapa = new Map<number, unknown>()
    for (const linha of linhas) {
      const { ordem, ...resto } = linha
      mapa.set(ordem, resto)
    }
    prontos.set(k, mapa)
    emVoo.delete(k)
    return mapa
  })().catch((err: unknown) => {
    // Falha transitória (é um PWA: offline acontece) não pode reservar a
    // rejeição para sempre — a próxima chamada tenta de novo.
    emVoo.delete(k)
    throw err
  })
  emVoo.set(k, p)
  return p
}

/**
 * O shard de texto carrega o par, não só a string: o `sobrescrito` é texto
 * bíblico ("Salmo de Davi, quando ele fugia…") e viaja junto com o texto, não
 * com o material editorial.
 */
export type TextoShard = { texto: string; sobrescrito?: string }

export async function carregarTexto(slug: string): Promise<Map<number, TextoShard>> {
  return (await carregar('texto', slug)) as Map<number, TextoShard>
}

export async function carregarEstudo(slug: string): Promise<Map<number, EstudoShard>> {
  return (await carregar('estudo', slug)) as Map<number, EstudoShard>
}
