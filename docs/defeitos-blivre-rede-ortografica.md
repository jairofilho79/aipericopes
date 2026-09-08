# Defeitos da Bíblia Livre — a terceira rede, ortográfica

> **O que esta rede é.** A Sessão 2 varreu por **razão de comprimento** contra
> Almeida 1911 e KJV, e achou frase omitida e versículo truncado. A Sessão 3
> **leu** o texto, perícope a perícope, e achou o que incomoda um leitor. Esta é
> a terceira: procura **sequência de letras improvável em português**,
> independente de sentido. Ela acha o que ninguém lê, porque o olho corrige
> sozinho.
>
> **Varrido:** 31.102 versículos, 2.823 perícopes, 3.903.240 caracteres —
> `public/data/texto/*.json`, ou seja o texto **já com as 421 correções da
> Sessão 3 aplicadas**. Nenhum achado aqui repete o catálogo anterior; foi
> conferido rodando os defeitos conhecidos contra o texto servido (`Êx 19:4` já
> diz *águias*, `Lc 14:11` já diz *será humilhado*).
>
> **Achado:** 156 defeitos em 145 versículos e 119 perícopes, mais 7 casos sem
> receita e 13 famílias descartadas.
>
> **NÃO APLICADO.** Isto é catálogo. A aplicação é decisão do dono e passa por
> `scripts/blivre-correcoes.ts`, como as 421 anteriores.

## O achado que manda no resto: 1 Crônicas

| livro | defeitos | versículos | 1 defeito a cada |
|---|---|---|---|
| **1 Crônicas** | **49** | 942 | **19** |
| 2 Crônicas | 9 | 822 | 91 |
| Marcos | 7 | 678 | 97 |
| Jó | 8 | 1.070 | 134 |
| Ezequiel | 8 | 1.273 | 159 |
| **corpus inteiro** | **156** | **31.102** | **199** |

1 Crônicas tem **dez vezes** a densidade de defeito do corpus, e sozinho
responde por 31% de tudo o que esta rede achou. É o mesmo formato do achado da
Sessão 3 sobre Lucas — e a lição se repete e se amplia: **a qualidade da Bíblia
Livre não é uniforme entre os livros**, e agora sabemos que a irregularidade
não é só do Novo Testamento.

Dentro de 1 Crônicas o defeito também não é uniforme. Trinta e um dos 49 são a
mesma coisa — `a o` por `ao` — e se concentram nos **capítulos 15 a 29**, a
seção de Davi organizando o culto. Os capítulos 1—14, que são genealogia pura,
quase não têm. Parece um trecho que passou por uma etapa de edição diferente do
resto do livro, e é onde vale olhar antes de narrar.

---

## 1. Letra trocada, transposta ou faltando (51 versículos)

