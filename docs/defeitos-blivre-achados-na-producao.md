# Defeitos da Bíblia Livre achados durante a Sessão 3

> Lista viva. A revisão editorial da Sessão 2 varreu por **razão de comprimento**
> contra Almeida 1911 e KJV, o que acha frase omitida e versículo truncado — mas
> é cega para erro curto: acento perdido, concordância errada, palavra trocada.
> Esses aparecem quando alguém **lê** o texto, e é o que os subagents estão
> fazendo, uma perícope por vez.
>
> **Aplicado em 2026-09-05.** As 484 referências fecharam: 421 viraram receita
> em `scripts/blivre-correcoes.ts`, 52 eram erro de normalização e a ETL as
> desfaz, 7 foram absolvidas pela conferência e 4 esperam decisão do dono. O
> veredito de cada uma das 63 sem receita está na seção do fim.
>
> O custo que a seção "Como aplicar" temia foi medido e é pequeno: das 436
> perícopes cujo texto mudou, **cinco** citavam justamente o trecho corrigido, e
> as cinco se resolveram trocando a citação. O congelamento passou de 1.714 para
> 1.982 perícopes liberadas para narração.

## 1. Acento perdido (18 versículos) — resquício da ortografia de 1911

Achados por varredura: palavra que aparece no corpus com e sem acento, sendo a
forma sem acento rara. Conferidos um a um contra Almeida 1911 e KJV.

`principio`→princípio (Pv 1:7, Ap 22:13) · `Espirito`→Espírito (At 13:2) ·
`arvore`→árvore (Mt 7:17, no mesmo versículo que já traz "boa árvore") ·
`Amem`→Amém (Sl 72:19, colado num "amém" acentuado) · `sairam`→saíram
(Jz 3:19, 1Sm 23:13) · `gloria`→glória (Is 43:7) · `numero`→número (Ap 20:8) ·
`decimo`→décimo (Jr 52:4) · `lideres`→líderes (Jr 25:36) · `dominio`→domínio
(2Tm 3:3) · `ruina`→ruína (2Cr 36:21) · `terrivel`→terrível (Ez 31:12) ·
`ultima`→última (1Co 15:52) · `varias`→várias (Lc 4:40) · `fossemos`→fôssemos
(Gl 3:24) · `salvara`→salvará (Dt 4:42)

**21 candidatos foram descartados pelas duas testemunhas** — e é o valor do
método: `faca` em Pv 23:2 é faca mesmo; `não pecas` em 1Co 7:28 é o verbo;
`tomara que mates` no Sl 139 é a interjeição; `eu me refugio` no Sl 57 é verbo;
`gloria-te` em 2Rs 14:10 é verbo; `orna-te` em Jó 40:10 é verbo; nove são
mais-que-perfeito legítimo (`falara`, `chegara`, `achara`, `florescera`…); e
`Tera`, `Hara`, `Susa`, `Has-Baz` e `Joana` são nomes próprios.

## 2. Corrupção de palavra (3 versículos) — mais grave que acento

| ref | BLIVRE | testemunhas | correção |
|---|---|---|---|
| Mc 12:37 | "como, pois, é **so eu** filho?" | A11 "seu filho" · KJV "his son" | **seu** filho |
| At 9:4 | "ouviu **ma** voz lhe dizendo" | A11 "uma voz" · KJV "a voice" | **uma** voz |
| Lm 3:6 | "como os que já **morrera**" | KJV "as they that be dead" (plural) | **morreram** |

## 3. Concordância de gênero (5 versículos)

`no arca` → `na arca`. "Arca" é feminino, e o próprio corpus escreve "na arca"
17 vezes contra 5 de "no arca":

Êx 25:16 · Êx 25:21 · 1Sm 6:19 · 2Rs 12:10 · 2Cr 24:10

## 4. Marcador temporal corrompido (2 versículos)

