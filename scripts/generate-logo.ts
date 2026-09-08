/**
 * One-shot: gera logo-master.png via OpenRouter Gemini 3 Pro Image.
 * Uso: node_modules/.bin/tsx scripts/generate-logo.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/brand/logo-master.png')
const MODEL = 'google/gemini-3-pro-image-preview'

const PROMPT = `Create a single app icon / logo mark for a Progressive Web App called "aiPericopes".

App context:
- Daily Bible study in Portuguese, reading by pericopes (narrative units), not random chapters.
- Offline-first PWA for young people and teens who already know a little of the Bible and want to go deeper.
- The app is openly AI-assisted: the study material and the narration voice are machine-made, and the app says so plainly. The mark should feel like warm, careful craft — never sci-fi, never a robot, never a circuit board.
- Goal: know God and Jesus through each pericope, with warm, clear, readable design — never preachy or cluttered.

Brand rule this mark must obey:
- Amber is the voice of the app: it marks where the machine entered. Scripture itself is never branded — it is marked by the ABSENCE of the mark. So the mark stands for the app's own voice (light, attention, warmth), not for the Bible as an object.

Visual requirements (strict):
- Square 1:1 composition, designed as a mobile home-screen icon.
- SYMBOL ONLY — no letters, no words, no "aiPericopes" text.
- Simple, bold shapes that stay readable at 32-48px.
- Flat / semi-flat modern mark (not photorealistic, not 3D glossy).
- Primary color: amber #c4780e, deepening to #92500a for weight; background: warm paper cream #f5f1e8; ink for any dark shape: #1c1914.
- Motif idea: a small steady flame or a single point of warm light — the candle by which someone reads. A short reading block or a soft dawn glow may support it. NOT a church building, NOT an ornate cross, NOT a robot or circuitry.
- Keep ~20% safe margin from the edges (maskable PWA icon).
- Solid background in cream paper OR deep ink — no busy gradients, no photoreal texture, no watermark.
- Centered, balanced, professional mobile app icon.`

async function main() {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY ausente')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: PROMPT }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: '1:1', image_size: '2K' },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[]; content?: string } }[]
  }
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
  if (!url) {
    console.error(JSON.stringify(data, null, 2).slice(0, 2000))
    throw new Error('Resposta sem imagem')
  }

  let buf: Buffer
  if (url.startsWith('data:')) {
    const b64 = url.replace(/^data:image\/\w+;base64,/, '')
    buf = Buffer.from(b64, 'base64')
  } else {
    const img = await fetch(url)
    if (!img.ok) throw new Error(`Download imagem falhou: ${img.status}`)
    buf = Buffer.from(await img.arrayBuffer())
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, buf)
  console.log(`OK ${OUT} (${buf.length} bytes)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
