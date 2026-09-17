import { useState } from 'react'
import { itemDeIndice } from '../lib/item-pericope'
import { agruparPorLivro, type Registro, type RegistroProgresso } from '../lib/registros'
import type { PericopeIndex } from '../lib/types'
import { IconeTrocar } from './icones'
import ListaPericopes from './ListaPericopes'

/** Tamanho da página do "Ver mais": fixo, não deriva do total do registro. */
const PAGINA = 100

export default function RegistroAberto({
  registro,
  prog,
  itens,
  concluidas,
  onTrocar,
  jornadaId,
}: {
  registro: Registro
  /** Progresso REAL do registro — nunca obedece ao recorte de leitura. */
  prog: RegistroProgresso | undefined
  /** Já filtradas pelo recorte, já na ordem de leitura. */
  itens: PericopeIndex[]
  concluidas: Set<number>
  onTrocar: () => void
  jornadaId?: string
}) {
  const [visiveis, setVisiveis] = useState(PAGINA)
  // Mesmo padrão de LivroAberto.tsx:36-42 — ajustar estado no render, não
  // por efeito: sem isso, trocar de registro herdaria o "Ver mais" aberto do
  // registro anterior por um frame (ou para sempre, se o consumidor esquecer
  // a `key`). A invariante é do componente, não de quem o usa.
  const [registroAnterior, setRegistroAnterior] = useState(registro)
  if (registro !== registroAnterior) {
    setRegistroAnterior(registro)
    setVisiveis(PAGINA)
  }

  // O corte é sobre a lista ACHATADA — só depois de fatiar é que se agrupa
  // por livro, senão "as primeiras 100" viraria "as primeiras 100 de cada
  // livro" (contrato do registros.ts).
  const fatia = itens.slice(0, visiveis)
  const grupos = agruparPorLivro(fatia)
  const restam = itens.length - fatia.length

  return (
    <>
      <div className="ref-sticky">
        <div className="selected-book">
          <div className="selected-book-meta">
            <span className="selected-book-name">{registro.nome}</span>
          </div>
          {/* A barra é do registro INTEIRO, nunca do recorte: com "não
              lidos" ativo uma barra filtrada estaria sempre em zero — mesma
              invariante que LivroAberto documenta para o livro. */}
          <span className="book-progress-wrap">
            <span className="book-progress" aria-hidden>
              <span
                className="book-progress-fill"
                style={{ width: `${prog?.pct ?? 0}%` }}
              />
            </span>
            <span className="book-progress-label">
              {prog?.concluidas ?? 0} de {prog?.total ?? 0}
            </span>
          </span>
          <button type="button" className="ghost trocar-livro" onClick={onTrocar}>
            <IconeTrocar size={16} />
            <span>Trocar registro</span>
          </button>
        </div>
      </div>

      {fatia.length === 0 ? (
        <p className="muted">Nenhuma perícope deste registro sobrevive ao recorte.</p>
      ) : (
        grupos.map((g) => (
          // Chave pela primeira `ordem` do trecho, não pelo nome do livro: o
          // mesmo livro pode reaparecer em dois trechos separados do
          // registro (agruparPorLivro documenta), e reusar o nome como chave
          // colidiria os dois cabeçalhos.
          <div key={g.itens[0].ordem}>
            <div className="book-group-head">
              <h2>{g.livro}</h2>
            </div>
            <ListaPericopes
              itens={g.itens.map(itemDeIndice)}
              concluidas={concluidas}
              jornadaId={jornadaId}
            />
          </div>
        ))
      )}

      {/* Com a lista vazia a frase acima já disse tudo; "0 à mostra de 0" só
          repetiria o vazio com um número. */}
      <p className="peri-count" hidden={itens.length === 0}>
        {fatia.length} à mostra de {itens.length}
        {restam > 0 && (
          <>
            {' · '}
            <button
              type="button"
              className="linkish"
              onClick={() => setVisiveis((v) => v + PAGINA)}
            >
              Ver mais {PAGINA}
            </button>
          </>
        )}
      </p>
    </>
  )
}
