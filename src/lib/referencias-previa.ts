import { loadIndex } from './content'
import { livroSlug } from './livro-slug'
import { resolverAlvo, extrairVersiculos, type AlvoReferencia } from './referencias'
import { carregarTexto } from './shards'

export type PreviaDoAlvo = {
  ordem: number
  versiculoId: string
  versos: { verso: number; texto: string }[]
}

/**
 * Texto do alvo de uma referência, para a prévia no popover. Reaproveita o
 * shard de texto do livro (que a Leitura também usa), então ler a prévia de um
 * livro já aberto não custa rede. Null quando o destino não resolve.
 */
export async function previaDoAlvo(alvo: AlvoReferencia): Promise<PreviaDoAlvo | null> {
  const destino = resolverAlvo(await loadIndex(), alvo)
  if (!destino) return null
  const textos = await carregarTexto(livroSlug(alvo.livro))
  const texto = textos.get(destino.pericope.ordem)?.texto
  if (!texto) return null
  const versos = extrairVersiculos(texto, alvo.capitulo, alvo.versiculos)
  return { ordem: destino.pericope.ordem, versiculoId: destino.versiculoId, versos }
}
