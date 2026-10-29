import { useEffect, useMemo, useState } from 'react'
import { loadIndex } from '../lib/content'
import {
  obterReferenciasDaPericope,
  obterReferenciasDosVersiculos,
  type ReferenciasDoVersiculo,
  type VersiculoRef,
} from '../lib/referencias'
import type { PericopeIndex } from '../lib/types'
import AlvosReferencia from './AlvosReferencia'
import { IconeLivroAberto } from './icones'

type Props = {
  pericope: Pick<
    PericopeIndex,
    'ordem' | 'livro' | 'capitulo_inicio' | 'versiculo_inicio' | 'capitulo_fim' | 'versiculo_fim'
  >
  /** Versículos selecionados na leitura; com eles a aba foca só neles. */
  versiculosFoco?: VersiculoRef[]
  onLimparFoco?: () => void
}

function rotuloDoFoco(livro: string, foco: VersiculoRef[]): string {
  const a = foco[0]
  const b = foco[foco.length - 1]
  if (a.chapter !== b.chapter) return `${livro} ${a.chapter}:${a.verse}–${b.chapter}:${b.verse}`
  return a.verse === b.verse ? `${livro} ${a.chapter}:${a.verse}` : `${livro} ${a.chapter}:${a.verse}–${b.verse}`
}

/**
 * Aba "Referências": as referências cruzadas da ARC da perícope inteira,
 * versículo a versículo, ou só dos versículos selecionados (com a saída "Toda a
 * perícope", como a aba Louvores).
 */
export default function AbaReferencias({ pericope, versiculosFoco, onLimparFoco }: Props) {
  const [grupos, setGrupos] = useState<ReferenciasDoVersiculo[] | null>(null)
  const [indice, setIndice] = useState<PericopeIndex[] | null>(null)
  const temFoco = Boolean(versiculosFoco && versiculosFoco.length > 0)

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
    let ativo = true
    setGrupos(null)
    const busca =
      temFoco && versiculosFoco
        ? obterReferenciasDosVersiculos(pericope.livro, versiculosFoco)
        : obterReferenciasDaPericope(pericope)
    void busca.then((r) => ativo && setGrupos(r))
    return () => {
      ativo = false
    }
    // `pericope` entra por valor nos limites: o objeto muda a cada render do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pericope.ordem, pericope.livro, temFoco, versiculosFoco])

  const total = useMemo(
    () => (grupos ?? []).reduce((s, g) => s + g.notas.reduce((n, nota) => n + nota.alvos.length, 0), 0),
    [grupos],
  )

  const banner = temFoco && versiculosFoco && (
    <div className="louvores-foco-banner">
      <div className="louvores-foco-info">
        <span className="louvores-foco-badge" aria-hidden="true">
          <IconeLivroAberto size={18} />
        </span>
        <div>
          <strong className="louvores-foco-titulo">Referências de {rotuloDoFoco(pericope.livro, versiculosFoco)}</strong>
        </div>
      </div>
      {onLimparFoco && (
        <button
          type="button"
          className="louvores-foco-limpar-btn"
          onClick={onLimparFoco}
          title="Voltar a ver as referências de toda a perícope"
        >
          ✕ Toda a perícope
        </button>
      )}
    </div>
  )

  if (grupos === null) {
    return (
      <div className="refs-painel" aria-busy="true">
        {banner}
        <p className="muted">Carregando referências…</p>
      </div>
    )
  }

  if (grupos.length === 0) {
    return (
      <div className="refs-painel">
        {banner}
        <p className="muted">
          {temFoco ? 'Nenhuma referência cruzada neste trecho.' : 'Nenhuma referência cruzada nesta perícope.'}
        </p>
      </div>
    )
  }

  return (
    <div className="refs-painel">
      {banner}
      {!temFoco && (
        <p className="refs-intro">
          {total} {total === 1 ? 'referência' : 'referências'} cruzadas da ARC em {grupos.length}{' '}
          {grupos.length === 1 ? 'versículo' : 'versículos'}. As letras são as mesmas do texto.
        </p>
      )}
      {grupos.map((g) => {
        const id = `${g.capitulo}:${g.versiculo}`
        return (
          <section key={id} className="refs-verso" aria-label={`${pericope.livro} ${id}`}>
            <h3 className="refs-verso-titulo">
              {pericope.livro} {id}
            </h3>
            {g.notas.map((nota) => (
              <div key={nota.letra} className="refs-nota">
                <span className="refs-letra" aria-label={`Nota ${nota.letra}`}>
                  {nota.letra}
                </span>
                <AlvosReferencia
                  alvos={nota.alvos}
                  origem={{ ordem: pericope.ordem, versiculoId: id }}
                  indice={indice}
                />
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
