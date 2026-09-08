# Cloudflare Workers + Auth OTP + Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover o app do GitHub Pages para um Cloudflare Worker (static assets + API), adicionar login por e-mail (OTP de 6 dígitos + magic link que carrega o código) e sync local-first de progresso/anotações via D1.

**Architecture:** Um único Worker serve o build Vite como static assets (SPA fallback) e monta `/api/auth/*` (better-auth com plugin emailOTP sobre D1 via kysely-d1) e `/api/sync/*` (pull/push com last-write-wins por `atualizado_em`, tombstones para exclusão). O cliente continua local-first: IndexedDB é a fonte offline; um outbox descarrega mudanças quando online.

**Tech Stack:** Vite + React 19 (existente), Hono, better-auth (plugin emailOTP), kysely-d1, Cloudflare D1, Resend (REST puro), wrangler, vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-cloudflare-auth-sync-design.md`

## Global Constraints

- Free tier em tudo: Workers free (sem Durable Objects, sem filas), D1 free, Resend free.
- **Resend sem domínio verificado só entrega para o e-mail do dono da conta** (from `onboarding@resend.dev`). `EMAIL_FROM` é env; cadastro aberto de verdade exige verificar um domínio no Resend depois. Sem `RESEND_API_KEY` definido, o worker loga o código no console (modo dev).
- Sessão: cookie httpOnly, **90 dias** (`expiresIn: 60*60*24*90`), renovação rolante (`updateAge: 60*60*24`).
- OTP: 6 dígitos, expira em **600 s**, **3** tentativas.
- `ALLOWED_EMAILS` (env, opcional): vazia/ausente = cadastro aberto; preenchida = só os listados (resposta genérica de sucesso para os demais, sem enviar e-mail).
- Todo texto de UI em **pt-BR**.
- `npm run lint` (oxlint) e `npm run build` (tsc -b) devem passar ao fim de cada task.
- Sem login, o app se comporta exatamente como hoje (nenhuma feature regride).
- Base path muda de `/biblia-pericopes/` para `/`.
- Passos marcados **[HUMANO]** exigem conta/dashboard do usuário (login wrangler, secrets) — pare e peça ao usuário.

## File Structure (final)

```
wrangler.jsonc                    # config Worker: assets + D1 + vars
worker/
  index.ts                        # Hono app: /api/auth/*, /api/sync/*
  auth.ts                         # createAuth(env) — better-auth + emailOTP
  allowlist.ts                    # isEmailAllowed (puro)
  email.ts                        # buildOtpLink/otpEmailHtml/sendOtpEmail
  sync-logic.ts                   # newerThan + parseSyncPush (puros)
  env.d.ts                        # interface Env
  tsconfig.json                   # types de workers
  *.test.ts                       # vitest dos módulos puros
migrations/
  0001_better_auth.sql            # user/session/account/verification/rateLimit
  0002_sync.sql                   # progresso + anotacoes (com tombstone)
src/lib/auth-client.ts            # createAuthClient + emailOTPClient
src/lib/sync-merge.ts             # remoteWinsLocal (puro, lado cliente)
src/lib/sync.ts                   # outbox flush + pull + triggers
src/lib/user-db.ts                # v2: stores outbox/meta + enqueue
src/pages/Entrar.tsx              # e-mail → código → logado (+ auto-verify)
src/App.tsx                       # rota /entrar, estado de conta no header
.github/workflows/deploy-worker.yml
```

---

### Task 1: Base path `/` (app na raiz)

**Files:**
- Modify: `vite.config.ts:6` (base), `vite.config.ts:27-28` (start_url/scope)
- Modify: `src/App.tsx:22` (basename)

**Interfaces:**
- Consumes: nada.
- Produces: build em `dist/` servível na raiz; `import.meta.env.BASE_URL === '/'` (o fetch de `content.ts:8` e o logo de `App.tsx:28` já usam `BASE_URL`, então seguem funcionando sem mudança).

- [ ] **Step 1: Trocar base no vite.config.ts**

Em `vite.config.ts` mude `base: '/biblia-pericopes/'` para `base: '/'`, e no manifest `start_url: '/biblia-pericopes/'` → `'/'` e `scope: '/biblia-pericopes/'` → `'/'`.

- [ ] **Step 2: Remover basename do router**

Em `src/App.tsx` mude `<BrowserRouter basename="/biblia-pericopes">` para `<BrowserRouter>`.

- [ ] **Step 3: Verificar build e preview**

Run: `npm run build && npm run preview`
Expected: build sem erro; abrir `http://localhost:4173/` mostra a Home; `http://localhost:4173/indice` funciona; DevTools → Network mostra `GET /data/pericopes.json` 200.

- [ ] **Step 4: Lint e commit**

```bash
npm run lint
git add vite.config.ts src/App.tsx
git commit -m "feat: app servido na raiz (base /) para Cloudflare Workers"
```

---

### Task 2: wrangler + static assets (deploy manual)

**Files:**
- Create: `wrangler.jsonc`
- Modify: `package.json` (devDependency wrangler, scripts), `.gitignore` (`.wrangler/`)

**Interfaces:**
- Consumes: `dist/` da Task 1.
- Produces: `npm run deploy` publica em `https://biblia-pericopes.<conta>.workers.dev`; `wrangler.jsonc` que a Task 5 estende com worker script e D1.

- [ ] **Step 1: Instalar wrangler**

Run: `npm i -D wrangler`

- [ ] **Step 2: Criar wrangler.jsonc (assets-only, com SPA fallback)**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "biblia-pericopes",
  "compatibility_date": "2026-08-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- [ ] **Step 3: Scripts npm e gitignore**

Em `package.json` → `scripts`, adicione:

```json
"deploy": "npm run build && wrangler deploy",
"dev:worker": "wrangler dev"
```

