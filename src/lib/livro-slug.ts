/**
 * Nome do livro → segmento de URL dos shards.
 *
 * Vem do nome COMPLETO de propósito: as abreviações "Jó" e "Jo" (João) colidem
 * ao perder o acento, e um livro sobrescreveria o arquivo do outro no build.
 * O gerador e o cliente importam daqui justamente para não poderem discordar.
 */
export function livroSlug(livro: string): string {
  return livro
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
