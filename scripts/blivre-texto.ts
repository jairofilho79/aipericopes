/**
 * Normalização do texto da Bíblia Livre (BLIVRE) para leitura e narração.
 *
 * A BLIVRE marca entre colchetes a palavra que o tradutor supriu e o original
 * não traz — "Deus [é] nosso refúgio". São 4.838 versículos, 1 em cada 6. Na
 * tela isso vira ruído, e o TTS lê o colchete de forma imprevisível, então o
 * app remove os delimitadores e mantém as palavras.
 *
 * Isso é uma ADAPTAÇÃO no sentido da CC BY 3.0 Brasil, que a permite exigindo
 * que a mudança seja indicada — o crédito no rodapé do app declara.
 *
 * Cuidado com a diagramação da fonte: ela escreve `Salva [-nos] ,SENHOR!`, com
 * o sufixo hifenizado solto e o espaço do lado errado da vírgula. Tirar só os
 * colchetes deixaria `Salva -nos ,SENHOR!`.
 */

/** Sufixo hifenizado entre colchetes: `Salva [-nos]` → `Salva-nos`. */
const HIFEN_SOLTO = /\s*\[-/g

/**
 * Hífen com espaço depois: `dize- lhes`, `envolveu- [a]`, `meio- dia`. São 14
 * no corpus, seis deles ênclises que a narração leria como duas palavras.
 *
 * Em português o hífen nunca leva espaço — o travessão com espaço é outro
 * sinal, o `—`, que a fonte usa e este padrão não toca por exigir letra dos
 * dois lados. Como o `[`, é espaço em branco, e por isso mora aqui e não numa
 * receita a versículo.
 */
const HIFEN_COM_ESPACO = /(\p{L})-\s+(?=\p{L}|\[)/gu

/**
 * Espaço ANTES do hífen, do lado de fora do colchete: `[Parece] -te bem`,
 * `não posso [alcançá] -lo`. É o espelho de `HIFEN_SOLTO` — lá o colchete abre
 * no hífen (`Salva [-nos]`), aqui ele fecha antes dele. Tirando só os
 * delimitadores sobrava `Parece -te` e `alcançá -lo`, e a narração leria a
 * ênclise como palavra separada.
 *
 * São dois no corpus inteiro, e é o mesmo material que o resto deste arquivo
 * cuida: espaço em branco em volta do colchete, não defeito de tradução. Por
 * isso mora aqui e não numa receita a versículo.
 */
const HIFEN_ANTES_DO_ESPACO = /\]\s+-(?=\p{L})/gu
/** Espaço antes de pontuação, que sobra quando o colchete some. */
const ESPACO_ANTES_DE_PONTUACAO = /\s+([,;.!?:])/g

/**
 * `( que me separou` e `pela sua graça )` — a fonte abre e fecha parêntese com
 * espaço por dentro em 18 lugares dos 339. Não é defeito da Bíblia Livre: é
 * espaço em branco, o mesmo material que `removerColchetes` já limpa em volta
 * dos colchetes, e cabe aqui e não numa receita a versículo.
 */
const PARENTESE_FOLGADO = /\(\s+|\s+\)/g
/**
 * Pontuação colada na palavra seguinte, que a fonte produz junto com o espaço
 * errado. O parêntese que fecha entra na lista pelos dois `(Selá)Porque` de
 * Sl 55:19 e Sl 57:3, os únicos do arquivo. Fora os dois-pontos: eles separam o sobrescrito do versículo e quem
 * cuida disso é `blivre-epigrafes`, que roda ANTES desta função.
 */
const PONTUACAO_SEM_ESPACO = /([,;!?)])(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g

/**
 * Ponto final colado na frase seguinte: `salvá-las.E foram para outra aldeia`.
 *
 * São 66 no corpus, e o padrão é seguro: exige minúscula antes e MAIÚSCULA
 * depois — ou um parêntese que abre, que é o mesmo caso em Sl 3:2
 * (`em Deus.(Selá)`) e Hc 3:19, os dois únicos do arquivo. A forma arriscada — ponto entre minúsculas, que quebraria
 * abreviatura — não ocorre nenhuma vez, então não há o que preservar.
 *
 * Fica fora do `PONTUACAO_SEM_ESPACO` de propósito: aquele aceita qualquer
 * letra depois, e aplicar isso ao ponto separaria o que não deve.
 */
const PONTO_SEM_ESPACO = /(\p{Ll})\.(?=\p{Lu}|\()/gu

/**
 * Tira os colchetes editoriais mantendo as palavras, e arruma o espaçamento que
 * a remoção deixa torto. Versículo sem colchete volta sem nenhuma alteração.
 */
/**
 * Colchete de abertura colado na palavra anterior — `conseguiam[apenas]`.
 *
 * Tirar os colchetes sem mais nada gruda as duas palavras
 * (`conseguiamapenas`), e o defeito é mudo: o versículo continua parecendo
 * texto. São 19 ocorrências no corpus, e elas se dividem em dois casos que
 * pedem tratamento OPOSTO — por isso a condição olha o que vem depois do
 * colchete. `mataram[-no]` tem de virar `mataram-no`, colado; só se abre
 * espaço quando o colchete começa em letra.
 */
const COLCHETE_COLADO = /(\p{L})\[(?=\p{L})/gu

/**
 * Colchete que contém um PEDAÇO de palavra, e não uma palavra.
 *
 * A fonte escreve `desçam com [igo]`, `palavra [s]` e `sinagoga [n] um dia`.
 * Tirando só os delimitadores sobra `com igo`, `palavra s` e `n um dia` — e
 * era isso que o app estava servindo. O espaço em volta do colchete não
 * distingue os dois casos: a fonte põe espaço em 5.990 dos 6.030 colchetes,
 * inclusive nestes.
 *
 * A lista vem de varredura do corpus inteiro, não de palpite: entre os
 * colchetes de uma letra só, `e`, `é`, `o`, `a` e `ó` são palavras de verdade
 * (673 ocorrências, e o espaço delas está certo); os únicos pedaços são `n`
 * (×6), `s` (×2) e `d` (×1), mais `igo` (×1). E eles colam para lados
 * OPOSTOS: `dele [s]` fecha a palavra anterior, `[n] um` abre a seguinte.
 */
/**
 * Nota do tradutor entre colchetes: `[Ou: perfeito]`, `[ou: anciãos]`.
 *
 * Aqui o colchete não traz palavra suprida — traz **aparato crítico**, uma
 * leitura alternativa dirigida a quem estuda. Desembrulhar deixava o app
 * servindo "quando vier o que é completo, Ou: perfeito então o que é em
 * parte", e a narração lia isso em voz alta. Aparato sai inteiro, junto com a
 * pontuação que sobra na frente dele. São dois casos no corpus.
 */
const NOTA_DO_TRADUTOR = /\s*\[\s*(?:[Oo]u|[Ll]it|isto é|ou seja)\s*[:.][^\]]*\]/g

/**
 * Letra solta ANTES do colchete: `d [esta]`, `n [aquela]`, `D [este]`.
 *
 * O espelho de `PEDACO_QUE_ABRE`: aqui o pedaço está fora e a palavra dentro,
 * e juntos formam a contração — `d`+`esta` é *desta*. O app servia
 * `d esta geração`, `n esta visão` e `D este tal`. São dez no corpus.
 *
 * Só `d`, `n` e `s` entram: `e`, `o`, `a` e `é` são palavras de verdade, e
 * juntá-las ao colchete seguinte estragaria 673 versículos corretos.
 */
const LETRA_SOLTA_ANTES = /(?<!\p{L})([dnsDNS])\s\[/gu

const PEDACO_QUE_FECHA = /(\p{L})\s\[(s|igo)\]/gu
const PEDACO_QUE_ABRE = /\[(n|d)\]\s(?=\p{L})/gu

export function removerColchetes(texto: string): string {
  return texto
    .replace(NOTA_DO_TRADUTOR, '')
    // COLCHETE_COLADO abre espaço antes do colchete; LETRA_SOLTA_ANTES fecha
    // o espaço nos três casos em que a letra é pedaço de palavra. A ordem
    // importa: invertida, o primeiro desfazia o trabalho do segundo.
    .replace(COLCHETE_COLADO, '$1 [')
    .replace(LETRA_SOLTA_ANTES, '$1[')
    .replace(PEDACO_QUE_FECHA, '$1$2')
    .replace(PEDACO_QUE_ABRE, '$1')
    // HIFEN_SOLTO vem primeiro e HIFEN_COM_ESPACO depois: `trazei [- os]` só
    // vira `trazei- os` DEPOIS do primeiro, e é o segundo que fecha o espaço.
    .replace(HIFEN_SOLTO, '-')
    .replace(HIFEN_ANTES_DO_ESPACO, ']-')
    .replace(HIFEN_COM_ESPACO, '$1-')
    .replace(/[[\]]/g, '')
    .replace(PARENTESE_FOLGADO, (m) => (m.startsWith('(') ? '(' : ')'))
    .replace(ESPACO_ANTES_DE_PONTUACAO, '$1')
    .replace(PONTUACAO_SEM_ESPACO, '$1 ')
    .replace(PONTO_SEM_ESPACO, '$1. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