Em `.gitignore` adicione a linha `.wrangler/`.

- [ ] **Step 4: Verificar localmente**

Run: `npm run build && npx wrangler dev`
Expected: `http://localhost:8787/` mostra a Home; `http://localhost:8787/leitura/1` responde o `index.html` da SPA (fallback funcionando).

- [ ] **Step 5: [HUMANO] Login e primeiro deploy**

Peça ao usuário rodar `! npx wrangler login` (abre o browser para autorizar a conta Cloudflare). Depois:

Run: `npm run deploy`
Expected: URL `https://biblia-pericopes.<subdomínio>.workers.dev` impressa; abrir no browser mostra o app; instalar como PWA funciona (manifest com scope `/`).

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc package.json package-lock.json .gitignore
git commit -m "feat: hosting em Cloudflare Workers via static assets"
```

---

### Task 3: CI — deploy via GitHub Actions

**Files:**
- Create: `.github/workflows/deploy-worker.yml`
- Delete: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `wrangler.jsonc` da Task 2; secret `CLOUDFLARE_API_TOKEN`.
- Produces: push na `main` → deploy no Workers. A Task 5 adiciona o passo de migrations aqui.

- [ ] **Step 1: Criar workflow novo**

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

- [ ] **Step 2: Remover workflow do Pages**

Run: `git rm .github/workflows/deploy-pages.yml`

- [ ] **Step 3: [HUMANO] Criar o secret**

Peça ao usuário: no dashboard Cloudflare → My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers". No GitHub → Settings → Secrets → Actions → `CLOUDFLARE_API_TOKEN`.

- [ ] **Step 4: Commit e verificar a Action**

```bash
git add .github/workflows/deploy-worker.yml
git commit -m "ci: deploy no Cloudflare Workers substitui GitHub Pages"
git push
```

Expected: Action verde no GitHub; site atualizado no workers.dev.

---

### Task 4: vitest + módulos puros de e-mail e allowlist

**Files:**
- Create: `worker/allowlist.ts`, `worker/email.ts`, `worker/env.d.ts`, `worker/tsconfig.json`, `worker/allowlist.test.ts`, `worker/email.test.ts`
- Modify: `package.json` (vitest, script test)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `isEmailAllowed(email: string, allowedEmails: string | undefined): boolean`
  - `buildOtpLink(appUrl: string, email: string, otp: string): string`
  - `otpEmailHtml(otp: string, link: string): string`
  - `sendOtpEmail(env: Env, to: string, otp: string): Promise<void>`
  - `interface Env { DB: D1Database; BETTER_AUTH_SECRET: string; APP_URL: string; EMAIL_FROM: string; RESEND_API_KEY?: string; ALLOWED_EMAILS?: string }`

- [ ] **Step 1: Instalar vitest e types**

Run: `npm i -D vitest @cloudflare/workers-types`
Em `package.json` → `scripts`, adicione `"test": "vitest run"`.

- [ ] **Step 2: worker/env.d.ts e worker/tsconfig.json**

`worker/env.d.ts`:

```ts
export interface Env {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  APP_URL: string
  EMAIL_FROM: string
  RESEND_API_KEY?: string
  ALLOWED_EMAILS?: string
}
```

`worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 3: Testes que falham**

`worker/allowlist.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isEmailAllowed } from './allowlist'

describe('isEmailAllowed', () => {
  it('permite qualquer e-mail quando a lista está vazia/ausente', () => {
    expect(isEmailAllowed('a@b.com', undefined)).toBe(true)
    expect(isEmailAllowed('a@b.com', '')).toBe(true)
    expect(isEmailAllowed('a@b.com', '   ')).toBe(true)
  })
  it('restringe aos listados, sem case e com espaços', () => {
    const lista = ' Jairo@Gmail.com, outro@x.com '
    expect(isEmailAllowed('jairo@gmail.com', lista)).toBe(true)
    expect(isEmailAllowed('OUTRO@X.COM', lista)).toBe(true)
    expect(isEmailAllowed('intruso@x.com', lista)).toBe(false)
  })
})
```

`worker/email.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildOtpLink, otpEmailHtml } from './email'

describe('buildOtpLink', () => {
  it('monta /entrar com email e code escapados', () => {
    expect(buildOtpLink('https://app.dev', 'a+b@x.com', '123456')).toBe(
      'https://app.dev/entrar?email=a%2Bb%40x.com&code=123456',
    )
  })
  it('não duplica barra final do APP_URL', () => {
    expect(buildOtpLink('https://app.dev/', 'a@x.com', '111111')).toBe(
      'https://app.dev/entrar?email=a%40x.com&code=111111',
    )
  })
})

describe('otpEmailHtml', () => {
  it('contém o código e o link', () => {
    const html = otpEmailHtml('654321', 'https://app.dev/entrar?email=a%40x.com&code=654321')
    expect(html).toContain('654321')
    expect(html).toContain('https://app.dev/entrar?email=a%40x.com&code=654321')
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run worker`
Expected: FAIL — módulos `./allowlist` e `./email` não existem.

- [ ] **Step 5: Implementar**

`worker/allowlist.ts`:

```ts
export function isEmailAllowed(email: string, allowedEmails: string | undefined): boolean {
  const raw = allowedEmails?.trim()
  if (!raw) return true
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.trim().toLowerCase())
}
```

`worker/email.ts`:

```ts
import type { Env } from './env.d'

export function buildOtpLink(appUrl: string, email: string, otp: string): string {
  const base = appUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({ email, code: otp })
  return `${base}/entrar?${params.toString()}`
}

export function otpEmailHtml(otp: string, link: string): string {
  return [
    '<div style="font-family:Georgia,serif;max-width:28rem;margin:0 auto;padding:1.5rem">',
    '<h2 style="color:#2f5d50">Perícopes</h2>',
    '<p>Seu código de acesso:</p>',
    `<p style="font-size:2rem;letter-spacing:0.3em;font-weight:700">${otp}</p>`,
    `<p><a href="${link}" style="display:inline-block;background:#2f5d50;color:#fff;padding:0.7rem 1.2rem;border-radius:8px;text-decoration:none">Entrar no Perícopes</a></p>`,
    '<p style="color:#5c564c;font-size:0.85rem">O código vale por 10 minutos. Se você não pediu este e-mail, ignore-o.</p>',
    '</div>',
  ].join('\n')
}

export async function sendOtpEmail(env: Env, to: string, otp: string): Promise<void> {
  const link = buildOtpLink(env.APP_URL, to, otp)
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] OTP para ${to}: ${otp} — ${link}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: `${otp} é o seu código — Perícopes`,
      html: otpEmailHtml(otp, link),
    }),
  })
  if (!res.ok) {
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${await res.text()}`)
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run worker`
Expected: PASS (5 testes).

- [ ] **Step 7: Lint e commit**

```bash
npm run lint
git add worker package.json package-lock.json
git commit -m "feat: módulos de allowlist e e-mail OTP com testes (vitest)"
```

---

### Task 5: better-auth + D1 no Worker

**Files:**
- Create: `worker/auth.ts`, `worker/index.ts`, `migrations/0001_better_auth.sql`
- Modify: `wrangler.jsonc` (main, D1, flags, vars), `package.json` (deps), `.github/workflows/deploy-worker.yml` (migrations)

**Interfaces:**
- Consumes: `sendOtpEmail`, `isEmailAllowed`, `Env` (Task 4).
- Produces:
  - `createAuth(env: Env)` → instância better-auth; rotas `POST /api/auth/email-otp/send-verification-otp` e `POST /api/auth/sign-in/email-otp` servidas pelo Worker.
  - `app` Hono exportado como default em `worker/index.ts` — a Task 8 adiciona rotas `/api/sync` nele.
  - Sessão obtível com `createAuth(env).api.getSession({ headers })`.

- [ ] **Step 1: Instalar dependências**

Run: `npm i better-auth kysely-d1 hono`

- [ ] **Step 2: [HUMANO] Criar o banco D1**

Run: `npx wrangler d1 create biblia-pericopes`
Expected: imprime `database_id`. Copie-o para o Step 3.

- [ ] **Step 3: Atualizar wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "biblia-pericopes",
  "main": "worker/index.ts",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "biblia-pericopes",
      "database_id": "<ID DO STEP 2>",
      "migrations_dir": "migrations"
    }
  ],
  "vars": {
    "APP_URL": "https://biblia-pericopes.<subdomínio>.workers.dev",
    "EMAIL_FROM": "Perícopes <onboarding@resend.dev>"
  }
}
```

(`<subdomínio>` = o real, visto no deploy da Task 2.)

- [ ] **Step 4: Migration das tabelas do better-auth**

`migrations/0001_better_auth.sql`:

```sql
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX "session_userId" ON "session"("userId");
CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX "account_userId" ON "account"("userId");
CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT,
  "updatedAt" TEXT
);
CREATE INDEX "verification_identifier" ON "verification"("identifier");
CREATE TABLE "rateLimit" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT,
  "count" INTEGER,
  "lastRequest" INTEGER
);
```

**Verificação obrigatória:** rode `npx @better-auth/cli generate` apontando para `worker/auth.ts` (Step 5) e compare com o SQL acima; se a versão instalada do better-auth esperar colunas diferentes, ajuste a migration para o output do CLI antes de aplicar.

- [ ] **Step 5: worker/auth.ts**

```ts
import { betterAuth } from 'better-auth'
import { emailOTP } from 'better-auth/plugins'
import { D1Dialect } from 'kysely-d1'
import { isEmailAllowed } from './allowlist'
import { sendOtpEmail } from './email'
import type { Env } from './env.d'

export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: '/api/auth',
    database: {
      dialect: new D1Dialect({ database: env.DB }),
      type: 'sqlite',
    },
    session: {
      expiresIn: 60 * 60 * 24 * 90, // 90 dias (spec)
      updateAge: 60 * 60 * 24, // renovação rolante diária
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'rateLimit',
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        async sendVerificationOTP({ email, otp }) {
          if (!isEmailAllowed(email, env.ALLOWED_EMAILS)) {
            console.log(`allowlist: bloqueado envio para ${email}`)
            return // resposta genérica de sucesso, sem enviar
          }
          await sendOtpEmail(env, email, otp)
        },
      }),
    ],
  })
}
```

- [ ] **Step 6: worker/index.ts**

```ts
import { Hono } from 'hono'
import { createAuth } from './auth'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

app.notFound((c) => c.json({ error: 'não encontrado' }, 404))

export default app
```

- [ ] **Step 7: Aplicar migration local e testar o fluxo por curl**

```bash
npx wrangler d1 migrations apply biblia-pericopes --local
npm run build
npx wrangler dev
```

Em outro terminal:

```bash
curl -s -X POST http://localhost:8787/api/auth/email-otp/send-verification-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"jairofilho79@gmail.com","type":"sign-in"}'
```

Expected: `{"success":true}` e o código impresso no console do wrangler dev (`[dev] OTP para …`). Então:

```bash
curl -s -c /tmp/cookies.txt -X POST http://localhost:8787/api/auth/sign-in/email-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"jairofilho79@gmail.com","otp":"<CÓDIGO DO CONSOLE>"}'
curl -s -b /tmp/cookies.txt http://localhost:8787/api/auth/get-session
```

