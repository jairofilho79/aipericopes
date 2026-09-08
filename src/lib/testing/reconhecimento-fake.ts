/**
 * SpeechRecognition de mentira para os testes do ditado nativo: registra
 * start/stop e deixa o teste disparar onresult/onerror/onend na mão.
 */
export class FakeReconhecimento implements SpeechRecognition {
  static instancias: FakeReconhecimento[] = []
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 0
  onresult: ((ev: SpeechRecognitionEvent) => void) | null = null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null
  onend: ((ev: Event) => void) | null = null
  starts = 0
  stops = 0
  ouvindo = false

  constructor() {
    FakeReconhecimento.instancias.push(this)
  }

  start() {
    // Igual ao navegador: começar duas vezes é InvalidStateError.
    if (this.ouvindo) throw new DOMException('já iniciado', 'InvalidStateError')
    this.ouvindo = true
    this.starts++
  }

  stop() {
    this.stops++
  }

  abort() {}

  /** Emite um evento de resultado com os (texto, final?) dados, a partir de `resultIndex`. */
  resultado(itens: Array<[string, boolean]>, resultIndex = 0) {
    const lista = itens.map(([transcript, isFinal]) => ({
      isFinal,
      length: 1,
      0: { transcript, confidence: 1 },
      item: () => ({ transcript, confidence: 1 }),
    }))
    this.onresult?.({
      resultIndex,
      results: Object.assign(lista, { item: (i: number) => lista[i] }),
    } as unknown as SpeechRecognitionEvent)
  }

  erro(codigo: SpeechRecognitionErrorCode) {
    this.onerror?.({ error: codigo, message: '' } as SpeechRecognitionErrorEvent)
  }

  fim() {
    this.ouvindo = false
    this.onend?.(new Event('end'))
  }

  // EventTarget: o wrapper usa só os handlers on*, mas a interface pede.
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true
  }
}
