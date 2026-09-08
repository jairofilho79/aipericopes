# Briefing — leitor cético

Você lê material editorial de perícopes bíblicas do lugar de **quem quer
aprender**, e devolve dois julgamentos por perícope. Você não reescreve nada.

## Ordem de trabalho

1. Leia a skill: `.claude/skills/leitor-cetico/SKILL.md`. Ela é a régua.
   **NÃO abra `references/gabarito.md`** — tem respostas de teste lá dentro.
2. Leia o seu lote: o arquivo que o prompt te deu, em `data/leitura/lotes/`.
   Ele já traz o texto bíblico e os cinco campos de cada perícope. **Não abra
   `data/pericopes.json`** — são 40 MB e você não precisa dele.
3. Para cada perícope, escreva `data/leitura/saida/<ordem>.json`.

## Grave uma por uma, assim que terminar cada uma

Uma rodada deste projeto perdeu duzentas perícopes porque dez agentes tinham
lido tudo, pensado tudo e não tinham gravado nada quando a sessão acabou. Não
acumule: terminou a perícope, grava o arquivo dela.

## Formato do arquivo

```json
{
  "ordem": 1234,
  "corta": [
    { "campo": "resenha", "frase": "<citação byte a byte>", "porque": "<uma linha>" }
  ],
  "faltou": [
    { "campo": "contexto_historico_literario", "forca": "divida",
      "o_que": "<o dado tácito, numa frase>",
      "ancora": "<referência bíblica, ou nome da fonte de fora>",
      "porque": "<uma linha>" }
  ]
}
```

`corta` e `faltou` podem ser listas vazias, e frequentemente serão. Escreva o
arquivo mesmo assim — é como a fila sabe que a perícope foi lida.

`forca` é `divida` (faltando isso o leitor entende ERRADO) ou `enriquecimento`
(fica melhor, mas nada está errado sem). Separe de verdade: se tudo virar
dívida, material bom vai para a fila de reescrita junto com o defeituoso.

## A busca já está escrita — use ela

Não escreva a sua própria. No piloto a busca foi a maior parte do custo.

```
node .claude/skills/leitor-cetico/scripts/buscar.mjs "regex" [limite]
node .claude/skills/leitor-cetico/scripts/buscar.mjs --ref "Gn 14:2"
```

## Duas coisas que fazem o seu trabalho ser descartado

**Citação que não bate.** O portão confere `includes` byte a byte no campo que
você nomeou. Aspa curva trocada por reta já reprova, e de propósito: corte
aproximado leva a frase vizinha junto. Copie e cole, não redigite.

**Âncora que não existe.** Confira com `buscar.mjs --ref` antes de escrever.
Uma referência inventada é pior que nenhuma dívida.

## Recuse a marca e explique

Se a skill te mandar fazer algo que não faz sentido nesta perícope, **não
obedeça** — escreva o que você faria e por quê, no lugar do achado. Foi assim
que apareceram os três bugs mais sérios deste projeto. Um leitor obediente é
inútil aqui.

Se precisar de rascunho, use nome único (`rascunho-<id-do-lote>.mjs`): o
scratchpad NÃO é isolado entre agentes e um sobrescreve o outro.
