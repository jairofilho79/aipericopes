/**
 * Ditado nativo das anotações: Web Speech API — no iPhone é o ditado da
 * Apple, no Android/Chrome o do Google. Sem login, sem cota, sem teto de
 * tempo. Onde a API não existe (Firefox) o DitarBotao cai no fallback de
 * ditado.ts (gravar e mandar para o Worker). Este arquivo só embrulha a API
 * num objeto pequeno e testável; quem decide reiniciar/parar é o componente.
 */

// lib.dom traz os eventos e os resultados, mas não a interface do
// reconhecedor em si nem os construtores na window: o mínimo que usamos.
declare global {
  interface SpeechRecognition extends EventTarget {
    lang: string
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    onresult: ((ev: SpeechRecognitionEvent) => void) | null
    onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
    onend: ((ev: Event) => void) | null
    // Só para o rastro de diagnóstico (onEvento); o fluxo não depende deles.
    onstart?: ((ev: Event) => void) | null
    onaudiostart?: ((ev: Event) => void) | null
    onspeechstart?: ((ev: Event) => void) | null
    onspeechend?: ((ev: Event) => void) | null
    onaudioend?: ((ev: Event) => void) | null
    onnomatch?: ((ev: Event) => void) | null
    start(): void
    stop(): void
    abort(): void
  }
}

export type ConstrutorReconhecimento = new () => SpeechRecognition

/** Construtor do reconhecedor deste navegador (padrão ou com prefixo), ou null. */
export function obterReconhecimento(): ConstrutorReconhecimento | null {
  const g = globalThis as {
    SpeechRecognition?: ConstrutorReconhecimento
    webkitSpeechRecognition?: ConstrutorReconhecimento
  }
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null
}

export type DitadoNativoHandlers = {
  /** Texto definitivo, pronto para entrar no rascunho. */
  onFinal: (texto: string) => void
  /** O que está sendo dito agora (prévia); vazio quando não há nada pendente. */
  onParcial: (texto: string) => void
  /**
   * Só erros que merecem aviso; silêncio e abort não passam por aqui. O
   * código vai junto: `not-allowed` pede tratamento próprio (microfone
   * bloqueado — ver microfone.ts), os outros são só mensagem.
   */
  onErro: (mensagem: string, codigo: SpeechRecognitionErrorCode) => void
  /** A sessão acabou — por `parar()`, por erro ou porque o SO encerrou sozinho. */
  onFim: () => void
  /**
   * Rastro de diagnóstico: cada evento cru do reconhecedor, numa linha
   * curta. Só o DitarBotao em modo debug liga isto; o fluxo não depende.
   */
  onEvento?: (linha: string) => void
}

export type DitadoNativo = {
  iniciar: () => void
  /** `stop()`, não `abort()`: assim o último resultado final ainda chega. */
  parar: () => void
}

const MENSAGENS: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Permita o microfone para ditar',
  // O serviço de reconhecimento (Siri/ditado no iOS), não o microfone.
  'service-not-allowed': 'Ditado desativado no aparelho',
  'audio-capture': 'Nenhum microfone encontrado',
  network: 'Sem conexão para ditar',
}

/**
 * Configura um reconhecedor em pt-BR, contínuo e com resultados parciais, e
 * traduz os eventos nos quatro callbacks acima. Devolve null se o navegador
 * não tem a API.
 */
export function criarDitadoNativo(
  h: DitadoNativoHandlers,
  Construtor: ConstrutorReconhecimento | null = obterReconhecimento(),
): DitadoNativo | null {
  if (!Construtor) return null
  const rec = new Construtor()
  rec.lang = 'pt-BR'
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 1

  // Índice do próximo resultado final ainda não entregue. Chrome no Android
  // às vezes reemite finais já vistos (com resultIndex apontando para trás):
  // só passa adiante o que estiver deste índice em diante.
  let proximoFinal = 0

  const traco = h.onEvento
  if (traco) {
    rec.onstart = () => traco('onstart')
    rec.onaudiostart = () => traco('onaudiostart')
    rec.onspeechstart = () => traco('onspeechstart')
    rec.onspeechend = () => traco('onspeechend')
    rec.onaudioend = () => traco('onaudioend')
    rec.onnomatch = () => traco('onnomatch')
  }

  rec.onresult = (ev) => {
    traco?.(`onresult idx=${ev.resultIndex} n=${ev.results.length}`)
    const finais: string[] = []
    let parcial = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i]
      const texto = r[0]?.transcript ?? ''
      if (!r.isFinal) parcial += texto
      else if (i >= proximoFinal) {
        proximoFinal = i + 1
        if (texto.trim()) finais.push(texto.trim())
      }
    }
    // Um onFinal por evento, com tudo que fechou nele: quem insere no
    // textarea lê o valor do elemento, e duas inserções no mesmo tick
    // atropelariam uma à outra.
    if (finais.length) h.onFinal(finais.join(' '))
    h.onParcial(parcial.trim())
  }

  rec.onerror = (ev) => {
    traco?.(`onerror ${ev.error}${ev.message ? ` — ${ev.message}` : ''}`)
    const msg = MENSAGENS[ev.error]
    if (msg) h.onErro(msg, ev.error)
  }

  rec.onend = () => {
    traco?.('onend')
    h.onFim()
  }

  return {
    iniciar() {
      proximoFinal = 0
      try {
        rec.start()
        traco?.('start()')
      } catch (e) {
        // InvalidStateError: já estava ouvindo. Nada a fazer.
        traco?.(`start() lançou ${(e as { name?: string })?.name ?? e}`)
      }
    },
    parar() {
      traco?.('stop()')
      rec.stop()
    },
  }
}
