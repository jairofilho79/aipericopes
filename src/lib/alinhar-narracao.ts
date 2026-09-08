import type { Manifesto, SecaoManifesto, UnidadeManifesto } from './manifesto'

/** Um elemento da tela que pode ser realçado (`data-verse-id` é o `id`). */
export type Alvo = { id: string; texto: string }

/** Os alvos de uma seção, na ordem de leitura. `titulo` não tem alvo de conteúdo. */
export type SecaoAlvos = { secao: Exclude<SecaoManifesto, 'titulo'>; alvos: Alvo[] }

export type AlvoAlinhado = {
  id: string
  inicio: number
  fim: number
  /**
   * Uma janela por token de `alvo.texto.split(' ')`, na mesma ordem. Vazio nos
   * cabeçalhos falados (`titulo`, `referencia`, `cabecalho-<secao>`, `cap-N`):
   * eles realçam o título inteiro, sem ponteiro de palavra.
   */
  palavras: { inicio: number; fim: number }[]
}

/** Ordenado por `inicio`, sem sobreposição. Vazio significa "sem realce". */
export type Alinhamento = AlvoAlinhado[]

/**
 * O tokenizador do contrato: `palavras` traz um item por token de
 * `texto.split(' ')`. Filtrar vazios ou aparar desalinharia os índices.
 */
export function tokens(texto: string): string[] {
  return texto.split(' ')
}

const PREFIXO = /^(Capítulo|Reflexão)\s+(\d+)\.\s+/

/**
 * O manifesto guarda o texto COMO FOI FALADO, e a gravação normalizou o que a
 * voz não devia gritar: o "SENHOR" versalete da NAA foi para "Senhor" e os
 * colchetes editoriais sumiram. A tela mostra o texto do catálogo, com os dois.
 * Exigir igualdade byte a byte reprovava 15% das seções — Salmos quase inteiro,
 * porque lá o Nome está em quase todo versículo.
 *
 * A folga vale SÓ na comparação manifesto × tela. A checagem interna do
 * manifesto (`palavras[k].t` contra o próprio `texto`) continua exata: ali uma
 * diferença de caixa é sinal de alinhamento errado, não de normalização.
 */
const semCaixaNemColchete = (s: string) => s.toLowerCase().replace(/[[\]]/g, '')

function mesmoToken(narrado: string, naTela: string): boolean {
  return narrado === naTela || semCaixaNemColchete(narrado) === semCaixaNemColchete(naTela)
}

type TokenManifesto = { tok: string; inicio: number }

/**
 * Um `"Capítulo N."` fundido e descartado do fluxo: `antesDe` é o índice, no
 * fluxo, do 1º token que sobrou. A janela `[inicio, fim)` é a fala do marcador
 * — e o `cap-label` da tela existe justamente para ela.
 */
type Marcador = { capitulo: number; antesDe: number; inicio: number; fim: number }

type Fluxo = { tokens: TokenManifesto[]; marcadores: Marcador[] }

/**
 * Achata as unidades de conteúdo num fluxo de tokens com tempo. Devolve `null`
 * ao primeiro sinal de que o manifesto não honra o contrato de `palavras`.
 *
 * `telaTok` entra só para decidir o descarte de prefixo: `"Capítulo 3."` é
 * marcador fundido quando descartá-lo faz o token seguinte casar com o que a
 * tela espera, e é texto de verdade quando não faz.
 */
function fluxoDoManifesto(unidades: UnidadeManifesto[], telaTok: string[]): Fluxo | null {
  const fluxo: TokenManifesto[] = []
  const marcadores: Marcador[] = []
  for (const u of unidades) {
    const tk = tokens(u.texto)
    const pal = u.palavras
    if (!pal || pal.length !== tk.length) return null
    for (let k = 0; k < tk.length; k++) if (pal[k]!.t !== tk[k]) return null

    let ini = 0
    const m = PREFIXO.exec(u.texto)
    if (m) {
      const n = tokens(m[0].trimEnd()).length
      if (n < tk.length && mesmoToken(tk[n]!, telaTok[fluxo.length] ?? '')) {
        ini = n
        // "Reflexão N." não ganha marcador: a tela numera a lista sozinha e
        // não há elemento para realçar.
        if (m[1] === 'Capítulo') {
          marcadores.push({
            capitulo: Number(m[2]),
            antesDe: fluxo.length,
            inicio: pal[0]!.i,
            fim: pal[n]!.i,
          })
        }
      }
    }
    for (let k = ini; k < tk.length; k++) fluxo.push({ tok: tk[k]!, inicio: pal[k]!.i })
  }
  return { tokens: fluxo, marcadores }
}

