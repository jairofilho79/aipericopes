# A marca

`folha-de-marca.jpeg` é a folha de referência gerada pelo dono: a marca em
tamanho grande, dentro do quadro de ícone, o teste em 16×16 e o lockup com a
marca-palavra.

Ela é **referência, não asset**. Fica em `docs/` de propósito: tudo que está em
`public/` é copiado para o build, e 1,7 MB entrariam no bundle de quem instala
o app sem servir para nada.

## O que é asset

As fontes de verdade da marca são vetoriais e vivem em `public/`:

| arquivo | papel |
|---|---|
| `public/favicon.svg` | cartão de cantos arredondados — navegador e PWA `any` |
| `public/brand/marca-plena.svg` | sangria total, marca na zona segura — para quem recorta |

Os oito PNGs saem desses dois por `scripts/gerar-icones.sh`. Não edite os PNGs
à mão: rode o script.

A distinção entre os dois SVGs não é enfeite. O ícone `maskable` e o
`apple-touch-icon` são **recortados** pelo sistema operacional (círculo,
squircle, gota). Um cartão de cantos arredondados ali vira canto cortado.

## Como o desenho saiu desta folha

As letras são DM Sans — a fonte de interface do próprio app — no peso 750,
convertidas em contorno. O peso 750 não é chute: a haste do `i` na folha mede
0,2605 da altura do `a`, e o peso 750 do DM Sans dá 0,2604. O espacejamento
saiu do vão medido entre as letras (0,1474 da altura). A chama foi ajustada
por oito curvas de Bézier contra o perfil extraído da folha, com erro RMS de
0,3% da largura.

Em 16×16 a chama vira um borrão — a própria folha já previa isso, com um
16×16 simplificado em que a chama é um pingo redondo. Se algum dia isso
incomodar, é um terceiro SVG, não um ajuste nos existentes.
