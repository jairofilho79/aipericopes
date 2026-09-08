# aiPericopes — estudo bíblico por perícopes (PWA offline)

App de leitura por **perícopes** (unidades narrativas), com texto da **Bíblia
Livre** (CC BY 3.0 BR), contexto e material de estudo escritos por modelo de
linguagem, narração por voz de IA e anotações locais.

## Desenvolvimento

```bash
# 1) Coloque a Bíblia Livre em data/BLIVRE.json e o dataset em data/raw/PericopeGroupedKJVVerses.json
npm run pipeline   # ETL + enrich local → data/pericopes.json
npm run dev
```

O catálogo (`data/pericopes.json`) não é servido direto: `npm run shard` fatia ele em
`public/data/index.json` (metadados enxutos das perícopes — o que a Home e a busca
precisam de cara) mais `public/data/texto/<livro>.json` e `public/data/estudo/<livro>.json`
(texto bíblico e material de estudo, um arquivo por livro, baixados sob demanda). `predev` e
`prebuild` já rodam `npm run shard` sozinhos antes de `dev`/`build`; ele só regenera se
`data/pericopes.json` for mais novo que a saída (ou com `--force`). Os três destinos em
`public/data/` são derivados e não são versionados.

## Scripts

| Comando | Função |
|---------|--------|
| `npm run etl` | Cruza KJV_Pericopes × Bíblia Livre → `data/raw-pericopes.jsonl` |
| `npm run enrich` | Enriquecimento local (títulos/contexto template) |
| `npm run enrich:openrouter` | Enriquecimento via OpenRouter (`OPENROUTER_API_KEY`) |
| `npm run enrich:genesis` | OpenRouter só em Gênesis |
| `npm run shard` | Fatia `data/pericopes.json` em `public/data/index.json` + `texto/` + `estudo/` |

## Dados do usuário

Progresso e anotações ficam no IndexedDB (offline-first). Com login (e-mail →
código de 6 dígitos ou magic link), os dados sincronizam entre dispositivos
via Cloudflare D1 (last-write-wins). Sem login, tudo funciona 100% local.

## Deploy

Cloudflare Workers (static assets + API). O deploy é **manual, da máquina**:

```bash
npm run deploy
```

Esse script é o portão inteiro, na ordem: lint → testes → typecheck do worker →
build → `d1 migrations apply --remote` → `wrangler deploy`. **As migrations vêm
antes do deploy de propósito**: publicar o worker com migration pendente faz o
código novo procurar tabela que não existe.

O workflow do GitHub Actions continua no repositório com a mesma receita, mas
desligado do gatilho automático (só `workflow_dispatch`). Para religar, devolva
o `push: branches: [main]` e grave o segredo `CLOUDFLARE_API_TOKEN`.

### Checklist do primeiro deploy

1. `npx wrangler d1 create biblia-pericopes` e coloque o `database_id` real no
   `wrangler.jsonc` (hoje é um placeholder só de zeros).
2. Ajuste `APP_URL` em `wrangler.jsonc` para a URL real do workers.dev
   (formato `<name>.<subdomínio>.workers.dev`) — ela alimenta o `baseURL`, os
   `trustedOrigins` e os links dos e-mails de login.
3. `wrangler secret put BETTER_AUTH_SECRET` e `wrangler secret put RESEND_API_KEY`.
4. `wrangler d1 migrations apply biblia-pericopes --remote`.
5. Sem um domínio verificado no Resend, o remetente `onboarding@resend.dev` só
   entrega e-mails para o dono da conta Resend. Para cadastro aberto de verdade,
   verifique um domínio; até lá, considere restringir com `ALLOWED_EMAILS`.
6. O primeiro run do CI depois do merge vai falhar até os secrets existirem —
   é esperado.

Env opcional `ALLOWED_EMAILS` (lista separada por vírgula) restringe o cadastro.

**Nota:** o texto bíblico é a **Bíblia Livre** (Diego Santos, Mario Sérgio e Marco Teles,
2018), sob [CC BY 3.0 BR](https://creativecommons.org/licenses/by/3.0/br/) — a atribuição
é obrigatória e o app a cumpre na página Sobre. Ver `docs/licencas.md`.
