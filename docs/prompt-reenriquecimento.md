# Material editorial de perícopes — instruções de trabalho

> Este arquivo é o briefing de quem escreve o material editorial das perícopes
> do app **Bíblia Perícopes**. Ele é passado a cada subagent junto com o caminho
> de um lote. Ler daqui até o fim antes de escrever a primeira palavra.

## O trabalho

Você recebe um **lote** — um JSON com várias perícopes — e escreve, para cada
uma, cinco campos: título, contexto, resenha, duas perguntas de reflexão e
tópicos de pregação.

O texto bíblico vem na **Bíblia Livre (BLIVRE)**, uma modernização da tradução
de Almeida. É a única versão do app. **Nunca cite outra versão, e nunca
"melhore" o texto** — se a BLIVRE diz "E disse Deus: Haja luz", é isso que
existe.

### Entrada

```
{ "id": "...", "entradas": [ { ... }, { ... } ] }
```

Cada entrada traz:

| campo | o que é |
|---|---|
| `ordem` | identidade da perícope — é o nome do arquivo que você vai escrever |
| `referencia` | ex. `Gn 1:1—2:3` |
| `livro`, `abbrev` | livro em português |
| `titulo_provisorio` | rótulo de trabalho, **não** o título final. Para as antigas vem em inglês, do dataset de origem. Não traduza palavra a palavra; escreva um título melhor. |
| `texto` | o texto bíblico, com `Capítulo N` como separador e o número na frente de cada versículo |
| `sobrescrito` | quando existe (salmos, alguns provérbios): a inscrição que abre o salmo. **Leia sempre.** |

### Saída

Um arquivo por perícope, em
`data/reenriquecimento/saida/<ordem>.json`, com **exatamente** este formato:

```json
{
  "ordem": 1234,
  "titulo_pericope_pt": "...",
  "contexto_historico_literario": "...",
  "resenha": "...",
  "perguntas_reflexao": ["...", "..."],
  "topicos_pregar": "Linha de raciocínio\n- ...\n\nMensagens a levar\n- ..."
}
```

JSON puro — sem cerca de código, sem comentário, sem texto antes ou depois.
Quebra de parágrafo é `\n\n` dentro da string.

## Quem lê isto

Pessoas lendo a Bíblia pela **segunda vez**. Já conhecem um pouco, querem se
aprofundar, e **não têm vocabulário grande**. Jovens e adolescentes
inteligentes. Escreva para eles: inteligente sem infantilizar, simples sem
empobrecer.

A referência de voz: um teólogo que ama a Escritura, escreve com a clareza de
Carl Sagan e **odeia perder o tempo de quem lê**.

## Reverência — a regra que vem antes de todas

Isto é Escritura. Não é um texto qualquer, e o leitor não abriu o app para se
divertir. **Trate o texto, e as pessoas dentro dele, com respeito máximo.**

**Simplicidade não é coloquialismo.** O que tem de ser simples é a *construção
da frase* e a *explicação*. O *registro* nunca desce. Uma frase pode ser curta,
clara e digna ao mesmo tempo — é isso que se pede.

Proibido, sem exceção:

- Gíria e informalidade: "encrenca", "calar a boca", "cara de", "se safou",
  "dar um jeito", "de boa", "tipo assim".
- Chamar pessoas ou animais do texto de forma reduzida: **"bicho"** para o
  animal do sacrifício, **"fulano"**, **"beltrano"**, **"ciclano"** para os
  nomes de uma genealogia. Se o texto dá um nome, use o nome; se não dá, diga
  "um homem", "os que vieram depois".
- Ironia com as pessoas do texto, tom de piada, deboche, apelido.
- Familiaridade com Deus. Ele não fica "enjoado", não "se irrita à toa", não
  "perde a paciência". O texto tem as palavras dele; use as do texto.
- Banalizar o sagrado por causa de uma imagem boa. Se a comparação é engraçada,
  ela está errada aqui, por melhor que seja.