Expected: sign-in retorna o user; get-session retorna sessão não-nula (conta criada no primeiro OTP = cadastro aberto).

- [ ] **Step 8: [HUMANO] Secrets e migration em produção**

```bash
npx wrangler secret put BETTER_AUTH_SECRET   # cole: openssl rand -base64 32
npx wrangler secret put RESEND_API_KEY       # do dashboard resend.com (conta free)
npx wrangler d1 migrations apply biblia-pericopes --remote
```

- [ ] **Step 9: CI aplica migrations antes do deploy**

Em `.github/workflows/deploy-worker.yml`, antes do passo `wrangler-action` de deploy, adicione:

```yaml
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: d1 migrations apply biblia-pericopes --remote
```

- [ ] **Step 10: Lint, testes e commit**

```bash
npm run lint && npm test && npm run build
git add worker wrangler.jsonc migrations package.json package-lock.json .github/workflows/deploy-worker.yml
git commit -m "feat: auth por email OTP (better-auth + D1) no Worker"
```

---

### Task 6: Cliente de auth + página /entrar

**Files:**
- Create: `src/lib/auth-client.ts`, `src/pages/Entrar.tsx`
- Modify: `src/App.tsx` (rota + header), `src/styles/app.css` (estilos da página), `vite.config.ts` (proxy dev)

**Interfaces:**
- Consumes: rotas `/api/auth/*` (Task 5).
- Produces:
  - `authClient` com `authClient.useSession()`, `authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })`, `authClient.signIn.emailOtp({ email, otp })`, `authClient.signOut()`.
  - Rota `/entrar` que aceita `?email=…&code=…` (o magic link) e auto-verifica.
  - A Task 9 usa `authClient.useSession()` para decidir se sincroniza.

- [ ] **Step 1: Proxy de dev no vite.config.ts**

Dentro do `defineConfig`, adicione (irmão de `base` e `plugins`):

```ts
server: {
  proxy: { '/api': 'http://localhost:8787' },
},
```

(Dev local: `npm run dev:worker` num terminal, `npm run dev` noutro.)

- [ ] **Step 2: src/lib/auth-client.ts**

```ts
import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})
```

- [ ] **Step 3: src/pages/Entrar.tsx**

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

type Etapa = 'email' | 'codigo' | 'verificando'

export default function Entrar() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const autoTried = useRef(false)

  // magic link: /entrar?email=…&code=…
  useEffect(() => {
    const qEmail = searchParams.get('email')
    const qCode = searchParams.get('code')
    if (!qEmail || !qCode || autoTried.current) return
    autoTried.current = true
    setEmail(qEmail)
    setEtapa('verificando')
    verificar(qEmail, qCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  async function verificar(em: string, otp: string) {
    setErro('')
    const { error } = await authClient.signIn.emailOtp({ email: em, otp })
    if (error) {
      setEtapa('codigo')
      setErro('Código inválido ou expirado. Peça um novo código se necessário.')
    }
    // sucesso: useSession muda e o efeito acima redireciona
  }

  async function onPedirCodigo(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEnviando(true)
    setErro('')
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    })
    setEnviando(false)
    if (error) {
      setErro('Não foi possível enviar o e-mail agora. Tente novamente.')
      return
    }
    setEtapa('codigo')
  }

  async function onVerificar(e: FormEvent) {
    e.preventDefault()
    if (codigo.trim().length !== 6) return
    setEtapa('verificando')
    await verificar(email.trim(), codigo.trim())
  }

  return (
    <section className="entrar">
      <h1>Entrar</h1>
      {etapa === 'email' && (
        <form className="entrar-form" onSubmit={onPedirCodigo}>
          <p className="lead">
            Digite seu e-mail. Enviaremos um código de 6 dígitos e um link de acesso.
          </p>
          <label>
            E-mail
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </label>
          <button type="submit" className="cta" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      )}
      {etapa === 'codigo' && (
        <form className="entrar-form" onSubmit={onVerificar}>
          <p className="lead">
            Enviamos um código para <strong>{email}</strong>. Digite-o abaixo — ou toque no
            link do e-mail.
          </p>
          <label>
            Código de 6 dígitos
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </label>
          <button type="submit" className="cta" disabled={codigo.length !== 6}>
            Entrar
          </button>
          <button type="button" className="linkish" onClick={() => setEtapa('email')}>
            Usar outro e-mail
          </button>
        </form>
      )}
      {etapa === 'verificando' && <p className="muted">Verificando…</p>}
      {erro && <p className="entrar-erro">{erro}</p>}
    </section>
  )
}
```

- [ ] **Step 4: Rota e header em src/App.tsx**

Adicione os imports:

```tsx
import Entrar from './pages/Entrar'
import { authClient } from './lib/auth-client'
```

Dentro de `App()`, antes do `return`: `const { data: session } = authClient.useSession()`.

No `<nav>`, após o link Pesquisar:

```tsx
{session ? (
  <button
    type="button"
    className="linkish nav-conta"
    onClick={() => authClient.signOut()}
    title={session.user.email}
  >
    Sair
  </button>
) : (
  <NavLink to="/entrar">Entrar</NavLink>
)}
```

Nas `<Routes>`: `<Route path="/entrar" element={<Entrar />} />`.

- [ ] **Step 5: Estilos em src/styles/app.css**

Ao final do arquivo:

```css
.entrar {
  max-width: 24rem;
}

.entrar-form {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.entrar-form label {
  display: grid;
  gap: 0.3rem;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--muted);
}

.entrar-form input {
  width: 100%;
  font: inherit;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  min-height: 2.75rem;
}

.entrar-form input[inputmode='numeric'] {
  font-size: 1.5rem;
  letter-spacing: 0.4em;
  text-align: center;
}

