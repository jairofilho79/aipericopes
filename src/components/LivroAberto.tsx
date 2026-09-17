import type { BibleBook } from '../lib/bible-books'
import type { FiltroLeitura, LivroProgresso } from '../lib/content'
import type { ItemPericope } from '../lib/item-pericope'
import { IconeTrocar } from './icones'
import ListaPericopes from './ListaPericopes'

/** Cabeçalho e lista, a mesma forma de `RegistroAberto`: o formulário de
 *  capítulo/versículo saiu porque o campo de referência do topo do Explorar
 *  resolve "Gn 3:15" de qualquer lugar da tela, inclusive com o livro
 *  aberto — eram duas portas para o mesmo resultado. */
export default function LivroAberto({
  livro,
  prog,
  itens,
  concluidas,
  filtro,
  onTrocar,
  jornadaId,
}: {
  livro: BibleBook
  /** Progresso do livro INTEIRO — não do que sobrou do recorte. */
  prog: LivroProgresso | undefined
  itens: ItemPericope[]
  concluidas: Set<number>
  /** Só para o `peri-count` dizer "em Gênesis" contra "no recorte". */
  filtro: FiltroLeitura
  onTrocar: () => void
  jornadaId?: string
}) {
  return (
    <>
      <div className="ref-sticky">
        <div className="selected-book">
          <div className="selected-book-meta">
            <span className="selected-book-name">{livro.name}</span>
            <span className="muted">
              {livro.abbrev} · {livro.section}
            </span>
          </div>
          {/* A barra é do livro inteiro, nunca do recorte: com "não lidos"
              ativo, uma barra filtrada estaria sempre em zero. */}
          <span className="book-progress-wrap">
            <span className="book-progress" aria-hidden>
              <span className="book-progress-fill" style={{ width: `${prog?.pct ?? 0}%` }} />
            </span>
            <span className="book-progress-label">
              {prog?.concluidas ?? 0} de {prog?.total ?? 0}
            </span>
          </span>
          <button type="button" className="ghost trocar-livro" onClick={onTrocar}>
            <IconeTrocar size={16} />
            <span>Trocar livro</span>
          </button>
        </div>
      </div>

      <p className="peri-count">
        {itens.length} perícope{itens.length === 1 ? '' : 's'}
        {filtro === 'todos' ? ` em ${livro.name}` : ' no recorte'}
      </p>

      <ListaPericopes itens={itens} concluidas={concluidas} jornadaId={jornadaId} />
    </>
  )
}