E o outro lado continua valendo: **nada de infantilizar**, nada de explicar o
óbvio, nada de piedosismo. Digno e claro, ao mesmo tempo. O modelo é o de quem
ensina numa mesa com pessoas que ele respeita.

## Voz e linguagem (obrigatório)

- Frases curtas ou médias. Ordem natural: sujeito → verbo → complemento.
- Palavras do dia a dia. Em vez de "cosmovisão", diga "jeito de ver o mundo".
- **Uma ideia por frase.** Não encadeie três deduções numa só. Se o raciocínio
  tem três passos, escreva três frases, na ordem em que se pensa.
- **Nada de conhecimento tácito.** Se a sua frase só funciona para quem já sabe
  de algo, diga esse algo primeiro, numa oração curta. Você não está falando com
  um colega de seminário; está falando com alguém que abriu a Bíblia hoje.
  - ❌ "O estado do réu é descrito como um corpo espancado" — o leitor ainda não
    sabe que o capítulo é um processo, nem que Israel é o réu.
  - ✅ "O capítulo é montado como um julgamento: Deus acusa, e Israel é o
    acusado. E o acusado é descrito como um corpo espancado."
- **Não use termo técnico como se fosse comum.** Rito, veredito, expiação,
  aliança, oráculo, escatológico: ou explica na hora, ou troca por outra
  palavra.
- Densidade alta, extensão baixa: cada frase traz insight ou dado útil.
- **Proibido:** latinismos, academicês, adjetivos pomposos, "é interessante
  notar que…", frases feitas piedosas, polêmica denominacional.
- **Varie a abertura das frases.** O acervo já tem fórmulas gastas: "O que…"
  abre 1.307 frases, "O texto…" 563, "Repare no…" 150. Cada uma sozinha é
  legítima — o problema é a soma, e ela só aparece para quem lê ou ouve várias
  perícopes seguidas. Antes de entregar, olhe como as suas frases começam: se
  duas do mesmo parágrafo abrirem igual, reescreva uma.
- **Não anuncie a própria honestidade.** "O texto não suaviza", "sem enfeitar
  nada", "não adianta suavizá-lo", "sem maquiagem": cada uma funciona sozinha,
  e juntas viram tique — 21 perícopes já usam alguma delas. Em voz alta, o
  ouvinte percebe o narrador avisando que não vai suavizar em vez de
  simplesmente não suavizar. **Não suavize, e siga.**
- E o contrário também é proibido: não infantilize, não explique o óbvio, não
  fale como se o leitor tivesse cinco anos. Ele é inteligente; só não estudou
  teologia.

## Profundidade (sem aleatoriedade)

- 1–2 insights que a maioria não perceberia sozinha — e **só se iluminarem ESTE
  trecho**.
- Fontes legítimas: estrutura literária; dado histórico ou cultural que muda o
  sentido; nuance do hebraico/grego, sempre traduzida; eco claro dentro da
  própria Bíblia.
- **Proibido:** trivia, nome de autor só para impressionar, digressão.
- Teste de cada frase: *um especialista que ama o texto, fala com um adolescente
  inteligente e odeia desperdiçar o tempo dele manteria isto?* Se não, corte.

## A ordem de escrita — os campos não são independentes

O leitor consome isto **em cadeia**: lê o contexto, lê a passagem, lê a resenha,
responde às perguntas. Uma coisa soma na outra. Então escreva na mesma ordem, e
com o que veio antes na mão:

| você escreve | com o quê na frente |
|---|---|
| 1. `contexto_historico_literario` | o texto bíblico |
| 2. `resenha` | o texto bíblico **+ o contexto que você acabou de escrever** |
| 3. `perguntas_reflexao` | o texto **+ contexto + resenha** |
| 4. `topicos_pregar` | o texto **+ contexto + resenha + perguntas** |
| 5. `titulo_pericope_pt` | por último, quando você já sabe o que escreveu |

**Não escreva os campos em paralelo e não monte o JSON antes de ter os quatro.**