.entrar-erro {
  font-family: var(--font-ui);
  color: #b3564d;
  font-size: 0.9rem;
}

.nav-conta {
  font-size: inherit;
  color: var(--muted);
}
```

- [ ] **Step 6: Verificar o fluxo completo em dev**

Terminal A: `npm run build && npm run dev:worker`. Terminal B: `npm run dev`.
Abrir `http://localhost:5173/entrar` → digitar e-mail → pegar o código no console do wrangler → digitar → Expected: redireciona para Home e o header mostra "Sair". Testar também o magic link: abrir `http://localhost:5173/entrar?email=<email>&code=<código novo>` → Expected: entra sozinho. Código reutilizado → Expected: mensagem de código inválido/expirado.

- [ ] **Step 7: Lint, build e commit**

```bash
npm run lint && npm run build
git add src vite.config.ts
git commit -m "feat: página /entrar com código OTP e magic link"
```

---

### Task 7: Schema e API de sync (servidor)

**Files:**
- Create: `migrations/0002_sync.sql`, `worker/sync-logic.ts`, `worker/sync-logic.test.ts`
- Modify: `worker/index.ts` (rotas /api/sync)

**Interfaces:**
- Consumes: `createAuth(env).api.getSession({ headers })` (Task 5).
- Produces (contrato usado pela Task 9):
  - `GET /api/sync?since=<iso>` → `200 { progresso: PushProgresso[], anotacoes: PushAnotacao[], agora: string }` (tudo do usuário se `since` ausente) | `401 { error }`.
  - `POST /api/sync` body `{ progresso: PushProgresso[], anotacoes: PushAnotacao[] }` → `200 { ok: true, agora: string }` | `400/401 { error }`.
  - `type PushProgresso = { pericopeOrdem: number; status: 'nao_iniciado' | 'em_andamento' | 'concluido'; atualizadoEm: string }`
  - `type PushAnotacao = { id: string; pericopeOrdem: number; texto: string; criadoEm: string; atualizadoEm: string; apagadoEm: string | null }`
  - `parseSyncPush(body: unknown): { progresso: PushProgresso[]; anotacoes: PushAnotacao[] } | null`

- [ ] **Step 1: Testes de parse/validação que falham**

`worker/sync-logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseSyncPush } from './sync-logic'

const prog = { pericopeOrdem: 1, status: 'concluido', atualizadoEm: '2026-08-31T10:00:00.000Z' }
const nota = {
  id: 'a1',
  pericopeOrdem: 1,
  texto: 'oração',
  criadoEm: '2026-08-31T09:00:00.000Z',
  atualizadoEm: '2026-08-31T10:00:00.000Z',
  apagadoEm: null,
}

describe('parseSyncPush', () => {
  it('aceita payload válido', () => {
    expect(parseSyncPush({ progresso: [prog], anotacoes: [nota] })).toEqual({
      progresso: [prog],
      anotacoes: [nota],
    })
  })
  it('aceita listas ausentes como vazias', () => {
    expect(parseSyncPush({})).toEqual({ progresso: [], anotacoes: [] })
  })
  it('rejeita status desconhecido, tipos errados e não-objeto', () => {
    expect(parseSyncPush({ progresso: [{ ...prog, status: 'x' }] })).toBeNull()
    expect(parseSyncPush({ anotacoes: [{ ...nota, texto: 5 }] })).toBeNull()
    expect(parseSyncPush(null)).toBeNull()
    expect(parseSyncPush('a')).toBeNull()
  })
  it('rejeita lotes acima de 500 itens e texto acima de 20000 chars', () => {
    expect(parseSyncPush({ progresso: Array(501).fill(prog) })).toBeNull()
    expect(parseSyncPush({ anotacoes: [{ ...nota, texto: 'x'.repeat(20001) }] })).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run worker/sync-logic.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar worker/sync-logic.ts**

```ts
export type PushProgresso = {
  pericopeOrdem: number
  status: 'nao_iniciado' | 'em_andamento' | 'concluido'
  atualizadoEm: string
}

export type PushAnotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}

const STATUS = new Set(['nao_iniciado', 'em_andamento', 'concluido'])
const MAX_ITENS = 500
const MAX_TEXTO = 20_000

function isIso(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v))
}

function validProgresso(v: unknown): v is PushProgresso {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    typeof p.pericopeOrdem === 'number' &&
    typeof p.status === 'string' &&
    STATUS.has(p.status) &&
    isIso(p.atualizadoEm)
  )
}

function validAnotacao(v: unknown): v is PushAnotacao {
  if (typeof v !== 'object' || v === null) return false
  const a = v as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    a.id.length > 0 &&
    a.id.length <= 64 &&
    typeof a.pericopeOrdem === 'number' &&
    typeof a.texto === 'string' &&
    a.texto.length <= MAX_TEXTO &&
    isIso(a.criadoEm) &&
    isIso(a.atualizadoEm) &&
    (a.apagadoEm === null || isIso(a.apagadoEm))
  )
}

export function parseSyncPush(
  body: unknown,
): { progresso: PushProgresso[]; anotacoes: PushAnotacao[] } | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const progresso = b.progresso ?? []
  const anotacoes = b.anotacoes ?? []
  if (!Array.isArray(progresso) || !Array.isArray(anotacoes)) return null
  if (progresso.length > MAX_ITENS || anotacoes.length > MAX_ITENS) return null
  if (!progresso.every(validProgresso) || !anotacoes.every(validAnotacao)) return null
  return { progresso, anotacoes }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run worker/sync-logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Migration 0002**

`migrations/0002_sync.sql`:

```sql
CREATE TABLE "progresso" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pericope_ordem" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "pericope_ordem")
);
CREATE INDEX "progresso_user_upd" ON "progresso"("user_id", "atualizado_em");
CREATE TABLE "anotacoes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pericope_ordem" INTEGER NOT NULL,
  "texto" TEXT NOT NULL,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  "apagado_em" TEXT,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX "anotacoes_user_upd" ON "anotacoes"("user_id", "atualizado_em");
```

- [ ] **Step 6: Rotas em worker/index.ts**

Substitua o conteúdo por:

```ts
import { Hono } from 'hono'
import { createAuth } from './auth'
import { parseSyncPush } from './sync-logic'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

async function requireUserId(c: { env: Env; req: { raw: Request } }): Promise<string | null> {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session?.user.id ?? null
}

app.get('/api/sync', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return c.json({ error: 'não autenticado' }, 401)
  const since = c.req.query('since') ?? ''
  const prog = await c.env.DB.prepare(
    `SELECT pericope_ordem AS pericopeOrdem, status, atualizado_em AS atualizadoEm
     FROM progresso WHERE user_id = ?1 AND atualizado_em > ?2`,
  )
    .bind(userId, since)
    .all()
  const notas = await c.env.DB.prepare(
    `SELECT id, pericope_ordem AS pericopeOrdem, texto, criado_em AS criadoEm,
            atualizado_em AS atualizadoEm, apagado_em AS apagadoEm
     FROM anotacoes WHERE user_id = ?1 AND atualizado_em > ?2`,
  )
    .bind(userId, since)
    .all()
  return c.json({
    progresso: prog.results,
    anotacoes: notas.results,
    agora: new Date().toISOString(),
  })
})

app.post('/api/sync', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return c.json({ error: 'não autenticado' }, 401)
  const parsed = parseSyncPush(await c.req.json().catch(() => null))
  if (!parsed) return c.json({ error: 'payload inválido' }, 400)

  const stmts = [
    ...parsed.progresso.map((p) =>
      c.env.DB.prepare(
        `INSERT INTO progresso (user_id, pericope_ordem, status, atualizado_em)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(user_id, pericope_ordem) DO UPDATE SET
           status = excluded.status, atualizado_em = excluded.atualizado_em
         WHERE excluded.atualizado_em > progresso.atualizado_em`,
      ).bind(userId, p.pericopeOrdem, p.status, p.atualizadoEm),
    ),
    ...parsed.anotacoes.map((a) =>
      c.env.DB.prepare(
        `INSERT INTO anotacoes (id, user_id, pericope_ordem, texto, criado_em, atualizado_em, apagado_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(user_id, id) DO UPDATE SET
           texto = excluded.texto, atualizado_em = excluded.atualizado_em,
           apagado_em = excluded.apagado_em
         WHERE excluded.atualizado_em > anotacoes.atualizado_em`,
      ).bind(a.id, userId, a.pericopeOrdem, a.texto, a.criadoEm, a.atualizadoEm, a.apagadoEm),
    ),
  ]
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ ok: true, agora: new Date().toISOString() })
})

app.notFound((c) => c.json({ error: 'não encontrado' }, 404))

export default app
```

- [ ] **Step 7: Verificar por curl (com o cookie da Task 5)**

```bash
npx wrangler d1 migrations apply biblia-pericopes --local
npm run build && npx wrangler dev
```

Logar de novo por curl (Task 5 Step 7, cookie em `/tmp/cookies.txt`) e:

```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:8787/api/sync \
  -H 'Content-Type: application/json' \
  -d '{"progresso":[{"pericopeOrdem":1,"status":"concluido","atualizadoEm":"2026-08-31T10:00:00.000Z"}]}'
curl -s -b /tmp/cookies.txt 'http://localhost:8787/api/sync'
curl -s 'http://localhost:8787/api/sync'
```

Expected: POST `{"ok":true,…}`; GET com cookie devolve o progresso enviado; GET sem cookie devolve 401. Reenviar o mesmo item com `atualizadoEm` mais antigo → GET continua com o mais novo (LWW).

- [ ] **Step 8: Lint, testes e commit**

```bash
npm run lint && npm test && npm run build
git add worker migrations
git commit -m "feat: API /api/sync com LWW e tombstones no D1"
```

---

### Task 8: Outbox no IndexedDB (cliente)

**Files:**
- Create: `src/lib/sync-merge.ts`, `src/lib/sync-merge.test.ts`
- Modify: `src/lib/user-db.ts` (DB v2, stores `outbox` e `meta`, enqueue nas escritas)

**Interfaces:**
- Consumes: tipos `Anotacao`/`Progresso` existentes em `src/lib/types.ts`.
- Produces (usado pela Task 9):
  - `remoteWinsLocal(remoteAtualizadoEm: string, localAtualizadoEm: string | undefined): boolean`
  - `type OutboxItem = { seq?: number; kind: 'progresso'; ordem: number; status: ProgressoStatus; atualizadoEm: string } | { seq?: number; kind: 'anotacao'; nota: Anotacao; apagadoEm: string | null }`
  - `listOutbox(): Promise<OutboxItem[]>`, `clearOutbox(upToSeq: number): Promise<void>`
  - `getMeta(key: string): Promise<string | undefined>`, `setMeta(key: string, value: string): Promise<void>`
  - `applyRemoteProgresso(items)` e `applyRemoteAnotacoes(items)`: gravam no IndexedDB **sem** passar pelo outbox, respeitando `remoteWinsLocal`; tombstone remoto apaga a nota local.

- [ ] **Step 1: Teste de merge que falha**

`src/lib/sync-merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { remoteWinsLocal } from './sync-merge'

describe('remoteWinsLocal', () => {
  it('remoto mais novo vence', () => {
    expect(remoteWinsLocal('2026-08-31T11:00:00.000Z', '2026-08-31T10:00:00.000Z')).toBe(true)
  })
  it('local mais novo ou igual vence', () => {
    expect(remoteWinsLocal('2026-08-31T10:00:00.000Z', '2026-08-31T11:00:00.000Z')).toBe(false)
    expect(remoteWinsLocal('2026-08-31T10:00:00.000Z', '2026-08-31T10:00:00.000Z')).toBe(false)
  })
  it('sem local, remoto vence', () => {
    expect(remoteWinsLocal('2026-08-31T10:00:00.000Z', undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/sync-merge.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar src/lib/sync-merge.ts**

```ts
export function remoteWinsLocal(
  remoteAtualizadoEm: string,
  localAtualizadoEm: string | undefined,
): boolean {
  if (!localAtualizadoEm) return true
  return remoteAtualizadoEm > localAtualizadoEm
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/sync-merge.test.ts`
Expected: PASS.

- [ ] **Step 5: user-db v2 — stores novos e enqueue**

Em `src/lib/user-db.ts`:

1. `const DB_VERSION = 2`.
2. No `Schema`, adicione:

```ts
outbox: { key: number; value: OutboxItem }
meta: { key: string; value: { key: string; value: string } }
```

3. Exporte o tipo e crie os stores no `upgrade` (que recebe `oldVersion`):

```ts
export type OutboxItem =
  | { seq?: number; kind: 'progresso'; ordem: number; status: ProgressoStatus; atualizadoEm: string }
  | { seq?: number; kind: 'anotacao'; nota: Anotacao; apagadoEm: string | null }
```

```ts
upgrade(database, oldVersion) {
  if (oldVersion < 1) {
    database.createObjectStore('progresso', { keyPath: 'pericopeOrdem' })
    const notes = database.createObjectStore('anotacoes', { keyPath: 'id' })
    notes.createIndex('by-pericope', 'pericopeOrdem')
  }
  if (oldVersion < 2) {
    database.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
    database.createObjectStore('meta', { keyPath: 'key' })
  }
},
```

4. `setProgresso` passa a enfileirar (mesma data gravada localmente):

```ts
export async function setProgresso(ordem: number, status: ProgressoStatus): Promise<void> {
  const atualizadoEm = new Date().toISOString()
  const d = await db()
  await d.put('progresso', { pericopeOrdem: ordem, status, atualizadoEm })
  await d.put('outbox', { kind: 'progresso', ordem, status, atualizadoEm } as OutboxItem)
}
```

5. `saveAnotacao`: após o `put` da nota, adicione
   `await (await db()).put('outbox', { kind: 'anotacao', nota: note, apagadoEm: null } as OutboxItem)`.
6. `deleteAnotacao` vira tombstone:

```ts
export async function deleteAnotacao(id: string): Promise<void> {
  const d = await db()
  const existing = await d.get('anotacoes', id)
  await d.delete('anotacoes', id)
  if (existing) {
    const now = new Date().toISOString()
    await d.put('outbox', {
      kind: 'anotacao',
      nota: { ...existing, atualizadoEm: now },
      apagadoEm: now,
    } as OutboxItem)
  }
}
```

7. Novas funções exportadas:

```ts
export async function listOutbox(): Promise<OutboxItem[]> {
  return (await db()).getAll('outbox')
}

export async function clearOutbox(upToSeq: number): Promise<void> {
  await (await db()).delete('outbox', IDBKeyRange.upperBound(upToSeq))
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await (await db()).get('meta', key))?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await (await db()).put('meta', { key, value })
}

export async function applyRemoteProgresso(
  items: { pericopeOrdem: number; status: ProgressoStatus; atualizadoEm: string }[],
): Promise<void> {
  const d = await db()
  for (const item of items) {
    const local = await d.get('progresso', item.pericopeOrdem)
    if (remoteWinsLocal(item.atualizadoEm, local?.atualizadoEm)) {
      await d.put('progresso', item)
    }
  }
}

export async function applyRemoteAnotacoes(
  items: {
    id: string
    pericopeOrdem: number
    texto: string
    criadoEm: string
    atualizadoEm: string
    apagadoEm: string | null
  }[],
): Promise<void> {
  const d = await db()
  for (const item of items) {
    const local = await d.get('anotacoes', item.id)
    if (!remoteWinsLocal(item.atualizadoEm, local?.atualizadoEm)) continue
    if (item.apagadoEm) {
      await d.delete('anotacoes', item.id)
    } else {
      const { apagadoEm: _apagadoEm, ...nota } = item
      await d.put('anotacoes', nota)
    }
  }
}
```

Importe `remoteWinsLocal` de `./sync-merge` no topo. Note que `Progresso` em `types.ts` já tem exatamente `{ pericopeOrdem, status, atualizadoEm }`.

- [ ] **Step 6: Verificar no app**

Run: `npm run dev` → marcar uma perícope como concluída e criar uma anotação. DevTools → Application → IndexedDB → `biblia-pericopes` → Expected: store `outbox` com 2+ itens; app se comporta como antes (nenhuma regressão sem login).

- [ ] **Step 7: Lint, testes e commit**

```bash
npm run lint && npm test && npm run build
git add src/lib
git commit -m "feat: outbox e merge LWW no IndexedDB (base do sync)"
```

---

### Task 9: Módulo de sync + gatilhos

**Files:**
- Create: `src/lib/sync.ts`
- Modify: `src/App.tsx` (initSyncTriggers), `src/pages/Entrar.tsx` (sync após login)

**Interfaces:**
- Consumes: contrato HTTP da Task 7; funções da Task 8; `authClient` da Task 6.
- Produces: `syncNow(): Promise<void>` e `initSyncTriggers(): void`.

- [ ] **Step 1: Implementar src/lib/sync.ts**

```ts
import { authClient } from './auth-client'
import {
  applyRemoteAnotacoes,
  applyRemoteProgresso,
  clearOutbox,
  getMeta,
  listOutbox,
  setMeta,
  type OutboxItem,
} from './user-db'

const CURSOR_KEY = 'sync-cursor'
let running = false

function toPush(items: OutboxItem[]) {
  const progresso = new Map<number, { pericopeOrdem: number; status: string; atualizadoEm: string }>()
  const anotacoes = new Map<
    string,
    { id: string; pericopeOrdem: number; texto: string; criadoEm: string; atualizadoEm: string; apagadoEm: string | null }
  >()
  for (const item of items) {
    if (item.kind === 'progresso') {
      progresso.set(item.ordem, {
        pericopeOrdem: item.ordem,
        status: item.status,
        atualizadoEm: item.atualizadoEm,
      })
    } else {
      anotacoes.set(item.nota.id, { ...item.nota, apagadoEm: item.apagadoEm })
    }
  }
  return { progresso: [...progresso.values()], anotacoes: [...anotacoes.values()] }
}

export async function syncNow(): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  try {
    const { data: session } = await authClient.getSession()
    if (!session) return

    // push: outbox → servidor (dedupe por chave, último estado vence)
    const outbox = await listOutbox()
    if (outbox.length) {
      const lastSeq = outbox[outbox.length - 1].seq ?? 0
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(toPush(outbox)),
      })
      if (res.status === 401) return
      if (!res.ok) return // fica no outbox para a próxima tentativa
      await clearOutbox(lastSeq)
    }

    // pull incremental
    const since = (await getMeta(CURSOR_KEY)) ?? ''
    const res = await fetch(`/api/sync?since=${encodeURIComponent(since)}`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      progresso: Parameters<typeof applyRemoteProgresso>[0]
      anotacoes: Parameters<typeof applyRemoteAnotacoes>[0]
      agora: string
    }
    await applyRemoteProgresso(data.progresso)
    await applyRemoteAnotacoes(data.anotacoes)
    await setMeta(CURSOR_KEY, data.agora)
  } catch {
    // offline/erro transitório: outbox preservado, próxima chance sincroniza
  } finally {
    running = false
  }
}

