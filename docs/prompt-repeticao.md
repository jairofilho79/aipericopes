# Briefing — a resenha que repete o contexto

## O defeito

Cada perícope do app tem cinco campos. Dois deles são texto corrido:

- **`contexto_historico_literario`** — o que o leitor precisa saber ANTES de
  ler o trecho bíblico. Conhecimento tácito virando explícito: quem é esse
  povo, o que era esse costume, onde isso cai na história.
- **`resenha`** — o que se vê LENDO. É uma resenha no sentido de crítica de
  cinema: informação interessante que explica por que as coisas aconteceram
  daquele jeito, e o que o texto não diz.

Numa campanha anterior eu troquei, no `contexto`, centenas de frases que
mandavam o leitor "reparar em algo" sem dizer no quê. Em 75 perícopes a
resposta que escrevi era **o fato que a resenha já entregava**, às vezes com as
mesmas palavras. Exemplo real (Is 23):

> **contexto:** "…o comércio de Tiro é consagrado a ele **e vira comida farta e
> roupa de boa qualidade para os que servem diante dele** — o dinheiro
> continua o mesmo, muda a mão que o recebe."
>
> **resenha:** "…**e vira comida farta e roupa de boa qualidade para os que
> servem diante dele**."

O leitor ouve a mesma coisa duas vezes e paga narração pelas duas. O dono foi
explícito sobre isso: *"tentar explicar sendo repetitivo é desrespeito com o
usuário"*.

## Sua tarefa

Para cada perícope do lote, decida **qual dos dois campos cede o trecho
repetido** e reescreva **esse campo inteiro**.

Quase sempre quem cede é o **contexto**, porque a informação que ele antecipou
é justamente a que a resenha existe para entregar. Mas nem sempre: se o trecho
é conhecimento de fundo (um costume, uma medida, um cargo) que o leitor precisa
ANTES, ele pertence ao contexto e quem cede é a resenha.

**Não é para cortar e pronto.** Tirar a duplicata deixa um buraco, e o campo
tem de continuar fazendo o trabalho dele. Três saídas boas, nesta ordem de
preferência:

1. **Trocar por outra coisa verdadeira e necessária.** O contexto perdeu o
   fato? Ponha ali o que o leitor precisa saber antes e ainda não sabe — a
   geografia, o costume, a posição no livro, o que a palavra significava.
2. **Generalizar de um lado e detalhar do outro.** O contexto diz que existe
   um padrão de cinco passos; a resenha enumera os cinco. Um anuncia a forma,
   o outro mostra o conteúdo — e aí não há repetição, há preparo.
3. **Cortar,** quando a frase realmente não fazia falta. É a última opção, não
   a primeira.

## As regras que o portão confere sozinho — leia antes de escrever

O `aplicar` recusa e devolve. Você economiza uma rodada se já escrever certo:

- **O campo não pode encolher abaixo de 60% do tamanho original.** Esvaziar
  faz a repetição sumir e é a saída preguiçosa.
- **Sobrar mais de 8 palavras seguidas em comum entre os dois campos reprova.**
  Citação bíblica entre aspas não conta — Escritura repetida é legítima.
- **Nada de frase que anuncia e não paga.** "Repare em duas coisas", "Note o
  que acontece", "Vale prestar atenção" — se você escrever isso e não disser
  no quê, na mesma frase, o portão recusa. Esse tique é o que a campanha
  anterior tirou; não o traga de volta.
- **Nada de convenção que o TTS lê errado.** Nunca `v.12`, `1 Reis`, `séc. IV`,
  `a.C.`, `2.499`. Escreva por extenso: "o versículo doze", "o Primeiro Livro
  de Reis", "o século quatro", "antes de Cristo", "dois mil quatrocentos e
  noventa e nove". **Este mesmo campo vai para a tela E para o áudio** — não
  existe versão falada separada.
- **Nada de apontar para a forma da letra na tela.** Nada de "SENHOR em
  maiúsculas", "a palavra entre colchetes", "escrito assim". Diga o que a
  distinção SIGNIFICA.
- **Só um campo muda.** O outro fica byte a byte como está.
- Contexto: no máximo 2 parágrafos. Resenha: no máximo 4, contando o parágrafo
  final da lista de palavras. O que passa do teto some da tela e do áudio sem
  erro nenhum — `MAX_PARAGRAFOS` em `src/lib/paragraphize.ts` é a fonte.

## O que você NÃO faz

- **Não valide o conteúdo da Bíblia.** Se o texto diz que aconteceu, aconteceu.
- **Não invente.** Nada de número, parentesco, costume ou definição que você
  não consiga apontar no texto da perícope. Se não tem certeza, não escreva.
- **Não ligue esta perícope a outra.** A perícope é a unidade, e explicar cada
  pedaço por si só é o projeto inteiro. Você pode citar outro versículo como
  APOIO de um fato, mas o material não manda o leitor a lugar nenhum.
- **Não se divida em subagentes.** A fila já é o paralelismo, e forks que
  auditam o mesmo lote se sobrescrevem.

## Como rodar

1. `npx tsx scripts/repeticao-fila.ts claim --tamanho=15` — imprime o caminho
   de um arquivo de lote. Ele já traz, para cada perícope: o texto bíblico, os
   dois campos inteiros, e o trecho literal que está repetido.
2. Para cada uma, grave **um arquivo por perícope** em
   `data/repeticao/saida/<ordem>.json`:

```json
{
  "ordem": 1202,
  "campo": "contexto_historico_literario",
  "novo": "O campo inteiro reescrito, com os parágrafos separados por linha em branco."
}
```

`campo` é `"contexto_historico_literario"` ou `"resenha"`.

**Grave cada arquivo assim que terminar a perícope**, e não no fim do lote.
Uma rodada anterior perdeu duzentas perícopes porque dez agentes tinham lido
tudo, pensado tudo e não tinham gravado nada.

3. Quando o lote acabar, apenas termine. Quem aplica sou eu.

## Se você discordar do portão

Recuse e explique, em vez de obedecer. Três bugs meus apareceram assim: se
alguma regra acima estiver medindo a coisa errada no seu caso, escreva o
motivo no relatório final em vez de torcer o texto para passar.
