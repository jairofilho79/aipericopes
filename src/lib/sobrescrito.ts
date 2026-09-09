/**
 * O `sobrescrito` do catálogo vem sem ponto final — é epígrafe, não frase
 * ("Salmo de Davi, para o regente"). A narração funde "Capítulo N." com ele
 * numa frase só e fecha com ponto, para a fala soar natural: o manifesto de
 * produção traz "Capítulo 102. Oração do aflito, ... diante do Senhor."
 * (confirmado contra 25 perícopes de amostra, todas as 120 que têm
 * sobrescrito seguem o mesmo padrão).
 *
 * Tela e alinhamento têm de dizer a mesma coisa — por isso `Leitura.tsx` usa
 * ESTE texto tanto no `<TextoFalado>` do sobrescrito quanto no alvo que
 * alimenta `alinhar()`, nunca o `sobrescrito` cru do catálogo. Sem o alvo, o
 * fluxo de tokens do manifesto trazia o sobrescrito inteiro sem contrapartida
 * na tela, e `alinharConteudo` derrubava a seção "texto" inteira — ver
 * `alinhar-narracao.ts`.
 */
export function textoSobrescrito(sobrescrito: string): string {
  return /[.!?…]$/.test(sobrescrito) ? sobrescrito : `${sobrescrito}.`
}