export function initSyncTriggers(): void {
  syncNow()
  window.addEventListener('online', () => syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
  })
  window.setInterval(() => syncNow(), 5 * 60 * 1000)
}
```

- [ ] **Step 2: Ligar os gatilhos**

Em `src/App.tsx`, importe `initSyncTriggers` de `./lib/sync` e adicione dentro de `App()`:

```tsx
useEffect(() => {
  initSyncTriggers()
}, [])
```

Em `src/pages/Entrar.tsx`, importe `syncNow` de `../lib/sync` e, no efeito de redirecionamento pós-login, chame antes de navegar:

```tsx
useEffect(() => {
  if (session) {
    syncNow()
    navigate('/', { replace: true })
  }
}, [session, navigate])
```

- [ ] **Step 3: Verificar ponta a ponta em dev**

Terminal A: `npm run build && npm run dev:worker`; Terminal B: `npm run dev`.

1. Logar em `http://localhost:5173/entrar`; concluir a perícope 1 e criar uma anotação.
2. Expected: store `outbox` esvazia após alguns segundos (push ok); `GET /api/sync` (curl com cookie) mostra os dados.
3. Abrir **janela anônima**, logar com o mesmo e-mail (novo código) → Expected: perícope 1 aparece concluída e a anotação visível (pull ok).
4. Na anônima, apagar a anotação → na janela normal, trocar de aba e voltar (visibilitychange) → Expected: anotação some (tombstone propagado).
5. DevTools offline → concluir outra perícope → voltar online → Expected: sincroniza sozinho.

