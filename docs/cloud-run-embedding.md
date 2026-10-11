# Deploy do EmbeddingGemma-2 no Google Cloud Run (Serverless Fallback)

Este documento registra a receita completa para colocar o modelo `embeddinggemma-2` em produção no Google Cloud Run, com escala a zero (custo zero quando inativo) e aproveitando o Free Tier mensal do Google (até 2 milhões de requisições gratuitas por mês).

---

## 1. Estrutura dos Arquivos

### `deploy/cloud-run/entrypoint.sh`
```bash
#!/bin/sh
# O Cloud Run define a porta de escuta na variável $PORT (geralmente 8080)
export OLLAMA_HOST="0.0.0.0:${PORT:-8080}"
exec ollama serve
```

### `deploy/cloud-run/Dockerfile`
```dockerfile
FROM ollama/ollama:latest

ENV OLLAMA_MODELS=/root/.ollama/models

# Durante o build da imagem, sobe o daemon temporariamente e embuti o modelo
RUN ollama serve & \
    SERVER_PID=$! && \
    sleep 3 && \
    ollama pull embeddinggemma-2:latest && \
    kill $SERVER_PID

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
```

---

## 2. Comandos de Deploy (Google Cloud Build + Cloud Run)

Execute estes comandos no terminal da sua máquina (com `gcloud` instalado):

```bash
# 1. Autenticar na sua conta Google Cloud
gcloud auth login

# 2. Configurar o ID do projeto Google Cloud
gcloud config set project SEU_PROJECT_ID

# 3. Habilitar APIs do Cloud Run e Cloud Build (uma única vez)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# 4. Compilar a imagem na nuvem do Google (sem gastar sua banda de upload)
gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/embedding-gemma deploy/cloud-run

# 5. Criar o serviço Serverless no Cloud Run (Escala a Zero)
gcloud run deploy embedding-gemma \
  --image gcr.io/SEU_PROJECT_ID/embedding-gemma \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 8
```

O comando retornará a URL pública HTTPS:
`https://embedding-gemma-xxxxxxxxxx.a.run.app`

---

## 3. Consumo no Cloudflare Worker (`worker/index.ts`)

Quando o cliente não tiver WebGPU no dispositivo, o Worker pode atuar como proxy seguro:

```typescript
// Exemplo de integração no Worker:
app.post('/api/busca-semantica-fallback', async (c) => {
  const { q } = await c.req.json()
  if (!q || typeof q !== 'string') return c.json({ hits: [] })

  const res = await fetch(`${c.env.CLOUD_RUN_EMBED_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'embeddinggemma-2:latest',
      input: [q.trim()],
    }),
  })

  const data = await res.json()
  const rawVec = data.embeddings[0] // 768 floats

  // Trunca para 256 dimensões e normaliza L2 (Matryoshka)
  const slice = rawVec.slice(0, 256)
  const norm = Math.hypot(...slice) || 1
  const vetor256 = slice.map((v: number) => v / norm)

  return c.json({ vetor: vetor256 })
})
```
