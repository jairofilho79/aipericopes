# Kickoff — o domínio próprio e o e-mail de login

> Arquivo de largada para a sessão que estiver juntando os trabalhos.
> Prompt sugerido:
> **"Leia docs/kickoff-dominio-e-email.md e me diga o que falta encostar."**

## Estado (2026-09-05) — entregue e commitado

Commit `7b97730`, na `v2-biblia-livre`. Duas coisas mudaram, e as duas já estão
testadas (`tsc` limpo, 546 testes do worker passando):

**1. O app tem domínio de envio próprio.** `send.aipericopes.com` está
verificado no Resend (região São Paulo, `sa-east-1`), com DKIM + SPF + MX na
Cloudflare. Antes disso o remetente era `onboarding@resend.dev`, o sandbox do
Resend, que **só entrega para o dono da conta** — qualquer outro destinatário
levava 403 e o cadastro estava quebrado para todo mundo menos uma pessoa.

**2. Falha de envio deixou de virar sucesso na tela.** O better-auth chama
`sendVerificationOTP` dentro de `runInBackgroundOrAwait`, que faz try/catch e
despeja a exceção no logger dele; a rota respondia 200 com `{ success: true }`
mesmo sem e-mail nenhum ter saído. `criarEnviadorOtp` (em `worker/auth.ts`)
reporta a falha antes que ela seja engolida, e `/api/auth/*` traduz em 502.

## O que a sessão do rebranding precisa pegar

O plano `docs/superpowers/plans/2026-09-05-rebranding-aipericopes.md` cobre
`worker/email.ts` muito bem (Task 4, Step 3). Faltam **duas coisas fora do
alcance da verificação dele**, e vale corrigir a verificação junto.

### a) O nome de exibição do remetente

`wrangler.jsonc` hoje:

```jsonc
"EMAIL_FROM": "Perícopes <acesso@send.aipericopes.com>"
```

Esse "Perícopes" é o que aparece **como nome do remetente na caixa de entrada**
de quem recebe o código. Deve virar `aiPericopes`:

```jsonc
"EMAIL_FROM": "aiPericopes <acesso@send.aipericopes.com>"
```

O endereço (`acesso@send.aipericopes.com`) **não muda** — está amarrado ao
domínio verificado no Resend. Trocar o endereço exige verificar outro domínio.

### b) O grep de verificação não olha o `wrangler.jsonc`

A Task 4, Step 5 manda rodar:

```
grep -rn "Perícopes" src worker index.html vite.config.ts wrangler.jsonc README.md
```

`wrangler.jsonc` não está na lista, então o item (a) passa batido e a marca
antiga sobrevive justamente no lugar mais visível para quem se cadastra.
Acrescente `wrangler.jsonc` ao grep.

### c) `APP_URL` ainda aponta para o `workers.dev`

```jsonc
"APP_URL": "https://biblia-pericopes.jairofilho79.workers.dev"
```

Ela alimenta três coisas: o `baseURL` do better-auth, os `trustedOrigins`, e
**o link dentro do e-mail de login** (`buildOtpLink`, `worker/email.ts:4`).
Enquanto ela não mudar, o e-mail sai de `@send.aipericopes.com` mas o botão
leva para o endereço antigo. Funciona, mas fica incoerente para quem lê — e
remetente e destino em domínios diferentes é sinal que filtro antispam pesa
contra.

Trocar `APP_URL` **não é só editar a linha**: exige que o Worker atenda no
domínio novo (custom domain ou route na Cloudflare) antes, senão o link do
e-mail passa a apontar para o vazio. Ou seja, é a última peça, não a primeira.

## Cuidados com a zona `aipericopes.com` na Cloudflare

A zona tinha 0 registros e agora tem 3, todos de e-mail, todos `DNS only`:

| Tipo | Nome | Conteúdo |
|---|---|---|
| TXT | `resend._domainkey.send` | a chave DKIM (216 caracteres) |
| MX | `send.send` | `feedback-smtp.sa-east-1.amazonses.com`, prioridade 10 |
| TXT | `send.send` | `v=spf1 include:amazonses.com ~all` |

- **Não apague nenhum dos três** ao adicionar os registros do app. Se o DKIM ou
  o SPF sumir, o Resend desverifica o domínio e o login para de funcionar — em
  silêncio no painel, com o erro só no `wrangler tail`.
- Os registros do app (raiz e `www`) vivem em nomes diferentes e podem ser
  proxiados normalmente (nuvem laranja). Os três acima **não**: registro de
  e-mail proxiado não resolve.
- Não há CNAME de tracking, e é de propósito: o Resend só rastreia cliques
  depois que se configura um subdomínio de tracking. Se alguém ligar isso, o
  link do botão "Entrar" passa a ser reescrito por um redirecionador — péssimo
  justamente num e-mail de acesso.

## O que NÃO renomear

O nome do Worker (`biblia-pericopes`), o banco D1 (`biblia-pericopes`) e o
bucket R2 (`biblia-pericopes-audio`) são identidade de infraestrutura, não
marca. Renomear qualquer um deles significa recriar o recurso e migrar dado —
e as chaves de áudio no R2 são justamente o que custou caro para gerar.
Ninguém vê esses nomes. Deixe como está.

## Antes de dar por pronto

O conserto do e-mail **só vale depois do deploy** (`git push` para `main`).
Ele não é verificável por teste: os testes provam que o 502 aparece, não que o
Resend entrega.

A prova real é uma só — pedir um código para **um e-mail que não seja o dono da
conta Resend** e ver ele chegar. Se não chegar:

1. `npx wrangler tail` num terminal de verdade e repetir o pedido.
2. Se aparecer `Falha ao enviar e-mail (403)`, o domínio desverificou — confira
  os três registros de DNS acima.
3. Se aparecer `[dev] OTP para …` com o código em texto puro, a
  `RESEND_API_KEY` está vazia. Regrave o secret **num terminal seu**, nunca
  pelo shell do Claude Code: já houve um caso de secret gravado vazio por ali,
  com falha silenciosa idêntica.

Lembre que o cadastro está **aberto**: `ALLOWED_EMAILS` não tem valor, e a
allowlist libera todo mundo quando está vazia. Se a intenção for restringir,
é uma variável nova — e o bloqueio dela é silencioso de propósito (não revela
quais e-mails têm conta), então quem for barrado vê "código enviado" e não
recebe nada.