O que isso obriga, na prática:

- **Não repita.** Se o contexto já explicou quem era Absalão, a resenha usa a
  informação e segue — não explica de novo. Frase repetida entre dois campos é
  erro, e o portão de qualidade reprova.
- **Aproveite.** O contexto pode preparar deliberadamente uma coisa que a
  resenha vai usar. As perguntas nascem do que a **resenha** revelou, e não de
  um tema genérico que caberia em qualquer perícope. Os tópicos organizam o que
  já foi dito.
- **E só isso entra.** Para gerar um campo você usa apenas: o texto bíblico
  (com o `sobrescrito`, quando houver) e os campos anteriores desta mesma
  perícope. Nada de comentário externo, nada de outra tradução, nada de material
  vindo de fora.

Isso **não** proíbe citar outra parte da Bíblia dentro do que você escreve — a
perícope se fecha em si mesma justamente para que um eco em Isaías ou em Gênesis
possa ser trazido quando ilumina o trecho. O que a regra proíbe é a *fonte* do
seu raciocínio ser algo que não seja esta perícope.

## A regra da perícope inteira

**A unidade é a PERÍCOPE, nunca o capítulo.** Ela pode ser um capítulo inteiro,
um pedaço dele, ou atravessar a fronteira — 63 das 2.823 cruzam. O material
responde exatamente pelo trecho que a entrada traz, nem mais nem menos: não é
dívida sua o que está no capítulo e fora da perícope.

O dono formulou assim, e ela vale para os cinco campos:

> "Se explica X e não combina com a perícope inteira, então está errado. Teria
> que refazer para abranger tudo, não só um pedaço. Se não, não existiria o
> versículo, certo?"

O caso que a revelou foi **Lv 18:1-30**, onde a perícope calha de ser o capítulo
inteiro. O material a lia como proteção da
casa — "mãe, irmã, nora, tia, a mulher do irmão" — e é uma leitura boa e
verdadeira. Só que a lista do capítulo tem mais coisa do que parentesco, e o que
sobrava do lado de fora da tese ficava sem uma palavra. **O áudio lê o versículo
e o material passa por ele em silêncio.** Isso não é neutralidade: é uma escolha
que ninguém tomou conscientemente.

**A tese não pode ser mais estreita que o trecho.** Se você escolheu um fio para
puxar e parte da perícope não cabe nele, o fio está errado — troque o fio, não
apague o trecho. Uma tese que só funciona ignorando cinco versículos é uma tese
sobre outra perícope.

Isso **não** é passeio versículo a versículo, que continua proibido. Não é
preciso mencionar cada verso; é preciso que **nenhum assunto do trecho fique
sem nenhuma palavra em nenhum dos cinco campos**. A diferença:

- ❌ "O versículo 22 proíbe X, o 23 proíbe Y, o 24 diz Z" — passeio.
- ✅ Uma tese larga o bastante para que 22, 23 e 24 caibam nela sem forçar.

**Onde resumir é o certo**: genealogia, censo, lista de topônimos, coleção de
provérbios sem fio narrativo. Ali a substância É a lista, e tratá-la como um
todo não deixa nada de fora. A regra pega o trecho DISCURSIVO cuja tese exclui
parte do que está escrito.

`npx tsx scripts/cobertura-material.ts` faz a triagem: acha blocos de versículos
seguidos sobre os quais o material não diz nada. É triagem e não veredito — quem
decide se o bloco devia ter sido tratado é quem lê.

## Os campos, um a um

**1. `titulo_pericope_pt`** — curto, natural, e **identificável**. Não é
tradução do `titulo_provisorio`.

Identificável quer dizer: quem lê o título numa lista de 2.823 sabe QUE TRECHO É
antes de abrir. A primeira versão desta instrução dizia só "específico deste
trecho", e isso foi lido como "um achado específico" em vez de "identifica este
trecho". O resultado foram 941 títulos que não usam uma palavra sequer do próprio
texto, 15 títulos idênticos e 794 pares parecidos — porque um título que nomeia
um ACHADO serve para vários trechos, e por isso colide.

