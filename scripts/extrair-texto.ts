/**
 * Extrai a faixa de uma perícope da fonte bíblica, no formato que o app lê:
 * `Capítulo N` como cabeçalho e `V texto` por versículo (ver
 * `src/lib/parse-texto.ts`).
 *
 * Vive num módulo próprio porque o ETL e o gerador das perícopes novas
 * precisam do MESMO recorte. Enquanto cada um tinha a sua cópia, a do
 * `gerar-novas` lançava onde a do ETL avisava, e as duas tratavam epígrafe de
 * jeito nenhum.
 *
 * Duas decisões estão aqui:
 *
 * - A **epígrafe de abertura** (o sobrescrito do salmo, quando a faixa começa
 *   no versículo que o traz) sai como campo `sobrescrito`, para a tela mostrar
 *   como epígrafe acima do texto e fora da numeração.
 * - **Rótulo estrutural** (a letra do acróstico no Sl 119, o marcador de
 *   locutor em Cantares) fica SEMPRE na linha do versículo, como `Rótulo:
 *   texto` — que é como um narrador leria. Nunca sobe para o topo: "Álefe" não
 *   é o título do Salmo 119, é o par de "Bete" oito versículos adiante.
 * - Um sobrescrito que caia no MEIO da faixa (uma perícope que atravessa o
 *   início de outro capítulo de Isaías, por exemplo) também fica na linha: o
 *   topo é da abertura, e só dela.
 */
import type { LivroBlivre } from './blivre-fonte.ts'

export type Extracao = {
  texto: string
  /** Epígrafe do versículo que abre a faixa, quando existe. */
  sobrescrito?: string
  versiculos: number
  avisos: string[]
}

export function extrairTexto(
  livro: LivroBlivre,
  capInicio: number,
  verInicio: number,
  capFim: number,
  verFim: number,
): Extracao {
  const avisos: string[] = []
  const linhas: string[] = []
  let versiculos = 0
  let sobrescrito: string | undefined

  for (let c = capInicio; c <= capFim; c++) {
    const capitulo = livro.chapters[c - 1]
    if (!capitulo) {
      avisos.push(`capítulo ${c} ausente em ${livro.name}`)
      continue
    }

    const de = c === capInicio ? verInicio : 1
    const ate = c === capFim ? verFim : capitulo.length

    // Sem este aviso a faixa some em silêncio: o laço abaixo simplesmente não
    // roda, e nada denuncia que a perícope pedia um versículo inexistente.
    if (de > ate) {
      avisos.push(
        `${livro.name} ${c}:${de} — início além do fim do capítulo, que tem ${capitulo.length} versículos`,
      )
      continue
    }

    linhas.push(`Capítulo ${c}`)
    for (let v = de; v <= ate; v++) {
      const verso = capitulo[v - 1]
      if (verso == null) {
        avisos.push(`${livro.name} ${c}:${v} ausente na fonte`)
        continue
      }
      const abertura = c === capInicio && v === verInicio
      if (abertura && verso.e) {
        sobrescrito = verso.e
        linhas.push(`${v} ${verso.t}`)
      } else {
        const rotulo = verso.r ?? verso.e
        linhas.push(rotulo ? `${v} ${rotulo}: ${verso.t}` : `${v} ${verso.t}`)
      }
      versiculos++
    }
  }

  return { texto: linhas.join('\n'), sobrescrito, versiculos, avisos }
}
