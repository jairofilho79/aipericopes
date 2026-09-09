# Redesenho visual do aiPericopes (2026-09-08)

Implementado na branch `redesenho-visual` (tipografia, marca, navegação,
narração/toque, explorar). Pronto para merge em `main` e deploy.

O desenho original vive num canvas navegável:

**https://claude.ai/code/artifact/cf659386-d6cb-4c94-bf82-9ca08fea3730**

## O que muda, em uma frase cada

- **Tipografia.** Saem Fraunces, Source Serif 4 e DM Sans; entram Cormorant
  Garamond (títulos) e EB Garamond (corpo e interface). O app deixa de ter
  sem-serifa na interface. Capitular foi cortado após QA visual.
- **Marca.** A ilustração escolhida pelo dono — Bíblia, candeia e circuito —
  entra em dois enquadramentos, o ícone e a marca plena, ambos sem o texto
  desenhado, que passa a ser tipografado. PWA usa a versão noite.
- **Navegação.** A nav principal desce para uma barra inferior de quatro abas;
  o popover Perfil vira página `/perfil`.
- **Narração.** Ganha uma doca fixa no rodapé, botões que respeitam 44 px, e
  passa a dizer quando não existe áudio em vez de sumir da tela. Play de
  ouvir fica dentro do CTA Continuar/Seguir.
- **Explorar.** Um campo único de referência substitui capítulo → versículo →
  "Ir", e ganha ditado por voz.
- **Cor.** Nada. Nenhum hex é tocado por nenhuma destas specs.

## As specs, na ordem de implementação

1. `../superpowers/specs/2026-09-08-redesenho-tipografia-design.md`
2. `../superpowers/specs/2026-09-08-redesenho-marca-design.md`
3. `../superpowers/specs/2026-09-08-redesenho-navegacao-design.md`
4. `../superpowers/specs/2026-09-08-redesenho-narracao-toque-design.md`
5. `../superpowers/specs/2026-09-08-redesenho-explorar-design.md`

## Material de marca

As entregas de marca são os três SVGs aprovados pelo dono, em
`public/brand/Marca SVGs/`:

- `marca-icone.svg` e `marca-icone-noite.svg` — ícone por tema;
- `marca-completa.svg` — arte inteira, de onde a marca plena é derivada.

`marca/` guarda as provas visuais do estudo de redução.

## O que este trabalho deliberadamente não fez

- Não mudou nenhuma cor de tema.
- Não mexeu em Worker, D1, auth nem no schema do IndexedDB.
- Não propôs marca alternativa: a marca é a que o dono escolheu.
- Capitular: planejado na tipografia, removido no QA.
