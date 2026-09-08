/**
 * Correções de defeito da fonte na Bíblia Livre.
 *
 * **Método.** Nenhuma correção entrou aqui por julgamento meu. Cada uma foi
 * conferida contra duas testemunhas independentes:
 *
 * - a **KJV** (`data/raw/PericopeGroupedKJVVerses.json`, o mesmo dataset de onde
 *   vêm os limites das perícopes) — inglês, mas da mesma linhagem textual
 *   Textus Receptus da BLIVRE;
 * - a **Almeida de 1911**, domínio público, que é a *ancestral* da Bíblia Livre
 *   — a BLIVRE é uma modernização da Almeida de 1819.
 *
 * Onde as duas concordam contra a BLIVRE, é defeito da BLIVRE. Onde alguma
 * discorda, não se mexe. A comparação já derrubou dois candidatos: `cada um um
 * cordeiro` (Êx 12:3) e `cada um um bolo` (1Cr 16:3) parecem duplicata e são
 * português correto — a Almeida 1911 traz igual.
 *
 * **Nada aparece na tela.** Não há marcação de "aqui foi corrigido": o leitor
 * fica com a história, não com o aparato crítico.
 *
 * Toda correção é verificada antes de aplicar. Se a fonte mudar e o defeito não
 * estiver mais lá, isto LANÇA em vez de aplicar às cegas.
 */

/**
 * Palavra repetida por engano de digitação: `sobre sobre vós`. A segunda sai.
 *
 * O pronome enclítico NÃO entra aqui — `tirou-o o SENHOR`, `traga-a a ti`,
 * `puseram-no no cárcere` são português correto, e são 66 casos. Nem `se se`
 * (condicional + reflexivo: "se se circuncidar").
 */
export const DUPLICADAS: [string, string][] = [
  // A regra do cabeçalho tem uma exceção achada na produção: `se se` é
  // português correto na condicional ("se se circuncidar"), mas em Ef 5:13
  // — "tudo o que se se torna visível é luz" — não há condicional nenhuma, e
  // o segundo `se` é digitação. Entrou depois de eu conferir a frase inteira.
  ['EPH 5:13', 'se'],
  ['NUM 16:33', 'a'],
  ['JDG 6:34', 'a'],
  ['1KI 1:51', 'que'],
  ['1KI 3:21', 'que'],
  ['1KI 11:31', 'que'],
  ['1KI 13:3', 'que'],
  ['1CH 5:1', 'de'],
  ['2CH 9:6', 'que'],
  ['2CH 22:9', 'para'],
  ['EZR 2:34', 'de'],
  ['EZR 6:10', 'ao'],
  ['NEH 2:12', 'o'],
  ['JOB 2:1', 'e'],
  ['JOB 13:11', 'sobre'],
  ['JOB 20:2', 'meus'],
  ['PRO 22:1', 'o'],
  ['PRO 23:25', 'te'],
  ['ISA 1:25', 'minha'],
  ['ISA 8:5', 'a'],
  ['ISA 43:9', 'isto'],
  ['ISA 53:12', 'e'],
  ['ISA 58:4', 'vossa'],
  ['ISA 65:5', 'de'],
  ['ISA 66:14', 'do'],
  ['JER 6:10', 'que'],
  ['JER 7:20', 'que'],
  ['JER 9:7', 'que'],
  ['JER 14:9', 'nós'],
  ['JER 17:16', 'ser'],
  ['EZE 8:4', 'a'],
  ['EZE 17:18', 'todas'],
  ['EZE 28:2', 'de'],
  ['EZE 47:9', 'este'],
  ['DAN 5:16', 'puderes'],
  ['DAN 8:27', 'do'],
  ['JOE 2:14', 'de'],
  ['AMO 1:5', 'de'],
  ['AMO 6:10', 'da'],
  ['HAB 1:14', 'como'],
  ['LUK 11:8', 'seu'],
  ['LUK 23:47', 'o'],
  ['JOH 10:15', 'também'],
  ['ACT 14:16', 'os'],
  ['ACT 21:27', 'quase'],
  ['GAL 2:2', 'eu'],
  ['2PE 1:14', 'meu'],
  ['REV 2:8', 'o'],
  ['REV 21:1', 'e'],
]

/**
 * Fecha-parênteses sem abertura em lugar nenhum do capítulo: `que se façam
 * franjas) nos arremates`. Nem a KJV nem a Almeida 1911 têm parêntese nesses
 * pontos — é sujeira de diagramação. Some o caractere; nenhuma palavra muda.
 */
export const PARENTESES_ORFAOS: string[] = [
  'LEV 8:13',
  'NUM 15:38',
  'JER 17:5',
  'JER 17:23',
  'LAM 1:19',
  'LAM 3:36',
  'EZE 22:10',
  'MAT 23:5',
  'JOH 2:6',
  'HEB 10:29',
  'REV 17:14',
]

/**
 * Versículos que terminam sem pontuação nenhuma e cuja frase ACABA ali.
 *
 * São 30 no arquivo, e a tentação era pôr ponto nos trinta. Sete não podem
 * levar: a frase continua no versículo seguinte — Gl 1:15 (`se agradou` /
 * `de revelar o seu Filho em mim`), Jó 31:17, Sl 49:8, Jr 33:10, Jo 4:1,
 * Rm 9:10 e Ef 5:8. Nesses o ponto seria erro meu, não conserto, e eles ficam
 * como estão: a leitura corre para o versículo seguinte porque a frase corre.
 *
 * Os 23 daqui foram decididos um a um olhando o começo do versículo seguinte —
 * `E foi o dilúvio`, `Porém agora não o absolverás`, `Eles, quando a viram` —
 * e conferidos contra as duas testemunhas, que pontuam o fim da frase nos 23.
 * Sem o ponto a narração emenda duas frases numa só.
 */
export const PONTO_FINAL_PERDIDO: string[] = [
  'GEN 7:16', 'NUM 8:14', 'DEU 5:14', 'JOS 6:13', 'JDG 18:17', '1KI 2:8',
  '1KI 12:32', '1CH 25:1', '2CH 8:14', '2CH 28:9', 'PSA 48:4', 'ECC 7:1',
  'JER 2:8', 'JER 39:9', 'EZE 3:26', 'EZE 21:7', 'DAN 3:11', 'DAN 9:24',
  'ZEC 8:17', 'ZEC 13:4', 'ROM 9:31', '2CO 1:6', '2CO 6:2',
]

/** Fim de versículo que já tem pontuação — aspa e parêntese contam. */
const JA_PONTUADO = /[.!?;:,”)\]’]\s*$/

export type Correcao = {
  ref: string
  /** Trecho exato a encontrar. Guard: se não casar, a fonte mudou. */
  de: string
  para: string
  motivo: string
}