A classe mais numerosa e a mais grave, porque nenhuma varredura de comprimento
a alcança e o olho de quem lê a corrige sozinho. **Todos são hapax** — uma
única ocorrência no corpus inteiro —, e em quase todos a forma correta aparece
dezenas ou centenas de vezes na própria Bíblia Livre.

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| 1Cr 2:19 | Calebe **tmou** por mulher | A11 "Caleb tomou para si" · KJV "Caleb took" | **tomou** (376× no corpus) |
| 1Cr 5:20 | foram **enregues** em suas mãos | A11 "foram entregues" · KJV "were delivered" | **entregues** |
| 1Cr 19:11 | que os **pôes** em formação | A11 "pozeram-se em ordem" · KJV "set themselves in array" | **pôs** (393×) |
| 1Cr 24:10 | A **sétiam** por Coz | A11 "A setima a Hakkos" · KJV "The seventh" | **sétima** |
| 1Cr 24:15 | a décima **outiva** por Hapises | A11 "decima oitava" · KJV "the eighteenth" | **oitava** |
| 1Rs 8:37 | Quando nesta **herra** houver fome | A11 "fome na terra" · KJV "in the land famine" | **terra** (2.989×) |
| 1Rs 8:50 | dos que os **teem** cativos | A11 "que os teem captivos" · KJV "carried them captive" | **têm** |
| 1Rs 13:34 | cortada e **desraigada** | A11 "destruil-a e extinguil-a" · KJV "cut it off, and destroy" | **desarraigada** |
| 2Cr 36:10 | com os **utensílos** preciosos | A11 "os mais preciosos vasos" · KJV "the goodly vessels" | **utensílios** (64×) |
| Ec 5:11 | os que os **cosomem** | A11 "os que a comem" · KJV "that eat them" | **consomem** |
| Ec 8:13 | não tem temor **diane** de Deus | A11 "não teme diante de Deus" · KJV "feareth not before God" | **diante** (1.589×) |
| Êx 36:10 | uma com **aa** outra | A11 "ligou uma com outra" · KJV "coupled one unto another" | **a** |
| Ez 17:23 | e se **tronará** um cedro | A11 "se fará um cedro excellente" · KJV "be a goodly cedar" | **tornará** (31×) |
| Ez 35:13 | Assim vos **engradecestes** | A11 "vos engrandecestes contra mim" · KJV "ye have boasted" | **engrandecestes** |
| Ez 39:27 | Quando eu **trouxé-los** de volta | A11 "Quando eu os tornar a trazer" · KJV "When I have brought them again" | **os trouxer** |
| Gn 49:8 | Tua mão **esterá** sobre o pescoço | A11 "a tua mão será" · KJV "thy hand shall be" | **estará** (89×) |
| Is 59:17 | ele se **vestu** de justiça | A11 "se vestiu de justiça" · KJV "he put on righteousness" | **vestiu** |
| **Is 66:3** | oferece sangue de **proco** | A11 "sangue de **porco**" · KJV "**swine's** blood" | **porco** |
| Jr 13:26 | **Asim** também eu descobrirei | A11 "Assim tambem eu descobrirei" · KJV "Therefore will I discover" | **Assim** (2.005×) |
| Jr 23:33 | te **peguntar**, dizendo | A11 "te perguntar este povo" · KJV "shall ask thee" | **perguntar** (28×) |
| Jr 29:14 | e vos **restauarei** | A11 "farei tornar os vossos captivos" · KJV "I will turn away your captivity" | **restaurarei** (15×) |
| **Jr 29:19** | enviar; **próem** não escutastes | A11 "**porém** vós não escutastes" · KJV "**but** ye would not hear" | **porém** (1.147×) |
| Jr 36:10 | no **pático** de cima | A11 "no atrio superior" · KJV "in the higher court" | **pátio** (76×) |
| Jr 39:5 | nas **plancíes** de Jericó | A11 "nas campinas de Jericó" · KJV "in the plains of Jericho" | **planícies** (22×) |
| Jr 47:3 | o tremor de suas **caruagens** | A11 "o arroido de seus carros" · KJV "the rushing of his chariots" | **carruagens** (40×) |
| Jó 15:30 | de sua boca **desparecerá** | A11 "da sua bocca desapparecerá" · KJV "shall he go away" | **desaparecerá** |
| Jó 17:1 | a sepultura já **etá** pronta | A11 "tenho perante mim as sepulturas" · KJV "the graves are ready" | **está** (1.320×) |
| Jó 20:16 | Veneno de cobras **subará** | A11 "Veneno d'aspides **sorverá**" · KJV "He shall **suck** the poison" | **sugará** |
| Jó 20:18 | da riqueza de seu **comério** | A11 "conforme ao poder de sua mudança" · KJV "according to his substance" | **comércio** (16×) |
| Jó 20:23 | enchendo seu **vendre** | A11 "encher o seu **ventre**" · KJV "to fill his **belly**" | **ventre** (100×) |
| Jó 34:25 | de noite os **trastorna** | A11 "de noite os **transtorna**" · KJV "overturneth them in the night" | **transtorna** |
| Js 19:9 | era **escessiva** para eles | A11 "demasiadamente grande" · KJV "was too much for them" | **excessiva** |
| Jz 13:24 | E o menino **creceu** | A11 "e o menino **cresceu**" · KJV "the child grew" | **cresceu** (18×) |
| Mc 3:21 | "Ele **stá** fora de si" | A11 "Está fóra de si" · KJV "He is beside himself" | **está** |
| Mc 7:13 | Assim **invalidaias** a palavra | A11 "Invalidando assim a palavra" · KJV "Making the word of God of none effect" | **invalidais** |
| Mc 9:3 | ficaram **resplandescentes** | A11 "tornaram-se resplandecentes" · KJV "became shining" | **resplandecentes** |
| Êx 34:30 · 34:35 | rosto era **resplandescente** | A11 "do seu rosto resplandecia" · KJV "the skin of his face shone" | **resplandecente** |
| Mc 10:52 | E logo **consegiu** ver | A11 "E logo viu" · KJV "he received his sight" | **conseguiu** |
| Mt 18:33 | do **sevo** colega teu | A11 "do teu companheiro" · KJV "thy fellow **servant**" | **servo** (465×) |
| Mt 27:27 | toda a unidade **miltar** | A11 "toda a cohorte" · KJV "the whole band of soldiers" | **militar** |
| Ne 13:15 | pisavam nas **presnas** de uvas | A11 "os que pisavam lagares" · KJV "treading wine **presses**" | **prensas** (6×) |
| Nm 22:17 | **almaldiçoa** para mim | A11 "**amaldiçoa**-me este povo" · KJV "curse me this people" | **amaldiçoa** (11×) |
| Pv 16:22 | para **queles** que o possuem | A11 "para **aquelles** que o possuem" · KJV "unto him that hath it" | **aqueles** (172×) |
| Sf 3:20 | quando eu vos **resutaurar** | A11 "quando reconduzir os vossos captivos" · KJV "when I turn back your captivity" | **restaurar** |
| Zc 1:6 | e nossos **antos** | A11 "segundo as nossas **obras**" · KJV "according to our **doings**" | **atos** (25×) |
| Lv 13:38 · 13:39 · 14:37 | **machas** brancas | A11 "empolas brancas" / "manchas verdes" · KJV "bright spots" | **manchas** |
| Am 9:3 | ali **mandia** uma serpente | A11 "ali **darei ordem** á serpente" · KJV "will I **command** the serpent" | **mandarei** (12×) |
| 1Cr 2:7 | separado por **maldiçãos** | A11 "peccou no anathema" · KJV "in the thing accursed" | **maldição** (69×) |

**Os três que mudam o sentido, e por que só esta rede os pega.**

`Is 66:3` — "quem apresenta oferta, oferece sangue de **proco**". Duas letras
trocadas de lugar, e o versículo perde o alvo: é *porco*, o animal impuro, que
faz da oferta uma abominação. Sem *porco* a frase não diz nada. As duas
testemunhas trazem a palavra (A11 "sangue de porco", KJV "swine's blood") e a
BLIVRE escreve `porco` corretamente em cinco outros versículos.

