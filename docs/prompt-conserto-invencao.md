# Briefing — consertar o que a auditoria de invenção achou

## De onde vem esta fila

Um auditor leu as 2.823 perícopes com uma pergunta só: **o material afirma
alguma coisa que a Escritura não sustenta?** Sobraram 98 acusações vivas em 86
perícopes. Cada uma traz a frase acusada byte a byte, o versículo que a derruba
e o motivo.

Isso vai ser narrado. Cada frase errada que ficar vira áudio pago que ensina
coisa errada para quem confiou no material.

## As formas

- **`contradiz-versiculo`** — o material diz X e um versículo diz não-X.
  *"Davi nasceu três gerações depois de Obede"* — Rt 4:21-22: Obede gerou
  Jessé, Jessé gerou Davi. São duas.
- **`fato-inventado`** — número, nome, parentesco ou data que o texto não dá.
  *"os filisteus, que aparecem aqui pela primeira vez"* — já apareceram em
  Jz 3:3 e em Gn 21:34.
- **`silencio-falso`** — o material diz que o texto cala sobre algo, e não cala.
- **`contradiz-campo`** — dois campos da MESMA perícope dizem coisas opostas.
- **`costume-sem-fonte`** — apresenta como costume da época algo que a própria
  Lei proíbe, ou que ninguém pode apontar.

**O erro dominante não é alucinação: é generalização.** O material pega um caso
e o transforma em regra. *"O éfode de linho era a veste que identificava quem
servia como sacerdote"* — Davi (2Sm 6:14) e o menino Samuel (1Sm 2:18) o
vestiram sem ser sacerdotes. A frase não é falsa por inteiro; ela é
categórica onde o texto é particular. Quase sempre o conserto é **tirar a
régua e deixar o caso**: "aqui os mortos eram sacerdotes" em vez de "o éfode
identificava sacerdotes".

## Os três vereditos

Para cada acusação, um destes:

**`troca`** — põe outra frase no lugar. É o normal. A frase nova diz a verdade
que a frase velha queria dizer, e declara em que se apoia.

**`corta`** — tira a frase. Boa quando ela não fazia falta: era enfeite, ou
uma explicação que o parágrafo não precisava. Confira que a frase seguinte não
fica órfã (se ela começa por "Ela", "Isso", "Esse", precisa de antecedente).

**`recusa`** — a acusação está errada. **Isto é legítimo e esperado.** O
auditor erra: já aconteceu de quatro auditores acusarem uma glosa na forma
CORRETA dela. Se você ler a perícope e concluir que o material está certo,
recuse e escreva o motivo — eu leio uma por uma. O que não vale é recusar
para não trabalhar: recusa sem motivo é rejeitada pelo portão.

## Como escrever a frase nova

O `contexto_historico_literario` é o que o leitor precisa saber ANTES de ler.
A `resenha` é o que se vê lendo — informação interessante que explica por que
as coisas aconteceram daquele jeito, como numa boa crítica de cinema.

- **Diga menos e diga certo.** Se você não sabe qual era o costume, não invente
  um substituto: descreva o que a cena mostra.
- **Prefira o particular ao categórico.** "Nesta cena", "aqui", "neste caso"
  salvam metade das frases desta fila.
- **Não valide o conteúdo da Bíblia.** Se o texto diz que aconteceu, aconteceu.
  Você audita o que NÓS escrevemos, não a Escritura.
- **Não ligue esta perícope a outra.** A perícope é a unidade. Você pode citar
  outro versículo como APOIO de um fato, mas o material não manda o leitor a
  lugar nenhum ("como veremos em…", "compare com…").

## O apoio

Toda `troca` declara `apoio`: em que a frase nova se apoia.

- Se o apoio está no texto desta perícope, **cite entre aspas, literalmente**.
  O portão confere que a citação existe no texto — é a defesa contra trocar
  uma invenção por outra.
- Se o apoio é externo, escreva a referência sem aspas: `fora da perícope:
  Gn 35:22-26 lista os doze filhos de Jacó`.

## As regras que o portão confere sozinho

- A frase acusada tem de estar no material **byte a byte**. Não parafraseie.
- Depois do conserto, **a resenha não pode repetir o contexto em mais de 8
  palavras seguidas** (citação entre aspas não conta).
- **Nada de frase que anuncia e não paga.** "Repare em duas coisas", "Note o
  que acontece" — se não disser no quê na mesma frase, o portão recusa.
- **Nada de convenção que o TTS lê errado.** Nunca `v.12`, `1 Reis`, `séc. IV`,
  `a.C.`, `2.499`. Por extenso: "o versículo doze", "o Primeiro Livro de Reis",
  "o século quatro", "antes de Cristo". **Este campo vai para a tela E para o
  áudio** — não existe versão falada separada.
- **Nada de apontar para a forma da letra.** Nada de "SENHOR em maiúsculas",
  "entre colchetes", "escrito assim". Diga o que a distinção SIGNIFICA.
- Contexto: no máximo 2 parágrafos. Resenha: no máximo 4, contando o parágrafo
  final da lista de palavras. O que passa do teto some da tela e do áudio sem
  erro nenhum — `MAX_PARAGRAFOS` em `src/lib/paragraphize.ts` é a fonte.

Se qualquer conserto do arquivo reprovar, **a perícope inteira volta atrás** —
nada fica pela metade.

## Como rodar

1. `npx tsx scripts/conserto-invencao-fila.ts claim --tamanho=12` — imprime o
   caminho do lote. Cada perícope traz o texto bíblico, os campos inteiros e as
   acusações com o versículo que as sustenta.
2. Grave **um arquivo por perícope** em
   `data/conserto-invencao/saida/<ordem>.json`:

```json
{
  "ordem": 1234,
  "consertos": [
    {
      "afirma": "a frase acusada, byte a byte",
      "veredito": "troca",
      "novo": "a frase nova",
      "apoio": "\"e Obede gerou a Jessé\" — o texto da perícope"
    },
    { "afirma": "outra frase", "veredito": "corta" },
    { "afirma": "uma terceira", "veredito": "recusa", "motivo": "o auditor leu o versículo errado: o texto diz…" }
  ]
}
```

**Grave cada arquivo assim que terminar a perícope**, e não no fim do lote.

3. Quando o lote acabar, apenas termine. Quem aplica sou eu.

## Uma última coisa

Não se divida em subagentes — a fila já é o paralelismo, e forks que trabalham
no mesmo lote se sobrescrevem.

E se alguma regra acima estiver medindo a coisa errada no seu caso: **recuse e
explique**, em vez de torcer o texto para passar. Três bugs meus apareceram
exatamente assim.
