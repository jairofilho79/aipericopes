/**
 * Cifragem da chave de IA do usuário (BYOK): AES-GCM 256 via WebCrypto, com
 * a chave derivada do segredo `AI_KEY_SECRET` do Worker (SHA-256 do segredo).
 * Cada cifragem usa um IV aleatório de 12 bytes, guardado ao lado do texto.
 * O userId entra como dado autenticado adicional (AAD): uma linha copiada para
 * outro usuário no banco deixa de decifrar.
 */

export const VERSAO_SEGREDO = 1

const enc = new TextEncoder()

function paraB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function deB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function importarChave(segredo: string): Promise<CryptoKey> {
  if (!segredo) throw new Error('AI_KEY_SECRET ausente')
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(segredo))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function cifrarChave(
  segredo: string,
  userId: string,
  chave: string,
): Promise<{ cifrada: string; iv: string }> {
  const k = await importarChave(segredo)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrada = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(userId) },
    k,
    enc.encode(chave),
  )
  return { cifrada: paraB64(new Uint8Array(cifrada)), iv: paraB64(iv) }
}

export async function decifrarChave(
  segredo: string,
  userId: string,
  cifrada: string,
  iv: string,
): Promise<string> {
  const k = await importarChave(segredo)
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: deB64(iv), additionalData: enc.encode(userId) },
    k,
    deB64(cifrada),
  )
  return new TextDecoder().decode(claro)
}
