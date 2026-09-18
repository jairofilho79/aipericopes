/**
 * Fatia o catálogo em quatro conjuntos servíveis:
 *   public/data/index.json        — metadados de todas as perícopes (~480 KB)
 *   public/data/texto/<slug>.json — texto por livro (4,3 MB no total)
 *   public/data/estudo/<slug>.json— contexto/resenha/perguntas/tópicos (9,0 MB)
 *   public/data/versao.json       — hash desta geração, lido pelo vite.config
 *
 * Roda antes do vite (build e dev). É função pura das fontes abaixo: os
 * derivados não são versionados.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { livroSlug } from '../src/lib/livro-slug'
import { readingMinutes } from '../src/lib/reading-time'
import type { Pericope } from '../src/lib/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogoPath = join(root, 'data/pericopes.json')
/**
 * Quais perícopes têm narração publicada no R2. Escrito por
 * scripts/conferir-narracao.sh, que é quem sabe — o formato está documentado
 * lá. Pode não existir: quem clona o repositório sem rodar a conferência gera
 * shards com `narrado: false` em tudo, e nada quebra.
 */
const coberturaPath = join(root, 'data/audio-cobertura.json')
const outDir = join(root, 'public/data')
const indexPath = join(outDir, 'index.json')
const versaoPath = join(outDir, 'versao.json')

/**
 * O que decide o conteúdo dos shards não é só o catálogo: mudar o cálculo de
 * minutos, o slug do livro ou este próprio script muda os arquivos gerados sem
 * encostar em data/pericopes.json.
 */
const fontes = [
  catalogoPath,
  // A cobertura entra aqui, e não só na leitura do índice, por causa do hash
  // abaixo: publicar um lote de narração muda `narrado` sem encostar no
  // catálogo, e sem essa linha a versão dos shards não mudaria — o service
  // worker continuaria servindo o index.json velho do cache e o botão "Ouvir"
  // nunca apareceria em quem já tem o app instalado.
  coberturaPath,
  join(root, 'scripts/shard-catalogo.ts'),
  join(root, 'src/lib/livro-slug.ts'),
  join(root, 'src/lib/reading-time.ts'),
]

/** mtime de uma fonte; 0 quando ela é opcional e não existe. */
function mtimeDaFonte(fonte: string): number {
  return existsSync(fonte) ? statSync(fonte).mtimeMs : 0
}

function precisaGerar(): boolean {
  if (process.argv.includes('--force')) return true
  try {
    if (!existsSync(versaoPath)) return true
    // index.json é escrito por último: o mtime dele é a marca de "geração
    // completa", não de "geração começada".
    const saida = statSync(indexPath).mtimeMs
    return fontes.some((fonte) => mtimeDaFonte(fonte) > saida)
  } catch {
    return true // saída ausente: gera
  }
}

/** Ordens com narração publicada. Vazio quando a cobertura nunca foi gerada. */
function lerCobertura(): Set<number> {
  if (!existsSync(coberturaPath)) return new Set()
  const { ordens } = JSON.parse(readFileSync(coberturaPath, 'utf8')) as { ordens: number[] }
  return new Set(ordens)
}

/**
 * Identidade desta geração de shards. Vai para o nome do cache de runtime do
 * service worker, então precisa mudar sempre que o conteúdo dos shards mudar —
 * e nunca quando ele não muda (senão todo deploy rebaixaria 13,7 MB de novo).
 */
function versaoDosShards(): string {
  const hash = createHash('sha256')
  for (const fonte of fontes) hash.update(existsSync(fonte) ? readFileSync(fonte) : '')
  return hash.digest('hex').slice(0, 8)
}

function main(): void {
  if (!precisaGerar()) {
    console.log('[shard] saídas em dia — nada a fazer')
    return
  }
  const catalogo = JSON.parse(readFileSync(catalogoPath, 'utf8')) as Pericope[]
  const cobertura = lerCobertura()

  const porSlug = new Map<string, { livro: string; itens: Pericope[] }>()
  for (const p of catalogo) {
    const slug = livroSlug(p.livro)
    const atual = porSlug.get(slug)
    if (atual && atual.livro !== p.livro) {
      // Em voz alta: silenciosamente um livro sobrescreveria o outro.
      throw new Error(`colisão de slug "${slug}": "${atual.livro}" e "${p.livro}"`)
    }
    if (atual) atual.itens.push(p)
    else porSlug.set(slug, { livro: p.livro, itens: [p] })
  }

  // O índice sai NA ORDEM DE `seq` porque o catálogo já vem assim, e o app não
  // reordena — a navegação anda por posição no array. Emitir na ordem de `ordem`
  // esperando que o consumidor ordene erraria os três caminhos de navegação de
  // uma vez, em silêncio. O campo vai junto para a ordem ser verificável.
  const indice = catalogo.map((p) => ({
    ordem: p.ordem,
    seq: p.seq,
    livro: p.livro,
    abbrev: p.abbrev,
    capitulo_inicio: p.capitulo_inicio,
    versiculo_inicio: p.versiculo_inicio,
    capitulo_fim: p.capitulo_fim,
    versiculo_fim: p.versiculo_fim,
    titulo_pericope_pt: p.titulo_pericope_pt,
    // Pré-calculado aqui para a Home não precisar do texto só para dizer "~5 min".
    minutos: readingMinutes(p.texto),
    // A Home mostra dezenas de cards e não pode fazer um HEAD por linha — nem
    // offline. O sinal de cobertura viaja no índice.
    narrado: cobertura.has(p.ordem),
  }))

  for (const sub of ['texto', 'estudo']) {
    try {
      rmSync(join(outDir, sub), { recursive: true, force: true })
    } catch {}
    mkdirSync(join(outDir, sub), { recursive: true })
  }

  for (const [slug, { itens }] of porSlug) {
    writeFileSync(
      join(outDir, 'texto', `${slug}.json`),
      JSON.stringify(
        itens.map((p) => ({
          ordem: p.ordem,
          texto: p.texto,
          ...(p.sobrescrito ? { sobrescrito: p.sobrescrito } : {}),
        })),
      ),
    )
    writeFileSync(
      join(outDir, 'estudo', `${slug}.json`),
      JSON.stringify(
        itens.map((p) => ({
          ordem: p.ordem,
          contexto_historico_literario: p.contexto_historico_literario,
          resenha: p.resenha,
          perguntas_reflexao: p.perguntas_reflexao,
          ...(p.topicos_pregar ? { topicos_pregar: p.topicos_pregar } : {}),
        })),
      ),
    )
  }

  const versao = versaoDosShards()
  writeFileSync(versaoPath, JSON.stringify({ hash: versao }))
  // index.json por último, de propósito: um Ctrl-C no meio da geração deixaria
  // um index.json novo apontando para um diretório de shards vazio, e o
  // precisaGerar() diria "em dia" para sempre.
  writeFileSync(indexPath, JSON.stringify(indice))
  console.log(`[shard] ${indice.length} perícopes em ${porSlug.size} livros (versão ${versao})`)
}

main()