`Jr 29:19` — **`próem`**. É a lição mais importante deste catálogo, e foi ela
que definiu a rede. `próem` **tem vogal**, então nenhuma varredura de "token sem
vogal" o acha; tem cinco letras, então nenhuma varredura de token curto o acha;
está no meio de uma frase gramatical, então nenhuma leitura apressada o acha.
Só apareceu porque é *hapax* e tem, a distância de edição 1, uma palavra que a
BLIVRE escreve **1.147 vezes**. Essa é a rede que produziu 51 dos 156 achados.

`Jó 20:16` — "Veneno de cobras **subará**". A11 diz *sorverá*, KJV diz *suck*.
`subará` não existe; o verbo é *sugar*. O versículo, como está, não tem
predicado que faça sentido.

## 2. O bloco `a o` de 1 Crônicas (34 versículos) — contração desfeita

`a o SENHOR` por `ao SENHOR`, `a os filhos` por `aos filhos`. Trinta e um dos
trinta e cinco estão em **1 Crônicas 15—29**, e a Almeida 1911 traz `ao Senhor`
limpo em todos eles: é dano da modernização, não herança.

1Cr 15:11 · 16:34 · 16:40 · 16:41 · 16:42 · 17:5 · 17:6 · 18:11 · 21:2 · 21:7 ·
21:18 · 21:22 · 21:26 *(2×)* · 22:5 · 22:6 · 22:11 · 22:14 · 22:19 · 23:2 ·
23:5 · 23:6 · 23:30 · 23:31 · 25:1 · 25:3 · 26:21 · 29:5 · 29:9 · 29:10 · 29:25

E fora de 1 Crônicas: 1Sm 15:9 · 2Cr 30:18 · Ez 18:17 · Js 24:15.

**Quatro casos da mesma varredura NÃO viram `ao`,** e é aí que a rede podia ter
estragado versículo:

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Lv 22:28 | não degolareis em um dia **a o** e a seu filho | A11 "**a elle** e a seu filho" · KJV "kill **it** and her young" | **a ele** |
| Nm 21:34 | em tua mão o dei, **a o** e a todo seu povo | A11 "**a elle**, e a todo o seu povo" · KJV "delivered **him** into thy hand" | **a ele** |
| 2Rs 2:7 | pararam-se em frente **a o** longe | A11 "de longe pararam defronte" · KJV "stood to view afar off" | **em frente, ao longe** |
| Rt 3:2 | ele aventa esta noite **a os** grãos | A11 "padejará **a cevada**" · KJV "he winnoweth **barley**" | **os grãos** *(sem preposição)* |

Em Lv 22:28 e Nm 21:34 o `o` não é artigo: é o pronome `ele` mutilado. Trocar
por `ao` teria deixado a frase sem objeto — "não degolareis ao e a seu filho".

## 3. Outras contrações desfeitas (16 versículos)

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Pv 10:17 | é **d aquele** que guarda | A11 "é d'aquelle que guarda" | **daquele** |
| Is 5:23 | Ai **d os** que inocentam | A11 "Dos que justificam ao impio" | **dos** |
| Mc 6:11 | será **a os** de Sodoma … do que **a os d aquela** cidade | A11 "para os d'aquella cidade" | **aos** … **aos daquela** |
| Ag 2:18 | desde o dia **em o** fundamento… foi posto | A11 "desde o dia **em que** se fundou o templo" · KJV "from the day **that** the foundation was laid" | **em que o** |
| 1Cr 21:26 | **em o** que ofereceu … **em o** altar | A11 "offereceu n'elle" / "sobre o altar" | **em que** · **no altar** |
| 2Cr 9:12 | mais **de o** que havia trazido | A11 "alem do que ella mesma trouxera" | **do que** |
| Êx 38:15 | cortinas **de a** quinze côvados | A11 "cortinas **de** quinze covados" · KJV "hangings **of** fifteen cubits" | **de quinze côvados** |
| Ez 40:29 | e **de a** largura de vinte e cinco | A11 "**e a largura** de vinte e cinco covados" | **e a largura** |
| 1Cr 23:11 · 2Cr 18:2 · 2Cr 18:34 · 2Cr 22:1 | **por o** qual / **por o** que | A11 "pelo que foram contados" | **pelo** |
| 1Cr 23:31 | **por a** conta e forma | A11 "por conta, segundo o seu costume" | **pela** |
| Is 57:18 | consolo, a ele **a os** que por ele lamentam | A11 "a saber, aos seus pranteadores" · KJV "unto him **and to** his mourners" | **e aos** *(confiança média)* |
| Pv 24:18 | não aconteça **de o SENHOR veja** | A11 "Para que o Senhor o não veja" · KJV "Lest the LORD see it" | **de o SENHOR ver** *(média)* |
| Hc 1:4 | o perverso cerca o justo, **por o** juízo é distorcido | A11 "e sae a sentença torcida" · KJV "therefore wrong judgment proceedeth" | **por isso o** *(média)* |

**A armadilha desta família, e como escapei dela.** De 21 ocorrências de `de` +
artigo no corpus, **18 são português correto** — o infinitivo pessoal clássico:
"a fim de o acusarem", "depois de os despedir", "cansado de as suportar",
"digno de o ler", "a ponto de o matarem". O que separa as três defeituosas das
dezoito legítimas não é a forma: é que nas três **não há infinitivo nenhum
depois**. Uma regra sobre `de o` teria estragado dezoito versículos para
consertar três.

