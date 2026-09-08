import { useState, type FormEvent } from 'react'
import { maxChapter, maxVerse, type BibleBook } from '../lib/bible-books'
import type { FiltroLeitura, LivroProgresso } from '../lib/content'
import type { ItemPericope } from '../lib/item-pericope'
import ListaPericopes from './ListaPericopes'

export default function LivroAberto({
  livro,
  prog,
  itens,
  concluidas,
  filtro,
  cap,
  onCap,
  onTrocar,
  onIrParaVersiculo,
}: {
  livro: BibleBook
  /** Progresso do livro INTEIRO — não do que sobrou do recorte. */
  prog: LivroProgresso | undefined
  itens: ItemPericope[]
  concluidas: Set<number>
  filtro: FiltroLeitura
  cap: number | null
  onCap: (cap: number | null) => void
  onTrocar: () => void
  onIrParaVersiculo: (cap: number, ver: number) => void
}) {
  const [campoCap, setCampoCap] = useState('')
  const [campoVer, setCampoVer] = useState('')
  // Trocar de livro tem que limpar os campos: "3" digitado para João é um
  // capítulo válido em Gênesis também, e ficaria no campo validado contra os
  // limites do livro errado. O padrão de ajustar estado no render (em vez de
  // um efeito) evita pintar um frame com o valor do livro anterior. Isto vale
  // mesmo se a página esquecer de passar `key` — a invariante é do componente,
  // não do consumidor.
  const [livroAnterior, setLivroAnterior] = useState(livro)
  if (livro !== livroAnterior) {
    setLivroAnterior(livro)
    setCampoCap('')
    setCampoVer('')
  }

  const capNum = Number(campoCap)
  const capOk = Number.isInteger(capNum) && capNum >= 1 && capNum <= maxChapter(livro)
  const verMax = capOk ? maxVerse(livro, capNum) : 0
  const verNum = Number(campoVer)
  const verOk = capOk && Number.isInteger(verNum) && verNum >= 1 && verNum <= verMax

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!capOk) return
    if (verOk) onIrParaVersiculo(capNum, verNum)
    else onCap(capNum)
  }

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
            Trocar livro
          </button>
        </div>

        <form className="ref-form" onSubmit={aoEnviar}>
          <label>
            Capítulo
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxChapter(livro)}
              placeholder={`1–${maxChapter(livro)}`}
              value={campoCap}
              onChange={(e) => {
                setCampoCap(e.target.value)
                setCampoVer('')
              }}
            />
          </label>
          <label>
            Versículo
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={verMax || undefined}
              placeholder={capOk ? `1–${verMax}` : 'Capítulo primeiro'}
              value={campoVer}
              disabled={!capOk}
              onChange={(e) => setCampoVer(e.target.value)}
            />
          </label>
          <button type="submit" disabled={!capOk}>
            Ir
          </button>
        </form>
      </div>

      <p className="peri-count">
        {cap != null
          ? `${itens.length} perícope${itens.length === 1 ? '' : 's'} no capítulo ${cap}`
          : `${itens.length} perícope${itens.length === 1 ? '' : 's'}${
              filtro === 'todos' ? ` em ${livro.name}` : ' no recorte'
            }`}
        {cap != null && (
          <>
            {' · '}
            <button type="button" className="linkish" onClick={() => onCap(null)}>
              Ver todas do livro
            </button>
          </>
        )}
      </p>

      <ListaPericopes itens={itens} concluidas={concluidas} />
    </>
  )
}
