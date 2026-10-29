import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { estadoDeSaida, jornadaDoContexto, marcarVersiculoNaUrl } from '../lib/contexto-leitura'
import { resolverAlvo, urlDaReferencia, type AlvoReferencia } from '../lib/referencias'
import { previaDoAlvo, type PreviaDoAlvo } from '../lib/referencias-previa'
import type { PericopeIndex } from '../lib/types'
import { IconeSetaDireita } from './icones'

type Props = {
  alvos: AlvoReferencia[]
  /** Perícope e versículo ("cap:ver") de onde a pessoa saiu — a volta depende disso. */
  origem: { ordem: number; versiculoId: string }
  /** Índice do catálogo; null enquanto carrega (o "Abrir" aparece quando chega). */
  indice: PericopeIndex[] | null
  /** Callback opcional quando o destino é acionado (ex.: fechar o sheet). */
  onAbrir?: () => void
}

type Previa = PreviaDoAlvo | null | 'carregando'

/**
 * A lista de alvos de uma nota: cada um com prévia do texto sob demanda e a
 * porta para a perícope de destino. Serve ao painel da letrinha e à aba
 * Referências.
 */
export default function AlvosReferencia({ alvos, origem, indice, onAbrir }: Props) {
  const [previas, setPrevias] = useState<Record<string, Previa>>({})
  const [searchParams] = useSearchParams()
  const jornadaId = jornadaDoContexto(searchParams)
  // Índice desta entrada de histórico: é por ele que o destino sabe quantos
  // passos voltar (ver contexto-leitura.ts).
  const estado = estadoDeSaida()

  function alternarPrevia(alvo: AlvoReferencia) {
    const chave = alvo.rotulo
    if (previas[chave] !== undefined) {
      setPrevias((p) => {
        const resto = { ...p }
        delete resto[chave]
        return resto
      })
      return
    }
    setPrevias((p) => ({ ...p, [chave]: 'carregando' }))
    void previaDoAlvo(alvo)
      .catch(() => null)
      .then((r) => setPrevias((p) => (chave in p ? { ...p, [chave]: r } : p)))
  }

  function rolarParaVersiculoLocal(versiculoId: string) {
    onAbrir?.()
    const el = document.querySelector<HTMLElement>(`[data-verse-id="${versiculoId}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('retomada-flash')
      window.setTimeout(() => el.classList.remove('retomada-flash'), 2100)
    }
  }

  return (
    <ul className="ref-sheet-lista">
      {alvos.map((alvo) => {
        const previa = previas[alvo.rotulo]
        const aberto = previa !== undefined
        const destino = indice ? resolverAlvo(indice, alvo) : null
        const eMesmaPericope = destino ? destino.pericope.ordem === origem.ordem : false
        return (
          <li key={alvo.rotulo} className="ref-sheet-item">
            <div className="ref-sheet-linha">
              <button
                type="button"
                className="ref-sheet-alvo"
                aria-expanded={aberto}
                onClick={() => alternarPrevia(alvo)}
              >
                {alvo.rotulo}
              </button>
              {destino &&
                (eMesmaPericope ? (
                  <button
                    type="button"
                    className="ref-sheet-abrir"
                    onClick={() => rolarParaVersiculoLocal(destino.versiculoId)}
                    aria-label={`Ver o versículo ${destino.versiculoId}`}
                  >
                    Ver
                    <IconeSetaDireita size={14} />
                  </button>
                ) : (
                  <Link
                    className="ref-sheet-abrir"
                    to={urlDaReferencia({
                      ordem: destino.pericope.ordem,
                      versiculoId: destino.versiculoId,
                      origem,
                      jornadaId,
                    })}
                    state={estado}
                    // Grava o versículo de saída na entrada atual ANTES de navegar:
                    // voltar cai de novo nele, rolado e focado.
                    onClick={() => {
                      marcarVersiculoNaUrl(origem.versiculoId)
                      onAbrir?.()
                    }}
                    aria-label={`Abrir a perícope de ${alvo.rotulo}`}
                  >
                    Abrir
                    <IconeSetaDireita size={14} />
                  </Link>
                ))}
            </div>
            {aberto && (
              <div className="ref-sheet-previa">
                {previa === 'carregando' && <p className="muted">Carregando…</p>}
                {previa === null && <p className="muted">Não foi possível carregar este trecho.</p>}
                {previa && previa !== 'carregando' && previa.versos.length === 0 && (
                  <p className="muted">Trecho não encontrado nesta perícope.</p>
                )}
                {previa &&
                  previa !== 'carregando' &&
                  previa.versos.map((v) => (
                    <p key={v.verso}>
                      <sup className="verse-num">{v.verso}</sup> {v.texto}
                    </p>
                  ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
