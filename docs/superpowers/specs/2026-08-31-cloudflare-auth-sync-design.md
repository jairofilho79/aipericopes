# Design: Migração para Cloudflare Workers + login por magic link/OTP + sync local-first

Data: 2026-08-31 · Status: aprovado em conversa, aguardando revisão do spec

## Objetivo

Tirar o app do GitHub Pages (estático puro) e movê-lo para um único Cloudflare
Worker que serve o build Vite como static assets e expõe uma API de auth e
sync. Isso habilita:

1. **Login simples por e-mail** (magic link + código OTP de 6 dígitos), robusto
   quando o app está instalado como PWA.
2. **Sincronização de progresso e anotações** entre dispositivos, local-first
   (IndexedDB continua sendo a fonte offline; sem login, nada muda).

Usuário único hoje (o autor). Tudo no free tier. Sem cerimônia de migração de
dados do GitHub Pages: o endereço novo começa limpo e o autor refaz/importa o
próprio progresso manualmente se quiser.

## Decisões já tomadas

| Tema | Decisão | Motivo |
|------|---------|--------|
| Hosting | Cloudflare **Workers + static assets** (um deploy só) | Origem única para app+API: cookie de sessão de 1ª parte, sem CORS |
| Auth | **better-auth** rodando no Worker, banco **D1** | Biblioteca própria, sem serviço gerenciado (requisito: nada de Supabase/Firebase) |
| Fluxo de login | **email OTP** como token único; o e-mail traz o código de 6 dígitos **e** um link que carrega o mesmo código | Um token serve os dois caminhos; se o iOS abrir o link no Safari em vez do PWA, o usuário digita o código dentro do PWA |
| Envio de e-mail | **Resend** (free: 3k/mês) agora; trocar pelo Cloudflare Email Service quando sair de beta | Resend é o caminho GA recomendado pela própria doc da Cloudflare; troca é isolada num módulo |
| Cadastro | **Aberto** (sign up = sign in: primeira verificação de OTP cria a conta). `ALLOWED_EMAILS` é env **opcional**: vazia/ausente = aberto; preenchida = restringe aos listados | Cadastro aberto é requisito; a allowlist fica como kill-switch de configuração se houver abuso da cota de e-mail |
| Dados bíblicos | `pericopes.json` **continua asset estático precacheado** | Offline exige precache de qualquer forma; D1 é só para dados do usuário |
| Sync | **Local-first, last-write-wins** por `atualizadoEm` (já existe nos registros) | Simples, suficiente para 1 usuário multi-dispositivo |
| Base path | Muda de `/biblia-pericopes/` para `/` | Worker serve na raiz do workers.dev; simplifica router, manifest e SW |
| Deploy | GitHub Actions com `wrangler deploy` substitui o workflow de Pages | Mesmo gatilho (push na main) |

## Arquitetura

```
biblia-pericopes.<conta>.workers.dev  (Cloudflare Worker, wrangler.jsonc)
├── Static assets (dist/ do Vite)          ← PWA/workbox intactos
│   └── data/pericopes.json                ← estático, precacheado
├── /api/auth/*   → better-auth (plugin emailOTP)
├── /api/sync/*   → pull/push de progresso e anotações
├── D1 (free tier): tabelas do better-auth + progresso + anotacoes
└── Bindings/secrets: RESEND_API_KEY, BETTER_AUTH_SECRET, ALLOWED_EMAILS
```

O Worker roteia: `/api/*` para os handlers; todo o resto cai nos static assets
com fallback SPA para `index.html` (config `assets.not_found_handling:
"single-page-application"` do wrangler — substitui o hack do `404.html` do
Pages).

## Componentes

### 1. Worker + hosting (fase 1)

- `wrangler.jsonc` na raiz: assets apontando para `dist/`, binding D1,
  compatibility date atual.
- `worker/index.ts`: fetch handler com Hono (leve, roda no free tier) — nesta
  fase só o fallback de assets; rotas de API entram nas fases 2–3.
- Vite: `base: '/'`; router `basename` removido; `start_url`/`scope` do
  manifest viram `/`.
- CI: `.github/workflows/deploy-pages.yml` é substituído por
  `deploy-worker.yml` (`npm run build` + `wrangler deploy`, secret
  `CLOUDFLARE_API_TOKEN`). O workflow de Pages é removido no mesmo PR.

### 2. Auth (fase 2)

- **better-auth** montado em `/api/auth/*`, adaptador D1, plugin **emailOTP**
  (sem o plugin magicLink: o "magic link" é o link do e-mail que já carrega o
  código OTP e auto-submete ao abrir).
