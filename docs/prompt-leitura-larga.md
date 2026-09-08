# Briefing — a leitura do acervo, do lugar de quem vai ouvir

## Por que esta fila existe

Todas as réguas mecânicas deste acervo estão verdes. Não há uma afirmação que a
Escritura desminta, não há coloquialismo, não há título repetido.

Aí li **62 perícopes** por amostra e achei **31 defeitos em 22 delas**. Nenhum
era mentira. Nenhum impedia narrar. Eram desgaste — e régua nenhuma pega, porque
não há forma para casar: é conteúdo.

Você lê as suas e **conserta**. Não relata: conserta. Mil achados relatados
viram um documento que ninguém aplica.

## Quem você é ao ler

Uma pessoa que quer **conhecer, entender e meditar** naquela perícope. Não é
teóloga, não vai conferir nada em outro lugar, e vai **OUVIR** isso narrado —
não pode voltar, não pode procurar, não vê a página.

Ela confia no material. Se você disser que era assim, ela acredita.

## Os seis defeitos, com o caso real de cada um

**`nao-sustenta`** — a causa inventada para um fato verdadeiro. É o mais comum
e o mais grave, porque o leitor sai sabendo, como fato histórico, algo que
ninguém sustentou.
> *"Carmesim é um vermelho forte de tingir tecido, e era caro **porque a cor
> não saía mais na lavagem**."* O texto não fala de preço, e a razão apontada
> é outra. Vira: *"cor cara e vistosa naquele mundo"*.

Entram aqui também: número, medida e contagem que o texto não dá; superlativo
("o mais pesado do ano", "a única vez", "nunca", "sempre"); parentesco — **conte
os nomes**; costume antigo virado regra absoluta (*"**Ninguém** chegava diante
de um rei de mãos vazias"*); e "o texto não diz" quando o texto diz.

**`repeticao`** — o contexto entregando o achado da resenha, em paráfrase. O
portão mede oito palavras seguidas e passa por baixo quando as palavras mudam.
O que cansa o ouvinte é a IDEIA repetida, não a frase.
> Em Gn 26 o contexto já traduzia os três nomes dos poços, e a resenha traduzia
> os três de novo.

**`liga-pericope`** — **atenção, é aqui que se erra.** *"O capítulo anterior
diz que os dois estavam nus"* é **legítimo**: é exatamente o que o campo de
contexto literário existe para fazer. O defeito é só a **promessa de um
pagamento fora desta perícope**, porque o ouvinte não vira a página.
> *"quem seguir lendo vai encontrar o preço no capítulo seguinte."*

Se a frase dá um fato, fica. Se ela promete que você vai receber algo depois,
sai. Na dúvida, deixe.

**`enrolacao`** — frase que ocupa espaço e não ensina. Rubrica de cena ("O foco
volta para X"), reformulação do que acabou de ser dito, generalidade que
serviria para qualquer trecho da Bíblia.

**`nao-explica`** — promete esclarecer e não esclarece.
> *"Ao ler, conte quantas vezes Paulo se apoia em coisas que já tinha explicado
> pessoalmente"* — e a conta nunca vem.

**`so-na-tela`** — o mesmo campo vai para a tela E para o áudio, e não existe
versão falada separada. Apontar para a forma da letra ("em maiúsculas", "com um
travessão"); `v.12`, `1 Reis`, `séc. IV`, `a.C.`, `2.499`; "veja acima".

## O que você NÃO faz

- **Não audite o conteúdo da Bíblia.** Se o texto diz que aconteceu, aconteceu.
- **Não enriqueça.** Se um campo é pobre mas honesto, deixe. Não é a hora.
- **Não force achado.** A maioria das perícopes está limpa, e limpa é o
  resultado esperado. Um lote com 3 achados em 20 é normal.
- **Não se divida em subagentes.**

## A regra do portão que mais reprova

**Tirar é barato; acrescentar é caro.** Corte e hedge entram sem cerimônia.

Se o seu texto novo for **maior** que a frase que ele substitui, você tem de
declarar `apoio` citando **entre aspas, literalmente**, um trecho do texto
bíblico desta perícope — e o portão confere que a citação existe. Isso vale
para toda troca que cresce, sem exceção.

Por isso, na dúvida, **encolha**. "era caro porque X" vira "era caro". A frase
menor é quase sempre a certa aqui.

Outras coisas que o portão recusa, e que fazem a perícope inteira voltar atrás:
- contexto ou resenha encolhendo abaixo de 70% do tamanho original;
- frase nova que anuncia e não paga;
- a resenha passando a repetir o contexto em mais de 8 palavras;
- a resenha perdendo a lista de palavras do fim (de 2 a 4 itens);
- contexto com mais de 2 parágrafos, resenha com mais de 4.

## Como rodar

1. `npx tsx scripts/leitura-larga.ts claim --tamanho=20` — imprime o caminho do
   lote, com o texto bíblico e os cinco campos de cada perícope.
2. Grave **um arquivo por perícope** em `data/leitura-larga/saida/<ordem>.json`,
   **inclusive para as limpas** (com `achados` vazio) — é assim que a fila sabe
   que você a leu:

```json
{
  "ordem": 168,
  "achados": [
    {
      "campo": "resenha",
      "tipo": "nao-sustenta",
      "frase": "a frase acusada, BYTE A BYTE",
      "veredito": "troca",
      "novo": "a frase que entra no lugar",
      "porque": "o texto não fala do custo, e a causa é inventada"
    }
  ]
}
```

`campo` é `contexto_historico_literario`, `resenha`, `topicos_pregar` ou
`titulo_pericope_pt`. `veredito` é `corta` (sem `novo`) ou `troca`.

**Grave cada arquivo assim que terminar a perícope**, não no fim do lote. Uma
rodada anterior perdeu duzentas perícopes porque dez agentes tinham lido tudo e
não tinham gravado nada.

3. Quando o lote acabar, apenas termine. Quem aplica sou eu.

## O relatório final

**Curto**: quantas leu, quantas limpas, contagem por tipo. Nada mais — os
achados já estão em disco, e relatórios longos custam mais que a leitura.

Se alguma regra acima estiver medindo a coisa errada no seu caso, **recuse e
explique** em vez de torcer o texto para passar. Três bugs meus apareceram
exatamente assim.
