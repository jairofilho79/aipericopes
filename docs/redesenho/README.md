# Redesenho visual do aiPericopes (2026-09-08)

Trabalho de design, não de código. Nada aqui está implementado: a branch
`redesenho-visual` existe justamente para o redesenho não atravessar o deploy
das features visuais que seguem em `main`.

O desenho vive num canvas navegável, com as telas, a marca e a folha de
sistema:

**https://claude.ai/code/artifact/cf659386-d6cb-4c94-bf82-9ca08fea3730**

## O que muda, em uma frase cada

- **Tipografia.** Saem Fraunces, Source Serif 4 e DM Sans; entram Cormorant
  Garamond (títulos) e EB Garamond (corpo e interface). O app deixa de ter
  sem-serifa na interface.
- **Marca.** A ilustração escolhida pelo dono — Bíblia, candeia e circuito —
  entra em três níveis de leitura, porque a íntegra não sobrevive a 32 px.
- **Navegação.** A nav principal desce para uma barra inferior de quatro abas;
  o popover Perfil vira página.
- **Narração.** Ganha uma doca fixa no rodapé, botões que respeitam 44 px, e
  passa a dizer quando não existe áudio em vez de sumir da tela.
- **Explorar.** Um campo único de referência substitui capítulo → versículo →
  "Ir", e ganha ditado por voz.
- **Cor.** Nada. Nenhum hex é tocado por nenhuma destas specs.

## As specs, na ordem de implementação

1. `../superpowers/specs/2026-09-08-redesenho-tipografia-design.md`
   Primeiro, porque todas as outras assumem a fonte nova nas medidas.
2. `../superpowers/specs/2026-09-08-redesenho-marca-design.md`
   Independente das demais; pode ir em paralelo com a 1.
3. `../superpowers/specs/2026-09-08-redesenho-navegacao-design.md`
   Depende da 1 (a barra inferior usa a rampa nova) e reverte parte de
   `2026-09-03-chrome-header-perfil-design.md`.
4. `../superpowers/specs/2026-09-08-redesenho-narracao-toque-design.md`
   Depende da 3: a doca ocupa o rodapé que a barra inferior libera na Leitura.
5. `../superpowers/specs/2026-09-08-redesenho-explorar-design.md`
   Independente da 3 e da 4; depende da 1.

## Material de marca

`marca/` guarda os fontes das duas reduções e as provas visuais:

- `simbolo.svg` — a cena reduzida, para 40–96 px;
- `glifo.svg` / `glifo-noite.svg` — a candeia sozinha, para até 32 px;
- `ilustracao-em-tamanho-pequeno.png` — a arte original a 64, 32 e 20 px, que
  é a razão de existirem reduções;
- `escala-de-reducao.png` — as duas reduções na escala inteira.

A arte escolhida pelo dono continua sendo
`public/brand/modelo/m3-carvao-limpo.svg`, e não foi alterada.

## O que este trabalho deliberadamente não fez

- Não implementou nada. Nenhum arquivo de `src/` foi tocado.
- Não mudou nenhuma cor.
- Não propôs marca alternativa: a marca é a que o dono escolheu.
- Não mexeu em `main` nem no worktree principal.
