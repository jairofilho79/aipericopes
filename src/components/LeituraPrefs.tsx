import { useId } from 'react'

import {
  bumpReadingLeading,
  bumpReadingSize,
  FONT_OPTIONS,
  LEADING_STEPS,
  MEASURE_OPTIONS,
  setReadingFont,
  setReadingLayout,
  setReadingMeasure,
  SIZE_STEPS,
  type ReadingLayout,
} from '../lib/reading-prefs'
import { useReadingPrefs } from '../lib/use-reading-prefs'

const LAYOUTS: { id: ReadingLayout; label: string }[] = [
  { id: 'corrido', label: 'Corrido' },
  { id: 'blocos', label: 'Blocos' },
]

/**
 * Os controles de tipografia, sem casca. Autônomo de propósito: lê pelo hook e
 * chama os setters direto, para o Perfil não ter que carregar prefs/onPrefs
 * por dois níveis. Os setters já aplicam, persistem e avisam.
 *
 * Cada ajuste é um grupo com rótulo VISÍVEL, e o nome do grupo sai desse
 * rótulo (`aria-labelledby`) em vez de um `aria-label` que só o leitor de tela
 * via. Antes as cinco fileiras eram botões soltos um debaixo do outro: quem
 * olhava tinha de adivinhar o que "Corrido | Blocos" configurava, e as
 * fileiras de 44px encostadas viravam um paredão sem dono.
 *
 * Os `id` saem de `useId` porque este componente aparece em dois lugares (a
 * página /perfil e o popover "Aa" da Leitura) e um dia podem coexistir.
 */
export default function LeituraPrefs() {
  const prefs = useReadingPrefs()
  const id = useId()

  const rotulo = {
    tamanho: `${id}-tamanho`,
    fonte: `${id}-fonte`,
    disposicao: `${id}-disposicao`,
    entrelinha: `${id}-entrelinha`,
    largura: `${id}-largura`,
  }

  return (
    <>
      <div className="pref-grupo" role="group" aria-labelledby={rotulo.tamanho}>
        <p className="eyebrow" id={rotulo.tamanho}>
          Tamanho do texto
        </p>
        <div className="readmenu-row">
          <button
            type="button"
            className="read-tool"
            disabled={prefs.sizeStep === 0}
            // "A menos" não é o que se quer ouvir; e o símbolo é ilegível
            // soletrado. Único par que continua em símbolo, por ser convenção.
            aria-label="Diminuir texto"
            onClick={() => bumpReadingSize(-1)}
          >
            A−
          </button>
          <button
            type="button"
            className="read-tool"
            disabled={prefs.sizeStep === SIZE_STEPS.length - 1}
            aria-label="Aumentar texto"
            onClick={() => bumpReadingSize(1)}
          >
            A+
          </button>
        </div>
      </div>

      <div className="pref-grupo" role="group" aria-labelledby={rotulo.fonte}>
        <p className="eyebrow" id={rotulo.fonte}>
          Fonte
        </p>
        <div className="readmenu-row">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`read-tool${prefs.font === f.id ? ' active' : ''}`}
              aria-pressed={prefs.font === f.id}
              onClick={() => setReadingFont(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* "Modo do texto bíblico" não dizia o que muda. Corrido junta os
          versículos num parágrafo; blocos dá uma linha a cada um. */}
      <div className="pref-grupo" role="group" aria-labelledby={rotulo.disposicao}>
        <p className="eyebrow" id={rotulo.disposicao}>
          Disposição dos versículos
        </p>
        <div className="readmenu-row">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`read-tool${prefs.layout === l.id ? ' active' : ''}`}
              aria-pressed={prefs.layout === l.id}
              onClick={() => setReadingLayout(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Eram ▼ e ▲, que na tela pareciam ordenação de tabela e no leitor de
          tela dependiam de um aria-label que ninguém via. O rótulo do botão diz
          o que acontece ao tocar, e o do grupo diz sobre o quê. */}
      <div className="pref-grupo" role="group" aria-labelledby={rotulo.entrelinha}>
        <p className="eyebrow" id={rotulo.entrelinha}>
          Espaço entre linhas
        </p>
        <div className="readmenu-row">
          <button
            type="button"
            className="read-tool"
            disabled={prefs.leadingStep === 0}
            onClick={() => bumpReadingLeading(-1)}
          >
            Mais junto
          </button>
          <button
            type="button"
            className="read-tool"
            disabled={prefs.leadingStep === LEADING_STEPS.length - 1}
            onClick={() => bumpReadingLeading(1)}
          >
            Mais solto
          </button>
        </div>
      </div>

      <div className="pref-grupo" role="group" aria-labelledby={rotulo.largura}>
        <p className="eyebrow" id={rotulo.largura}>
          Largura do texto
        </p>
        <div className="readmenu-row">
          {MEASURE_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`read-tool${prefs.measure === m.id ? ' active' : ''}`}
              aria-pressed={prefs.measure === m.id}
              onClick={() => setReadingMeasure(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
