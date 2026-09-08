# Briefing — a frase pendurada

23% dos contextos fecham mandando o leitor reparar em alguma coisa. O dono do
projeto leu isso e foi direto:

> "Se algo que era para explicar, não explica nada... isso está errado demais.
> **Ou tira, ou de fato faz uma explicação** (que deveria ser o certo)."

Seu trabalho é decidir, uma a uma, qual das três.

## O julgamento

Cada entrada traz `frase` (a candidata), `contexto` inteiro, `resenha` e o
`texto` bíblico. Tape a frase com o polegar e pergunte: **o leitor perdeu um
fato, um nome, um número, uma razão ou uma ligação?**

**`entrega`** — a frase anuncia e entrega na mesma respiração. Mantém.
> "Guarde isso ao ler: o pai tem só mais um filho daquela mulher, e esse ainda
> é criança."

Ela carrega o fato. Não se corta. Essas existem e não são raras — o regex que
te trouxe aqui não sabe distinguir, e é para isso que você está lendo.

**`responde`** — a frase manda reparar em algo cuja resposta **está ali**, no
texto bíblico da perícope ou na resenha. Então responda: escreva a frase que
diz o que ela mandava procurar. É o caminho preferido, e quase sempre é o certo.
> antes: "Repare em quem, dentro da história, também percebe essa presença."
> depois: "Potifar percebe: o texto diz que ele viu que o SENHOR estava com José."

**`corta`** — a frase manda reparar em algo que você não consegue responder
sem inventar, ou cuja resposta a resenha já dá por inteiro logo adiante. Sai.

## Regras que o portão confere sozinho

- A frase nova **não pode ser outra frase pendurada**. Trocar "repare em X" por
  "note também Y" é o modo de falha mais fácil daqui, e é recusado.
- A frase nova diz o que o texto diz. Nada de costume antigo sem fonte, nada de
  número que você não conferiu. Se precisar checar um versículo:
  `node .claude/skills/leitor-cetico/scripts/buscar.mjs --ref "Gn 37:3"`
- Não mexa em mais nada do contexto. Só nesta frase.

## Formato

Um arquivo por perícope em `data/pendurada/saida/<ordem>.json`, gravado assim
que você terminar cada uma — não acumule:

```json
{ "ordem": 62, "veredito": "responde", "novo": "Potifar percebe: o texto diz que ele viu que o SENHOR estava com José." }
```

`entrega` e `corta` não levam `novo`.

## Recuse a marca e explique

Se a frase não couber em nenhuma das três, **não force** — grave o veredito que
você acha certo e diga por quê no relatório. Três bugs sérios deste projeto
apareceram assim.
