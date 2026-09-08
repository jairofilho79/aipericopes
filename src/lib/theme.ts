const KEY = 'pericopes-theme'

export type Theme = 'light' | 'dark'

/** Preferência armazenada; 'system' = nenhuma chave gravada. */
export type ThemePref = Theme | 'system'

const TEMAS: Theme[] = ['light', 'dark']

/**
 * O sépia foi aposentado no rebranding para aiPericopes: ele já era, na
 * prática, o tema âmbar (`--accent: #8a5a2b` sobre papel bege), e manter os
 * dois era oferecer uma escolha que não escolhia nada.
 *
 * A migração é EXPLÍCITA para 'light' e não pode virar `null`: sépia era um
 * tema CLARO, e cair no ramo de valor desconhecido levaria a preferência para
 * 'system' — quem escolheu papel bege acordaria no escuro. O storage não é
 * reescrito; a próxima escolha do usuário sobrescreve sozinha.
 *
 * DUPLICAÇÃO DELIBERADA: o script inline de index.html faz o mesmo mapa antes
 * de qualquer bundle. Mudou aqui, mude lá.
 */
function migrar(v: string | null): Theme | null {
  if (v === 'sepia') return 'light'
  return TEMAS.includes(v as Theme) ? (v as Theme) : null
}

export function getStoredTheme(): Theme | null {
  try {
    return migrar(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function getThemePref(): ThemePref {
  return getStoredTheme() ?? 'system'
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

/** Ponto único de aplicação: dataset + persistência + evento de resync. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
  window.dispatchEvent(new Event('pericopes-theme'))
}

export function setThemePref(pref: ThemePref): Theme {
  if (pref !== 'system') {
    applyTheme(pref)
    return pref
  }
  // 'system' é a AUSÊNCIA da chave: gravar o resolvido aqui congelaria o tema
  // e o app deixaria de acompanhar o sistema.
  try {
    localStorage.removeItem(KEY)
  } catch {
    // idem
  }
  const resolvido = resolveTheme()
  document.documentElement.dataset.theme = resolvido
  window.dispatchEvent(new Event('pericopes-theme'))
  return resolvido
}
