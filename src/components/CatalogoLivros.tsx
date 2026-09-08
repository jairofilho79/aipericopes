import { BIBLE_BOOKS, type BibleBook } from '../lib/bible-books'
import { testamentLabel } from '../lib/testament'
import type { FiltroLeitura, LivroProgresso } from '../lib/content'
import { agruparLivros, rotuloContagem } from '../lib/catalogo'

export default function CatalogoLivros({
  livros = BIBLE_BOOKS,
  progresso,
  contagem,
  filtro,
  onAbrir,
  // No repouso o `h1` da página é sr-only, então `testament-h` como `h2` é o
  // primeiro título visível — certo. Mas dentro da seção "Livros" dos
  // resultados, aquele `h2` já existe (`secao-h`): dois `h2` irmãos em
  // relação de contenção (um dentro do outro) quebram a hierarquia para
  // quem navega por título com leitor de tela. `nivelTestamento={3}` rebaixa
  // para `h3` só nesse caso.
  nivelTestamento = 2,
}: {
  livros?: BibleBook[]
  /** Progresso REAL do livro — nunca obedece ao filtro. */
  progresso: Map<string, LivroProgresso>
  /** Quantas perícopes do livro sobrevivem ao recorte ativo. */
  contagem: Map<string, number>
  filtro: FiltroLeitura
  onAbrir: (livro: BibleBook) => void
  nivelTestamento?: 2 | 3
}) {
  const TestamentoTag = nivelTestamento === 3 ? 'h3' : 'h2'
  return (
    <div className="catalogo">
      {agruparLivros(livros).map((g) => (
        <div key={g.testament} className="testament-block">
          <TestamentoTag className="testament-h">{testamentLabel(g.testament)}</TestamentoTag>
          {g.secoes.map((s) => (
            <div key={s.secao} className="section-block">
              <h3 className="section-h">{s.secao}</h3>
              <ul className="livro-list">
                {s.livros.map((b) => {
                  const prog = progresso.get(b.name)
                  const noRecorte = contagem.get(b.name) ?? 0
                  const vazio = filtro !== 'todos' && noRecorte === 0
                  return (
                    <li key={b.abbrev}>
                      <button
                        type="button"
                        className={`livro-row${vazio ? ' livro-vazio' : ''}`}
                        onClick={() => onAbrir(b)}
                      >
                        <span className="livro-nome">{b.name}</span>
                        <span className="livro-abbrev">{b.abbrev}</span>
                        {/* A barra é decoração: quem usa leitor de tela recebe o rótulo. */}
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
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
