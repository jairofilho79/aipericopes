# Kickoff — próximas fases do app (sessão paralela)

> Arquivo de largada para uma sessão nova do Claude Code. Prompt sugerido:
> **"Leia docs/kickoff-proximas-fases.md e me proponha por onde começar."**

## Estado do projeto (2026-09-01)

- App de leitura de perícopes bíblicas (React + Vite, dados em
  `public/data/pericopes.json`, 2.647 perícopes). Sync/auth via Cloudflare
  Worker já entregue.
- Pacotes de UX 1–4 entregues (leitura, versículos, navegação, engajamento —
  specs e planos em `docs/superpowers/specs/` e `docs/superpowers/plans/`).
- A narração pré-gerada dirige a leitura em `Leitura` com realce de
  versículo/parágrafo e de palavra em fala, tela acompanhando, e wake lock; o
  TTS sintético (Web Speech API) foi removido em 2026-09-02.

## Em andamento NOUTRA sessão — não mexer

A geração das narrações profissionais (vozes clonadas via Fish Audio/
OpenRouter) está sendo tocada em outra sessão do Claude Code. **Esta sessão
não deve tocar** em:

- `docs/superpowers/specs/2026-09-01-tts-batch-vozes-design.md`
- `docs/superpowers/plans/2026-09-01-tts-batch-geracao.md`
- qualquer pipeline de geração/upload de áudio (spike em `../tts-spike/`,
  corpus em `../tts-corpus/`)

## ✅ P6 DESBLOQUEADA (2026-09-02) — player imersivo (TTS fase 2)

Os áudios E os manifestos de sincronização já estão publicados. Contrato
(servido pelo Worker a partir do R2, mesmo domínio do app):

- `GET /api/audio/nt-ml/<ordem>.m4a` — narração da perícope (AAC mono,
  44,1 kHz). Aceita `Range` (seek funciona); cache imutável de 1 ano.
- `GET /api/audio/nt-ml/<ordem>.json` — manifesto de sincronização:
  `{ ordem, livro, abbrev, titulo, voz, motor, sr, pausa_unidade,
  pausa_secao, dur_total, unidades: [{ i, secao, arquivo, texto, chars,
  inicio, dur }] }`. `inicio`/`dur` em segundos DENTRO do m4a costurado —
  é o eixo do realce/rolagem via `timeupdate`. `secao` ∈ {titulo, contexto,
  texto, resenha, reflexoes}. Ignorar `arquivo` (mp3 interno não publicado).
  As unidades da seção `texto` são os versículos na mesma ordem em que
  `parse-texto` os produz (com "Capítulo N." fundido ao 1º verso do
  capítulo); `texto` é o conteúdo normalizado que foi narrado.
- **Realce por palavra**: cada unidade também traz
  `palavras: [{ t, i, d }]` — um item por token de `texto.split(' ')`
  (mesma contagem, mesma ordem; `t` é o token com pontuação), com `i` =
  instante ABSOLUTO no m4a e `d` = duração, em segundos (alinhamento
  forçado MMS; pontuação isolada herda `i` do fim da palavra anterior com
  `d` = 0). Manifestos estão sendo republicados com o campo em 2026-09-02;
  um manifesto sem `palavras` ainda não foi realinhado — o player deve cair
  no realce por unidade nesse caso.
- Cobertura parcial e crescente (~309/1047 perícopes do NT em 2026-09-02;
  lote diário adiciona mais): o player DEVE tratar 404 como "sem narração"
  e cair no comportamento atual. `HEAD` no .m4a é a checagem barata.
- Ponto de partida no código: `src/components/NarracaoPlayer.tsx` (player
  simples de `<audio>`, commit `1ac5fa7`) — a fase 2 o substitui/estende
  com realce de unidade e rolagem, nos moldes do realce do TTS sintético
  já existente na Leitura (`verse-speaking`/`prose-speaking`).

## Candidatos a próxima fase (escolher com o usuário)

1. **Backlog pós-pacotes** — `docs/superpowers/backlog-pos-pacotes.md`:
   melhorias adjudicadas nas revisões finais (endurecimento do Worker, a11y
   da barra de ações, foco/scroll na navegação, busca). Itens pequenos e
   independentes, bons para começar.
2. **Live refresh pós-sync** — evento `pericopes-sync` após `applyRemote*`
   para dados de outro aparelho aparecerem sem navegar (limitação comentada
   em `Home.tsx`).
3. **Ideias novas do usuário** — perguntar antes de assumir.

## Regras da casa

- Fluxo superpowers: brainstorm → spec → plano → execução (skills do plugin).
- TDD nos módulos com infra de teste; commits frequentes e pequenos.
- Segredos NUNCA via shell do Claude (o usuário grava em terminal próprio);
  chaves em arquivos git-ignorados (`.env`, `.tts-key.local`).
- Textos de UI em pt-BR; commits em pt-BR no padrão dos existentes.