- E-mail enviado via módulo `worker/email.ts` com interface única
  (`sendOtpEmail(to, code, link)`) — implementação Resend hoje, Email Service
  depois.
- Conteúdo do e-mail: código de 6 dígitos em destaque + botão/link
  `https://<host>/entrar?email=…&code=…`.
- Cadastro: aberto — a primeira verificação de OTP bem-sucedida cria a conta
  (sign up e sign in são o mesmo fluxo, numa única tela "Entrar").
- Regras: código expira em 10 min, uso único, máx. 3 tentativas de verificação,
  rate limit por IP e por e-mail nas rotas de auth. Se `ALLOWED_EMAILS`
  estiver preenchida, e-mails fora dela recebem resposta genérica de sucesso
  (sem enviar e-mail e sem vazar se o endereço é permitido); com a env
  vazia/ausente, qualquer e-mail pode entrar.
- Sessão: cookie httpOnly de 1ª parte, **90 dias com renovação rolante** (cada
  uso renova o prazo; só relogam dispositivos parados há 90 dias) — persiste no
  PWA instalado (mesma origem). Prazo longo de propósito: reduz reenvio de
  códigos e alivia a cota de 100 e-mails/dia do Resend.
- UI: página `/entrar` (campo de e-mail → tela "digite o código" com input de
  6 dígitos → logado). Se a URL trouxer `email`+`code`, verifica
  automaticamente. Header ganha estado de conta discreto (entrar/sair).

**Fluxo PWA (o caso crítico):**

1. No PWA, usuário pede o código em `/entrar`.
2. E-mail chega com código + link.
3. Caminho A (desktop/Android, ou iOS se o link abrir no lugar certo): clica no
   link → sessão criada onde abriu.
4. Caminho B (iOS abre o Safari em vez do PWA): usuário volta ao PWA e digita
   os 6 dígitos → sessão criada **no PWA**. O link eventualmente aberto no
   Safari é inofensivo (código já consumido → mensagem "peça um novo código").

### 3. Sync local-first (fase 3)

Princípio: **sem login, o app é exatamente o de hoje**. Logado, um syncer de
fundo reconcilia IndexedDB ↔ D1.

- Tabelas D1 (além das do better-auth):
  - `progresso(user_id, pericope_ordem, status, atualizado_em)` — PK
    `(user_id, pericope_ordem)`.
  - `anotacoes(id, user_id, pericope_ordem, texto, criado_em, atualizado_em,
    apagado_em)` — soft delete (tombstone) para a exclusão propagar entre
    dispositivos.
- API (autenticada por cookie):
  - `GET /api/sync?since=<iso>` → registros alterados desde o cursor.
  - `POST /api/sync` → lote de upserts/tombstones; servidor aplica LWW por
    `atualizado_em` e responde o estado vencedor.
- Cliente: `src/lib/sync.ts` envolve o `user-db` atual — grava local primeiro,
  enfileira num outbox (store novo no IndexedDB) e descarrega quando online
  (login, foco da aba, `online`, pós-gravação). Pull incremental com cursor
  salvo. Exclusão local vira tombstone no outbox.
- Conflito: LWW puro. Para 1 usuário em 2–3 dispositivos é suficiente;
  anotações não são editadas simultaneamente.

### 4. Tratamento de erros

- API sempre responde JSON `{ error }` com status correto; cliente nunca
  bloqueia leitura por falha de sync (fila fica para a próxima chance).
- 401 no sync → limpa estado de sessão no cliente e mostra "entre novamente"
  sem tocar nos dados locais.
- Falha de envio de e-mail → mensagem honesta na tela de login com retry.

### 5. Testes

- **Vitest** (novo no projeto): unidade para LWW/merge do sync (servidor e
  cliente) e para o gate de allowlist.
- **wrangler dev** com D1 local para o fluxo completo em dev.
- Checklist manual de PWA a cada fase: instalar no iOS, login pelo caminho B
  (código digitado), matar o app e reabrir (sessão persiste), modo avião
  (leitura offline intacta).

## Fora de escopo deste spec (fases seguintes já aprovadas em conversa)

As 28 melhorias de UX de leitura aprovadas — começando pelo pacote 1
(texto corrido, posição de leitura, alinhamento à esquerda no mobile, popover
"Aa", modo imersivo, fontes self-hosted, navegação anterior/próxima, concluir→
próxima, safe areas iOS) — virão em planos próprios após as fases 1–3.
Princípio registrado: **contexto, resenha, reflexão e tópicos são leitura de
primeira classe** — toda melhoria tipográfica/de leitura se aplica a todas as
seções em prosa, não só ao texto NAA. Destaques de versículos, quando
implementados, entram no sync com tabela própria.
