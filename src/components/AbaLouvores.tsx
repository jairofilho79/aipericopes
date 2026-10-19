import { useEffect, useMemo, useState } from 'react'
import type { Pericope } from '../lib/types'
import {
  obterLouvoresDaPericope,
  obterLouvoresDosVersiculos,
  type LouvorRecomendado,
} from '../lib/louvores'
import { IconeLinkExterno, IconeNotaMusical } from './icones'

type Props = {
  pericope: Pericope | { ordem: number; livro?: string }
  versiculosFoco?: Array<{ id: string; chapter: number; verse: number; text: string }>
  onLimparVersiculosFoco?: () => void
}

type FiltroTipo = 'geral' | 'biblico' | 'tematico'

function formatarNumeroLouvor(rawNumber: string): { texto: string; ehSn: boolean } {
  const limpo = (rawNumber ?? '').trim()
  if (!limpo || limpo.toUpperCase() === 'S/N' || limpo.toUpperCase() === 'SN') {
    return { texto: 'S/N', ehSn: true }
  }
  return { texto: `Nº ${limpo}`, ehSn: false }
}

function formatarAfinidade(similarity: number, complemento?: string, ehCitacao?: boolean): string {
  if (ehCitacao) return '100% Citação'
  const valor = typeof similarity === 'number' && !Number.isNaN(similarity) ? similarity.toFixed(1) : similarity
  return complemento ? `${valor}% ${complemento}` : `${valor}% de afinidade`
}

