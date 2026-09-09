/**
 * Serve a narração do corpus LOCAL no lugar da API, para ver a interface do
 * player sem publicar nada no R2.
 *
 * O app pede sempre `/api/audio/<voz>/<ordem>.(m4a|json)` (src/lib/manifesto.ts),
 * e o dev do vite manda `/api` para localhost:8787 (vite.config.ts). Este
 * servidor ocupa essa porta e traduz o pedido para
 * `<corpus>/<voz>/<ordem em 4 dígitos>/{pericope.m4a,manifest.json}`.
 *
 * Range e HEAD são atendidos porque o player usa os dois: um HEAD decide se
 * existe áudio, e o Safari se recusa a tocar quem não sabe responder Range.
 *
 * Ferramenta de bancada — não vai para produção, quem serve isso de verdade é
 * o Worker (worker/index.ts).
 *
 * Uso: node scripts/servir-narracao-local.mjs
 */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const CORPUS = '/Volumes/SSD 2TB SD/dev/tts-corpus'
const PORTA = 8787

const ARQUIVO = { m4a: 'pericope.m4a', json: 'manifest.json' }
const TIPO = { m4a: 'audio/mp4', json: 'application/json' }

createServer((req, res) => {
  const rota = /^\/api\/audio\/([a-z][a-z0-9-]*)\/(\d+)\.(m4a|json)$/.exec(
    new URL(req.url, 'http://x').pathname,
  )
  if (!rota) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('só /api/audio aqui')
    return
  }
  const [, voz, ordem, ext] = rota
  const caminho = join(CORPUS, voz, ordem.padStart(4, '0'), ARQUIVO[ext])

  let tamanho
  try {
    tamanho = statSync(caminho).size
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('sem narração local')
    return
  }

  const cabecalhos = {
    'content-type': TIPO[ext],
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
  }
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  const inicio = faixa?.[1] ? Number(faixa[1]) : 0
  const fim = faixa?.[2] ? Number(faixa[2]) : tamanho - 1

  if (faixa) {
    cabecalhos['content-range'] = `bytes ${inicio}-${fim}/${tamanho}`
    cabecalhos['content-length'] = String(fim - inicio + 1)
  } else {
    cabecalhos['content-length'] = String(tamanho)
  }

  res.writeHead(faixa ? 206 : 200, cabecalhos)
  if (req.method === 'HEAD') res.end()
  else createReadStream(caminho, { start: inicio, end: fim }).pipe(res)
}).listen(PORTA, () => {
  console.log(`narração local em http://localhost:${PORTA}/api/audio/<voz>/<ordem>.m4a`)
  console.log(`corpus: ${CORPUS}`)
})