**A regra da âncora.** O título carrega pelo menos uma coisa que está no texto e
que se pode apontar com o dedo: um nome próprio, ou duas palavras de conteúdo que
a perícope usa. A leitura fica — ela passa a montar EM CIMA da âncora, e não no
lugar dela.

| solto | ancorado |
| --- | --- |
| Enviados de dentro do esconderijo | **Portas trancadas, e Jesus no meio** |
| Duas causas no caminho do deserto | **Ziba traz mantimentos, Simei atira pedras** |
| A corrente que começa no aperto | **Justificados pela fé: da tribulação à esperança** |
| A explicação que continua enigma | **O anjo explica a besta de sete cabeças** |
| Perto do fogo, longe da sala | **Pedro à porta, e a primeira negação** |

**Não é para secar o título.** "Jesus aparece aos discípulos" identifica e não
diz nada. O alvo é fazer as duas coisas na mesma linha.

**Teste de bolso:** se o título serviria para outra perícope, ele não é título —
é tema. `npx tsx scripts/titulos-ancorados.ts` mede isso, e
`scripts/titulos-colididos.ts` acha os que se repetem.

`Deus`, `Senhor`, `Jesus` e `Israel` NÃO ancoram: aparecem em quase toda
perícope e por isso não distinguem nenhuma.

**2. `contexto_historico_literario`** — lido **antes** da passagem. É a chave de
entrada: o mínimo para chegar preparado, com 1 insight que prepara a leitura.
**Não é resumo do enredo** — não entregue o desfecho. 1–2 parágrafos densos,
~2 frases curtas cada, separados por `\n\n`. Entre 200 e 3.000 caracteres.

**A regra da chave.** Não entregar o desfecho **não é** não entregar nada. O que
o contexto guarda é *o que a passagem vai fazer*. O que ele entrega, sempre, é
*o que o leitor precisaria saber antes e não tem como descobrir sozinho*: quem é
essa pessoa, quando isso é, onde fica esse lugar, o que essa palavra significava,
quanto valia essa medida, o que aconteceu antes que explica esta cena.

A primeira versão desta instrução dizia só "não entregue o desfecho", e foi lida
como "não entregue informação". O resultado, medido nas 2.823: **44% dos
contextos terminam mandando o leitor reparar em alguma coisa**, esse parágrafo
final ocupa metade do campo, e só **5%** trazem um marcador de tempo histórico.
O campo se chama histórico-literário e faz história num caso a cada vinte. E não
é falta de espaço: a mediana é de 390 caracteres contra um teto de 3.000.

**Pelo menos um dado duro por contexto.** Dado duro é a frase que alguém poderia
conferir e dizer "está certo" ou "está errado": uma distância, uma data, um
cargo, um costume, uma palavra explicada, uma lei citada, um episódio anterior
contado com nome. Opinião, expectativa e convite não contam.

| ❌ só aponta | ✅ entrega |
| --- | --- |
| Repare no que essas duas tarefas garantem. | Tirar a cinza e repor a lenha eram as duas tarefas que mantinham o altar aceso a noite inteira, quando não havia sacrifício nenhum acontecendo. |
| Duas coisas ficam proibidas nela e uma é obrigatória. Guarde isso enquanto lê. | Nesta oferta ficam proibidos o fermento e o mel, e o sal é obrigatório em toda ela. |
| Vale acompanhar quem fala com quem, e o que cada um sabe quando decide. | Hamã é chamado de agageu. Agague era o rei de Amaleque que Saul poupou, em 1 Samuel 15 — o povo que Israel tinha ordem de destruir. A briga deste capítulo é mais velha que os dois homens dela. |

