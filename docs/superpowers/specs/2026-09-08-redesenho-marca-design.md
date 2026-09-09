# A marca nova, em dois níveis de leitura (2026-09-08)

O dono escolheu uma marca ilustrada — Bíblia aberta, candeia acesa e trilhas de
circuito na página esquerda — e ela passa a ser a marca do aiPericopes. Esta
spec diz como levá-la para dentro do app, em que enquadramento ela entra em
cada lugar, e o que fazer com o texto "aiPericopes", que no arquivo original vem
desenhado numa sem-serifa geométrica.

Depende da spec de tipografia (`2026-09-08-redesenho-tipografia-design.md`):
o texto da marca passa a ser tipografado em Cormorant Garamond, não desenhado.

## O estado de hoje

A marca atual é um monograma: as letras `ai` em DM Sans 750 convertidas em
contorno, com a haste do `i` virando vela e o pingo virando chama em âmbar vivo
(`public/favicon.svg`, 12 linhas, `viewBox="0 0 512 512"`). Dela derivam, por
`scripts/gerar-icones.sh`:

- `public/brand/marca-plena.svg` — sangria total, hoje a fonte do ícone
  maskable e do apple-touch;
- `public/brand/logo.png`, `public/brand/logo-master.png`,
  `public/favicon.png`, `public/favicon.ico`, `public/pwa-192.png`,
  `public/pwa-512.png`, `public/pwa-512-maskable.png`,
  `public/apple-touch-icon.png`.

No header, `src/App.tsx` monta `[ícone 32×32 do favicon.svg] + wordmark
"aiPericopes"`, com o `ai` em `--accent` (regras `.brand`, `.brand-mark`,
`.brand-wordmark` em `src/styles/app.css`). O `--chama-svg` de `app.css` é uma
data-URI com a silhueta da chama, reaproveitada pelo `.streak-chama`.

A marca nova chegou como três arquivos, ainda não versionados, em
`public/brand/Marca SVGs/` do worktree principal:

- `marca-icone.svg` — tema claro, `width`/`height` 1024,
  `viewBox="340 325 1250 1250"`, um `<rect x="340" y="325" width="1250"
  height="1250" fill="#fefefc"/>` de fundo cobrindo a viewBox inteira e um
  `<g clip-path="url(#corteIcone)">` com as 122 formas da arte, cujo clip é
  `<rect x="340" y="535" width="1250" height="830"/>`.
- `marca-icone-noite.svg` — tema escuro, mesma viewBox, mesmas 122 formas e o
  mesmo recorte (aqui declarado como `<path d="M340 535h1250v830H340z"/>`
  dentro de `<clipPath id="a">`). O fundo é `#1c1914` em sangria total, os
  contornos são creme `#f0e0c0` e, por cima do grupo recortado, entram duas
  camadas de `radialGradient`: uma vinheta que escurece as bordas e um halo
  quente `#ffdca8` centrado na cena, que morre antes das bordas. O âmbar
  `#db8d3e` é o mesmo nos dois arquivos.
- `marca-completa.svg` — a arte inteira, `viewBox="0 0 1971 2048"`, sem
  recorte, com o wordmark "aiPericopes" desenhado em contorno.

Os três compartilham o mesmo sistema de coordenadas e as mesmas formas: os
ícones não são um redesenho, são uma janela sobre a arte completa. O recorte em
`y` de 535 a 1365 é exatamente o que deixa o wordmark de fora, porque os paths
do texto começam em `y` 1388 e descem até o pé da arte.

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
5. Os dois SVGs de ícone aprovados pelo dono são a referência definitiva. Os
   estudos anteriores de redução — o símbolo de `viewBox="0 0 120 120"` e o
   glifo da candeia sozinha — saem do escopo e não são fonte de nada.

## O problema que a spec resolve

A ilustração tem três objetos (livro, candeia, circuito), hachura nas páginas,
uma cruz gravada e uma sombra projetada. Reduzida a 32 px — que é exatamente o
tamanho do favicon e do ícone do header — todos ocupam o mesmo punhado de
pixels e nenhum sobrevive inteiro.

A prova está em `docs/redesenho/marca/ilustracao-em-tamanho-pequeno.png`: a
mesma arte a 64, 32 e 20 px, ampliada por vizinho-mais-próximo. A 64 ainda se
lê; a 32 vira mancha; a 20 é ilegível.

