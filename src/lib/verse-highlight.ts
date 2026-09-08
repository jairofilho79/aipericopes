const KEY = 'pericopes-verse-focus'

type Store = Record<string, string>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

export function getVerseFocus(ordem: number): string | null {
  return read()[String(ordem)] ?? null
}

export function setVerseFocus(ordem: number, verseId: string | null) {
  const store = read()
  const k = String(ordem)
  if (verseId) store[k] = verseId
  else delete store[k]
  write(store)
}