`Naquela muita` → `Naquele tempo`. São as **únicas duas ocorrências** da
expressão no corpus inteiro, e as duas abrem narrativa:

| ref | BLIVRE | Almeida 1911 | KJV |
|---|---|---|---|
| Lv 24:10 | "**Naquela muita** o filho de uma mulher israelita…" | "E saiu um filho d'uma mulher israelita…" | "And the son of an Israelitish woman…" |
| 1Rs 3:16 | "**Naquela muita** vieram duas mulheres prostitutas ao rei" | "Então vieram duas mulheres prostitutas ao rei" | "Then came there two women…" |

A própria BLIVRE escreve **"Naquele tempo" 28 vezes** — é o idioma dela, então a
correção não inventa vocabulário. Nenhuma das duas testemunhas traz conteúdo
que a frase corrompida carregue: em 1Rs 3:16 as duas trazem um marcador
temporal ("Então"/"Then"), e em Lv 24:10 nenhuma traz marcador nenhum. Trocar
por "Naquele tempo" preserva o sentido nos dois casos e não acrescenta nada.

## 5. Grafia espanholada (4 versículos)

`preguntar` → `perguntar`. "Preguntar" não existe em português; é o verbo
espanhol. A BLIVRE escreve `perguntar` **91 vezes** e `preguntar` 4:

Dt 13:14 · Dt 17:9 · 2Sm 11:3 · 2Cr 18:7

**A varredura da mesma família trouxe dois falsos positivos**, e eles importam
tanto quanto o achado: `persa` (Ne 12:22, Dn 6:28) é "Dario, o **persa**", e não
"presa"; `preto` (Mt 5:36, Ap 6:5, Ap 6:12) é a **cor**, e não "perto". Trocar
qualquer um dos dois estragaria o versículo.

## 6. `água` onde é `águia` (8 versículos) — o mais grave até aqui

Achado por leitura em Dt 32:11 ("Como a **água** desperta sua ninhada"), e
confirmado por varredura cruzada: versículos em que a KJV diz *eagle* e a
BLIVRE não diz *águia*.

| ref | BLIVRE | KJV |
|---|---|---|
| **Êx 19:4** | "vos tomei sobre asas de **águas**" | "I bore you on **eagles**' wings" |
| Lv 11:13 | "a **água**, o quebra-ossos, o esmerilhão" | "the **eagle**, the ossifrage" |
| Dt 14:12 | "a **água**, e o quebra-ossos" | "the **eagle**, and the ossifrage" |
| Dt 28:49 | "nação… que voe como **água**" | "as swift as the **eagle** flieth" |
| Dt 32:11 | "Como a **água** desperta sua ninhada" | "As an **eagle** stirreth up her nest" |
| 2Sm 1:23 | "Mais ligeiros que **águas**" | "swifter than **eagles**" |
| Jó 39:27 | "a **água** voa alto e põe seu ninho na altura" | "the **eagle** mount up… make her nest on high" |
| Ap 12:14 | "duas asas de grande **água**" | "two wings of a great **eagle**" |

**Por que este é o mais grave.** Não é acento nem grafia: é uma palavra real
trocada por outra palavra real. Nenhum corretor ortográfico acusa, nenhuma
varredura de acento acha, e a frase continua gramatical. Só a leitura pega —
água não tem asas nem ninho. E cai em Êxodo 19:4, um dos versículos mais
citados da Bíblia inteira. A BLIVRE escreve `águia` corretamente em 22
versículos, então é corrupção pontual, não escolha de tradução.

**Não são defeitos, na mesma varredura:** `galinha-d'água` (Lv 11:18) e
`gavião-pescador` (Dt 14:17) são nomes de aves, escolha legítima para
*gier-eagle*; e `abutres` em Mt 24:28, Lc 17:37 e Pv 30:17 é tradução
defensável de ἀετοί.

### O mesmo tipo, em Isaías 7:15