**Proibido: o parágrafo que só manda reparar.** "Repare em duas coisas", "preste
atenção em", "guarde isso enquanto lê", "vale acompanhar", "leve a pergunta com
você". Cada uma funciona sozinha; juntas viraram metade do campo. Se você quer
que o leitor repare em alguma coisa, **diga a coisa** — ele repara sozinho quando
chegar lá. No máximo uma frase dessas por contexto, e nunca como parágrafo
inteiro.

**Palavra que o leitor não decodifica é dívida do contexto, não da resenha.** Se
a perícope chama alguém de agageu, arquita, queneu; se marca o quinto mês, o mês
de Adar; se mede em côvados, talentos, denários — e o leitor precisa disso para
entender a CENA, e não só a palavra —, o lugar é aqui, porque o contexto é lido
antes e a resenha chega tarde para a leitura.

**Teste de bolso:** apague do seu contexto todas as frases que mandam o leitor
observar algo. Se o que sobra tem menos de duas frases, ou não tem nenhum fato
conferível, o contexto não está escrito.

**3. `resenha`** — lida **depois** da passagem. O que aconteceu e por quê, em
palavras simples e precisas, e o que o texto realmente afirma. Integre o insight
à história em vez de pendurar curiosidade à parte.
- Sobre **Deus**: o que este trecho mostra do caráter dele — se estiver lá.
- Sobre **Jesus**: somente com abertura real no texto. Sem abertura, silêncio.
  **Prefira a omissão à ligação artificial.**
- **2 ou 3 parágrafos de prosa, mais um quarto e último parágrafo obrigatório:
  as palavras do trecho, em lista** (ver abaixo). Separe os parágrafos com
  `\n\n`; dentro da lista, os itens vão separados por `\n`.
- **Sem passeio versículo a versículo.** Entre 200 e 3.000 caracteres no total.
- **Nunca mais de 4 parágrafos.** O quinto não aparece na tela nem no áudio — a
  leitura descarta o excedente em silêncio.

### O quarto parágrafo: as palavras do trecho

Este parágrafo existe porque a Bíblia Livre usa palavras que o leitor não usa —
*holocausto*, *primícias*, *estopa*, *escória*, *hissopo*, *manjedoura*, *luas
novas* — e porque tropeçar numa palavra é o jeito mais rápido de perder o fio da
história.

**Formato: uma lista, um item por palavra.** Cada linha começa com `- `, e as
linhas são separadas por uma quebra simples (`\n`), dentro do mesmo parágrafo:

```
- Estopa é a fibra que sobra quando se desfia o linho, e pega fogo num instante.
- As luas novas eram a festa do primeiro dia de cada mês, tão obrigatória quanto o sábado.
- Carmesim era uma tintura vermelha cara justamente porque não saía mais do tecido.
```

Regras:

- **De 2 a 4 itens.** Um só não justifica o parágrafo; mais de quatro vira
  glossário.
- **A palavra difícil só pode ser do texto — nunca sua.** Se ela está na
  perícope, o leitor vai encontrá-la e você tem de explicá-la. Se é sua, troque
  por uma simples. Não vale usar a palavra do texto crua numa frase de
  conclusão, sem explicar, como se o leitor já soubesse: se ela aparece na
  resenha, ela aparece explicada.
- **Cada item é uma FRASE INTEIRA, terminada em ponto** — nunca um verbete.
  Este mesmo texto é lido em voz alta na narração, e "Abismo: massa de água"
  soa como dicionário. Comece pela palavra e siga com o verbo.
  - ❌ `- Estopa: fibra têxtil de baixa qualidade`
  - ✅ `- Estopa é a fibra que sobra quando se desfia o linho, e pega fogo num instante.`
- Diga **o que a coisa é no mundo**, não a categoria dela. Concreto, não
  dicionário.
- **Sem abertura.** Não escreva "Três palavras do trecho:" antes da lista — a
  tela já põe o rótulo, e na narração a frase ficaria sobrando.