export default function AbaLouvores({ pericope, versiculosFoco, onLimparVersiculosFoco }: Props) {
  const [louvores, setLouvores] = useState<LouvorRecomendado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroTipo>('geral')

  const labelFoco = useMemo(() => {
    if (!versiculosFoco || versiculosFoco.length === 0) return ''
    const livro = 'livro' in pericope && pericope.livro ? pericope.livro : ''
    const v0 = versiculosFoco[0]
    const vLast = versiculosFoco[versiculosFoco.length - 1]
    if (v0.chapter === vLast.chapter) {
      const vStr = v0.verse === vLast.verse ? `${v0.verse}` : `${v0.verse}–${vLast.verse}`
      return livro ? `${livro} ${v0.chapter}:${vStr}` : `Cap. ${v0.chapter}:${vStr}`
    }
    return livro
      ? `${livro} ${v0.chapter}:${v0.verse}–${vLast.chapter}:${vLast.verse}`
      : `${v0.chapter}:${v0.verse}–${vLast.chapter}:${vLast.verse}`
  }, [pericope, versiculosFoco])

  const temFoco = Boolean(versiculosFoco && versiculosFoco.length > 0)

  useEffect(() => {
    let ativo = true
    setCarregando(true)

    const livro = 'livro' in pericope && pericope.livro ? pericope.livro : ''

    if (versiculosFoco && versiculosFoco.length > 0 && livro) {
      obterLouvoresDosVersiculos(
        livro,
        versiculosFoco.map((v) => ({ chapter: v.chapter, verse: v.verse })),
      ).then((itens) => {
        if (ativo) {
          setLouvores(itens)
          setCarregando(false)
        }
      })
    } else {
      obterLouvoresDaPericope(pericope.ordem).then((itens) => {
        if (ativo) {
          setLouvores(itens)
          setCarregando(false)
        }
      })
    }

    return () => {
      ativo = false
    }
  }, [pericope.ordem, 'livro' in pericope ? pericope.livro : '', versiculosFoco])

  const louvoresOrdenados = useMemo(() => {
    const lista = [...louvores]
    if (filtro === 'biblico') {
      return lista.sort(
        (a, b) => (b.similarityBiblico ?? b.similarity) - (a.similarityBiblico ?? a.similarity),
      )
    }
    if (filtro === 'tematico') {
      return lista.sort(
        (a, b) => {
          const scoreB = b.similarityHomiletico ?? b.similarityTematico ?? b.similarity
          const scoreA = a.similarityHomiletico ?? a.similarityTematico ?? a.similarity
          return scoreB - scoreA
        },
      )
    }
    return lista.sort((a, b) => b.similarity - a.similarity)
  }, [louvores, filtro])

  if (carregando) {
    return (
      <div className="louvores-painel" aria-busy="true">
        {temFoco && (
          <div className="louvores-foco-banner">
            <div className="louvores-foco-info">
              <span className="louvores-foco-badge" aria-hidden="true">
                <IconeNotaMusical size={18} />
              </span>
              <div>
                <strong className="louvores-foco-titulo">Louvores para {labelFoco}</strong>
                <span className="louvores-foco-sub">Buscando sugestões para o trecho…</span>
              </div>
            </div>
          </div>
        )}
        <p className="muted">Carregando louvores recomendados…</p>
      </div>
    )
  }

  if (louvores.length === 0) {
    return (
      <div className="louvores-painel">
        {temFoco && (
          <div className="louvores-foco-banner">
            <div className="louvores-foco-info">
              <span className="louvores-foco-badge" aria-hidden="true">
                <IconeNotaMusical size={18} />
              </span>
              <div>
                <strong className="louvores-foco-titulo">Louvores para {labelFoco}</strong>
                <span className="louvores-foco-sub">Sugestões específicas para os versículos selecionados</span>
              </div>
            </div>
            {onLimparVersiculosFoco && (
              <button
                type="button"
                className="louvores-foco-limpar-btn"
                onClick={onLimparVersiculosFoco}
              >
                ✕ Toda a perícope
              </button>
            )}
          </div>
        )}
        <p className="muted">
          {temFoco
            ? 'Nenhum louvor associado diretamente a este trecho.'
            : 'Nenhum louvor associado a esta perícope.'}
        </p>
      </div>
    )
  }

  const temScoresEspecificos = louvores.some(
    (l) => l.similarityBiblico !== undefined || l.similarityTematico !== undefined,
  )

  return (
    <div className="louvores-painel">
      <header className="louvores-cabecalho">
        {temFoco ? (
          <div className="louvores-foco-banner">
            <div className="louvores-foco-info">
              <span className="louvores-foco-badge" aria-hidden="true">
                <IconeNotaMusical size={18} />
              </span>
              <div>
                <strong className="louvores-foco-titulo">Louvores para {labelFoco}</strong>
                <span className="louvores-foco-sub">
                  Sugestões cirúrgicas focadas exclusivamente no trecho selecionado.
                </span>
              </div>
            </div>
            {onLimparVersiculosFoco && (
              <button
                type="button"
                className="louvores-foco-limpar-btn"
                onClick={onLimparVersiculosFoco}
                title="Voltar a ver louvores de toda a perícope"
              >
                ✕ Toda a perícope
              </button>
            )}
          </div>
        ) : (
          <p className="louvores-intro">
            Louvores recomendados por afinidade semântica com esta perícope no acervo Coldigom.
          </p>
        )}

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
                ? (louvor.similarityHomiletico ?? louvor.similarityTematico ?? louvor.similarity)
                : louvor.similarity

          const complemento =
            filtro === 'biblico' ? 'bíblico' : filtro === 'tematico' ? 'homilético' : 'de afinidade'

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
                      className={`louvor-badge-tipo${louvor.matchTipo === 'citacao_direta' ? ' louvor-badge-tipo--citacao' : ''}`}
                      title={
                        louvor.matchTipo === 'citacao_direta'
                          ? `Citação bíblica (${louvor.citacaoBiblica ?? ''})`
                          : louvor.matchTipo === 'biblico'
                            ? `Maior afinidade no texto bíblico (${louvor.similarityBiblico ?? ''}%)`
                            : louvor.matchTipo === 'tematico'
                              ? `Maior afinidade temática e homilética (${louvor.similarityHomiletico ?? louvor.similarityTematico ?? ''}%)`
                              : 'Afinidade equilibrada entre texto e estudo'
                      }
                    >
                      {louvor.matchTipo === 'citacao_direta'
                        ? 'Citação Direta'
                        : louvor.matchTipo === 'biblico'
                          ? 'Texto'
                          : louvor.matchTipo === 'tematico'
                            ? 'Estudo'
                            : 'Equilibrado'}
                    </span>
                  )}

                  <span
                    className={`louvor-badge-afinidade${louvor.matchTipo === 'citacao_direta' ? ' louvor-badge-afinidade--citacao' : ''}`}
                    title={
                      louvor.matchTipo === 'citacao_direta'
                        ? `Citação literal de ${louvor.citacaoBiblica ?? 'passagem'}`
                        : `Similaridade com Gemma Embedding 2: ${scoreExibido}%`
                    }
                  >
                    {formatarAfinidade(scoreExibido, complemento, louvor.matchTipo === 'citacao_direta')}
                  </span>
                </div>
              </div>

              <h4 className="louvor-titulo">{louvor.name}</h4>

              {louvor.mensagemCentral && (
                <p className="louvor-mensagem-central" title="Síntese teológica e mensagem homilética">
                  <span className="louvor-mensagem-icone" aria-hidden="true">💡</span>
                  <span>{louvor.mensagemCentral}</span>
                </p>
              )}

              <div className="louvor-meta">
                {louvor.citacaoBiblica && (
                  <span
                    className="louvor-tag louvor-tag--citacao"
                    title={`Passagem citada textualmente: ${louvor.citacaoBiblica}`}
                  >
                    📖 {louvor.citacaoBiblica}
                  </span>
                )}
                {louvor.temasHomileticos && louvor.temasHomileticos.map((th) => (
                  <span
                    key={th}
                    className="louvor-tag louvor-tag--homiletico"
                    title={`Tema homilético de pregação: ${th}`}
                  >
                    🎯 {th}
                  </span>
                ))}
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
