/**
 * Script para testar a autenticação no Google Cloud Vertex AI
 * utilizando uma Conta de Serviço (Service Account) para consumir
 * diretamente os US$ 300 de créditos promocionais do Google Cloud.
 *
 * Não requer nenhuma biblioteca externa (usa apenas node:crypto nativo).
 *
 * Uso: npx tsx scripts/testar-vertex-ai.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createSign } from 'node:crypto'

const root = join(import.meta.dirname, '..')

function encontrarArquivoKey(): string | null {
  const padrao = join(root, 'google-service-account.json')
  if (existsSync(padrao)) return padrao
  const arquivos = readdirSync(root)
  const achado = arquivos.find(
    (f) =>
      (f.startsWith('kitchen-auth-') || f.includes('service-account') || f.includes('serviceaccount')) &&
      f.endsWith('.json'),
  )
  return achado ? join(root, achado) : null
}

const keyFile = encontrarArquivoKey()

interface ServiceAccountKey {
  project_id: string
  client_email: string
  private_key: string
}

function base64url(str: string | Buffer): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function obterTokenAcessoVertex(sa: ServiceAccountKey): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora,
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const dataToSign = `${encodedHeader}.${encodedPayload}`

  const signer = createSign('RSA-SHA256')
  signer.update(dataToSign)
  const signature = signer.sign(sa.private_key, 'base64url')

  const jwt = `${dataToSign}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro OAuth2 Google (${res.status}): ${errText}`)
  }

  const json = await res.json()
  return json.access_token
}

async function main() {
  console.log('==================================================================')
  console.log('  TESTE DE CONEXÃO — GOOGLE CLOUD VERTEX AI (US$ 300 CRÉDITOS)')
  console.log('==================================================================\n')

  if (!keyFile || !existsSync(keyFile)) {
    console.error(`❌ Arquivo de credenciais não encontrado (ex: google-service-account.json ou kitchen-auth-*.json)\n`)
    console.log('💡 PASSO A PASSO PARA GERAR A CHAVE DA SERVICE ACCOUNT:')
    console.log('1. Acesse o Google Cloud IAM no seu projeto:')
    console.log('   https://console.cloud.google.com/iam-admin/serviceaccounts?project=kitchen-auth-507219')
    console.log('2. Clique em "CRIAR CONTA DE SERVIÇO".')
    console.log('   Nome: gemini-tts-service')
    console.log('3. No papel de permissão, atribua: "Usuário do Vertex AI" (Vertex AI User).')
    console.log('4. Conclua a criação, clique na conta de serviço criada e vá na aba "Chaves" (Keys).')
    console.log('5. Clique em "Adicionar chave" -> "Criar nova chave" -> tipo JSON.')
    console.log('6. Salve o arquivo JSON baixado na raiz do projeto com o nome:')
    console.log('   google-service-account.json\n')
    process.exit(1)
  }

  const sa: ServiceAccountKey = JSON.parse(readFileSync(keyFile, 'utf8'))
  console.log(`Projeto: ${sa.project_id}`)
  console.log(`Email de serviço: ${sa.client_email}`)

  console.log('\n[1/2] Obtendo token OAuth2 com o Google Cloud...')
  const token = await obterTokenAcessoVertex(sa)
  console.log('✅ Token OAuth2 emitido com sucesso pelo Google!')

  console.log('\n[2/2] Testando Vertex AI TTS (Voz Algenib - gemini-3.1-flash-tts-preview)...')
  const endpointTTS = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/gemini-3.1-flash-tts-preview:generateContent`

  const payloadTTS = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'No princípio, criou Deus os céus e a terra.' }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Algenib',
          },
        },
      },
    },
  }

  const resTTS = await fetch(endpointTTS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payloadTTS),
  })

  if (!resTTS.ok) {
    const errTTS = await resTTS.text()
    console.error(`❌ Erro Vertex AI TTS (${resTTS.status}):`, errTTS)
    process.exit(1)
  }

  const dataTTS = await resTTS.json()
  const inline = dataTTS.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inline?.data) {
    console.error('❌ Resposta do Vertex AI sem áudio inlineData:', JSON.stringify(dataTTS))
    process.exit(1)
  }

  const audioBuf = Buffer.from(inline.data, 'base64')
  console.log(`✅ Áudio TTS gerado com sucesso pelo Vertex AI! (${audioBuf.length} bytes recebidos)`)
  console.log(`   Formato: ${inline.mimeType || 'audio/l16'}`)

  console.log('\n==================================================================')
  console.log('🎉 SUCESSO TOTAL E ABSOLUTO!')
  console.log('Sua conta está conectada ao Vertex AI e consumindo dos US$ 300!')
  console.log('O modelo gemini-3.1-flash-tts-preview com voz Algenib está 100% ativo.')
  console.log('==================================================================\n')
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
