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
 */
export default function LeituraPrefs() {
  const prefs = useReadingPrefs()

  return (
    <>
      <div className="readmenu-row" role="group" aria-label="Tamanho do texto">
        <button
          type="button"
          className="read-tool"
          disabled={prefs.sizeStep === 0}
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
      <div className="readmenu-row" role="group" aria-label="Fonte">
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
      <div className="readmenu-row" role="group" aria-label="Modo do texto bíblico">
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
      <div className="readmenu-row" role="group" aria-label="Espaçamento entre linhas">
        <button
          type="button"
          className="read-tool"
          disabled={prefs.leadingStep === 0}
          aria-label="Diminuir espaçamento"
          onClick={() => bumpReadingLeading(-1)}
        >
          ▼
        </button>
        <button
          type="button"
          className="read-tool"
          disabled={prefs.leadingStep === LEADING_STEPS.length - 1}
          aria-label="Aumentar espaçamento"
          onClick={() => bumpReadingLeading(1)}
        >
          ▲
        </button>
      </div>
      <div className="readmenu-row" role="group" aria-label="Largura do texto">
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
    </>
  )
}
