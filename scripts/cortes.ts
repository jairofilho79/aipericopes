/**
 * Cortes das perícopes grandes demais para serem lidas de uma vez.
 *
 * O critério não é tamanho: é se o trecho tem começo, meio e fim em si. Uma
 * perícope de 89 versículos que é UMA lista (Nm 7) fica inteira; uma de 51 que
 * são três cenas (Gn 43-44) vira três. Por isso 12 das 26 maiores do AT não
 * aparecem aqui — ver docs/estado-cobertura-e-cortes.md para quais e por quê.
 *
 * Cada corte carrega o motivo, porque a fronteira é decisão editorial e quem
 * revisar depois precisa poder discordar do argumento, não adivinhá-lo.
 */

export type Corte = {
  /** Ordem da perícope original no catálogo, que este corte substitui. */
  ordem: number
  /** Referência da original, para conferência contra o dataset. */
  de: string
  partes: {
    /** "cap:ver-cap:ver" dentro do mesmo livro. */
    faixa: string
    /** Título provisório; o material definitivo vem do enriquecimento. */
    titulo: string
  }[]
  motivo: string
}

export const CORTES: Corte[] = [
  {
    ordem: 601,
    de: '2 Samuel 15:1-19:43',
    motivo:
      'A rebelião de Absalão é uma novela com cenas de manual, cada uma com ' +
      'entrada, virada e saída. 165 versículos numa sessão é o oposto de como ' +
      'a narrativa foi construída.',
    partes: [
      { faixa: '15:1-15:12', titulo: 'Absalão rouba o coração de Israel' },
      { faixa: '15:13-15:37', titulo: 'Davi foge de Jerusalém descalço' },
      { faixa: '16:1-16:14', titulo: 'Ziba mente, Simei amaldiçoa' },
      { faixa: '16:15-17:23', titulo: 'O conselho de Aitofel contra a manha de Husai' },
      { faixa: '17:24-18:18', titulo: 'A batalha no bosque e a morte de Absalão' },
      { faixa: '18:19-19:8', titulo: 'A notícia que ninguém queria dar' },
      { faixa: '19:9-19:43', titulo: 'O rei volta, e a briga recomeça' },
    ],
  },
  {
    ordem: 3,
    de: 'Gênesis 4:1-5:32',
    motivo:
      'Caim e Abel é uma cena fechada; as duas genealogias que vêm depois são ' +
      'outra coisa, e a de Sete abre um contraste que se perde se tudo for lido junto.',
    partes: [
      { faixa: '4:1-4:16', titulo: 'Caim e Abel' },
      { faixa: '4:17-4:24', titulo: 'A linhagem de Caim e o canto de Lameque' },
      { faixa: '4:25-4:26', titulo: 'Sete, e o começo da invocação do Nome' },
      { faixa: '5:1-5:32', titulo: 'O livro das gerações de Adão' },
    ],
  },
  {
    ordem: 21,
    de: 'Gênesis 18:16-19:38',
    motivo:
      'Quatro cenas com lugar, elenco e desfecho próprios: a barganha no ' +
      'caminho, a noite em Sodoma, a fuga, e a caverna. A última é uma história ' +
      'que precisa do próprio espaço.',
    partes: [
      { faixa: '18:16-18:33', titulo: 'Abraão pechincha com Deus' },
      { faixa: '19:1-19:11', titulo: 'Os dois hóspedes e a porta de Ló' },
      { faixa: '19:12-19:29', titulo: 'A fuga, e a mulher que olhou para trás' },
      { faixa: '19:30-19:38', titulo: 'Ló e as filhas na caverna' },
    ],
  },
  {
    ordem: 67,
    de: 'Gênesis 43:1-44:17',
    motivo:
      'A viagem, o banquete e a armadilha da taça são três movimentos do mesmo ' +
      'teste, e cada um tem a sua própria tensão e o seu próprio alívio.',
    partes: [
      { faixa: '43:1-43:14', titulo: 'Jacó entrega Benjamim' },
      { faixa: '43:15-43:34', titulo: 'O banquete que José não podia explicar' },
      { faixa: '44:1-44:17', titulo: 'A taça na saca de Benjamim' },
    ],
  },
  {
    ordem: 223,
    de: 'Levítico 25:1-25:55',
    motivo:
      'Duas instituições distintas com uma terceira seção de aplicação: o ano ' +
      'sabático da terra, o jubileu, e as regras de resgate que derivam dele.',
    partes: [
      { faixa: '25:1-25:7', titulo: 'O descanso da terra' },
      { faixa: '25:8-25:24', titulo: 'O jubileu: a terra volta para quem é' },
      { faixa: '25:25-25:55', titulo: 'Resgatar o parente empobrecido' },
    ],
  },
  {
    ordem: 283,
    de: 'Números 23:1-24:25',
    motivo:
      'São quatro oráculos, e cada um vem embrulhado na própria moldura ' +
      'narrativa: Balaque leva Balaão a outro lugar, monta altares, sacrifica, ' +
      'e só então o profeta fala. A moldura é parte da unidade.',
    partes: [
      { faixa: '23:1-23:12', titulo: 'Primeiro oráculo: não se amaldiçoa quem Deus não amaldiçoou' },
      { faixa: '23:13-23:26', titulo: 'Segundo oráculo: Deus não é homem para mentir' },
      { faixa: '23:27-24:9', titulo: 'Terceiro oráculo: que boas são as suas tendas' },
      { faixa: '24:10-24:25', titulo: 'Quarto oráculo: a estrela que vem de Jacó' },
    ],
  },
  {
    ordem: 298,
    de: 'Números 31:1-31:54',
    motivo: 'Uma campanha militar e, depois dela, uma contabilidade. Gêneros diferentes.',
    partes: [
      { faixa: '31:1-31:24', titulo: 'A guerra contra Midiã' },
      { faixa: '31:25-31:54', titulo: 'A partilha dos despojos' },
    ],
  },
  {
    ordem: 1086,
    de: 'Jó 27:1-28:28',
    motivo:
      'O capítulo 28 é o Hino à Sabedoria — um poema autônomo, com pergunta ' +
      '("mas onde se achará a sabedoria?"), desenvolvimento e resposta. Colá-lo ' +
      'ao juramento do capítulo 27 apaga que ele é outra voz.',
    partes: [
      { faixa: '27:1-27:23', titulo: 'Jó não abre mão da própria integridade' },
      { faixa: '28:1-28:28', titulo: 'Onde se acha a sabedoria?' },
    ],
  },
  {
    ordem: 1087,
    de: 'Jó 29:1-31:40',
    motivo:
      'Três movimentos que o próprio texto marca: como eu era, como estou, e o ' +
      'juramento — que fecha com "aqui terminam as palavras de Jó".',
    partes: [
      { faixa: '29:1-29:25', titulo: 'Quando eu era respeitado no portão' },
      { faixa: '30:1-30:31', titulo: 'Agora riem de mim os filhos deles' },
      { faixa: '31:1-31:40', titulo: 'O juramento de inocência' },
    ],
  },
  {
    ordem: 1134,
    de: 'Provérbios 25:1-29:27',
    motivo:
      'Antologia copiada, não composição — 25:1 diz isso de si mesma. Não tem ' +
      'arco para preservar, mas tem costura editorial entre as duas metades: ' +
      '25-27 é imagético e agrário (comparações, "como maçãs de ouro"); 28-29 ' +
      'muda de registro para antítese justo × ímpio e realeza. Unidade ' +
      'editorial, e a spec assume isso por escrito em vez de fingir narrativa.',
    partes: [
      { faixa: '25:1-27:27', titulo: 'Provérbios de Ezequias: as comparações' },
      { faixa: '28:1-29:27', titulo: 'Provérbios de Ezequias: o justo e o ímpio' },
    ],
  },
  {
    ordem: 1267,
    de: 'Jeremias 4:5-6:30',
    motivo:
      'Três oráculos sobre a mesma ameaça, cada um com o próprio ângulo: o ' +
      'alarme, a devassa nas ruas, e o cerco. Sem fórmula de abertura nova no ' +
      'meio, mas cada capítulo é uma peça inteira.',
    partes: [
      { faixa: '4:5-4:31', titulo: 'Toquem a trombeta: vem do Norte' },
      { faixa: '5:1-5:31', titulo: 'Procurem um só que faça o que é certo' },
      { faixa: '6:1-6:30', titulo: 'O cerco, e a prata que o fogo não purificou' },
    ],
  },
  {
    ordem: 1268,
    de: 'Jeremias 7:1-10:25',
    motivo:
      'Cortado pelas fórmulas que o próprio texto traz: 7:1 "Palavra que foi ' +
      'dita a Jeremias da parte do SENHOR" abre o Sermão do Templo, que corre ' +
      'até o Vale da Matança; 10:1 "Ouçam a palavra que o SENHOR dirige a ' +
      'vocês" abre outro endereçamento.',
    partes: [
      { faixa: '7:1-8:3', titulo: 'O Sermão do Templo' },
      { faixa: '8:4-9:26', titulo: 'Quem dera a minha cabeça se tornasse em águas' },
      { faixa: '10:1-10:25', titulo: 'O espantalho no pepinal e o Deus vivo' },
    ],
  },
  {
    ordem: 1272,
    de: 'Jeremias 15:10-17:27',
    motivo:
      '16:1 traz a fórmula "A palavra do SENHOR veio a mim, dizendo", e 17:19 ' +
      'abre o oráculo do portão. Quatro unidades: a confissão, a proibição de ' +
      'casar, o coração enganoso e o sábado.',
    partes: [
      { faixa: '15:10-15:21', titulo: 'Ai de mim, minha mãe, que me deu à luz' },
      { faixa: '16:1-16:21', titulo: 'O profeta proibido de casar e de chorar' },
      { faixa: '17:1-17:18', titulo: 'O coração é enganoso — quem pode conhecê-lo?' },
      { faixa: '17:19-17:27', titulo: 'O portão, e o sábado que ninguém guardou' },
    ],
  },
  {
    ordem: 1273,
    de: 'Jeremias 18:1-20:17',
    motivo:
      'Três atos-sinal com moldura própria: 18:1 abre com a fórmula da palavra ' +
      'e a descida à casa do oleiro; 19:1 manda comprar o pote e quebrá-lo; ' +
      '20:1 muda para narrativa, com Pasur pondo o profeta no tronco.',
    partes: [
      { faixa: '18:1-18:23', titulo: 'A casa do oleiro' },
      { faixa: '19:1-19:15', titulo: 'O pote quebrado no Vale de Hinom' },
      { faixa: '20:1-20:17', titulo: 'Pasur, o tronco, e o fogo nos ossos' },
    ],
  },
]

