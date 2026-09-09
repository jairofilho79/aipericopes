# A marca

`folha-de-marca.jpeg` é a folha do **monograma antigo** — as letras `ai` com a
haste do `i` virando vela. Ela deixou de ser a marca do app quando o dono
escolheu a marca ilustrada (Bíblia aberta, candeia e trilhas de circuito), mas
fica aqui como registro do que veio antes.

Ela é **referência, não asset**. Fica em `docs/` de propósito: tudo que está em
`public/` é copiado para o build, e 1,7 MB entrariam no bundle de quem instala
o app sem servir para nada.

A marca em vigor está descrita em
`docs/superpowers/specs/2026-09-08-redesenho-marca-design.md`.

## O que é asset

As fontes de verdade da marca são vetoriais e vivem em `public/brand/`:

| arquivo | papel |
|---|---|
| `marca-icone.svg` | ícone, tema claro — de 16 px a 512 px |
| `marca-icone-noite.svg` | ícone, tema noite — o mesmo recorte, fundo `#1c1914` |
| `marca-plena.svg` | a cena sem o quadrado de respiro — `/sobre`, splash e `og:image` |

Os dois ícones são cópias byte a byte da entrega do dono, em
`public/brand/Marca SVGs/`. A `marca-plena.svg` é derivada do
`marca-completa.svg` da mesma pasta, aplicando o recorte
`x=340 y=535 width=1250 height=830` — o mesmo do ícone, que é justamente o que
deixa o wordmark desenhado de fora.

Não mexa nesse recorte: subir a borda de baixo traz o texto desenhado de volta.

## Os PNGs

Os oito PNGs saem dos **dois ícones** por `scripts/gerar-icones.sh`. Não edite
os PNGs à mão: rode o script.

| origem | arquivos |
|---|---|
| `marca-icone.svg` (claro) | `favicon.png` (64), `favicon.ico` (16/32/48), `brand/logo.png` (128) |
| `marca-icone-noite.svg` (noite) | `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png`, `apple-touch-icon.png` (180), `brand/logo-master.png` (1024) |

O ícone **instalado** é sempre o de noite: a tela inicial do sistema não tem
troca por esquema de cor, e a versão noite é a que se sustenta sobre os dois
fundos. O `pwa-512-maskable.png` é cópia byte a byte do `pwa-512.png` — a arte
já tem sangria total e o recorte deixa a cena dentro da zona segura.

A marca plena não gera PNG nenhum.

## O script precisa de librsvg

`scripts/gerar-icones.sh` só roda com `rsvg-convert` no PATH
(`brew install librsvg`), e para com erro se não achar.

Isso não é preciosismo. O renderizador interno MSVG do ImageMagick erra os
`radialGradient` do ícone de noite: o resultado é um quadrado preto sólido, sem
nenhuma arte. Um PNG errado aqui não quebra build nem teste — ele só chega feio
à tela inicial de quem instalar o app.

Para conferir se o delegate está ativo:

```sh
magick -list delegate | grep -i svg
```
