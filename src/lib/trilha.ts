/**
 * A trilha — a cama instrumental que toca por baixo da narração.
 *
 * Aqui mora só a parte que não faz barulho: o mapa perícope → cama, a
 * envoltória de ganho que abaixa a música enquanto a voz fala, e o
 * agendamento dessa envoltória num `AudioParam`. O grafo de áudio de verdade
 * está em `trilha-pista.ts`; a separação existe para que a decisão de QUANDO
 * abaixar seja testável sem Web Audio, que o jsdom não tem.
 *
 * O desenho está em `docs/sessao-5-trilhas-desenho.md`. Os números daqui não
 * são preferência: saíram de medição e de um teste cego.
 */
import type { Manifesto } from './manifesto'

/**
 * `public/data/trilha.json`, gerado por `scripts/montar-trilha.ts`. A escolha
 * da cama (inclusive a alternância entre a 1ª e a 2ª voz de um mesmo registro)
 * já vem decidida de lá — o cliente só consulta.
 */
export type MapaTrilha = { prefixo: string; camas: Record<string, number[]> }

/** Guarda de forma: o mapa vem da rede, então nada aqui é presumido. */
export function mapaTrilhaValido(v: unknown): v is MapaTrilha {
  const m = v as MapaTrilha
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false
  if (typeof m.prefixo !== 'string' || !m.prefixo) return false
  if (!m.camas || typeof m.camas !== 'object' || Array.isArray(m.camas)) return false
  return Object.values(m.camas).every(
    (ordens) =>
      Array.isArray(ordens) && ordens.every((o) => typeof o === 'number' && Number.isFinite(o)),
  )
}

/**
 * Inverte o mapa uma vez: são 22 listas somando 2.823 ordens, e o tocador
 * pergunta por uma ordem por vez.
 */
export function indiceDeCamas(mapa: MapaTrilha): Map<number, string> {
  const ix = new Map<number, string>()
  for (const [cama, ordens] of Object.entries(mapa.camas)) {
    for (const o of ordens) if (!ix.has(o)) ix.set(o, cama)
  }
  return ix
}

// ── A envoltória ──

/**
 * Quanto a cama abaixa enquanto a voz fala, em ganho linear. −9 dB (0.35),
 * criando uma separação acolhedora onde a voz bíblica é o foco absoluto e a trilha
 * é uma sutil companhia de fundo.
 */
export const GANHO_DUCK = 0.35

/** Descida rápida — a música tem de sair da frente antes da sílaba. */
export const ATAQUE_S = 0.02

/** Volta devagar, senão cada respiro da voz vira um sopro de música. */
export const SOLTURA_S = 0.4

/**
 * Pausa curta demais para valer a subida. Precisa ser maior que
 * ataque + soltura, ou a envoltória se atropelaria; e o ouvido lê uma música
 * que sobe e desce a cada meio segundo como defeito, não como respiro.
 */
export const PAUSA_MINIMA_S = 0.6

export type Intervalo = { inicio: number; fim: number }

/**
 * Onde a voz ocupa o tempo, com as pausas curtas absorvidas.
 *
 * Prefere `palavras[]` quando o manifesto as tem: a `dur` de uma unidade
 * costuma incluir o silêncio de respiro no fim, e a cama subiria tarde. Sem
 * `palavras` (manifesto anterior ao realinhamento), o nível de unidade ainda é
 * bom — é o que diz o kickoff, e é verdade: erra por frações de segundo numa
 * mudança de 4 dB.
 */
export function intervalosDeFala(m: Manifesto, pausaMinima = PAUSA_MINIMA_S): Intervalo[] {
  const brutos: Intervalo[] = []
  for (const u of m.unidades) {
    if (u.palavras?.length) {
      for (const p of u.palavras) brutos.push({ inicio: p.i, fim: p.i + p.d })
    } else {
      brutos.push({ inicio: u.inicio, fim: u.inicio + u.dur })
    }
  }
  brutos.sort((a, b) => a.inicio - b.inicio)

  const juntos: Intervalo[] = []
  for (const iv of brutos) {
    const ultimo = juntos[juntos.length - 1]
    if (ultimo && iv.inicio - ultimo.fim < pausaMinima) {
      if (iv.fim > ultimo.fim) ultimo.fim = iv.fim
    } else {
      juntos.push({ inicio: iv.inicio, fim: iv.fim })
    }
  }
  return juntos
}

