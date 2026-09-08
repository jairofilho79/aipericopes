# Briefing — a sobra: o versículo que nenhum campo trata

## O defeito

Cada perícope cobre uma faixa de versículos, e os campos editoriais deveriam
dar conta dela inteira. **Sobra é versículo que está dentro da perícope e que
nenhum campo toca.**

Não é mentira. É silêncio. O material escolheu uma tese boa e ela não alcançou
o fim do trecho. Exemplo real (Êx 3, versículos 16 a 20):

> A tese do material é a revelação do nome na sarça, e o fecho do resumo salta
> da revelação do nome direto para o saque final. O plano prático de abordagem
> a Faraó e a previsão da resistência dele não aparecem em nenhum campo.

O leitor vai ouvir a narração inteira, chegar no texto bíblico, ler sobre os
três dias no deserto e a mão forte — e não terá recebido uma palavra sobre isso.

## A restrição que governa tudo aqui

**Não há espaço.** As 25 perícopes desta fila já estão no teto: o
`contexto_historico_literario` com 2 parágrafos de 2, a `resenha` com 4 de 4.

O que passa do teto **não dá erro**: a leitura descarta silenciosamente, e o
excedente some da tela, do áudio e do realce. Um parágrafo a mais aqui
perderia mais do que a sobra que ele veio cobrir.

Então cobrir uma sobra é **caber dentro dos parágrafos que já existem**:
apertar o que está frouxo e abrir uma ou duas frases. O portão recusa qualquer
mudança no número de parágrafos, recusa o campo que cresça mais de 25%, e
recusa o campo que encolha — sobra não se cobre cortando.

## Sua tarefa

Para cada perícope do lote:

1. Leia o texto bíblico inteiro e os dois campos.
2. Veja o que a sobra descreve — a entrada traz os versículos e o assunto.
3. Decida **em qual campo ela cabe**. Se é conhecimento que o leitor precisa
   ANTES (um costume, uma medida, um cargo), vai no contexto. Se é o que se vê
   lendo, vai na resenha.
4. Reescreva **esse campo inteiro**, abrindo espaço para uma ou duas frases que
   tratem a sobra. Você pode enxugar uma frase existente que esteja prolixa —
   mas não corte informação que o campo entrega.

**Uma ou duas frases bastam.** A sobra não precisa do mesmo tratamento que a
tese principal; ela precisa de existir. "E antes de mandar, Deus já avisa que o
rei do Egito não vai deixar o povo ir, a não ser por mão forte" fecha o buraco
de Êx 3 numa linha.

## O apoio — a regra mais importante desta fila

Esta é a **única** fila desta sessão em que se ACRESCENTA material, e
acrescentar é onde a invenção nasce. Por isso:

**Toda saída declara `apoio`, e o apoio TEM de citar o texto da perícope entre
aspas, literalmente.** O portão confere que a citação existe. Se você não
conseguir apontar com o dedo, no texto, a frase que sustenta o que escreveu,
não escreva.

Nada de "naquela época era costume…", "os estudiosos entendem que…", nada de
número, parentesco ou data que o texto não dê.

## As outras regras que o portão confere

- **Nada de frase que anuncia e não paga.** "Repare em duas coisas", "Note o
  que vem" — se não disser no quê na mesma frase, o portão recusa.
- **Nada de convenção que o TTS lê errado.** Nunca `v.12`, `1 Reis`, `séc. IV`,
  `a.C.`, `2.499`. Por extenso: "o versículo doze", "o Primeiro Livro de Reis",
  "o século quatro", "antes de Cristo". **Este campo vai para a tela E para o
  áudio.**
- **Nada de apontar para a forma da letra** ("SENHOR em maiúsculas", "entre
  colchetes"). Diga o que a distinção SIGNIFICA.
- A resenha não pode repetir o contexto em mais de 8 palavras seguidas
  (citação entre aspas não conta).
- A resenha fecha com a lista de palavras do trecho, de 2 a 4 itens. Mantenha.
- **Não ligue esta perícope a outra.** A perícope é a unidade.

## Como rodar

1. `npx tsx scripts/sobra-fila.ts claim --tamanho=9` — imprime o caminho do lote.
2. Grave **um arquivo por perícope** em `data/sobra/saida/<ordem>.json`:

```json
{
  "ordem": 81,
  "campo": "resenha",
  "novo": "o campo inteiro reescrito, com os mesmos parágrafos",
  "apoio": "\"o rei do Egito não vos deixará ir, nem ainda por uma mão forte\" — o texto da perícope"
}
```

**Grave cada arquivo assim que terminar a perícope**, e não no fim do lote.

3. Quando o lote acabar, apenas termine. Quem aplica sou eu.

Não se divida em subagentes — a fila já é o paralelismo. E se alguma regra
acima estiver medindo a coisa errada no seu caso, **recuse e explique** no
relatório final, em vez de torcer o texto para passar.