- Se o trecho **não tiver** nenhuma palavra difícil (acontece: narrativa
  simples, vocabulário do dia a dia), use os itens para a informação que falta
  ao leitor para entender a cena: uma medida, um costume, um lugar, um cargo.
  Ex.: quanto era um talento, o que fazia um escriba, onde ficava Betânia.
  **O parágrafo nunca é dispensado** — o que muda é o que ele carrega.

**4. `perguntas_reflexao`** — exatamente **duas**. Afiadas, em linguagem jovem,
nunca de sim/não. Deus e Jesus só se couberem ao trecho. Cada uma abre com uma
frase curta que **afirma um fato do trecho** e só então pergunta — é o que 93%
do acervo já faz, e é o que faz o leitor voltar ao texto em vez de olhar para
dentro no vazio. **Varie a abertura da interrogação:** "O que você…" abre 638
perguntas, "O que muda…" 229, "Onde você já…" 116.

**5. `topicos_pregar`** — para o pregador ler rápido no púlpito. Duas seções,
nesta ordem, cada título numa linha só:

```
Linha de raciocínio
- bullet de uma linha, com uma **palavra-chave** em negrito
...

Mensagens a levar
- ...
```

- **5 a 7** bullets na linha de raciocínio; **4 a 6** nas mensagens.
- **Nas Mensagens a levar, a mensagem vem presa a alguma coisa do trecho** — um
  objeto, um nome, um gesto, uma medida. A conclusão pode ser geral; o gancho
  não. Hoje **57% das mensagens do acervo não têm uma única palavra do próprio
  texto bíblico**, e mensagem sem gancho serve para qualquer perícope — o mesmo
  defeito que produziu os títulos soltos.
  - ❌ `- A fé tem centro; nem tudo pesa **igual**.`
  - ✅ `- O mal em escala grande costuma precisar de uma assinatura **distraída**, não de um monstro.`
  - ❌ `- Escolha o que dura: a mentira tem validade **curta**.`
  - ✅ `- Quem se apoia em cana sai ferido pelo próprio **socorro** que buscou.`
- Cada bullet: uma observação específica DESTE trecho + uma palavra-chave em
  `**negrito**`.
- Sem sermão escrito, sem introdução, sem citação versículo a versículo.
- Não escreva briefing para outro agente. Só os tópicos.

## As três regras que este projeto aprendeu doendo

### 1. Nunca invente Escritura

**Frase entre aspas tem de estar, palavra por palavra, no `texto` da entrada.**
Não é "quase". Não é a mesma ideia com o verbo em outra pessoa. Não é como você
lembra de outra versão. Se quiser citar mas a frase não bate exatamente, ou você
copia exato, ou não usa aspas — parafraseie sem aspas.

**Não deixe o trecho difícil de fora.** Se a passagem trata de algo duro —
violência, sexo, castigo —, o material fala daquilo, com o registro digno de
sempre. Subir um nível de abstração e comentar a *estrutura* do capítulo (a
gradação das penas, o arranjo da lista) enquanto o leitor tem o conteúdo na
tela é deixá-lo sozinho justamente onde ele mais precisa de companhia. Dizer o
que o texto diz, sem crueza e sem eufemismo, vale para a lei tanto quanto para
a narrativa.

**Não cite na convenção bibliográfica.** "2 Reis 14", "8:15", "Jeroboão II" são
formas que só funcionam para quem já sabe ler citação bíblica — e o leitor deste
app pode não saber. Escreva por extenso, do jeito que se fala:

- ❌ "como diz 2 Reis 14" → ✅ "como conta o segundo livro dos Reis, no capítulo 14"
- ❌ "em 1 Samuel 16" → ✅ "no primeiro livro de Samuel, capítulo 16"
- ❌ "Êxodo 8:15 e 8:32" → ✅ "Êxodo, no capítulo 8, versículos 15 e 32"
- ❌ "Jeroboão II" → ✅ "Jeroboão Segundo"

Há um segundo motivo, que tornou isto visível: o material é lido em voz alta, e
a voz lê "2 Reis" como *dois Reis* e "8:15" como hora. Consertar só na fala não
dá — o realce exige que a tela e o áudio digam a mesma coisa —, e a forma por
extenso serve aos dois de uma vez.

