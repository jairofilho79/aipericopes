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
  entra em dois enquadramentos, o ícone e a marca plena, ambos sem o texto
  desenhado, que passa a ser tipografado.
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

As entregas de marca são os três SVGs aprovados pelo dono, hoje em
`public/brand/Marca SVGs/` do worktree principal:

- `marca-icone.svg` e `marca-icone-noite.svg` — a cena recortada, sem o texto
  desenhado, num quadrado: é o ícone de 16 a 512 px, um arquivo por tema;
- `marca-completa.svg` — a arte inteira, com o texto ainda desenhado, de onde
  a marca plena é derivada pelo mesmo recorte.

`marca/` guarda as provas visuais que explicam por que a redução foi estudada:

- `ilustracao-em-tamanho-pequeno.png` — a arte original a 64, 32 e 20 px;
- `escala-de-reducao.png` — as reduções estudadas na escala inteira.

Os `simbolo.svg`, `glifo.svg` e `glifo-noite.svg` que estão nessa pasta são
esse estudo, e ficam como registro: o dono preferiu manter a cena inteira no
ícone, e nenhum deles é fonte de arquivo do app.

## O que este trabalho deliberadamente não fez

- Não implementou nada. Nenhum arquivo de `src/` foi tocado.
- Não mudou nenhuma cor.
- Não propôs marca alternativa: a marca é a que o dono escolheu.
- Não mexeu em `main` nem no worktree principal.