| ref | BLIVRE | Almeida 1911 | KJV | correção |
|---|---|---|---|---|
| Is 7:15 | "Manteiga e **mal** ele comerá, pois saberá como rejeitar o **mal** e escolher o bem" | "Manteiga e **mel** comerá, até que elle saiba rejeitar o mal" | "Butter and **honey** shall he eat, that he may know to refuse the **evil**" | **mel** |

O agravante: **a palavra "mal" aparece duas vezes no mesmo versículo, uma errada
e uma certa**. Frequência não denuncia (a BLIVRE escreve `mel` corretamente em
62 versículos e `mal` centenas de vezes), comprimento não denuncia, ortografia
não denuncia. Só denuncia quem lê e sabe que manteiga se come com mel.

### O método que achou isto, e que serve para caçar mais

Cruzar uma palavra da KJV contra o que a BLIVRE traz naquele mesmo versículo.
É mais forte do que varrer a BLIVRE sozinha, porque acha **troca entre palavras
que existem** — a classe que escapa de tudo. Vale repetir no fim da fila com
outros substantivos concretos (animais, metais, medidas, números).

## 7. Corruptelas pontuais em Josué 13 (2 versículos)

As duas são **únicas no corpus inteiro** — uma ocorrência cada — e as duas
foram achadas por leitura, não por varredura.

| ref | BLIVRE | Almeida 1911 | KJV | correção |
|---|---|---|---|---|
| Js 13:5 | "desde Baal-Gade **o pdo** monte Hermom" | "desde Baal-gad, **ao pé do** monte Hermon" | "from Baal-gad **under** mount Hermon" | **ao pé do** |
| Js 13:6 | "filhos de Israel**:;**somente repartirás" | "filhos de Israel**: tão sómente** faze" | "children of Israel**: only** divide thou" | **: somente** |

## 8. Palavra trocada e verbo faltando (2 versículos)

| ref | BLIVRE | Almeida 1911 | KJV | correção |
|---|---|---|---|---|
| 1Sm 24:19 | "o deixará ir **saro** e salvo?" | — | "let him go well away?" | **são** e salvo |
| 1Sm 27:9 | "E Davi **aquela terra**" *(sem verbo)* | "E David **feria** aquella terra" | "And David **smote** the land" | E Davi **feria** aquela terra |

Em 1Sm 27:9 o verbo some e a frase fica sem predicado. A forma escolhida é o
imperfeito, que é o de Almeida e o dos verbos vizinhos no próprio versículo
("não deixava", "levava", "voltava", "vinha").

**Falso positivo da mesma varredura:** `saro` também aparece em 2Rs 20:5 — "eis
que eu te **saro**" —, e ali é o verbo *sarar*, conjugado certo. Só a primeira
ocorrência é defeito.

## 9. Erro de digitação e concordância em Oseias (4 versículos)

Todos achados por leitura, e todos únicos no corpus.

| ref | BLIVRE | Almeida 1911 | KJV | correção |
|---|---|---|---|---|
| Os 1:2 | "a terra se prostitui **munto**" | — | — | **muito** |
| Os 3:3 | "**nem e eu** [esperarei] por ti" | "e também eu ficarei para ti" | "so will I also be for thee" | **e eu** esperarei |
| Os 10:14 | "ali **a mãe foram despedaçada** com [seus] filhos" | — | "the **mother was** dashed in pieces upon her children" | **a mãe foi despedaçada** |
| Os 11:12 | "e **era é fiel** ao Santo" | "e com os sanctos **está fiel**" | "and **is faithful** with the saints" | **e é fiel** |

Em Os 3:3 o "nem" contradiz as duas testemunhas: elas põem a promessa do próprio
profeta em paralelo com a exigência feita a ela, e não como mais uma proibição.

## 10. Espaço perdido ou sobrando (4 versículos)

