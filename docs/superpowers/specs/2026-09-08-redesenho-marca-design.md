# A marca nova, em três níveis de leitura (2026-09-08)

O dono escolheu uma marca ilustrada — Bíblia aberta, candeia acesa e trilhas de
circuito na página esquerda — e ela passa a ser a marca do aiPericopes. Esta
spec diz como levá-la para dentro do app sem perdê-la nos tamanhos em que ela
não cabe, e o que fazer com o texto "aiPericopes", que no arquivo original vem
desenhado numa sem-serifa geométrica.

Depende da spec de tipografia (`2026-09-08-redesenho-tipografia-design.md`):
o texto da marca passa a ser tipografado em Cormorant Garamond, não desenhado.

## O estado de hoje

A marca atual é um monograma: as letras `ai` em DM Sans 750 convertidas em
contorno, com a haste do `i` virando vela e o pingo virando chama em âmbar vivo
(`public/favicon.svg`, 12 linhas, `viewBox="0 0 512 512"`). Dela derivam, por
`scripts/gerar-icones.sh`:

- `public/brand/marca-plena.svg` — sangria total, para ícone maskable e
  apple-touch;
- `public/brand/logo.png`, `public/brand/logo-master.png`,
  `public/favicon.png`, `public/favicon.ico`.

No header, `src/App.tsx` monta `[ícone 32×32 do favicon.svg] + wordmark
"aiPericopes"`, com o `ai` em `--accent` (regras `.brand`, `.brand-mark`,
`.brand-wordmark` em `src/styles/app.css`). O `--chama-svg` de `app.css` é uma
data-URI com a silhueta da chama, reaproveitada pelo `.streak-chama`.

A marca nova está em `public/brand/modelo/m3-carvao-limpo.svg` (viewBox
`0 0 1971 2048`, ~46 KB, com gradientes e o texto "aiPericopes" já desenhado
em contorno).

## Decisões de partida

Tomadas com o dono antes desta spec, não reabertas aqui:

1. A marca é a que ele escolheu. Nada de propor outra.
2. O texto embutido no arquivo sai; o nome passa a ser tipografado em Cormorant
   Garamond, para o app não ter mais nenhum ponto falando em sem-serifa.
3. A grafia continua `aiPericopes`, sem acento, por causa do domínio.
   `aiPerícopes` fica registrado como alternativa se o dono quiser depois.
4. Cores: as do desenho já são as da paleta (carvão `#1c1914`, âmbar `#db8d3e`,
   creme `#f0e0c0`, sombra `#403631`). Nenhuma é alterada, nem no desenho nem
   nos tokens do app.

## O problema que a spec resolve

A ilustração tem três objetos (livro, candeia, circuito), hachura nas páginas,
uma cruz gravada e uma sombra projetada. Reduzida a 32 px — que é exatamente o
tamanho do favicon e do ícone do header — todos ocupam o mesmo punhado de
pixels e nenhum sobrevive.

A prova está em `docs/redesenho/marca/ilustracao-em-tamanho-pequeno.png`: a
mesma arte a 64, 32 e 20 px, ampliada por vizinho-mais-próximo. A 64 ainda se
lê; a 32 vira mancha; a 20 é ilegível.

A saída não é trocar a marca. É dar a ela **duas reduções da mesma família** —
mesma paleta, mesmo contorno de carvão, mesma cena — e usar cada uma na faixa
de tamanho em que ela funciona.

## Os três níveis

Arquivos-fonte em `docs/redesenho/marca/`. A prova visual da escala está em
`docs/redesenho/marca/escala-de-reducao.png`.

### 1. Marca plena — de 96 px para cima

A ilustração como o dono a escolheu, **sem o texto embutido**: recorte apenas a
parte de cima de `public/brand/modelo/m3-carvao-limpo.svg`. No render de
referência a 1600 px, a ilustração ocupa `y` de 477 a 1062 e `x` de 336 a 1236;
o texto ocupa `y` de 1125 a 1334. O recorte deve ser feito **no SVG**, apagando
os paths do texto, não rasterizando.

Onde entra: splash da PWA, página `/sobre`, imagem de compartilhamento
(og:image), ícone da loja/maskable.

### 2. Símbolo reduzido — de 40 a 96 px

`docs/redesenho/marca/simbolo.svg`, `viewBox="0 0 120 120"`. Mesma cena, com o
que não sobrevive removido:

- sai a hachura das linhas de texto das páginas;
- sai a cruz gravada na página direita;
- sai a sombra projetada;
- as trilhas de circuito viram dois traços de 2 px com quatro nós de r=1,8;
- o contorno cai de muito grosso para 4 px no livro e 3,6 px na candeia;
- a candeia ganha um **halo** de 7 px na cor `--bg` desenhado por baixo dela,
  para separá-la do contorno do livro — sem ele, candeia e livro viram um
  borrão único já aos 44 px.

