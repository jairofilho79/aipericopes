/**
 * Lógica pura das referências cruzadas: alinhar o ponto da chamada de nota da
 * ARC ao texto da Bíblia Livre (cuja redação difere), e montar o shard de um livro.
 * O I/O fica em scripts/shard-referencias.ts.
 */

/** Âncora como sai de scripts/extrair_ancoras_referencias_arc.py. */
export type AncoraArc = {
  id: string
  ordem: number
  palavra_idx: number
  antes: string
  depois: string
  total_palavras: number
}

export type AlvoArc = {
  livro: string
  capitulo: number
  versiculo: string | number | null
}

export type NotaArc = {
  id: string
  alvos: AlvoArc[]
}

/** exata: palavra anterior e posterior batem; parcial: uma delas; estimada: nenhuma — posição proporcional. */
export type Qualidade = 'exata' | 'parcial' | 'estimada'

export type Alinhamento = { pos: number; qualidade: Qualidade }

/** Minúsculas, sem acento e sem pontuação: "criou," e "Criou" são a mesma palavra. */
export function normalizar(palavra: string): string {
  return palavra
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Posição (nº de palavras que vêm ANTES da letrinha) no texto da Bíblia Livre.
 * `palavras` é `texto.split(' ')`, a mesma tokenização de `tokens()` — o índice
 * serve direto para a Leitura. `minPos` garante a ordem das notas do versículo.
 */
export function alinharAncora(palavras: string[], a: AncoraArc, minPos = 0): Alinhamento {
  const n = palavras.length
  const antes = normalizar(a.antes)
  const depois = normalizar(a.depois)
  const esperado = a.total_palavras > 0 ? Math.round((a.palavra_idx * n) / a.total_palavras) : n

  let melhor: { pos: number; pontos: number; efetivo: number } | null = null
  for (let j = Math.min(minPos, n); j <= n; j++) {
    let pontos = 0
    if (a.palavra_idx === 0) {
      if (j === 0) pontos += 2
    } else if (j > 0 && antes && normalizar(palavras[j - 1]) === antes) {
      pontos += 2
    }
    if (j < n && depois && normalizar(palavras[j]) === depois) pontos += 1
    if (pontos === 0) continue
    const efetivo = pontos - 1.5 * (Math.abs(j - esperado) / Math.max(n, 1))
    if (!melhor || efetivo > melhor.efetivo) melhor = { pos: j, pontos, efetivo }
  }

  if (melhor) return { pos: melhor.pos, qualidade: melhor.pontos >= 3 ? 'exata' : 'parcial' }

  // Redação sem nenhuma palavra em comum perto da nota: usa a posição proporcional,
  // encaixada na pontuação mais próxima (a chamada da ARC costuma ficar numa pausa).
  const centro = Math.min(Math.max(esperado, minPos), n)
  let pos = centro
  for (let d = 0; d <= 3; d++) {
    const achou = [centro - d, centro + d].find(
      (j) => j >= Math.max(minPos, 1) && j <= n && /[,;:.!?]$/.test(palavras[j - 1]),
    )
    if (achou !== undefined) {
      pos = achou
      break
    }
  }
  return { pos, qualidade: 'estimada' }
}

/** "15;" -> "15"; "7-11" e "4,9" ficam como estão. Null quando não sobra número. */
export function normalizarVersiculo(v: string | number | null): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[^\d,-]/g, '').replace(/^[,-]+|[,-]+$/g, '')
  return /^\d+([,-]\d+)*$/.test(s) ? s : null
}

/** Nome do livro sem espaços, para casar "1Crônicas" (EPUB) com "1 Crônicas" (catálogo). */
export function chaveLivro(nome: string): string {
  return nome.replace(/\s+/g, '')
}

/** [livro, capítulo, versículo] com o nome do livro como está no catálogo. */
export type AlvoShard = [string, number, string]

export type NotaShard = {
  /** Palavras do versículo (Bíblia Livre) antes da letrinha; null quando o versículo não existe no catálogo. */
  p: number | null
  a: AlvoShard[]
}

export type ShardReferencias = {
  livro: string
  /** "cap:ver" -> notas na ordem do texto. A letra (a, b, c…) vem da posição no array. */
  versiculos: Record<string, NotaShard[]>
}

export type EstatisticasShard = {
  notas: number
  exata: number
  parcial: number
  estimada: number
  semVersiculo: number
  alvosDescartados: number
}

/**
 * Monta o shard de UM livro.
 *  - `ancoras`: "cap:ver" -> âncoras da ARC (inclui as de notas explicativas, que são ignoradas).
 *  - `notasPorId`: só as notas de referência cruzada.
 *  - `versiculosLivre`: "cap:ver" -> texto do versículo na Bíblia Livre.
 *  - `nomeNoCatalogo`: chave sem espaços -> nome do livro no catálogo.
 */
export function montarShardLivro(
  livro: string,
  ancoras: Record<string, AncoraArc[]>,
  notasPorId: Map<string, NotaArc>,
  versiculosLivre: Map<string, string>,
  nomeNoCatalogo: Map<string, string>,
): { shard: ShardReferencias; stats: EstatisticasShard } {
  const stats: EstatisticasShard = {
    notas: 0,
    exata: 0,
    parcial: 0,
    estimada: 0,
    semVersiculo: 0,
    alvosDescartados: 0,
  }
  const versiculos: Record<string, NotaShard[]> = {}

  for (const [chave, lista] of Object.entries(ancoras)) {
    const texto = versiculosLivre.get(chave)
    const palavras = texto ? texto.split(' ') : null
    let minPos = 0
    const notas: NotaShard[] = []

    for (const ancora of [...lista].sort((x, y) => x.ordem - y.ordem)) {
      const nota = notasPorId.get(ancora.id)
      if (!nota) continue // nota explicativa, sem referência cruzada

      const alvos: AlvoShard[] = []
      for (const alvo of nota.alvos) {
        const ver = normalizarVersiculo(alvo.versiculo)
        const nome = nomeNoCatalogo.get(chaveLivro(alvo.livro))
        if (!ver || !nome || !alvo.capitulo) {
          stats.alvosDescartados++
          continue
        }
        alvos.push([nome, alvo.capitulo, ver])
      }
      if (alvos.length === 0) continue

      stats.notas++
      let p: number | null = null
      if (palavras) {
        const al = alinharAncora(palavras, ancora, minPos)
        p = al.pos
        minPos = al.pos
        stats[al.qualidade]++
      } else {
        stats.semVersiculo++
      }
      notas.push({ p, a: alvos })
    }
    if (notas.length > 0) versiculos[chave] = notas
  }

  return { shard: { livro, versiculos }, stats }
}
