import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { validarMaterial, type Material } from './validar-material.ts'
import { blocosDaResenha } from '../src/lib/paragraphize.ts'

const root = join(import.meta.dirname, '..')

export interface RevisaoPericope {
  ordem: number
  titulo_pericope_pt: string
  contexto_historico_literario: string
  resenha: string
  perguntas_reflexao: [string, string]
  topicos_pregar: string
}

export const REVISOES: Record<number, RevisaoPericope> = {
  1600: {
    ordem: 1600,
    titulo_pericope_pt: 'A genealogia de Jesus: de Abraão e Davi às catorze gerações',
    contexto_historico_literario:
      'Na Judeia daquela época, sob o domínio do Império Romano, uma lista de família não era mera curiosidade: era o documento oficial para provar direitos de herança, liderança e linhagem real. Ao abrir seu livro proclamando Jesus como Filho de Davi e Filho de Abraão, Mateus apresenta o documento de identidade do Messias, unindo sua história às duas maiores promessas da Bíblia: a bênção para todas as nações e o reino perpétuo de Israel.\n\n' +
      'A relação de nomes não foi copiada ao acaso de arquivos civis: ela foi estruturada com intenção clara em três blocos de catorze gerações. No alfabeto hebraico, cada letra tem um valor numérico, e a soma das letras do nome de Davi resulta exatamente em catorze. O nome do maior monarca do povo hebreu fica assim gravado no próprio ritmo da leitura.',
    resenha:
      'O detalhe mais impressionante do registro é a inclusão deliberada de quatro mulheres: Tamar, Raabe, Rute e a viúva de Urias. Na cultura da época, documentos de descendência citavam exclusivamente homens. Todas as quatro possuíam origem fora de Israel ou carregavam marcas de sofrimento e preconceito público. Antes mesmo de Jesus iniciar sua pregação aos marginalizados, sua própria árvore genealógica já demonstrava que Deus não depende de famílias perfeitas para cumprir seus propósitos de amor.\n\n' +
      'A narrativa também não oculta os reis infiéis que conduziram a nação à ruína, nem o período traumático do exílio na Babilônia, quando o povo perdeu sua terra natal e seu trono. Na última linha da sequência, a fórmula tradicional sofre uma quebra marcante: em vez de dizer que José gerou Jesus, o texto declara que José era esposo de Maria, da qual nasceu Jesus, chamado o Cristo. A linha biológica cede espaço à ação extraordinária do Espírito de Deus.\n\n' +
      '- O título de Cristo significa Ungido, indicando aquele que foi consagrado com óleo para exercer a realeza sagrada.\n' +
      '- O exílio babilônico foi a época amarga em que os moradores de Judá foram levados forçados para longe de sua pátria.\n' +
      '- O termo filho muitas vezes designava um descendente distante no tempo, e não apenas o herdeiro de primeiro grau.',
    perguntas_reflexao: [
      'A árvore genealógica de Jesus acolhe trajetórias marcadas por crises e recomeços. O que muda no seu olhar sobre o próprio passado ao notar que Deus constrói a história sem depender de famílias impecáveis?',
      'A promessa de salvação atravessou governos ruins e épocas de grande perda. Em quais áreas incertas da sua rotina você precisa se lembrar de que a fidelidade divina continua atuando?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A linhagem serve como **documento** oficial que autentica a promessa do Messias.\n' +
      '- As duas figuras de abertura conectam Jesus às grandes **alianças** com Abraão e Davi.\n' +
      '- A divisão em blocos carrega o número de Davi na **métrica** dos nomes.\n' +
      '- A inclusão de quatro **mulheres** rompe os costumes rígidos da época patriarcal.\n' +
      '- O registro acolhe episódios dolorosos como a perda e a deportação no **exílio**.\n' +
      '- Na última linha a sucessão biológica se **interrompe** para revelar a graça divina.\n' +
      '- O Salvador entra na história humana para acolher quem se sentia do lado de **fora**.\n\n' +
      'Mensagens a levar\n' +
      '- Deus realiza seus propósitos grandiosos por meio de pessoas comuns e **reais**.\n' +
      '- O que o preconceito tenta apagar, o amor de Deus **inclui** com honra.\n' +
      '- A fidelidade do Criador opera através das eras e supera a nossa **ansiedade**.\n' +
      '- Nenhuma crise histórica é capaz de anular aquilo que foi **prometido**.\n' +
      '- A graça de Cristo acolhe as pessoas muito além de qualquer exigência de **mérito**.',
  },
  1601: {
    ordem: 1601,
    titulo_pericope_pt: 'A gravidez de Maria e a decisão secreta de José',
    contexto_historico_literario:
      'Na cultura judaica daquela época, o noivado já constituía um contrato formal com plena validade perante a lei civil e religiosa. O casal costumava aguardar cerca de um ano até a realização do casamento para morarem sob o mesmo teto, mas qualquer gravidez constatada durante esse tempo era tratada como quebra grave da fidelidade matrimonial, expondo a mulher a vergonha pública e ao julgamento comunitário.\n\n' +
      'José toma conhecimento da gestação de Maria exatamente nesse período vulnerável. Desconhecendo a intervenção divina, ele enfrenta o dilema entre a cobrança social da lei e o cuidado com a vida da noiva, procurando uma solução que não a destruísse diante da comunidade.',
    resenha:
      'O relato chama José de justo no momento exato em que ele busca uma alternativa silenciosa para resguardar a jovem. Para a mentalidade comum daquele tempo, fazer justiça significava denunciar publicamente o caso para punição; para José, a genuína retidão consistia em aplicar a misericórdia e poupar a vida alheia da execração pública.\n\n' +
      'A aparição celestial em sonho não repreende o temor de José, mas acrescenta o dado espiritual que faltava: a criança vinha do Espírito Santo e traria a libertação dos pecados do povo. Ao despertar, José assume a união sem demora e confere o nome à criança. De acordo com o costume antigo, o ato de nomear formalizava o reconhecimento da paternidade, inserindo o menino por direito legítimo na casa real de Davi.\n\n' +
      '- Estar desposada representava um compromisso formal irrevogável, que só podia ser cancelado por divórcio perante testemunhas.\n' +
      '- Expor à infâmia equivalia a submeter a mulher a uma humilhação pública destrutiva perante os anciãos do vilarejo.\n' +
      '- O nome Emanuel tem origem hebraica e expressa a realidade de que o próprio Deus caminha junto ao seu povo.',
    perguntas_reflexao: [
      'José é reconhecido como homem justo por ter preferido a compaixão à condenação pública. Em quais situações você é desafiado a colocar a misericórdia acima da vontade de julgar?',
      'O anjo convida José a vencer o receio do que os outros iriam dizer para obedecer à vontade divina. Que passo importante você tem evitado dar pelo medo do julgamento dos vizinhos?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O noivado antigo já conferia direitos e deveres civis de uma aliança de **casamento**.\n' +
      '- A notícia da gravidez colocava Maria diante do perigo iminente de escândalo e **rejeição**.\n' +
      '- A retidão de José se manifesta na busca de uma saída discreta guiada pela **compaixão**.\n' +
      '- A revelação celestial dissipa a dúvida e aponta a missão salvadora daquele **menino**.\n' +
      '- A obediência de José ocorre de forma imediata e sem qualquer registro de **hesitação**.\n' +
      '- O gesto de impor o nome oficializa perante a lei a **adoção** paternal do recém-nascido.\n' +
      '- Jesus assume a herança davídica pela coragem e pela fé de um homem **humilde**.\n\n' +
      'Mensagens a levar\n' +
      '- A verdadeira justiça sempre considera o bem-estar e a preservação do seu **próximo**.\n' +
      '- Deus fala com clareza a quem já procura agir com retidão e **sensibilidade**.\n' +
      '- Seguir a vontade divina pode significar carregar mal-entendidos aos olhos dos **outros**.\n' +
      '- A paternidade espiritual se confirma na atitude generosa de abraçar e **proteger**.\n' +
      '- O Senhor se faz presente bem no meio das nossas crises e momentos de **indecisão**.',
  },
  1602: {
    ordem: 1602,
    titulo_pericope_pt: 'A visita dos magos do Oriente e o medo de Herodes',
    contexto_historico_literario:
      'Herodes governava a Judeia por autorização do senado de Roma, mas descendia do povo de Edom e não tinha laços com a realeza de Israel. Por se sentir inseguro em relação à própria legitimidade, ele desenvolveu uma desconfiança obsessiva e violenta, chegando a mandar executar a esposa e três filhos que pudessem disputar seu trono. A mera menção de um soberano nato gerava inquietação em toda a corte de Jerusalém.\n\n' +
      'Os magos que chegaram à capital eram sábios e observadores das estrelas vindos de regiões a leste, nos territórios da Pérsia e da antiga Mesopotâmia. Eles investigavam sinais celestes e guardavam tradições antigas sobre o nascimento de um líder supremo na terra dos judeus.',
    resenha:
      'A indagação dos visitantes estrangeiros atingiu o ponto mais frágil de Herodes: eles procuravam aquele que havia nascido rei dos judeus, expondo o fato de que Herodes obtivera o poder apenas por manobras e favores de Roma. O contraste do episódio é profundo: os chefes dos sacerdotes conheciam os textos sagrados e citavam de memória a profecia sobre Belém, mas nenhum deles se dispôs a percorrer os poucos quilômetros até o local; quem atravessou desertos para adorar foram homens de terras distantes.\n\n' +
      'Ao entrarem na residência simples e encontrarem o menino com Maria, os viajantes se prostraram com reverência e abriram suas bagagens de valor. As dádivas entregues possuíam forte carga profética: o ouro representava a dignidade régia, o incenso apontava para a honra devida a Deus, e a mirra, um bálsamo amargo empregado na preparação de corpos para sepultura, prenunciava a entrega da própria vida pelo Salvador. Avisados em revelação para não retornar ao palácio de Herodes, eles regressaram por um caminho alternativo.\n\n' +
      '- Os escribas eram eruditos dedicados ao estudo minucioso e à cópia fiel das leis e profecias sagradas.\n' +
      '- O incenso era uma resina aromática queimada durante os momentos de oração no santuário sagrado.\n' +
      '- A mirra consistia numa seiva amarga muito valorizada para perfumes finos e no preparo de sepultamentos.',
    perguntas_reflexao: [
      'Os teólogos de Jerusalém conheciam as profecias mas não foram a Belém, enquanto os magos viajaram de longe. Em que aspectos o seu conhecimento bíblico precisa se transformar em passos práticos?',
      'Herodes usou uma promessa de adoração religiosa para encobrir planos homicidas. Como manter o discernimento para não se deixar enganar por belas aparências espirituais?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O trono mantido por alianças políticas se apavora diante da chegada do herdeiro **legítimo**.\n' +
      '- Homens de terras estrangeiras percebem sinais celestiais ignorados pelos líderes da **região**.\n' +
      '- Os religiosos de Jerusalém dominam as respostas da profecia, mas permanecem em total **inércia**.\n' +
      '- Os viajantes chegam a uma casa humilde e prestam sincera homenagem ao menino e à sua **mãe**.\n' +
      '- As ofertas de ouro, incenso e mirra simbolizam a realeza, a santidade e o sacrifício de **Cristo**.\n' +
      '- O aviso divino protege os visitantes e desarticula os planos maliciosos do governante **tirano**.\n' +
      '- O retorno por outra estrada ensina a romper com alianças destrutivas para seguir nova **direção**.\n\n' +
      'Mensagens a levar\n' +
      '- Conhecer as Escrituras só tem valor duradouro quando conduz o coração à sincera **procura**.\n' +
      '- O chamado de Deus rompe fronteiras e acolhe buscadores de todas as origens e **nacionalidades**.\n' +
      '- O apego desesperado ao poder costuma se fantasiar com palavras e gestos de fingida **piedade**.\n' +
      '- A adoração verdadeira se expressa em generosidade e entrega dos melhores **recursos**.\n' +
      '- Deus sempre oferece rotas seguras de livramento para quem obedece às suas **instruções**.',
  },
  1603: {
    ordem: 1603,
    titulo_pericope_pt: 'A fuga para o Egito: protegendo o menino no escuro',
    contexto_historico_literario:
      'Depois da partida dos magos, o perigo que rondava a família de Jesus tornou-se imediato. Herodes mantinha uma rede de informantes e soldados por toda a Judeia, pronto para eliminar qualquer criança que pudesse ameaçar sua coroa. A ordem do anjo a José não falava de um plano de longo prazo, mas de uma partida às pressas naquela mesma noite.\n\n' +
      'O destino escolhido trazia lembranças marcantes para o povo hebreu. O Egito tinha sido a terra da antiga escravidão dos antepassados, mas naqueles dias funcionava como uma província romana autônoma, fora do território onde Herodes podia dar ordens. Além disso, abrigava grandes colônias de famílias judaicas que mantinham negócios e davam acolhimento a compatriotas em viagem.',
    resenha:
      'A ordem celestial não veio acompanhada de explicações fáceis nem de uma data de retorno. José recebeu apenas a instrução de fugir e permanecer na terra vizinha até novo aviso, porque Herodes estava decidido a caçar o menino para matá-lo. Sem hesitar, o carpinteiro levantou-se no meio da noite, tomou a criança com a mãe e partiu no escuro pela estrada do deserto, contando apenas com o que podiam levar nas mãos.\n\n' +
      'A forma como Deus cuidou daquela família revela uma lição preciosa. Em vez de paralisar o rei mau ou enviar anjos guerreiros para lutar na porta da casa, o Senhor protegeu abrindo um caminho de saída no meio da escuridão. O início da vida de Jesus foi marcado pela condição de refugiado que precisa deixar sua terra para escapar da violência armada.\n\n' +
      'Ao lembrar a profecia antiga que dizia que Deus chamaria seu filho para fora do Egito, o evangelho mostra que a história de Israel estava sendo revivida no próprio Jesus. Aquele mesmo solo que no passado havia representado cativeiro e dor tornou-se, temporariamente, o refúgio seguro para o Salvador.\n\n' +
      '- A fronteira do Egito marcava o fim do alcance político de Herodes, garantindo segurança contra os soldados do rei.\n' +
      '- A estrada para o sul atravessava regiões áridas e exigia vários dias de caminhada difícil com animais de carga.\n' +
      '- Refugiar-se em colônias vizinhas era um recurso comum de famílias judias que fugiam de perseguições políticas na Judeia.',
    perguntas_reflexao: [
      'Deus protegeu a família indicando uma estrada de fuga, e não tirando Herodes do caminho. Como você reage quando a resposta divina exige caminhar em meio à incerteza?',
      'Jesus começou a infância como refugiado longe de sua terra natal. Como essa realidade molda o seu coração diante das pessoas que hoje sofrem por deslocamentos forçados?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O aviso do anjo traz urgência diante da perseguição iminente promovida pelo **rei**.\n' +
      '- O Egito ficava fora da jurisdição militar de Herodes, oferecendo um abrigo **seguro**.\n' +
      '- José obedece no mesmo instante, iniciando a viagem no escuro da **noite**.\n' +
      '- Deus protege abrindo uma rota de saída, e não eliminando magicamente o **perigo**.\n' +
      '- O Salvador experimenta a fragilidade e o desamparo de uma família em **fuga**.\n' +
      '- A memória do antigo povo de Israel é repetida nos passos do próprio **Jesus**.\n' +
      '- O lugar que um dia foi casa de escravidão vira instrumento temporário de **cuidado**.\n\n' +
      'Mensagens a levar\n' +
      '- A condução de Deus muitas vezes nos ensina a confiar sem conhecer o destino **final**.\n' +
      '- Nem todo livramento significa a ausência de cansaço e esforço na **caminhada**.\n' +
      '- O Evangelho se conecta profundamente com as dores e carências dos **refugiados**.\n' +
      '- Deus pode transformar lugares de memórias difíceis em pontos de renovação e **paz**.\n' +
      '- A prontidão para agir no momento certo protege as coisas mais preciosas da **vida**.',
  },
  1604: {
    ordem: 1604,
    titulo_pericope_pt: 'O massacre das crianças em Belém e o choro de dor',
    contexto_historico_literario:
      'Ao perceber que os magos do Oriente haviam retornado por outro caminho sem lhe prestar contas, Herodes foi tomado por uma fúria incontrolável. Conhecendo o tempo aproximado em que a estrela havia sido avistada, ele calculou a idade da criança e ordenou que seus soldados matassem todos os meninos de dois anos para baixo no vilarejo de Belém e nos arredores vizinhos.\n\n' +
      'Belém era uma pequena aldeia agrícola com poucas centenas de moradores, incapaz de oferecer qualquer resistência militar às tropas do rei. O evangelho conecta esse acontecimento sangrento a um lamento profético de Jeremias, lembrando a figura de Raquel, esposa de Jacó sepultada nas proximidades de Belém, chorando pelos filhos arrancados de seus lares.',
    resenha:
      'O relato bíblico não tenta suavizar a crueldade do que aconteceu nem busca explicações convenientes para a dor daquelas mães. O massacre foi o resultado direto da obsessão de um governante pelo poder, que não media limites para exterminar qualquer concorrente imaginário. As crianças mortas eram de lares humildes, filhos de camponeses sem qualquer poder de reação perante a violência armada.\n\n' +
      'Enquanto José e Maria escapavam pelo deserto em direção ao Egito, as famílias de Belém foram esmagadas pelo luto. O evangelho tem a coragem de registrar que Raquel chorava por seus filhos e não queria ser consolada, porque eles já não existiam. A recusa do consolo fácil mostra que a fé bíblica reconhece a dor legítima e não tenta apagar a perda com palavras vazias ou frases prontas.\n\n' +
      'Ao associar o choro de Belém à memória de Ramá, onde os cativos foram reunidos no passado antes do cativeiro, o texto afirma que o sofrimento dos inocentes não é esquecido pelo céu. Jesus não entrou no mundo em um cenário protegido ou idealizado, mas pisou num chão ferido pelo egoísmo humano, assumindo a nossa história em sua dor mais profunda.\n\n' +
      '- A localidade de Ramá ficava ao norte de Jerusalém e serviu de campo de concentração para os prisioneiros da Babilônia.\n' +
      '- O lamento fúnebre fazia parte do costume da época, em que a família e os vizinhos expressavam a dor da perda em alta voz.\n' +
      '- Recusar consolo não era sinal de revolta contra Deus, mas a demonstração sincera do peso inegociável daquela perda.',
    perguntas_reflexao: [
      'O texto bíblico acolhe o pranto de uma mãe que não aceita consolo fácil. Você tem dado espaço para chorar suas perdas reais sem se culpar por sentir dor?',
      'A crueldade de Herodes nasceu do medo de perder privilégios. Em que áreas da vida o apego ao controle pode nos tornar frios diante do sofrimento alheio?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A ira de Herodes foi motivada pela quebra de sua tentativa de **controle**.\n' +
      '- O cálculo da idade das vítimas revela um ato planejado de violência de **Estado**.\n' +
      '- As famílias do vilarejo de Belém não possuíam recursos para qualquer autodefesa **militar**.\n' +
      '- A Bíblia retrata o choro de Raquel sem aplicar censura ou tentar minimizar o **luto**.\n' +
      '- A dor dos inocentes é preservada na memória das Escrituras como ferida **aberta**.\n' +
      '- A recusa do consolo superficial valida a legitimidade do pranto de quem sofre uma **perda**.\n' +
      '- Jesus nasce no meio de uma realidade humana atravessada pelo conflito e pela **opressão**.\n\n' +
      'Mensagens a levar\n' +
      '- A fé madura não precisa dar respostas prontas para todas as tragédias do **mundo**.\n' +
      '- Deus não fecha os olhos para as lágrimas derramadas pelos mais fracos e **indefesos**.\n' +
      '- Quem passa pelo vale da dor necessita de presença paciente, e não de lições de **moral**.\n' +
      '- O Salvador escolheu participar da história humana conhecendo a realidade do **sofrimento**.\n' +
      '- A esperança cristã não ignora a ferida, mas promete a cura definitiva nas mãos do **Criador**.',
  },
  1605: {
    ordem: 1605,
    titulo_pericope_pt: 'A volta do Egito e a nova vida em Nazaré',
    contexto_historico_literario:
      'Com a morte do velho Herodes, seu território na Judeia e na Samaria passou para o controle de seu filho Arquelau, conhecido por um temperamento violento que logo provocou revoltas populares reprimidas com massacres no Templo. Sabendo dessa reputação sanguinária, José compreendeu que voltar com a família para a região de Belém e Jerusalém continuava sendo um enorme perigo.\n\n' +
      'A alternativa foi seguir viagem mais para o norte, rumo à Galileia, que estava sob a administração de outro filho de Herodes, chamado Antipas. Ali ficava Nazaré, uma pequena vila encravada entre as montanhas, habitada por lavradores e construtores humildes, completamente esquecida pelos centros de poder religioso e político de Israel.',
    resenha:
      'A ordem para retornar da terra estrangeira chega com os mesmos verbos usados na fuga: levantar, tomar o menino com a mãe e voltar para a terra de Israel. O texto destaca que aqueles que queriam matar o menino já não estavam mais vivos, mostrando que os impérios e tiranos passam, enquanto o propósito de Deus permanece firme.\n\n' +
      'A reação de José ao saber que o filho de Herodes assumira o trono é descrita com muita naturalidade: ele sentiu medo. O evangelho valoriza a prudência do pai, que não confunde fé com imprudência cega. Atendendo a uma nova orientação divina, ele desvia o caminho e estabelece sua família em Nazaré, permitindo que Jesus crescesse longe dos holofotes do poder e das ameaças de morte.\n\n' +
      'Ao afirmar que isso cumpria o que foi dito pelos profetas sobre ser chamado de Nazareno, o evangelho faz um belo jogo de palavras. No hebraico bíblico, a palavra que significa renovo ou broto que nasce de um tronco cortado tem a mesma raiz do nome Nazaré. O Messias não viria de um palácio pomposo em Jerusalém, mas cresceria como um broto discreto num canto simples, preparando-se em silêncio para transformar o mundo.\n\n' +
      '- Arquelau herdou a Judeia mas governou com tanta tirania que acabou sendo deposto e exilado pelos próprios romanos anos depois.\n' +
      '- A região da Galileia ficava distante do Templo e era vista com preconceito pelos mestres da capital por sua população simples.\n' +
      '- O termo renovo nas profecias antigas apontava para a esperança que brota de um toco de árvore que parecia sem vida.',
    perguntas_reflexao: [
      'José obedeceu a Deus e ainda assim teve prudência diante do perigo real. Como você equilibra fé corajosa e sabedoria prática nas decisões do seu dia a dia?',
      'Jesus passou a infância e juventude numa vila pequena e sem destaque social. Como isso anima você a valorizar a sua rotina comum onde você vive hoje?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A morte de Herodes abre o caminho para o fim do exílio temporário da família no **Egito**.\n' +
      '- A tirania do filho Arquelau exige cautela e mudança de planos por parte de **José**.\n' +
      '- O medo de José é acolhido por Deus, que envia uma nova orientação de **rota**.\n' +
      '- A escolha da Galileia afasta a criança do centro de intrigas e tensões de **Jerusalém**.\n' +
      '- Nazaré era um vilarejo simples e sem prestígio aos olhos da liderança daquela **época**.\n' +
      '- A profecia do renovo aponta para a vida nova que brota de onde nada se **esperava**.\n' +
      '- Os anos de formação do Salvador transcorrem no aprendizado do trabalho e na vida em **comunidade**.\n\n' +
      'Mensagens a levar\n' +
      '- Sabedoria prática e cuidado diário não são inimigos de uma vida de fé em **Deus**.\n' +
      '- Deus conduz a nossa história por etapas, ajustando a direção a cada passo do **caminho**.\n' +
      '- Grandes propósitos muitas vezes são gerados no silêncio de lugares **comuns**.\n' +
      '- Nenhuma origem humilde impede o cumprimento dos planos santos do **Senhor**.\n' +
      '- Os poderosos deste mundo passam, mas as promessas eternas permanecem para **sempre**.',
  },
  1606: {
    ordem: 1606,
    titulo_pericope_pt: 'A mensagem de João Batista: uma voz firme no deserto',
    contexto_historico_literario:
      'A região do deserto da Judeia era uma faixa rochosa e árida que descia das colinas de Jerusalém até o vale profundo do mar Morto. Séculos antes, o profeta Elias havia percorrido aquelas mesmas terras vestindo roupas rústicas de pelos de camelo e um cinto de couro preso à cintura. Quando João surge com essa mesma aparência no ermo, o povo compreende o significado na hora: a voz profética que estava em silêncio havia quatrocentos anos voltara a clamar.\n\n' +
      'O local escolhido para a pregação não foi o pátio monumental do Templo na capital, mas as margens secas onde o povo precisava sair de sua zona de conforto para escutar a mensagem. A expectativa nacional por libertação política era enorme, mas o chamado de João apontava para uma mudança interior muito mais profunda.',
    resenha:
      'A pregação de João incomodou profundamente as autoridades religiosas que desciam de Jerusalém. Ao ver líderes dos fariseus e saduceus aproximando-se do rio, ele não usa palavras polidas: adverte que a herança de sangue de Abraão não servia de escudo contra a justiça divina, pois Deus podia fazer surgir filhos até mesmo das pedras do chão. A verdadeira preparação para o Reino dos céus exigia frutos concretos de mudança de atitude, e não apenas discursos de piedade.\n\n' +
      'O batismo nas águas do rio simbolizava a purificação e o arrependimento dos erros passados, mas João declara com clareza a sua posição de servo: ele não era o Messias prometido, e sim aquele que preparava o caminho. O personagem maior que estava por vir batizaria com o poder do Espírito Santo e com fogo, limpando a eira do mundo para recolher o trigo no celeiro e queimar a palha sem valor.\n\n' +
      '- Os fariseus e saduceus eram os grupos mais influentes da elite religiosa e política da capital.\n' +
      '- O fruto de arrependimento representava atitudes éticas visíveis no trato diário com o próximo.\n' +
      '- A eira era o chão de terra batida onde os lavradores separavam os grãos de cereal da casca inútil.',
    perguntas_reflexao: [
      'João advertiu que privilégios religiosos herdados não substituem a obediência prática. Onde você tem se apoiado em tradições antigas em vez de buscar uma fé viva e diária?',
      'A mensagem do deserto pedia frutos reais de arrependimento. Que mudança concreta de atitude você sabe que precisa assumir nos seus relacionamentos hoje?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O deserto da Judeia quebra o silêncio profético de quatro séculos com uma voz **firme**.\n' +
      '- A figura rústica de João evoca a autoridade e o ministério corajoso do profeta **Elias**.\n' +
      '- O chamado ao arrependimento exige que a multidão saia da inércia e procure as águas do **rio**.\n' +
      '- A denúncia contra os líderes religiosos expõe a futilidade de confiar em pedigree **espiritual**.\n' +
      '- O fruto exigido pelo profeta é uma vida íntegra e não apenas palavras de aparência **religiosa**.\n' +
      '- O batismo nas águas aponta para o ministério muito superior do Messias que batiza com **fogo**.\n' +
      '- A imagem da colheita na eira lembra a responsabilidade inegociável de cada ser **humano**.\n\n' +
      'Mensagens a levar\n' +
      '- Deus muitas vezes fala longe do barulho dos grandes centros e nos convida ao **silêncio**.\n' +
      '- Tradições de família não substituem um compromisso pessoal e autêntico com o **Criador**.\n' +
      '- O verdadeiro arrependimento se comprova pelas escolhas práticas e pela **justiça**.\n' +
      '- Humildade genuína sabe exaltar a Cristo e reconhecer o próprio lugar de **servo**.\n' +
      '- O Reino de Deus convida cada pessoa a produzir frutos duradouros de paz e **misericórdia**.',
  },
  1607: {
    ordem: 1607,
    titulo_pericope_pt: 'O batismo de Jesus no rio Jordão',
    contexto_historico_literario:
      'O batismo administrado por João Batista no rio Jordão era voltado exclusivamente para quem confessava seus pecados e buscava purificação moral para recomeçar a vida. Era um ritual público de humildade, no qual as pessoas reconheciam seus erros diante de Deus e da comunidade antes da chegada do juízo anunciado.\n\n' +
      'Quando Jesus deixa a carpintaria em Nazaré e desce até o rio para entrar na fila com os demais, João percebe imediatamente o paradoxo: aquele homem não tinha pecados a confessar. O profeta tenta recuar e recusa o pedido, declarando que ele próprio é quem precisava ser batizado por Jesus.',
    resenha:
      'A resposta de Jesus revela o coração de sua missão: era necessário cumprir toda a justiça. Jesus não entrou nas águas do rio por necessidade de purificação individual, mas para se solidarizar de corpo inteiro com a humanidade ferida, assumindo sobre si a caminhada do seu povo. Ao descer à água, o Rei se coloca no mesmo nível dos necessitados de graça.\n\n' +
      'Ao emergir da água, a cena atinge um momento solene: o céu se abre, o Espírito de Deus desce de forma mansa e visível como uma pomba, e uma voz do céu proclama Jesus como o Filho muito amado em quem o Pai tem plena alegria. A consagração messiânica não acontece dentro dos palácios pomposos de Jerusalém, mas no leito de um rio comum perante o povo simples.\n\n' +
      '- O rio Jordão era a artéria fluvial mais célebre de Israel, marcando passagens históricas de travessia e renovação espiritual.\n' +
      '- A expressão cumprir toda a justiça significava realizar em perfeita obediência cada desígnio santo do plano divino.\n' +
      '- A descida como pomba simbolizava a suavidade, a paz e o poder pacificador da unção do Espírito Santo.',
    perguntas_reflexao: [
      'Jesus não precisava de perdão, mas entrou na água para se solidarizar com as pessoas comuns. Onde você pode demonstrar essa mesma humildade para caminhar ao lado de quem sofre?',
      'A voz do céu declara amor e aprovação sobre Jesus antes de ele realizar qualquer milagre público. Como a certeza de ser amado por Deus pode libertar você da ansiedade de provar seu valor aos outros?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O batismo do Jordão era um rito de confissão e purificação moral para os **pecadores**.\n' +
      '- A chegada de Jesus causa espanto e resistência em João, que reconhece sua própria **limitação**.\n' +
      '- Jesus insiste em ser batizado para abraçar em solidariedade o destino do seu **povo**.\n' +
      '- O cumprimento da justiça divina se dá pelo caminho da humildade e da perfeita **obediência**.\n' +
      '- Ao sair das águas, os céus se abrem para revelar a unção do Espírito Santo sobre o **Messias**.\n' +
      '- A voz do Pai celestial autentica publicamente a filiação régia e o amor pelo seu **Filho**.\n' +
      '- A inauguração do ministério de Cristo nasce sem ostentação de poder militar ou **político**.\n\n' +
      'Mensagens a levar\n' +
      '- A verdadeira liderança começa com a disposição de servir e caminhar no mesmo chão dos **outros**.\n' +
      '- Antes de qualquer grande obra exterior, Deus firma a identidade de quem é **amado**.\n' +
      '- Obedecer ao propósito de Deus muitas vezes exige abrir mão de privilégios de **status**.\n' +
      '- O Espírito Santo capacita com mansidão e firmeza aqueles que se consagram ao **bem**.\n' +
      '- A aprovação que realmente importa para a alma vem da voz silenciosa e fiel do **Criador**.',
  },
  1608: {
    ordem: 1608,
    titulo_pericope_pt: 'As tentações de Jesus no deserto',
    contexto_historico_literario:
      'Logo após ser confirmado publicamente como Filho amado no batismo, Jesus é conduzido pelo próprio Espírito Santo para o deserto ermo da Judeia. Os quarenta dias e quarenta noites de jejum e privação alimentar remetem diretamente aos quarenta anos em que os israelitas peregrinaram no deserto após a saída da escravidão.\n\n' +
      'O cenário da tentação era um ambiente inóspito, de calor escaldante de dia e frio cortante à noite, cercado por animais silvestres e isolamento completo. Naquele estado de extrema fraqueza física, o adversário se aproxima para testar a fidelidade e a identidade do Messias.',
    resenha:
      'As três investidas do tentador visavam desviar Jesus de sua missão redentora por meio de atalhos sedutores. A primeira tentação apelava para a necessidade básica da fome, sugerindo transformar pedras em pães para benefício próprio. A segunda propunha um salto espetacular do ponto mais alto do Templo para forçar Deus a um resgate milagroso e conquistar fama fácil. A terceira oferecia o domínio imediato sobre todos os reinos deste mundo em troca de reverência idólatra.\n\n' +
      'Em cada uma das propostas enganosas, Jesus responde citando passagens do livro de Deuteronômio, o mesmo texto sagrado que orientava a conduta de Israel durante a antiga travessia do deserto. Enquanto a nação do passado fraquejou murmurando por comida e duvidando de Deus, Jesus vence como o verdadeiro Filho obediente que se alimenta da palavra divina e recusa qualquer acordo com a mentira.\n\n' +
      '- O pináculo do templo era o parapeito mais elevado do santuário, erguido sobre um despenhadeiro profundo do vale de Cedrom.\n' +
      '- O livro de Deuteronômio registrava as instruções essenciais dadas ao povo hebreu antes de entrar na terra prometida.\n' +
      '- Servir a Deus com exclusividade era o primeiro e maior mandamento estabelecido na aliança santa de Israel.',
    perguntas_reflexao: [
      'Jesus enfrentou a tentação de usar seu poder em benefício próprio ou para buscar aplausos rápidos. Onde você tem sido tentado a buscar atalhos em vez de perseverar no caminho correto?',
      'Jesus respondeu aos desafios afirmando que nem só de pão vive o ser humano. Como você tem alimentado a sua alma e fortalecido sua mente nos dias de maior cansaço?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O Espírito conduz Jesus ao deserto para provar sua fidelidade em meio à extrema **fraqueza**.\n' +
      '- Os quarenta dias de jejum revivem simbolicamente os quarenta anos de provação de **Israel**.\n' +
      '- A primeira investida testa a dependência de Deus diante das carências urgentes do **corpo**.\n' +
      '- A segunda cilada desafia a presunção religiosa e o desejo de exibição no **Templo**.\n' +
      '- A terceira proposta oferece o poder e a glória do mundo ao preço da **idolatria**.\n' +
      '- Jesus combate cada engano empunhando as verdades fundamentais das **Escrituras**.\n' +
      '- A fidelidade inegociável do Filho afasta o inimigo e atrai o consolo e cuidado dos **anjos**.\n\n' +
      'Mensagens a levar\n' +
      '- Ter momentos de tentação e provação não significa ter sido abandonado pelo **Senhor**.\n' +
      '- Atalhos que prometem facilidades sem renúncia moral sempre cobram um preço **destrutivo**.\n' +
      '- A mente fortalecida pela Palavra de Deus possui discernimento contra as ilusões do **ego**.\n' +
      '- Deus não deve ser colocado à prova por caprichos humanos ou exigências de **sinais**.\n' +
      '- A verdadeira força interior se manifesta na capacidade de dizer não àquilo que fere a **consciência**.',
  },
  1609: {
    ordem: 1609,
    titulo_pericope_pt: 'Jesus inicia a pregação e chama os primeiros discípulos',
    contexto_historico_literario:
      'A prisão de João Batista pelo governante Herodes Antipas marcou uma reviravolta política perigosa em toda a região. Qualquer líder religioso popular passava a ser vigiado de perto pelos soldados da corte. Em vez de se esconder por medo, Jesus parte para o norte e estabelece sua base em Cafarnaum, uma movimentada vila de pescadores na margem do lago da Galileia.\n\n' +
      'Aquela região era cruzada por importantes estradas internacionais de comércio do Império Romano, permitindo contato constante com mercadores gregos, sírios e romanos. Por essa presença marcante de povos vizinhos, os mestres de Jerusalém consideravam a Galileia um território semianalfabeto e distante da pureza religiosa.',
    resenha:
      'A escolha daquele endereço cumpria com exatidão a profecia de Isaías sobre a terra de Zebulom e Naftali: para o povo que habitava na escuridão, nasceu uma luz resplandecente. Jesus assume a mesma mensagem vigorosa do precursor: arrependei-vos, porque está próximo o Reino dos céus. O Salvador não busca teólogos profissionais nas academias de Jerusalém, mas caminha pelas praias e convoca homens simples que cuidavam de barcos e redes de pesca.\n\n' +
      'Ao ouvir o chamado para se tornarem pescadores de homens, Pedro, André, Tiago e João deixam imediatamente suas ferramentas de trabalho e seguem os passos do Mestre. A mensagem do Reino é confirmada na prática por meio de um ministério vigoroso nas sinagogas, com a cura de enfermos e a libertação de pessoas oprimidas, atraindo multidões vindas de todas as cidades e províncias vizinhas.\n\n' +
      '- Cafarnaum funcionava como polo pesqueiro e posto de cobrança de impostos em rota comercial estratégica.\n' +
      '- A metáfora de pescadores de homens definia a tarefa de reunir vidas dispersas para a comunidade do Reino de Deus.\n' +
      '- Decápolis era um conjunto de dez cidades autônomas de língua grega situadas ao redor do rio Jordão.',
    perguntas_reflexao: [
      'Jesus chamou trabalhadores comuns no meio de suas redes de pesca para uma missão extraordinária. De que forma a sua atividade diária pode se tornar um espaço de serviço a Deus e ao próximo?',
      'Os primeiros discípulos deixaram para trás suas seguranças imediatas para seguir a Jesus. O que você precisa ter coragem de soltar para viver o propósito que Deus tem para você?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A prisão de João marca o momento em que Jesus assume a linha de frente do **ministério**.\n' +
      '- A mudança para a Galileia cumpre a promessa profética de luz para uma região **esquecida**.\n' +
      '- A proclamação do Reino retoma o chamado urgente à transformação sincera do **coração**.\n' +
      '- O convite do Mestre alcança pescadores comuns enquanto consertavam suas redes de **trabalho**.\n' +
      '- A resposta dos primeiros seguidores é imediata, abrindo mão de suas rotinas de **segurança**.\n' +
      '- As boas notícias do Evangelho são acompanhadas de compaixão e cura das dores do **povo**.\n' +
      '- A fama das boas obras atrai multidões que buscavam esperança e alívio para suas **vidas**.\n\n' +
      'Mensagens a levar\n' +
      '- Deus costuma iniciar seus maiores movimentos em lugares simples que o mundo **despreza**.\n' +
      '- O chamado de Cristo é pessoal e exige coragem para dar passos práticos de **confiança**.\n' +
      '- A mensagem do Evangelho cuida do ser humano por inteiro, unindo ensino e alívio do **sofrimento**.\n' +
      '- Ninguém é simples demais para ser usado como instrumento transformador na sociedade de **hoje**.\n' +
      '- A verdadeira luz dissipa o medo e aponta caminhos renovados de esperança e **paz**.',
  },
  1610: {
    ordem: 1610,
    titulo_pericope_pt: 'O sermão no monte: benditos os humildes de espírito',
    contexto_historico_literario:
      'Ao avistar as multidões que o seguiam por toda parte, Jesus sobe a encosta de uma montanha perto do mar da Galileia e se senta para instruir seus discípulos e o povo. Na tradição daquela época, os mestres e rabinos sentavam-se para ensinar quando desejavam transmitir lições de autoridade solene.\n\n' +
      'O cenário da montanha trazia à memória dos ouvintes o monte Sinai, onde Moisés recebera os mandamentos sagrados séculos antes. Contudo, Jesus não se apresenta com trovões de terror, mas abre a boca para proclamar a constituição moral e o espírito de um novo Reino baseado na graça.',
    resenha:
      'As palavras inaugurais do discurso revolucionam por completo a visão humana sobre felicidade e realização. Numa época em que o poder militar dos romanos e a soberba dos líderes religiosos dominavam a sociedade, Jesus não declara felizes os ricos, os altivos ou os guerreiros violentos. Pelo contrário, ele proclama benditos os humildes de espírito, os que choram pelos males do mundo, os mansos e aqueles que têm fome e sede de justiça.\n\n' +
      'A promessa celestial se estende aos misericordiosos, aos puros de coração e aos agentes que constroem ativamente a paz em meio às discórdias. Jesus não esconde a realidade da dor: adverte que seus seguidores serão insultados e perseguidos por causa da justiça, assim como foram os antigos profetas, mas garante que a recompensa eterna reservada nos céus supera qualquer provação terrena.\n\n' +
      '- O termo bem-aventurados descreve uma felicidade interior e abençoada por Deus, que não oscila com a sorte do momento.\n' +
      '- Os humildes de espírito são aqueles que reconhecem sem fingimento a sua total dependência da misericórdia do Criador.\n' +
      '- Pacificadores são as pessoas que trabalham com coragem para reconciliar conflitos e espalhar a harmonia nas relações.',
    perguntas_reflexao: [
      'Jesus associou a verdadeira felicidade à humildade e à busca por paz, e não ao acúmulo de prestígio. Quais valores da nossa cultura atual você precisa questionar para viver essa alegria?',
      'As bem-aventuranças elogiam aqueles que têm sede de justiça e misericórdia no coração. Como você pode praticar a compaixão com as pessoas difíceis do seu convívio diário?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A postura sentada no alto do monte assume a autoridade régia do Mestre que ensina o **Reino**.\n' +
      '- A mensagem inicial desmantela a busca vaidosa por aplausos humanos e poder **passageiro**.\n' +
      '- A bênção divina repousa sobre os humildes que reconhecem sua carência moral perante **Deus**.\n' +
      '- O consolo prometido aos que choram valida a sensibilidade diante do sofrimento do **mundo**.\n' +
      '- A mansidão e a fome de justiça são destacadas como marcas distintivas da nova **comunidade**.\n' +
      '- Os pacificadores refletem o próprio caráter do Pai na busca ativa por **reconciliação**.\n' +
      '- A fidelidade em meio à oposição garante uma alegria duradoura que a terra não pode **apagar**.\n\n' +
      'Mensagens a levar\n' +
      '- O padrão do Reino de Deus inverte a lógica do egoísmo e valoriza a pureza do **coração**.\n' +
      '- Chorar com quem sofre e desejar o bem comum é sinal de força espiritual e **maturidade**.\n' +
      '- A paz de Cristo não nasce da ausência de lutas, mas da certeza da presença do **Senhor**.\n' +
      '- Quem cultiva a misericórdia com o próximo sempre experimentará a bondade **divina**.\n' +
      '- As maiores recompensas da vida não cabem no bolso, mas moram na eternidade com o **Pai**.',
  },
  1611: {
    ordem: 1611,
    titulo_pericope_pt: 'Sal da terra e luz do mundo',
    contexto_historico_literario:
      'No mundo antigo, sem a tecnologia de refrigeração para alimentos, o sal era o produto mais precioso para preservar carnes e peixes da decomposição, além de acentuar o sabor dos pratos diários e selar acordos formais de lealdade entre as pessoas. Uma refeição com sal representava aliança de paz.\n\n' +
      'As casas simples da Galileia possuíam janelas pequenas e pouca ventilação, sendo iluminadas ao anoitecer por modestas lamparinas de cerâmica alimentadas com azeite de oliva. Ao cair da noite, essas pequenas lâmpadas eram colocadas sobre pedestais elevados para clarear todo o aposento familiar.',
    resenha:
      'Jesus se volta para os seus discípulos humildes e declara a identidade fundamental daquela comunidade: vós sois o sal da terra e a luz do mundo. O sal não existe para si mesmo, mas para atuar silenciosamente impedindo a degradação e dando sabor ao alimento; se perder sua força característica, não serve para mais nada senão ser pisado no chão. Da mesma forma, os discípulos são chamados a fazer a diferença moral no meio da sociedade.\n\n' +
      'A metáfora da luz complementa o ensinamento com grande vivacidade: uma cidade construída sobre o cume de uma colina não pode ficar oculta aos olhos dos viajantes. Ninguém acende uma lamparina para escondê-la sob um caixote de cereais, mas a ergue no alto para dissipar a escuridão. O propósito das boas obras cristãs não é arrancar elogios para o indivíduo, mas levar as pessoas a reconhecerem e glorificarem a bondade do Pai celestial.\n\n' +
      '- O sal colhido nos depósitos do mar Morto podia estragar e perder a utilidade se ficasse misturado com terra e impurezas.\n' +
      '- O cesto citado era um recipiente de madeira de uso rotineiro nas cozinhas para medir porções de grãos e cereais.\n' +
      '- A luminária era uma haste de metal ou saliência na parede onde a lamparina era apoiada para alcançar todo o quarto.',
    perguntas_reflexao: [
      'O sal precisa ter contato com a comida para preservá-la do apodrecimento. Como você tem se envolvido positivamente no seu bairro ou trabalho sem perder seus valores essenciais?',
      'A luz foi feita para iluminar os outros, e não para ficar guardada em segredo. Que atitude prática de bondade você pode manifestar esta semana para que outros vejam o amor de Deus?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O sal simboliza a presença discreta que previne a corrupção e realça o sabor da **vida**.\n' +
      '- A perda do sabor ilustra a inutilidade de uma fé acomodada que se mistura com o **conformismo**.\n' +
      '- A comunidade de discípulos carrega a vocação irrevogável de ser luz em meio à **escuridão**.\n' +
      '- A imagem da cidade no topo da colina destaca a visibilidade inevitável do testemunho **cristão**.\n' +
      '- Ocultar a lâmpada debaixo de um móvel doméstico contradiz a própria natureza do dom da **luz**.\n' +
      '- As boas ações devem apontar para a graça e a beleza do Criador, e não para a vaidade do **indivíduo**.\n' +
      '- O compromisso com a verdade atua ativamente para inspirar transformação em toda a **sociedade**.\n\n' +
      'Mensagens a levar\n' +
      '- Pequenas atitudes de integridade no cotidiano têm o poder de frear o avanço da **injustiça**.\n' +
      '- A fé cristã genuína não se esconde atrás de portas fechadas, mas brilha no convívio **social**.\n' +
      '- Ser luz significa acolher, orientar e levar esperança para quem se sente perdido no **caminho**.\n' +
      '- A glória de todas as nossas vitórias e dons pertence exclusivamente ao Pai que está nos **céus**.\n' +
      '- Quem mantém a sua autenticidade espiritual torna o mundo ao seu redor um lugar melhor para **viver**.',
  },
  1612: {
    ordem: 1612,
    titulo_pericope_pt: 'Jesus e o verdadeiro cumprimento da Lei',
    contexto_historico_literario:
      'Os líderes dos fariseus e os mestres religiosos de Jerusalém vigiavam qualquer pregador com desconfiança, temendo que novas ideias pudessem anular os mandamentos dados por Deus a Moisés séculos antes. Para a mentalidade hebraica, a Lei sagrada era a aliança perpétua que definia a própria existência e identidade da nação.\n\n' +
      'Diante dessas tensões e suspeitas públicas, Jesus aborda o tema de forma direta e categórica. Ele fala para pessoas que valorizavam cada linha das Escrituras, esclarecendo com precisão qual é o seu relacionamento com os preceitos antigos e as promessas dos profetas.',
    resenha:
      'Jesus declara enfaticamente que não veio para anular ou derrubar os ensinamentos da Lei e dos Profetas, mas para cumpri-los em sua plenitude espiritual e prática. Ele assevera a firmeza da Palavra divina: enquanto o céu e a terra existirem, nenhum detalhe minúsculo, nem a menor letra ou traço da escrita sagrada, perderá seu valor antes que todo o plano celestial se realize.\n\n' +
      'A exigência feita aos discípulos é de tirar o fôlego: se a justiça praticada por eles não superar a dos escribas e fariseus, de modo nenhum entrarão no Reino dos céus. Essa superioridade não consistia em multiplicar regras minuciosas ou fiscalizar o comportamento dos vizinhos, mas em cultivar uma integridade interior autêntica que nasce do amor sincero e transforma a mente a partir de dentro.\n\n' +
      '- O jota correspondia à menor letra do alfabeto hebraico, usada para exemplificar o valor sagrado de cada parte do texto.\n' +
      '- O til representava os pequenos traços gráficos que distinguiam consoantes semelhantes na escrita dos textos sagrados.\n' +
      '- Os escribas eram especialistas e juristas dedicados a estudar, transcrever e interpretar os preceitos da Lei.',
    perguntas_reflexao: [
      'Jesus pediu uma justiça que vai além das aparências externas dos fariseus. Onde a sua vida espiritual corre o risco de virar apenas cumprimento mecânico de regras sociais?',
      'A Palavra de Deus nos convida a uma transformação interior sincera. Que área da sua vida ainda precisa experimentar a plenitude desse amor que renova o coração?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- Jesus afasta o boato de que teria vindo para relaxar ou abolir os preceitos da **Lei**.\n' +
      '- A missão do Salvador é dar pleno cumprimento e significado definitivo às antigas **profecias**.\n' +
      '- A solidez da Palavra divina permanece inabalável diante das transformações do **tempo**.\n' +
      '- A menor instrução moral carrega autoridade e merece respeito na vida dos membros do **Reino**.\n' +
      '- A justiça dos fariseus é denunciada por focar na aparência externa sem renovar o **coração**.\n' +
      '- A nova justiça exigida por Cristo nasce da graça e opera por meio do amor e da **misericórdia**.\n' +
      '- O padrão divino não aceita meias verdades, mas convida a uma entrega honesta e **integral**.\n\n' +
      'Mensagens a levar\n' +
      '- A verdadeira espiritualidade se mede pela pureza das intenções e não pela encenação de **ritos**.\n' +
      '- As Escrituras sagradas continuam sendo lâmpada viva e segura para guiar os passos do **ser humano**.\n' +
      '- Deus valoriza a integridade nas coisas pequenas e nos detalhes imperceptíveis do **cotidiano**.\n' +
      '- Seguir a Cristo significa permitir que a sua lei de amor escreva novas atitudes em nossa **alma**.\n' +
      '- Nenhuma regra humana é capaz de produzir a paz que só o perdão e a graça divina podem **conceder**.',
  },
  1613: {
    ordem: 1613,
    titulo_pericope_pt: 'Do homicídio à reconciliação: deixa a oferta no altar',
    contexto_historico_literario:
      'O mandamento clássico que proibia tirar a vida de outro ser humano era a base do código civil e penal de Israel, e os crimes de morte eram julgados com rigor pelos tribunais de anciãos em cada comunidade. Muitas pessoas consideravam-se justas perante o céu simplesmente por não terem cometido homicídio com as próprias mãos.\n\n' +
      'Além disso, a entrega de sacrifícios no Templo em Jerusalém era vista como o ato mais sagrado de devoção a Deus. Famílias inteiras viajavam dias até o santuário para apresentar suas ofertas pacíficas, acreditando que a cerimônia religiosa cobria qualquer pendência pessoal.',
    resenha:
      'Jesus penetra no íntimo das ações humanas e ensina que a raiz do homicídio reside no coração: a raiva descontrolada contra um irmão e as palavras de menosprezo que rebaixam a dignidade alheia são julgadas pelo céu com a mesma gravidade moral da violência física. Chamar o próximo com apelidos ofensivos é destruir a honra de alguém criado à semelhança do Criador.\n\n' +
      'A prioridade estabelecida pelo Mestre desconcerta a rotina religiosa: se uma pessoa estiver no Templo com a oferta pronta nas mãos e se lembrar de que alguém tem uma queixa contra ela, deve interromper o culto imediatamente. A adoração diante de Deus não é aceita enquanto a ferida entre seres humanos estiver aberta; primeiro é indispensável buscar a reconciliação sincera, e só então retornar para oferecer o culto com o coração em paz.\n\n' +
      '- O tribunal local era o conselho de anciãos responsável por julgar delitos e desavenças civis na vila.\n' +
      '- Tratar o próximo com ofensas verbais destruía sua dignidade na comunidade e era considerado pecado grave perante Deus.\n' +
      '- O altar sagrado de sacrifícios ficava no pátio interno do Templo em Jerusalém, diante dos sacerdotes.',
    perguntas_reflexao: [
      'Jesus ensina que guardar raiva e ofender o próximo são as sementes que geram a violência. Que mágoa ou ressentimento antigo você precisa abandonar antes que ela machuque mais alguém?',
      'O texto coloca a reconciliação com o irmão como prioridade antes mesmo da oferta no altar. Existe alguma conversa difícil de reconciliação que você tem adiado?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O ensinamento de Jesus vai além do ato físico e atinge a intenção oculta do **coração**.\n' +
      '- A ira alimentada em segredo é identificada como o ponto de partida de toda a **violência**.\n' +
      '- As ofensas e apelidos depreciativos ferem a dignidade de quem foi feito à imagem de **Deus**.\n' +
      '- A prática religiosa perde todo o valor quando cultivamos desavenças e discórdia com o **próximo**.\n' +
      '- A ordem do Mestre manda interromper o ritual para buscar a paz e a mútua **reconciliação**.\n' +
      '- Resolver as pendências enquanto há tempo evita que as mágoas se tornem cadeias de **amargura**.\n' +
      '- O culto que agrada ao Senhor exige um espírito desarmado e pronto para pedir e conceder **perdão**.\n\n' +
      'Mensagens a levar\n' +
      '- Palavras duras podem ferir tão profundamente quanto golpes físicos desferidos contra o **corpo**.\n' +
      '- Deus não aceita bajulação religiosa de quem despreza e machuca seus semelhantes no **dia a dia**.\n' +
      '- Ter a coragem de dar o primeiro passo para o diálogo é a maior prova de nobreza e **maturidade**.\n' +
      '- O perdão sincero destrava a nossa vida espiritual e restaura a alegria da convivência em **comunidade**.\n' +
      '- A paz com o Criador caminha de mãos dadas com a busca paciente de harmonia com os nossos **irmãos**.',
  },
  1614: {
    ordem: 1614,
    titulo_pericope_pt: 'A pureza do olhar e o adultério no coração',
    contexto_historico_literario:
      'Na legislação e nos costumes da sociedade antiga, o adultério era punido exclusivamente quando flagrado no ato material de infidelidade física. As cortes de justiça da época examinavam testemunhas e evidências materiais, mas ignoravam por completo as intenções silenciosas da mente.\n\n' +
      'A cultura patriarcal frequentemente tratava as mulheres como posses familiares, tolerando atitudes abusivas e olhares desrespeitosos sob o manto da privacidade. É nesse contexto de moralidade superficial que Jesus apresenta um padrão moral revolucionário sobre a dignidade dos relacionamentos humanos.',
    resenha:
      'Jesus expõe a raiz da deslealdade ao declarar que qualquer pessoa que olhar para outra com o desejo de posse e cobiça egoísta já cometeu adultério com ela em seu interior. A infidelidade não surge de repente num gesto consumado: ela nasce e se alimenta nos pensamentos cultivados no silêncio e nas fantasias descontroladas que reduzem o outro a mero objeto de consumo.\n\n' +
      'Para enfatizar a gravidade do perigo, o Mestre emprega uma forte linguagem de choque típica dos oradores hebraicos: se o olho direito ou a mão direita provocarem tropeço, é preferível arrancá-los ou cortá-los a ver o corpo inteiro destruído. Essa advertência não é uma instrução para mutilação física literal, mas um apelo urgente a uma cirurgia moral decidida que corte sem piedade as ocasiões, hábitos e estímulos que envenenam a alma e corrompem a lealdade.\n\n' +
      '- A cobiça no íntimo do ser descreve o cultivo premeditado de fantasias egoístas que desrespeitam o próximo.\n' +
      '- O olho direito e a mão direita eram considerados no mundo antigo as partes mais nobres e eficientes do corpo humano.\n' +
      '- O recurso à linguagem extrema de mutilação servia para demonstrar a urgência inegociável de combater o mal na raiz.',
    perguntas_reflexao: [
      'Jesus apontou que a infidelidade começa na mente e nas coisas que permitimos aos nossos olhos contemplar. Quais hábitos de consumo visual ou conversas você precisa cortar para proteger sua integridade?',
      'O texto usa uma linguagem forte para exigir uma decisão radical contra o pecado. Que atitude prática você precisa tomar hoje para afastar aquilo que tem enfraquecido seus princípios morais?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A pureza moral nos ensinos de Jesus começa na vigilância dos pensamentos e das **intenções**.\n' +
      '- O ato da traição é desmascarado como o resultado final de desejos egoístas cultivados na **mente**.\n' +
      '- O olhar cobiçoso desrespeita a pessoa do próximo e rebaixa sua condição de filha de **Deus**.\n' +
      '- A fidelidade conjugal é elevada a um pacto sagrado que exige honestidade interior e **zelo**.\n' +
      '- A metáfora de cortar membros ensina a necessidade de decisões firmes contra o perigo do **pecado**.\n' +
      '- Não se deve negociar com hábitos que corroem aos poucos a dignidade e a paz da **família**.\n' +
      '- A verdadeira liberdade espiritual resulta de uma mente limpa e consagrada à prática do **bem**.\n\n' +
      'Mensagens a levar\n' +
      '- Cuidar da pureza do olhar é a melhor maneira de proteger os afetos e o amor em nosso **lar**.\n' +
      '- O respeito genuíno enxerga cada ser humano com reverência e jamais como objeto de uso **egoísta**.\n' +
      '- Tomar decisões difíceis no presente preserva a nossa integridade contra grandes perdas no **futuro**.\n' +
      '- A força para vencer os maus hábitos nasce da busca constante pela graça e pelo auxílio do **Espírito**.\n' +
      '- Quem guarda o coração no caminho da verdade experimenta a paz de uma consciência limpa e **serena**.',
  },
  1615: {
    ordem: 1615,
    titulo_pericope_pt: 'A carta de divórcio e a proteção da mulher',
    contexto_historico_literario:
      'No primeiro século, havia uma intensa polêmica entre duas influentes correntes de mestres religiosos sobre a aplicação do divórcio. Enquanto um grupo mais severo exigia que houvesse traição moral explícita, a corrente mais liberal permitia que o marido expulsasse a esposa por qualquer desagrado caseiro, bastando entregar-lhe uma carta formal de separação.\n\n' +
      'Na prática daquela sociedade, a facilidade de divórcio deixava as mulheres em situação de extrema penúria e humilhação social, privadas de bens e dependentes da compaixão de parentes para não caírem na mendicância. Os homens usavam uma brecha técnica da lei para descartar companheiras sem culpa.',
    resenha:
      'Jesus intervém na controvérsia resgatando a intenção santa do Criador desde a origem da vida: o casamento foi desenhado para ser uma aliança estável de amor, companheirismo e cuidado duradouro. O Mestre denuncia com severidade o costume de abandonar a mulher sob pretextos frívolos, mostrando que esse descarte egoísta empurrava a esposa repudiada para situações de grande sofrimento e adultério forçado.\n\n' +
      'Ao fechar as portas para o divórcio fácil e proteger o vínculo matrimonial, Jesus não defende o legalismo frio, mas levanta um escudo protetor em favor dos mais fracos e vulneráveis da família. O relacionamento conjugal deixa de ser um contrato descartável de consumo e passa a ser reconhecido como um compromisso sagrado que reflete a fidelidade e a paciência de Deus com seus filhos.\n\n' +
      '- A carta de divórcio era um termo assinado entregue pelo marido para atestar publicamente que a mulher estava livre perante a lei.\n' +
      '- A mulher abandonada naquele período enfrentava grave exclusão econômica, sem direito a posses ou trabalho autônomo.\n' +
      '- A aliança matrimonial no propósito bíblico original reflete a união permanente e protetora entre duas vidas.',
    perguntas_reflexao: [
      'Jesus defendeu a dignidade e a permanência do casamento contra a cultura do descarte de sua época. Como você pode valorizar e fortalecer os laços de afeto e compromisso na sua própria família?',
      'O texto expõe como regras religiosas eram usadas para justificar a irresponsabilidade e o abandono. Onde você percebe o perigo de usar desculpas para fugir de seus compromissos mais importantes?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A controvérsia da época sobre o divórcio expunha a crueldade da cultura do descarte contra a **mulher**.\n' +
      '- O Mestre aponta para o princípio original da criação, onde o casamento é aliança de amor **duradouro**.\n' +
      '- A facilidade com que se rompiam lares deixava pessoas inocentes desamparadas na **sociedade**.\n' +
      '- Jesus condena a hipocrisia de usar brechas formais da lei para cometer injustiças contra o **cônjuge**.\n' +
      '- O matrimônio é resgatado como uma promessa mútua de companheirismo, respeito e **fidelidade**.\n' +
      '- A proteção conferida por Cristo restaura a dignidade da parte mais vulnerável e sem **voz**.\n' +
      '- A estabilidade dos relacionamentos familiares reflete a aliança inabalável e amorosa do próprio **Deus**.\n\n' +
      'Mensagens a levar\n' +
      '- Compromissos de amor exigem paciência, perdão diário e disposição constante para o **diálogo**.\n' +
      '- Descartar pessoas quando surgem as primeiras dificuldades contradiz o espírito do **Evangelho**.\n' +
      '- O cuidado com o lar e com os filhos é uma das maiores responsabilidades morais diante do **Criador**.\n' +
      '- A fidelidade nas promessas feitas constrói ambientes seguros onde o amor pode florescer com **paz**.\n' +
      '- A graça divina é capaz de restaurar relacionamentos feridos quando há humildade para **recomeçar**.',
  },
  1616: {
    ordem: 1616,
    titulo_pericope_pt: 'Palavra de honra: que o seu sim seja sim',
    contexto_historico_literario:
      'Entre os religiosos da Judeia, havia se desenvolvido um complexo sistema de juramentos para garantir negócios e promessas. Os mestres da época ensinavam que jurar pelo Templo, por Jerusalém ou pelo céu não criava uma obrigação absoluta de cumprimento, enquanto jurar pelo ouro do santuário ou pelo nome sagrado de Deus era irrevogável.\n\n' +
      'Esse hábito casuístico abria espaço para a dissimulação e a mentira no comércio e na vida cotidiana: as pessoas inventavam juramentos solenes para convencer os outros, sabendo de antemão que encontrariam uma desculpa legal para quebrar a palavra dada.',
    resenha:
      'Jesus rejeita com veemência esse emaranhado de juramentos falsos e desonestos, que dividia as conversas entre momentos de verdade e conversas sem valor. Ele ensina que o céu é o trono soberano de Deus, a terra é o suporte de seus pés e Jerusalém é a cidade do grande Rei; dessa forma, toda a criação pertence ao Senhor e nenhuma palavra pode ser dita como se Deus não estivesse ouvindo.\n\n' +
      'A instrução aos discípulos é de uma clareza desarmante: o falar de vocês deve ser sim quando for sim, e não quando for não. Qualquer necessidade de acrescentar garantias exageradas, juras misteriosas ou promessas teatrais revela a presença da desconfiança e da falsidade. A honestidade do discípulo precisa ser tão sólida e reconhecida que sua simples palavra tenha valor de documento assinado perante a sociedade.\n\n' +
      '- Jurar falsamente era o hábito condenável de invocar coisas sagradas sem ter a firme intenção de cumprir o prometido.\n' +
      '- Jerusalém era honrada pelo povo como o centro da fé e o símbolo profético da presença do Rei celestial.\n' +
      '- A transparência no falar dispensa artifícios e reafirma a confiança mútua entre as pessoas na convivência diária.',
    perguntas_reflexao: [
      'Jesus ensina que a palavra de uma pessoa honesta não precisa de juramentos pomposos para ser crível. Como está a sua reputação de cumprir aquilo que promete aos amigos e à família?',
      'Muitas vezes recorremos a meias verdades ou exageros para impressionar os outros ou sair de enrascadas. Onde você precisa praticar uma honestidade mais transparente no seu dia a dia?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O sistema distorcido de juramentos da época servia para camuflar a mentira e a **desonestidade**.\n' +
      '- Jesus lembra que toda a criação está debaixo do olhar e do governo soberano de **Deus**.\n' +
      '- Não é possível fazer promessas levianas imaginando que o Criador não ouve as nossas **conversas**.\n' +
      '- A integridade da pessoa cristã deve tornar qualquer juramento solene totalmente **desnecessário**.\n' +
      '- O falar transparente que sustenta o sim e o não reflete um caráter limpo e digno de **confiança**.\n' +
      '- O uso de artifícios e exageros verbais revela a fragilidade moral de quem tenta fugir da **verdade**.\n' +
      '- A comunidade do Reino é alicerçada na sinceridade mútua e no respeito irrevogável à palavra **dada**.\n\n' +
      'Mensagens a levar\n' +
      '- Manter a palavra empenhada é um dos maiores testemunhos de honra e integridade na **sociedade**.\n' +
      '- A verdade não precisa de enfeites nem de juramentos dramáticos para demonstrar sua **força**.\n' +
      '- Quem é fiel no pouco e fala com transparência conquista o respeito e a estima dos seus **semelhantes**.\n' +
      '- Dizer a verdade com amor liberta a alma do peso da simulação e das falsas **promessas**.\n' +
      '- Deus ama a fidelidade e abençoa aqueles que mantêm seus compromissos com firmeza e **retidão**.',
  },
  1617: {
    ordem: 1617,
    titulo_pericope_pt: 'A outra face e o amor aos inimigos',
    contexto_historico_literario:
      'A célebre regra antiga de olho por olho e dente por dente foi originalmente estabelecida no código de Moisés como um limite legal para os tribunais, impedindo que famílias ofendidas iniciassem vinganças desproporcionais e derramamentos de sangue sem fim. Era uma norma jurídica de contenção, e não uma autorização para ódios pessoais.\n\n' +
      'Além disso, sob a ocupação das legiões de Roma, qualquer soldado imperial tinha o direito amparado por lei de requisitar um habitante local para carregar bagagens e armamentos militares por uma milha pela estrada. A revolta e o rancor contra os opressores romanos eram sentimentos comuns em cada esquina da Judeia.',
    resenha:
      'Jesus apresenta aqui o ensinamento mais desconcertante e revolucionário de toda a história ética: em vez de pagar o mal na mesma moeda, o discípulo deve quebrar a espiral da violência. Se alguém lhe der um tapa na face direita, ofereça também a outra; se alguém tomar sua túnica num processo, entregue também o manto; e se for forçado a caminhar uma milha com um soldado estrangeiro, caminhe com ele duas milhas por generosa iniciativa própria.\n\n' +
      'O Mestre eleva o padrão ao ponto máximo ao ordenar o amor aos próprios inimigos e a oração sincera em favor dos perseguidores. Ele lembra que o Pai que está nos céus faz o sol brilhar tanto sobre os maus quanto sobre os bons, e derrama a chuva sobre os justos e os injustos sem distinção. A maturidade espiritual pedida aos filhos de Deus não é um perfeccionismo frio, mas a capacidade generosa de amar com a mesma gratuidade e compaixão com que Deus ama a todos.\n\n' +
      '- A antiga lei de retaliação surgiu com a finalidade de frear vinganças desmedidas entre clãs rivais na antiguidade.\n' +
      '- O tapa desferido na face direita com as costas da mão era um gesto clássico de insulto para rebaixar um subordinado.\n' +
      '- A requisição militar forçada era um pesado encargo imposto pelas autoridades romanas sobre as populações dominadas.',
    perguntas_reflexao: [
      'Jesus nos desafia a responder à hostilidade com desprendimento e amor, em vez de alimentar a vingança. Como você tem reagido quando alguém provoca você ou age com injustiça?',
      'Orar por quem nos persegue é o teste supremo de um coração livre de amargura. Há alguma pessoa que machucou você por quem você precisa começar a orar hoje?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- O mandamento antigo de limitar o castigo é superado pela generosidade e pela **graça**.\n' +
      '- Oferecer a outra face não é fraqueza, mas a recusa consciente de entrar na espiral do **ódio**.\n' +
      '- Entregar a capa e caminhar a segunda milha desarma o agressor pela via do amor **inesperado**.\n' +
      '- Amar apenas a quem nos faz bem é o padrão comum praticado por qualquer pessoa no **mundo**.\n' +
      '- O mandamento de amar os inimigos e orar pelos perseguidores reflete o próprio caráter de **Deus**.\n' +
      '- A bondade do Pai celestial se revela ao distribuir o sol e a chuva sobre toda a **humanidade**.\n' +
      '- A perfeição cristã consiste em viver um amor generoso que acolhe sem esperar nada em **troca**.\n\n' +
      'Mensagens a levar\n' +
      '- A verdadeira coragem se manifesta na capacidade de perdoar e vencer o mal por meio do **bem**.\n' +
      '- Quem guarda ressentimento no coração se torna prisioneiro da própria amargura que tenta **alimentar**.\n' +
      '- Tratar com bondade os adversários é o caminho mais eficaz para quebrar preconceitos e construir a **paz**.\n' +
      '- O amor de Deus por nós não depende do nosso merecimento, e assim devemos amar o nosso **próximo**.\n' +
      '- A generosidade de espírito transforma relacionamentos e revela a presença viva de Cristo no **mundo**.',
  },
  1618: {
    ordem: 1618,
    titulo_pericope_pt: 'A esmola em segredo e a recompensa do Pai',
    contexto_historico_literario:
      'Na tradição religiosa de Israel, o socorro aos pobres e desamparados era considerado uma das três maiores obrigações de um indivíduo temente a Deus, ao lado da oração e do jejum. Não existiam programas públicos de assistência social, de modo que viúvas, órfãos e doentes dependiam da caridade dos cidadãos para sobreviver.\n\n' +
      'Aproveitando-se dessa importância comunitária, muitas pessoas ricas e influentes transformavam a distribuição de donativos em espetáculo público nas ruas e nas entradas das sinagogas, buscando aplausos, títulos de honra e prestígio social diante de todos.',
    resenha:
      'Jesus alerta com severidade contra a hipocrisia de praticar boas obras com o objetivo egoísta de ser elogiado pelas pessoas. Ele utiliza a ironia para denunciar quem manda tocar trombetas nas esquinas para atrair a atenção do público antes de dar uma ajuda: essas pessoas já receberam por inteiro a recompensa passageira que buscavam, que é o louvor vazio dos homens, sem qualquer valor perante o céu.\n\n' +
      'A orientação dada aos discípulos é de uma discrição admirável: quando você prestar socorro a alguém, que a sua mão esquerda não tome conhecimento do que faz a direita. A ajuda deve acontecer em segredo, sem autopromoção e sem guardar recibos de vaidade, pois o Pai que vê tudo o que acontece no escondido recompensará a generosidade com sua aprovação eterna e verdadeira.\n\n' +
      '- A esmola constituía a principal fonte de sustento e sobrevivência para famílias necessitadas na Judeia antiga.\n' +
      '- Tocar trombeta diante das ações funcionava como imagem viva de quem faz propaganda das próprias boas obras.\n' +
      '- A metáfora da mão esquerda e direita ensina o mais absoluto desprendimento na realização da generosidade.',
    perguntas_reflexao: [
      'Jesus adverte contra a tentação de fazer o bem apenas para receber admiração e aplausos dos outros. O que motiva suas atitudes de generosidade: o amor sincero ou o desejo de ser notado?',
      'Praticar o bem em segredo exige desapego da vaidade. Como você pode ajudar alguém necessitado esta semana de forma completamente discreta e anônima?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A caridade desprovida de amor sincero se torna apenas um palanque de exibição para a própria **vaidade**.\n' +
      '- Jesus repreende o costume hipócrita de transformar o auxílio ao necessitado em espetáculo **público**.\n' +
      '- Quem busca unicamente os aplausos humanos já esgotou toda a sua recompensa no elogio **passageiro**.\n' +
      '- A verdadeira generosidade cristã se manifesta no silêncio e no sigilo de quem não procura **autopromoção**.\n' +
      '- O segredo da mão esquerda e direita lembra que o bem deve ser feito com naturalidade e sem **alarde**.\n' +
      '- O Pai celestial contempla o que é realizado no escondido e valoriza a sinceridade da nossa **intenção**.\n' +
      '- O socorro ao próximo atinge seu valor mais puro quando preserva a dignidade de quem recebe a **ajuda**.\n\n' +
      'Mensagens a levar\n' +
      '- As atitudes mais preciosas perante Deus são aquelas feitas no anonimato e longe dos **holofotes**.\n' +
      '- Ajudar a quem precisa não deve ser motivo de orgulho, mas um gesto de gratidão ao Criador da **vida**.\n' +
      '- A aprovação do Senhor vale infinitamente mais do que todos os aplausos efêmeros deste **mundo**.\n' +
      '- Servir com discrição protege o coração contra a armadilha da hipocrisia e do orgulho **religioso**.\n' +
      '- O amor autêntico encontra sua maior satisfação em fazer o bem, sem se preocupar em colher **elogios**.',
  },
  1619: {
    ordem: 1619,
    titulo_pericope_pt: 'Como falar com Deus e a Oração do Pai Nosso',
    contexto_historico_literario:
      'Nos tempos bíblicos, muitos indivíduos costumavam orar em pé nas esquinas de maior tráfego e nas portas das sinagogas para serem vistos como pessoas muito piedosas perante a multidão. Além disso, entre as religiões dos povos pagãos vizinhos, prevalecia a crença de que as divindades precisavam ser convencidas por encantamentos mágicos, ladainhas longas e repetições mecânicas de palavras.\n\n' +
      'Nesse ambiente saturado de teatralidade e fórmulas supersticiosas, os discípulos sentiam a necessidade de aprender a orar com genuína intimidade espiritual. É para responder a essa busca honesta que Jesus ensina como se aproximar do Criador com verdade e simplicidade.',
    resenha:
      'Jesus desconstrói a oração como encenação pública e orienta cada seguidor a entrar no seu quarto mais reservado, fechar a porta e conversar em silêncio com o Pai que contempla o segredo. Ele adverte que Deus já conhece todas as nossas carências antes mesmo de pronunciarmos qualquer palavra, dispensando o uso de repetições vazias e discursos cansativos que pretendem manipular a bondade divina.\n\n' +
      'O Mestre entrega então a oração do Pai Nosso como o padrão supremo de diálogo espiritual: santificar o nome sagrado de Deus, desejar a vinda de seu Reino de justiça, confiar na provisão do pão diário e pedir perdão pelas faltas na mesma medida em que perdoamos a quem nos ofendeu. O ensinamento conclui com um alerta decisivo sobre o perdão: a nossa comunhão com Deus e o recebimento de sua graça dependem diretamente da nossa disposição sincera de perdoar os erros do nosso próximo.\n\n' +
      '- O quarto secreto representava o cômodo interno e reservado onde a pessoa encontrava silêncio e recolhimento.\n' +
      '- O pão de cada dia apontava para a confiança tranquila na provisão divina cotidiana, sem o tormento da ansiedade futura.\n' +
      '- Perdoar as ofensas dos semelhantes é a marca essencial de quem compreendeu e experimentou a compaixão de Deus.',
    perguntas_reflexao: [
      'Jesus nos convida a entrar no quarto e conversar com Deus em segredo, sem máscaras ou discursos ensaiados. Como está a sua rotina de oração sincera e íntima no silêncio do seu dia?',
      'A oração do Pai Nosso nos ensina a pedir perdão na mesma proporção em que perdoamos aos outros. Há alguma mágoa que você precisa liberar hoje para experimentar a paz do perdão de Deus?',
    ],
    topicos_pregar:
      'Linha de raciocínio\n' +
      '- A oração verdadeira é desmascarada como intimidade filial e não como exibição para o olhar das **pessoas**.\n' +
      '- Entrar no quarto secreto e fechar a porta simboliza o recolhimento sincero da alma perante o **Pai**.\n' +
      '- Deus já conhece as nossas necessidades reais, tornando inúteis as repetições mecânicas de **palavras**.\n' +
      '- A oração modelo começa com a exaltação do nome santo e com a busca prioritária do seu **Reino**.\n' +
      '- O pedido do pão diário ensina a dependência humilde e serena da provisão contínua de cada **manhã**.\n' +
      '- O perdão das nossas dívidas anda de mãos dadas com a libertação graciosa de quem nos **ofendeu**.\n' +
      '- A proteção contra as tentações confirma a nossa fragilidade e a necessidade do auxílio do **Espírito**.\n\n' +
      'Mensagens a levar\n' +
      '- Falar com Deus não exige fórmulas difíceis, mas um coração aberto, humilde e desprovido de **máscaras**.\n' +
      '- O silêncio do quarto secreto é o solo sagrado onde a alma encontra cura, direção e profunda **paz**.\n' +
      '- Confiar na provisão de Deus para o dia de hoje nos livra do veneno paralisante da **ansiedade**.\n' +
      '- Estender o perdão aos outros é a chave indispensável para desfrutarmos da misericórdia do **Criador**.\n' +
      '- O Pai Nosso nos ensina que não caminhamos sozinhos, mas somos parte de uma mesma e bendita **família**.',
  },
}


export function testarValidações() {
  console.log('Iniciando validação editorial de todas as 20 perícopes revisadas (1600 a 1619)...')
  let erros = 0
  for (let ordem = 1600; ordem <= 1619; ordem++) {
    const rev = REVISOES[ordem]
    if (!rev) {
      console.error(`❌ Faltando revisão para a ordem ${ordem}`)
      erros++
      continue
    }
    const original = JSON.parse(
      readFileSync(join(root, 'data', 'enriched', `${ordem}.json`), 'utf8'),
    )
    const material: Material = {
      ordem: rev.ordem,
      titulo_pericope_pt: rev.titulo_pericope_pt,
      contexto_historico_literario: rev.contexto_historico_literario,
      resenha: rev.resenha,
      perguntas_reflexao: rev.perguntas_reflexao,
      topicos_pregar: rev.topicos_pregar,
    }
    const val = validarMaterial(
      { texto: original.texto, livro: original.livro },
      material,
      JSON.stringify(material),
    )
    if (val.problemas.length > 0) {
      console.error(`❌ Erro na ordem ${ordem}:`, val.problemas)
      erros++
    } else {
      console.log(`✅ Ordem ${ordem} aprovada com 0 problemas!`, val.avisos.length ? `(Avisos: ${val.avisos.length})` : '')
    }
  }

  if (erros > 0) {
    console.error(`\nTotal de erros: ${erros}`)
    process.exit(1)
  } else {
    console.log('\n🎉 Todas as 20 perícopes foram aprovadas com 100% de sucesso no validador!')
  }
}

export function aplicarRevisões() {
  console.log('Aplicando revisões nos arquivos data/enriched/{ordem}.json...')
  for (let ordem = 1600; ordem <= 1619; ordem++) {
    const rev = REVISOES[ordem]
    const arq = join(root, 'data', 'enriched', `${ordem}.json`)
    const original = JSON.parse(readFileSync(arq, 'utf8'))

    original.titulo_pericope_pt = rev.titulo_pericope_pt
    original.contexto_historico_literario = rev.contexto_historico_literario
    original.resenha = rev.resenha
    original.perguntas_reflexao = rev.perguntas_reflexao
    original.topicos_pregar = rev.topicos_pregar

    writeFileSync(arq, JSON.stringify(original, null, 2) + '\n', 'utf8')
    console.log(`Atualizado: ${arq}`)
  }
  console.log('✅ Todas as 20 perícopes foram atualizadas em data/enriched!')

  const catPath = join(root, 'data', 'pericopes.json')
  if (existsSync(catPath)) {
    const cat = JSON.parse(readFileSync(catPath, 'utf8'))
    let count = 0
    for (const p of cat) {
      if (REVISOES[p.ordem]) {
        const rev = REVISOES[p.ordem]
        p.titulo_pericope_pt = rev.titulo_pericope_pt
        p.contexto_historico_literario = rev.contexto_historico_literario
        p.resenha = rev.resenha
        p.perguntas_reflexao = rev.perguntas_reflexao
        p.topicos_pregar = rev.topicos_pregar
        count++
      }
    }
    writeFileSync(catPath, JSON.stringify(cat, null, 2) + '\n', 'utf8')
    console.log(`✅ Catálogo data/pericopes.json atualizado (${count} perícopes modificadas)!`)
  }
}

export function atualizarRoteiroJsonl() {
  const roteiroPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
  if (!existsSync(roteiroPath)) {
    console.warn(`roteiro.jsonl não encontrado em ${roteiroPath}`)
    return
  }

  // Backup se não existir
  const backupPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl.bak'
  if (!existsSync(backupPath)) {
    writeFileSync(backupPath, readFileSync(roteiroPath, 'utf8'), 'utf8')
    console.log(`Backup salvo em ${backupPath}`)
  }

  const linhas = readFileSync(roteiroPath, 'utf8').split('\n')
  const unidadesPorOrdem = new Map<number, any[]>()
  for (const l of linhas) {
    if (!l.trim()) continue
    const u = JSON.parse(l)
    if (!unidadesPorOrdem.has(u.ordem)) unidadesPorOrdem.set(u.ordem, [])
    unidadesPorOrdem.get(u.ordem)!.push(u)
  }

  let atualizadas = 0
  for (const ordem of Object.keys(REVISOES).map(Number)) {
    const rev = REVISOES[ordem]
    const originais = unidadesPorOrdem.get(ordem)
    if (!originais || originais.length === 0) continue

    const livro = originais[0].livro
    const refUnidade = originais.find((u) => u.secao === 'titulo' && u.i === 1)
    const textoRef = refUnidade ? refUnidade.texto : `${livro}.`

    const versiculosTexto = originais.filter((u) => u.secao === 'texto')
    const novasUnidades: { secao: string; texto: string }[] = []

    // 1. Título e Referência
    novasUnidades.push({ secao: 'titulo', texto: `${rev.titulo_pericope_pt}.` })
    novasUnidades.push({ secao: 'titulo', texto: textoRef })

    // 2. Contexto
    novasUnidades.push({ secao: 'contexto', texto: 'Contexto.' })
    const ctxParas = rev.contexto_historico_literario.split('\n\n').map((p) => p.trim()).filter(Boolean)
    for (const cp of ctxParas) {
      novasUnidades.push({ secao: 'contexto', texto: cp })
    }

    // 3. Texto Bíblico
    for (const vt of versiculosTexto) {
      novasUnidades.push({ secao: 'texto', texto: vt.texto })
    }

    // 4. Resenha
    novasUnidades.push({ secao: 'resenha', texto: 'Resenha.' })
    const blocos = blocosDaResenha(rev.resenha)
    const prosa = blocos.filter((b) => b.tipo === 'prosa')
    const palavras = blocos.filter((b) => b.tipo === 'palavra')
    for (const pr of prosa) {
      novasUnidades.push({ secao: 'resenha', texto: pr.texto })
    }

    // 5. Palavras
    if (palavras.length > 0) {
      novasUnidades.push({ secao: 'palavras', texto: 'As palavras do trecho.' })
      for (const pal of palavras) {
        novasUnidades.push({ secao: 'palavras', texto: pal.texto })
      }
    }

    // 6. Reflexões
    novasUnidades.push({ secao: 'reflexoes', texto: 'Reflexões.' })
    novasUnidades.push({ secao: 'reflexoes', texto: `Reflexão 1. ${rev.perguntas_reflexao[0]}` })
    novasUnidades.push({ secao: 'reflexoes', texto: `Reflexão 2. ${rev.perguntas_reflexao[1]}` })

    const n_unid = novasUnidades.length
    const formatadas = novasUnidades.map((nu, idx) => ({
      ordem,
      livro,
      i: idx,
      secao: nu.secao,
      texto: nu.texto,
      n_unid,
    }))

    unidadesPorOrdem.set(ordem, formatadas)
    atualizadas++
  }

  const linhasFinais: string[] = []
  const todasOrdens = [...unidadesPorOrdem.keys()].sort((a, b) => a - b)
  for (const o of todasOrdens) {
    for (const u of unidadesPorOrdem.get(o)!) {
      linhasFinais.push(JSON.stringify(u))
    }
  }

  writeFileSync(roteiroPath, linhasFinais.join('\n') + '\n', 'utf8')
  console.log(`✅ ${atualizadas} perícopes atualizadas com sucesso em roteiro.jsonl!`)
}

if (process.argv.includes('--aplicar')) {
  testarValidações()
  aplicarRevisões()
  atualizarRoteiroJsonl()
} else if (process.argv.includes('--roteiro')) {
  atualizarRoteiroJsonl()
} else if (process.argv.includes('--testar')) {
  testarValidações()
}