/** As que não cabem numa regra — cada uma conferida à mão. */
export const CORRECOES: Correcao[] = [
  {
    ref: 'PSA 125:1',
    de: 'Os que confiam no SENHOR',
    para: 'Cântico dos degraus:Os que confiam no SENHOR',
    motivo:
      'É o único dos quinze Cantares dos Degraus (Sl 120–134) sem o sobrescrito. ' +
      'A KJV traz "A Song of degrees." e a própria fonte escreve "Cântico dos degraus" ' +
      'nos outros catorze — a string vem dela, não de mim.',
  },
  {
    ref: 'PSA 80:1',
    de: 'Samo de Asafe',
    para: 'Salmo de Asafe',
    motivo:
      'Erro de digitação no sobrescrito: "Samo". A própria fonte escreve "Salmo" ' +
      'em 75 dos outros sobrescritos, e a KJV traz "A Psalm of Asaph".',
  },
  {
    ref: 'PSA 75:1',
    de: 'conforme “altachete”',
    para: 'conforme “Altachete”',
    motivo:
      'Nome próprio da melodia, que a própria fonte capitaliza como "Altachete" ' +
      'nos Salmos 57, 58 e 59. Só aqui saiu em minúscula.',
  },
  {
    ref: 'PSA 150:3',
    de: 'com com de trombeta',
    para: 'com som de trombeta',
    motivo:
      'Não é duplicata, é uma letra corrompida: a KJV traz "with the sound of the ' +
      'trumpet" e a Almeida 1911 "com o som de trombeta". O paralelismo do próprio ' +
      'versículo confirma ("louvai-o com lira e harpa").',
  },
  {
    ref: 'EXO 2:19',
    de: 'deu de beber as as ovelhas',
    para: 'deu de beber às ovelhas',
    motivo:
      'A duplicata pede crase, não simples remoção: "beber as ovelhas" ficaria ' +
      'agramatical. A KJV traz "watered the flock" e a Almeida 1911 "abeberou o rebanho".',
  },
  {
    ref: '1SA 20:42',
    de: 'para sempre.',
    para: 'para sempre. Então Davi se levantou e se foi; e Jônatas entrou na cidade.',
    motivo:
      'A BLIVRE perdeu o fecho da cena, que as duas testemunhas trazem: a KJV, ' +
      '"And he arose and departed: and Jonathan went into the city."; a Almeida 1911, ' +
      '"Então se levantou David, e se foi; e Jonathan entrou na cidade." A frase aqui é ' +
      'essa da Almeida 1911 com a ortografia e os nomes atualizados — não é tradução minha.',
  },

  // ── Achados LENDO o texto, perícope por perícope, e por varredura de palavra
  // suspeita (`scripts/palavras-suspeitas.ts`). Os seis primeiros mudam o
  // sentido; os dez seguintes são letra trocada, e oito deles estão em livros
  // que nenhum leitor humano tinha aberto ainda.

  {
    ref: 'LUK 14:11',
    de: 'Porque qualquer que exaltar a si mesmo, e aquele que humilhar a si mesmo, será exaltado.',
    para: 'Porque qualquer que exaltar a si mesmo será humilhado, e aquele que humilhar a si mesmo será exaltado.',
    motivo:
      'A oração "será humilhado" caiu, e as duas metades da frase ficaram com o mesmo desfecho — o versículo afirma o contrário do que diz. KJV: "whosoever exalteth himself shall be abased"; Almeida 1911: "qualquer que a si mesmo se exaltar será humilhado". Esta é a ÚNICA correção do catálogo que acrescenta palavras, e a redação restaurada não é minha: é a que a própria Bíblia Livre usa nos dois paralelos, Lc 18:14 e Mt 23:12.',
  },
  {
    ref: 'LUK 21:18',
    de: 'cabeça parecerá',
    para: 'cabeça perecerá',
    motivo:
      'Promessa de proteção virou frase sem pé, no meio de um trecho sobre perseguição. KJV "perish"; Almeida 1911 "não perecerá nem um cabello".',
  },
  {
    ref: 'LUK 20:46',
    de: 'querem andar roupas compridas',
    para: 'querem andar com roupas compridas',
    motivo: 'Falta a preposição. KJV "walk in long robes"; Almeida 1911 "andar com vestidos compridos".',
  },
  {
    ref: 'ACT 4:32',
    de: 'era de um só oração',
    para: 'era de um só coração',
    motivo:
      'Caiu o "c". A própria concordância denuncia: "um só oração" não fecha. KJV "of one heart and of one soul"; Almeida 1911 "era um o coração e a alma".',
  },
  {
    ref: 'ACT 17:24',
    de: 'não habita em tempos feitos por mãos',
    para: 'não habita em templos feitos por mãos',
    motivo:
      'O erro inverte o argumento do discurso no areópago, que é justamente sobre lugar. KJV "dwelleth not in temples made with hands"; Almeida 1911 "não habita em templos feitos por mãos" — e a própria fonte escreve "templos" certo em At 7:48, na mesma construção.',
  },
  {
    ref: 'ACT 25:12',
    de: 'Então Paulo, tendo conversado com o Conselho',
    para: 'Então Festo, tendo conversado com o Conselho',
    motivo:
      'Do jeito que está, Paulo confere com o conselho e responde ao próprio apelo. KJV "Then Festus, when he had conferred with the council"; Almeida 1911 "Então Festo, tendo fallado com o conselho".',
  },

  {
    ref: 'PHM 1:25',
    de: 'Jesus Cirsto',
    para: 'Jesus Cristo',
    motivo:
      'Letras trocadas no nome. KJV "the Lord Jesus Christ"; Almeida 1911 "nosso Senhor Jesus Christo". Este versículo acumula duas correções: a subscrição de escriba e este erro.',
  },
  { ref: 'REV 2:24', de: 'esta dourina', para: 'esta doutrina', motivo:
      'Caiu o "t". KJV "as many as have not this doctrine"; Almeida 1911 "não teem esta doutrina".' },
  {
    ref: 'REV 6:1',
    de: 'quando o Coreiro abriu',
    para: 'quando o Cordeiro abriu',
    motivo:
      'Caiu o "d" no nome da figura central do Apocalipse, na primeira aparição dela no capítulo. KJV "the Lamb"; Almeida 1911 "o Cordeiro".',
  },
  {
    ref: 'REV 6:5',
    de: 'abriu o terceiro celo',
    para: 'abriu o terceiro selo',
    motivo: 'Caiu o "s". O versículo 1 do mesmo capítulo escreve "selos" certo. Almeida 1911 "o terceiro sello".',
  },
  { ref: 'REV 6:15', de: 'e os rigos', para: 'e os ricos', motivo: 'Letra trocada. KJV "the rich men"; Almeida 1911 "os ricos".' },
  { ref: '2TI 2:16', de: 'inútes', para: 'inúteis', motivo:
      'Caiu o "i". KJV "shun profane and vain babblings"; Almeida 1911 "clamores vãos e profanos" — as duas trazem o adjetivo, e "inútes" não existe.' },
  {
    ref: 'HEB 11:34',
    de: 'tonaram-se fortes',
    para: 'tornaram-se fortes',
    motivo:
      'Caiu o "r". KJV "waxed valiant in fight"; Almeida 1911 "na batalha se esforçaram" — as duas trazem o verbo, e "tonaram" não existe em português.',
  },
  {
    ref: 'EPH 5:31',
    de: 'deixará oseu pai',
    para: 'deixará o seu pai',
    motivo:
      'Palavras coladas. KJV "shall a man leave his father"; Almeida 1911 "deixará o homem seu pae" — as duas separam o artigo.',
  },
  // ── Não-palavras: a segunda testemunha aqui é a PRÓPRIA FONTE, que grafa a
  // forma certa em outro lugar. Conferi as contagens no corpus antes de
  // escrever cada uma. (`hava` também aparece em 2Rs 17:24, mas ali é o nome
  // da cidade de Ava, que a KJV confirma — não entrou.)

  {
    ref: 'LUK 1:63',
    de: 'todos se surpeenderam',
    para: 'todos se surpreenderam',
    motivo: 'Caiu o "r". A própria fonte grafa "surpreenderam" corretamente em outro versículo.',
  },
  {
    ref: 'LUK 2:48',
    de: 'ficarm surpresos',
    para: 'ficaram surpresos',
    motivo: 'Caiu o "a". A própria fonte grafa "ficaram" 65 vezes no corpus.',
  },
  {
    ref: 'LUK 3:1',
    de: 'Herodes tetraca da Galileia',
    para: 'Herodes tetrarca da Galileia',
    motivo:
      'Caiu o "r". A própria fonte grafa "tetrarca" 6 vezes, duas delas neste mesmo versículo.',
  },
  {
    ref: 'LUK 9:40',
    de: 'que o exupulsassem',
    para: 'que o expulsassem',
    motivo: 'Letras a mais. A própria fonte grafa "expulsassem" corretamente em outro versículo.',
  },
  {
    ref: 'LUK 21:15',
    de: 'não posam',
    para: 'não possam',
    motivo: 'Caiu o "s". A própria fonte grafa "possam" 12 vezes no corpus.',
  },
  {
    ref: 'LUK 12:28',
    de: 'amanhá é lançada no forno',
    para: 'amanhã é lançada no forno',
    motivo: 'Acento no lugar do til. A própria fonte grafa "amanhã" 72 vezes no corpus.',
  },
  {
    ref: 'LUK 9:33',
    de: 'estavam saíndo da presença dele',
    para: 'estavam saindo da presença dele',
    motivo: 'Acento indevido. A própria fonte grafa "saindo" 42 vezes no corpus.',
  },
  {
    ref: 'LUK 4:25',
    de: 'hava muitas viúvas em Israel',
    para: 'havia muitas viúvas em Israel',
    motivo: 'Caiu o "i". A própria fonte grafa "havia" 1.324 vezes no corpus.',
  },
  {
    ref: 'PSA 89:38',
    de: 'Porém tu te rebelaste, e [o] rejeitaste',
    para: 'Porém tu o aborreceste, e [o] rejeitaste',
    motivo:
      'A fonte põe DEUS se rebelando, o que nenhuma testemunha sustenta: KJV "But thou hast cast off and abhorred"; Almeida 1911 "Porém tu rejeitaste e aborreceste". A palavra que entra é a da Almeida, não uma escolha minha — é a tradução ancestral da Bíblia Livre e domínio público, e trocar só o verbo errado mantém o resto do versículo intacto.',
  },
  {
    ref: 'PSA 109:12',
    de: 'Haja ninguém que tenha piedade dele, e haja ninguém',
    para: 'Não haja ninguém que tenha piedade dele, e não haja ninguém',
    motivo:
      'Falta a negação nas duas metades, e "Haja ninguém" nem é português. KJV "Let there be none to extend mercy unto him"; Almeida 1911 "Não haja ninguem que se compadeça d\'elle".',
  },
  {
    ref: 'NUM 31:34',
    de: 'E setenta e um mil asnos',
    para: 'E sessenta e um mil asnos',
    motivo:
      'O primeiro defeito NUMÉRICO do catálogo, e ele tem três testemunhas. A KJV traz "threescore and one thousand asses" (61.000). A aritmética do próprio capítulo prova o mesmo: os versículos 39 e 45 dividem o rebanho em duas metades de "trinta mil e quinhentos", o que exige 61.000 e não 71.000. Achado por um subagent que conferiu a conta em vez de recitar a lista.',
  },
  {
    ref: '2SA 16:9',
    de: 'Por que almadiçoa este cão morto',
    para: 'Por que amaldiçoa este cão morto',
    motivo:
      'Letras trocadas. A própria fonte grafa "amaldiçoa" 9 vezes; "almadiçoa" só aparece aqui e no versículo seguinte.',
  },
  {
    ref: 'PSA 37:21',
    de: 'O perverso toma emprestado, e paga de volta',
    para: 'O perverso toma emprestado, e não paga de volta',
    motivo:
      'Falta a negação, e sem ela o contraste da frase se desfaz — o perverso passa a fazer o mesmo que o justo. KJV "The wicked borroweth, and payeth not again"; Almeida 1911 "O impio toma emprestado, e não paga".',
  },
  {
    ref: 'PSA 57:3',
    de: 'ao que procura me demorar',
    para: 'ao que procura me devorar',
    motivo:
      'Uma letra, e a frase deixa de fazer sentido. KJV "him that would swallow me up"; Almeida 1911 "o que procura devorar-me".',
  },
  {
    ref: 'PSA 29:3',
    de: 'A voz do SEHOR',
    para: 'A voz do SENHOR',
    motivo:
      'O nome divino grafado errado. A própria fonte escreve "SENHOR" 6.537 vezes, e esta é a única ocorrência de "SEHOR" no corpus inteiro.',
  },
  {
    ref: 'PSA 33:22',
    de: 'tua bondade, SENOR',
    para: 'tua bondade, SENHOR',
    motivo:
      'O nome divino grafado errado. A própria fonte escreve "SENHOR" 6.537 vezes, e esta é a única ocorrência de "SENOR" no corpus inteiro.',
  },
  {
    ref: 'GEN 19:26',
    de: 'se tornou estátua de sai',
    para: 'se tornou estátua de sal',
    motivo:
      'Uma letra num dos versículos mais conhecidos da Bíblia, e "sai" não é palavra naquela posição. KJV "she became a pillar of salt"; Almeida 1911 "ficou convertida n\'uma estatua de sal" — e a própria fonte grafa "sal" 29 vezes.',
  },
  {
    ref: 'REV 17:4',
    de: 'e adorada com ouro',
    para: 'e adornada com ouro',
    motivo:
      'Caiu o "n", e o verbo trocado muda a frase de enfeite para culto. A própria fonte grafa "adornada" 5 vezes, inclusive na mesma construção em Ap 18:16.',
  },
  {
    ref: 'REV 3:4',
    de: 'Mas também em Sardo',
    para: 'Mas também em Sardes',
    motivo:
      'Nome da cidade trocado. A própria fonte grafa "Sardes" nas outras duas ocorrências (Ap 1:11 e 3:1), e a carta inteira é endereçada a ela.',
  },
  {
    ref: 'REV 2:14',
    de: 'colocarmeios',
    para: 'colocar meios',
    motivo:
      'Palavras coladas. KJV "to cast a stumblingblock"; Almeida 1911 "pôr tropeço" — as duas trazem verbo e objeto separados.',
  },
  {
    ref: '1PE 2:20',
    de: 'e suportais, isso é a Deus',
    para: 'e suportais, isso é agradável a Deus',
    motivo:
      'Caiu a palavra do predicado e a frase não fecha. KJV "this is acceptable with God"; Almeida 1911 "isso é agradavel a Deus".',
  },
  {
    ref: '2PE 3:16',
    de: 'em duas as [suas] cartas',
    para: 'em todas as [suas] cartas',
    motivo:
      'Como está, o texto afirma que Paulo escreveu DUAS cartas. KJV "as also in all his epistles"; Almeida 1911 "em todas as suas epistolas".',
  },
  {
    ref: '1JO 2:26',
    de: 'acerca dos que vos tentam vos enganar',
    para: 'acerca dos que tentam vos enganar',
    motivo:
      '"vos" duplicado. KJV "concerning them that seduce you"; Almeida 1911 "ácerca dos que vos enganam" — nas duas o pronome aparece uma vez só.',
  },
  {
    ref: 'REV 1:13',
    de: 'semelhante a [o] Filho',
    para: 'semelhante ao Filho',
    motivo:
      'Contração perdida. KJV "like unto the Son of man"; Almeida 1911 "semelhante ao Filho do homem". Varri o padrão inteiro antes de escrever isto: há só dois casos de preposição seguida de artigo entre colchetes, e o outro (Is 1:14, "cansado de as suportar") é português correto — por isso a correção é pontual e não virou regra.',
  },
  {
    ref: 'JUD 1:11',
    de: 'por interesse por [interesse de] lucro',
    para: 'por [interesse de] lucro',
    motivo:
      '"por interesse" duplicado. KJV "ran greedily after the error of Balaam for reward"; Almeida 1911 "se lançaram no erro de Balaão por interesse". Não entra em DUPLICADAS porque a segunda ocorrência está partida por colchete.',
  },
  {
    ref: 'HEB 13:3',
    de: 'Lembrai-vos dos prisoneiros',
    para: 'Lembrai-vos dos prisioneiros',
    motivo: 'Caiu o "i". A própria fonte grafa "prisioneiros" nas outras 17 ocorrências do corpus.',
  },
  {
    ref: 'JAM 1:13',
    de: 'e ele mesmo tenta ninguém',
    para: 'e ele mesmo a ninguém tenta',
    motivo:
      'Falta a negação, e sem ela o versículo afirma que Deus tenta — o contrário exato do que a frase inteira sustenta. KJV "neither tempteth he any man"; Almeida 1911 "e a ninguem tenta".',
  },
  {
    ref: 'ROM 15:19',
    de: 'no poder do Espíritode Deus',
    para: 'no poder do Espírito de Deus',
    motivo:
      'Palavras coladas. KJV "by the power of the Spirit of God"; Almeida 1911 "pelo poder do Espirito de Deus" — e a própria fonte separa as duas em todas as outras ocorrências.',
  },
  { ref: 'AMO 9:14', de: 'meu povo Isarael', para: 'meu povo Israel', motivo: 'Letras trocadas no nome do povo. KJV "my people of Israel".' },
  {
    ref: 'HOS 1:1',
    de: 'nos dias de Joeroboão',
    para: 'nos dias de Jeroboão',
    motivo:
      'Letra a mais no nome do rei. KJV "Jeroboam"; Almeida 1911 "Jeroboão" — e a própria fonte grafa "Jeroboão" certo nas dezenas de outras ocorrências.',
  },

  // --- Ortografia provada pela própria fonte ---
  // Para erro de acento a regra das duas testemunhas é canhão em passarinho,
  // e pior: a Almeida de 1911 é anterior às reformas ortográficas, então ela
  // grafa `benção` e `fossemos` sem que isso queira dizer nada. A testemunha
  // boa aqui é a Bíblia Livre contra si mesma — ela escreve `princípio` 98
  // vezes e `principio` 2. Contar é mais firme do que interpretar.
  { ref: 'PRO 1:7', de: 'o principio do conhecimento',
    para: 'o princípio do conhecimento',
    motivo: 'A testemunha aqui é a própria fonte: a Bíblia Livre escreve `princípio` 98 vezes e `principio` 2. Não é decisão de tradução, é grafia da casa.' },
  { ref: 'REV 22:13', de: 'o principio e o fim',
    para: 'o princípio e o fim',
    motivo: 'Mesmo caso de Pv 1:7: a própria fonte escreve `princípio` 98 vezes contra 2 sem acento.' },
  { ref: 'ACT 13:2', de: 'o Espirito Santo',
    para: 'o Espírito Santo',
    motivo: 'A própria fonte escreve `Espírito` 598 vezes. Esta é a única sem acento.' },
  { ref: 'MAT 7:17', de: 'a arvore má',
    para: 'a árvore má',
    motivo: 'A própria fonte escreve `árvore` 101 vezes e `arvore` uma.' },
  { ref: 'PSA 72:19', de: 'Amem, e amém!',
    para: 'Amém, e amém!',
    motivo: 'A própria fonte escreve `amém` certo na segunda vez, três palavras adiante — ela se contradiz dentro da mesma linha.' },
  { ref: 'JDG 3:19', de: 'E sairam-se',
    para: 'E saíram-se',
    motivo: 'A própria fonte escreve `saíram` 133 vezes contra duas sem o acento, e sem ele a palavra lê-se como outra coisa.' },
  { ref: '1SA 23:13', de: 'e sairam de Queila',
    para: 'e saíram de Queila',
    motivo: 'Mesmo caso de Jz 3:19: a própria fonte escreve `saíram` 133 vezes e sem acento só duas.' },
  { ref: 'ISA 43:7', de: 'para minha gloria',
    para: 'para minha glória',
    motivo: 'A própria fonte escreve `glória` 354 vezes e `gloria` duas.' },
  { ref: 'REV 20:8', de: 'dos quais o numero',
    para: 'dos quais o número',
    motivo: 'A própria fonte escreve `número` 104 vezes, e esta é a única sem acento.' },
  { ref: 'JER 52:4', de: 'no decimo mês',
    para: 'no décimo mês',
    motivo: 'A própria fonte escreve `décimo` 70 vezes, e esta é a única sem acento.' },
  { ref: 'JER 25:36', de: 'dos lideres do rebanho',
    para: 'dos líderes do rebanho',
    motivo: 'A própria fonte escreve `líderes` 65 vezes, e esta é a única sem acento.' },
  { ref: '2TI 3:3', de: 'sem dominio próprio',
    para: 'sem domínio próprio',
    motivo: 'A própria fonte escreve `domínio` 51 vezes, e esta é a única sem acento.' },
  { ref: '2CH 36:21', de: 'de sua ruina',
    para: 'de sua ruína',
    motivo: 'A própria fonte escreve `ruína` 28 vezes, e esta é a única sem acento.' },
  { ref: 'EZE 31:12', de: 'mais terrivel',
    para: 'mais terrível',
    motivo: 'A própria fonte escreve `terrível` 19 vezes, e esta é a única sem acento.' },
  { ref: '1CO 15:52', de: 'à ultima trombeta',
    para: 'à última trombeta',
    motivo: 'A própria fonte escreve `última` 11 vezes, e esta é a única sem acento.' },
  { ref: 'LUK 4:40', de: 'troxeram-lhe',
    para: 'trouxeram-lhe',
    motivo: 'A própria fonte escreve `trouxeram` 40 vezes e `troxeram` uma. É o segundo defeito desta mesma linha, ao lado de `varias`.' },
  { ref: 'LUK 4:40', de: 'de varias doenças',
    para: 'de várias doenças',
    motivo: 'A própria fonte escreve `várias` 10 vezes; no mesmo versículo há ainda `troxeram` por `trouxeram`.' },
  { ref: 'GAL 3:24', de: 'fossemos justificados',
    para: 'fôssemos justificados',
    motivo: 'A Almeida de 1911 também escreve `fossemos`, mas ela é anterior às reformas ortográficas e por isso não serve de testemunha para acento. Quem serve é a própria fonte, que escreve `fôssemos` 10 vezes.' },
  { ref: 'HEB 12:17', de: 'herdar a benção',
    para: 'herdar a bênção',
    motivo: 'Como em Gl 3:24, a Almeida de 1911 grafa `benção` por ser de antes das reformas. A própria fonte escreve `bênção` 58 vezes e `benção` duas.' },
  { ref: 'JAM 3:10', de: 'procedem benção e maldição',
    para: 'procedem bênção e maldição',
    motivo: 'Mesmo caso de Hb 12:17: a própria fonte escreve `bênção` 58 vezes e `benção` duas.' },

  // --- Letra ou espaço, conferidos nas duas testemunhas ---
  { ref: 'ACT 9:4', de: 'ouviu ma voz',
    para: 'ouviu uma voz',
    motivo: 'KJV: "heard a voice"; Almeida: "ouviu uma voz". A letra que caiu é o `u` do artigo, e as duas testemunhas dizem a mesma coisa.' },
  { ref: 'LAM 3:6', de: 'como os que já morrera há',
    para: 'como os que já morreram há',
    motivo: 'KJV: "as they that be dead of old"; Almeida: "como os que estavam mortos ha muito". O sujeito é plural — `os que` —, e nenhuma das duas põe o verbo no futuro.' },
  { ref: 'MAR 12:37', de: 'é so eu filho',
    para: 'é seu filho',
    motivo: 'Um espaço no lugar errado partiu `seu` em duas palavras. Almeida: "como é logo seu filho?"; KJV: "whence is he then his son?". O `pois` que a Bíblia Livre já traz faz o trabalho do `logo`, então só o `seu` precisa voltar.' },
  { ref: 'REV 10:4', de: 'eu estava a pondo de',
    para: 'eu estava a ponto de',
    motivo: 'KJV: "I was about to write". `a pondo de` não é construção do português; `a ponto de` é, e é o que as duas testemunhas dizem.' },
  { ref: 'DEU 4:42', de: 'destas cidades salvara a vida',
    para: 'destas cidades salvasse a vida',
    motivo: '`salvara` é o imperfeito do subjuntivo ESPANHOL — o mesmo rastro de base castelhana que deixou `preguntar` em Dt 13:14 e outros três lugares. Em português a forma é `salvasse`, e é o modo que as duas testemunhas pedem: KJV "that fleeing... he might live", Almeida "e se acolhesse a uma d\'estas cidades, e vivesse".' },

  // --- Pentateuco, Josué e Reis ---
  { ref: 'EXO 25:16', de: 'porás no arca',
    para: 'porás na arca',
    motivo: 'KJV: "put into the ark"; Almeida: "porás na arca". `arca` é feminino em toda a fonte — são cinco lugares com o mesmo tropeço.' },
  { ref: 'EXO 25:21', de: 'e no arca porás',
    para: 'e na arca porás',
    motivo: 'Mesmo tropeço de Êx 25:16, no mesmo versículo em que a fonte já escreve `da arca` certo. KJV: "in the ark"; Almeida: "na arca".' },
  { ref: 'LEV 24:10', de: 'Naquela muita o filho',
    para: 'E o filho',
    motivo: '`Naquela muita` não quer dizer nada em português — é resíduo do castelhano `en aquella sazón`, o mesmo rastro de base espanhola que deixou `preguntar`. Aqui nenhuma das duas testemunhas traz marcador de tempo: KJV "And the son of an Israelitish woman", Almeida "E saiu um filho d\'uma mulher israelita". A leitura testemunhada é simplesmente `E`.' },
  { ref: '1KI 3:16', de: 'Naquela muita vieram',
    para: 'Então vieram',
    motivo: 'O gêmeo de Lv 24:10, e aqui as duas testemunhas trazem o marcador: KJV "Then came there two women", Almeida "Então vieram duas mulheres prostitutas ao rei". A palavra que entra é a da Almeida.' },
  { ref: 'DEU 13:14', de: 'e preguntarás com empenho',
    para: 'e perguntarás com empenho',
    motivo: 'Almeida: "com diligencia perguntarás"; KJV: "ask diligently". `preguntar` é o verbo espanhol — quatro lugares na fonte, todos do mesmo rastro de base castelhana.' },
  { ref: 'DEU 17:9', de: 'e preguntarás;',
    para: 'e perguntarás;',
    motivo: 'Mesmo castelhanismo de Dt 13:14. KJV: "and inquire"; Almeida: "e inquirirás" — o verbo português é `perguntar`, e a fonte o escreve certo em toda parte.' },
  { ref: 'EXO 19:4', de: 'sobre asas de águas',
    para: 'sobre asas de águias',
    motivo: 'KJV: "on eagles\' wings"; Almeida: "sobre azas d\'aguias". A ave virou água em oito lugares da fonte — falta um `i`.' },
  { ref: 'LEV 11:13', de: 'abominação: a água, o quebra-ossos',
    para: 'abominação: a águia, o quebra-ossos',
    motivo: 'É a lista das aves imundas, e água não é ave. KJV: "the eagle, and the ossifrage"; Almeida: "a aguia, e o quebrantosso".' },
  { ref: 'DEU 14:12', de: 'não comereis: a água,',
    para: 'não comereis: a águia,',
    motivo: 'Mesma lista de aves de Lv 11:13. KJV: "the eagle, and the ossifrage"; Almeida: "a aguia, e o quebrantosso".' },
  { ref: 'DEU 28:49', de: 'que voe como água',
    para: 'que voe como águia',
    motivo: 'KJV: "as swift as the eagle flieth"; Almeida: "que vôa como a aguia". Água não voa.' },
  { ref: 'DEU 32:11', de: 'Como a água desperta sua ninhada',
    para: 'Como a águia desperta sua ninhada',
    motivo: 'KJV: "As an eagle stirreth up her nest"; Almeida: "Como a aguia desperta o seu ninho". O versículo inteiro fala de asas e de penas.' },
  { ref: 'JOS 13:5', de: 'Baal-Gade o pdo monte',
    para: 'Baal-Gade ao pé do monte',
    motivo: '`o pdo` é `ao pé do` com as letras comidas. Almeida: "desde Baal-gad, ao pé do monte Hermon"; KJV: "from Baal-gad under mount Hermon".' },
  { ref: 'JOS 13:6', de: 'de Israel:;somente',
    para: 'de Israel; somente',
    motivo: 'Dois sinais de pontuação colados e o espaço perdido. Almeida: "de diante dos filhos de Israel: tão sómente"; KJV: "from before the children of Israel: only". Nada muda de sentido — muda o que a narração vai ler em voz alta.' },
  { ref: 'LEV 25:30', de: 'ficará para sempre por daquele',
    para: 'ficará para sempre daquele',
    motivo: '`por daquele` empilha duas preposições e não é português. KJV: "shall be established forever to him that bought it"; Almeida: "em perpetuidade ficará ao que a comprou".' },
  { ref: 'LEV 25:32', de: 'Porém em quanto às cidades',
    para: 'Porém quanto às cidades',
    motivo: 'Um `em` a mais antes de `quanto às`. Almeida: "Mas, tocante ás cidades dos levitas"; KJV: "Notwithstanding the cities of the Levites".' },
  { ref: 'LEV 25:33', de: 'dos levitas é a possessão deles',
    para: 'dos levitas são a possessão deles',
    motivo: 'O sujeito é `as casas`, plural. KJV: "the houses... are their possession"; Almeida: "as casas das cidades dos levitas são a sua possessão".' },
  { ref: 'LEV 25:44', de: 'que estão em vosso ao redor',
    para: 'que estão ao vosso redor',
    motivo: 'KJV: "that are round about you"; Almeida: "que estão ao redor de vós". As palavras são as mesmas da fonte, postas na ordem que o português pede.' },
  { ref: 'LEV 25:54', de: 'resgatar em esses anos',
    para: 'resgatar nesses anos',
    motivo: '`em esses` é a contração espanhola por fazer — o mesmo rastro de `preguntar`. KJV: "in these years"; Almeida: "se d\'esta sorte se não resgatar".' },
  { ref: 'NUM 23:3', de: 'e qualquer um coisa que me mostrar',
    para: 'e qualquer coisa que me mostrar',
    motivo: 'Um `um` sobrando entre `qualquer` e `coisa`. KJV: "whatsoever he showeth me"; Almeida: "o que me mostrar te notificarei".' },
  { ref: 'NUM 23:19', de: 'não fará?; Falou',
    para: 'não fará? Falou',
    motivo: 'Interrogação e ponto e vírgula colados. KJV: "hath he said, and shall he not do it? or hath he spoken". A pontuação quebrada é o que a narração tropeça.' },
  { ref: 'NUM 24:1', de: 'a encontro de agouros',
    para: 'ao encontro de agouros',
    motivo: 'Almeida: "ao encontro dos encantamentos"; KJV: "to seek for enchantments". Falta a contração do artigo.' },
  { ref: 'NUM 24:21', de: 'na rocha tua ninho',
    para: 'na rocha teu ninho',
    motivo: '`ninho` é masculino. KJV: "thou puttest thy nest in a rock"; Almeida: "pozeste o teu ninho na penha".' },
  { ref: 'NUM 31:9', de: 'e todos suas animais',
    para: 'e todos os seus animais',
    motivo: 'KJV: "the spoil of all their cattle"; Almeida: "tambem roubaram todos os seus animaes". O possessivo estava no feminino e faltava o artigo.' },

  // --- Históricos, Jó, Provérbios e profetas menores ---
  { ref: '1SA 6:19', de: 'olhado no arca',
    para: 'olhado na arca',
    motivo: 'KJV: "looked into the ark"; Almeida: "olharam para dentro da arca". `arca` é feminino, e a fonte erra o gênero em cinco lugares.' },
  { ref: '2KI 12:10', de: 'dinheiro no arca',
    para: 'dinheiro na arca',
    motivo: 'KJV: "much money in the chest"; Almeida: "já havia muito dinheiro na arca". Mesmo tropeço de gênero de Êx 25:16.' },
  { ref: '2CH 24:10', de: 'lançavam no arca',
    para: 'lançavam na arca',
    motivo: 'KJV: "cast into the chest"; Almeida: "a lançaram na arca". Mesmo tropeço de gênero de Êx 25:16.' },
  { ref: '2SA 11:3', de: 'a preguntar por aquela mulher',
    para: 'a perguntar por aquela mulher',
    motivo: 'Almeida: "e perguntou por aquella mulher"; KJV: "and inquired after the woman". `preguntar` é o verbo espanhol, e são quatro lugares na fonte.' },
  { ref: '2CH 18:7', de: 'podemos preguntar ao SENHOR',
    para: 'podemos perguntar ao SENHOR',
    motivo: 'KJV: "by whom we may inquire of the LORD"; Almeida: "por quem podemos consultar ao Senhor". Mesmo castelhanismo de Dt 13:14.' },
  { ref: '2SA 1:23', de: 'Mais ligeiros que águas',
    para: 'Mais ligeiros que águias',
    motivo: 'KJV: "swifter than eagles"; Almeida: "mais ligeiros do que as aguias". O verso seguinte diz `mais fortes que leões` — a comparação é toda de bichos.' },
  { ref: 'JOB 39:27', de: 'que a água voa alto',
    para: 'que a águia voa alto',
    motivo: 'KJV: "Doth the eagle mount up at thy command"; Almeida: "Ou se remonta a aguia ao teu mandado". Água não faz ninho na altura.' },
  { ref: 'ISA 7:15', de: 'Manteiga e mal ele comerá',
    para: 'Manteiga e mel ele comerá',
    motivo: 'KJV: "Butter and honey shall he eat"; Almeida: "Manteiga e mel comerá". O `mal` certo está três palavras adiante, no mesmo versículo — a fonte usa as duas palavras lado a lado e trocou uma.' },
  { ref: 'HOS 1:2', de: 'se prostitui munto',
    para: 'se prostitui muito',
    motivo: 'A própria fonte escreve `muito` 495 vezes e `munto` uma. KJV: "hath committed great whoredom".' },
  { ref: 'HOS 3:3', de: 'nem e eu',
    para: 'e também eu',
    motivo: 'A fonte nega o que as duas testemunhas afirmam: KJV "so will I also be for thee", Almeida "e tambem eu ficarei para ti". O `nem` inverte a promessa de Oseias à mulher — é o décimo defeito do catálogo que muda o sentido.' },
  { ref: 'HOS 10:14', de: 'a mãe foram despedaçada',
    para: 'a mãe foi despedaçada',
    motivo: 'KJV: "the mother was dashed in pieces"; Almeida: "a mãe ali foi despedaçada". Sujeito no singular, verbo no plural.' },
  { ref: 'HOS 11:12', de: 'e era é fiel',
    para: 'e era fiel',
    motivo: 'Dois verbos empilhados. KJV: "and is faithful with the saints"; Almeida: "e com os sanctos está fiel".' },
  { ref: 'ZEC 7:1', de: 'a Zacarias noquarto',
    para: 'a Zacarias no quarto',
    motivo: 'Espaço perdido. KJV: "in the fourth day of the ninth month"; Almeida: "no dia quarto do nono mez".' },
  { ref: 'ZEC 7:13', de: 'assim tamb\u00a0em quando',
    para: 'assim também quando',
    motivo: 'Não é espaço: é um espaço NÃO-SEPARÁVEL (U+00A0) no meio da palavra, o único do arquivo inteiro, e por isso invisível a olho e a `\\s{2,}`. KJV: "so they cried"; Almeida: "assim tambem elles clamaram".' },
  { ref: '2SA 15:7', de: 'voto que ei prometido',
    para: 'voto que hei prometido',
    motivo: 'KJV: "my vow, which I have vowed"; Almeida: "o meu voto que votei ao Senhor". A própria fonte escreve `hei` 75 vezes — é o verbo auxiliar, sem o agá.' },
  { ref: '2SA 16:10', de: 'Ele almadiçoa assim',
    para: 'Ele amaldiçoa assim',
    motivo: 'A própria fonte escreve `amaldiçoa` 8 vezes e `almadiçoa` duas, as duas nesta linha e na anterior — as letras trocadas de lugar. Almeida: "Ora deixae-o amaldiçoar".' },
  { ref: '2SA 16:10', de: 'que almadiçoasse a Davi',
    para: 'que amaldiçoasse a Davi',
    motivo: 'O segundo `almadiçoa` da mesma linha; a fonte escreve `amaldiçoasse` certo em Dt 23:4 e Js 24:9. KJV: "the LORD hath said unto him, Curse David"; Almeida: "Amaldiçôa a David".' },
  { ref: '2SA 18:2', de: 'e a outra terceira parte',
    para: 'e a outra terça parte',
    motivo: 'O mesmo versículo já disse `terça parte` duas vezes antes; na terceira mudou de palavra. KJV repete "a third part" nas três. É a fonte se contradizendo dentro da linha.' },
  { ref: '2SA 19:11', de: 'E el rei Davi',
    para: 'E o rei Davi',
    motivo: '`el rei` é o artigo espanhol, e sobrou em dois lugares da fonte contra centenas de `o rei`. KJV: "And king David sent"; Almeida: "Então o rei David enviou".' },
  { ref: '2KI 23:4', de: 'Então mandou el rei',
    para: 'Então mandou o rei',
    motivo: 'O gêmeo de 2Sm 19:11, e o único outro `el rei` da fonte — achado ao contar a expressão. KJV: "And the king commanded Hilkiah the high priest".' },
  { ref: 'JOB 28:22', de: 'O perdição e a morte',
    para: 'A perdição e a morte',
    motivo: 'Almeida: "A perdição e a morte dizem"; KJV: "Destruction and death say". `perdição` é feminino, e a fonte já põe `a morte` certo ao lado.' },
  { ref: 'JOB 29:10', de: 'apegavam a céu da boca',
    para: 'apegavam ao céu da boca',
    motivo: 'KJV: "their tongue cleaved to the roof of their mouth"; Almeida: "a sua lingua se pegava ao seu paladar". Falta a contração do artigo.' },
  { ref: 'JOB 31:9', de: 'Se foi meu coração se deixou',
    para: 'Se o meu coração se deixou',
    motivo: 'KJV: "If mine heart have been deceived by a woman"; Almeida: "Se o meu coração se deixou seduzir por uma mulher". O `foi` sobra e o artigo falta.' },
  { ref: 'JOB 31:9', de: 'ou se estive espreitei à porta',
    para: 'ou se espreitei à porta',
    motivo: 'Dois verbos para uma ação só. KJV: "or if I have laid wait at my neighbor\'s door"; Almeida: "ou se eu armei traições á porta do meu proximo".' },
  { ref: 'PRO 29:8', de: 'trazem confusão a cidade',
    para: 'trazem confusão à cidade',
    motivo: 'KJV: "bring a city into a snare"; Almeida: "abrazam a cidade". Falta a crase, e sem ela a frase muda de regência.' },
  { ref: 'PRO 29:25', de: 'confia no senhor',
    para: 'confia no SENHOR',
    motivo: 'A própria fonte escreve `SENHOR` em versalete 6.537 vezes para o nome divino, e aqui uma só em minúsculas. KJV: "whoso putteth his trust in the LORD".' },
  { ref: 'PRO 29:27', de: 'O justos odeiam',
    para: 'Os justos odeiam',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "An unjust man is an abomination to the just"; Almeida: "Abominação é para os justos o homem iniquo".' },
  { ref: '1SA 24:19', de: 'o deixará ir saro e salvo',
    para: 'o deixará ir são e salvo',
    motivo: '`saro` não existe: é o castelhano `sano y salvo` na metade do caminho, o mesmo rastro de base espanhola de `preguntar` e `el rei`. KJV: "will he let him go well away?"; Almeida: "o deixaria ir por bom caminho?".' },
  { ref: 'ISA 14:23', de: 'poças d´água',
    para: 'poças d\'água',
    motivo: 'O acento agudo solto no lugar do apóstrofo — o único do arquivo inteiro, achado ao varrer os caracteres invisíveis atrás do espaço não-separável de Zc 7:13. A própria fonte escreve `d\'água` com apóstrofo três vezes. KJV: "pools of water"; Almeida: "lagoas d\'aguas".' },

  // --- Gênesis, Levítico e Jeremias ---
  { ref: 'GEN 19:15', de: 'teus dois filhas',
    para: 'tuas duas filhas',
    motivo: 'KJV: "thy two daughters"; Almeida: "tuas duas filhas". O possessivo e o numeral ficaram no masculino.' },
  { ref: 'GEN 19:17', de: 'nem pares toda esta planície',
    para: 'nem pares em toda esta planície',
    motivo: 'KJV: "neither stay thou in all the plain"; Almeida: "e não pares em toda esta campina". Falta a preposição.' },
  { ref: 'LEV 25:6', de: 'e a tua criado, e a tua estrangeiro',
    para: 'e a teu criado, e a teu estrangeiro',
    motivo: 'O mesmo versículo escreve `a teu servo` certo três palavras antes. KJV: "for thy hired servant, and for thy stranger"; Almeida: "e ao teu jornaleiro, e ao estrangeiro".' },
  { ref: 'LEV 25:7', de: 'e à animal que houver',
    para: 'e ao animal que houver',
    motivo: 'KJV: "and for the beast that are in thy land"; Almeida: "e aos teus animaes, que estão na tua terra". `animal` é masculino, e a fonte já escreve `a teu animal` certo antes.' },
  { ref: 'LEV 25:13', de: 'Em este ano de jubileu',
    para: 'Neste ano de jubileu',
    motivo: '`Em este` é a contração espanhola por fazer — mesmo rastro de `preguntar` e de `em esses anos` em Lv 25:54. Almeida: "N\'este anno do jubileu"; KJV: "In the year of this jubilee".' },
  { ref: 'LEV 25:29', de: 'em cidade cercado',
    para: 'em cidade cercada',
    motivo: 'KJV: "a dwelling house in a walled city"; Almeida: "uma casa de moradia em cidade murada". `cidade` é feminino.' },
  { ref: 'JER 16:5', de: 'nem mostre compaixão deles',
    para: 'nem mostres compaixão deles',
    motivo: 'A fala é toda na segunda pessoa — `não entres`, `nem vás` —, e só este verbo saiu dela. KJV: "neither go to lament nor bemoan them"; Almeida: "nem te compadeças d\'elles".' },
  { ref: 'JER 17:20', de: 'por esta portas',
    para: 'por estas portas',
    motivo: 'KJV: "that enter in by these gates"; Almeida: "que entraes por estas portas". Demonstrativo no singular com substantivo no plural.' },
  { ref: 'JER 20:4', de: 'cairão pelo espada',
    para: 'cairão pela espada',
    motivo: 'KJV: "they shall fall by the sword"; Almeida: "cairão á espada de seus inimigos". `espada` é feminino, e o mesmo versículo escreve `à espada` certo no fim.' },
  { ref: 'JER 4:6', de: 'Erguei bandeia',
    para: 'Erguei bandeira',
    motivo: 'A própria fonte escreve `bandeira` 26 vezes e `bandeia` uma. KJV: "Set up the standard toward Zion"; Almeida: "Arvorae a bandeira para Sião".' },
  { ref: 'JER 6:11', de: 'cheio dá fúria',
    para: 'cheio da fúria',
    motivo: 'Acento onde não cabe: `dá` é verbo, e aqui é a contração `da`. KJV: "I am full of the fury of the LORD"; Almeida: "já estou cheio do furor do Senhor".' },
  { ref: 'JER 6:18', de: 'disto, o multidão',
    para: 'disto, ó multidão',
    motivo: 'É vocativo, e sem o acento vira artigo — e artigo masculino com substantivo feminino. KJV: "and know, O congregation"; Almeida: "e informa-te tu, ó congregação".' },
  { ref: 'JER 6:20', de: 'Vossos holocaustosnão',
    para: 'Vossos holocaustos não',
    motivo: 'Duas palavras coladas, e sem ponto entre elas a limpeza da ETL não as separa. KJV: "your burnt offerings are not acceptable"; Almeida: "vossos holocaustos não me agradam".' },
  { ref: 'JER 7:34', de: 'e da ruas de Jerusalém',
    para: 'e das ruas de Jerusalém',
    motivo: 'KJV: "and from the streets of Jerusalem"; Almeida: "e das ruas de Jerusalem". Artigo no singular com substantivo no plural.' },
  { ref: 'JER 8:5', de: 'de Jerusalém continuam se desviando',
    para: 'de Jerusalém continua se desviando',
    motivo: 'O sujeito é `este povo`, singular. KJV: "Why then is this people of Jerusalem slid back"; Almeida: "Porque pois se desvia este povo de Jerusalem".' },
  { ref: 'JER 8:19', de: 'desde uma da terra distante',
    para: 'desde uma terra distante',
    motivo: 'Duas preposições empilhadas. KJV: "of them that dwell in a far country"; Almeida: "já se ouve da terra mui remota".' },

  // --- Romanos, Coríntios e Gálatas ---
  { ref: 'ROM 4:3', de: 'e isso lhe foi lhe imputado',
    para: 'e isso lhe foi imputado',
    motivo: 'O `lhe` aparece duas vezes. KJV: "and it was counted unto him for righteousness"; Almeida: "e isso lhe foi imputado como justiça".' },
  { ref: 'ROM 7:2', de: 'enquanto o ele viver',
    para: 'enquanto ele viver',
    motivo: 'Um artigo antes do pronome. KJV: "so long as he liveth"; Almeida: "emquanto elle viver".' },
  { ref: 'ROM 8:36', de: 'somos entreges à morte',
    para: 'somos entregues à morte',
    motivo: 'A própria fonte escreve `entregues` 23 vezes e `entreges` uma. Almeida: "somos entregues á morte todo o dia".' },
  { ref: '1CO 1:14', de: 'a Deus que batizei nenhum de vós',
    para: 'a Deus que a nenhum de vós batizei',
    motivo: 'Sem a negação a frase diz o contrário do que Paulo quer dizer. KJV: "I thank God that I baptized none of you"; Almeida: "Dou graças a Deus, porque a nenhum de vós baptizei". A ordem que entra é a da Almeida.' },
  { ref: '1CO 5:2', de: 'vós não deveríeis se entristecer',
    para: 'vós não deveríeis vos entristecer',
    motivo: 'O pronome não concorda com `vós`. KJV: "and have not rather mourned"; Almeida: "e nem ao menos vos entristecestes".' },
  { ref: '1CO 7:5', de: 'outra vez a se juntarem',
    para: 'outra vez a vos juntar',
    motivo: 'A frase é toda na segunda pessoa do plural — `não vos priveis`, `voltai-vos` — e só este verbo saiu dela. KJV: "and come together again"; Almeida: "e depois ajuntae-vos outra vez".' },
  { ref: '1CO 7:21', de: 'podes te tornares livre',
    para: 'podes te tornar livre',
    motivo: 'Dois verbos conjugados onde cabe um só. KJV: "but if thou mayest be made free"; Almeida: "e, se ainda podes ser livre".' },
  { ref: '1CO 7:29', de: 'os que tem mulheres',
    para: 'os que têm mulheres',
    motivo: 'Terceira pessoa do plural leva acento. KJV: "they that have wives"; Almeida: "os que teem mulheres".' },
  { ref: '1CO 10:23', de: 'me são licitas, mas nem todas as coisas edificam',
    para: 'me são lícitas, mas nem todas as coisas edificam',
    motivo: 'A própria fonte escreve `lícitas` com acento na primeira metade deste versículo e sem acento na segunda — ela se contradiz dentro da linha, e no arquivo inteiro grafa `lícitas` 3 vezes e `licitas` uma.' },
  { ref: '1CO 11:8', de: 'o homem não provem da mulher',
    para: 'o homem não provém da mulher',
    motivo: 'A própria fonte escreve `provém` com acento em toda parte. Almeida: "Porque o varão não provém da mulher".' },
  { ref: '1CO 12:24', de: 'os nosso mais respeitáveis',
    para: 'os nossos mais respeitáveis',
    motivo: 'Possessivo no singular com artigo no plural. KJV: "For our comely parts have no need"; Almeida: "Porque os que em nós são mais honestos".' },
  { ref: '1CO 14:15', de: 'Então é o que?',
    para: 'Então, o que é?',
    motivo: 'As palavras estão fora de ordem. KJV: "What is it then?"; Almeida: "Que farei pois?".' },
  { ref: '1CO 14:30', de: 'a outro, que estiver sentada',
    para: 'a outro, que estiver sentado',
    motivo: '`outro` é masculino. KJV: "to another that sitteth by"; Almeida: "se a outro, que estiver assentado".' },
  { ref: '1CO 15:6', de: 'visto de uma fez por mais',
    para: 'visto de uma vez por mais',
    motivo: 'KJV: "he was seen of above five hundred brethren at once"; Almeida: "Depois foi visto, uma vez, por mais de quinhentos irmãos".' },
  { ref: '1CO 15:17', de: 'vossa fé é vá,',
    para: 'vossa fé é vã,',
    motivo: 'Acento agudo no lugar do til — `vá` é verbo. KJV: "your faith is vain"; Almeida: "é vã a vossa fé".' },
  { ref: '1CO 15:24', de: 'o Reino de Deus e ao Pai',
    para: 'o Reino a Deus e ao Pai',
    motivo: 'O `e ao Pai` que sobra denuncia o que a frase queria: entregar o Reino A Deus, e não falar do Reino DE Deus. KJV: "delivered up the kingdom to God, even the Father"; Almeida: "entregado o reino a Deus, ao Pae".' },
  { ref: '1CO 16:2', de: 'ponha [alguma coisa] à pate',
    para: 'ponha [alguma coisa] à parte',
    motivo: 'Falta uma letra. KJV: "lay by him in store"; Almeida: "cada um de vós ponha de parte o que poder ajuntar".' },
  { ref: '1CO 16:19', de: 'Priscila vos saúdam-vos afetuosamente',
    para: 'Priscila saúdam-vos afetuosamente',
    motivo: 'O `vos` aparece duas vezes. KJV: "Aquila and Priscilla salute you much in the Lord"; Almeida: "Saudam-vos affectuosamente no Senhor Aquila e Prisca".' },
  { ref: '1CO 16:20', de: 'Saudai-vos uns as outros',
    para: 'Saudai-vos uns aos outros',
    motivo: 'KJV: "Greet ye one another with a holy kiss"; Almeida: "Saudae-vos uns aos outros com osculo sancto". Falta a contração, e `outros` é masculino.' },
  { ref: '2CO 1:22', de: 'em nosso corações',
    para: 'em nossos corações',
    motivo: 'Possessivo no singular com substantivo no plural. KJV: "in our hearts"; Almeida: "em nossos corações".' },
  { ref: '2CO 3:1', de: 'começamos a recomendarmos a nós mesmos',
    para: 'começamos a recomendar a nós mesmos',
    motivo: 'Dois verbos conjugados onde cabe um só. KJV: "Do we begin again to commend ourselves?"; Almeida: "começamos outra vez a louvar-nos a nós mesmos?".' },
  { ref: '2CO 6:12', de: 'mas vós estais estreitos em nossos sentimentos',
    para: 'mas vós estais estreitos em vossos sentimentos',
    motivo: 'Com `nossos` a frase se contradiz: Paulo diz que o aperto não vem dele, e sim dos coríntios. KJV: "but ye are straitened in your own bowels"; Almeida: "mas estaes estreitados nas vossas entranhas".' },
  { ref: '2CO 10:12', de: 'não ousamos a nos classificar',
    para: 'não ousamos nos classificar',
    motivo: 'Uma preposição a mais. KJV: "For we dare not make ourselves of the number"; Almeida: "Porque não ousamos juntar-nos".' },
  { ref: '2CO 11:11', de: 'Por que? Porque não vos amo?',
    para: 'Por quê? Porque não vos amo?',
    motivo: 'Interrogativo isolado no fim da frase leva circunflexo. A própria fonte escreve `Por quê?` com acento em dois lugares e sem acento em dois: este e 1Rs 11:22.' },
  { ref: '1KI 11:22', de: 'Faraó: Por que? O que te falta',
    para: 'Faraó: Por quê? O que te falta',
    motivo: 'O gêmeo de 2Co 11:11 e o único outro do arquivo, achado ao contar a expressão. Interrogativo sozinho no fim da frase leva circunflexo, e a própria fonte o escreve assim duas vezes.' },
  { ref: '2CO 11:17', de: 'nesta firme orgulho confiante',
    para: 'neste firme orgulho confiante',
    motivo: '`orgulho` é masculino. KJV: "in this confidence of boasting"; Almeida: "n\'esta confiança de gloria".' },
  { ref: '2CO 12:8', de: 'para que [isso] de afastasse de mim',
    para: 'para que [isso] se afastasse de mim',
    motivo: 'KJV: "that it might depart from me"; Almeida: "para que se desviasse de mim". O pronome reflexivo virou preposição.' },
  { ref: 'GAL 3:8', de: 'Todas nas nações serão abençoadas',
    para: 'Todas as nações serão abençoadas',
    motivo: 'KJV: "In thee shall all nations be blessed"; Almeida: "Todas as nações serão bemditas em ti". A preposição colou no artigo.' },
  { ref: 'GAL 5:21', de: 'eu também haviavos dito antes',
    para: 'eu também havia vos dito antes',
    motivo: 'Duas palavras coladas — e o mesmo versículo escreve `havia vos dito` certo poucas palavras antes. KJV: "as I have also told you in time past".' },

  // --- Efésios a Judas ---
  { ref: 'EPH 1:3', de: 'bênçãos espirituis',
    para: 'bênçãos espirituais',
    motivo: 'A própria fonte escreve `espirituais` 13 vezes e `espirituis` uma. Almeida: "com todas as bençãos espirituaes".' },
  { ref: 'EPH 4:14', de: 'pelo engano dos pessoas',
    para: 'pelo engano das pessoas',
    motivo: '`pessoas` é feminino. KJV: "by the sleight of men"; Almeida: "pelo engano dos homens".' },
  { ref: 'EPH 6:7', de: 'e não aos pessoas',
    para: 'e não às pessoas',
    motivo: 'Mesmo tropeço de gênero de Ef 4:14. KJV: "and not to men"; Almeida: "e não aos homens".' },
  { ref: 'EPH 6:13', de: 'resistir no dia mal',
    para: 'resistir no dia mau',
    motivo: '`mal` é advérbio; o adjetivo é `mau`. KJV: "to withstand in the evil day"; Almeida: "para que possaes resistir no dia mau".' },
  { ref: 'PHI 2:28', de: 'vendo-o de novo, alegrei-vos',
    para: 'vendo-o de novo, vos alegreis',
    motivo: 'O verbo está na primeira pessoa quando quem se alegra são eles. KJV: "that, when ye see him again, ye may rejoice"; Almeida: "para que, vendo-o outra vez, vos regozijeis".' },
  { ref: 'PHI 2:29', de: 'e honrai ao que são como ele',
    para: 'e honrai aos que são como ele',
    motivo: 'Artigo no singular com verbo no plural. KJV: "and hold such in reputation"; Almeida: "e tende em honra aos taes".' },
  { ref: 'PHI 3:4', de: 'Embora eu também tenho',
    para: 'Embora eu também tenha',
    motivo: '`Embora` pede subjuntivo. KJV: "Though I might also have confidence in the flesh"; Almeida: "Ainda que tambem tenho de que confiar na carne".' },
  { ref: 'COL 2:2', de: 'riquezas da pleno entendimento',
    para: 'riquezas do pleno entendimento',
    motivo: 'Artigo feminino com substantivo masculino. KJV: "unto all riches of the full assurance of understanding"; Almeida: "em todas as riquezas da plenitude de intelligencia".' },
  { ref: 'COL 3:6', de: 'Por causa delas que a ira de Deus vem',
    para: 'Por causa delas a ira de Deus vem',
    motivo: 'Um `que` solto que deixa a frase sem oração principal. KJV: "For which things\' sake the wrath of God cometh"; Almeida: "Pelas quaes coisas vem a ira de Deus".' },
  { ref: '2TI 3:8', de: 'esses se opõem a verdade',
    para: 'esses se opõem à verdade',
    motivo: 'Falta a crase. KJV: "so do these also resist the truth"; Almeida: "assim tambem estes resistem á verdade".' },
  { ref: 'TIT 1:11', de: 'Aos quais devem se calar',
    para: 'Aos quais se deve calar',
    motivo: 'KJV: "Whose mouths must be stopped"; Almeida: "Aos quaes convem tapar a bocca". O verbo estava no plural sem sujeito que o justificasse.' },
  { ref: 'TIT 3:9', de: 'e às genealogias e discussões, e às disputas',
    para: 'e as genealogias e discussões, e as disputas',
    motivo: '`evitar` é transitivo direto e não pede preposição — a própria fonte escreve `evita as questões tolas` certo no começo deste mesmo versículo. A Almeida 1911 usa `resiste ás questões`, verbo que pede a preposição; a Bíblia Livre trocou o verbo e ficou com a regência do outro.' },
  { ref: 'TIT 3:9', de: 'porque elas são inúteis e vás',
    para: 'porque elas são inúteis e vãs',
    motivo: 'Acento agudo no lugar do til — `vás` é do verbo ir. KJV: "for they are unprofitable and vain"; Almeida: "porque são inuteis e vãos". Mesmo defeito de 1Co 15:17.' },
  { ref: 'PHM 1:5', de: 'de teu amor e a fé',
    para: 'de teu amor e da fé',
    motivo: 'KJV: "Hearing of thy love and faith"; Almeida: "Ouvindo a tua caridade e a fé". A regência de `ouvir de` pede a preposição nas duas.' },
  { ref: 'PHM 1:15', de: 'Porque talvez por isso que ele tenha',
    para: 'Porque talvez por isso ele tenha',
    motivo: 'Um `que` a mais. KJV: "For perhaps he therefore departed for a season"; Almeida: "Porque bem pode ser que elle se tenha por isso apartado de ti".' },
  { ref: '1TI 5:21', de: 'sem preconceitos, fazendo nada por favoritismo',
    para: 'sem preconceitos, nada fazendo por favoritismo',
    motivo: 'Sem a inversão a frase perde a negação. KJV: "doing nothing by partiality"; Almeida: "nada fazendo por parcialidade" — a ordem que entra é a dela.' },
  { ref: '1TI 6:10', de: 'Alguns o cobiçam, e então se desviaram',
    para: 'Alguns o cobiçaram, e então se desviaram',
    motivo: 'Presente e passado na mesma frase. KJV: "which while some coveted after, they have erred from the faith"; Almeida: "o que apetecendo alguns, se desviaram da fé".' },
  { ref: 'HEB 6:7', de: 'por quem e lavrada',
    para: 'por quem é lavrada',
    motivo: 'O verbo `é` sem acento vira conjunção. Almeida: "para aquelles por quem é lavrada"; KJV: "for them by whom it is dressed".' },
  { ref: 'HEB 9:9', de: 'que não podem, quanto a consciência',
    para: 'que não podem, quanto à consciência',
    motivo: 'Falta a crase. KJV: "that could not make him that did the service perfect, as pertaining to the conscience"; Almeida: "que, quanto á consciencia, não podiam aperfeiçoar".' },
  { ref: 'HEB 10:23', de: 'a esperança que declararmos ter',
    para: 'a esperança que declaramos ter',
    motivo: 'Infinitivo pessoal onde cabe o presente. KJV: "Let us hold fast the profession of our faith"; Almeida: "Retenhamos firmes a confissão da nossa esperança".' },
  { ref: '1TH 2:6', de: 'ainda que tínhamos autoridade',
    para: 'ainda que tivéssemos autoridade',
    motivo: '`ainda que` pede subjuntivo. KJV: "when we might have been burdensome"; Almeida: "ainda que podiamos, como apostolos de Christo, ser-vos pesados".' },
  { ref: '1TH 2:13', de: 'a palavra da Deus pregada',
    para: 'a palavra de Deus pregada',
    motivo: 'Artigo feminino diante de `Deus`. KJV: "the word of God which ye heard of us"; Almeida: "a palavra da prégação de Deus".' },
  { ref: '1TH 3:4', de: 'convosco vós dizíamos',
    para: 'convosco nós dizíamos',
    motivo: 'O verbo está na primeira pessoa e o pronome na segunda — quem dizia era Paulo. KJV: "when we were with you, we told you before"; Almeida: "estando ainda comvosco, vos prediziamos".' },
  { ref: '1TH 4:4', de: 'saiba ser ter o seu instrumento',
    para: 'saiba ter o seu instrumento',
    motivo: 'Dois verbos onde cabe um. KJV: "should know how to possess his vessel"; Almeida: "saiba possuir o seu vaso".' },
  { ref: '1TH 4:11', de: 'quietos, trantando dos vossos',
    para: 'quietos, tratando dos vossos',
    motivo: 'Uma letra a mais. KJV: "and to do your own business"; Almeida: "e tratar dos vossos proprios negocios".' },
  { ref: 'HEB 12:5', de: 'nem te canses de ser reprendido',
    para: 'nem te canses de ser repreendido',
    motivo: 'A própria fonte escreve `repreendido` três vezes e `reprendido` uma. Almeida: "e não desmaies quando por elle fores reprehendido".' },
  { ref: 'HEB 13:20', de: 'do eterno Testamento eterno',
    para: 'do eterno Testamento',
    motivo: '`eterno` aparece dos dois lados da palavra. KJV: "through the blood of the everlasting covenant"; Almeida: "que pelo sangue do concerto eterno".' },
  { ref: 'HEB 13:22', de: 'que suportai esta palavra',
    para: 'que suporteis esta palavra',
    motivo: 'Imperativo dentro de oração subordinada. KJV: "suffer the word of exhortation"; Almeida: "que supporteis a palavra d\'esta exhortação".' },
  { ref: 'JAM 1:6', de: 'em fé, duvidando em nada',
    para: 'em fé, em nada duvidando',
    motivo: 'Na ordem da fonte a negação se perde e a frase manda duvidar. KJV: "let him ask in faith, nothing wavering"; Almeida: "peça-a com fé, não duvidando".' },
  { ref: 'JUD 1:5', de: 'Mas eu quer vos lembrar',
    para: 'Mas eu quero vos lembrar',
    motivo: 'Verbo na terceira pessoa com pronome na primeira. KJV: "I will therefore put you in remembrance"; Almeida: "Porém quero lembrar-vos".' },
  { ref: '1JO 2:23', de: 'aquele que confessa o filho',
    para: 'aquele que confessa o Filho',
    motivo: 'O mesmo versículo escreve `o Filho` com maiúscula na primeira metade. KJV: "but he that acknowledgeth the Son hath the Father also"; Almeida: "e aquelle que confessa o Filho".' },
  { ref: '1JO 2:27', de: 'que recebeste dele continua em vós',
    para: 'que recebestes dele continua em vós',
    motivo: 'O versículo inteiro trata os leitores por `vós` — `não tendes`, `vos ensine` — e só este verbo saiu do plural. KJV: "the anointing which ye have received of him abideth in you"; Almeida: "E a uncção que vós recebestes d\'elle fica em vós".' },
  { ref: '2PE 1:3', de: 'Como seu divino poder ele tem nos dado',
    para: 'Como seu divino poder nos tem dado',
    motivo: 'Um sujeito a mais: o poder já é quem dá. KJV: "According as his divine power hath given unto us all things"; Almeida: "Como o seu divino poder nos deu tudo".' },
  { ref: '2PE 1:17', de: 'tendo sido lhe enviada tal voz',
    para: 'tendo-lhe sido enviada tal voz',
    motivo: 'O pronome no meio da locução verbal. Almeida: "quando da magnifica gloria lhe foi enviada uma tal voz"; KJV: "when there came such a voice to him".' },
  { ref: '2PE 2:9', de: 'e reservar aos injustos',
    para: 'e reservar os injustos',
    motivo: '`reservar` é transitivo direto. KJV: "and to reserve the unjust unto the day of judgment"; Almeida: "e reservar os injustos para o dia de juizo".' },
  { ref: '2PE 3:8', de: 'desta uma coisa não ignoreis',
    para: 'esta uma coisa não ignoreis',
    motivo: '`ignorar` é transitivo direto e não pede preposição. KJV: "be not ignorant of this one thing"; Almeida: "não ignoreis uma coisa".' },
  { ref: 'JAM 5:4', de: 'chegaram os ouvidos do Senhor',
    para: 'chegaram aos ouvidos do Senhor',
    motivo: 'Sem a preposição os ouvidos viram sujeito. KJV: "are entered into the ears of the Lord of Sabaoth"; Almeida: "entraram nos ouvidos do Senhor dos exercitos".' },
  { ref: 'JAM 5:11', de: 'Eis que considerarmos benditos',
    para: 'Eis que consideramos benditos',
    motivo: 'Infinitivo pessoal onde cabe o presente. KJV: "Behold, we count them happy which endure"; Almeida: "Eis que temos por bemaventurados os que soffrem".' },
  { ref: '1PE 2:19', de: 'se alguém, por causa da consciência a respeito de Deus, experimente dores',
    para: 'se alguém, por causa da consciência a respeito de Deus, experimenta dores',
    motivo: 'Subjuntivo onde a frase é afirmativa. KJV: "if a man for conscience toward God endure grief"; Almeida: "se alguem, por causa da consciencia para com Deus, soffre aggravos".' },

  // --- Marcos e Apocalipse ---
  { ref: 'REV 12:14', de: 'duas asas de grande água',
    para: 'duas asas de grande águia',
    motivo: 'KJV: "two wings of a great eagle"; Almeida: "duas azas de grande aguia". É o oitavo e último lugar em que a ave virou água na fonte.' },
  { ref: 'MAR 14:16', de: 'E seusdiscípulos saíram',
    para: 'E seus discípulos saíram',
    motivo: 'Duas palavras coladas, sem pontuação entre elas para a limpeza da ETL separar. KJV: "And his disciples went forth"; Almeida: "E, saindo os seus discipulos".' },
  { ref: 'MAR 14:58', de: 'outro feito não por mãos.',
    para: 'outro feito não por mãos.”',
    motivo: 'A aspa abre no começo do versículo e nunca fecha — a fala das testemunhas do julgamento vaza para o texto do narrador. KJV e Almeida terminam a citação aqui, e o versículo seguinte volta a ser narração.' },
  { ref: 'MAR 14:70', de: 'és galileu”, e a tua fala',
    para: 'és galileu, e a tua fala',
    motivo: 'Uma aspa fecha no meio da fala e outra no fim, e a do meio parte em duas o que os presentes dizem numa vez só. KJV: "for thou art a Galilaean, and thy speech agreeth thereto"; Almeida: "porque és tambem galileo, e a tua falla é similhante".' },
  { ref: 'MAR 15:24', de: 'repartiram a roupas dele',
    para: 'repartiram as roupas dele',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "they parted his garments"; Almeida: "repartiram os seus vestidos".' },
  { ref: 'MAR 15:44', de: 'se já era morto já havia muito tempo',
    para: 'se já era morto havia muito tempo',
    motivo: 'O `já` aparece duas vezes. KJV: "he asked him whether he had been any while dead"; Almeida: "perguntou-lhe se já havia muito que tinha morrido".' },
  { ref: 'MAR 15:46', de: 'e rolouuma pedra',
    para: 'e rolou uma pedra',
    motivo: 'Duas palavras coladas. KJV: "and rolled a stone unto the door of the sepulcher"; Almeida: "e revolveu uma pedra para a porta do sepulchro".' },
  { ref: 'MAR 16:4', de: 'que já a pedra estava havia sido rolada',
    para: 'que já a pedra havia sido rolada',
    motivo: 'Dois verbos auxiliares empilhados. KJV: "they saw that the stone was rolled away"; Almeida: "viram que já a pedra estava revolvida".' },
  { ref: 'REV 1:17', de: 'eu o vi, cai aos pés dele',
    para: 'eu o vi, caí aos pés dele',
    motivo: 'Sem o acento o verbo vira terceira pessoa do presente, e quem cai é João. A própria fonte escreve `caí` nove vezes. Almeida: "quando o vi, cahi a seus pés como morto".' },
  { ref: 'REV 8:3', de: 'e se ficou junto ao altar',
    para: 'e ficou junto ao altar',
    motivo: 'Um pronome reflexivo sem verbo que o peça. KJV: "And another angel came and stood at the altar"; Almeida: "e poz-se junto ao altar".' },
  { ref: 'REV 9:18', de: 'pela fogo',
    para: 'pelo fogo',
    motivo: '`fogo` é masculino, e a fonte já escreve `pelo enxofre` certo três palavras adiante. KJV: "by the fire, and by the smoke"; Almeida: "pelo fogo, pelo fumo".' },
  { ref: 'REV 12:12', de: 'o diabo desceu até vos',
    para: 'o diabo desceu até vós',
    motivo: 'Sem o acento `vos` é pronome átono e não pode reger preposição. KJV: "for the devil is come down unto you"; Almeida: "porque o diabo desceu a vós".' },
  { ref: 'REV 13:5', de: 'foi-lhe dada um boca',
    para: 'foi-lhe dada uma boca',
    motivo: 'Artigo masculino com substantivo feminino — o particípio ao lado já está no feminino. KJV: "there was given unto him a mouth"; Almeida: "E deu-se-lhe bocca para fallar".' },
  { ref: 'REV 13:8', de: 'a adorarão, o nomes dos quais',
    para: 'a adorarão, os nomes dos quais',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "whose names are not written in the book of life"; Almeida: "cujos nomes não estão escriptos no livro da vida".' },
  { ref: 'REV 13:16', de: 'fosse lhes dada uma marca',
    para: 'lhes fosse dada uma marca',
    motivo: 'O pronome no meio da locução verbal. KJV: "to receive a mark in their right hand"; Almeida: "ponham um signal na sua mão direita".' },
  { ref: 'REV 15:2', de: 'mar de vidro misturado como fogo',
    para: 'mar de vidro misturado com fogo',
    motivo: 'KJV: "a sea of glass mingled with fire"; Almeida: "como um mar de vidro misturado com fogo". Uma letra a mais transforma a mistura em comparação.' },
  { ref: 'REV 16:9', de: 'poder sobre estas pagas',
    para: 'poder sobre estas pragas',
    motivo: 'A própria fonte escreve `pragas` 20 vezes; os outros dois `pagas` do arquivo estão em Ez 16:33, onde a palavra é de pagamento e está certa. KJV: "which hath power over these plagues".' },
  { ref: 'REV 2:23', de: 'E ao filhos deles',
    para: 'E aos filhos deles',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "And I will kill her children with death"; Almeida: "E matarei de morte a seus filhos".' },
  { ref: 'REV 16:21', de: 'E uma grande granizo',
    para: 'E um grande granizo',
    motivo: '`granizo` é masculino. KJV: "And there fell upon men a great hail out of heaven"; Almeida: "caiu do céu uma grande saraiva" — na Almeida a palavra é feminina, e a Bíblia Livre trocou o substantivo sem trocar o artigo.' },
  { ref: 'REV 17:3', de: 'escarlate, que estava cheio de nomes',
    para: 'escarlate, que estava cheia de nomes',
    motivo: '`besta` é feminino. KJV: "a scarlet colored beast, full of names of blasphemy"; Almeida: "uma besta de côr de escarlata, que estava cheia de nomes de blasphemia".' },
  { ref: 'REV 17:3', de: 'E ele tinha sete cabeças',
    para: 'E ela tinha sete cabeças',
    motivo: 'O mesmo tropeço de gênero da primeira metade do versículo: quem tem as cabeças é a besta. Almeida: "e tinha sete cabeças e dez cornos"; KJV: "having seven heads and ten horns".' },
  { ref: 'REV 19:1', de: 'grande multidão no céus',
    para: 'grande multidão nos céus',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "a great voice of much people in heaven"; Almeida: "uma grande multidão no céu".' },

  // --- João ---
  { ref: 'JOH 2:7', de: 'E encheram-nas até encima',
    para: 'E encheram-nas até em cima',
    motivo: '`encima` é verbo; a locução é `em cima`. KJV: "And they filled them up to the brim"; Almeida: "E encheram-n\'as até cima".' },
  { ref: 'JOH 2:17', de: 'me tem me devorado',
    para: 'me tem devorado',
    motivo: 'O `me` aparece duas vezes. KJV: "The zeal of thine house hath eaten me up"; Almeida: "O zelo da tua casa me comeu".' },
  { ref: 'JOH 2:20', de: 'e tu o levantarás tu em três dias',
    para: 'e tu o levantarás em três dias',
    motivo: 'O `tu` aparece dos dois lados do verbo. KJV: "and wilt thou rear it up in three days?"; Almeida: "e tu o levantarás em tres dias?".' },
  { ref: 'JOH 3:26', de: 'contigo dalém do Jordão',
    para: 'contigo além do Jordão',
    motivo: 'A preposição colou no advérbio. KJV: "he that was with thee beyond Jordan"; Almeida: "aquelle que estava comtigo além do Jordão".' },
  { ref: 'JOH 3:26', de: 'e todos vem a ele',
    para: 'e todos vêm a ele',
    motivo: 'Terceira pessoa do plural leva acento. KJV: "and all men come to him"; Almeida: "e todos vão ter com elle".' },
  { ref: 'JOH 4:9', de: 'não se comunicam com o samaritanos',
    para: 'não se comunicam com os samaritanos',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "for the Jews have no dealings with the Samaritans"; Almeida: "porque os judeos não se communicam com os samaritanos".' },
  { ref: 'JOH 6:1', de: 'partiu para a outro lado',
    para: 'partiu para o outro lado',
    motivo: 'Artigo feminino com substantivo masculino. KJV: "Jesus went over the sea of Galilee"; Almeida: "Jesus partiu para a outra banda do mar da Galilea" — na Almeida a palavra é `banda`, feminina, e a Bíblia Livre trocou o substantivo sem trocar o artigo.' },
  { ref: 'JOH 7:22', de: 'mas dois pais)',
    para: 'mas dos pais)',
    motivo: 'KJV: "not because it is of Moses, but of the fathers"; Almeida: "não que fosse de Moysés, mas dos paes". A contração virou numeral.' },
  { ref: 'JOH 7:23', de: 'quebrada, irritai-vos comigo',
    para: 'quebrada, irritais-vos comigo',
    motivo: 'É pergunta, não ordem — o imperativo faz Jesus mandar que se irritem com ele. KJV: "are ye angry at me"; Almeida: "indignaes-vos contra mim".' },
  { ref: 'JOH 8:57', de: 'Disseram-lhe, pois. os Judeus',
    para: 'Disseram-lhe, pois, os Judeus',
    motivo: 'Ponto final no meio da oração, onde cabia vírgula. KJV: "Then said the Jews unto him"; Almeida: "Disseram-lhe pois os judeos".' },
  { ref: 'JOH 9:16', de: 'Então que alguns dos Fariseus',
    para: 'Então alguns dos Fariseus',
    motivo: 'Um `que` solto que deixa a frase sem oração principal. KJV: "Therefore said some of the Pharisees"; Almeida: "Por isso alguns dos phariseos diziam".' },
  { ref: 'JOH 9:18', de: 'chamaram aos pais dos que',
    para: 'chamaram aos pais do que',
    motivo: 'O cego é um só. KJV: "until they called the parents of him that had received his sight"; Almeida: "emquanto não chamaram os paes do que agora via".' },
  { ref: 'JOH 9:32', de: 'nunca se ouviu de que alguém que tenha aberto',
    para: 'nunca se ouviu que alguém tenha aberto',
    motivo: 'Uma preposição e um `que` a mais. KJV: "Since the world began was it not heard that any man opened the eyes"; Almeida: "nunca se ouviu que alguem abrisse os olhos".' },
  { ref: 'JOH 9:38', de: 'Creio, Senhor; E adorou-o',
    para: 'Creio, Senhor. E adorou-o',
    motivo: 'Ponto e vírgula antes de maiúscula — a fala do cego termina aqui e a narração recomeça. KJV: "And he said, Lord, I believe. And he worshiped him"; Almeida: "Creio, Senhor. E o adorou".' },
  { ref: 'JOH 10:35', de: 'chamou deuses a aqueles',
    para: 'chamou deuses àqueles',
    motivo: 'Falta a contração com crase. KJV: "If he called them gods, unto whom the word of God came"; Almeida: "se a lei chamou deuses áquelles".' },
  { ref: 'JOH 11:2', de: 'os pés; [a que] cujo irmão',
    para: 'os pés; cujo irmão',
    motivo: '`a que cujo` empilha dois relativos, e o primeiro fica sem verbo. KJV: "whose brother Lazarus was sick"; Almeida: "cujo irmão Lazaro estava enfermo".' },
  { ref: 'JOH 13:29', de: 'Compra o que para o que nos é necessário',
    para: 'Compra o que nos é necessário',
    motivo: 'Um `o que para` a mais no meio da fala. KJV: "Buy those things that we have need of against the feast"; Almeida: "Compra o que nos é necessario para a festa".' },
  { ref: 'JOH 15:2', de: 'e todo o que da fruto',
    para: 'e todo o que dá fruto',
    motivo: 'O mesmo versículo escreve `não dá fruto` com acento poucas palavras antes — a própria fonte se contradiz dentro da linha. Almeida: "e alimpa toda o que dá fructo".' },
  { ref: 'JOH 17:19', de: 'também eles seja santificados',
    para: 'também eles sejam santificados',
    motivo: 'Verbo no singular com sujeito no plural. KJV: "that they also might be sanctified through the truth"; Almeida: "para que tambem elles sejam sanctificados na verdade".' },
  { ref: 'JOH 18:1', de: 'em que ele entrou ele, e seus discípulos',
    para: 'em que ele entrou, e seus discípulos',
    motivo: 'O `ele` aparece dos dois lados do verbo. KJV: "into the which he entered, and his disciples"; Almeida: "no qual elle entrou e seus discipulos".' },
  { ref: 'JOH 20:24', de: 'E a Tomé, um dos doze',
    para: 'E Tomé, um dos doze',
    motivo: 'A preposição faz de Tomé objeto quando ele é o sujeito da frase. KJV: "But Thomas, one of the twelve, called Didymus, was not with them"; Almeida: "Ora Thomé, um dos doze".' },
  { ref: 'JOH 20:30', de: 'também ainda muitos outros sinais ainda',
    para: 'também muitos outros sinais ainda',
    motivo: 'O `ainda` aparece dos dois lados. KJV: "And many other signs truly did Jesus in the presence of his disciples"; Almeida: "Jesus pois operou tambem em presença de seus discipulos muitos outros signaes".' },
  { ref: 'JOH 21:16', de: 'Voltou a lhe a dizer',
    para: 'Voltou a lhe dizer',
    motivo: 'A preposição aparece duas vezes. KJV: "He saith to him again the second time"; Almeida: "Tornou a dizer-lhe segunda vez".' },
  { ref: 'JOH 21:18', de: 'e andava por onde querias',
    para: 'e andavas por onde querias',
    motivo: 'Terceira pessoa no meio de uma fala toda na segunda — `te vestias`, `querias`. Almeida: "e andavas por onde querias"; KJV: "and walkedst whither thou wouldest".' },
  { ref: 'JOH 21:25', de: 'o mundo poderia caber os livros',
    para: 'o mundo poderia conter os livros',
    motivo: '`caber` não leva objeto direto — não é o mundo que cabe nos livros, são os livros que não cabem no mundo. KJV: "even the world itself could not contain the books"; Almeida: "nem ainda o mundo todo poderia conter os livros".' },

  // --- Lucas ---
  { ref: 'LUK 6:1', de: 'no segundo sábadodepois do primeiro',
    para: 'no segundo sábado depois do primeiro',
    motivo: 'Duas palavras coladas. KJV: "on the second sabbath after the first"; Almeida: "no sabbado segundo-primeiro".' },
  { ref: 'LUK 2:38', de: 'ela agradeci ao Senhor',
    para: 'ela agradecia ao Senhor',
    motivo: 'Primeira pessoa no meio de uma narração em terceira — o verbo ao lado é `falava`. KJV: "gave thanks likewise unto the Lord"; Almeida: "dava graças a Deus".' },
  { ref: 'LUK 11:42', de: 'Mais ai de vós, fariseus',
    para: 'Mas ai de vós, fariseus',
    motivo: '`Mais` por `Mas` — uma letra que troca a conjunção por um advérbio. KJV: "But woe unto you, Pharisees!"; Almeida: "Mas ai de vós, phariseos".' },
  { ref: 'LUK 24:39', de: 'que sou em mesmo',
    para: 'que sou eu mesmo',
    motivo: 'O pronome virou preposição. KJV: "that it is I myself"; Almeida: "que sou eu mesmo". É Jesus mostrando as mãos e os pés depois da ressurreição.' },
  { ref: 'LUK 6:6', de: 'e estava ensinado',
    para: 'e estava ensinando',
    motivo: 'Particípio no lugar do gerúndio. KJV: "that he entered into the synagogue and taught"; Almeida: "entrou na synagoga, e estava ensinando".' },
  { ref: 'LUK 6:34', de: 'para receberam de volta',
    para: 'para receberem de volta',
    motivo: 'Pretérito onde cabe o infinitivo pessoal. KJV: "to receive as much again"; Almeida: "para tornarem a receber outro tanto".' },
  { ref: 'LUK 1:2', de: 'os que [as] viram que desde o princípio',
    para: 'os que [as] viram desde o princípio',
    motivo: 'Um `que` solto no meio da oração. KJV: "which from the beginning were eyewitnesses"; Almeida: "os mesmos que as viram desde o principio".' },
  { ref: 'LUK 1:2', de: 'e foram servidores das palavra',
    para: 'e foram servidores da palavra',
    motivo: 'Artigo no plural com substantivo no singular. KJV: "and ministers of the word"; Almeida: "e foram ministros da palavra".' },
  { ref: 'LUK 2:1', de: 'para que todo a terra',
    para: 'para que toda a terra',
    motivo: 'KJV: "that all the world should be taxed"; Almeida: "para que todo o mundo se alistasse" — na Almeida a palavra é `mundo`, masculina, e a Bíblia Livre trocou por `terra` sem trocar o determinante.' },
  { ref: 'LUK 2:32', de: 'iluminar as gentios',
    para: 'iluminar os gentios',
    motivo: 'KJV: "A light to lighten the Gentiles"; Almeida: "Luz para alumiar as nações" — de novo o determinante da palavra antiga, feminina, sobre a nova, masculina.' },
  { ref: 'LUK 8:37', de: 'E toda o povo',
    para: 'E todo o povo',
    motivo: 'KJV: "Then the whole multitude of the country of the Gadarenes"; Almeida: "E toda a multidão da terra dos gadarenos" — mesmo caso de Lc 2:1 e 2:32.' },
  { ref: 'LUK 9:5', de: 'E a todo os que não vos receberem',
    para: 'E a todos os que não vos receberem',
    motivo: 'Determinante no singular com substantivo no plural. KJV: "And whosoever will not receive you"; Almeida: "E, se quaesquer vos não receberem".' },
  { ref: 'LUK 15:16', de: 'mas ninguém [as] dava para ele',
    para: 'mas ninguém [os] dava para ele',
    motivo: 'O que ninguém dava eram os grãos, masculino. KJV: "with the husks that the swine did eat: and no man gave unto him"; Almeida: "com as bolotas que os porcos comiam, e ninguem lhe dava nada".' },
  { ref: 'LUK 13:4', de: 'mais culpados dos que todos as pessoas',
    para: 'mais culpados do que todas as pessoas',
    motivo: 'Duas concordâncias na mesma expressão. KJV: "that they were sinners above all men that dwelt in Jerusalem"; Almeida: "mais culpados do que todos quantos homens habitam em Jerusalem".' },
  { ref: 'LUK 14:8', de: 'Quando fores convidados',
    para: 'Quando fores convidado',
    motivo: 'Verbo no singular com particípio no plural — a fala é toda dirigida a um só, `não te sentes`. KJV: "When thou art bidden of any man to a wedding"; Almeida: "Quando por alguem fôres convidado ás bodas".' },
  { ref: 'LUK 18:43', de: 'E o todo o povo',
    para: 'E todo o povo',
    motivo: 'Dois artigos em volta de `todo`. KJV: "and all the people, when they saw it, gave praise unto God"; Almeida: "E todo o povo, vendo isto, dava louvores a Deus".' },
  { ref: 'LUK 22:56', de: 'fixando o olhos nele',
    para: 'fixando os olhos nele',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "and earnestly looked upon him"; Almeida: "e, postos os olhos n\'elle".' },
  { ref: 'LUK 10:21', de: 'Graças te dou, o Pai',
    para: 'Graças te dou, ó Pai',
    motivo: 'É vocativo, e sem o acento vira artigo. KJV: "I thank thee, O Father, Lord of heaven and earth"; Almeida: "Graças te dou, ó Pae".' },
  { ref: 'LUK 24:21', de: 'aquele que libertar a Israel',
    para: 'aquele que libertaria a Israel',
    motivo: 'Infinitivo onde cabe o futuro do pretérito. KJV: "which should have redeemed Israel"; Almeida: "que fosse elle o que remisse Israel".' },
  { ref: 'LUK 1:24', de: 'Isabel, sua mulher, Isabel, engravidou-se',
    para: 'Isabel, sua mulher, engravidou-se',
    motivo: 'O nome aparece duas vezes. KJV: "And after those days his wife Elisabeth conceived"; Almeida: "E depois d\'aquelles dias Isabel, sua mulher, concebeu".' },
  { ref: 'LUK 9:10', de: 'E quando os apóstolos, voltaram',
    para: 'E quando os apóstolos voltaram',
    motivo: 'Vírgula entre sujeito e verbo. KJV: "And the apostles, when they were returned, told him all"; Almeida: "E, regressando os apostolos, contaram-lhe todas as coisas".' },
  { ref: 'LUK 14:14', de: 'porque não eles não têm',
    para: 'porque eles não têm',
    motivo: 'A negação aparece duas vezes. KJV: "for they cannot recompense thee"; Almeida: "porquanto não teem com que t\'o recompensar".' },
  { ref: 'LUK 21:10', de: 'Então lhe disse:',
    para: 'Então lhes disse:',
    motivo: 'Jesus fala aos discípulos, no plural. KJV: "Then said he unto them"; Almeida: "Então lhes disse".' },
  { ref: 'LUK 21:10', de: 'Então se levantará nação contra nação',
    para: 'Levantar-se-á nação contra nação',
    motivo: 'O `Então` aparece duas vezes, e sem ele a frase começaria por `Se levantará`, que na leitura em voz alta soa condicional. KJV: "Nation shall rise against nation". A forma que entra é a da Almeida 1911: "Levantar-se-ha nação contra nação".' },
  { ref: 'LUK 6:39', de: 'E disse-lhesuma parábola',
    para: 'E disse-lhes uma parábola',
    motivo: 'Duas palavras coladas. KJV: "And he spake a parable unto them"; Almeida: "E dizia-lhes uma parabola".' },
  { ref: 'LUK 7:13', de: 'de intima compaixão',
    para: 'de íntima compaixão',
    motivo: 'A Almeida 1911 também grafa `intima`, mas é anterior às reformas ortográficas e não serve de testemunha para acento; a palavra é proparoxítona e leva acento por regra. Almeida: "moveu-se de intima compaixão por ella".' },
  { ref: 'LUK 23:29', de: 'que não deram a luz',
    para: 'que não deram à luz',
    motivo: 'Falta a crase, e sem ela `dar a luz` vira o contrário de `dar à luz`. KJV: "the wombs that never bare"; Almeida: "os ventres que não geraram".' },
  { ref: 'LUK 7:2', de: 'muito estimava, que estava doente',
    para: 'muito estimava, estava doente',
    motivo: 'Com o `que` o versículo fica sem oração principal. KJV: "was sick, and ready to die"; Almeida: "a quem muito estimava, estava doente, e moribundo".' },
  { ref: 'LUK 11:9', de: 'pedi, e será vos dado',
    para: 'pedi, e vos será dado',
    motivo: 'O mesmo versículo escreve `vos será aberto` certo no fim. A própria fonte usa `vos será` 36 vezes e `será vos` só aqui e em Lc 6:38.' },
  { ref: 'LUK 6:38', de: 'Dai, e será vos dado',
    para: 'Dai, e vos será dado',
    motivo: 'O gêmeo de Lc 11:9 e o único outro do arquivo, achado ao contar a expressão. A própria fonte usa `vos será` 36 vezes.' },
  { ref: 'LUK 14:5', de: 'De qual que vós cairá',
    para: 'De qual de vós cairá',
    motivo: 'KJV: "Which of you shall have an ass or an ox fallen into a pit"; Almeida: "Qual será de vós o que, caindo-lhe n\'um poço". A preposição virou conjunção.' },
  { ref: 'LUK 18:29', de: 'que há ninguém que, tenha deixado',
    para: 'que não há ninguém que tenha deixado',
    motivo: '`há ninguém` sem a negação não é português, e a vírgula parte o relativo do verbo. KJV: "There is no man that hath left house"; Almeida: "que ninguem ha, que tenha deixado casa".' },
  { ref: 'LUK 22:67', de: 'dizendo, Tu és o Cristo?',
    para: 'dizendo: Tu és o Cristo?',
    motivo: 'Vírgula onde abre a fala. KJV: "Art thou the Christ? tell us"; Almeida: "Dizendo: És tu o Christo?".' },
  { ref: 'LUK 23:49', de: 'as mulheres que acompanhando',
    para: 'as mulheres que, acompanhando',
    motivo: 'Sem a vírgula o gerúndio cola no relativo e a frase perde o verbo principal. KJV: "and the women that followed him from Galilee, stood afar off"; Almeida: "e as mulheres que juntamente o haviam seguido desde a Galiléa".' },
  { ref: 'LUK 23:50', de: ',sendo homem bom e justo.',
    para: ', era homem bom e justo.',
    motivo: 'Com o gerúndio o versículo fica sem verbo principal. KJV: "there was a man named Joseph, a counselor; and he was a good man, and a just"; Almeida: "um varão por nome José, senador, homem de bem e justo".' },

  // --- Atos ---
  { ref: 'ACT 1:15', de: 'E em [algum d] aqueles dias',
    para: 'E em [algum d]aqueles dias',
    motivo: 'O `d` é pedaço da palavra seguinte, não palavra solta — sem colar o colchete, a limpeza da ETL deixa `algum d aqueles` na tela. KJV: "And in those days"; Almeida: "E n\'aquelles dias".' },
  { ref: 'ACT 2:23', de: 'sendo tomando, pelas mãos',
    para: 'sendo tomado, pelas mãos',
    motivo: 'Gerúndio onde a frase é passiva, como o `sendo entregue` da mesma linha. KJV: "ye have taken, and by wicked hands have crucified"; Almeida: "sendo entregue pelo determinado conselho".' },
  { ref: 'ACT 3:19', de: 'para que vosso pecados',
    para: 'para que vossos pecados',
    motivo: 'Possessivo no singular com substantivo no plural. KJV: "that your sins may be blotted out"; Almeida: "para que sejam apagados os vossos peccados".' },
  { ref: 'ACT 4:10', de: 'e a todos o povo de Israel',
    para: 'e a todo o povo de Israel',
    motivo: 'KJV: "and to all the people of Israel"; Almeida: "e a todo o povo d\'Israel". O determinante ficou no plural e o substantivo no singular.' },
  { ref: 'ACT 7:13', de: 'foi conhecia por Faraó',
    para: 'foi conhecida por Faraó',
    motivo: 'Verbo no lugar do particípio. KJV: "and Joseph\'s kindred was made known unto Pharaoh"; Almeida: "e a linhagem de José foi manifesta a Pharaó".' },
  { ref: 'ACT 7:41', de: 'o bezerro, o ofereceram sacrifício',
    para: 'o bezerro, e ofereceram sacrifício',
    motivo: 'Pronome no lugar da conjunção. KJV: "And they made a calf in those days, and offered sacrifice unto the idol"; Almeida: "fizeram o bezerro, e offereceram sacrificios ao idolo".' },
  { ref: 'ACT 7:43', de: 'figuras que vós fizeste',
    para: 'figuras que vós fizestes',
    motivo: 'Segunda pessoa do singular com pronome no plural. KJV: "figures which ye made to worship them"; Almeida: "figuras que vós fizestes para as adorar".' },
  { ref: 'ACT 7:50', de: 'minhão mão',
    para: 'minha mão',
    motivo: 'Uma letra a mais. KJV: "Hath not my hand made all these things?"; Almeida: "Porventura não fez a minha mão todas estas coisas?".' },
  { ref: 'ACT 7:55', de: 'viu à glória de Deus',
    para: 'viu a glória de Deus',
    motivo: 'Crase onde não cabe: `ver` é transitivo direto. KJV: "and saw the glory of God"; Almeida: "viu a gloria de Deus, e Jesus".' },
  { ref: 'ACT 8:40', de: 'anunciava ao Evangelho',
    para: 'anunciava o Evangelho',
    motivo: '`anunciar` é transitivo direto. KJV: "he preached in all the cities"; Almeida: "annunciou o evangelho em todas as cidades".' },
  { ref: 'ACT 14:7', de: 'E ali eles anunciavam ao Evangelho',
    para: 'E ali eles anunciavam o Evangelho',
    motivo: 'Mesma regência de At 8:40. KJV: "And there they preached the gospel"; Almeida: "E ali prégavam o Evangelho".' },
  { ref: 'ACT 9:11', de: 'porque que ele ora',
    para: 'porque ele ora',
    motivo: 'Uma conjunção a mais. KJV: "for, behold, he prayeth"; Almeida: "pois eis que elle ora".' },
  { ref: 'ACT 10:31', de: 'Cornélio, tura oração',
    para: 'Cornélio, tua oração',
    motivo: 'Uma letra a mais no possessivo. KJV: "Cornelius, thy prayer is heard"; Almeida: "Cornelio, a tua oração é ouvida".' },
  { ref: 'ACT 12:7', de: 'despertou-o, dizendo; Levanta-te',
    para: 'despertou-o, dizendo: Levanta-te',
    motivo: 'Ponto e vírgula onde abre a fala. KJV: "and raised him up, saying, Arise up quickly"; Almeida: "o despertou, dizendo: Levanta-te depressa".' },
  { ref: 'ACT 12:15', de: 'Mas ela, insistindo que assim era.',
    para: 'Mas ela insistia que assim era.',
    motivo: 'Com o gerúndio a frase fica sem verbo principal. KJV: "But she constantly affirmed that it was even so"; Almeida: "Mas ella affirmava que assim era".' },
  { ref: 'ACT 13:17', de: 'e com o braço levantando',
    para: 'e com o braço levantado',
    motivo: 'Gerúndio no lugar do particípio. KJV: "and with a high arm brought he them out of it"; Almeida: "e com braço levantado os tirou d\'ella".' },
  { ref: 'ACT 14:15', de: 'por que fazeis estais coisas',
    para: 'por que fazeis estas coisas',
    motivo: 'Verbo no lugar do demonstrativo. KJV: "Sirs, why do ye these things?"; Almeida: "Varões, porque fazeis essas coisas?".' },
  { ref: 'ACT 14:18', de: 'E tendo disto isto',
    para: 'E tendo dito isto',
    motivo: 'Uma letra a mais. KJV: "And with these sayings scarce restrained they the people"; Almeida: "E, dizendo isto, com difficuldade impediram".' },
  { ref: 'ACT 28:25', de: 'tendo Paulo disto [esta] palavra',
    para: 'tendo Paulo dito [esta] palavra',
    motivo: 'O mesmo `disto` por `dito` de At 14:18. KJV: "after that Paul had spoken one word"; Almeida: "dizendo Paulo esta palavra".' },
  { ref: 'ACT 15:7', de: 'Deus [meu] escolheu entre nós',
    para: 'Deus [me] escolheu dentre nós',
    motivo: 'O possessivo entrou no lugar do pronome, e a preposição perdeu o `d`. KJV: "God made choice among us"; Almeida: "Deus me elegeu d\'entre nós".' },
  { ref: 'ACT 16:15', de: 'E ela insistiu para conosco',
    para: 'E ela insistiu conosco',
    motivo: 'Uma preposição a mais. KJV: "And she constrained us"; Almeida: "E nos constrangeu a isso".' },
  { ref: 'ACT 16:29', de: 'e termendo muito',
    para: 'e tremendo muito',
    motivo: 'Letras trocadas de lugar. KJV: "and came trembling, and fell down before Paul and Silas"; Almeida: "e, todo tremendo, se prostrou aos pés de Paulo e Silas".' },
  { ref: 'ACT 17:26', de: 'e o limites da morada',
    para: 'e os limites da morada',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "and the bounds of their habitation"; Almeida: "e os limites da sua habitação".' },
  { ref: 'ACT 17:30', de: 'anuncia a todos as pessoas',
    para: 'anuncia a todas as pessoas',
    motivo: 'KJV: "but now commandeth all men every where to repent"; Almeida: "annuncia agora a todos os homens" — de novo o determinante da palavra antiga, masculina, sobre a nova, feminina.' },
  { ref: 'ACT 22:15', de: 'para com todos as pessoas',
    para: 'para com todas as pessoas',
    motivo: 'Mesmo tropeço de At 17:30. KJV: "For thou shalt be his witness unto all men"; Almeida: "para com todos os homens".' },
  { ref: 'ACT 18:7', de: 'entrou na cada de um',
    para: 'entrou na casa de um',
    motivo: 'Uma letra trocada, e o próprio versículo escreve `cuja casa` certo adiante. KJV: "and entered into a certain man\'s house"; Almeida: "entrou em casa de um, por nome Justo".' },
  { ref: 'ACT 19:18', de: 'confessando e declararando',
    para: 'confessando e declarando',
    motivo: 'Uma sílaba repetida. KJV: "and confessed, and showed their deeds"; Almeida: "confessando e publicando os seus feitos".' },
  { ref: 'ACT 21:25', de: 'que se abstenham do que se abstenham das coisas',
    para: 'que se abstenham das coisas',
    motivo: 'A oração aparece duas vezes. KJV: "save only that they keep themselves from things offered to idols"; Almeida: "mas que só se guardem do que se sacrifica aos idolos".' },
  { ref: 'ACT 21:26', de: 'estavam cumpridos dos dias',
    para: 'estavam cumpridos os dias',
    motivo: 'Preposição no lugar do artigo. KJV: "to signify the accomplishment of the days of purification"; Almeida: "annunciando serem já cumpridos os dias da sanctificação".' },
  { ref: 'ACT 21:38', de: 'tinha levantando uma rebelião',
    para: 'tinha levantado uma rebelião',
    motivo: 'Gerúndio no lugar do particípio. KJV: "which before these days madest an uproar"; Almeida: "que antes d\'estes dias levantou uma sedição".' },
  { ref: 'ACT 22:7', de: 'Eu cai ao chão',
    para: 'Eu caí ao chão',
    motivo: 'Sem o acento o verbo vira terceira pessoa do presente. A própria fonte escreve `caí` nove vezes. Almeida: "E cahi por terra, e ouvi uma voz".' },
  { ref: 'ACT 22:23', de: 'e lançavm pó ao ar',
    para: 'e lançavam pó ao ar',
    motivo: 'Uma letra que caiu no meio do verbo. KJV: "and threw dust into the air"; Almeida: "e deitando pó para o ar".' },
  { ref: 'ACT 23:23', de: 'chamando a si certos dois dos centuriões',
    para: 'chamando a si dois dos centuriões',
    motivo: '`certos dois` empilha indefinido e numeral. KJV: "And he called unto him two centurions"; Almeida: "E, chamando a si dois centuriões".' },
  { ref: 'ACT 23:23', de: 'a partir das terceira hora',
    para: 'a partir da terceira hora',
    motivo: 'Artigo no plural com numeral no singular. KJV: "at the third hour of the night"; Almeida: "Apromptae para as tres horas da noite".' },
  { ref: 'ACT 23:27', de: 'estando já a ponte de o matarem',
    para: 'estando já a ponto de o matarem',
    motivo: 'Uma letra troca a locução por uma travessia. KJV: "and should have been killed of them"; Almeida: "estando já a ponto de ser morto por elles".' },
  { ref: 'ACT 25:20', de: 'estando em duvida',
    para: 'estando em dúvida',
    motivo: 'A própria fonte escreve `dúvida` com acento em toda parte. Almeida: "estando eu perplexo ácerca da inquirição d\'esta causa".' },
  { ref: 'ACT 26:22', de: 'nada além dos que as [coisas] que os profetas',
    para: 'nada além das [coisas] que os profetas',
    motivo: 'Um `dos que` sobrando antes do artigo certo. KJV: "saying none other things than those which the prophets and Moses did say"; Almeida: "não dizendo nada mais do que o que os prophetas e Moysés disseram".' },
  { ref: 'ACT 26:26', de: 'que nenhuma disto lhe seja oculto',
    para: 'que nada disto lhe seja oculto',
    motivo: '`nenhuma` sem substantivo a que se referir. KJV: "for I am persuaded that none of these things are hidden from him"; Almeida: "pois não creio que nada d\'isto se lhe occulte".' },
  { ref: 'ACT 26:26', de: 'por que isto não foi feito num canto',
    para: 'porque isto não foi feito num canto',
    motivo: 'É conjunção causal, não pergunta. KJV: "for this thing was not done in a corner"; Almeida: "porque isto não se fez em qualquer canto".' },
  { ref: 'ACT 27:40', de: 'foram de levando',
    para: 'foram levando',
    motivo: 'Uma preposição entre o verbo e o gerúndio. KJV: "and made toward shore"; Almeida: "dirigiram-se para a praia".' },
  { ref: 'ACT 27:43', de: 'os primeiros a se lançassem',
    para: 'os primeiros a se lançarem',
    motivo: 'Subjuntivo onde cabe o infinitivo pessoal. KJV: "should cast themselves first into the sea"; Almeida: "que os que podessem nadar se lançassem primeiro ao mar".' },
  { ref: 'ACT 28:4', de: 'os nativos vieram o animal pendurado',
    para: 'os nativos viram o animal pendurado',
    motivo: 'Uma letra troca o verbo. KJV: "And when the barbarians saw the venomous beast hang on his hand"; Almeida: "E os barbaros, vendo-lhe a bicha pendurada na mão".' },
  { ref: 'ACT 28:13', de: 'tendo indo ao redor da costa',
    para: 'tendo ido ao redor da costa',
    motivo: 'Gerúndio no lugar do particípio. KJV: "And from thence we fetched a compass"; Almeida: "D\'onde, indo costeando, viemos a Rhegio".' },

  // --- Salmos 3—74 e 136—137 ---
  { ref: 'PSA 5:5', de: 'tu odeias todas os praticantes',
    para: 'tu odeias todos os praticantes',
    motivo: 'Determinante feminino com substantivo masculino. KJV: "thou hatest all workers of iniquity"; Almeida: "aborreces a todos os que obram a maldade".' },
  { ref: 'PSA 9:1', de: 'SENHOR com todo o meu coração',
    para: 'SENHOR, com todo o meu coração',
    motivo: 'O vocativo ficou sem a vírgula que o fecha, e na leitura em voz alta ele cola no que vem depois. KJV: "I will praise thee, O LORD, with my whole heart"; Almeida: "Eu te louvarei, Senhor, com todo o meu coração".' },
  { ref: 'PSA 10:4', de: 'em todos as seus pensamentos',
    para: 'em todos os seus pensamentos',
    motivo: 'Artigo feminino com substantivo masculino. KJV: "God is not in all his thoughts"; Almeida: "todas as suas cogitações são que não ha Deus".' },
  { ref: 'PSA 10:8', de: 'observam secretamente ao contra o pobre',
    para: 'observam secretamente contra o pobre',
    motivo: 'Uma preposição a mais. KJV: "his eyes are privily set against the poor"; Almeida: "os seus olhos estão occultamente fitos contra o pobre".' },
  { ref: 'PSA 10:13', de: 'Ele diz eu seu coração',
    para: 'Ele diz em seu coração',
    motivo: 'Pronome no lugar da preposição. KJV: "he hath said in his heart"; Almeida: "dizendo no seu coração".' },
  { ref: 'PSA 10:13', de: 'que tu nada [lhe] exigirá',
    para: 'que tu nada [lhe] exigirás',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "Thou wilt not require it"; Almeida: "Tu não o esquadrinharás?".' },
  { ref: 'PSA 11:1', de: 'como, pois, tu dizeis',
    para: 'como, pois, vós dizeis',
    motivo: 'O verbo está no plural e o pronome no singular; a fala segue no plural — `vossa montanha`. KJV: "how say ye to my soul"; Almeida: "como dizeis á minha alma".' },
  { ref: 'PSA 16:3', de: 'e [a] os ilustres',
    para: 'e [a]os ilustres',
    motivo: 'O `a` é pedaço da contração, não palavra solta — sem colar o colchete, a limpeza da ETL deixa `a os ilustres` na tela. KJV: "and to the excellent"; Almeida: "e aos illustres".' },
  { ref: 'PSA 22:10', de: 'desde [que saí d] o útero',
    para: 'desde [que saí d]o útero',
    motivo: 'Mesmo caso de Sl 16:3: o `d` é pedaço de `do`, e o colchete aberto com espaço deixaria `d o útero` na tela. KJV: "I was cast upon thee from the womb"; Almeida: "Sobre ti fui lançado desde a madre".' },
  { ref: 'PSA 17:7', de: 'daqueles se se levantam',
    para: 'daqueles que se levantam',
    motivo: 'O relativo virou um segundo reflexivo. KJV: "from those that rise up against them"; Almeida: "dos que se levantam contra a tua mão direita".' },
  { ref: 'PSA 18:7', de: 'Então a terra de abalou',
    para: 'Então a terra se abalou',
    motivo: 'Preposição no lugar do reflexivo. KJV: "Then the earth shook and trembled"; Almeida: "Então a terra se abalou e tremeu".' },
  { ref: 'PSA 18:7', de: 'dos montes de moveram',
    para: 'dos montes se moveram',
    motivo: 'O mesmo `de` por `se` da primeira metade do versículo. KJV: "the foundations also of the hills moved"; Almeida: "e os fundamentos dos montes tambem se moveram".' },
  { ref: 'PSA 18:10', de: 'sobre as assas do vento',
    para: 'sobre as asas do vento',
    motivo: 'A própria fonte escreve `asas` 82 vezes e `assas` uma. Almeida: "voou sobre as azas do vento".' },
  { ref: 'PSA 20:4', de: 'Que ele de a ti conforme',
    para: 'Que ele dê a ti conforme',
    motivo: 'Sem o acento o verbo vira preposição. KJV: "Grant thee according to thine own heart"; Almeida: "Conceda-te conforme ao teu coração".' },
  { ref: 'PSA 21:8', de: 'a todos o os teus inimigos',
    para: 'a todos os teus inimigos',
    motivo: 'O artigo aparece duas vezes. KJV: "Thine hand shall find out all thine enemies"; Almeida: "A tua mão alcançará todos os teus inimigos".' },
  { ref: 'PSA 25:16', de: 'Olha para mim, e mim, e tem piedade',
    para: 'Olha para mim, e tem piedade',
    motivo: 'O pronome aparece duas vezes. KJV: "Turn thee unto me, and have mercy upon me"; Almeida: "Olha para mim, e tem piedade de mim".' },
  { ref: 'PSA 28:3', de: 'que falam de paz com sem próximo',
    para: 'que falam de paz com seu próximo',
    motivo: 'Preposição no lugar do possessivo. KJV: "which speak peace to their neighbors"; Almeida: "que fallam de paz ao seu proximo".' },
  { ref: 'PSA 30:9', de: 'em minha descida a cova',
    para: 'em minha descida à cova',
    motivo: 'Falta a crase. KJV: "when I go down to the pit?"; Almeida: "quando desço á cova?".' },
  { ref: 'PSA 31:19', de: 'Como [é] grade a tua bondade',
    para: 'Como [é] grande a tua bondade',
    motivo: 'A própria fonte escreve `grande` 825 vezes; `grade` é peça de metal. Almeida: "Oh! quão grande é a tua bondade".' },
  { ref: 'PSA 32:8', de: 'e de ensinarei o caminho',
    para: 'e te ensinarei o caminho',
    motivo: 'Preposição no lugar do pronome — o versículo já diz `Eu te instruirei` antes. KJV: "I will instruct thee and teach thee in the way"; Almeida: "Instruir-te-hei, e ensinar-te-hei o caminho".' },
  { ref: 'PSA 33:6', de: 'Pala palavra do SENHOR',
    para: 'Pela palavra do SENHOR',
    motivo: 'Uma letra troca a preposição por um tecido. KJV: "By the word of the LORD were the heavens made"; Almeida: "Pela palavra do Senhor foram feitos os céus".' },
  { ref: 'PSA 33:20', de: 'ele [é] nossa socorro',
    para: 'ele [é] nosso socorro',
    motivo: 'Possessivo feminino com substantivo masculino — o `nosso escudo` ao lado está certo. KJV: "he is our help and our shield"; Almeida: "elle é o nosso auxilio e o nosso escudo".' },
  { ref: 'PSA 34:18', de: 'e sava os aflitos',
    para: 'e salva os aflitos',
    motivo: 'Uma letra que caiu. KJV: "and saveth such as be of a contrite spirit"; Almeida: "e salva os contritos de espirito".' },
  { ref: 'PSA 35:2', de: 'pequeno e grande escudos',
    para: 'pequenos e grandes escudos',
    motivo: 'Adjetivos no singular com substantivo no plural. KJV: "Take hold of shield and buckler"; Almeida: "Pega do escudo e da rodela".' },
  { ref: 'PSA 35:12', de: 'Ele retribuem o bem',
    para: 'Eles retribuem o bem',
    motivo: 'Pronome no singular com verbo no plural. KJV: "They rewarded me evil for good"; Almeida: "Tornaram-me o mal pelo bem".' },
  { ref: 'PSA 36:11', de: 'e que a não dos perversos',
    para: 'e que a mão dos perversos',
    motivo: 'Uma letra troca a mão por uma negação, e a frase fica sem sujeito. KJV: "and let not the hand of the wicked remove me"; Almeida: "e não me mova a mão dos impios".' },
  { ref: 'PSA 37:14', de: 'O perversos pegarão',
    para: 'Os perversos pegarão',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "The wicked have drawn out the sword"; Almeida: "Os impios puxaram da espada".' },
  { ref: 'PSA 37:20', de: 'eles de desfarão na fumaça',
    para: 'eles se desfarão na fumaça',
    motivo: 'Preposição no lugar do reflexivo. KJV: "into smoke shall they consume away"; Almeida: "desapparecerão, e em fumo se desfarão".' },
  { ref: 'PSA 39:11', de: 'logo tu desfaz o que lhe agrada',
    para: 'logo tu desfazes o que lhe agrada',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "thou makest his beauty to consume away like a moth"; Almeida: "fazes com que a sua belleza se consuma como a traça".' },
  { ref: 'PSA 40:16', de: 'Fiquem contentes e se alegrem-se em ti',
    para: 'Fiquem contentes e alegrem-se em ti',
    motivo: 'O reflexivo aparece dos dois lados do verbo. KJV: "Let all those that seek thee rejoice and be glad in thee"; Almeida: "Folguem e alegrem-se em ti os que te buscam".' },
  { ref: 'PSA 42:7', de: 'todos as tuas ondas',
    para: 'todas as tuas ondas',
    motivo: 'Determinante masculino com substantivo feminino. KJV: "all thy waves and thy billows are gone over me"; Almeida: "todas as tuas ondas e as tuas vagas teem passado sobre mim".' },
  { ref: 'PSA 44:18', de: 'nem nossos passos de desviaram',
    para: 'nem nossos passos se desviaram',
    motivo: 'Preposição no lugar do reflexivo, como em Sl 18:7 e Sl 37:20. KJV: "neither have our steps declined from thy way"; Almeida: "nem os nossos passos se desviaram das tuas veredas".' },
  { ref: 'PSA 44:19', de: 'nos cobriste com sobra de morte',
    para: 'nos cobriste com sombra de morte',
    motivo: 'Uma letra que caiu, e `sobra de morte` não quer dizer nada. KJV: "and covered us with the shadow of death"; Almeida: "e nos cobriste com a sombra da morte".' },
  { ref: 'PSA 45:8', de: 'Todos as tuas roupas',
    para: 'Todas as tuas roupas',
    motivo: 'KJV: "All thy garments smell of myrrh"; Almeida: "Todos os teus vestidos cheiram a myrrha" — de novo o determinante da palavra antiga, masculina, sobre a nova, feminina.' },
  { ref: 'PSA 50:17', de: 'e lança minhas palavras',
    para: 'e lanças minhas palavras',
    motivo: 'Terceira pessoa no meio de uma oração na segunda — `tu odeias` vem antes. KJV: "and castest my words behind thee"; Almeida: "e lanças as minhas palavras para detraz de ti".' },
  { ref: 'PSA 52:7', de: 'confiar a abundância de suas riquezas',
    para: 'confiar na abundância de suas riquezas',
    motivo: '`confiar` pede `em`. KJV: "but trusted in the abundance of his riches"; Almeida: "antes confiou na abundancia das suas riquezas".' },
  { ref: 'PSA 52:7', de: 'e fortaleceu em sua maldade',
    para: 'e se fortaleceu em sua maldade',
    motivo: 'Faltava o reflexivo. KJV: "and strengthened himself in his wickedness"; Almeida: "e se fortaleceu na sua maldade".' },
  { ref: 'PSA 55:11', de: 'a falsidade e o engano não sai',
    para: 'a falsidade e o engano não saem',
    motivo: 'Sujeito composto pede verbo no plural. KJV: "deceit and guile depart not from her streets"; Almeida: "astucia e engano não se apartam das suas ruas".' },
  { ref: 'PSA 62:3', de: 'como um parede tombada',
    para: 'como uma parede tombada',
    motivo: 'Artigo masculino com substantivo feminino. KJV: "as a bowing wall shall ye be"; Almeida: "sereis como uma parede encurvada".' },
  { ref: 'PSA 64:10', de: 'O justo se alegará',
    para: 'O justo se alegrará',
    motivo: 'A própria fonte escreve `alegrará` 22 vezes; `alegará` é de alegar. Almeida: "O justo se alegrará no Senhor".' },
  { ref: 'PSA 65:5', de: 'Tu nos responderá de forma justa',
    para: 'Tu nos responderás de forma justa',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "wilt thou answer us, O God of our salvation"; Almeida: "nos responderás, ó Deus da nossa salvação".' },
  { ref: 'PSA 65:9', de: 'e lhes dá trigo',
    para: 'e lhes dás trigo',
    motivo: 'Terceira pessoa no meio de uma oração toda na segunda — `tu visitas`, `tu preparas`. KJV: "thou preparest them corn"; Almeida: "tu lhe preparas o trigo".' },
  { ref: 'PSA 66:10', de: 'Deus, tem nos provado',
    para: 'Deus, tens nos provado',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "For thou, O God, hast proved us"; Almeida: "Pois tu, ó Deus, nos provaste".' },
  { ref: 'PSA 67:2', de: 'todos as nações',
    para: 'todas as nações',
    motivo: 'Determinante masculino com substantivo feminino. KJV: "thy saving health among all nations"; Almeida: "e entre todas as nações a tua salvação".' },
  { ref: 'PSA 68:9', de: 'e firmaste tu herança',
    para: 'e firmaste tua herança',
    motivo: 'Pronome no lugar do possessivo. KJV: "whereby thou didst confirm thine inheritance"; Almeida: "confortaste a tua herança".' },
  { ref: 'PSA 68:27', de: 'os chefes de Nafitali',
    para: 'os chefes de Naftali',
    motivo: 'A própria fonte escreve `Naftali` 53 vezes e `Nafitali` uma. Almeida: "os principes de Zabulon e os principes de Naphtali".' },
  { ref: 'PSA 68:30', de: 'em [troca] de peças e prata',
    para: 'em [troca] de peças de prata',
    motivo: 'Conjunção no lugar da preposição — não são peças e prata, são peças DE prata. KJV: "till every one submit himself with pieces of silver"; Almeida: "até que cada um se submetta com pedaços de prata".' },
  { ref: 'PSA 69:28', de: 'Sejam riscados dos livro da vida',
    para: 'Sejam riscados do livro da vida',
    motivo: 'Artigo no plural com substantivo no singular. KJV: "Let them be blotted out of the book of the living"; Almeida: "Sejam riscados do livro dos vivos".' },
  { ref: 'PSA 73:18', de: '[e] os lança em assolações',
    para: '[e] os lanças em assolações',
    motivo: 'Terceira pessoa no meio de uma oração na segunda — `tu os fazes` vem antes. KJV: "thou castedst them down into destruction"; Almeida: "tu os lanças em destruição".' },
  { ref: 'PSA 74:5', de: 'como o que levantam machados',
    para: 'como os que levantam machados',
    motivo: 'Artigo no singular com verbo no plural. KJV: "as he had lifted up axes upon the thick trees"; Almeida: "conforme levantara o machado contra a espessura do arvoredo".' },
  { ref: 'PSA 136:9', de: 'À lua e as estrelas',
    para: 'A lua e as estrelas',
    motivo: 'Crase onde não há preposição — a lua é sujeito. KJV: "The moon and stars to rule by night"; Almeida: "A lua e as estrellas para presidirem á noite".' },
  { ref: 'PSA 137:6', de: 'se eu não pôr Jerusalém',
    para: 'se eu não puser Jerusalém',
    motivo: 'Infinitivo no lugar do futuro do subjuntivo, que é o modo que `se` pede aqui. KJV: "if I prefer not Jerusalem above my chief joy"; Almeida: "se não prefiro Jerusalem á minha maior alegria".' },
  { ref: 'PSA 137:7', de: 'até ao seus fundamentos',
    para: 'até aos seus fundamentos',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "even to the foundation thereof"; Almeida: "até aos seus alicerces".' },

  // --- Salmos 77—148, e os dois últimos de Lucas ---
  { ref: 'LUK 10:25', de: 'o que devo fazer para ter para herdar',
    para: 'o que devo fazer para herdar',
    motivo: 'Um `para ter` a mais no meio da pergunta. KJV: "Master, what shall I do to inherit eternal life?"; Almeida: "Mestre, que farei para herdar a vida eterna?".' },
  { ref: 'LUK 10:38', de: 'que eles, enquanto eles caminhavam',
    para: 'que, enquanto eles caminhavam',
    motivo: 'O pronome aparece duas vezes. KJV: "Now it came to pass, as they went"; Almeida: "E aconteceu que, indo elles de caminho".' },
  { ref: 'PSA 137:8', de: 'Bem-aventurado a quem te retribuir',
    para: 'Bem-aventurado aquele que te retribuir',
    motivo: 'Sem o antecedente a bem-aventurança fica sem quem a receba. KJV: "happy shall he be, that rewardeth thee"; Almeida: "feliz aquelle que te retribuir o pago".' },
  { ref: 'PSA 140:4', de: 'guarda-me do homens violentos',
    para: 'guarda-me dos homens violentos',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "preserve me from the violent man"; Almeida: "guarda-me do homem violento".' },
  { ref: 'PSA 148:10', de: 'aves que tem asas',
    para: 'aves que têm asas',
    motivo: 'Terceira pessoa do plural leva acento. KJV: "creeping things, and flying fowl"; Almeida: "reptis e aves voadoras".' },
  { ref: 'PSA 95:10', de: 'aguentei com desgosto d [esta] geração',
    para: 'aguentei esta geração com desgosto',
    motivo: '`aguentar` é transitivo direto e não pede preposição; o colchete guardava o `d` da contração que sobra quando ela sai. KJV: "Forty years long was I grieved with this generation"; Almeida: "Quarenta annos estive desgostado com esta geração".' },
  { ref: 'PSA 96:12', de: 'as árvores dos bosque',
    para: 'as árvores do bosque',
    motivo: 'Artigo no plural com substantivo no singular. KJV: "then shall all the trees of the wood rejoice"; Almeida: "então se regozijarão todas as arvores do bosque".' },
  { ref: 'PSA 99:8', de: 'tu os respondia',
    para: 'tu os respondias',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "Thou answeredst them, O LORD our God"; Almeida: "Tu os escutaste, Senhor nosso Deus".' },
  { ref: 'PSA 101:5', de: 'de seu próximo as escondidas',
    para: 'de seu próximo às escondidas',
    motivo: 'Falta a crase da locução. KJV: "Whoso privily slandereth his neighbor"; Almeida: "Aquelle que murmura do seu proximo ás escondidas".' },
  { ref: 'PSA 102:2', de: 'inclina a mim teu ouvidos',
    para: 'inclina a mim teus ouvidos',
    motivo: 'Possessivo no singular com substantivo no plural. KJV: "incline thine ear unto me"; Almeida: "inclina para mim os teus ouvidos".' },
  { ref: 'PSA 102:3', de: 'meus ossos se têm se queimado',
    para: 'meus ossos se têm queimado',
    motivo: 'O reflexivo aparece dos dois lados do auxiliar. KJV: "and my bones are burned as a hearth"; Almeida: "e os meus ossos ardem como um lar".' },
  { ref: 'PSA 103:18', de: 'se lembram de dos mandamentos',
    para: 'se lembram dos mandamentos',
    motivo: 'A preposição aparece duas vezes. KJV: "and to those that remember his commandments"; Almeida: "e sobre os que se lembram dos seus mandamentos".' },
  { ref: 'PSA 104:8', de: 'que tu lhes tinha fundado',
    para: 'que tu lhes tinhas fundado',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "unto the place which thou hast founded for them"; Almeida: "até ao logar que para ellas fundaste".' },
  { ref: 'PSA 104:15', de: 'faz o rosto brilhar o rosto com o azeite',
    para: 'faz brilhar o rosto com o azeite',
    motivo: 'O objeto aparece dos dois lados do verbo. KJV: "and oil to make his face to shine"; Almeida: "e o azeite que faz reluzir o seu rosto".' },
  { ref: 'PSA 105:45', de: 'e obedecessem a leis dele',
    para: 'e obedecessem às leis dele',
    motivo: '`obedecer` pede preposição, e falta também o artigo. KJV: "and keep his laws"; Almeida: "e observassem as suas leis".' },
  { ref: 'PSA 107:2', de: 'resgatou das mão do adversário',
    para: 'resgatou da mão do adversário',
    motivo: 'Artigo no plural com substantivo no singular. KJV: "whom he hath redeemed from the hand of the enemy"; Almeida: "os que remiu da mão do inimigo".' },
  { ref: 'PSA 107:41', de: 'faz famílias como a rebanhos',
    para: 'faz famílias como rebanhos',
    motivo: 'Uma preposição a mais dentro da comparação. KJV: "and maketh him families like a flock"; Almeida: "e multiplica as familias como rebanhos".' },
  { ref: 'PSA 108:11', de: 'Tu que tinha nos rejeitado',
    para: 'Tu que tinhas nos rejeitado',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "Wilt not thou, O God, who hast cast us off?"; Almeida: "Porventura não serás tu, ó Deus, que nos rejeitaste?".' },
  { ref: 'PSA 111:4', de: 'piedoso é misericordioso é o SENHOR',
    para: 'piedoso e misericordioso é o SENHOR',
    motivo: 'O verbo aparece no lugar da conjunção. KJV: "the LORD is gracious and full of compassion"; Almeida: "piedoso e misericordioso é o Senhor".' },
  { ref: 'PSA 111:6', de: 'o poder se suas obras',
    para: 'o poder de suas obras',
    motivo: 'Pronome no lugar da preposição. KJV: "He hath showed his people the power of his works"; Almeida: "Annunciou ao seu povo o poder das suas obras".' },
  { ref: 'PSA 111:10', de: 'todos o que isto praticam',
    para: 'todos os que isto praticam',
    motivo: 'Artigo no singular com verbo no plural. KJV: "a good understanding have all they that do his commandments"; Almeida: "bom entendimento teem todos os que cumprem os seus mandamentos".' },
  { ref: 'PSA 77:12', de: 'Meditarei em todos as tuas obras',
    para: 'Meditarei em todas as tuas obras',
    motivo: 'Determinante masculino com substantivo feminino. KJV: "I will meditate also of all thy work"; Almeida: "Meditarei tambem em todas as tuas obras".' },
  { ref: 'PSA 77:18', de: 'a terra se abalou e tremou',
    para: 'a terra se abalou e tremeu',
    motivo: 'Uma letra troca o verbo. KJV: "the earth trembled and shook"; Almeida: "a terra se abalou e tremeu".' },
  { ref: 'PSA 78:30', de: 'Porem, estando eles',
    para: 'Porém, estando eles',
    motivo: 'A própria fonte escreve `Porém` com acento em toda parte. KJV: "But while their meat was yet in their mouths".' },
  { ref: 'PSA 78:51', de: 'as primícias nas forças nas tendas',
    para: 'as primícias das forças nas tendas',
    motivo: 'A preposição do primeiro complemento virou a do segundo. KJV: "the chief of their strength in the tabernacles of Ham"; Almeida: "primicias da sua força nas tendas de Cão".' },
  { ref: 'PSA 80:5', de: 'e lhes faz beber lágrimas',
    para: 'e lhes fazes beber lágrimas',
    motivo: 'Terceira pessoa no meio de uma oração na segunda — `Tu os alimentas` vem antes. KJV: "and givest them tears to drink in great measure"; Almeida: "e lhes dás a beber lagrimas, com abundancia".' },
  { ref: 'PSA 81:6', de: 'suas mãos foram livrados',
    para: 'suas mãos foram livradas',
    motivo: 'Particípio no masculino com sujeito feminino. KJV: "his hands were delivered from the pots"; Almeida: "as suas mãos foram livres das marmitas".' },
  { ref: 'PSA 88:5', de: 'tu já não te lembra mais',
    para: 'tu já não te lembras mais',
    motivo: 'Terceira pessoa com o pronome `tu`. KJV: "whom thou rememberest no more"; Almeida: "dos quaes te não lembras mais".' },
  { ref: 'PSA 113:7', de: 'Que do levanta o pobre',
    para: 'Que levanta o pobre',
    motivo: 'Uma preposição a mais antes do verbo. KJV: "He raiseth up the poor out of the dust"; Almeida: "Levanta o pobre do pó".' },
  { ref: 'PSA 115:6', de: 'tem nariz, mas não cheiram',
    para: 'têm nariz, mas não cheiram',
    motivo: 'O mesmo versículo escreve `Têm ouvidos` com acento na primeira metade — a própria fonte se contradiz dentro da linha. Almeida: "narizes teem, mas não cheiram".' },
  { ref: 'PSA 119:10', de: 'Eu te busco como todo o meu coração',
    para: 'Eu te busco com todo o meu coração',
    motivo: 'Uma letra troca a preposição por uma comparação. KJV: "With my whole heart have I sought thee"; Almeida: "Com todo o meu coração te busquei".' },

  // --- As duas que o dono decidiu (05/09/2026) ---
  { ref: 'JER 4:14', de: 'os teus meus pensamentos',
    para: 'os teus vãos pensamentos',
    motivo: '`teus meus` não é português, e a palavra que volta vem das duas testemunhas, não de mim: KJV "thy vain thoughts", Almeida 1911 "os pensamentos da tua vaidade". O dono decidiu em 05/09/2026 que KJV e Almeida são AUTORIDADE e não só veto — quando as duas apontam claramente, a palavra entra, mesmo acrescentando.' },
  { ref: 'PSA 36:2', de: '[que não] achar [nem] odiar',
    para: '[que não] acha [nem] odeia',
    motivo: 'Dois infinitivos onde a oração pede indicativo. Aqui as testemunhas leem DIFERENTE da Bíblia Livre — KJV "until his iniquity be found to be hateful", Almeida 1911 "até que a sua iniquidade se descubra ser detestavel" —, e a leitura dela (o orgulhoso não chega a enxergar nem a odiar a própria maldade) é defensável e é a das versões modernas. Então conserta-se a gramática quebrada, não se troca a tradução.' },
  { ref: 'PSA 119:71', de: 'Foi bom pra mim',
    para: 'Foi bom para mim',
    motivo: 'Eu tinha guardado este como decisão do dono, achando que podia ser registro escolhido. Não é: a própria fonte escreve `para` 6.985 vezes e `pra` UMA, aqui. Almeida 1911: "Foi-me bom ter sido afflicto"; KJV: "It is good for me that I have been afflicted". É lapso de digitação, e o versículo era o último que travava perícope por texto.' },
  { ref: 'GEN 3:20', de: 'mãe de todos o viventes',
    para: 'mãe de todos os viventes',
    motivo: 'Artigo no singular com substantivo no plural. KJV: "because she was the mother of all living"; Almeida 1911: "porquanto ella era a mãe de todos os viventes". Achado pelo PORTÃO e não por leitura: um subagente que reescrevia o contexto de Gn 2 citou a forma correta, e a conferência byte a byte da citação denunciou a fonte.' },

  // ══ A rede ortográfica (07/09/2026) — 154 receitas em 143 versículos ══
  //
  // Terceira rede, depois da razão de comprimento contra as duas testemunhas e
  // da leitura humana das 2.823 perícopes. Ela procura duas coisas que as
  // outras não veem: sequência de letras impossível em português, e hapax a
  // distância de edição 1 de uma palavra que existe. O defeito que ela acha não
  // muda o tamanho do versículo nem tropeça o olho de quem lê corrido —
  // `resplandescente`, `proco`, `tmou`, `a o SENHOR` — e ia ser narrado assim.
  //
  // Cada uma foi conferida contra A11 e KJV; o `motivo` traz o trecho das duas,
  // que é a receita de verdade. Os 13 descartes e os 7 casos sem conserto
  // possível estão em `data/defeitos-rede-ortografica.json`, com o porquê.
  //
  // O bloco `a o` tem uma armadilha registrada: no relatório o campo `de` é
  // JANELA DE CONTEXTO e o `para` é só o token, contrato oposto ao deste
  // arquivo. Aplicado como troca literal, ele substituiria a oração inteira por
  // "ao" em 35 versículos. Aqui as 35 já vêm convertidas para o par literal, e
  // a janela é a MENOR que ainda seja única no versículo — em 1Cr 21:26 a
  // janela de 40 chars do relatório engolia `em o que`, que é outra receita do
  // mesmo versículo, e a segunda deixaria de casar.
  //
  // Dez achados caem dentro de colchete editorial, e o colchete importa porque
  // `corrigirVersiculo` roda ANTES de `removerColchetes`. Em `[é d] aquele` não
  // falta letra nenhuma: o espaço está do lado errado da marcação, e a receita
  // é `[é d]aquele`. Dois desses dez não estão aqui — `[Parece] -te` e
  // `[alcançá] -lo` são espaço em branco em volta do colchete, a mesma matéria
  // que `blivre-texto.ts` já cuida, e viraram regra lá (`HIFEN_ANTES_DO_ESPACO`).
  // ── contração desfeita (bloco `a o`) (35)
  {
    ref: 'JOS 24:15',
    de: 'deuses a os quais',
    para: 'deuses aos quais',
    motivo:
      'A11: Porém, se vos parece mal aos vossos olhos servir ao Senhor, escolhei-v… · ' +
      'KJV: And if it seem evil unto you to serve the LORD, choose you t…',
  },
  {
    ref: '1SA 15:9',
    de: 'e a o melhor',
    para: 'e ao melhor',
    motivo:
      'A11: E Saul e o povo perdoaram a Agag, e ao melhor das ovelhas e das vaccas, e ás ' +
      'da … · KJV: But Saul and the people spared Agag, and the best of the she…',
  },
  {
    ref: '1CH 15:11',
    de: 'e a os levitas',
    para: 'e aos levitas',
    motivo:
      'A11: E chamou David os sacerdotes Zadok e Abiathar, e os levitas, Uriel, Asaias, ' +
      'Joel, Semaias, Eliel, e Amminadab; · KJV: And David called for Zadok and Abiathar ' +
      'the priests, and for…',
  },
  {
    ref: '1CH 16:34',
    de: 'Celebrai a o SENHOR,',
    para: 'Celebrai ao SENHOR,',
    motivo:
      'A11: Louvae ao Senhor, porque é bom; pois a sua benignidade dur… · KJV: O give ' +
      'thanks unto the LORD; for he is good; for his mercy e…',
  },
  {
    ref: '1CH 16:40',
    de: 'holocaustos a o SENHOR',
    para: 'holocaustos ao SENHOR',
    motivo:
      'A11: Para offerecerem ao Senhor os holocaustos sobre o altar dos holocaus… · KJV: ' +
      'To offer burnt offerings unto the LORD upon the altar of the…',
  },
  {
    ref: '1CH 16:41',
    de: 'glorificar a o SENHOR,',
    para: 'glorificar ao SENHOR,',
    motivo:
      'A11: …apontados pelos seus nomes, para louvarem ao Senhor, porque a sua ' +
      'benignidade dura perpetuame… · KJV: And with them Heman and Jeduthun, and the rest ' +
      'that were cho…',
  },
  {
    ref: '1CH 16:42',
    de: 'e a os filhos',
    para: 'e aos filhos',
    motivo:
      'A11: Com elles pois estavam Heman e Jeduthun, com trombetas e cymbalos, para os ' +
      'que se faziam ouvir, e com instrume… · KJV: And with them Heman and Jeduthun with ' +
      'trumpets and cymbals f…',
  },
  {
    ref: '1CH 17:5',
    de: 'tirei a os filhos',
    para: 'tirei aos filhos',
    motivo:
      'A11: Porque em casa nenhuma morei, desde o dia em que fiz subir a Israel até ao ' +
      'dia de hoje; mas fui de tenda em te… · KJV: For I have not dwelt in a house since ' +
      'the day that I brought…',
  },
  {
    ref: '1CH 17:6',
    de: 'Israel, a os quais',
    para: 'Israel, aos quais',
    motivo:
      'A11: Por todas as partes por onde andei com todo o Israel, porventura fallei ' +
      'alguma palavra a algum dos juizes de I… · KJV: Wheresoever I have walked with all ' +
      'Israel, spoke I a word to…',
  },
  {
    ref: '1CH 18:11',
    de: 'dedicou a o SENHOR,',
    para: 'dedicou ao SENHOR,',
    motivo:
      'A11: Os quaes David tambem consagrou ao Senhor, juntamente com a prata e oiro que ' +
      'trouxe… · KJV: Them also king David dedicated unto the LORD, with the silve…',
  },
  {
    ref: '1CH 21:2',
    de: 'e a os príncipes',
    para: 'e aos príncipes',
    motivo:
      'A11: E disse David a Joab e aos maioraes do povo: Ide, numerae a Israel, … · KJV: ' +
      'And David said to Joab and to the rulers of the people, Go, …',
  },
  {
    ref: '1CH 21:7',
    de: 'negócio a os olhos',
    para: 'negócio aos olhos',
    motivo:
      'A11: E este negocio tambem pareceu mal aos olhos de Deus: pelo que feriu a Israel. ' +
      '· KJV: And God was displeased with this thing; therefore he smote I…',
  },
  {
    ref: '1CH 21:26',
    de: 'altar a o SENHOR,',
    para: 'altar ao SENHOR,',
    motivo:
      'A11: Então David edificou ali um altar ao Senhor, e offereceu n\'elle holocaustos e ' +
      'sacrifi… · KJV: And David built there an altar unto the LORD, and offered bu…',
  },
  {
    ref: '1CH 21:26',
    de: 'invocou a o SENHOR,',
    para: 'invocou ao SENHOR,',
    motivo:
      'A11: Então David edificou ali um altar ao Senhor, e offereceu n\'elle holocaustos e ' +
      'sacrifi… · KJV: And David built there an altar unto the LORD, and offered bu…',
  },
  {
    ref: '1CH 21:18',
    de: 'altar a o SENHOR',
    para: 'altar ao SENHOR',
    motivo:
      'A11: … que subisse David para levantar um altar ao Senhor na eira d\'Ornan, ' +
      'jebuseo. · KJV: Then the angel of the LORD commanded Gad to say to David, th…',
  },
  {
    ref: '1CH 21:22',
    de: 'altar a o SENHOR,',
    para: 'altar ao SENHOR,',
    motivo:
      'A11: …ar da eira, para edificar n\'elle um altar ao Senhor; dá-m\'o pelo seu valor, ' +
      'para que cesse es… · KJV: Then David said to Ornan, Grant me the place of this ' +
      'threshi…',
  },
  {
    ref: '1CH 22:5',
    de: 'edificar a o SENHOR',
    para: 'edificar ao SENHOR',
    motivo:
      'A11: Porque dizia David: Salomão, meu filho, ainda é moço e tenro, e a casa que se ' +
      'ha de edificar para o Senhor se … · KJV: And David said, Solomon my son is young ' +
      'and tender, and the …',
  },
  {
    ref: '1CH 22:6',
    de: 'casa a o SENHOR',
    para: 'casa ao SENHOR',
    motivo:
      'A11: …ho, e lhe ordenou que edificasse uma casa ao Senhor Deus de Israel. · KJV: ' +
      'Then he called for Solomon his son, and charged him to build…',
  },
  {
    ref: '1CH 22:11',
    de: 'casa a o SENHOR',
    para: 'casa ao SENHOR',
    motivo:
      'A11: Agora pois, meu filho, o Senhor seja comtigo; e prospera, e edifica a casa do ' +
      'Senhor teu Deus, como elle disse… · KJV: Now, my son, the LORD be with thee; and ' +
      'prosper thou, and bu…',
  },
  {
    ref: '1CH 22:14',
    de: 'pedra, a o qual',
    para: 'pedra, ao qual',
    motivo:
      'A11: Eis que na minha oppressão preparei para a casa do Senhor cem mil talentos de ' +
      'oiro, e um milhão de talentos de… · KJV: Now, behold, in my trouble I have ' +
      'prepared for the house of …',
  },
  {
    ref: '1CH 22:19',
    de: 'buscar a o SENHOR',
    para: 'buscar ao SENHOR',
    motivo:
      'A11: …sso coração e a vossa alma para buscardes ao Senhor vosso Deus; e levantae- ' +
      'vos, e edificae o … · KJV: Now set your heart and your soul to seek the LORD your ' +
      'God; …',
  },
  {
    ref: '1CH 23:2',
    de: 'e a os sacerdotes',
    para: 'e aos sacerdotes',
    motivo:
      'A11: …todos os principes de Israel, como tambem aos sacerdotes e levitas. · KJV: ' +
      'And he gathered together all the princes of Israel, with the…',
  },
  {
    ref: '1CH 23:5',
    de: 'louvar a o SENHOR,',
    para: 'louvar ao SENHOR,',
    motivo:
      'A11: …mil porteiros, e quatro mil para louvarem ao Senhor com os instrumentos, que ' +
      'eu fiz para o lo… · KJV: Moreover four thousand were porters; and four thousand ' +
      'prais…',
  },
  {
    ref: '1CH 23:6',
    de: 'conforme a os filhos',
    para: 'conforme aos filhos',
    motivo:
      'A11: E David os repartiu por turnos, segundo os filhos de Levi, Gerson, Kohath e ' +
      'Merari. · KJV: And David divided them into courses among the sons of Levi, …',
  },
  {
    ref: '1CH 23:31',
    de: 'holocaustos a o SENHOR',
    para: 'holocaustos ao SENHOR',
    motivo:
      'A11: E para cada offerecimento dos holocaustos do Senhor, nos sabbados, nas luas ' +
      'novas, e nas solemnidades, por con… · KJV: And to offer all burnt sacrifices unto ' +
      'the LORD in the sabba…',
  },
  {
    ref: '1CH 23:30',
    de: 'louvar a o SENHOR,',
    para: 'louvar ao SENHOR,',
    motivo:
      'A11: …da manhã em pé para louvarem e celebrarem ao Senhor; e similhantemente á ' +
      'tarde; · KJV: And to stand every morning to thank and praise the LORD, and…',
  },
  {
    ref: '1CH 25:1',
    de: 'ministério a os filhos',
    para: 'ministério aos filhos',
    motivo:
      'A11: E David, juntamente com os capitães do exercito, separou para o ministerio os ' +
      'filhos de Asaph, e de Heman, e d… · KJV: Moreover David and the captains of the ' +
      'host separated to the…',
  },
  {
    ref: '1CH 25:3',
    de: 'louvar a o SENHOR.',
    para: 'louvar ao SENHOR.',
    motivo:
      'A11: …ual prophetizava, louvando e dando graças ao Senhor. · KJV: Of Jeduthun: the ' +
      'sons of Jeduthun; Gedaliah, and Zeri, and J…',
  },
  {
    ref: '1CH 26:21',
    de: 'Quanto a os filhos',
    para: 'Quanto aos filhos',
    motivo:
      'A11: Quanto aos filhos de Ladan, filhos de Ladan gersonit… · KJV: As concerning ' +
      'the sons of Laadan; the sons of the Gershonite…',
  },
  {
    ref: '1CH 29:5',
    de: 'oferta a o SENHOR?',
    para: 'oferta ao SENHOR?',
    motivo:
      'A11: … mão, para offerecer hoje voluntariamente ao Senhor? · KJV: The gold for ' +
      'things of gold, and the silver for things of si…',
  },
  {
    ref: '1CH 29:9',
    de: 'ofereceram a o SENHOR',
    para: 'ofereceram ao SENHOR',
    motivo:
      'A11: …om coração perfeito voluntariamente deram ao Senhor: e tambem o rei David se ' +
      'alegrou com gran… · KJV: Then the people rejoiced, for that they offered ' +
      'willingly, b…',
  },
  {
    ref: '1CH 29:10',
    de: 'abençoou a o SENHOR',
    para: 'abençoou ao SENHOR',
    motivo:
      'A11: Pelo que David louvou ao Senhor perante os olhos de toda a congregação; e… · ' +
      'KJV: Wherefore David blessed the LORD before all the congregation…',
  },
  {
    ref: '1CH 29:25',
    de: 'Salomão a os olhos',
    para: 'Salomão aos olhos',
    motivo:
      'A11: E o Senhor magnificou a Salomão grandissimamente, perante os olhos de todo o ' +
      'Israel: e deu-lhe magestade real,… · KJV: And the LORD magnified Solomon ' +
      'exceedingly in the sight of a…',
  },
  {
    ref: '2CH 30:18',
    de: 'conforme a o que',
    para: 'conforme ao que',
    motivo:
      'A11: Porque uma multidão do povo, muitos d\'Ephraim e Manasseh, Issacar e Zebulon, ' +
      'se não tinham purificado, e comtu… · KJV: For a multitude of the people, even many ' +
      'of Ephraim, and Man…',
  },
  {
    ref: 'EZE 18:17',
    de: 'mal a] o pobre',
    para: 'mal a]o pobre',
    motivo:
      'A11: Desviar do afflicto a sua mão, não receber usura em demasia, fizer os meus ' +
      'juizos, e andar nos meus estatutos,… · KJV: That hath taken off his hand from the ' +
      'poor, that hath not re…',
  },
  // ── contração desfeita (22)
  {
    ref: 'EXO 38:15',
    de: 'cortinas de a quinze côvados',
    para: 'cortinas de quinze côvados',
    motivo:
      'A11: …banda da porta do pateo de ambos os lados eram cortinas de quinze covados: ' +
      'as suas columnas tres e as suas bases tr… · KJV: …er side of the court gate, on ' +
      'this hand and that hand, were hangings of fifteen cubits; their pillars three, and ' +
      'their sockets three.',
  },
  {
    ref: 'LEV 22:28',
    de: 'em um dia a o e a seu filho',
    para: 'em um dia a ele e a seu filho',
    motivo:
      'A11: Tambem boi ou gado miudo, a elle e a seu filho não degolareis n\'um dia. · ' +
      'KJV: And whether it be cow or ewe, ye shall not kill it and her young both in one ' +
      'day.',
  },
  {
    ref: 'NUM 21:34',
    de: 'o dei, a o e a todo seu povo',
    para: 'o dei, a ele e a todo seu povo',
    motivo:
      'A11: …mas, porque eu t\'o tenho dado na tua mão, a elle, e a todo o seu povo, e a ' +
      'sua terra, e far-lhe-has como fizest… · KJV: …ORD said unto Moses, Fear him not: ' +
      'for I have delivered him into thy hand, and all his people, and his land; and thou ' +
      'shalt do to him as thou didst unto …',
  },
  {
    ref: 'RUT 3:2',
    de: 'aventa esta noite a os grãos',
    para: 'aventa esta noite os grãos',
    motivo:
      'A11: …e, de nossa parentela? eis que esta noite padejará a cevada na eira. · KJV: ' +
      '… Boaz of our kindred, with whose maidens thou wast? Behold, he winnoweth barley ' +
      'tonight in the threshingfloor.',
  },
  {
    ref: '2KI 2:7',
    de: 'em frente a o longe',
    para: 'em frente, ao longe',
    motivo:
      'A11: …incoenta homens dos filhos dos prophetas, e de longe pararam defronte: e ' +
      'elles ambos pararam junto ao Jordão. · KJV: And fifty men of the sons of the ' +
      'prophets went, and stood to view afar off: and they two stood by Jordan.',
  },
  {
    ref: '1CH 21:26',
    de: 'em o que ofereceu holocaustos',
    para: 'em que ofereceu holocaustos',
    motivo:
      'A11: …ão David edificou ali um altar ao Senhor, e offereceu n\'elle holocaustos e ' +
      'sacrificios pacificos: e invocou o Senh… · KJV: And David built there an altar ' +
      'unto the LORD, and offered burnt offerings and peace offerings, and called upon ' +
      'the LORD; and he answe…',
  },
  {
    ref: '1CH 21:26',
    de: 'em o altar do holocausto',
    para: 'no altar do holocausto',
    motivo:
      'A11: …hor, o qual lhe respondeu com fogo do céu sobre o altar do holocausto. · ' +
      'KJV: …nd called upon the LORD; and he answered him from heaven by fire upon the ' +
      'altar of burnt offering.',
  },
  {
    ref: '1CH 23:11',
    de: 'por o qual foram contados',
    para: 'pelo qual foram contados',
    motivo:
      'A11: … Jeus e Berias não tiveram muitos filhos; pelo que foram contados em casa de ' +
      'seus paes por uma só familia. · KJV: …d Zizah the second: but Jeush and Beriah had ' +
      'not many sons; therefore they were in one reckoning, according to their father\'s ' +
      'house.',
  },
  {
    ref: '1CH 23:31',
    de: 'por a conta e forma',
    para: 'pela conta e forma',
    motivo:
      'A11: …ados, nas luas novas, e nas solemnidades, por conta, segundo o seu costume, ' +
      'continuamente perante o Senhor: · KJV: …D in the sabbaths, in the new moons, and ' +
      'on the set feasts, by number, according to the order commanded unto them, ' +
      'continually before the LORD:',
  },
  {
    ref: '2CH 9:12',
    de: 'mais de o que havia trazido',
    para: 'mais do que havia trazido',
    motivo:
      'A11: …do quanto lhe agradou, e o que lhe pediu, alem do que ella mesma trouxera ao ' +
      'rei: assim virou-se e foi para a sua t… · KJV: …to the queen of Sheba all her ' +
      'desire, whatsoever she asked, beside that which she had brought unto the king. So ' +
      'she turned, and went away to her own land…',
  },
  {
    ref: '2CH 18:2',
    de: 'por o que matou Acabe',
    para: 'pelo que matou Acabe',
    motivo:
      'A11: …s annos desceu elle para Achab a Samaria; e Achab matou ovelhas e bois em ' +
      'abundancia, para elle e para o povo qu… · KJV: And after certain years he went ' +
      'down to Ahab to Samaria. And Ahab killed sheep and oxen for him in abundance, and ' +
      'for the people that he had with h…',
  },
  {
    ref: '2CH 18:34',
    de: 'por o que esteve o rei',
    para: 'pelo que esteve o rei',
    motivo:
      'A11: E aquelle dia cresceu a peleja, mas o rei d\'Israel susteve-se em pé no carro ' +
      'defronte dos syros até á tarde; e… · KJV: And the battle increased that day: ' +
      'howbeit the king of Israel stayed himself up in his chariot against the Syrians ' +
      'until the even: and abou…',
  },
  {
    ref: '2CH 22:1',
    de: 'por o qual reinou Acazias',
    para: 'pelo qual reinou Acazias',
    motivo:
      'A11: …aial, tinha morto a todos os mais velhos: e assim reinou Achazias, filho de ' +
      'Jorão, rei de Judah. · KJV: And the inhabitants of Jerusalem made Ahaziah his ' +
      'youngest son king in his stead: for the band of men that cam…',
  },
  {
    ref: 'PRO 10:17',
    de: '[é d] aquele',
    para: '[é d]aquele',
    motivo:
      'A11: O caminho para a vida é d\'aquelle que guarda a correcção, mas o que deixa a ' +
      'reprehensã… · KJV: He is in the way of life that keepeth instruction: but he that ' +
      'refuseth reproof erreth.',
  },
  {
    ref: 'PRO 24:18',
    de: 'de o SENHOR veja',
    para: 'de o SENHOR ver',
    motivo:
      'A11: Para que o Senhor o não veja, e seja mau aos seus olhos, e desvie d\'el… · ' +
      'KJV: Lest the LORD see it , and it displease him, and he turn away his wrath from ' +
      'him…',
  },
  {
    ref: 'ISA 5:23',
    de: '[Ai d] os',
    para: '[Ai d]os',
    motivo:
      'A11: Dos que justificam ao impio por peitas, e da justiça dos justos se de… · KJV: ' +
      'Which justify the wicked for reward, and take away the righteousness of the ' +
      'righteou…',
  },
  {
    ref: 'ISA 57:18',
    de: 'a ele a os que por ele lamentam',
    para: 'a ele e aos que por ele lamentam',
    motivo:
      'A11: …iarei, e lhes tornarei a dar consolações, a saber, aos seus pranteadores. · ' +
      'KJV: … ways, and will heal him: I will lead him also, and restore comforts unto ' +
      'him and to his mourners.',
  },
  {
    ref: 'EZE 40:29',
    de: 'e de a largura de vinte e cinco',
    para: 'e a largura de vinte e cinco',
    motivo:
      'A11: …: o comprimento era de cincoenta covados, e a largura de vinte e cinco ' +
      'covados. · KJV: … porches thereof round about: it was fifty cubits long, and five ' +
      'and twenty cubits broad.',
  },
  {
    ref: 'HAB 1:4',
    de: 'por o juízo é distorcido',
    para: 'por isso o juízo é distorcido',
    motivo:
      'A11: … nunca sae; porque o impio cérca o justo, e sae a sentença torcida. · KJV: … ' +
      'go forth: for the wicked doth compass about the righteous; therefore wrong ' +
      'judgment proceedeth.',
  },
  {
    ref: 'HAG 2:18',
    de: 'desde o dia em o fundamento',
    para: 'desde o dia em que o fundamento',
    motivo:
      'A11: … desde o vigesimo quarto dia do mez nono, desde o dia em que se fundou o ' +
      'templo do Senhor, ponde o vosso coração n\'isto. · KJV: …d, from the four and ' +
      'twentieth day of the ninth month, even from the day that the foundation of the ' +
      'LORD\'s temple was laid, consider it .',
  },
  {
    ref: 'MAR 6:11',
    de: 'a [os de] Sodoma',
    para: '[aos de] Sodoma',
    motivo:
      'A11: E, quando alguns vos não receberem, nem vos ouvirem, saindo d\'ali, sacudi o ' +
      'pó que estiver debaixo dos vossos … · KJV: … testimony against them. Verily I say ' +
      'unto you, It shall be more tolerable for Sodom and Gomorrah in the day of ' +
      'judgment, than for that city.',
  },
  {
    ref: 'MAR 6:11',
    de: 'a [os d] aquela',
    para: '[aos d]aquela',
    motivo:
      'A11: …ia no dia de juizo para Sodoma e Gomorrah do que para os d\'aquella cidade. · ' +
      'KJV: …re tolerable for Sodom and Gomorrah in the day of judgment, than for that ' +
      'city.',
  },
  // ── letra trocada, transposta ou faltando (51)
  {
    ref: 'GEN 49:8',
    de: 'Tua mão esterá sobre o pescoço',
    para: 'Tua mão estará sobre o pescoço',
    motivo:
      'A11: Judah, te louvarão os teus irmãos; a tua mão será sobre o pescoço de teus ' +
      'inimigos: os filhos de teu pae a … · KJV: Judah, thou art he whom thy brethren ' +
      'shall praise: thy hand shall be in the neck of thine enemies; thy father\'s ' +
      'children shall bow down befo…',
  },
  {
    ref: 'EXO 34:30',
    de: 'rosto era resplandescente',
    para: 'rosto era resplandecente',
    motivo:
      'A11: …hos d\'Israel para Moysés, eis que a pelle do seu rosto resplandecia; pelo ' +
      'que temeram de chegar-se a elle. · KJV: …hen Aaron and all the children of Israel ' +
      'saw Moses, behold, the skin of his face shone; and they were afraid to come nigh ' +
      'him.',
  },
  {
    ref: 'EXO 34:35',
    de: 'rosto era resplandescente',
    para: 'rosto era resplandecente',
    motivo:
      'A11: Assim pois viam os filhos d\'Israel o rosto de Moysés, que resplandecia a ' +
      'pelle do rosto de Moysés: e tornou Mo… · KJV: And the children of Israel saw the ' +
      'face of Moses, that the skin of Moses\' face shone: and Moses put the veil upon his ' +
      'face again, until he went …',
  },
  {
    ref: 'EXO 36:10',
    de: 'uma com aa outra',
    para: 'uma com a outra',
    motivo:
      'A11: … uma com a outra; e outras cinco cortinas ligou uma com outra. · KJV: …five ' +
      'curtains one unto another: and the other five curtains he coupled one unto ' +
      'another.',
  },
  {
    ref: 'LEV 13:38',
    de: 'tiver machas, machas brancas',
    para: 'tiver manchas, manchas brancas',
    motivo:
      'A11: E, quando homem ou mulher tiverem empolas brancas na pelle da sua carne, · ' +
      'KJV: If a man also or a woman have in the skin of their flesh bright spots, even ' +
      'white bright spots;',
  },
  {
    ref: 'LEV 13:39',
    de: 'parecerem machas brancas',
    para: 'parecerem manchas brancas',
    motivo:
      'A11: Então o sacerdote olhará, e eis que, se na pelle da sua carne apparecem ' +
      'empolas recolhidas, brancas, bustela b… · KJV: Then the priest shall look: and, ' +
      'behold, if the bright spots in the skin of their flesh be darkish white; it is a ' +
      'freckl…',
  },
  {
    ref: 'LEV 14:37',
    de: 'se virem machas nas paredes',
    para: 'se virem manchas nas paredes',
    motivo:
      'A11: E, vendo a praga, e eis que se a praga nas paredes da casa tem covinhas ' +
      'verdes ou vermelhas, e parecem mais fu… · KJV: …nd, behold, if the plague be in ' +
      'the walls of the house with hollow streaks, greenish or reddish, which in sight ' +
      'are lower than the wall;',
  },
  {
    ref: 'NUM 22:17',
    de: 'almaldiçoa para mim a este povo',
    para: 'amaldiçoa para mim a este povo',
    motivo:
      'A11: …udo o que me disseres: vem pois, rogo-te, amaldiçoa-me este povo. · KJV: ' +
      '…hatsoever thou sayest unto me: come therefore, I pray thee, curse me this people.',
  },
  {
    ref: 'JOS 19:9',
    de: 'era escessiva para eles',
    para: 'era excessiva para eles',
    motivo:
      'A11: …; porquanto a herança dos filhos de Judah era demasiadamente grande para ' +
      'elles: pelo que os filhos de Simeão … · KJV: …e children of Simeon: for the part ' +
      'of the children of Judah was too much for them: therefore the children of Simeon ' +
      'had their inheritance wit…',
  },
  {
    ref: 'JDG 13:24',
    de: 'E o menino creceu',
    para: 'E o menino cresceu',
    motivo:
      'A11: …her um filho, e chamou o seu nome Sansão: e o menino cresceu, e o Senhor o ' +
      'abençoou. · KJV: And the woman bore a son, and called his name Samson: and the ' +
      'child grew, and the LORD blessed him.',
  },
  {
    ref: '1KI 8:37',
    de: 'Quando nesta herra houver fome',
    para: 'Quando nesta terra houver fome',
    motivo:
      'A11: Quando houver fome na terra, quando houver peste, quando houver queim… · KJV: ' +
      'If there be in the land famine, if there be pestilence, blasting, mildew, locust, ' +
      'or if th…',
  },
  {
    ref: '1KI 8:50',
    de: 'dos que os teem cativos',
    para: 'dos que os têm cativos',
    motivo:
      'A11: …contra ti; e dá-lhes misericordia perante aquelles que os teem captivos, ' +
      'para que d\'elles tenham compaixão. · KJV: And forgive thy people that have sinned ' +
      'against thee, and all their transgressions wherein they have transgres…',
  },
  {
    ref: '1KI 13:34',
    de: 'cortada e desraigada',
    para: 'cortada e desarraigada',
    motivo:
      'A11: … foi causa de peccado á casa de Jeroboão, para destruil-a e extinguil-a da ' +
      'terra. · KJV: And this thing became sin unto the house of Jeroboam, even to cut it ' +
      'off, and to destroy it from off the face of the earth.',
  },
  {
    ref: '1CH 2:19',
    de: 'Calebe tmou por mulher',
    para: 'Calebe tomou por mulher',
    motivo:
      'A11: E morreu Azuba; e Caleb tomou para si a Ephrath, a qual lhe pariu a Hur. · ' +
      'KJV: And when Azubah was dead, Caleb took unto him Ephrath, which bore him Hur.',
  },
  {
    ref: '1CH 2:7',
    de: 'estava separado por maldiçãos',
    para: 'estava separado por maldição',
    motivo:
      'A11: …armi foram Acar, o perturbador de Israel, que peccou no anathema. · KJV: And ' +
      'the sons of Carmi; Achar, the troubler of Israel, who transgressed in the thing ' +
      'accursed.',
  },
  {
    ref: '1CH 5:20',
    de: 'foram enregues em suas mãos',
    para: 'foram entregues em suas mãos',
    motivo:
      'A11: …garenos e todos quantos estavam com elles foram entregues em sua mão; porque ' +
      'clamaram a Deus na peleja, e lhes… · KJV: And they were helped against them, and ' +
      'the Hagarites were delivered into their hand, and all that were with them: for ' +
      'they cried to God in the …',
  },
  {
    ref: '1CH 19:11',
    de: 'que os pôes em formação',
    para: 'que os pôs em formação',
    motivo:
      'A11: …o entregou na mão de Abisai, seu irmão; e pozeram-se em ordem de batalha ' +
      'contra os filhos d\'Ammon. · KJV: …ople he delivered unto the hand of Abishai his ' +
      'brother, and they set themselves in array against the children of Ammon.',
  },
  {
    ref: '1CH 24:10',
    de: 'A sétiam por Coz',
    para: 'A sétima por Coz',
    motivo:
      'A11: A setima a Hakkos, a oitava a Abias, · KJV: The seventh to Hakkoz, the eighth ' +
      'to Abijah,',
  },
  {
    ref: '1CH 24:15',
    de: 'a décima outiva por Hapises',
    para: 'a décima oitava por Hapises',
    motivo:
      'A11: A decima setima a Hezir, a decima oitava a Happises, · KJV: The seventeenth ' +
      'to Hezir, the eighteenth to Aphses,',
  },
  {
    ref: '2CH 36:10',
    de: 'com os utensílos preciosos',
    para: 'com os utensílios preciosos',
    motivo:
      'A11: …codonosor, e mandou trazel-o a Babylonia, com os mais preciosos vasos da ' +
      'casa do Senhor; e poz a Zedekias, seu … · KJV: …ired, king Nebuchadnezzar sent, ' +
      'and brought him to Babylon, with the goodly vessels of the house of the LORD, and ' +
      'made Zedekiah his brother kin…',
  },
  {
    ref: 'NEH 13:15',
    de: 'pisavam nas presnas de uvas',
    para: 'pisavam nas prensas de uvas',
    motivo:
      'A11: N\'aquelles dias vi em Judah os que pisavam lagares ao sabbado e traziam ' +
      'feixes que carregava… · KJV: In those days saw I in Judah some treading wine ' +
      'presses on the sabbath, and bringing in sheaves, and lading asses; …',
  },
  {
    ref: 'JOB 15:30',
    de: 'de sua boca desparecerá',
    para: 'de sua boca desaparecerá',
    motivo:
      'A11: …ogo seccará os seus renovos, e ao assopro da sua bocca desapparecerá. · KJV: ' +
      '…e shall dry up his branches, and by the breath of his mouth shall he go away.',
  },
  {
    ref: 'JOB 17:1',
    de: 'a sepultura já etá pronta',
    para: 'a sepultura já está pronta',
    motivo:
      'A11: …rompendo, os meus dias se vão apagando, e tenho perante mim as sepulturas. · ' +
      'KJV: My breath is corrupt, my days are extinct, the graves are ready for me.',
  },
  {
    ref: 'JOB 20:16',
    de: 'Veneno de cobras subará',
    para: 'Veneno de cobras sugará',
    motivo:
      'A11: Veneno d\'aspides sorverá; lingua de vibora o matará. · KJV: He shall suck the ' +
      'poison of asps: the viper\'s tongue shall slay him.',
  },
  {
    ref: 'JOB 20:18',
    de: 'da riqueza de seu comério',
    para: 'da riqueza de seu comércio',
    motivo:
      'A11: …ituirá do seu trabalho, e não o engulirá: conforme ao poder de sua mudança, ' +
      'e não saltará de gozo. · KJV: …abored for shall he restore, and shall not swallow ' +
      'it down: according to his substance shall the restitution be , and he shall not ' +
      'rejoice therein…',
  },
  {
    ref: 'JOB 20:23',
    de: 'enchendo seu vendre',
    para: 'enchendo seu ventre',
    motivo:
      'A11: Haja porém ainda de que possa encher o seu ventre; comtudo Deus mandará sobre ' +
      'elle o ardor … · KJV: When he is about to fill his belly, God shall cast the fury ' +
      'of his wrath upon him, and shall r…',
  },
  {
    ref: 'JOB 34:25',
    de: 'de noite os trastorna',
    para: 'de noite os transtorna',
    motivo:
      'A11: Elle conhece pois as suas obras, de noite os transtorna, e ficam moidos. · ' +
      'KJV: Therefore he knoweth their works, and he overturneth them in the night, so ' +
      'that they are destroyed.',
  },
  {
    ref: 'PRO 16:22',
    de: 'para queles que o possuem',
    para: 'para aqueles que o possuem',
    motivo:
      'A11: O entendimento, para aquelles que o possuem, é uma fonte de vida, mas a ' +
      'instrucção do… · KJV: Understanding is a wellspring of life unto him that hath it: ' +
      'but the instruction of fools is folly.',
  },
  {
    ref: 'ECC 5:11',
    de: 'os que os cosomem',
    para: 'os que os consomem',
    motivo:
      'A11: … se multiplica, ali se multiplicam tambem os que a comem: que mais proveito ' +
      'pois teem os seus dono… · KJV: When goods increase, they are increased that eat ' +
      'them: and what good is there to the owners thereof, saving the b…',
  },
  {
    ref: 'ECC 8:13',
    de: 'não tem temor diane de Deus',
    para: 'não tem temor diante de Deus',
    motivo:
      'A11: …rá os dias; será como a sombra; visto que elle não teme diante de Deus. · ' +
      'KJV: …, neither shall he prolong his days, which are as a shadow; because he ' +
      'feareth not before God.',
  },
  {
    ref: 'ISA 59:17',
    de: 'Pois ele se vestu de justiça',
    para: 'Pois ele se vestiu de justiça',
    motivo:
      'A11: Porque se vestiu de justiça, como de uma couraça, e poz o elmo da sal… · KJV: ' +
      'For he put on righteousness as a breastplate, and a helmet of salvation upon his ' +
      'head; …',
  },
  {
    ref: 'ISA 66:3',
    de: 'sangue de proco',
    para: 'sangue de porco',
    motivo:
      'A11: …o; quem offerece uma oblação é como o que offerece sangue de porco; quem ' +
      'offerece incenso memorativo é como … · KJV: …s if he cut off a dog\'s neck; he that ' +
      'offereth an oblation, as if he offered swine\'s blood; he that burneth incense, as ' +
      'if he blessed an idol. Yea, th…',
  },
  {
    ref: 'JER 13:26',
    de: 'Asim também eu descobrirei',
    para: 'Assim também eu descobrirei',
    motivo:
      'A11: Assim tambem eu descobrirei as tuas fraldas até sobre o teu rosto: e … · KJV: ' +
      'Therefore will I discover thy skirts upon thy face, that thy shame may appear.',
  },
  {
    ref: 'JER 23:33',
    de: 'te peguntar, dizendo',
    para: 'te perguntar, dizendo',
    motivo:
      'A11: Quando pois te perguntar este povo, ou qualquer propheta, ou sacerdote, dize… ' +
      '· KJV: And when this people, or the prophet, or a priest, shall ask thee, saying, ' +
      'What is the burden of the LORD? thou shalt then say unto t…',
  },
  {
    ref: 'JER 29:14',
    de: 'e vos restauarei de vosso infortúnio',
    para: 'e vos restaurarei de vosso infortúnio',
    motivo:
      'A11: E serei achado de vós, diz o Senhor, e farei tornar os vossos captivos, e ' +
      'congregar-vos-hei de todas as nações, … · KJV: And I will be found of you, saith ' +
      'the LORD: and I will turn away your captivity, and I will gather you from all the ' +
      'nations, and from all t…',
  },
  {
    ref: 'JER 29:19',
    de: 'enviar; próem não escutastes',
    para: 'enviar; porém não escutastes',
    motivo:
      'A11: …vos, os prophetas, madrugando e enviando; porém vós não escutastes, diz o ' +
      'Senhor. · KJV: …y servants the prophets, rising up early and sending them ; but ye ' +
      'would not hear, saith the LORD.',
  },
  {
    ref: 'JER 36:10',
    de: 'no pático de cima',
    para: 'no pátio de cima',
    motivo:
      'A11: … de Gemarias, filho de Saphan, o escriba, no atrio superior, á entrada da ' +
      'porta nova da casa do Senho… · KJV: …, in the chamber of Gemariah the son of ' +
      'Shaphan the scribe, in the higher court, at the entry of the new gate of the ' +
      'LORD\'s house, in the e…',
  },
  {
    ref: 'JER 39:5',
    de: 'nas plancíes de Jericó',
    para: 'nas planícies de Jericó',
    motivo:
      'A11: …eos os perseguiu; e alcançaram a Zedekias nas campinas de Jericó, e o ' +
      'prenderam, e o fizeram subir a Nabuc… · KJV: …e Chaldeans\' army pursued after ' +
      'them, and overtook Zedekiah in the plains of Jericho: and when they had taken him, ' +
      'they brought him up to Nebuch…',
  },
  {
    ref: 'JER 47:3',
    de: 'o tremor de suas caruagens',
    para: 'o tremor de suas carruagens',
    motivo:
      'A11: …unhas dos seus fortes cavallos, por causa do arroido de seus carros e do ' +
      'estrondo das suas rodas: os paes não… · KJV: … noise of the stamping of the hooves ' +
      'of his strong horses , at the rushing of his chariots, and at the rumbling of his ' +
      'wheels, the fathers shall not l…',
  },
  {
    ref: 'EZE 17:23',
    de: 'e se tronará um cedro',
    para: 'e se tornará um cedro',
    motivo:
      'A11: …ntarei, e produzirá ramos, e dará fructo, e se fará um cedro excellente; e ' +
      'habitarão debaixo d\'elle todas as aves… · KJV: … plant it: and it shall bring ' +
      'forth boughs, and bear fruit, and be a goodly cedar: and under it shall dwell all ' +
      'fowl of every wing; in the sh…',
  },
  {
    ref: 'EZE 35:13',
    de: 'Assim vos engradecestes',
    para: 'Assim vos engrandecestes',
    motivo:
      'A11: Assim vos engrandecestes contra mim com a vossa bocca, e multiplicastes as ' +
      'vo… · KJV: Thus with your mouth ye have boasted against me, and have multiplied ' +
      'your words against me: I have heard th…',
  },
  {
    ref: 'EZE 39:27',
    de: 'Quando eu trouxé-los de volta',
    para: 'Quando eu os trouxer de volta',
    motivo:
      'A11: Quando eu os tornar a trazer de entre os povos, e os houver ajuntado d… · ' +
      'KJV: When I have brought them again from the people, and gathered them out of ' +
      'their enemies\' la…',
  },
  {
    ref: 'AMO 9:3',
    de: 'até ali mandia uma serpente',
    para: 'até ali mandarei uma serpente',
    motivo:
      'A11: …ccultarem aos meus olhos no fundo do mar, ali darei ordem á serpente, e ella ' +
      'os morderá. · KJV: … though they be hid from my sight in the bottom of the sea, ' +
      'thence will I command the serpent, and he shall bite them:',
  },
  {
    ref: 'ZEP 3:20',
    de: 'quando eu vos resutaurar',
    para: 'quando eu vos restaurar',
    motivo:
      'A11: … um louvor entre todos os povos da terra, quando reconduzir os vossos ' +
      'captivos diante dos vossos olhos. · KJV: …make you a name and a praise among all ' +
      'people of the earth, when I turn back your captivity before your eyes, saith the ' +
      'LORD.',
  },
  {
    ref: 'ZEC 1:6',
    de: 'e nossos antos, assim ele fez',
    para: 'e nossos atos, assim ele fez',
    motivo:
      'A11: …nos tratar, segundo os nossos caminhos, e segundo as nossas obras, assim ' +
      'elle nos tratou. · KJV: … of hosts thought to do unto us, according to our ways, ' +
      'and according to our doings, so hath he dealt with us.',
  },
  {
    ref: 'MAT 18:33',
    de: 'do sevo colega teu',
    para: 'do servo colega teu',
    motivo:
      'A11: Não devias tu egualmente ter compaixão do teu companheiro, como eu tambem ' +
      'tive misericordia de ti? · KJV: Shouldest not thou also have had compassion on thy ' +
      'fellow servant, even as I had pity on thee?',
  },
  {
    ref: 'MAT 27:27',
    de: 'toda a unidade miltar',
    para: 'toda a unidade militar',
    motivo:
      'A11: … Jesus á audiencia, reuniram junto d\'elle toda a cohorte. · KJV: …rnor took ' +
      'Jesus into the common hall, and gathered unto him the whole band of soldiers.',
  },
  {
    ref: 'MAR 3:21',
    de: '“Ele stá fora de si”',
    para: '“Ele está fora de si”',
    motivo:
      'A11: …to, sairam para o prender; porque diziam: Está fóra de si. · KJV: …ard of ' +
      'it, they went out to lay hold on him: for they said, He is beside himself.',
  },
  {
    ref: 'MAR 7:13',
    de: 'Assim invalidaias a palavra',
    para: 'Assim invalidais a palavra',
    motivo:
      'A11: Invalidando assim a palavra de Deus pela vossa tradição, que vós ordenastes. ' +
      '… · KJV: Making the word of God of none effect through your tradition, which ye ' +
      'have delivered: and many s…',
  },
  {
    ref: 'MAR 9:3',
    de: 'ficaram resplandescentes',
    para: 'ficaram resplandecentes',
    motivo:
      'A11: E os seus vestidos tornaram-se resplandecentes, mui brancos como a neve, taes ' +
      'como nenhu… · KJV: And his raiment became shining, exceeding white as snow; so as ' +
      'no fuller on earth can whit…',
  },
  {
    ref: 'MAR 10:52',
    de: 'E logo consegiu ver',
    para: 'E logo conseguiu ver',
    motivo:
      'A11: …Jesus lhe disse: Vae, a tua fé te salvou. E logo viu, e seguiu a Jesus pelo ' +
      'caminho. · KJV: … said unto him, Go thy way; thy faith hath made thee whole. And ' +
      'immediately he received his sight, and followed Jesus in the way.',
  },
  // ── palavra truncada (1)
  {
    ref: 'JOS 6:13',
    de: 'andando e tocando l',
    para: 'andando e tocando as trombetas',
    motivo:
      'A11: …ca do Senhor; os sacerdotes iam andando e tocando as buzinas. · KJV: …d came ' +
      'after the ark of the LORD, the priests going on, and blowing with the trumpets.',
  },
  // ── grafia espanhola (12)
  {
    ref: 'GEN 17:17',
    de: 'Abraão postrou-se',
    para: 'Abraão prostrou-se',
    motivo:
      'A11: Então caiu Abrahão sobre o seu rosto, e riu-se, e disse no seu coração: A um ' +
      'h… · KJV: Then Abraham fell upon his face, and laughed, and said in his heart, ' +
      'Shall a child be born …',
  },
  {
    ref: 'GEN 26:29',
    de: 'tocamos, y como',
    para: 'tocamos, e como',
    motivo:
      'A11: … faças mal, como nós te não temos tocado, e como te fizemos sómente bem, e ' +
      'te deixámos ir em paz. Ago… · KJV: That thou wilt do us no hurt, as we have not ' +
      'touched thee, and as we have done unto thee nothing but good, and h…',
  },
  {
    ref: 'GEN 46:17',
    de: 'Isvi y Berias',
    para: 'Isvi, e Berias',
    motivo:
      'A11: E os filhos de Asher: Imnah, e Ischva, e Ischvi, e Beria, e Serah, a irmã ' +
      'd\'elles: e os filhos de … · KJV: And the sons of Asher; Jimnah, and Ishuah, and ' +
      'Isui, and Beriah, and Serah their sister: and the sons of Beriah; Heber, and…',
  },
  {
    ref: 'GEN 47:27',
    de: 'nela, y se aumentaram',
    para: 'nela, e se aumentaram',
    motivo:
      'A11: …ra do Egypto, na terra de Gosen, e n\'ella tomaram possessão, e ' +
      'fructificaram, e multiplicaram-se muito. · KJV: …lt in the land of Egypt, in the ' +
      'country of Goshen; and they had possessions therein, and grew, and multiplied ' +
      'exceedingly.',
  },
  {
    ref: 'JDG 14:12',
    de: 'trinta sábanas',
    para: 'trinta lençóis',
    motivo:
      'A11: …m\'o declarardes e descobrirdes, vos darei trinta lençoes e trinta mudas de ' +
      'vestidos. · KJV: …en days of the feast, and find it out, then I will give you ' +
      'thirty sheets and thirty change of garments:',
  },
  {
    ref: '2SA 7:12',
    de: 'eu establecerei tua semente',
    para: 'eu estabelecerei tua semente',
    motivo:
      'A11: …a semente, que sair das tuas entranhas, e estabelecerei o seu reino. · KJV: ' +
      '…y days be fulfilled, and thou shalt sleep with thy fathers, I will set up thy ' +
      'seed after thee, which shall proceed out of thy bowels, and I wi…',
  },
  {
    ref: '2SA 13:15',
    de: 'de tão grande aborrecimiento',
    para: 'de tão grande aborrecimento',
    motivo:
      'A11: Depois Amnon a aborreceu com grandissimo aborrecimento, porque maior era o ' +
      'aborrecimento com que… · KJV: Then Amnon hated her exceedingly; so that the hatred ' +
      'wherewith he hated her was greater than…',
  },
  {
    ref: '1KI 19:6',
    de: 'sobre as ascuas',
    para: 'sobre as brasas',
    motivo:
      'A11: …, e eis que á sua cabeceira estava um pão cozido sobre as brazas, e uma ' +
      'botija de agua: e comeu, e bebeu, … · KJV: And he looked, and, behold, there was a ' +
      'cake baked on the coals, and a cruse of water at his head. And he did eat and ' +
      'drink…',
  },
  {
    ref: '2KI 9:27',
    de: 'E siguiu-o Jeú',
    para: 'E seguiu-o Jeú',
    motivo:
      'A11: …giu pelo caminho da casa do jardim, porém Jehu seguiu após elle, e disse: ' +
      'Tambem feri a este no carro á s… · KJV: …of Judah saw this , he fled by the way of ' +
      'the garden house. And Jehu followed after him, and said, Smite him also in the ' +
      'chariot. And they did so a…',
  },
  {
    ref: '2KI 23:26',
    de: 'se havia encendido sua ira',
    para: 'se havia acendido sua ira',
    motivo:
      'A11: …se não tornou do ardor da sua grande ira, com que ardia a sua ira contra ' +
      'Judah, por todas as provocações co… · KJV: …urned not from the fierceness of his ' +
      'great wrath, wherewith his anger was kindled against Judah, because of all the ' +
      'provocations that Manasse…',
  },
  {
    ref: '2CH 6:20',
    de: 'que oigas a oração',
    para: 'que ouças a oração',
    motivo:
      'A11: …e que disseste que ali porias o teu nome; para ouvires a oração que o teu ' +
      'servo orar n\'este logar. · KJV: …ereof thou hast said that thou wouldest put thy ' +
      'name there; to hearken unto the prayer which thy servant prayeth toward this ' +
      'place.',
  },
  {
    ref: 'EZE 38:20',
    de: 'andam se arrastrando',
    para: 'andam se arrastando',
    motivo:
      'A11: …do céu, e os animaes do campo, e todos os reptis que se arrastam sobre a ' +
      'terra, e todos os homens que estã… · KJV: …e fowls of the heaven, and the beasts ' +
      'of the field, and all creeping things that creep upon the earth, and all the men ' +
      'that are upon the face of t…',
  },
  // ── acento (4)
  {
    ref: 'EXO 23:2',
    de: 'nem responderás em litigio',
    para: 'nem responderás em litígio',
    motivo:
      'A11: …o seguirás a multidão para fazeres o mal: nem n\'uma demanda fallarás, ' +
      'tomando parte com o maior numero para to… · KJV: Thou shalt not follow a multitude ' +
      'to do evil; neither shalt thou speak in a cause to decline after many to wrest ' +
      'judgment :',
  },
  {
    ref: 'DEU 17:8',
    de: 'em negócios de litigio',
    para: 'em negócios de litígio',
    motivo:
      'A11: …demanda e demanda, entre ferida e ferida, em negocios de pendencias nas tuas ' +
      'portas, então te levantarás, e s… · KJV: …lood, between plea and plea, and between ' +
      'stroke and stroke, being matters of controversy within thy gates: then shalt thou ' +
      'arise, and get thee up in…',
  },
  {
    ref: '1KI 11:23',
    de: 'o qual havia fugído',
    para: 'o qual havia fugido',
    motivo:
      'A11: …tro adversario, a Rezon, filho de Eliada, que tinha fugido de seu senhor ' +
      'Hadad-ezer, rei de Zoba, · KJV: …stirred him up another adversary, Rezon the son ' +
      'of Eliadah, which fled from his lord Hadadezer king of Zobah:',
  },
  {
    ref: 'EZR 6:2',
    de: 'estava escrito assim: Memórial',
    para: 'estava escrito assim: Memorial',
    motivo:
      'A11: …ncia de Media, se achou um rôlo, e n\'elle estava escripto um memorial que ' +
      'dizia assim: · KJV: …he palace that is in the province of the Medes, a roll, and ' +
      'therein was a record thus written:',
  },
  // ── espaço perdido ou sobrando (8)
  {
    ref: 'GEN 17:17',
    de: 'de cem anos nasceráfilho?',
    para: 'de cem anos nascerá filho?',
    motivo:
      'A11: …e no seu coração: A um homem de cem annos ha de nascer um filho? e parirá ' +
      'Sarah da edade de noventa annos… · KJV: …ham fell upon his face, and laughed, and ' +
      'said in his heart, Shall a child be born unto him that is a hundred years old? and ' +
      'shall Sarah, that…',
  },
  {
    ref: 'LEV 20:19',
    de: 'levarão sobresi a sua perversidade',
    para: 'levarão sobre si a sua perversidade',
    motivo:
      'A11: …rirás: porquanto descobriu a sua parenta, sobre si levarão a sua iniquidade. ' +
      '· KJV: …nor of thy father\'s sister: for he uncovereth his near kin: they shall ' +
      'bear their iniquity.',
  },
  {
    ref: 'NUM 11:11',
    de: 'que puseste sobremim a carga',
    para: 'que puseste sobre mim a carga',
    motivo:
      'A11: … e porque não achei graça aos teus olhos; que pozesses sobre mim o cargo de ' +
      'todo este povo? · KJV: …servant? and wherefore have I not found favor in thy ' +
      'sight, that thou layest the burden of all this people upon me?',
  },
  {
    ref: 'JDG 2:18',
    de: 'arrependia pelo gemideles',
    para: 'arrependia pelo gemido deles',
    motivo:
      'A11: …s dias d\'aquelle juiz; porquanto o Senhor se arrependia pelo seu gemido, por ' +
      'causa dos que os apertavam e opprimi… · KJV: …enemies all the days of the judge: ' +
      'for it repented the LORD because of their groanings by reason of them that ' +
      'oppressed them and vexed them.',
  },
  {
    ref: 'ECC 5:8',
    de: 'outros que têmautoridade',
    para: 'outros que têm autoridade',
    motivo:
      'A11: … alto é do que os altos n\'isso attenta; e ha mais altos do que elles. · KJV: ' +
      '…tter: for he that is higher than the highest regardeth; and there be higher than ' +
      'they.',
  },
  {
    ref: 'MAT 3:10',
    de: 'E agora mesmoo machado',
    para: 'E agora mesmo o machado',
    motivo:
      'A11: E tambem agora está posto o machado á raiz das arvores; toda a arvore, pois, ' +
      '… · KJV: And now also the axe is laid unto the root of the trees: therefore every ' +
      'tree which brin…',
  },
  {
    ref: 'MAT 10:3',
    de: 'por sobrenomeTadeu',
    para: 'por sobrenome Tadeu',
    motivo:
      'A11: …icano; Thiago, filho de Alpheo, e Lebbeo, appellidado Thaddeo; · KJV: …tthew ' +
      'the publican; James the son of Alphaeus, and Lebbaeus whose surname was Thaddaeus;',
  },
  {
    ref: 'MAR 1:22',
    de: 'como quem temautoridade',
    para: 'como quem tem autoridade',
    motivo:
      'A11: …am-se da sua doutrina, porque os ensinava como tendo auctoridade, e não como ' +
      'os escribas. · KJV: …nd they were astonished at his doctrine: for he taught them ' +
      'as one that had authority, and not as the scribes.',
  },
  // ── palavra repetida (1)
  {
    ref: 'JOB 15:13',
    de: '[tais] tais palavras',
    para: '[tais] palavras',
    motivo:
      'A11: …ara virares contra Deus o teu espirito, e deixares sair taes palavras da tua ' +
      'bocca? · KJV: That thou turnest thy spirit against God, and lettest such words go ' +
      'out of thy mouth?',
  },
  // ── resto de edição (1)
  {
    ref: 'NEH 5:17',
    de: 'dentre as ns nações',
    para: 'dentre as nações',
    motivo:
      'A11: … cincoenta homens, e os que vinham a nós, d\'entre as gentes, que estão á ' +
      'roda de nós, se punham á min… · KJV: …ifty of the Jews and rulers, beside those ' +
      'that came unto us from among the heathen that are about us.',
  },
  // ── resíduo ortográfico (1)
  {
    ref: '1CH 6:57',
    de: 'Jathir e Estemoa',
    para: 'Jatir e Estemoa',
    motivo:
      'A11: …io: Hebron, e Libna e os seus arrabaldes, e Jattir, e Esthemo e os seus ' +
      'arrabaldes, · KJV: … , Hebron, the city of refuge, and Libnah with her suburbs, ' +
      'and Jattir, and Eshtemoa, with their suburbs,',
  },
  // ── concordância de número (1)
  {
    ref: '1CH 22:19',
    de: 'e o santos vasos de Deus',
    para: 'e os santos vasos de Deus',
    motivo:
      'A11: …s, para que a arca do concerto do Senhor, e os vasos sagrados de Deus se ' +
      'tragam a esta casa, que se ha de edifi… · KJV: …the LORD God, to bring the ark of ' +
      'the covenant of the LORD, and the holy vessels of God, into the house that is to ' +
      'be built to the name of the LORD…',
  },
  // ── pontuação (6)
  {
    ref: 'GEN 22:7',
    de: 'Meu pai. e ele respondeu',
    para: 'Meu pai! E ele respondeu',
    motivo:
      'A11: … fallou Isaac a Abrahão seu pae, e disse: Meu pae! E elle disse: Eis-me ' +
      'aqui, meu filho! E elle disse: Ei… · KJV: And Isaac spoke unto Abraham his father, ' +
      'and said, My father: and he said, Here am I, my son. And he said, Behold the fire ' +
      'and the wo…',
  },
  {
    ref: 'NUM 19:18',
    de: 'tomará hissopo. e o molhará',
    para: 'tomará hissopo, e o molhará',
    motivo:
      'A11: E um homem limpo tomará hyssopo, e o molhará n\'aquella agua, e a espargirá ' +
      'sobre aquel… · KJV: And a clean person shall take hyssop, and dip it in the water, ' +
      'and sprinkle it upon the tent, and upon all t…',
  },
  {
    ref: '2CH 20:15',
    de: 'rei Josafá. o SENHOR vos diz',
    para: 'rei Josafá, o SENHOR vos diz',
    motivo:
      'A11: …dah, e vós, moradores de Jerusalem, e tu, ó rei Josaphat: assim o Senhor vos ' +
      'diz: Não temaes, nem vos assusteis por causa … · KJV: …id, Hearken ye, all Judah, ' +
      'and ye inhabitants of Jerusalem, and thou king Jehoshaphat, Thus saith the LORD ' +
      'unto you, Be not afraid nor dismayed by reason of this grea…',
  },
  {
    ref: 'EZE 46:3',
    de: 'nas luas novas,.',
    para: 'nas luas novas.',
    motivo:
      'A11: … á entrada da mesma porta, nos sabbados e nas luas novas, diante do Senhor. ' +
      '· KJV: …land shall worship at the door of this gate before the LORD in the ' +
      'sabbaths and in the new moons.',
  },
  {
    ref: 'MAT 25:20',
    de: 'e disse: ”Senhor',
    para: 'e disse: “Senhor',
    motivo:
      'A11: …ntos, e trouxe-lhe outros cinco talentos, dizendo: Senhor, entregaste-me ' +
      'cinco talentos; eis aqui o… · KJV: … received five talents came and brought other ' +
      'five talents, saying, Lord, thou deliveredst unto me five talents: behold, I have ' +
      'gain…',
  },
  {
    ref: 'MAR 6:11',
    de: 'contra eles Em verdade vos digo',
    para: 'contra eles. Em verdade vos digo',
    motivo:
      'A11: …ver debaixo dos vossos pés, em testemunho para com elles. Em verdade vos ' +
      'digo que haverá mais tolerancia no dia de juiz… · KJV: …, when ye depart thence, ' +
      'shake off the dust under your feet for a testimony against them. Verily I say unto ' +
      'you, It shall be more tolerable for Sodom and Gomorrah…',
  },
  // ── maiúscula indevida no meio da frase (4)
  {
    ref: 'EXO 29:1',
    de: 'E Isto é o que lhes farás',
    para: 'E isto é o que lhes farás',
    motivo:
      'A11: Isto é o que lhes has de fazer, para os sanctificar, para que me adminis… · ' +
      'KJV: And this is the thing that thou shalt do unto them to hallow them, to ' +
      'minister unto me in the priest…',
  },
  {
    ref: 'JDG 10:1',
    de: 'E Depois de Abimeleque',
    para: 'E depois de Abimeleque',
    motivo:
      'A11: E depois de Abimelech, se levantou, para livrar a Israel, Tola,… · KJV: And ' +
      'after Abimelech there arose to defend Israel Tola the son of Puah, the son …',
  },
  {
    ref: '1SA 30:1',
    de: 'E Quando Davi',
    para: 'E quando Davi',
    motivo:
      'A11: Succedeu pois que, chegando David e os seus homens ao terceiro dia a Siclag, ' +
      'já os amalekita… · KJV: And it came to pass, when David and his men were come to ' +
      'Ziklag on the third day, that the Amalekites had invaded…',
  },
  {
    ref: 'EZE 2:1',
    de: 'E Disse-me: Filho do homem',
    para: 'E disse-me: Filho do homem',
    motivo:
      'A11: E disse-me: Filho do homem, põe-te sobre os teus pés, e fallarei com… · KJV: ' +
      'And he said unto me, Son of man, stand upon thy feet, and I will speak unto thee.',
  },
  // ── artigo indevido no vocativo (4)
  {
    ref: '1CH 17:17',
    de: 'excelente, ó o SENHOR Deus',
    para: 'excelente, ó SENHOR Deus',
    motivo:
      'A11: …o costume dos homens, com esta exaltação, ó Senhor Deus. · KJV: …egarded me ' +
      'according to the estate of a man of high degree, O LORD God.',
  },
  {
    ref: '1CH 29:10',
    de: 'tu, ó o SENHOR, Deus de Israel',
    para: 'tu, ó SENHOR, Deus de Israel',
    motivo:
      'A11: Pelo que David louvou ao Senhor perante os olhos de toda a congregação; e ' +
      'disse David: Bemdito és tu, Senhor, … · KJV: Wherefore David blessed the LORD ' +
      'before all the congregation: and David said, Blessed be thou, LORD God of Isr…',
  },
  {
    ref: '1CH 29:11',
    de: 'Tua é, ó o SENHOR, a magnificência',
    para: 'Tua é, ó SENHOR, a magnificência',
    motivo:
      'A11: Tua é, Senhor, a magnificencia, e o poder, e a honra, e a victoria, e a ' +
      'magestade; porque teu é tudo quanto ha… · KJV: Thine, O LORD, is the greatness, ' +
      'and the power, and the glory, and the vi…',
  },
  {
    ref: '1CH 29:11',
    de: 'Teu, ó o SENHOR, é o reino',
    para: 'Teu, ó SENHOR, é o reino',
    motivo:
      'A11: Tua é, Senhor, a magnificencia, e o poder, e a honra, e a victoria, e a ' +
      'magestade; porque teu é tudo quanto ha… · KJV: Thine, O LORD, is the greatness, ' +
      'and the power, and the glory, and the vi…',
  },
  // ── artigo indevido na aposição (3)
  {
    ref: '1CH 22:19',
    de: 'do Deus o SENHOR',
    para: 'do SENHOR Deus',
    motivo:
      'A11: … e levantae-vos, e edificae o sanctuario do Senhor Deus, para que a arca do ' +
      'concerto do Senhor, e… · KJV: …RD your God; arise therefore, and build ye the ' +
      'sanctuary of the LORD God, to bring the ark of the covenant of the LORD, and the ' +
      'holy…',
  },
  {
    ref: '1CH 28:20',
    de: 'o Deus o SENHOR, meu Deus',
    para: 'o SENHOR Deus, meu Deus',
    motivo:
      'A11: …ra; não temas, nem te espavoreças; porque o Senhor Deus, meu Deus, ha de ser ' +
      'comtigo; não te deix… · KJV: …of good courage, and do it : fear not, nor be ' +
      'dismayed: for the LORD God, even my God, will be with thee; he will not fail thee, ' +
      'nor…',
  },
  {
    ref: '2CH 32:16',
    de: 'contra o Deus o SENHOR',
    para: 'contra o SENHOR Deus',
    motivo:
      'A11: …em seus servos fallaram ainda mais contra o Senhor Deus, e contra Ezequias, ' +
      'o seu servo. · KJV: And his servants spoke yet more against the LORD God, and ' +
      'against his servant Hezekiah.',
  },

  // --- varredura por corretor ortográfico (08/09/2026) -------------------------
  //
  // As redes anteriores eram de PADRÕES conhecidos (`a o`, colchete solto, letra
  // órfã). Padrão só acha o que já se sabe procurar, e `alinda` (Is 23:12) PARECE
  // palavra — passou por baixo de todas e foi servida por semanas. Quem a pegou foi
  // o NARRADOR: ele não leu a palavra, porque não soube lê-la, e a nota de verbatim
  // daquela unidade caiu. A narração é um detector que nenhuma regex substitui.
  //
  // Daí esta varredura, de natureza diferente: corretor ortográfico sobre o corpus
  // inteiro, com duas peneiras de precisão — palavra válida em CASTELHANO e não em
  // português (a Bíblia Livre arrasta o espanhol da fonte de onde veio), e palavra
  // a uma letra de outra frequente no próprio corpus. Triagem contra a KJV,
  // versículo a versículo, uma perícope por vez.
  //
  // Dois avisos a quem repetir isto. (1) Varra o texto DEPOIS de `corrigirVersiculo`,
  // não o VPL cru: o VPL guarda os defeitos de propósito, e quem os conserta é esta
  // tabela — varrendo o cru, 63 das 68 candidatas eram conserto que já morava aqui.
  // (2) Nome próprio, arcaísmo e letra hebraica do Salmo 119 são a MAIORIA das
  // candidatas do corretor, e nenhum deles é defeito.
  {
    ref: '1CH 19:6',
    de: 'alugarem carruragens',
    para: 'alugarem carruagens',
    motivo:
      'letra a mais em carruagens. ' +
      'KJV: And when the children of Ammon saw that they had made themselves odious to David, Hanun and the chil…',
  },
  {
    ref: 'EZE 42:3',
    de: 'do solado',
    para: 'do pavimento',
    motivo:
      'solado é castelhano (suelo/pavimento); o próprio versículo já usa átrio e pátio para os outros dois espaços. ' +
      'KJV: Over against the twenty cubits which were for the inner court, and, over against the pavement which …',
  },
  {
    ref: 'ISA 23:12',
    de: 'e alinda ali',
    para: 'e ainda ali',
    motivo:
      'alinda por ainda, letras trocadas — a rede de padrões não a viu porque ela PARECE palavra; quem a achou foi o narrador, que não soube lê-la. ' +
      'KJV: And he said, Thou shalt no more rejoice, O thou oppressed virgin, daughter of Zidon: arise, pass ove…',
  },
  {
    ref: 'JAM 4:5',
    de: 'nós ansia',
    para: 'nós ânsia',
    motivo:
      'falta o acento de ânsia. ' +
      'KJV: Do ye think that the Scripture saith in vain, The spirit that dwelleth in us lusteth to envy?',
  },
  {
    ref: 'NEH 11:20',
    de: 'estevem em todas as cidades',
    para: 'estiveram em todas as cidades',
    motivo:
      'estevem não é forma do verbo estar. ' +
      'KJV: And the residue of Israel, of the priests, and the Levites, were in all the cities of Judah, every o…',
  },
]


/**
 * Subscrições de escriba: notas tardias de copista que a fonte colou DENTRO do
 * último versículo de treze epístolas — "[Escrita de Roma para os efésios, e
 * enviada por Tíquico]". **Não são Escritura.** A KJV as imprime em itálico
 * fora do texto e as edições modernas as omitem.
 *
 * Sai o trecho inteiro. Sem isto, a remoção de colchetes deste mesmo módulo
 * apagaria a marcação e o leitor veria a nota do copista como palavra de Deus.
 *
 * NÃO entram aqui dois parênteses de fim de versículo que a varredura acusa e
 * são texto bíblico de verdade — 2Sm 1:18 (o Cântico do Arco) e Gl 3:13 (a
 * citação de Deuteronômio). A KJV traz os dois entre parênteses também.
 */
export const SUBSCRICOES: string[] = [
  'ROM 16:27',
  '1CO 16:24',
  '2CO 13:14',
  'GAL 6:18',
  'EPH 6:24',
  'PHI 4:23',
  'COL 4:18',
  '1TH 5:28',
  '2TH 3:18',
  '1TI 6:21',
  '2TI 4:22',
  'TIT 3:15',
  'PHM 1:25',
  'HEB 13:25',
]

/** Trecho entre colchetes ou parênteses no fim do versículo, com o ponto solto. */
const FIM_SUBSCRICAO = /\s*(?:\[[^\]]*\]|\([^)]*\))\s*\.?\s*$/

/**
 * Frases que a Bíblia Livre omitiu e que as DUAS testemunhas trazem.
 *
 * A redação restaurada é a da Almeida de 1911 — ancestral da própria BLIVRE —
 * com ortografia, nomes e pontuação atualizados para a dicção da fonte. Não é
 * tradução minha: é a testemunha falando em português de hoje. Cada uma foi
 * conferida também contra a KJV.
 *
 * Achadas por comparação sistemática de comprimento contra as duas testemunhas,
 * não por leitura de sorte. O critério: BLIVRE < 70% da Almeida 1911 E < 80% da
 * KJV, com o versículo da Almeida acima de 60 caracteres. Foram 84 candidatos;
 * estes 28 são os que se confirmaram como omissão. Os outros 56 eram concisão
 * legítima, divisão de versículo diferente, ou crux de tradução — e ficaram
 * intactos de propósito.
 */
export const OMISSOES: Correcao[] = [
  { ref: 'GEN 14:20', de: 'que entregou teus inimigos em tua mão.',
    para: 'que entregou teus inimigos em tua mão. E deu-lhe o dízimo de tudo.',
    motivo: 'Sumiu o dízimo de Abraão a Melquisedeque. KJV: "And he gave him tithes of all."' },
  { ref: 'GEN 18:5', de: 'pois por isso passastes perto de vosso servo.',
    para: 'pois por isso passastes perto de vosso servo. E disseram: Assim faze como tens dito.',
    motivo: 'Sumiu a resposta dos visitantes. KJV: "And they said, So do, as thou hast said."' },
  { ref: 'GEN 18:10', de: 'Sara, tua mulher, terá um filho.',
    para: 'Sara, tua mulher, terá um filho. E Sara ouviu isso à porta da tenda, que estava atrás dele.',
    motivo: 'Sem isto, o riso de Sara dois versículos adiante vem do nada. KJV: "And Sarah heard it in the tent door."' },
  { ref: 'GEN 24:30', de: 'nas mãos de sua irmã, que dizia,',
    para: 'nas mãos de sua irmã, e quando ouviu as palavras de sua irmã Rebeca, que dizia,',
    motivo: 'KJV: "and when he heard the words of Rebekah his sister".' },
  { ref: 'EXO 6:28', de: 'Quando o SENHOR falou a Moisés',
    para: 'E aconteceu que, naquele dia, quando o SENHOR falou a Moisés',
    motivo: 'Sumiu a fórmula de abertura. KJV: "And it came to pass on the day when".' },
  { ref: 'JDG 6:30', de: 'Tira fora teu filho',
    para: 'Então os homens daquela cidade disseram a Joás: Tira fora teu filho',
    motivo: 'Sumiu quem fala. KJV: "Then the men of the city said unto Joash".' },
  { ref: 'JDG 11:39', de: 'E ela nunca conheceu homem.',
    para: 'E ela nunca conheceu homem. E daqui veio o costume em Israel,',
    motivo: 'KJV: "And it was a custom in Israel" — abre o versículo seguinte.' },
  { ref: 'JDG 19:3', de: 'e ela o meteu na casa de seu pai.',
    para: 'e ela o meteu na casa de seu pai; e o pai da moça, vendo-o, alegrou-se ao encontrá-lo.',
    motivo: 'KJV: "and when the father of the damsel saw him, he rejoiced to meet him."' },
  { ref: '1SA 10:25', de: 'o qual guardou diante do SENHOR.',
    para: 'o qual guardou diante do SENHOR. Então Samuel despediu todo o povo, cada um para sua casa.',
    motivo: 'KJV: "And Samuel sent all the people away, every man to his house."' },
  { ref: '1SA 15:25', de: 'E volta comigo',
    para: 'Agora, pois, peço-te, perdoa o meu pecado; e volta comigo',
    motivo: 'Sumiu a súplica de Saul. KJV: "Now therefore, I pray thee, pardon my sin".' },
  { ref: '1SA 28:12', de: 'a Saul, dizendo:',
    para: 'a Saul, dizendo: Por que me enganaste? Pois tu mesmo és Saul.',
    motivo: 'O versículo ficava terminando em dois-pontos, sem a fala. KJV: "Why hast thou deceived me? for thou art Saul."' },
  { ref: '2SA 2:32', de: 'E caminharam toda aquela noite Joabe e os seus',
    para: 'E levantaram Asael, e o sepultaram na sepultura de seu pai, que estava em Belém. E caminharam toda aquela noite Joabe e os seus',
    motivo: 'Sumiu o sepultamento de Asael inteiro. KJV: "And they took up Asahel, and buried him in the sepulcher of his father, which was in Bethlehem."' },
  { ref: '1KI 16:29', de: 'o ano trinta e oito de Asa rei de Judá.',
    para: 'o ano trinta e oito de Asa rei de Judá; e reinou Acabe, filho de Onri, sobre Israel em Samaria vinte e dois anos.',
    motivo: 'Sumiu a duração do reinado. KJV: "reigned over Israel in Samaria twenty and two years."' },
  { ref: '2KI 4:30', de: 'que não te deixarei.',
    para: 'que não te deixarei. Então ele se levantou, e a seguiu.',
    motivo: 'KJV: "And he arose, and followed her."' },
  { ref: '2KI 6:32', de: 'me envia a tirar a cabeça?',
    para: 'me envia a tirar a cabeça? Olhai, pois: quando vier o mensageiro, fechai-lhe a porta e empurrai-o para fora com ela. Por acaso não vem o ruído dos pés de seu senhor após ele?',
    motivo: 'Sumiu a ordem de Eliseu inteira. KJV: "look, when the messenger cometh, shut the door… is not the sound of his master\u2019s feet behind him?"' },
  { ref: '1CH 16:36', de: 'De eternidade a eternidade.',
    para: 'De eternidade a eternidade. E todo o povo disse: Amém! e louvou ao SENHOR.',
    motivo: 'Sumiu a resposta do povo. KJV: "And all the people said, Amen, and praised the LORD."' },
  { ref: '1CH 21:5', de: 'E achou-se em todo Israel',
    para: 'E Joabe deu a Davi a soma do número do povo. E achou-se em todo Israel',
    motivo: 'KJV: "And Joab gave the sum of the number of the people unto David."' },
  { ref: '1CH 21:15', de: 'e arrependeu-se daquele mal,',
    para: 'e arrependeu-se daquele mal, e disse ao anjo destruidor: Basta! Retira agora a tua mão. E o anjo do SENHOR estava junto à eira de Ornã, o jebuseu.',
    motivo: 'Sumiu a ordem que interrompe a praga e a eira que vira o templo. KJV: "It is enough, stay now thine hand."' },
  { ref: '2CH 12:1', de: 'havia confirmado o reino, deixou',
    para: 'havia confirmado o reino, e havendo-se fortalecido, deixou',
    motivo: 'KJV: "and had strengthened himself".' },
  { ref: '2CH 30:19', de: 'Ao SENHOR, o Deus de seus pais,',
    para: 'que preparou o seu coração para buscar a Deus, o SENHOR, o Deus de seus pais,',
    motivo: 'O versículo abria sem sujeito. KJV: "That prepareth his heart to seek God".' },
  { ref: '2CH 31:1', de: 'e também em Efraim e Manassés,',
    para: 'e também em Efraim e Manassés, até que tudo destruíram; então todos os filhos de Israel voltaram, cada um para a sua possessão, para as suas cidades.',
    motivo: 'KJV: "until they had utterly destroyed them all. Then all the children of Israel returned…"' },
  { ref: 'EZR 2:62', de: 'por isso foram rejeitados do sacerdócio.',
    para: 'por isso, como imundos, foram rejeitados do sacerdócio.',
    motivo: 'KJV: "therefore were they, as polluted, put from the priesthood."' },
  { ref: 'ISA 56:9', de: 'Todos vós, animais do campo, vinde comer!',
    para: 'Todos vós, animais do campo, todos os animais dos bosques, vinde comer!',
    motivo: 'KJV: "yea, all ye beasts in the forest."' },
  { ref: 'ISA 57:20', de: 'que não pode se aquietar.',
    para: 'que não pode se aquietar, e cujas águas lançam de si lama e lodo.',
    motivo: 'KJV: "whose waters cast up mire and dirt."' },
  { ref: 'MAT 26:67', de: 'e lhe deram socos.',
    para: 'e lhe deram socos; e outros o esbofeteavam,',
    motivo: 'KJV: "and others smote him with the palms of their hands".' },
  { ref: 'LUK 19:12', de: 'partiu para uma terra distante.',
    para: 'partiu para uma terra distante, a fim de tomar para si um reino e depois voltar.',
    motivo: 'Sem isto a parábola das minas perde o enredo. KJV: "to receive for himself a kingdom, and to return."' },
  { ref: 'LUK 22:58', de: 'Também tu és um deles.',
    para: 'Também tu és um deles. Porém Pedro disse: Homem, não sou.',
    motivo: 'Sumiu a segunda negação de Pedro. KJV: "And Peter said, Man, I am not."' },
  { ref: 'ACT 24:8', de: 'investigando-o tu mesmo,',
    para: 'mandando aos seus acusadores que viessem a ti. Investigando-o tu mesmo,',
    motivo: 'KJV: "Commanding his accusers to come unto thee".' },

  // --- Palavra que a fonte comeu, restaurada da Almeida ---
  { ref: '1SA 27:9', de: 'E Davi aquela terra',
    para: 'E Davi feria aquela terra',
    motivo: 'Faltava o verbo: a frase começava sem dizer o que Davi fazia com a terra. KJV: "And David smote the land"; Almeida: "E David feria aquella terra". A palavra que entra é a da Almeida.' },
  { ref: '2SA 16:2', de: 'do rei, em que s; os pães',
    para: 'do rei, em que se montem; os pães',
    motivo: 'A palavra ficou pela metade — `em que s;` não diz nada. KJV: "for the king\'s household to ride on"; Almeida: "para se montarem n\'elles". O verbo restaurado é o da Almeida.' },
  { ref: 'JER 19:6', de: 'Por isso eis vêm dias',
    para: 'Por isso eis que vêm dias',
    motivo: 'Faltava o `que`. KJV: "Therefore, behold, the days come"; Almeida: "Por isso eis que dias veem, diz o Senhor". A própria fonte escreve `eis que vêm dias` 8 vezes e sem o `que` só aqui.' },
  { ref: 'JER 20:7', de: 'cada deles zomba de mim',
    para: 'cada um deles zomba de mim',
    motivo: 'Faltava o `um`. KJV: "every one mocketh me"; Almeida: "cada um d\'elles zomba de mim". A palavra que volta é a da Almeida.' },
  { ref: '1CO 1:29', de: 'para que ninguém orgulhe de si mesmo',
    para: 'para que ninguém se orgulhe de si mesmo',
    motivo: 'Faltava o pronome reflexivo, e sem ele o verbo fica sem sujeito de quem se orgulha. KJV: "That no flesh should glory in his presence"; Almeida: "Para que nenhuma carne se glorie perante elle".' },
  { ref: '1CO 2:9', de: 'e não subiram que ao coração humano',
    para: 'e o ouvido não ouviu, e não subiram ao coração humano',
    motivo: 'É a maior restauração desta fase, e o `que` solto é a prova de que houve queda: ele é o resto da oração que sumiu. As duas testemunhas trazem a frase inteira — KJV "Eye hath not seen, nor ear heard, neither have entered into the heart of man"; Almeida "As coisas que o olho não viu, e o ouvido não ouviu, e não subiram ao coração do homem" — e o Textus Receptus, a linhagem desta edição, traz o `οὐδὲ οὖς ἤκουσεν`. A oração que volta é a da Almeida, palavra por palavra.' },
  { ref: 'GAL 1:19', de: 'E vi nenhum outro dos apóstolos',
    para: 'E não vi nenhum outro dos apóstolos',
    motivo: 'Faltava a negação, e sem ela a frase diz o contrário: que Paulo VIU os outros apóstolos. KJV: "But other of the apostles saw I none"; Almeida: "E não vi a nenhum outro dos apostolos".' },
  { ref: 'GAL 3:6', de: 'e foi lhe reputado como justiça',
    para: 'e isso lhe foi reputado como justiça',
    motivo: 'Faltava o sujeito. É a mesma citação de Gênesis que Rm 4:3 traz completa na própria fonte — `e isso lhe foi imputado como justiça`. Almeida: "e isso lhe foi imputado como justiça".' },
  { ref: 'PHI 1:12', de: 'que as coisas me aconteceram foram',
    para: 'que as coisas que me aconteceram foram',
    motivo: 'Faltava o `que` que abre a oração relativa. KJV: "that the things which happened unto me"; Almeida: "que as coisas que me aconteceram contribuiram".' },
  { ref: 'HEB 8:2', de: 'que Senhor ergueu',
    para: 'que o Senhor ergueu',
    motivo: 'Faltava o artigo, e sem ele a frase fica sem sujeito. KJV: "which the Lord pitched, and not man"; Almeida: "o qual o Senhor fundou, e não o homem".' },
  { ref: '2TH 1:4', de: 'vossas perseguições aflições',
    para: 'vossas perseguições e aflições',
    motivo: 'Faltava a conjunção entre os dois substantivos. KJV: "in all your persecutions and tribulations"; Almeida: "e em todas as vossas perseguições e afflicções".' },
  { ref: '1JO 5:14', de: 'a confiança que diante dele',
    para: 'a confiança que temos diante dele',
    motivo: 'Faltava o verbo. KJV: "this is the confidence that we have in him"; Almeida: "E esta é a confiança que temos para com elle". A palavra que volta é a da Almeida.' },
  { ref: 'MAR 16:7', de: 'ele vai adiante de para a Galileia',
    para: 'ele vai adiante de vós para a Galileia',
    motivo: 'A preposição ficou sem o pronome que ela regia. KJV: "that he goeth before you into Galilee"; Almeida: "que elle vae adiante de vós para a Galilea". A palavra que volta é a da Almeida.' },
  { ref: 'MAR 16:14', de: 'e repreendeu pela incredulidade',
    para: 'e os repreendeu pela incredulidade',
    motivo: 'Faltava o objeto: sem ele não se sabe quem foi repreendido. KJV: "and upbraided them with their unbelief"; Almeida: "e lançou-lhes em rosto a sua incredulidade".' },
  { ref: 'JOH 9:39', de: 'para juízo, para os que não veem, vejam',
    para: 'para juízo, para que os que não veem vejam',
    motivo: 'Faltava o `que` que abre a oração final, e sem ele a frase diz que Jesus veio PARA os cegos em vez de para que eles vejam. KJV: "that they which see not might see"; Almeida: "a fim de que os que não vêem vejam".' },
  { ref: 'LUK 1:5', de: 'sua mulher das filhas de Arão',
    para: 'sua mulher era das filhas de Arão',
    motivo: 'Faltava o verbo. KJV: "and his wife was of the daughters of Aaron"; Almeida: "e cuja mulher era das filhas d\'Aarão".' },
  { ref: 'LUK 2:6', de: 'enquanto eles ali, completaram-se',
    para: 'enquanto eles estavam ali, completaram-se',
    motivo: 'Faltava o verbo. KJV: "while they were there, the days were accomplished"; Almeida: "estando elles ali se cumpriram os dias".' },
  { ref: 'LUK 3:11', de: 'reparta com o não tem',
    para: 'reparta com o que não tem',
    motivo: 'Faltava o relativo, e sem ele o objeto some. KJV: "let him impart to him that hath none"; Almeida: "reparta com o que não tem".' },
  { ref: 'LUK 8:8', de: 'Depois que disse coisas',
    para: 'Depois que disse estas coisas',
    motivo: 'Faltava o demonstrativo. KJV: "And when he had said these things, he cried"; Almeida: "Dizendo elle estas coisas, clamava".' },
  { ref: 'ACT 21:39', de: 'cidade não pouca importância da Cilícia',
    para: 'cidade de não pouca importância da Cilícia',
    motivo: 'Faltava a preposição, e sem ela a aposição desanda. KJV: "a citizen of no mean city"; Almeida: "cidade não pouco celebre na Cilicia".' },
  { ref: 'PSA 69:20', de: 'esperei compaixão, porém [houve] nenhuma',
    para: 'esperei compaixão, porém não [houve] nenhuma',
    motivo: 'Faltava a negação, e sem ela a frase diz que houve compaixão. KJV: "and I looked for some to take pity, but there was none"; Almeida: "esperei por alguem que tivesse compaixão, mas não houve nenhum".' },
  { ref: 'PSA 118:24', de: 'alegremos e enchamos de alegria nele',
    para: 'alegremo-nos e enchamo-nos de alegria nele',
    motivo: 'Faltavam os reflexivos, e sem eles os verbos ficam sem objeto — não se alegra alguma coisa, alegra-se a gente. KJV: "we will rejoice and be glad in it"; Almeida: "regozijemo-nos, e alegremo-nos n\'elle".' },
  { ref: 'PSA 119:83', de: 'não me esqueci teus testemunhos',
    para: 'não me esqueci de teus testemunhos',
    motivo: 'Faltava a preposição: `esquecer-se` pede `de`. KJV: "yet do I not forget thy statutes"; Almeida: "comtudo não me esqueço dos teus estatutos".' },
]

// `manuais` é lista, e não um só: há versículo com dois defeitos — Lc 4:40 traz
// `troxeram` e `varias` na mesma linha. Enquanto isto era um campo único, a
// segunda receita apagava a primeira sem dizer nada, e o defeito seguia servido.
const porRef = new Map<
  string,
  { dup?: string; paren?: boolean; sub?: boolean; ponto?: boolean; manuais: Correcao[] }
>()
const entrada = (ref: string) => porRef.get(ref) ?? { manuais: [] }
for (const [ref, palavra] of DUPLICADAS) porRef.set(ref, { ...entrada(ref), dup: palavra })
for (const ref of PARENTESES_ORFAOS) porRef.set(ref, { ...entrada(ref), paren: true })
for (const ref of SUBSCRICOES) porRef.set(ref, { ...entrada(ref), sub: true })
for (const ref of PONTO_FINAL_PERDIDO) porRef.set(ref, { ...entrada(ref), ponto: true })
for (const c of [...CORRECOES, ...OMISSOES]) {
  const e = entrada(c.ref)
  porRef.set(c.ref, { ...e, manuais: [...e.manuais, c] })
}

/**
 * Aplica as correções registradas para o versículo. Devolve o texto intacto
 * quando não há nenhuma — o caso dos outros 31.037.
 */
export function corrigirVersiculo(
  cod: string,
  capitulo: number,
  versiculo: number,
  texto: string,
): string {
  const ref = `${cod} ${capitulo}:${versiculo}`
  const alvo = porRef.get(ref)
  if (!alvo) return texto

  let saida = texto

  if (alvo.dup) {
    const p = alvo.dup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`((?<![\\p{L}])${p})(\\s+)${p}(?![\\p{L}])`, 'iu')
    if (!re.test(saida)) {
      throw new Error(
        `Correção de duplicata em ${ref} não encontrou "${alvo.dup} ${alvo.dup}". A fonte mudou — reveja a tabela.`,
      )
    }
    saida = saida.replace(re, '$1')
  }

  if (alvo.paren) {
    if (!saida.includes(')')) {
      throw new Error(
        `Correção de parêntese órfão em ${ref} não encontrou ")". A fonte mudou — reveja a tabela.`,
      )
    }
    saida = saida.replace(/\s*\)/, '')
  }

  if (alvo.sub) {
    if (!FIM_SUBSCRICAO.test(saida)) {
      throw new Error(
        `Subscrição em ${ref} não encontrada. A fonte mudou — reveja a tabela.`,
      )
    }
    saida = saida.replace(FIM_SUBSCRICAO, '')
  }

  for (const m of alvo.manuais) {
    if (!saida.includes(m.de)) {
      throw new Error(
        `Correção em ${ref} não encontrou "${m.de}". A fonte mudou — reveja a tabela.`,
      )
    }
    saida = saida.replace(m.de, m.para)
  }

  // Por último: o ponto entra depois de as outras receitas terem mexido no fim
  // do versículo, senão a subscrição removida deixaria o ponto no lugar errado.
  if (alvo.ponto) {
    if (JA_PONTUADO.test(saida)) {
      throw new Error(
        `Ponto final em ${ref} não era necessário — o versículo já termina pontuado. A fonte mudou.`,
      )
    }
    saida = `${saida}.`
  }

  return saida
}