- [ ] **Step 4: Lint, testes, build e commit**

```bash
npm run lint && npm test && npm run build
git add src
git commit -m "feat: sync local-first com outbox, pull incremental e gatilhos"
```

---

### Task 10: Deploy final + checklist PWA + docs

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: tudo acima.
- Produces: app em produção com auth+sync; README atualizado.

- [ ] **Step 1: Deploy**

Run: `git push` (CI faz migrations + deploy) — ou `npm run deploy` + `npx wrangler d1 migrations apply biblia-pericopes --remote`.

- [ ] **Step 2: [HUMANO] Checklist PWA em produção (do spec)**

No celular, com o usuário:
1. Instalar o PWA a partir da URL workers.dev.
2. Logar **pelo código digitado** dentro do PWA (caminho B do spec).
3. Clicar o magic link do e-mail → abre no browser → Expected: entra lá também é ok; se o código já foi usado, mensagem pede novo código (comportamento esperado).
4. Fechar o app, reabrir → Expected: continua logado (cookie 90 dias).
5. Modo avião → Expected: leitura, progresso e anotações funcionam; ao voltar online, sincroniza.
6. Conferir no segundo dispositivo/browser que o progresso apareceu.

- [ ] **Step 3: Atualizar README.md**

Na seção "Dados do usuário", substitua o texto por:

```markdown
## Dados do usuário

Progresso e anotações ficam no IndexedDB (offline-first). Com login (e-mail →
código de 6 dígitos ou magic link), os dados sincronizam entre dispositivos
via Cloudflare D1 (last-write-wins). Sem login, tudo funciona 100% local.

## Deploy

Cloudflare Workers (static assets + API). Push na `main` roda migrations D1 e
`wrangler deploy` via GitHub Actions. Secrets do worker: `BETTER_AUTH_SECRET`,
`RESEND_API_KEY`. Env opcional `ALLOWED_EMAILS` restringe o cadastro.
```

- [ ] **Step 4: Commit final**

```bash
git add README.md
git commit -m "docs: README com login, sync e deploy no Cloudflare Workers"
git push
```