## 4. Grafia espanhola (12 versículos)

A família que o catálogo da Sessão 3 abriu com `preguntar` continua, e é maior
do que parecia. Todas as doze são hapax.

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Gn 26:29 | não te tocamos, **y** como | A11 "**e** como te fizemos sómente bem" | **e** — *o mesmo versículo já usa "e"* |
| Gn 46:17 | Isva, e Isvi **y** Berias | A11 "e Ischvi, **e** Beria" | **e** |
| Gn 47:27 | apossaram-se nela, **y** se aumentaram | A11 "tomaram possessão, **e** fructificaram" | **e** |
| 2Cr 6:20 | que **oigas** a oração | A11 "para **ouvires** a oração" · KJV "to hearken" | **ouças** (10×) |
| 2Rs 9:27 | E **siguiu**-o Jeú | A11 "Jehu **seguiu** após elle" | **seguiu** (35×) |
| 2Rs 23:26 | se havia **encendido** sua ira | A11 "com que **ardia** a sua ira" · KJV "was kindled" | **acendido** |
| 2Sm 7:12 | eu **establecerei** tua semente | A11 "**estabelecerei** o seu reino" | **estabelecerei** (7×) |
| 2Sm 13:15 | de tão grande **aborrecimiento** | A11 "grandissimo **aborrecimento**" | **aborrecimento** |
| Ez 38:20 | andam se **arrastrando** | A11 "reptis que se **arrastam**" | **arrastando** (16×) |
| Gn 17:17 | Abraão **postrou**-se | A11 "caiu Abrahão sobre o seu rosto" · KJV "fell upon his face" | **prostrou** |
| 1Rs 19:6 | cozida sobre as **ascuas** | A11 "cozido sobre as **brazas**" · KJV "baked on the **coals**" | **brasas** (24×) |
| Jz 14:12 | trinta **sábanas** | A11 "trinta **lençoes**" · KJV "thirty **sheets**" | **lençóis** (4×) |

`ascuas` e `sábanas` são as duas mais graves da família, porque não são grafia
espanhola de uma palavra portuguesa: são **palavras espanholas inteiras**
(*ascuas* = brasas, *sábanas* = lençóis) que ficaram no texto. Quem ouvir a
narração não vai entender nada em Jz 14:12.

## 5. Espaço perdido ou sobrando (10 versículos)

| ref | o app serve | deveria servir |
|---|---|---|
| Gn 17:17 | de cem anos **nasceráfilho**? | nascerá filho |
| Ec 5:8 | outros que **têmautoridade** | têm autoridade |
| Mc 1:22 | como quem **temautoridade** | tem autoridade |
| Mt 3:10 | E agora **mesmoo** machado | mesmo o machado |
| Mt 10:3 | Lebeu, por **sobrenomeTadeu** | sobrenome Tadeu |
| Jz 2:18 | arrependia pelo **gemideles** | gemido deles |
| Lv 20:19 | levarão **sobresi** a sua perversidade | sobre si |
| Nm 11:11 | puseste **sobremim** a carga | sobre mim |
| Jó 10:3 | **Parece -te** bem | Parece-te |
| Sl 139:6 | não posso **alcançá -lo** | alcançá-lo |

Os dois últimos são a mesma família de `siga- me` (Lc 9:23) do catálogo
anterior: o hífen enclítico com espaço do lado errado.

`sobrenomeTadeu` é o **único caso de maiúscula dentro de palavra em todo o
corpus** — a varredura rodou em 3,9 milhões de caracteres e achou esse.

## 6. Acento (4 versículos)

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Dt 17:8 · Êx 23:2 | em negócios de **litigio** | A11 "negocios de pendencias" · KJV "matters of controversy" | **litígio** |
| 1Rs 11:23 | o qual havia **fugído** | A11 "que tinha **fugido**" | **fugido** — *acento a mais* (22× sem acento) |
| Ed 6:2 | estava escrito assim: **Memórial** | A11 "estava escripto um **memorial**" | **Memorial** |

A rede de acento da Sessão 3 achou 18 e perdeu estes quatro porque procurava
*acento perdido*; `fugído` tem acento **a mais**, e `litigio`/`Memórial` só
aparecem uma vez cada, sem par acentuado no corpus para denunciá-los. O que os
pegou foi o dicionário: nenhuma das três formas existe em português.

## 7. Pontuação (10 versículos)

**Ponto onde cabe vírgula, e a frase seguinte fica em minúscula (3):**

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| 2Cr 20:15 | e tu, rei Josafá**. o** SENHOR vos diz | A11 "ó rei Josaphat**:** assim o Senhor vos diz" | **Josafá, o SENHOR** |
| Gn 22:7 | disse: Meu pai**. e** ele respondeu | A11 "Meu pae**!** E elle disse" | **Meu pai! E ele** |
| Nm 19:18 | tomará hissopo**. e** o molhará | A11 "tomará hyssopo**,** e o molhará" | **hissopo, e o molhará** |

São as **únicas três** ocorrências de ponto seguido de minúscula em todo o
corpus, e as três abrem oração coordenada. O padrão inverso — ponto colado na
MAIÚSCULA seguinte — já tem regra em `blivre-texto.ts`; este é o caso oposto e
não tem.

**Maiúscula indevida no meio da frase (4):**

