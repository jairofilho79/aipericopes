/**
 * Detecção de plataforma para adaptação de UI móvel (iOS vs Android).
 *
 * No ecossistema Apple (iOS/iPadOS/macOS), a convenção nativa de navegação
 * de retorno é o chevron ('‹'). No ecossistema Android/Material Design, é
 * a seta horizontal ('←').
 */

export type Plataforma = 'ios' | 'android' | 'padrao'

export function detectarPlataforma(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform: string = typeof navigator !== 'undefined' ? (navigator as { platform?: string }).platform ?? '' : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): Plataforma {
  // iPhone, iPad, iPod ou iPadOS moderno (que se identifica como MacIntel com toque)
  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) {
    return 'ios'
  }

  // Android
  if (/Android/i.test(ua)) {
    return 'android'
  }

  // macOS desktop segue a mesma linguagem de design da Apple (chevron)
  if (/Macintosh|Mac OS X/.test(ua)) {
    return 'ios'
  }

  return 'padrao'
}