/** Um vértice da envoltória, no eixo do `currentTime` da narração. */
export type Ponto = { t: number; g: number }

/**
 * A envoltória inteira da perícope, montada de uma vez. São algumas centenas
 * de vértices para uma narração de vinte minutos — barato de agendar e imune
 * a qualquer coisa que aconteça com o laço da cama, que corre em outro eixo.
 */
export function envoltoria(
  intervalos: Intervalo[],
  { duck = GANHO_DUCK, ataque = ATAQUE_S, soltura = SOLTURA_S } = {},
): Ponto[] {
  const pontos: Ponto[] = []
  const por = (t: number, g: number) => {
    const ultimo = pontos[pontos.length - 1]
    // Tempo nunca anda para trás: um ponto que colidiria com o anterior
    // apenas o substitui, o que preserva a monotonia exigida pelas rampas.
    if (ultimo && t <= ultimo.t) ultimo.g = g
    else pontos.push({ t, g })
  }
  for (const iv of intervalos) {
    por(Math.max(0, iv.inicio - ataque), 1)
    por(iv.inicio, duck)
    por(iv.fim, duck)
    por(iv.fim + soltura, 1)
  }
  if (pontos.length && pontos[0]!.t > 0) pontos.unshift({ t: 0, g: 1 })
  return pontos
}

/** O ganho da envoltória num instante qualquer, interpolado como as rampas. */
export function valorEm(pontos: Ponto[], t: number): number {
  if (!pontos.length) return 1
  if (t <= pontos[0]!.t) return pontos[0]!.g
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]!
    const b = pontos[i]!
    if (t <= b.t) {
      const span = b.t - a.t
      if (span <= 0) return b.g
      return a.g + ((b.g - a.g) * (t - a.t)) / span
    }
  }
  return pontos[pontos.length - 1]!.g
}

/** O bastante de um `AudioParam` para agendar — e para fingir num teste. */
export type ParamAgendavel = {
  cancelScheduledValues(quando: number): void
  setValueAtTime(valor: number, quando: number): void
  linearRampToValueAtTime(valor: number, quando: number): void
}

/**
 * Passa a envoltória para o relógio do `AudioContext`.
 *
 * Os dois relógios são independentes: o do `<audio>` (`tAudio`) e o do
 * contexto (`tContexto`). O que amarra os dois é o instante em que esta função
 * roda — por isso ela é chamada de novo a cada play, a cada seek e sempre que
 * a deriva entre eles passa de um limiar. Sem reancorar, vinte minutos de
 * deriva desalinhariam o ducking da voz.
 */
export function agendar(
  param: ParamAgendavel,
  pontos: Ponto[],
  tAudio: number,
  tContexto: number,
): void {
  const offset = tContexto - tAudio
  param.cancelScheduledValues(tContexto)
  // Ancorar no valor de agora evita o salto que um `linearRamp` daria a partir
  // de onde o ganho por acaso estivesse.
  param.setValueAtTime(valorEm(pontos, tAudio), tContexto)
  for (const p of pontos) {
    if (p.t <= tAudio) continue
    param.linearRampToValueAtTime(p.g, p.t + offset)
  }
}

// ── A preferência ──

export const TRILHA_KEY = 'pericopes-trilha'

/**
 * Ligada por padrão: a trilha é parte de como a narração foi desenhada para
 * soar. Só quem desligou de propósito ('0') recebe silêncio.
 */
export function getTrilhaLigada(): boolean {
  try {
    return localStorage.getItem(TRILHA_KEY) !== '0'
  } catch {
    return true
  }
}

export function setTrilhaLigada(ligada: boolean): void {
  try {
    localStorage.setItem(TRILHA_KEY, ligada ? '1' : '0')
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
}

// ── O mapa, buscado uma vez ──

let pedido: Promise<MapaTrilha | null> | null = null

/**
 * 13 KB, buscados no máximo uma vez por sessão e guardados mesmo quando falham
 * (`null`): sem o mapa não há cama, e insistir a cada perícope só renderia
 * mais 404.
 */
export function carregarMapaTrilha(): Promise<MapaTrilha | null> {
  pedido ??= fetch(`${import.meta.env.BASE_URL}data/trilha.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((c: unknown) => (mapaTrilhaValido(c) ? c : null))
    .catch(() => null)
  return pedido
}

/** Só para o teste: o cache de módulo não pode vazar de um caso para o outro. */
export function esquecerMapaTrilha(): void {
  pedido = null
}
