import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const raiz = dirname(fileURLToPath(import.meta.url))

/**
 * Hash da geração de shards, escrito por scripts/shard-catalogo.ts. O gerador
 * roda no `prebuild`/`predev`, ou seja, antes do vite carregar esta config —
 * por isso dá para ler o arquivo aqui, de forma síncrona.
 */
function versaoDosShards(ehBuild: boolean): string {
  try {
    const { hash } = JSON.parse(readFileSync(join(raiz, 'public/data/versao.json'), 'utf8')) as {
      hash: string
    }
    if (hash) return hash
  } catch {
    // cai no tratamento abaixo
  }
  if (ehBuild) {
    // Publicar com um nome de cache errado congelaria o catálogo dos clientes
    // já instalados: melhor quebrar o build.
    throw new Error('public/data/versao.json ausente — rode `npm run shard` antes de buildar')
  }
  return 'dev' // dev e testes: o service worker nem é gerado
}

/**
 * O Workbox só sabe limpar precaches (cleanupOutdatedCaches); o cache de
 * runtime dos shards ficaria para sempre. Como o generateSW não tem gancho para
 * código próprio no service worker, o listener de `activate` é acrescentado ao
 * dist/sw.js recém-gerado — o mesmo arquivo em que o nome do cache atual já
 * está embutido, então os dois nunca saem de sincronia.
 */
function limpezaDeShardsAntigos(cacheAtual: string): Plugin {
  let saida = join(raiz, 'dist')
  return {
    name: 'limpeza-de-shards-antigos',
    apply: 'build',
    configResolved(config) {
      saida = resolve(config.root, config.build.outDir)
    },
    closeBundle: {
      sequential: true,
      // 'post' garante rodar depois do closeBundle do vite-plugin-pwa, que é
      // quem escreve o sw.js.
      order: 'post',
      handler() {
        const sw = join(saida, 'sw.js')
        // Falhar em silêncio aqui deixaria o build passar sem o listener de
        // limpeza: o service worker publicado ficaria com um cache versionado
        // (cacheAtual) e ninguém nunca apagando as gerações antigas — cada
        // deploy acumularia mais ~13,7 MB no dispositivo de cada usuário, sem
        // erro nenhum. Melhor quebrar o build do que publicar isso.
        if (!existsSync(sw)) {
          throw new Error(
            `[limpeza-de-shards-antigos] ${sw} não existe depois do build do vite-plugin-pwa. ` +
              'O plugin deve ter mudado onde/quando escreve o service worker (opção `filename`, ' +
              'estratégia `injectManifest`, ou um hook que roda depois de `closeBundle`) — ajuste ' +
              'este plugin para acompanhar antes de publicar.',
          )
        }
        const nome = JSON.stringify(cacheAtual)
        const conteudo = readFileSync(sw, 'utf8')
        if (!conteudo.includes(cacheAtual)) {
          throw new Error(
            `[limpeza-de-shards-antigos] ${sw} não contém o nome do cache atual (${cacheAtual}). ` +
              'O vite-plugin-pwa deve ter parado de honrar a opção `runtimeCaching`, o que quebraria ' +
              'o pareamento entre o cache versionado dos shards e este listener de limpeza — ajuste ' +
              'este plugin (ou a config do workbox) antes de publicar.',
          )
        }
        appendFileSync(
          sw,
          `\nself.addEventListener('activate',(evento)=>{evento.waitUntil(caches.keys().then((nomes)=>Promise.all(nomes.filter((n)=>n.startsWith('catalogo-shards-')&&n!==${nome}).map((n)=>caches.delete(n)))))});\n`,
        )
      },
    },
  }
}

export default defineConfig(({ command }) => {
  const cacheDosShards = `catalogo-shards-${versaoDosShards(command === 'build')}`

  return {
    base: '/',
    server: {
      proxy: { '/api': 'http://localhost:8787' },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'favicon.png',
          'favicon.ico',
          'apple-touch-icon.png',
          'brand/logo.png',
          'brand/logo-master.png',
          'data/index.json',
        ],
        manifest: {
          name: 'aiPericopes — Estudo Bíblico',
          short_name: 'aiPericopes',
          description:
            'Estudo bíblico por perícopes. O texto é a Bíblia Livre; o material e a narração são de IA, e isso está dito.',
          theme_color: '#92500a',
          background_color: '#f5f1e8',
          display: 'standalone',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
          // O índice entra no precache (é o que a primeira tela espera); os shards
          // não — precachear os 132 arquivos desfaria a mudança inteira.
          globIgnores: ['**/data/texto/**', '**/data/estudo/**'],
          // /api/** é do Worker (auth e sync): nunca responder com o index.html
          // do app shell no lugar de uma resposta de API.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Conteúdo estático dentro de uma geração do catálogo: uma vez em
              // cache, nunca precisa de rede. O hash no nome do cache é o que
              // faz um catálogo novo chegar em quem já tem o app instalado.
              urlPattern: /\/data\/(texto|estudo)\/.*\.json$/,
              handler: 'CacheFirst',
              options: {
                cacheName: cacheDosShards,
                expiration: { maxEntries: 200 },
                plugins: [
                  {
                    // O Cloudflare responde caminho inexistente com o index.html
                    // e HTTP 200 (not_found_handling: single-page-application).
                    // Guardar esse HTML sob a URL do shard quebraria o livro.
                    cacheWillUpdate: async ({ response }) =>
                      response.status === 200 &&
                      (response.headers.get('content-type') ?? '').includes('json')
                        ? response
                        : null,
                  },
                ],
              },
            },
          ],
        },
      }),
      limpezaDeShardsAntigos(cacheDosShards),
    ],
  }
})
