/**
 * A pista da trilha — o grafo de áudio, e o único lugar do app que fala com a
 * Web Audio API.
 *
 * POR QUE NÃO UM SEGUNDO `<audio>`: o `loop` do elemento tem furo audível em
 * vários navegadores, e o iPhone ignora `audio.volume` — isso já mordeu este
 * projeto uma vez, e foi por isso que o ganho da narração foi assado dentro do
 * arquivo (ver `scripts/normalizar-narracao.sh`). `AudioBufferSourceNode` faz
 * laço exato por amostra, e `GainNode` funciona no iOS.
 *
 * POR QUE A PISTA É UM SINGLETON, e não estado de componente: perícopes
 * seguidas costumam ter a mesma cama, e a música tem de continuar correndo
 * quando a tela troca. Um `AudioContext` por montagem faria a música recomeçar
 * a cada navegação — e o iOS conta contextos abertos.
 *
 * O DUCKING NÃO É COMPRESSOR. Não há sidechain na Web Audio, e a saída óbvia
 * — `createMediaElementSource` na narração — puxaria para dentro do grafo o
 * mesmo `<audio>` de onde sai o realce palavra a palavra. A envoltória vem do
 * manifesto, que já sabe quando a voz fala (ver `trilha.ts`).
 */
import { agendar, type Ponto } from './trilha'

/** Entrada e saída da pista inteira: nunca um corte seco. */
const FADE_S = 0.35


let ctx: AudioContext | null = null
/** Liga/desliga e fade da pista. */
let mestre: GainNode | null = null
/** A envoltória da voz. Separado do mestre porque o `cancelScheduledValues`
 *  de um apagaria o fade do outro. */
let ducking: GainNode | null = null
let fonte: AudioBufferSourceNode | null = null
let camaAtual: string | null = null
/** O par de relógios do último agendamento, para medir a deriva entre eles. */
let ancora: { contexto: number; audio: number } | null = null

/** Decodificar 2,5 min de AAC custa; a mesma cama volta muitas vezes. */
const buffers = new Map<string, AudioBuffer>()
const baixando = new Map<string, Promise<AudioBuffer | null>>()

function contexto(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const Klass =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Klass) return null
  ctx = new Klass()
  mestre = ctx.createGain()
  mestre.gain.value = 0
  ducking = ctx.createGain()
  ducking.gain.value = 1
  ducking.connect(mestre)
  mestre.connect(ctx.destination)
  return ctx
}

function buffer(prefixo: string, cama: string): Promise<AudioBuffer | null> {
  const pronto = buffers.get(cama)
  if (pronto) return Promise.resolve(pronto)
  const emCurso = baixando.get(cama)
  if (emCurso) return emCurso
  const c = contexto()
  if (!c) return Promise.resolve(null)
  const p = fetch(`/api/audio/${prefixo}/${cama}.m4a`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((bytes) => (bytes ? c.decodeAudioData(bytes) : null))
    .then((buf) => {
      if (buf) buffers.set(cama, buf)
      return buf
    })
    .catch(() => null)
    .finally(() => baixando.delete(cama))
  baixando.set(cama, p)
  return p
}

/**
 * Começa (ou continua) a cama e agenda a envoltória.
 *
 * Só troca o `AudioBufferSourceNode` quando a cama muda: perícopes seguidas do
 * mesmo registro deixam a música correndo, e isso é proposital.
 *
 * A primeira chamada precisa vir de dentro de um gesto do usuário — o
 * `resume()` de um contexto novo só é autorizado assim. O botão de play é
 * exatamente isso.
 */
export async function tocar(
  prefixo: string,
  cama: string,
  pontos: Ponto[],
  tAudio: number,
): Promise<void> {
  const c = contexto()
  if (!c || !mestre || !ducking) return
  if (c.state === 'suspended') await c.resume().catch(() => {})

  if (cama !== camaAtual || !fonte) {
    const buf = await buffer(prefixo, cama)
    // Recheca tudo: o `await` pode ter sido ultrapassado por outra perícope,
    // ou a pista pode ter sido desligada no meio.
    if (!buf || !ctx || !mestre || !ducking) return
    pararFonte()
    fonte = ctx.createBufferSource()
    fonte.buffer = buf
    fonte.loop = true
    fonte.connect(ducking)
    fonte.start()
    camaAtual = cama
  }

  reagendar(pontos, tAudio)
  rampa(mestre.gain, 1)
}

/** Reancora a envoltória: no seek, na troca de manifesto e contra a deriva. */
export function reagendar(pontos: Ponto[], tAudio: number): void {
  if (!ctx || !ducking || !fonte) return
  agendar(ducking.gain, pontos, tAudio, ctx.currentTime)
  ancora = { contexto: ctx.currentTime, audio: tAudio }
}

/**
 * De quanto os dois relógios já se afastaram, em segundos. O `<audio>` e o
 * `AudioContext` correm separados, e vinte minutos bastam para desalinhar o
 * ducking da voz; o tocador chama isto no `timeupdate` e reancora quando passa
 * do limiar.
 */
export function deriva(tAudio: number): number {
  if (!ctx || !ancora) return 0
  return ctx.currentTime - ancora.contexto - (tAudio - ancora.audio)
}

/**
 * Silencia sem matar a fonte: o laço continua girando em ganho zero, então
 * despausar não recomeça a música do zero. Uma fonte muda não custa nada
 * perto de um clique na retomada.
 */
export function silenciar(): void {
  if (mestre) rampa(mestre.gain, 0)
}

/** Encerra a pista: trilha desligada, perícope sem cama, tocador desmontado. */
export function parar(): void {
  if (mestre) rampa(mestre.gain, 0)
  const morrendo = fonte
  fonte = null
  camaAtual = null
  ancora = null
  if (morrendo && ctx) {
    // Depois do fade, não durante: cortar a fonte antes dá clique.
    try {
      morrendo.stop(ctx.currentTime + FADE_S + 0.05)
    } catch {
      // fonte que nunca começou, ou já parada
    }
  }
}

function rampa(g: AudioParam, alvo: number) {
  if (!ctx) return
  const agora = ctx.currentTime
  g.cancelScheduledValues(agora)
  g.setValueAtTime(g.value, agora)
  g.linearRampToValueAtTime(alvo, agora + FADE_S)
}

function pararFonte() {
  if (!fonte) return
  try {
    fonte.stop()
  } catch {
    // já parada
  }
  fonte.disconnect()
  fonte = null
}
