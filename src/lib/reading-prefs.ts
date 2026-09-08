const KEY = 'pericopes-reading'

export type ReadingFont = 'serif' | 'literata' | 'sans'

export type ReadingLayout = 'corrido' | 'blocos'

export type ReadingMeasure = 'estreita' | 'media' | 'larga'

export type ReadingPrefs = {
  sizeStep: number
  font: ReadingFont
  layout: ReadingLayout
  leadingStep: number
  measure: ReadingMeasure
}

/** rem steps for biblical + prose text */
export const SIZE_STEPS = [0.95, 1.05, 1.15, 1.28, 1.42, 1.58] as const

/** entrelinha da prosa de leitura; ESPELHADO no script inline do index.html */
export const LEADING_STEPS = [1.5, 1.65, 1.8, 1.95] as const

/** largura de medida do conteúdo de leitura; ESPELHADO no index.html */
export const MEASURE_OPTIONS: { id: ReadingMeasure; label: string; width: string }[] = [
  { id: 'estreita', label: 'Estreita', width: '32rem' },
  { id: 'media', label: 'Média', width: '38rem' },
  { id: 'larga', label: 'Larga', width: '46rem' },
]

export const FONT_OPTIONS: { id: ReadingFont; label: string; stack: string }[] = [
  { id: 'serif', label: 'Serif', stack: "'Source Serif 4 Variable', Georgia, serif" },
  { id: 'literata', label: 'Literata', stack: "'Literata Variable', Georgia, serif" },
  { id: 'sans', label: 'Sans', stack: "'Source Sans 3 Variable', 'DM Sans Variable', system-ui, sans-serif" },
]

const DEFAULTS: ReadingPrefs = {
  sizeStep: 2,
  font: 'serif',
  layout: 'corrido',
  leadingStep: 1,
  measure: 'media',
}

export function getReadingPrefs(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>
    const sizeStep =
      typeof parsed.sizeStep === 'number' && parsed.sizeStep >= 0 && parsed.sizeStep < SIZE_STEPS.length
        ? parsed.sizeStep
        : DEFAULTS.sizeStep
    const font = FONT_OPTIONS.some((f) => f.id === parsed.font) ? (parsed.font as ReadingFont) : DEFAULTS.font
    const layout: ReadingLayout = parsed.layout === 'blocos' ? 'blocos' : 'corrido'
    // Prefs gravadas antes deste pacote não têm os campos novos: caem no padrão.
    const leadingStep =
      typeof parsed.leadingStep === 'number' &&
      parsed.leadingStep >= 0 &&
      parsed.leadingStep < LEADING_STEPS.length
        ? parsed.leadingStep
        : DEFAULTS.leadingStep
    const measure = MEASURE_OPTIONS.some((m) => m.id === parsed.measure)
      ? (parsed.measure as ReadingMeasure)
      : DEFAULTS.measure
    return { sizeStep, font, layout, leadingStep, measure }
  } catch {
    return { ...DEFAULTS }
  }
}

export function applyReadingPrefs(prefs: ReadingPrefs) {
  const root = document.documentElement
  root.style.setProperty('--read-size', `${SIZE_STEPS[prefs.sizeStep]}rem`)
  const stack = FONT_OPTIONS.find((f) => f.id === prefs.font)?.stack ?? FONT_OPTIONS[0].stack
  root.style.setProperty('--read-font', stack)
  root.style.setProperty('--read-leading', String(LEADING_STEPS[prefs.leadingStep]))
  const width = MEASURE_OPTIONS.find((m) => m.id === prefs.measure)?.width ?? MEASURE_OPTIONS[1].width
  root.style.setProperty('--read-measure', width)
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
  alvo.dispatchEvent(new Event(PREFS_EVENT))
}

export function setReadingSizeStep(step: number): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.sizeStep = Math.max(0, Math.min(SIZE_STEPS.length - 1, step))
  applyReadingPrefs(prefs)
  return prefs
}

export function bumpReadingSize(delta: number): ReadingPrefs {
  return setReadingSizeStep(getReadingPrefs().sizeStep + delta)
}

export function setReadingFont(font: ReadingFont): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.font = font
  applyReadingPrefs(prefs)
  return prefs
}

export function setReadingLayout(layout: ReadingLayout): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.layout = layout
  applyReadingPrefs(prefs)
  return prefs
}

export function setReadingLeadingStep(step: number): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.leadingStep = Math.max(0, Math.min(LEADING_STEPS.length - 1, step))
  applyReadingPrefs(prefs)
  return prefs
}

export function bumpReadingLeading(delta: number): ReadingPrefs {
  return setReadingLeadingStep(getReadingPrefs().leadingStep + delta)
}

export function setReadingMeasure(measure: ReadingMeasure): ReadingPrefs {
  const prefs = getReadingPrefs()
  prefs.measure = measure
  applyReadingPrefs(prefs)
  return prefs
}

/**
 * Aviso de "as preferências de leitura mudaram", para o menu (que vive no
 * header, fora da rota) e a Leitura (que usa `layout` para decidir
 * corrido/blocos) nunca discordarem.
 *
 * O alvo é um EventTarget próprio do módulo, não a `window`: mesmo motivo de
 * `sync-event.ts` — funciona igual em teste, não ocupa nome global e deixa
 * claro que só quem importa daqui participa.
 */
const alvo = new EventTarget()

const PREFS_EVENT = 'pericopes-reading-prefs'

/** Inscreve `fn` e devolve a função que desinscreve. */
export function onReadingPrefs(fn: () => void): () => void {
  alvo.addEventListener(PREFS_EVENT, fn)
  return () => alvo.removeEventListener(PREFS_EVENT, fn)
}
