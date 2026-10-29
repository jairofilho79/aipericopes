import { useEffect, useRef, useState } from 'react'
import { loadIndex } from '../lib/content'
import type { NotaReferencia } from '../lib/referencias'
import type { PericopeIndex } from '../lib/types'
import AlvosReferencia from './AlvosReferencia'
import { IconeFechar } from './icones'

type Props = {
  /** Rótulo do versículo de origem, ex.: "Gênesis 1:1". */
  rotulo: string
  /** Perícope e versículo ("cap:ver") onde a letrinha foi tocada — a volta depende disso. */
  origem: { ordem: number; versiculoId: string }
  notas: NotaReferencia[]
  /** Letra tocada; abre já nela. */
  letraInicial: string
  onFechar: () => void
}

/**
 * Painel das referências de uma letrinha: a lista dos alvos, cada um com prévia
 * do texto sob demanda e a porta para a perícope de destino.
 *
 * Mora no rodapé, como a barra de ações do versículo, para o texto que a pessoa
 * está lendo continuar visível acima dele.
 */
export default function ReferenciasSheet({ rotulo, origem, notas, letraInicial, onFechar }: Props) {
  const [letra, setLetra] = useState(letraInicial)
  const [indice, setIndice] = useState<PericopeIndex[] | null>(null)
  const caixaRef = useRef<HTMLDivElement>(null)

  useEffect(() => setLetra(letraInicial), [letraInicial])

  useEffect(() => {
    let ativo = true
    void loadIndex()
      .then((i) => ativo && setIndice(i))
      .catch(() => undefined)
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  // Foco na caixa ao abrir (anuncia o título antes das opções) e de volta ao
  // versículo ao fechar, como a barra de ações.
  useEffect(() => {
    const anterior = document.activeElement
    caixaRef.current?.focus()
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true })
    }
  }, [])

  const nota = notas.find((n) => n.letra === letra) ?? notas[0]
  if (!nota) return null

  return (
    <div
      className="ref-sheet"
      role="dialog"
      aria-label={`Referências de ${rotulo}, nota ${nota.letra}`}
      ref={caixaRef}
      tabIndex={-1}
    >
      <div className="ref-sheet-head">
        <strong className="ref-sheet-titulo">
          {rotulo} · nota {nota.letra}
        </strong>
        <button type="button" className="linkish" onClick={onFechar}>
          <IconeFechar size={15} />
          Fechar
        </button>
      </div>

      {notas.length > 1 && (
        <div className="ref-sheet-letras" role="group" aria-label="Notas do versículo">
          {notas.map((n) => (
            <button
              key={n.letra}
              type="button"
              className={`ref-sheet-letra${n.letra === nota.letra ? ' ativa' : ''}`}
              aria-pressed={n.letra === nota.letra}
              onClick={() => setLetra(n.letra)}
            >
              {n.letra}
            </button>
          ))}
        </div>
      )}

      <AlvosReferencia
        key={nota.letra}
        alvos={nota.alvos}
        origem={origem}
        indice={indice}
        onAbrir={onFechar}
      />
    </div>
  )
}
