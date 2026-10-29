import { useEffect, useRef, useState } from 'react'
import type { DestaqueCor } from '../lib/types'
import {
  IconeAnotar,
  IconeCompartilhar,
  IconeCopiar,
  IconeFaisca,
  IconeFechar,
  IconeLivroAberto,
  IconeLixeira,
  IconeNotaMusical,
  IconeRaio,
} from './icones'

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
  temChaveIa?: boolean
  logado?: boolean
  onCopiar: () => void
  onCompartilhar: () => void
  onDestacar: (cor: DestaqueCor) => void
  onRemoverDestaque: () => void
  onAnotar: () => void
  onVerLouvores?: () => void
  qtdLouvoresDiretos?: number
  /** Só vem quando os versículos têm referências cruzadas: sem elas o botão não aparece. */
  onVerReferencias?: () => void
  qtdReferencias?: number
  onExplicarIa?: () => void
  onPerguntarIa?: () => void
  onAtivarIa?: () => void
  onFechar: () => void
}

export default function VerseActions({
  label,
  temDestaque,
  corAtual,
  aviso,
  temChaveIa = false,
  logado = false,
  onCopiar,
  onCompartilhar,
  onDestacar,
  onRemoverDestaque,
  onAnotar,
  onVerLouvores,
  qtdLouvoresDiretos = 0,
  onVerReferencias,
  qtdReferencias = 0,
  onExplicarIa,
  onPerguntarIa,
  onAtivarIa,
  onFechar,
}: Props) {
  const [iaAberta, setIaAberta] = useState(false)
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
          <IconeFechar size={15} />
          Fechar
        </button>
      </div>
      <div className="verse-actions-row">
        <button type="button" className="ghost" onClick={onCopiar}>
          <IconeCopiar size={17} />
          Copiar
        </button>
        <button type="button" className="ghost" onClick={onCompartilhar}>
          <IconeCompartilhar size={17} />
          Compartilhar
        </button>
        <button type="button" className="ghost" onClick={onAnotar}>
          <IconeAnotar size={17} />
          Anotar
        </button>
        {onVerReferencias && (
          <button
            type="button"
            className="ghost btn-refs-chip"
            onClick={onVerReferencias}
            title={`${qtdReferencias} ${qtdReferencias === 1 ? 'nota' : 'notas'} de referência cruzada para este trecho`}
          >
            <IconeLivroAberto size={16} />
            <span>Refs{qtdReferencias > 0 ? ` (${qtdReferencias})` : ''}</span>
          </button>
        )}
        {onVerLouvores && (
          <button
            type="button"
            className={`ghost btn-louvores-chip${qtdLouvoresDiretos > 0 ? ' tem-direto' : ''}`}
            onClick={onVerLouvores}
            title={
              qtdLouvoresDiretos > 0
                ? `${qtdLouvoresDiretos} louvor(es) com citação bíblica direta para este trecho`
                : 'Ver louvores sugeridos para os versículos selecionados'
            }
          >
            <IconeNotaMusical size={16} />
            <span>Louvores{qtdLouvoresDiretos > 0 ? ` (${qtdLouvoresDiretos})` : ''}</span>
          </button>
        )}
        {(!logado || !temChaveIa) && onAtivarIa && (
          <button
            type="button"
            className="ghost btn-ia-chip"
            onClick={onAtivarIa}
            title="Estudar com inteligência artificial"
          >
            <IconeFaisca size={16} />
            Conversar
          </button>
        )}
        {logado && temChaveIa && (
          <button
            type="button"
            className={`ghost btn-ia-chip${iaAberta ? ' selecionado' : ''}`}
            onClick={() => setIaAberta((v) => !v)}
            aria-expanded={iaAberta}
            title="Opções de estudo com inteligência artificial"
          >
            <IconeFaisca size={16} />
            Conversar
          </button>
        )}
      </div>
      {logado && temChaveIa && iaAberta && (
        <div className="verse-actions-row verse-actions-ia-sub">
          {onExplicarIa && (
            <button type="button" className="ghost" onClick={onExplicarIa}>
              <IconeRaio size={16} />
              Explicação rápida
            </button>
          )}
          {onPerguntarIa && (
            <button type="button" className="ghost" onClick={onPerguntarIa}>
              <IconeFaisca size={16} />
              Conversar
            </button>
          )}
        </div>
      )}
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
            <IconeLixeira size={15} />
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