| ref | BLIVRE | KJV | correção |
|---|---|---|---|
| Zc 7:1 | "veio a Zacarias **noquarto** [dia]" | "in the fourth year… came unto Zechariah" | **no quarto** |
| Zc 7:13 | "assim **tamb em** quando eles clamaram" | "so they cried" | **também** |
| Mc 14:16 | "**seusdiscípulos**" | "his **disciples**" | **seus discípulos** |
| Lc 6:1 | "no segundo **sábadodepois** do primeiro" | "on the second **sabbath after** the first" | **sábado depois** |

## 11. O Novo Testamento é o trecho mais sujo da Bíblia Livre

Vinte subagents leram Mateus, Marcos, Lucas e o começo de João em duas rodadas,
sem se ver. O resultado desmonta a suposição com que este documento começou —
de que os defeitos eram raros e espalhados:

| livro | defeitos |
|---|---|
| Lucas | **58** |
| João 1—7 | 11 |
| Marcos | 10 |
| Mateus | 1 |
| todo o Antigo Testamento | 50 |

Lucas sozinho tem mais defeitos que os 39 livros do Antigo Testamento juntos, e
João acumulou 11 em apenas sete capítulos. Não é acaso de amostragem: cada lote
foi escrito por um subagent diferente, cego para os outros, e cada um tropeçou
na sua parte. **A qualidade da Bíblia Livre não é uniforme entre os livros**, e
o Novo Testamento é onde ela é pior.

### Os dois que mudam o sentido

`Lc 14:11` traz **"Porque qualquer que exaltar a si mesmo, e aquele que humilhar
a si mesmo, será exaltado"**. Falta a oração inteira *será humilhado*, e o
versículo, como está, **afirma o contrário do que diz** — as duas metades da
frase passam a ter o mesmo desfecho. A KJV traz "whosoever exalteth himself
shall be abased" e a Almeida 1911, "qualquer que a si mesmo se exaltar será
humilhado". É o defeito mais grave de toda a corrida, e num versículo que muita
gente sabe de cor.