`1Sm 30:1` "**E Quando** Davi" · `Êx 29:1` "**E Isto** é o que lhes farás" ·
`Ez 2:1` "**E Disse**-me" · `Jz 10:1` "**E Depois** de Abimeleque". Nos quatro a
Almeida 1911 traz a segunda palavra em minúscula ("E depois de Abimelech", "E
disse-me"). A correção é abaixar a caixa, não tirar o `E`: a KJV traz o `And`.

**Sinal de pontuação sobrando ou invertido (3):**

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Ez 46:3 | nos sábados e nas luas novas**,.** | A11 "nas luas novas, diante do Senhor." | **novas.** |
| Mc 6:11 | em testemunho contra eles **Em** verdade vos digo | A11 "para com elles**.** Em verdade vos digo" · KJV "against them**.** Verily I say" | **eles. Em verdade** |
| Mt 25:20 | e disse: **”**Senhor, cinco talentos | aspa de fechamento usada para abrir | **"Senhor** |

Mc 6:11 é o único versículo do corpus que acumula **três** defeitos desta rede
ao mesmo tempo: o ponto sumido, `a os` duas vezes e `d aquela`.

## 8. Artigo indevido (8 achados em 6 versículos) — todos em Crônicas

**No vocativo (4).** `ó o SENHOR` contra `ó SENHOR`, que a BLIVRE escreve **59
vezes**. Vocativo não leva artigo, e as duas testemunhas confirmam ("ó Senhor",
"O LORD"): 1Cr 17:17 · 1Cr 29:10 · 1Cr 29:11 *(2×)*.

**Na aposição (3).** `o Deus o SENHOR` contra `o SENHOR Deus` das duas
testemunhas: 1Cr 22:19 · 1Cr 28:20 · 2Cr 32:16.

**Concordância de número (1).** `1Cr 22:19`, "e **o santos** vasos de Deus" —
A11 "e **os** vasos sagrados de Deus", KJV "and the holy vessels". O mesmo
versículo carrega três defeitos desta rede.

## 9. Palavra truncada, repetida e resíduo de edição (4 versículos)

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Js 6:13 | andando e tocando **l**. | A11 "tocando as **buzinas**" · KJV "blowing with the **trumpets**" | **as trombetas** — *o mesmo versículo já traz "tocando as trombetas"* |
| Ne 5:17 | dentre as **ns** nações | A11 "d'entre as gentes" · KJV "from among the heathen" | **as nações** |
| Jó 15:13 | deixes sair **tais tais** palavras | A11 "deixares sair **taes** palavras" · KJV "such words" | **tais palavras** |
| 1Cr 6:57 | **Jathir** e Estemoa | A11 "e **Jattir**" · KJV "and **Jattir**" | **Jatir** |

`Jathir` merece nota: é o **único `th` em 3,9 milhões de caracteres**, e a mesma
cidade aparece grafada `Jatir` nos outros dois lugares em que o corpus a
menciona (Js 15:48, Js 21:14). É resíduo da ortografia antiga que escapou da
modernização.

---

## Sem receita, aguardando conferência (7)

Achados que a rede levantou e que **as duas testemunhas não fecham**. Vão
registrados, não corrigidos.

**As 30 aspas que nunca fecham.** O corpus tem 508 `"` de abertura contra 478
de fechamento. Vinte das trinta estão em **Apocalipse 1—3**, as cartas às sete
igrejas, onde cada carta é uma perícope e a citação abre sem fechar. O resto:
Gn 3, Gn 28, Js 3—4, Jz 2, 1Sm 2, Mt 5, Mt 21, Mt 22, Mt 25, Mc 14, Lc 3, Lc 10.
Duas fecham sem ter aberto (Ap 3:22 e Ap 17:14), e nesses dois casos a aspa foi
aberta na **perícope anterior** — ou seja, a citação atravessa o corte, e
consertar uma ponta sem a outra piora. **Não é cosmético:** o catálogo da Sessão
3 registra que o app usa aspa para decidir o que é fala de personagem, e a
narração vai ler isso.

| ref | trecho | por que fica sem receita |
|---|---|---|
| Tg 3:7 | é **dominível** e tem sido dominada | A palavra não existe e é hapax, mas as testemunhas põem **verbo** onde a BLIVRE pôs adjetivo (A11 "se amansa", KJV "is tamed"). `domável` é palpite. |
| Tg 4:5 | O Espírito que habita em nós **ansia** | Pode ser `ânsia` (substantivo) ou `anseia` (verbo). A11 traz substantivo ("tem desejo de inveja"), KJV traz verbo ("lusteth"). As testemunhas se contradizem sobre a classe da palavra. |
| Jó 41:7 | encher sua pele de **espetos** | A11 "ganchos", KJV "barbed irons". Trocar seria escolher tradução, não corrigir grafia. |
| 25 versículos | **o SENHOR o Deus** de Israel | As duas testemunhas trazem "o Senhor Deus" / "the LORD God", mas 25 ocorrências é frequente demais para ser digitação: parece aposição de casa ("o SENHOR, o Deus de Israel"). Uniformizar é decisão do dono. |

---

## Descartes, com o motivo (13 famílias)

Descartar bem é metade do valor, e esta rede descartou mais do que corrigiu.

**1. As dezesseis formas em `-mo-nos` — o maior falso positivo que quase entrou.**
`vamo-nos`, `alegremo-nos`, `aproximemo-nos`, `prostremo-nos`, `ajoelhemo-nos`,
`façamo-nos`, `esforcemo-nos`, `limpemo-nos`, `partimo-nos`, `passemo-nos`,
`edifiquemo-nos`, `enchamo-nos`, `orgulhamo-nos`, `vejamo-nos`, `vistamo-nos`,
`voltemo-nos`. Parecem `-mos` truncado; são a próclise correta — o `s` cai antes
de `-nos`. Dezesseis formas distintas, **todas português certo**. Se eu tivesse
tratado "token que termina em `-mo`" como defeito, teria estragado dezesseis
versículos.

**2. `a aquele` / `a aqueles` (37 ocorrências).** A fonte escreve `a aquel*` 37
vezes e `àquel*` 28. Já julgado no catálogo da Sessão 3 (Lc 19:27): estilo da
casa, não crase perdida. A rede levantou os 37 de novo e eles continuam
descartados — registro aqui para que a próxima rede não os levante uma terceira
vez.

**3. Os dezoito infinitivos pessoais.** "a fim de o acusarem", "depois de os
despedir", "cansado de as suportar", "digno de o ler", "a ponto de o matarem",
"uma maneira de o matar", "cuidado de as oferecer", "até de os pôr". Português
clássico correto, e a advertência estava certa: só 3 dos 21 casos de `de` +
artigo são defeito.

**4. `por` + artigo + infinitivo (2).** `2Sm 6:8` "por o SENHOR ter ferido a
Uzá" e `Êx 1:21` "por as parteiras terem temido a Deus" são construção causal
clássica — equivalem a "porque o SENHOR feriu" e "porque as parteiras temeram".
Não são `pelo`/`pelas`. Uma regra geral sobre `por o` teria estragado os dois.

**5. `Jr 36:25`, "ele se recusou a os ouvir".** Cai na mesma classe: é
`recusou-se a ouvi-los`. As duas testemunhas confirmam o sentido (A11 "não lhes
deu ouvidos", KJV "would not hear them") e a construção da BLIVRE é correta.

**6. `Jó 1:21`, "Nu saí do ventre de minha mãe".** `Nu` parece palavra
truncada e é o adjetivo — o próprio versículo repete "e nu para lá tornarei".

**7. Os nomes próprios de duas e três letras.** `Sô` (2Rs 17:4, KJV "So"), `Hã`
(Gn 14:5, "Ham"), `Eí` (Gn 46:21, "Ehi"), `Di-Zaabe` (Dt 1:1), `Bete-Le-Afra`
(Mq 1:10), `panague` (Ez 27:17, "Pannag"), `Nô`, `Uz`, `Ur`, `Om`. A rede de
token curto levanta muito nome hebraico, e é o preço dela.

**8. O vocabulário antigo e técnico.** `pavês` (escudo), `relha` (do arado),
`jeira` (medida de área), `arrátel` e `metreta` (medidas), `him` e `logue`
(medidas), `descinge`, `abrolho`, `despelou`, `escarva`, `carniceira`, `corbã`,
`talita cumi`, `mulo`. Não estão no dicionário moderno e estão certos. Vale a
regra de `alambre` no catálogo anterior: **não se corrige, se explica.**

**9. O hífen como travessão.** `Ec 1:2`, `Ec 12:8`, `Is 22:25`, `Lm 1:10` —
"Futilidade das futilidades! - diz o Pregador -". Escolha de composição,
uniforme nos quatro lugares.

**10. A maiúscula do verso.** `2Sm 22:13` "Do resplendor de sua presença **Se**
acenderam brasas", `2Sm 23:4`, `Dt 32:8` e a maioria dos Salmos. A BLIVRE
capitaliza o começo de cada linha poética — convenção da casa, aplicada com
consistência. Foi o que sujou a rede de "maiúscula sem ponto antes" e obrigou a
filtrar por livro poético antes de olhar.

**11. `a cada um um bolo` (1Cr 16:3) e `cada um um cordeiro` (Êx 12:3).** Já
derrubados pela A11 no catálogo da Sessão 3. A rede de palavra repetida os
levantou outra vez; continuam corretos.

**12. `ex-cego` (Jo 9:13).** Só apareceu na lista de tokens curtos porque o
hífen separa `ex`. Palavra composta legítima.

**13. As sequências impossíveis que não existem.** `w`, `k`, `q` sem `u`, `y`
dentro de palavra: **zero ocorrências** em 3,9 milhões de caracteres. Registro o
vazio de propósito — a rede rodou, não achou nada além dos três `y` isolados de
Gênesis, e quem vier depois não precisa repetir a varredura. O mesmo vale para
a numeração: **zero** versículo fora de ordem, repetido ou faltando em 31.102.

---

## O que esta rede AINDA não pega

O valor do preâmbulo do catálogo da Sessão 3 foi dizer onde ele era cego. Aqui
está o mesmo, por quem vier depois.

**1. Palavra real trocada por outra palavra real.** É o buraco maior, e é o
mesmo que a Sessão 3 já apontou com `água`/`águia` e `mal`/`mel`. Uma rede
ortográfica é surda a isso por construção: `mal` está no dicionário, é frequente
e não é hapax. Se `porco` tivesse virado `barco` em vez de `proco`, esta rede
não teria visto nada. **A rede que pega essa classe é cruzar substantivo
concreto da KJV contra o que a BLIVRE traz no mesmo versículo** — o método que o
catálogo anterior descreveu e ainda não foi rodado até o fim.

**2. Defeito herdado da Almeida 1911.** As três buscas independentes que fiz da
1911 levantaram a mesma ressalva, e ela é séria: **a Almeida 1911 é a ancestral
da Bíblia Livre, não uma testemunha independente dela.** Onde as duas concordam,
isso não absolve — pode ser defeito que a BLIVRE herdou intacto. A independência
real vem só da KJV. Um defeito presente nas duas passa por esta rede como se
fosse texto bom. (A digitalização da 1911 tem os seus próprios: `detruiram` em
1Sm 15:9, por exemplo.)

**3. Erro que produz palavra que existe e é comum.** `so`/`seu`, `ma`/`uma` — os
dois que o catálogo da Sessão 3 achou — passariam por aqui **se** fossem
frequentes. A rede de hapax só dispara para palavra que aparece **uma vez**.
Se a mesma corrupção acontecer duas vezes no corpus, ela some do radar.

**4. Concordância e regência.** Rodei a rede de artigo+substantivo e ela deu
2.103 candidatos brutos para **um** achado real (`o santos vasos`). A relação
sinal/ruído é péssima porque `a` é preposição e artigo, e `o`/`a` também são
pronome oblíquo antes de verbo. **Não filtrei isso até o fim, e não recomendo
tentar sem análise morfológica de verdade.** A Sessão 3 achou 13 defeitos de
concordância lendo; esta rede achou 1. Leitura ganha nessa classe.

**5. Ordem de palavras e sintaxe quebrada.** "sem verbo principal", "ordem
trocada", "frase sem predicado" — o catálogo da Sessão 3 tem seis desses só em
Lucas. Nenhum tem defeito ortográfico; a rede passa reto.

**6. Onde a aspa deveria fechar.** Achei as 30 e não sei fechar nenhuma. É
trabalho de leitura, com as duas testemunhas na mão.

**7. Atos, as cartas e o Apocalipse — e o zero que não absolve ninguém.** Dos
156 achados, **143 estão no Antigo Testamento e 13 nos Evangelhos. Em Atos, nas
cartas e no Apocalipse esta rede achou ZERO.** Isso não quer dizer que aquele
trecho esteja limpo. O catálogo da Sessão 3 avisa que **esses livros nunca foram
lidos por ninguém**, e que pela taxa de Lucas e João é razoável esperar mais uma
centena de defeitos ali. O que o zero diz é outra coisa, e é útil: **os defeitos
que restam naquele trecho não são ortográficos**, então não adianta rodar
varredura de letra em cima deles. Só leitura resolve — e a única evidência que
esta rede produziu sobre o Apocalipse foi as 20 aspas que não fecham, que ela
achou contando, não lendo.

**8. O que eu escolhi não fazer.** Não varri o material editorial das perícopes,
só o texto bíblico. Não julguei os 2.103 candidatos brutos de concordância. E
não olhei o `contexto`, a `resenha` nem os `tópicos` — se o material citar o
versículo com o defeito dentro, é o passo do `cacheDesatualizado` que decide, e
esse eu não rodei.

## Como aplicar

O caminho é o mesmo do catálogo anterior e não muda:

1. Levar as correções de `data/defeitos-rede-ortografica.json` para
   `scripts/blivre-correcoes.ts`. Cada achado já traz o par pronto nos campos
   **`de`** e **`para`**, com o `de` conferido: ele existe literalmente no texto
   servido hoje, e a asserção que garante isso roda na geração deste arquivo.
2. Rodar o ETL.
3. `cacheDesatualizado` aponta as perícopes cujo texto mudou — são no máximo
   **119**.
4. Devolver só essas para a fila.

**O custo de citação foi medido, e é uma perícope.** Rodei os 156 trechos
defeituosos contra o material editorial das 119 perícopes tocadas (`contexto`,
`resenha`, `perguntas`, `tópicos` — excluído o campo `texto`, que é cópia do
versículo). **Uma única citação atravessa um defeito:** a perícope **882**
(1Cr 29:9) cita *"com inteiro coração ofereceram a o SENHOR voluntariamente"*
com o `a o` dentro. As outras 118 não precisam ser reescritas.

Duas ressalvas de execução:

- **1Cr 22:19 tem três defeitos no mesmo versículo** (`a o SENHOR`, `do Deus o
  SENHOR`, `o santos vasos`) e `1Cr 21:26` tem quatro. Como as receitas são por
  trecho, a ordem entre elas importa, e o guard de uma pode falhar depois que a
  outra rodar.
- **`Gn 17:17` aparece duas vezes nesta lista** — `postrou` e `nasceráfilho` são
  defeitos independentes no mesmo versículo.

## Placar

**156 defeitos**, em 145 versículos de 31.102 — 1 a cada 199. Distribuídos por
30 livros, mas com **49 em 1 Crônicas sozinho**, um a cada 19 versículos.

E a regra que se confirmou pela terceira vez: **a varredura mecânica levanta o
candidato, e a maioria dos candidatos é falso positivo.** As trinta e sete
ocorrências de `a aquele`, os dezoito infinitivos pessoais e as dezesseis formas
em `-mo-nos` são, juntas, mais numerosas que tudo o que entrou nesta lista.
Nenhuma correção entrou sem as duas testemunhas.

## As receitas (07/09/2026)

Os 156 consertos entraram em `data/pericopes.json` de manhã, e ficaram um dia
inteiro **só ali**. Isso não é conserto: é conserto com prazo de validade. O
texto bíblico que o app serve nasce de um pipeline — `data/bliv-tr_vpl.txt` →
`blivre-para-fonte.ts` → `data/BLIVRE.json` → `etl-pericopes.ts` —, e quem não
está em `scripts/blivre-correcoes.ts` some no próximo `npm run pipeline`, sem
erro, sem log, sem teste vermelho.

**154 receitas em 143 versículos** foram escritas. Faltam duas para os 156, e
elas não estão faltando: `[Parece] -te` (Jó 10:3) e `[alcançá] -lo` (Sl 139:6)
não são defeito de tradução, são espaço em branco em volta do colchete — a mesma
matéria de que `blivre-texto.ts` já cuida em outras cinco regras. Viraram
`HIFEN_ANTES_DO_ESPACO`, com teste.

Três coisas que só apareceram ao escrever as receitas:

1. **A receita roda ANTES de os colchetes saírem.** `corrigirVersiculo` recebe o
   corpo cru do VPL, com a marcação editorial inteira. Isso muda o diagnóstico de
   dez achados. Em Pv 10:17 o texto servido diz `é d aquele que guarda`, e parece
   letra grudada; a fonte escreve `O caminho para a vida [é d] aquele`, e o que
   está errado é o **espaço depois do colchete**. A receita é `[é d]aquele`, e a
   marcação editorial da Bíblia Livre continua de pé.
2. **A janela de contexto do bloco `a o` não serve como receita.** Em 1Cr 21:26 a
   janela de 40 caracteres do relatório engole `em o que`, que é *outra* receita
   do mesmo versículo — a segunda deixaria de casar e o build quebraria. As 35
   entraram com a **menor** janela que ainda seja única no versículo.
3. **Sobram cinco versículos com `a o` que a rede não listou** — Lv 22:28,
   Nm 21:34, Rt 3:2, 2Rs 2:7 e Is 57:18 —, e eles não são o mesmo defeito. Em
   2Rs 2:7 (`em frente a o longe`) e Is 57:18 (`a ele a os que lamentam`) a
   contração resolve; em Lv 22:28 e Nm 21:34 (`a o e a seu filho`) o problema é
   outro e mais fundo. Ficam registrados aqui, não corrigidos.

**A conferência.** `npm run conferir-receitas` roda o pipeline inteiro e compara
os 31.102 versículos com o que o catálogo serve hoje. Hoje dá zero divergências.
Ele não é teste de vitest de propósito: depende do VPL, que é gitignorado, e um
teste que lê arquivo derivado passa aqui e quebra na CI.

## A varredura por corretor ortográfico (08/09/2026)

As redes anteriores eram de **padrões conhecidos** — `a o`, colchete solto, letra
órfã. Padrão só acha o que já se sabe procurar. `alinda` (Is 23:12) parece
palavra, e por isso passou por baixo de todas elas e foi servida por semanas:

    BLIVRE  …levanta-te, passa ao Chipre; e alinda ali não terás descanso.
    KJV     …arise, pass over to Chittim; there also shalt thou have no rest.

**Quem a achou foi o narrador.** Ele não leu a palavra, porque não soube lê-la, e
a nota de verbatim daquela unidade caiu para 0,97. A narração é um detector
ortográfico que nenhuma regex substitui — cada unidade é um leitor competente
passando o olho por uma linha, e o transcrito registra onde ele tropeçou.

**O instrumento.** Corretor ortográfico (`pyspellchecker`, dicionário pt de 416
mil palavras) sobre os 31.102 versículos, com duas peneiras de precisão:

1. palavra válida em **castelhano** e não em português — a Bíblia Livre arrasta o
   espanhol da fonte de onde veio (`aborrecimiento`, `encendido`, `oigas`);
2. palavra a **uma letra** de outra frequente no próprio corpus (`herra`→`terra`,
   `tmou`→`tomou`, `estevem`→`estiveram`).

Sem as peneiras são 1.059 candidatas, quase todas nome próprio. Com elas, 155.
A triagem foi contra a **KJV**, doze subagentes, treze palavras cada.

**O resultado, e a lição.** Das 68 marcadas como defeito pela triagem, **63 já
tinham receita nesta tabela**. Erro de método meu: varri o VPL **cru**, e o VPL
guarda os defeitos de propósito — quem os conserta é `blivre-correcoes.ts`, no
build. Quem repetir isto tem de varrer o texto DEPOIS de `corrigirVersiculo`.

Sobraram **cinco** consertos novos:

| ref | de | para |
|---|---|---|
| 1Cr 19:6 | alugarem carruragens | alugarem carruagens |
| Ne 11:20 | estevem em todas as cidades | estiveram em todas as cidades |
| Is 23:12 | e alinda ali | e ainda ali |
| Ez 42:3 | do solado | do pavimento |
| Tg 4:5 | nós ansia | nós ânsia |

Varrendo de novo o texto **corrigido**, sobram 80 palavras fora do dicionário e
nenhuma é defeito: nome próprio (Sama, Heles, Porata, Ananeus), letra hebraica do
acróstico do Salmo 119 (mem, hê, nun, cofe, rexe) e arcaísmo real da Almeida
(cãs, reses, jeira, mamantes, primícia, vejamo). A varredura está fechada.

**Mudança de regra do dono (08/09/2026):** a testemunha agora é a **KJV sozinha**.
A Almeida 1911 sai — ela não está nesta máquina, e as receitas antigas que a
citam ficam como estão. Vale notar que as cinco perícopes que a sessão anterior
resolveu com A11 (Lv 22:28, Nm 21:34, Rt 3:2, 2Rs 2:7, Is 57:18) foram
reencontradas com as MESMAS emendas partindo só da KJV.
