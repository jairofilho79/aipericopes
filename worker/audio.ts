// Narração pré-gerada servida do R2: validação da chave e Content-Range.

/**
 * Chave válida: "<prefixo>/<nome>.m4a" (áudio) ou "<prefixo>/<nome>.json".
 *
 * O nome era `\d+` — a narração é servida por ordem de perícope. A trilha
 * sonora é servida por REGISTRO (`trilha-v1/santuario.m4a`), que não é número,
 * e numerar as camas faria a chave parar de dizer o que ela é. Daí o nome
 * aceitar o mesmo alfabeto do prefixo.
 *
 * O que continua barrado, e é o que importa: o nome não admite `.` nem `/`, e
 * o caminho tem exatamente uma barra — então `..` não se escreve, e travessia
 * de caminho não passa. Maiúscula e `_` também não, para a chave ter uma grafia
 * só. Ver os testes.
 */
export function chaveAudio(caminho: string): string | null {
  return /^[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\.(m4a|json)$/.test(caminho) ? caminho : null
}

type FaixaR2 = { offset?: number; length?: number; suffix?: number }

/** Content-Range de uma resposta 206 a partir do range resolvido pelo R2. */
export function cabecalhoContentRange(faixa: FaixaR2 | undefined, tamanho: number): string | null {
  if (!faixa) return null
  const inicio = faixa.suffix !== undefined ? tamanho - faixa.suffix : (faixa.offset ?? 0)
  const comprimento = faixa.suffix ?? faixa.length ?? tamanho - inicio
  return `bytes ${inicio}-${inicio + comprimento - 1}/${tamanho}`
}
