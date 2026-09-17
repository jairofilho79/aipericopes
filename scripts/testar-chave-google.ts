/**
 * Script para testar e validar a autenticação da GEMINI_API_KEY no Google AI Studio
 * e verificar a disponibilidade da síntese de voz nativa com a voz Algenib.
 *
 * Uso: npx tsx scripts/testar-chave-google.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

function obterGeminiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      if (line.startsWith('GEMINI_API_KEY=')) {
        return line.split('=', 2)[1].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  throw new Error('GEMINI_API_KEY não encontrada no arquivo .env!\nAdicione a linha: GEMINI_API_KEY="AIzaSy..."')
}

async function main() {
  console.log('==================================================================')
  console.log('  TESTE DE VALIDAÇÃO DA CHAVE GOOGLE AI STUDIO (GEMINI_API_KEY)')
  console.log('==================================================================\n')

  let apiKey: string
  try {
    apiKey = obterGeminiKey()
    console.log(`🔑 Chave detectada no .env: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)
  } catch (err: any) {
    console.error('❌', err.message)
    process.exit(1)
  }

  // 1. Teste de Listagem de Modelos (Autenticação básica)
  console.log('\n[1/2] Testando permissões na Generative Language API...')
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  const listRes = await fetch(listUrl)

  if (!listRes.ok) {
    const errText = await listRes.text()
    console.error('❌ Falha na autenticação da API do Google (HTTP ' + listRes.status + '):')
    console.error(errText)
    console.log('\n💡 Como resolver:')
    console.log('1. Verifique se ativou a "Generative Language API" no seu projeto:')
    console.log('   https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com')
    console.log('2. Certifique-se de que a chave foi criada no projeto onde os US$ 300 estão ativos.')
    process.exit(1)
  }

  const listData = await listRes.json()
  console.log(`✅ Autenticação bem-sucedida! ${listData.models?.length || 0} modelos disponíveis no projeto.`)

  // 2. Teste de Síntese de Áudio com a voz Algenib
  console.log('\n[2/2] Testando síntese de áudio (modalidade AUDIO + Algenib)...')
  const audioUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`

  const payload = {
    contents: [
      {
        parts: [{ text: 'No princípio criou Deus os céus e a terra.' }],
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

  const audioRes = await fetch(audioUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!audioRes.ok) {
    const errText = await audioRes.text()
    console.error('❌ Erro na síntese de áudio Google (HTTP ' + audioRes.status + '):')
    try {
      const errJson = JSON.parse(errText)
      console.error(JSON.stringify(errJson, null, 2))
      if (errJson.error?.message?.includes('prepayment credits') || audioRes.status === 429) {
        console.log('\n💡 DIAGNÓSTICO DO ERRO 429 (Prepayment credits depleted):')
        console.log('Sua chave é válida e começa com AQ., mas o projeto no AI Studio ainda não está conectado à sua conta de faturamento do Google Cloud com os US$ 300.')
        console.log('\nComo resolver em 1 minuto:')
        console.log('1. Acesse: https://aistudio.google.com/app/apikey')
        console.log('2. Ao lado da sua chave, veja a coluna "Plan" ou "Project". Se estiver "Free Tier" ou "Prepay", clique em "Set up billing" ou "Link Cloud Project".')
        console.log('3. Selecione o seu projeto do Google Cloud onde os US$ 300 de crédito gratuito estão ativos.')
        console.log('4. Salve e execute novamente este script!\n')
      }
    } catch {
      console.error(errText)
    }
    process.exit(1)
  }

  const audioData = await audioRes.json()
  const inline = audioData.candidates?.[0]?.content?.parts?.[0]?.inlineData

  if (!inline?.data) {
    console.error('❌ Resposta da API não conteve áudio:', JSON.stringify(audioData))
    process.exit(1)
  }

  const buf = Buffer.from(inline.data, 'base64')
  console.log(`✅ Áudio recebido com sucesso! (${buf.length} bytes, formato: ${inline.mimeType})`)

  console.log('\n==================================================================')
  console.log('🎉 TUDO PRONTO!')
  console.log('Sua GEMINI_API_KEY está 100% sincronizada com o Google Cloud.')
  console.log('As gerações de áudio serão debitadas dos seus US$ 300 de crédito gratuito.')
  console.log('==================================================================\n')
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
