import { useEffect, useRef } from 'react'
import type { DestaqueCor } from '../lib/types'

const CORES: { id: DestaqueCor; label: string }[] = [
  { id: 'verde', label: 'Verde' },
  { id: 'azul', label: 'Azul' },
  { id: 'rosa', label: 'Rosa' },
]

type Props = {
  label: string
  temDestaque: boolean
  // Cor compartilhada por TODA a seleção; null quando não há destaque ou a
  // seleção mistura cores — nenhum swatch aparece pressionado nesse caso.
  corAtual: DestaqueCor | null
  aviso: string
  onCopiar: () => void
  onCompartilhar: () => void
  onDestacar: (cor: DestaqueCor) => void
  onRemoverDestaque: () => void
  onAnotar: () => void
  onFechar: () => void
}

export default function VerseActions({
  label,
  temDestaque,
  corAtual,
  aviso,
  onCopiar,
  onCompartilhar,
  onDestacar,
  onRemoverDestaque,
  onAnotar,
  onFechar,
}: Props) {
  const caixaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  // Foco entra na barra ao abrir e volta para o versículo ao fechar. Sem isso
  // a barra se anuncia como `role="dialog"` mas deixa o foco lá fora: quem usa
  // teclado ou leitor de tela precisaria tabular a página inteira para chegar
  // nos botões, e ao fechar perderia o lugar na leitura.
  //
  // O foco vai para a caixa (que tem aria-label), não para o primeiro botão:
  // assim o leitor de tela anuncia de quais versículos são estas ações antes
  // de ler a primeira opção.
  useEffect(() => {
    // O versículo é um <button>, então é ele que está com o foco aqui.
    const anterior = document.activeElement
    caixaRef.current?.focus()
    return () => {
      // `isConnected` porque a barra também fecha ao trocar de perícope, e aí
      // o versículo de origem já saiu da página.
      if (anterior instanceof HTMLElement && anterior.isConnected) {
        anterior.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <div
      className="verse-actions"
      role="dialog"
      aria-label={`Ações para ${label}`}
      ref={caixaRef}
      tabIndex={-1}
    >
      <div className="verse-actions-head">
        <strong className="verse-actions-ref">{label}</strong>
        <button type="button" className="linkish" onClick={onFechar}>
          Fechar
        </button>
      </div>
      <div className="verse-actions-row">
        <button type="button" className="ghost" onClick={onCopiar}>
          Copiar
        </button>
        <button type="button" className="ghost" onClick={onCompartilhar}>
          Compartilhar
        </button>
        <button type="button" className="ghost" onClick={onAnotar}>
          Anotar
        </button>
      </div>
      <div className="verse-actions-row" role="group" aria-label="Destacar">
        {CORES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`hl-swatch hl-${c.id}`}
            aria-label={`Destacar em ${c.label.toLowerCase()}`}
            aria-pressed={corAtual === c.id}
            onClick={() => onDestacar(c.id)}
          />
        ))}
        {temDestaque && (
          <button type="button" className="linkish" onClick={onRemoverDestaque}>
            Remover
          </button>
        )}
      </div>
      <p className="verse-actions-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  )
}