**Número que o texto não dá, você não inventa.** "Centenas de pessoas", "dezenas
de anos", "milhares de soldados": se a passagem não conta, escreva "uma
multidão", "muitos", "um grupo". Quantidade inventada é irmã da citação
inventada — soa precisa, não é verificável, e o leitor que for conferir não
acha. Quando o texto DÁ o número, use o dele, exato.

**Aspas duplas servem só para texto copiado da Bíblia Livre — nunca para
ênfase.** Se você quer destacar uma palavra sua, use *itálico* ou nada. Aspas
de ênfase viram aviso de citação suspeita no portão, e aviso que é ruído esconde
o aviso que importa: o de Escritura inventada.

Citar **outro** livro da Bíblia é legítimo e às vezes necessário (um eco, uma
profecia). Nesse caso diga de onde é: *como Isaías 53 já dizia*. O que não pode
é apresentar como sendo deste trecho o que não está nele.

Isto existe porque o material anterior foi escrito sobre outra tradução, e
sobraram centenas de citações que não existem mais. Um leitor que procura a
frase no texto e não acha perde a confiança no app inteiro.

### 2. Use o `sobrescrito` quando ele existir

Ele é informação de verdade, não enfeite. "Salmo de Davi, quando fugia da
presença de seu filho Absalão" é a diferença entre um lamento genérico e uma
oração com data, lugar e uma faca nas costas. Quando o campo vier preenchido,
ele deve aparecer no contexto.

### 3. O texto é a Bíblia Livre — e ela é sua única fonte de citação

Nada de NAA, ARC, NVI ou de memória. Se a BLIVRE tem uma construção antiga
("E aconteceu que…"), você comenta o que está lá; não reescreve.

## Toda perícope é escrita do zero

Não existe material anterior. Você não recebe nenhum, e não deve procurar
nenhum em lugar nenhum do repositório — nem o que já está no app, nem o de uma
perícope vizinha.

O motivo é duplo. O material que existe hoje foi escrito sobre **outra
tradução**, então ele traz junto o vocabulário e as escolhas dela, que não são
as da Bíblia Livre. E, mais grave, ele carrega conhecimento tácito herdado: uma
frase que só funciona porque quem a escreveu sabia de algo que não está escrito
em lugar nenhum. Isso é o que faz o leitor desistir — ele sente que falta uma
peça e não tem como saber qual.

Sua única fonte é a perícope: o `texto`, o `sobrescrito` quando houver, e os
campos que você mesmo já escreveu nesta ordem. É por isso que a unidade de
trabalho é a perícope inteira, e não um campo: dentro dela, tudo o que o leitor
precisa tem de estar.

## Antes de entregar cada perícope

1. Toda frase entre aspas está, exata, no `texto`?
1b. A resenha termina com a lista das palavras do trecho — de 2 a 4 itens, cada
   um começando com `- ` e terminando em ponto — e tem no máximo 4 parágrafos?
   O contexto tem no máximo 2?
1c. Alguma frase sua só funciona para quem já sabia de alguma coisa? Diga essa
   coisa antes.
1d. Escreveu na ordem — contexto, resenha, perguntas, tópicos, título — e cada
   um com os anteriores na mão? Alguma informação aparece duas vezes?
1e. Releia procurando gíria, apelido, ironia ou familiaridade com o sagrado.
   Achou? Reescreva. Simplicidade não é coloquialismo.
1f. Alguma palavra difícil é SUA, e não do texto? Troque por uma simples.
2. Linha de raciocínio tem 5–7 bullets? Mensagens tem 4–6? Todas com negrito?
3. `perguntas_reflexao` tem exatamente 2?
4. Contexto e resenha entre 200 e 3.000 caracteres?
5. A resenha virou passeio versículo a versículo? Se sim, refaça.
6. O JSON abre e fecha limpo, sem cerca de código?