/**
 * Salmos. Não entra na tabela acima porque é regra, não enumeração: um salmo é
 * uma perícope. As três exceções são do texto, não de conveniência.
 */
export const SALMOS_JUNTOS: [number, number][] = [
  // Acróstico único partido pela numeração grega/hebraica.
  [9, 10],
  // Um salmo só: mesmo refrão três vezes, e o 43 não tem sobrescrito próprio.
  [42, 43],
]

/** Sl 119 fica inteiro: a estrofe acróstica é unidade formal, não de sentido. */
export const SALMOS_INTEIROS = [119]

/** Faixas de Salmos, em ordem canônica: 148 perícopes a partir de 150 salmos. */
export function faixasDeSalmos(): { faixa: string; salmos: number[] }[] {
  const juntos = new Map<number, number>()
  for (const [a, b] of SALMOS_JUNTOS) juntos.set(a, b)
  const out: { faixa: string; salmos: number[] }[] = []
  for (let s = 1; s <= 150; s++) {
    const fim = juntos.get(s)
    if (fim !== undefined) {
      out.push({ faixa: `${s}:1-${fim}:FIM`, salmos: [s, fim] })
      s = fim
    } else {
      out.push({ faixa: `${s}:1-${s}:FIM`, salmos: [s] })
    }
  }
  return out
}