A saída que o dono escolheu não é redesenhar a cena em versões mais simples: é
tirar o wordmark do caminho, para que a arte inteira ocupe todo o quadrado do
ícone em vez de dividir espaço com o texto. O que a spec resolve, então, é onde
cada enquadramento entra e como a versão certa aparece em cada tema.

Nota honesta: a 16 px o ícone não se lê como três objetos. Ele se lê como uma
mancha escura de livro com um ponto âmbar de chama em cima, e é isso que o
distingue na aba. O dono aceitou esse resultado e recusou as reduções
redesenhadas, que perdiam a cena para ganhar legibilidade.

## Os dois níveis

### 1. Ícone — de 16 px a 512 px

`public/brand/marca-icone.svg` no tema claro e
`public/brand/marca-icone-noite.svg` no escuro, cópias dos dois arquivos
aprovados. São a mesma cena, no mesmo recorte, dentro de um quadrado de 1250 por
1250 que dá respiro acima e abaixo da ilustração.

Onde entra: o `.brand-mark` do header, o favicon da aba, o apple-touch-icon e
os ícones do PWA.

### 2. Marca plena

`public/brand/marca-plena.svg`, derivada de `marca-completa.svg` aplicando o
mesmo recorte que o ícone usa — `viewBox="340 535 1250 830"`, apagando no SVG
os paths do wordmark em vez de rasterizar. É a mesma cena do ícone, sem o
quadrado de respiro: fica no formato da própria ilustração.

Isso é o que mantém de pé a decisão 2: o texto desenhado sai do arquivo e o
nome passa a ser tipografado ao lado dele.

Onde entra: página `/sobre`, splash da PWA e imagem de compartilhamento
(`og:image`).

Só existe versão clara da marca plena. Em tema escuro ela entra sobre o próprio
fundo `#fefefc` da arte, como um cartão claro. Se isso incomodar na `/sobre`, o
mesmo recorte aplicado sobre `marca-icone-noite.svg` resolve, mas essa variação
não faz parte desta spec.

O caminho `public/brand/marca-plena.svg` já existe hoje com outro conteúdo — a
sangria total gerada do monograma. Ele é sobrescrito e deixa de ser a fonte de
qualquer PNG.

## A troca por tema

A troca acontece em dois lugares, com alcances diferentes.

Dentro do app, o ícone segue o tema escolhido pela pessoa, que é o `data-theme`
do `<html>` e pode ser Sistema, Claro ou Escuro. O `.brand-mark` troca de
arquivo junto com ele.

Na aba do navegador, o favicon só consegue seguir o esquema do sistema
operacional. São dois `<link rel="icon">` em `index.html`, um com
`media="(prefers-color-scheme: dark)"` apontando para a versão noite e outro
para a clara.

A consequência precisa estar dita sem enfeite: se a pessoa forçar Claro no app
num sistema escuro (ou o contrário), a aba vai divergir do corpo do app. Não há
como o favicon ler o `data-theme`. Isso é aceito.

## O ícone instalado

`pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png` e `apple-touch-icon.png`
são todos renderizados de `marca-icone-noite.svg`. O ícone instalado é o
escuro, independentemente do tema do sistema ou do app: a tela inicial não tem
troca por esquema, e a versão noite é a que se destaca sobre os dois fundos.

O `theme_color` do manifesto continua `#92500a` e o `background_color` continua
`#f5f1e8`. O manifesto é inline em `vite.config.ts` (por volta das linhas
107–136, gerado pelo `vite-plugin-pwa`) e nenhum dos dois é tocado.

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

- Não recolorir nenhum dos dois níveis.
- Não pôr o texto embutido de volta.
- Não espelhar nem girar: a candeia entra sempre pela esquerda.
- Não mexer no recorte: mudar o `clipPath` traz o wordmark de volta pela borda
  de baixo.

## O que muda no repositório

1. **Copiar** `public/brand/Marca SVGs/marca-icone.svg` e
   `public/brand/Marca SVGs/marca-icone-noite.svg` para
   `public/brand/marca-icone.svg` e `public/brand/marca-icone-noite.svg`.
2. **Derivar** `public/brand/marca-plena.svg` de
   `public/brand/Marca SVGs/marca-completa.svg`, com o recorte descrito no
   nível 2. O conteúdo atual do arquivo é substituído.
