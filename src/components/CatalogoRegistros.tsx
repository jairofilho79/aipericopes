import type { FiltroLeitura } from '../lib/content'
import type { Registro, RegistroProgresso } from '../lib/registros'
import { rotuloContagem } from '../lib/catalogo'

/** Lista chata dos 17 registros, no mesmo formato visual de `livro-row` que
 *  `CatalogoLivros` usa por livro: nome, barra de progresso, rótulo. Sem
 *  agrupamento — os registros já chegam na ordem que a tela deve mostrar
 *  (`loadRegistros` ordena por tamanho decrescente). */
export default function CatalogoRegistros({
  registros,
  progresso,
  contagem,
  filtro,
  onAbrir,
}: {
  registros: Registro[]
  /** Progresso REAL do registro — nunca obedece ao filtro. */
  progresso: Map<string, RegistroProgresso>
  /** Quantas perícopes do registro sobrevivem ao recorte ativo. */
  contagem: Map<string, number>
  filtro: FiltroLeitura
  onAbrir: (slug: string) => void
}) {
  return (
    <ul className="livro-list">
      {registros.map((r) => {
        const prog = progresso.get(r.slug)
        const noRecorte = contagem.get(r.slug) ?? 0
        const vazio = filtro !== 'todos' && noRecorte === 0
        return (
          <li key={r.slug}>
            <button
              type="button"
              className={`livro-row${vazio ? ' livro-vazio' : ''}`}
              onClick={() => onAbrir(r.slug)}
            >
              <span className="livro-nome">{r.nome}</span>
              {/* A barra é do registro INTEIRO, nunca do recorte: com "não
                  lidos" ativo uma barra filtrada estaria sempre em zero —
                  mesma invariante que CatalogoLivros documenta por livro.
                  É decoração: quem usa leitor de tela recebe o rótulo. */}
              <span className="book-progress" aria-hidden>
                <span
                  className="book-progress-fill"
                  style={{ width: `${prog?.pct ?? 0}%` }}
                />
              </span>
              <span className="book-progress-label">
                {rotuloContagem(filtro, prog, noRecorte)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
