import { Link } from 'react-router-dom'
import type { ItemPericope } from '../lib/item-pericope'

export default function ListaPericopes({
  itens,
  concluidas,
}: {
  itens: ItemPericope[]
  concluidas: Set<number>
}) {
  return (
    <ul className="peri-list">
      {itens.map((it) => {
        const done = concluidas.has(it.ordem)
        return (
          <li key={it.ordem}>
            <Link
              to={`/leitura/${it.ordem}${it.verseId ? `?v=${it.verseId}` : ''}`}
              className={done ? 'done' : undefined}
            >
              <span className="peri-row">
                <span className="check" aria-hidden>
                  {done ? '✓' : ''}
                </span>
                <span className="peri-text">
                  <strong>{it.titulo}</strong>
                  <span>{it.ref}</span>
                  {it.trecho && (
                    <span className="hit-snippet">
                      {it.trecho.antes}
                      {it.trecho.marcado && <mark>{it.trecho.marcado}</mark>}
                      {it.trecho.depois}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
