# Kickoff — a página Sobre (divulgação e créditos)

> **Prompt para abrir a sessão nova:**
> *"Leia `docs/kickoff-pagina-sobre.md` e construa a página Sobre. Antes de
> escrever código, leia a seção 'A decisão do dono' — ela já está tomada e não
> se rediscute."*

Saiu de uma conversa paralela durante a Sessão 5 (trilha sonora), ao conferir se
o áudio do app pode ser publicado. A conclusão foi que falta **uma página**, não
um aviso — e que o lugar dela é fora da tela de leitura.

## Por que a página precisa existir

Três obrigações distintas, hoje cumpridas pela metade:

1. **Bíblia Livre — CC BY 3.0 Brasil.** Exige atribuição (§4b) e, havendo
   adaptação, exige indicar a mudança (§3b). ✅ *já cumprida*, em `Ajustes.tsx`,
   na seção "Sobre o texto bíblico".
2. **Voz de IA — políticas de uso da OpenAI.** Texto literal do guia de TTS
   deles: *"Our usage policies require you to provide a clear disclosure to end
   users that the TTS voice they are hearing is AI-generated and not a human
   voice."* A narração é a voz `ash`, uma das vozes preset construídas a partir
   de gravações de atores profissionais. ❌ **não existe em lugar nenhum do
   app.** É a pendência que motiva esta sessão.
3. **Material de estudo escrito por modelo.** Contexto, resenha e perguntas de
   reflexão são gerados por IA. Nenhuma licença obriga a dizer isso — mas é
   comentário sobre a Escritura, e quem lê merece saber a procedência.
   ❌ não existe.

## A decisão do dono — não rediscuta

**Nenhuma marca de IA no tocador nem na tela de leitura.** Toda a divulgação
vive na página Sobre.

O motivo, na palavra dele: *"Não quero induzir ao erro, mas também não quero que
o usuário fique com preconceito com IA. Foi um trabalho meu validar cada uma, ter
o trabalho com timbre, interpretação etc. Para uma pessoa ler 'Narração de IA' e
já desqualificar e nem querer ouvir… Se a pessoa quiser saber mais, ela vai
procurar lá na página Sobre e vai saber. Mas antes ela ouviu o resultado, pelo
menos."*

Isso não é omissão, é ordem: ouvir primeiro, saber depois. E há um argumento
técnico a favor — **o rótulo informa pior que a página.** "Voz de IA" comprime em
três letras uma curadoria feita voz a voz e entrega a conclusão errada antes de o
leitor ter ouvido qualquer coisa. A página pode contar o processo inteiro.

⚠️ **A contrapartida, que é a condição de tudo isso funcionar:** a página tem que
ser **achável**. O argumento "quem quiser saber vai lá" só se sustenta se houver
caminho óbvio. Item no menu do perfil, e os Ajustes apontando para lá. Se a
página for enterrada, o desenho inteiro perde o pé.

## O que já existe

- `src/pages/Ajustes.tsx` — tem `<h2>Sobre o texto bíblico</h2>` com o crédito da
  BLIVRE e a nota da adaptação (colchetes, epígrafes dos Salmos). O comentário
  acima dela já explica que é obrigação de licença, não cortesia.
- `src/components/PerfilMenu.tsx` — o menu que já absorve Ajustes, Entrar e Sair.
  É onde entra o item "Sobre".
- `src/App.tsx` — não há rota `/sobre`.
- `docs/licencas.md` — o levantamento que fundamenta o crédito da BLIVRE.
- `src/lib/manifesto.ts` e `scripts/normalizar-narracao.sh` — de onde sair a
  descrição honesta do que foi feito com a narração.

## O que construir

1. `src/pages/Sobre.tsx`, rota `/sobre` em `App.tsx`.
2. Item **Sobre** no `PerfilMenu`, ao lado de Ajustes.
3. Mover o crédito da BLIVRE de `Ajustes` para lá, deixando nos Ajustes um
   ponteiro. **A atribuição não pode sumir no caminho** — é obrigação de licença.
4. Conteúdo sugerido, em quatro blocos: o texto bíblico (crédito + adaptação +
   a regra das duas testemunhas para correção), o material de estudo (escrito
   por modelo, com verificação automática antes de entrar), a narração (voz de
   IA, dita com essas palavras, e o que foi feito: escolha por timbre e
   interpretação, conferência contra o texto, normalização arquivo a arquivo,
   alinhamento palavra a palavra), e a cobertura parcial da narração.
5. A trilha sonora **ainda não entra** — não foi publicada. Quando entrar,
   ganha um bloco aqui.

## Território — a Sessão 3 está viva no mesmo repo

Ela commitou hoje em `scripts/`, `docs/` e em parte de `src/`. Cruzando com o que
esta tarefa toca:

| arquivo | risco |
|---|---|
| `src/pages/Sobre.tsx` (novo) | nenhum |
| `src/App.tsx`, `PerfilMenu.tsx`, `Ajustes.tsx` | limpos no último levantamento |
| `src/styles/app.css` | ⚠️ **ela mexeu** (commit `74dc9d0`) |

**Reaproveite as classes que já existem** (`ajustes`, `lead`, `muted`,
`ajustes-credito`) em vez de criar CSS novo — assim `app.css` não é tocado e o
conflito não acontece. Uma versão desta página foi escrita e desfeita durante a
Sessão 5 exatamente nesse formato, e `tsc --noEmit` passou limpo.

E confira `git log` antes de assumir que um commit é seu. `data/pericopes.json`
costuma estar modificado na árvore pela Sessão 3 — **não inclua em commit desta
tarefa.**

## Fontes das obrigações

- Guia de TTS da OpenAI (o texto da divulgação): <https://developers.openai.com/api/docs/guides/text-to-speech>
- Business terms da OpenAI (cessão da saída ao cliente): <https://openai.com/policies/may-2025-business-terms/>
- CC BY 3.0 Brasil: <https://creativecommons.org/licenses/by/3.0/br/>
- `docs/licencas.md` neste repo.
