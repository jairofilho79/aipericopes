import { vi } from 'vitest'

/** Node 25 expõe um localStorage embutido sem métodos que vaza para o
 * ambiente de teste; este stub em memória restaura o contrato do browser. */
export function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}
