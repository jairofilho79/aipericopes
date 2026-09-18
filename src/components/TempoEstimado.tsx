import { IconeFones, IconeLivroAberto } from './icones'
import { formatarDuracao } from '../lib/reading-time'

export type TempoEstimadoProps = {
  /** Minutos de leitura (number) ou string pré-formatada (ex.: "~5 min", "~2 h") */
  leitura?: number | string | null
  /** Minutos de áudio (number) ou string pré-formatada (ex.: "~7 min", "~3 h") */
  audio?: number | string | null
  /** Tamanho dos ícones em pixels (padrão 13) */
  iconeSize?: number
  /** Se deve ocultar o ícone de leitura (padrão false) */
  semIconeLeitura?: boolean
  /** Se deve ocultar o ícone de áudio (padrão false) */
  semIconeAudio?: boolean
  /** Classe CSS adicional */
  className?: string
}

/**
 * Exibe tempos estimados congruentes de leitura e áudio.
 * Leitura com ícone de livro aberto (IconeLivroAberto).
 * Áudio com ícone de fones de ouvido (IconeFones).
 */
export function TempoEstimado({
  leitura,
  audio,
  iconeSize = 13,
  semIconeLeitura = false,
  semIconeAudio = false,
  className = '',
}: TempoEstimadoProps) {
  const txtLeitura =
    typeof leitura === 'number'
      ? formatarDuracao(leitura)
      : typeof leitura === 'string' && leitura.trim()
        ? leitura.trim()
        : null

  const txtAudio =
    typeof audio === 'number'
      ? formatarDuracao(audio)
      : typeof audio === 'string' && audio.trim()
        ? audio.trim()
        : null

  if (!txtLeitura && !txtAudio) return null

  const descritivo = [
    txtLeitura ? `leitura ${txtLeitura}` : null,
    txtAudio ? `escuta ${txtAudio}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <span
      className={`tempo-estimado ${className}`.trim()}
      aria-label={`Tempo estimado: ${descritivo}`}
    >
      {txtLeitura && (
        <span className="tempo-estimado-item tempo-estimado-leitura" title={`Tempo de leitura: ${txtLeitura}`}>
          {!semIconeLeitura && <IconeLivroAberto size={iconeSize} className="tempo-estimado-icone" />}
          <span className="tempo-estimado-valor">{txtLeitura}</span>
        </span>
      )}
      {txtLeitura && txtAudio && (
        <span className="tempo-estimado-divisor" aria-hidden="true">
          ·
        </span>
      )}
      {txtAudio && (
        <span className="tempo-estimado-item tempo-estimado-audio" title={`Tempo de áudio: ${txtAudio}`}>
          {!semIconeAudio && <IconeFones size={iconeSize} className="tempo-estimado-icone" />}
          <span className="tempo-estimado-valor">{txtAudio}</span>
        </span>
      )}
    </span>
  )
}