/** Alinha o conteúdo de uma seção. Devolve `[]` — sem realce — a qualquer divergência. */
function alinharConteudo(conteudo: UnidadeManifesto[], alvos: Alvo[]): AlvoAlinhado[] {
  if (!conteudo.length || !alvos.length) return []

  const telaTok: string[] = []
  const donoDoToken: number[] = []
  alvos.forEach((a, ia) => {
    for (const tok of tokens(a.texto)) {
      telaTok.push(tok)
      donoDoToken.push(ia)
    }
  })

  const fluxo = fluxoDoManifesto(conteudo, telaTok)
  if (!fluxo || fluxo.tokens.length !== telaTok.length) return []
  for (let k = 0; k < fluxo.tokens.length; k++) {
    if (!mesmoToken(fluxo.tokens[k]!.tok, telaTok[k]!)) return []
  }

  const ultima = conteudo[conteudo.length - 1]!
  const fimSecao = ultima.inicio + ultima.dur

  const porAlvo: AlvoAlinhado[] = alvos.map((a) => ({
    id: a.id,
    inicio: 0,
    fim: 0,
    palavras: [],
  }))
  fluxo.tokens.forEach((t, k) => {
    porAlvo[donoDoToken[k]!]!.palavras.push({ inicio: t.inicio, fim: 0 })
  })
  for (const a of porAlvo) a.inicio = a.palavras[0]!.inicio

  // O marcador de capítulo entra na sequência como alvo próprio, antes do
  // versículo que o carregava — mas só quando cai na fronteira de um alvo.
  // No meio de um, abriria um buraco nas janelas de palavra desse alvo; aí é
  // descartado em silêncio, como sempre foi.
  const saida: AlvoAlinhado[] = []
  let proximoMarcador = 0
  porAlvo.forEach((a, ia) => {
    const primeiroToken = donoDoToken.indexOf(ia)
    while (
      proximoMarcador < fluxo.marcadores.length &&
      fluxo.marcadores[proximoMarcador]!.antesDe <= primeiroToken
    ) {
      const mk = fluxo.marcadores[proximoMarcador++]!
      if (mk.antesDe === primeiroToken) {
        saida.push({ id: `cap-${mk.capitulo}`, inicio: mk.inicio, fim: mk.fim, palavras: [] })
      }
    }
    saida.push(a)
  })

  // Janelas contíguas: cada uma vai até o começo da seguinte. Sem isso, o
  // silêncio entre palavras apagaria o realce e produziria uma piscada.
  for (let k = 0; k < saida.length; k++) {
    const a = saida[k]!
    if (!a.palavras.length) continue // marcador: a janela já é a da fala dele
    a.fim = k + 1 < saida.length ? saida[k + 1]!.inicio : fimSecao
    for (let w = 0; w < a.palavras.length; w++) {
      a.palavras[w]!.fim = w + 1 < a.palavras.length ? a.palavras[w + 1]!.inicio : a.fim
    }
  }
  return saida
}

/**
 * O cabeçalho falado da seção ("Contexto.", "Texto Bíblico.", …) vira um alvo
 * sem palavras. Ele não depende do fluxo de tokens — é uma unidade só, com
 * `inicio`/`dur` próprios — então sai mesmo quando o conteúdo não alinha, e
 * mesmo no manifesto antigo sem `palavras`. A janela vai até o 1º alvo de
 * conteúdo quando há um, para o realce passar o bastão sem apagar no vão.
 */
function cabecalho(secao: string, unidade: UnidadeManifesto, conteudo: AlvoAlinhado[]): AlvoAlinhado {
  return {
    id: `cabecalho-${secao}`,
    inicio: unidade.inicio,
    fim: conteudo.length ? conteudo[0]!.inicio : unidade.inicio + unidade.dur,
    palavras: [],
  }
}

/**
 * Casa o manifesto com o que a tela renderizou, token a token. Uma seção cujo
 * fluxo não bata exatamente fica de fora: toca sem realce, e as outras seguem.
 * Os cabeçalhos falados (título, referência, "Contexto.", "Capítulo N.")
 * entram sempre, como alvos sem palavras — a tela os realça inteiros.
 */
export function alinhar(manifesto: Manifesto, secoes: SecaoAlvos[]): Alinhamento {
  const saida: AlvoAlinhado[] = []

  // A seção `titulo` são duas unidades: o título ("A genealogia de Jesus.")
  // e a referência falada ("Mateus, capítulo 1, versículos 1 a 17."). Na tela
  // são dois elementos — o <h1> e o `.ref` — e cada um acende na sua vez;
  // fundir os dois deixaria o <h1> aceso enquanto a voz lê a referência. O
  // título vai até o começo da referência, para não apagar no vão.
  const titulo = manifesto.unidades.filter((u) => u.secao === 'titulo')
  if (titulo.length) {
    const cabeca = titulo[0]!
    const ultima = titulo[titulo.length - 1]!
    const fimTitulo = titulo.length > 1 ? titulo[1]!.inicio : cabeca.inicio + cabeca.dur
    saida.push({ id: 'titulo', inicio: cabeca.inicio, fim: fimTitulo, palavras: [] })
    if (titulo.length > 1) {
      saida.push({ id: 'referencia', inicio: fimTitulo, fim: ultima.inicio + ultima.dur, palavras: [] })
    }
  }

  for (const { secao, alvos } of secoes) {
    const daSecao = manifesto.unidades.filter((u) => u.secao === secao)
    if (!daSecao.length) continue
    // A primeira unidade de toda seção de conteúdo é o cabeçalho falado, que
    // na tela é o <h2>; o resto é o conteúdo.
    const conteudo = alinharConteudo(daSecao.slice(1), alvos)
    saida.push(cabecalho(secao, daSecao[0]!, conteudo), ...conteudo)
  }
  return saida.sort((a, b) => a.inicio - b.inicio)
}