`Lc 21:18` traz **"nem um cabelo de vossa cabeça parecerá"** onde as duas
testemunhas dizem *perecerá* (KJV "perish", Almeida "não perecerá nem um
cabello"). Uma promessa de proteção virou frase sem pé, no meio de um trecho
sobre perseguição.

### Marcos 14—16: duas aspas que nunca fecham

`Mc 14:58` abre `“Nós o ouvimos dizer…` e não fecha, engolindo o versículo 59
inteiro dentro da citação; `Mc 14:70` fecha uma aspa que nunca foi aberta. Isso
não é cosmético: o app usa aspas para decidir o que é fala de personagem.

### João: maiúscula inconsistente na mesma perícope

`os Judeus` em Jo 2:18, 5:18, 6:52 e 7:15 contra `os judeus` em Jo 2:20, 5:16,
6:41 e 7:1 — e `Sábado` contra `sábado` dentro de Jo 5. Não é defeito de
tradução e não entra na lista de correções, mas atrapalha a citação byte a byte
e vale uniformizar junto.

Todos foram conferidos por mim contra o texto bruto antes de entrar aqui.
Um candidato ficou de fora: `Lc 14:18`, "E cada um deles todos
começou a dar desculpas", que a KJV sustenta ("they all with one consent began
to make excuse"). Pela regra fundadora, KJV concordando não é defeito.

**O único que muda o sentido — duas testemunhas:**

`Lc 21:18` traz **"nem um cabelo de vossa cabeça parecerá"**. Almeida 1911 diz
"não perecerá nem um cabello da vossa cabeça" e a KJV diz "there shall not a
hair of your head perish". Uma promessa de proteção virou uma frase sem pé —
e ela está no meio de um trecho sobre perseguição, onde justamente mais pesa.

**Segundo caso com duas testemunhas:** `Lc 20:46`, "querem andar roupas
compridas", falta o *com* (KJV "walk **in** long robes", Almeida "andar **com**
vestidos compridos").

**Letra trocada ou faltando (8):** `surpeenderam` (1:63) · `agradeci` por
agradecia (2:38) · `ficarm` (2:48) · `tetraca` (3:1, com *tetrarca* grafado
certo duas vezes no mesmo versículo) · `exupulsassem` (9:40) · `Mais ai de vós`
por *Mas* (11:42) · `não posam` (21:15) · `que sou em mesmo` por *eu mesmo*
(24:39).

**Concordância (8):** `das palavra` (1:2) · `todo a terra` (2:1) · `as gentios`
(2:32) · `toda o povo` (8:37) · `a todo os que` (9:5) · `ninguém as dava` para *os grãos* (15:16) ·
`E o todo o povo` (18:43) · `o olhos` (22:56).

**Palavra faltando (6):** falta o verbo em "sua mulher das filhas de Arão"
(1:5) e em "enquanto eles ali, completaram-se" (2:6) · `com o não tem` (3:11) ·
"Depois que disse coisas" (8:8) · `Graças te dou, o Pai` por *ó Pai* (10:21) ·
`que libertar a Israel` por *libertaria* (24:21).

**Palavra sobrando ou duplicada (5):** `Isabel, sua mulher, Isabel` (1:24) ·
vírgula em "os apóstolos, voltaram" (9:10) · `para ter para herdar` (10:25) ·
`que eles, enquanto eles caminhavam` (10:38) · `Então lhe disse: Então se
levantará` — com *lhe* onde cabe *lhes* (21:10).

**Espaço perdido ou sobrando (10):** `siga- me` (9:23) · `salvá-las.E` (9:56) ·
`com ele.Então` (10:37) · `trazei- os` (19:27) · `a outros.E` (20:16) ·
`sacerdotes.E` (17:14) · `d esta vida` (21:34) · `duas espadas.E` (22:38) · `o que dizes.E` (22:60) ·
`meu espírito.E` (23:46).

**Acento errado (3):** `intima compaixão` (7:13) · `saíndo` com acento indevido
(9:33) · `deram a luz` sem crase (23:29).

**Pontuação ou construção quebrada (6):** período sem verbo principal em 7:2 ·
`será vos dado` com a ordem trocada (11:9) · `que há ninguém que, tenha deixado`, sem a negação (18:29) ·
`dizendo, Tu és o Cristo?` com
vírgula onde cabe dois-pontos (22:67) · `as mulheres que acompanhando-o desde a
Galileia, tinham o seguido` (23:49) · ponto partindo a frase antes do parêntese
em 23:50.

**Nenhuma citação do material atravessa essas emendas.** Todos os subagents
foram instruídos a citar fragmento menor quando a frase passava por cima do
erro, e cada um confirmou isso por script.

## Um defeito que era MEU, não da Bíblia Livre

`conseguiamapenas` e `haviasomente`, em Ag 2:16, **não eram da fonte**. O VPL
traz `conseguiam[apenas]` e `havia[somente]`, com o colchete colado na palavra
anterior, e a minha `removerColchetes` tirava os colchetes sem abrir espaço.

São 19 ocorrências desse formato no corpus, e elas se dividem em dois casos que
pedem tratamento **oposto**: `mataram[-no]` tem de virar `mataram-no`, colado,
enquanto `conseguiam[apenas]` precisa do espaço. A correção olha o que vem
depois do colchete e só abre espaço quando começa em letra.

O defeito estava no texto que o app serve desde o ETL da Sessão 2, e era mudo —
o versículo continuava parecendo texto. Só apareceu porque um subagent leu Ageu
2 e estranhou. **Fica registrado aqui como lembrete de que a minha própria
extração também precisa de duas testemunhas.**

## Outro defeito que era MEU: colchete com pedaço de palavra

Achado varrendo o corpus atrás de outra coisa, e vinha sendo servido ao leitor.

A Bíblia Livre marca entre colchetes o que o tradutor supriu, e o app remove os
delimitadores. Em quase todos os casos o colchete traz uma **palavra** e o
espaço em volta está certo: `Deus [é] nosso refúgio` vira `Deus é nosso
refúgio`. Mas em dez lugares ele traz um **pedaço** de palavra, e aí o espaço
que a fonte põe é destrutivo:

| referência | o app servia | deveria servir |
|---|---|---|
| At 25:5 | `desçam com igo` | `desçam comigo` |
| At 18:15 | `a questão é de palavra s` | `de palavras` |
| At 13:14 | `na sinagoga n um dia de sábado` | `num dia de sábado` |
| At 21:8, 21:18, 21:1, 23:11 | `E n o dia seguinte` | `E no dia seguinte` |
| Sl 102:3 | `como n um forno` | `como num forno` |
| Sl 146:4 | `O espírito dele s sai` | `O espírito deles sai` |
| Jo 6:34 | `dá-nos sempre d este pão` | `sempre deste pão` |

**Por que não dava para ver pelo espaçamento.** A fonte põe espaço antes de
5.990 dos 6.030 colchetes — inclusive nestes. O que separa os dois casos é o
conteúdo: entre os colchetes de uma letra só, `e` (403×), `é` (120×), `o`
(103×), `a` (47×) e `ó` (3×) são palavras de verdade; os únicos pedaços são
`n` (6×), `s` (2×) e `d` (1×), mais `igo` (1×). E colam para lados **opostos**:
`dele [s]` fecha a palavra anterior, `[n] um` abre a seguinte.

### E um terceiro: nota do tradutor lida em voz alta

`1Co 13:10` traz `Mas quando vier o [que é] completo,[Ou: perfeito] então…` e
`1Tm 5:17` traz `Os presbíteros [ou: anciãos] que lideram bem`. Aqui o colchete
não marca palavra suprida: marca **aparato crítico**, uma leitura alternativa
dirigida a quem estuda. Desembrulhar deixava o app servindo *"quando vier o que
é completo, Ou: perfeito então o que é em parte"* — e a narração lia isso em voz
alta. São dois casos no corpus, e agora o aparato sai inteiro.

São três defeitos meus na mesma família: `conseguiam[apenas]` virando
`conseguiamapenas`, `com [igo]` virando `com igo`, e agora `[Ou: perfeito]`
sendo lido como se fosse Escritura. A lição, que já custou três vezes: **o
colchete da Bíblia Livre não tem um significado só, e toda regra sobre ele
precisa ser conferida contra o corpus inteiro — nunca contra os exemplos que eu
tenho na frente.**

Corrigido em `scripts/blivre-texto.ts`. Não precisa de correção na fonte: entra
sozinho quando a ETL rodar de novo, junto com as outras correções.

## Achados que NÃO são defeitos

**1Sm 13:1** — "Havia já Saul reinado um ano; e reinado que houve dois anos
sobre Israel". Parece corrompido, e não é: a KJV traz o mesmo ("Saul reigned one
year; and when he had reigned two years over Israel"). É uma dificuldade do
próprio hebraico, presente em todas as traduções. **Vale a regra fundadora da
Sessão 2: se a KJV concorda com a BLIVRE, não é defeito.** O material da
perícope 522 avisa o leitor a não se prender ao número, que é a saída certa.

**`alambre`** (Êx 26:11, "colchetes de alambre") é palavra antiga para bronze —
KJV traz "taches of brass". Está certa, só é desconhecida. **Não se corrige: se
explica**, e foi o que a perícope 136 fez, no parágrafo das palavras do trecho.
É a mesma regra de `estopa` em Isaías 1.

## Em aberto: duas glosas entre colchetes que talvez não sejam aparato

A regra que tira nota do tradutor pega `[Ou: perfeito]` e `[ou: anciãos]`,
que trazem dois-pontos. A varredura completa achou mais quatro colchetes com
"ou" **sem** dois-pontos, e eles não são todos a mesma coisa:

| referência | conteúdo | o que parece ser |
|---|---|---|
| `Jó 33:15` | `[ou em]` | preposição suprida, legítima — "em sonho, [ou em] visão" |
| `Ap 3:4` | `[ou seja, pessoas]` | aparato: explica "nomes" |
| `Ap 1:20` | `[ou mensageiros]` | aparato: leitura alternativa de "anjos" |
| `Jo 19:13` | `[ou pavimento]` | **duvidoso** — pode ser tradução, não aparato |

O caso de João 19:13 é o que trava a decisão. O texto bíblico traduz nomes
estrangeiros o tempo todo por conta própria ("Rabi, que traduzido quer dizer
Mestre"), e `Litóstrotos [ou pavimento]` pode ser exatamente isso, e não uma
nota de rodapé vazada. Tirar seria apagar tradução; deixar é ler aparato em voz
alta.

**Não decidi.** São três casos, o critério não é mecânico, e improvisar uma
regra aqui foi justamente o que o dono pediu para não fazer enquanto a corrida
não termina.

O mesmo cuidado evitou um erro na família das contrações: há dois casos de
preposição seguida de artigo entre colchetes, e só um é defeito. `Ap 1:13`
(`semelhante a [o] Filho`) precisa virar *ao*; `Is 1:14` (`cansado de as
suportar`) é português correto e uma regra geral o teria estragado. Virou
correção pontual, não regra.

## Nem todo defeito precisa de correção na fonte

Uma parte do catálogo se resolve sozinha quando a ETL roda, porque o defeito
está na **normalização** e não no texto. Essas referências continuam no
catálogo — a perícope muda, então o congelamento tem de liberá-la de qualquer
jeito —, mas não precisam de par `de`/`para` em `blivre-correcoes.ts`.

**Ponto final colado na frase seguinte (66 no corpus, 23 já catalogados).**
`salvá-las.E foram para outra aldeia`. O padrão é seguro porque exige minúscula
antes e MAIÚSCULA depois; a forma perigosa, ponto entre minúsculas, não ocorre
nenhuma vez no corpus, então não há abreviatura a preservar. Uma regra em
`blivre-texto.ts` resolve as 66, e depois dela não sobra nenhuma.

**Colchete mal interpretado (22 no corpus).** As quatro variantes descritas
acima — palavra colada, pedaço que fecha, pedaço que abre, nota do tradutor.

O critério para decidir de que lado uma coisa cai é simples: se o texto que a
Bíblia Livre publicou está certo e quem errou fui eu ao normalizar, é ETL. Se o
que está publicado está errado, é correção com duas testemunhas.

## Como aplicar — e por que não agora

Corrigir o texto **depois** do material escrito quebra as citações: a perícope
132 cita "E porás no arca o testemunho" palavra por palavra, e o portão
reprovaria a citação no instante em que o versículo mudasse.

O caminho, no fim da fila:

1. Levar as correções para `scripts/blivre-correcoes.ts`, com guard por trecho
   esperado, como as 65 que já estão lá.
2. Rodar o ETL, que regera `data/raw-pericopes.jsonl`.
3. `cacheDesatualizado` (em `scripts/montar-catalogo.ts`) compara o `texto` do
   raw com o `texto` gravado em `data/enriched/<ordem>.json` e aponta
   exatamente as perícopes cujo texto mudou.
4. Devolver **só essas** para a fila. São poucas: 26 versículos em 31.102.

Isso é preciso e barato. O que seria caro é corrigir de forma dispersa e
reescrever no escuro.

## Placar

**130 versículos** para corrigir, em 31.102 — 50 no Antigo Testamento, 80 no
Novo. E o padrão que se repete a cada achado: a varredura mecânica levanta o
candidato, e **a maioria dos candidatos é falso positivo** — 21 nos acentos, 2
na grafia espanholada. Nenhuma correção entra sem as duas testemunhas.

A distribuição diz mais que o total. Os primeiros 50 saíram de 39 livros; os 80
seguintes, de quatro. Ler o texto perícope por perícope acha o que a varredura
por comprimento não acha — e o que ela achou aqui é que **o resto do Novo
Testamento precisa ser lido com a mesma lupa antes de publicar**. Atos, as
cartas e o Apocalipse ainda não foram escritos nesta corrida; pela taxa de
Lucas e João, é razoável esperar mais uma centena de defeitos ali.

## O veredito das 63 que ficaram sem receita

O catálogo tem 484 referências. Ao fim da fase de correção, 421 têm receita e 63
não — e nenhuma das 63 é trabalho pendente. Elas se dividem em três grupos, e a
distinção importa porque o congelamento lê o catálogo, não esta prosa.

**52 são desfeitas pela ETL.** O que o leitor marcou era espaço, ponto colado,
colchete meio aberto ou hífen partido — material de normalização, não da Bíblia
Livre. `salvá-las.E foram`, `siga- me`, `d [a] Judeia`, `desçam com [igo]`,
`(a nona [hora] )`, `de palavra [s] ,`: todos conferidos um a um rodando o
versículo pela mesma sequência que serve a tela — receita, epígrafe, colchetes.

Foi essa conferência que achou um erro meu de auditoria: o script rodava
`corrigirVersiculo` e `removerColchetes` mas pulava `separarEpigrafe`, e por
isso Sl 14:1 e Sl 53:1 apareciam com o dois-pontos do sobrescrito colado no
texto. Eu quase escrevi receita para um defeito que não existe na tela.

**7 foram derrubadas pela conferência.** O leitor marcou, a testemunha não
confirmou, e não achar defeito também é resultado:

- **At 4:11** `Este é a pedra` — parece erro de gênero, mas a Almeida traz
  exatamente isso: o demonstrativo aponta para Jesus, não para a pedra.
- **1Co 5:5** `De ao tal entregar a Satanás` — não é frase quebrada; é a
  continuação de 1Co 5:3, "já julguei… de ao tal entregar".
- **1Tm 6:15** `Essa nos seus tempos mostrará` — concorda com `a aparição` de
  6:14, e a Almeida traz a mesma construção torta.
- **Sl 49:14** `São como ovelhas levados` — a Almeida também põe o particípio no
  masculino, porque quem é posto na sepultura são os homens.
- **1Pe 3:6**, **1Pe 4:4**, **1Co 7:26** — lidos três vezes sem achar o que o
  leitor viu.

E uma quase-correção que a contagem impediu: `Porém a aqueles meus inimigos`
(Lc 19:27) parecia crase perdida, mas a fonte escreve `a aqueles` sete vezes e
`àqueles` cinco. É estilo da casa, não erro.

**4 esperam o dono.** Jr 4:14 (`os teus meus pensamentos`, ver
`decisoes-do-dono-sessao-3.md`), Sl 36:2 (`que não achar nem odiar sua própria
maldade`, quebrado sem testemunha que diga como), Sl 119:71 (`Foi bom pra mim`,
registro e não erro) e Sl 48:4, que cai na classe abaixo.

## Trinta versículos sem pontuação final, e por que não têm receita

Trinta versículos terminam sem `.`, `?` ou `!`. A tentação era pôr ponto nos
trinta, e Gl 1:15 derruba a ideia:

> Mas quando Deus (que me separou desde o ventre da minha mãe, e por sua graça
> me chamou) se agradou

Termina assim porque a frase **continua em Gl 1:16**. Ponto ali seria erro meu,
não conserto. Decidir um a um é trabalho de leitura, não de regra, e fica para
quando alguém o fizer com as duas testemunhas na mão. Sl 48:4 é um dos trinta.
