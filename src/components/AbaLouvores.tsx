import { useEffect, useMemo, useState } from 'react'
import type { Pericope } from '../lib/types'
import { obterLouvoresDaPericope, type LouvorRecomendado } from '../lib/louvores'
import { IconeLinkExterno } from './icones'

type Props = {
  pericope: Pericope | { ordem: number }
}

type FiltroTipo = 'geral' | 'biblico' | 'tematico'

function formatarNumeroLouvor(rawNumber: string): { texto: string; ehSn: boolean } {
  const limpo = (rawNumber ?? '').trim()
  if (!limpo || limpo.toUpperCase() === 'S/N' || limpo.toUpperCase() === 'SN') {
    return { texto: 'S/N', ehSn: true }
  }
  return { texto: `Nº ${limpo}`, ehSn: false }
}

function formatarAfinidade(similarity: number, complemento?: string): string {
  const valor = typeof similarity === 'number' && !Number.isNaN(similarity) ? similarity.toFixed(1) : similarity
  return complemento ? `${valor}% ${complemento}` : `${valor}% de afinidade`
}

export default function AbaLouvores({ pericope }: Props) {
  const [louvores, setLouvores] = useState<LouvorRecomendado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroTipo>('geral')

  useEffect(() => {
    let ativo = true
    setCarregando(true)

    obterLouvoresDaPericope(pericope.ordem).then((itens) => {
      if (ativo) {
        setLouvores(itens)
        setCarregando(false)
      }
    })

    return () => {
      ativo = false
    }
  }, [pericope.ordem])

  const louvoresOrdenados = useMemo(() => {
    const lista = [...louvores]
    if (filtro === 'biblico') {
      return lista.sort(
        (a, b) => (b.similarityBiblico ?? b.similarity) - (a.similarityBiblico ?? a.similarity),
      )
    }
    if (filtro === 'tematico') {
      return lista.sort(
        (a, b) => (b.similarityTematico ?? b.similarity) - (a.similarityTematico ?? a.similarity),
      )
    }
    return lista.sort((a, b) => b.similarity - a.similarity)
  }, [louvores, filtro])

  if (carregando) {
    return (
      <div className="louvores-painel" aria-busy="true">
        <p className="muted">Carregando louvores recomendados…</p>
      </div>
    )
  }

  if (louvores.length === 0) {
    return (
      <div className="louvores-painel">
        <p className="muted">Nenhum louvor associado a esta perícope.</p>
      </div>
    )
  }

  const temScoresEspecificos = louvores.some(
    (l) => l.similarityBiblico !== undefined || l.similarityTematico !== undefined,
  )

  return (
    <div className="louvores-painel">
      <header className="louvores-cabecalho">
        <p className="louvores-intro">
          Louvores recomendados por afinidade semântica com esta perícope no acervo Coldigom.
        </p>

        {temScoresEspecificos && (
          <div className="louvores-filtros" role="group" aria-label="Modo de afinidade">
            <button
              type="button"
              className={`louvores-filtro-btn${filtro === 'geral' ? ' active' : ''}`}
              onClick={() => setFiltro('geral')}
            >
              Geral (Combinado)
            </button>
            <button
              type="button"
              className={`louvores-filtro-btn${filtro === 'biblico' ? ' active' : ''}`}
              onClick={() => setFiltro('biblico')}
            >
              Só Texto Bíblico
            </button>
            <button
              type="button"
              className={`louvores-filtro-btn${filtro === 'tematico' ? ' active' : ''}`}
              onClick={() => setFiltro('tematico')}
            >
              Temático (Estudo)
            </button>
          </div>
        )}
      </header>

      <ul className="louvores-lista" aria-label="Louvores recomendados">
        {louvoresOrdenados.map((louvor) => {
          const { texto: numTexto, ehSn } = formatarNumeroLouvor(louvor.number)
          const tags = louvor.tags
            ? louvor.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : []

          const scoreExibido =
            filtro === 'biblico'
              ? (louvor.similarityBiblico ?? louvor.similarity)
              : filtro === 'tematico'
                ? (louvor.similarityTematico ?? louvor.similarity)
                : louvor.similarity

          const complemento =
            filtro === 'biblico' ? 'bíblico' : filtro === 'tematico' ? 'temático' : 'de afinidade'

          return (
            <li key={louvor.id} className="louvor-card">
              <div className="louvor-card-topo">
                <span
                  className={`louvor-badge-numero${ehSn ? ' louvor-badge-numero--sn' : ''}`}
                  title={ehSn ? 'Louvor sem número' : `Louvor ${numTexto}`}
                >
                  {numTexto}
                </span>

                <div className="louvor-card-badges-direita">
                  {filtro === 'geral' && louvor.matchTipo && (
                    <span
                      className="louvor-badge-tipo"
                      title={
                        louvor.matchTipo === 'biblico'
                          ? `Maior afinidade no texto bíblico (${louvor.similarityBiblico ?? ''}%)`
                          : louvor.matchTipo === 'tematico'
                            ? `Maior afinidade no contexto e resenha (${louvor.similarityTematico ?? ''}%)`
                            : 'Afinidade equilibrada entre texto e estudo'
                      }
                    >
                      {louvor.matchTipo === 'biblico'
                        ? 'Texto'
                        : louvor.matchTipo === 'tematico'
                          ? 'Estudo'
                          : 'Equilibrado'}
                    </span>
                  )}

                  <span
                    className="louvor-badge-afinidade"
                    title={`Similaridade com Gemma Embedding 2: ${scoreExibido}%`}
                  >
                    {formatarAfinidade(scoreExibido, complemento)}
                  </span>
                </div>
              </div>

              <h4 className="louvor-titulo">{louvor.name}</h4>

              <div className="louvor-meta">
                {louvor.category && (
                  <span className="louvor-categoria" title={`Categoria: ${louvor.category}`}>
                    {louvor.category}
                  </span>
                )}
                {tags.map((tag) => (
                  <span key={tag} className="louvor-tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="louvor-card-acoes">
                <a
                  href={`https://v2.plpcg.com/louvor/${louvor.shortId || louvor.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="louvor-link-externo"
                  aria-label={`Abrir ${louvor.name} no PLPCG (abre em nova aba)`}
                >
                  <span>Abrir no PLPCG</span>
                  <IconeLinkExterno size={14} />
                </a>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
