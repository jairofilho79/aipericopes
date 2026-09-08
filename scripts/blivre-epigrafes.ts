/**
 * Epígrafes da Bíblia Livre: o rótulo que vem ANTES do versículo, não dentro
 * dele. São três coisas com a mesma natureza estrutural:
 *
 * 1. **Sobrescrito de salmo** — "Salmo de Davi, quando ele fugia da presença de
 *    seu filho Absalão". 114 dos 150 salmos. É o contexto que a perícope
 *    salmo-a-salmo precisava e que a NAA não trazia (ver docs/licencas.md).
 * 2. **Letra do acróstico** no Salmo 119 — as 22 letras hebraicas, uma a cada
 *    oito versículos.
 * 3. **Marcador de locutor** em Cantares — Ela, Ele, Moças, Outros, Irmãos dela.
 *
 * A fonte cola tudo no versículo 1: `Salmo de Davi:O SENHOR é meu pastor`. O
 * separador é o **dois-pontos colado na palavra seguinte** — e é preciso ser
 * exatamente esse, porque o sobrescrito pode conter dois-pontos ("…contou a
 * Saul, dizendo: Davi veio à casa de Aimeleque:Por que tu…") e ponto final
 * ("Para o regente. Do servo do SENHOR… Ele disse:Eu te amarei…").
 *
 * Como em `versificacao.ts`, o que é decisão editorial fica escrito aqui e não
 * num commit que ninguém relê.
 */

/** Livros que trazem sobrescrito nesta fonte. Fora deles, ':' colado é prosa. */
const LIVROS_COM_SOBRESCRITO = new Set(['PSA', 'PRO', 'ISA'])

/**
 * Onde a diagramação da fonte não deixa separar por regra: o sobrescrito está
 * lá, mas sem separador nenhum. Cada entrada é uma decisão conferida à mão, e o
 * texto esperado é verificado — se a fonte mudar, isto lança em vez de errar
 * em silêncio.
 */
export const EXCECOES: Record<string, { epigrafe: string; comeca: string }> = {
  // "Para SalomãoDeus, dá teus juízos ao rei" — sem dois-pontos, sem espaço.
  'PSA 72:1': { epigrafe: 'Para Salomão', comeca: 'Para SalomãoDeus,' },
}

/**
 * Buracos conhecidos da fonte que este módulo NÃO resolve.
 *
 * Está vazio. O único que havia — o Salmo 125, o único dos quinze Cantares dos
 * Degraus sem "Cântico dos degraus" — foi devolvido em `blivre-correcoes.ts`,
 * depois de conferido contra a KJV ("A Song of degrees.") e contra os outros
 * catorze da própria fonte. A lista fica de pé como o lugar de registrar o
 * próximo buraco que apareça e não puder ser resolvido com testemunha.
 */
export const SEM_SOBRESCRITO: string[] = []

/** Rótulo estrutural entre colchetes, seguido de dois-pontos. */
const ROTULO = /^\[([^\]]{1,30})\]\s*:\s*/
/** Sobrescrito: até o primeiro ':' COLADO na palavra seguinte. */
const SOBRESCRITO = /^(.{4,260}?):(?=\S)/

/** Só o Salmo 119 (acrósticos) e Cantares (locutores) têm rótulo estrutural. */
function temRotuloEstrutural(cod: string, capitulo: number): boolean {
  return (cod === 'PSA' && capitulo === 119) || cod === 'SOL'
}

/**
 * `tipo` separa duas coisas que a fonte escreve igual:
 *
 * - `sobrescrito` — o cabeçalho do salmo, que vale para a passagem inteira e
 *   sobe para a epígrafe do topo da tela.
 * - `rotulo` — a letra do acróstico e o marcador de locutor, que valem para
 *   AQUELE trecho e ficam na linha do versículo. "Álefe" não é o título do
 *   Salmo 119; é o par de "Bete", oito versículos adiante.
 */
export type Separado = {
  epigrafe?: string
  tipo?: 'sobrescrito' | 'rotulo'
  texto: string
}

/**
 * Separa a epígrafe do corpo do versículo. Devolve o texto intacto quando não
 * há epígrafe — que é o caso dos outros 30.938 versículos.
 */
export function separarEpigrafe(
  cod: string,
  capitulo: number,
  versiculo: number,
  texto: string,
): Separado {
  const ref = `${cod} ${capitulo}:${versiculo}`

  const excecao = EXCECOES[ref]
  if (excecao) {
    if (!texto.startsWith(excecao.comeca)) {
      throw new Error(
        `Exceção de epígrafe em ${ref} não casa com a fonte: esperava começar com ` +
          `"${excecao.comeca}", veio "${texto.slice(0, 40)}…". A fonte mudou — reveja a tabela.`,
      )
    }
    return {
      epigrafe: excecao.epigrafe,
      tipo: 'sobrescrito',
      texto: texto.slice(excecao.epigrafe.length).trim(),
    }
  }

  if (temRotuloEstrutural(cod, capitulo)) {
    const m = ROTULO.exec(texto)
    if (m) return { epigrafe: m[1].trim(), tipo: 'rotulo', texto: texto.slice(m[0].length).trim() }
  }

  if (versiculo === 1 && LIVROS_COM_SOBRESCRITO.has(cod)) {
    const m = SOBRESCRITO.exec(texto)
    if (m)
      return { epigrafe: m[1].trim(), tipo: 'sobrescrito', texto: texto.slice(m[1].length + 1).trim() }
  }

  return { texto }
}
