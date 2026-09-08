/**
 * Monta public/data/registros.json — o eixo "Registros" do Explorar, paralelo
 * a Testamento → Seção → Livro.
 *
 * Fonte: data/trilha-registros.json (o registro emocional de cada perícope,
 * classificado na Sessão 5 pra escolher a cama musical — ver montar-trilha.ts).
 * Aqui é o mesmo dado, exposto como navegação; nenhum áudio entra. O derivado
 * não é versionado, como o resto de public/data.
 *
 * Os sufixos `-2` de trilha.json são alternância de cama dentro de uma fila
 * do mesmo registro, não um 18º registro — não existem na fonte, e este
 * script não os introduz.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Fonte = {
  nomes: Record<string, string>
  registros: Record<string, number[]>
}

export type RegistrosJson = {
  nomes: Record<string, string>
  registros: Record<string, number[]>
}

/**
 * `ordensDeLeitura` é a lista completa de `ordem` do acervo — serve só para
 * conferir cobertura, igual ao `semRegistro` de montar-trilha.ts. Falha alto
 * em vez de publicar um registro incompleto ou um slug sem rótulo de tela.
 */
export function montarRegistros(fonte: Fonte, ordensDeLeitura: number[]): RegistrosJson {
  const semRotulo = Object.keys(fonte.registros).filter((slug) => !(slug in fonte.nomes))
  if (semRotulo.length) {
    throw new Error(`slug sem rótulo em nomes: ${semRotulo.join(', ')}`)
  }

  const registroDe = new Map<number, string>()
  for (const [slug, ordens] of Object.entries(fonte.registros)) {
    for (const o of ordens) registroDe.set(o, slug)
  }
  const semRegistro = ordensDeLeitura.filter((o) => !registroDe.has(o))
  if (semRegistro.length) {
    // Sem registro não há eixo pra essa perícope, e ela sumiria do catálogo
    // de Registros sem aviso. Falhar aqui é melhor que publicar um buraco.
    throw new Error(`${semRegistro.length} perícopes sem registro: ${semRegistro.slice(0, 5)}`)
  }

  const nomes: Record<string, string> = {}
  const registros: Record<string, number[]> = {}
  for (const slug of Object.keys(fonte.registros)) {
    nomes[slug] = fonte.nomes[slug]
    registros[slug] = [...fonte.registros[slug]].sort((a, b) => a - b)
  }

  return { nomes, registros }
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const fonte: Fonte = JSON.parse(readFileSync(join(root, 'data/trilha-registros.json'), 'utf8'))
  const pericopes: { ordem: number }[] = JSON.parse(
    readFileSync(join(root, 'data/pericopes.json'), 'utf8'),
  )

  const saida = montarRegistros(fonte, pericopes.map((p) => p.ordem))

  const outDir = join(root, 'public/data')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'registros.json'), JSON.stringify(saida))
  const totalOrdens = Object.values(saida.registros).reduce((n, ordens) => n + ordens.length, 0)
  console.log(`[registros] ${Object.keys(saida.registros).length} registros, ${totalOrdens} perícopes`)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) main()