Onde entra: ícone do app na tela inicial, apple-touch-icon, cabeçalho em telas
largas, qualquer lugar entre 40 e 96 px.

### 3. Glifo — até 32 px

`docs/redesenho/marca/glifo.svg` (tema claro) e
`docs/redesenho/marca/glifo-noite.svg` (tema escuro), `viewBox="0 0 120 120"`.

Só a candeia acesa: bojo, bico, alça, pé e a chama em cima. Um objeto só, que
se lê a 16 px — verificado no render de referência. O contorno é
carvão `#1c1914` no claro e creme `#f0e0c0` no escuro; o âmbar `#db8d3e` não
muda entre os temas.

Onde entra: favicon (16/32), aba do navegador, marca no header do app,
notificação, e o `.brand-mark` de `src/App.tsx`.

Nota honesta: neste nível a Bíblia e o circuito desaparecem — não cabem. O que
sobra é a candeia, que é o objeto mais distintivo dos três e o que carrega o
significado central (a revelação da Palavra). Quem chega ao app pela primeira
vez encontra a marca plena na splash e no Sobre; o glifo é o que ele reconhece
depois, na aba.

## O texto da marca

Deixa de ser desenho e passa a ser texto tipografado, na fonte de título:

```
font-family: var(--font-display);   /* Cormorant Garamond */
font-size: 24px;                    /* no header do app */
font-weight: 600;
letter-spacing: 0.008em;
```

com o `ai` em `font-weight: 700` e `color: var(--accent)`, exatamente como
hoje. O peso 600 é mais cheio do que os títulos do app (que são 300) e isso é
deliberado: ao lado de um desenho de contorno grosso, um Garamond leve
desaparece.

Travas: `white-space: nowrap` no wordmark, e nunca caixa alta.

### Travessões de uso

- Não usar a marca plena abaixo de 96 px.
- Não recolorir nenhum dos três níveis.
- Não pôr o texto embutido de volta.
- Não espelhar nem girar: a candeia entra sempre pela esquerda.
- Não usar o glifo acima de 40 px quando houver espaço para o símbolo.

## O que muda no repositório

1. **Criar** `public/brand/marca-plena.svg` (novo conteúdo: a ilustração sem
   texto), `public/brand/simbolo.svg`, `public/brand/glifo.svg`,
   `public/brand/glifo-noite.svg`, a partir dos fontes em
   `docs/redesenho/marca/`.
2. **Regerar** `public/favicon.svg` a partir do glifo, e com ele
   `public/favicon.png`, `public/favicon.ico`, `public/brand/logo.png`,
   `public/brand/logo-master.png` — via `scripts/gerar-icones.sh`, que precisa
   ser revisto para partir de três fontes em vez de uma. O script é a única
   coisa que gera PNG a partir de SVG; não editar PNG à mão.
3. **Alterar** `src/App.tsx`: o `.brand-mark` passa a apontar para o glifo, com
   troca por tema (o glifo-noite no escuro). Verificar se `data-theme` já está
   disponível no ponto de montagem ou se a troca precisa ser feita em CSS com
   `content`/`background-image`.
4. **Alterar** `src/styles/app.css`: `.brand-wordmark` ganha os valores acima.
   O token `--chama-svg` (usado pelo `.streak-chama`) deve ser regerado a
   partir da chama do glifo novo, para o streak e a marca falarem a mesma
   forma.
5. **Alterar** `index.html`: `theme-color` continua `#92500a`; os `<link
   rel="icon">` passam a apontar para os arquivos novos, com `sizes`
   declarados para o navegador escolher entre glifo e símbolo.
6. **Alterar** `src/pages/Sobre.tsx`: a marca plena entra na página, e o texto
   sobre a cor âmbar continua valendo sem mudança.

## Fora do escopo

- Trocar o nome do produto.
- Animar a chama da marca.
- Qualquer mudança de cor.
- A pasta `public/brand/modelo/`, que é material de referência do dono e fica
  como está.

## Verificação

1. Abrir o app numa aba e conferir o favicon a 16 px: a candeia se lê.
2. Adicionar à tela inicial no celular: o símbolo reduzido se lê a 44 px.
3. Alternar tema claro/escuro com o header à vista: o contorno do glifo troca
   de carvão para creme e o âmbar não muda.
4. `/sobre` mostra a marca plena, com o texto tipografado e não desenhado.
5. Buscar por `DM Sans` no repositório: não deve sobrar nenhuma ocorrência
   ligada à marca.
