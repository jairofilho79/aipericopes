# Briefing — caça-invenção

Você audita **o que nós escrevemos sobre a Bíblia**, nunca a Bíblia. Se a
história diz que o profeta foi comido por um leão, a história é essa.

## Ordem de trabalho

1. Leia a skill: `.claude/skills/caca-invencao/SKILL.md`. Ela é a régua.
   **NÃO abra `gabarito.md`** — tem respostas de teste lá dentro.
2. Leia o seu lote em `data/invencao/lotes/`. Ele já traz o texto bíblico e os
   cinco campos de cada perícope. **Não abra `data/pericopes.json`** (40 MB).
3. Escreva `data/invencao/saida/<ordem>.json` — uma por vez, assim que terminar.
   Não acumule: uma rodada deste projeto perdeu duzentas perícopes porque dez
   agentes tinham lido tudo e não tinham gravado nada.

## Formato

```json
{
  "ordem": 1234,
  "invencoes": [
    { "campo": "resenha",
      "afirma": "<citação byte a byte do material acusado>",
      "forma": "contradiz-versiculo | contradiz-campo | fato-inventado | silencio-falso | costume-sem-fonte",
      "desmentido_por": "<referência, e o que ela diz>",
      "porque": "<uma linha>" }
  ],
  "sobrou": [
    { "versiculos": "19:26-31", "assunto": "<o que esses versículos tratam>",
      "porque": "<por que a tese do material não alcança>" }
  ]
}
```

As duas listas podem vir vazias, e frequentemente virão. Grave o arquivo mesmo
assim — é como a fila sabe que a perícope foi auditada.

## A regra do "vá olhar"

**Invenção não se acha lendo, acha-se procurando.** Uma versão desta skill tirou
2 de 5 no gabarito, e as três que escaparam só apareciam para quem foi buscar um
versículo em outro livro. Use a busca — não escreva a sua:

```
node .claude/skills/leitor-cetico/scripts/buscar.mjs "regex" [limite]
node .claude/skills/leitor-cetico/scripts/buscar.mjs --ref "Lv 7:8"
```

Três gatilhos obrigam busca: o material **afirma um silêncio** ("o texto não
explica…"), **define uma palavra ou instituição** ("juiz é quem…"), ou **dá um
número, medida ou preço**. Perícope sem nenhuma busca não foi auditada.

## Duas coisas que fazem o trabalho ser descartado

**Citação que não bate.** O portão confere `includes` byte a byte. Copie e cole.

**Acusação sem o versículo que desmente.** Confira com `--ref` antes de acusar.

## Não force achado

Material sadio existe e é comum. Auditor que acha invenção em toda perícope está
cumprindo tabela, e cada acusação falsa manda reescrever material que estava bom.

E o falso positivo campeão: **tensão não é contradição.** Dt 1:22 diz que o povo
pediu para espiar a terra; Nm 13:1 diz que Deus mandou. As duas estão no texto.
Material que conta só uma está incompleto, não inventando — e isso não é assunto
seu aqui.

Rascunho com nome único do lote — o scratchpad NÃO é isolado entre agentes.

**Não se divida em subagentes para acelerar.** Um auditor tentou: abriu três
forks, e os três auditaram o lote inteiro em vez de uma fatia cada, gravando por
cima uns dos outros. O trabalho saiu certo e custou o triplo. A fila já é o
paralelismo — cada lote é de um agente só, do começo ao fim.
