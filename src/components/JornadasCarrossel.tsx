import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconeBussola, IconeFones, IconeLivroAberto, IconeOlho } from './icones'
import { TempoEstimado } from './TempoEstimado'
import { refLabel } from '../lib/content'
import type { Jornada, PericopeIndex } from '../lib/types'
import type { ProgressoJornada } from '../lib/jornadas'

export type CardJornadaItem = {
  jornada: Jornada
  prog: ProgressoJornada
  periAtual: PericopeIndex | null
}

export function JornadasCarrossel({ itens }: { itens: CardJornadaItem[] }) {
  const carrosselRef = useRef<HTMLDivElement>(null)
  const [slideAtivo, setSlideAtivo] = useState(0)
  const totalSlides = itens.length + 1 // jornadas ativas + card "+ Nova jornada"

  useEffect(() => {
    const el = carrosselRef.current
    if (!el) return
    const handleScroll = () => {
      const scrollLeft = el.scrollLeft
      const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : 1
      const index = Math.round(scrollLeft / cardWidth)
      setSlideAtivo(Math.min(Math.max(0, index), totalSlides - 1))
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [totalSlides])

  const scrollToSlide = (idx: number) => {
    const el = carrosselRef.current
    if (!el) return
    const card = el.children[idx] as HTMLElement
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }
  }

  return (
    <div className="jornadas-carrossel-wrapper">
      <div className="jornadas-carrossel" ref={carrosselRef}>
        {itens.map((item) => {
          const { jornada, prog, periAtual } = item
          const concluida = jornada.concluidaEm !== null
          return (
            <article key={jornada.id} className="jornada-card jornada-slide">
              <div className="jornada-card-header">
                <span className="track-label">Sua jornada</span>
                {concluida && <span className="jornada-concluida-badge">✓ Concluída</span>}
              </div>
              <h2>{jornada.nome}</h2>

              <span className="book-progress" aria-hidden>
                <span className="book-progress-fill" style={{ width: `${prog.pct}%` }} />
              </span>
              <p className="track-progress">
                {prog.concluidas} de {prog.total}
                {prog.proximaOrdem === null ? ' · concluída' : ''}
              </p>

              {periAtual ? (
                <>
                  <p className="ref">
                    <span>{refLabel(periAtual)}</span>
                    <span className="ref-sep">·</span>
                    <TempoEstimado leitura={periAtual.minutos} audio={periAtual.audio_minutos} />
                  </p>
                  <p className="jornada-peri-titulo">{periAtual.titulo_pericope_pt}</p>
                  <div className="card-acoes">
                    <Link
                      className="cta"
                      to={`/leitura/${periAtual.ordem}?jornadaId=${jornada.id}`}
                    >
                      <IconeLivroAberto />
                      {prog.concluidas === 0 ? 'Começar' : 'Continuar'}
                    </Link>
                    {periAtual.narrado && (
                      <Link
                        className="ouvir-botao"
                        to={`/leitura/${periAtual.ordem}?ouvir=1&jornadaId=${jornada.id}`}
                        aria-label={`Ouvir ${periAtual.titulo_pericope_pt}`}
                        title="Ouvir"
                      >
                        <IconeFones size={18} />
                        <span>Ouvir</span>
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <div className="jornada-concluida-acoes">
                  <p className="muted">Jornada concluída!</p>
                  <Link className="cta" to="/jornada">
                    <IconeOlho />
                    Ver jornada
                  </Link>
                </div>
              )}
            </article>
          )
        })}

        {/* Card final para Criar Nova Jornada */}
        <article className="jornada-card jornada-slide jornada-card-novo">
          <div className="jornada-novo-content">
            <span className="jornada-novo-icone" aria-hidden>+</span>
            <h3>Nova jornada</h3>
            <p className="muted">Inicie outro percurso de leitura na Bíblia.</p>
            <Link className="cta cta-secundario" to="/jornada?nova=1">
              <IconeBussola />
              Escolher percurso
            </Link>
          </div>
        </article>
      </div>

      {/* Indicadores (Dots) */}
      <div className="jornadas-dots" role="tablist" aria-label="Navegação das jornadas">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            role="tab"
            aria-selected={slideAtivo === idx}
            aria-label={`Ir para slide ${idx + 1}`}
            className={`jornadas-dot ${slideAtivo === idx ? 'ativo' : ''}`}
            onClick={() => scrollToSlide(idx)}
          />
        ))}
      </div>
    </div>
  )
}