3. **Apagar** `public/favicon.svg`, o monograma antigo. Depois das mudanças
   abaixo, nada mais aponta para ele: o header passa a usar os arquivos novos e
   os dois `<link rel="icon">` também. A única linha extra que isso pede é
   tirar `'favicon.svg'` do `includeAssets` do `vite.config.ts`. Manter um
   `favicon.svg` que fosse cópia do ícone claro custaria duas cópias do mesmo
   desenho para divergir com o tempo, e um par de links assimétrico no
   `index.html`.
4. **Reescrever** `scripts/gerar-icones.sh` para partir de duas fontes em vez
   de uma: a clara para `favicon.png` e `favicon.ico`, a noite para
   `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png` e
   `apple-touch-icon.png`. O script é a única coisa que gera PNG a partir de
   SVG; não editar PNG à mão.
5. **Regerar**, por esse script, `public/favicon.png`, `public/favicon.ico`,
   `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-512-maskable.png`,
   `public/apple-touch-icon.png`, `public/brand/logo.png` e
   `public/brand/logo-master.png`.
6. **Alterar** `src/App.tsx`: o `.brand-mark` passa a apontar para
   `brand/marca-icone.svg` ou `brand/marca-icone-noite.svg` conforme o tema.
   Verificar se `data-theme` já está disponível no ponto de montagem ou se a
   troca precisa ser feita em CSS com `background-image`.
7. **Alterar** `src/styles/app.css`: `.brand-wordmark` ganha os valores acima.
   O `--chama-svg` fica como está — ver a seção seguinte.
8. **Alterar** `index.html`: `theme-color` continua `#92500a`; os `<link
   rel="icon">` viram o par por esquema de cor descrito em "A troca por tema".
9. **Alterar** `src/pages/Sobre.tsx`: a marca plena entra na página, e o texto
   sobre a cor âmbar continua valendo sem mudança.
10. **Alterar** `docs/marca/README.md`, que descreve o pipeline antigo de
    ícones e fica desatualizado no momento em que o script muda.

### O `--chama-svg`

O token fica como está. A máscara CSS do `.streak-chama` precisa de uma
silhueta chapada de um path só, e a chama da candeia nova é feita de vários
preenchimentos sobrepostos (`#db8d3e`, `#e49b4d`, `#f0e0c0`) com gradiente:
tirar dela um contorno único seria redesenhar a chama, não extraí-la — trabalho
de desenho para um elemento de 0,85em na Home, que já tem a forma e a cor
certas.

## Fora do escopo

- Trocar o nome do produto.
- Animar a chama da marca.
- Qualquer mudança de cor.
- Uma versão noite da marca plena.
- A pasta `public/brand/Marca SVGs/`, que é a entrega do dono e fica como está;
  esta spec só copia dela.

## Risco na geração dos PNG

`scripts/gerar-icones.sh` usa ImageMagick (`magick`, com `-background none
-density 1200 -resize NxN -strip PNG32:`). Os SVGs novos usam `radialGradient`
e `clipPath`, e o renderizador interno MSVG do ImageMagick erra as duas coisas:
o resultado pode vir sem a vinheta, ou com o wordmark aparecendo porque o
recorte foi ignorado.

Antes de aceitar qualquer PNG gerado, conferir se o delegate librsvg está ativo
(`magick -list delegate | grep -i svg`) e olhar o PNG de 512 px com olho
humano. Um PNG errado aqui não quebra build nem teste: ele só chega feio à tela
inicial de quem instalar o app.

## Verificação

1. Abrir o app numa aba e conferir o favicon a 16 px nos dois esquemas do
   sistema: no claro entra o ícone claro, no escuro entra o de noite.
2. Adicionar à tela inicial no celular e confirmar que o ícone instalado é a
   versão noite, com a arte inteira dentro do recorte do sistema.
3. Alternar tema claro/escuro dentro do app com o header à vista: o
   `.brand-mark` troca de arquivo, o contorno vai de carvão a creme e o âmbar
   não muda.
4. `/sobre` mostra a marca plena sem nenhum texto desenhado, com o nome
   tipografado ao lado.
5. Olhar o `pwa-512.png` recém-gerado em tamanho real: vinheta presente,
   nenhum resto de wordmark na borda de baixo.
6. Buscar por `DM Sans` no repositório: não deve sobrar nenhuma ocorrência
   ligada à marca.
