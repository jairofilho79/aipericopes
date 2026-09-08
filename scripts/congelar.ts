/**
 * Diz à Sessão 4 o que ela pode narrar sem risco.
 *
 * **Por que isto existe.** Narrar custa dinheiro e é irreversível: uma perícope
 * gravada cujo material vai mudar é dinheiro jogado fora. Três coisas ainda
 * podem mudar material já escrito e aprovado:
 *
 * 1. os defeitos da Bíblia Livre (`scripts/defeitos-blivre.ts`), que quando
 *    aplicados mudam o TEXTO e obrigam a reescrever quem o cita;
 * 2. as quedas de registro (`scripts/varrer-registro.ts`), que o portão não
 *    alcança e voltam para a fila;
 * 3. as colisões de título (`scripts/titulos-colididos.ts`), que só existem
 *    quando os 2.823 títulos existem — dessas, muda só o título, e o custo de
 *    regravar é a seção `titulo`, ~2% do áudio da perícope.
 *
 * O cruzamento dos defeitos contra o congelamento é o ponto: um defeito novo
 * pode cair numa perícope já congelada, e é por isso que este script roda de
 * novo a cada rodada em vez de a lista ser mantida à mão.
 *
 * Usage: npx tsx scripts/congelar.ts [--soltar=203,206]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AINDA_PODEM_MUDAR,
  CODIGOS_VPL,
  DEFEITOS,
  TODAS_AS_REFS,
  pericopesAfetadas,
  type Faixa,
} from './defeitos-blivre.ts'
import { colisoes } from './titulos-colididos.ts'
import { dirs } from './reenriquecimento.ts'
import { validarMaterial, type Material } from './validar-material.ts'
import { pendentes } from './invencoes-pendentes.ts'
import type { Achado } from './invencao-fila.ts'
import { varrer } from './varrer-registro.ts'

const root = join(import.meta.dirname, '..')

/**
 * A lista sai em `data/`, e não na pasta da fila, porque ela é CONTRATO e não
 * andaime: quem a consome é a Sessão 4, que roda noutra sessão e às vezes
 * noutra máquina. Enquanto ela morou em `data/reenriquecimento/`, que é
 * gitignorada, a sessão da narração não tinha como saber o que podia gravar —
 * o cálculo era feito e ficava só neste disco.
 */
const SAIDA = join(root, 'data/congelamento.json')

function main() {
  const raw = readFileSync(join(root, 'data/raw-pericopes.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Faixa & { seq: number })
    .sort((a, b) => a.seq - b.seq)

  // A correspondência código VPL → abreviação PT é posicional, pela ordem
  // canônica dos livros. É a mesma que `blivre-fonte.ts` usa.
  const naOrdem: string[] = []
  for (const r of raw) if (!naOrdem.includes(r.abbrev)) naOrdem.push(r.abbrev)
  const abbrevPorCodigo = new Map(CODIGOS_VPL.map((c, i) => [c as string, naOrdem[i]]))

  // **A fonte é `data/pericopes.json`, e não a saída da fila.** Isto foi um bug
  // real e caro: `data/reenriquecimento/saida/` é a FOTOGRAFIA de quando cada
  // perícope saiu da fila, e o material continuou a ser editado depois dela —
  // a frase pendurada, os títulos reescritos, as leituras literais do TTS, as
  // glosas. Em 06/09 havia 707 perícopes em que as duas versões já não batiam,
  // e o contrato descrevia um material que ninguém vai narrar. O que a Sessão 4
  // grava é o que `shard-catalogo.ts` publica, e ele lê `data/pericopes.json`.
  const material = JSON.parse(
    readFileSync(join(root, 'data/pericopes.json'), 'utf8'),
  ) as (Material & Record<string, unknown>)[]
  const prontas = material.map((m) => m.ordem)
  const mats = material

  // O que o portão reprova ainda vai ser reescrito, então não pode ser narrado.
  // Antes isto não entrava na conta porque nada reprovava; entrou no dia em que
  // uma regra nova reprovou material já escrito e já congelado.
  //
  // A entrada (o texto bíblico da perícope) continua vindo da fila, que é onde
  // ela mora e onde é estável; o MATERIAL julgado é o de agora.
  const dEntrada = dirs(join(root, 'data/reenriquecimento')).entrada
  const reprovadasPeloPortao = new Set(
    material
      .filter((m) => {
        const fe = join(dEntrada, `${m.ordem}.json`)
        if (!existsSync(fe)) return false
        const entrada = JSON.parse(readFileSync(fe, 'utf8')) as { texto: string }
        return validarMaterial(entrada, m as Material, JSON.stringify(m)).problemas.length > 0
      })
      .map((m) => m.ordem),
  )

  // **O quarto risco: o material afirma o que a Escritura desmente.** Os três
  // riscos de cima nasceram antes do caça-invenção, e por isso o contrato
  // dizia verde para 81 perícopes que a auditoria já tinha reprovado — o
  // relatório existia e a máquina não o lia. Aqui ele passa a ler.
  //
  // A lista é CALCULADA contra o material de agora, e não copiada de lugar
  // nenhum: quando o conserto entra em `data/pericopes.json`, a frase acusada
  // deixa de existir, a acusação sai da conta e a perícope volta a congelar
  // sozinha. Não há lista a manter à mão.
  const dirInvencao = join(root, 'data/invencao/saida')
  const achados = existsSync(dirInvencao)
    ? readdirSync(dirInvencao)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(dirInvencao, f), 'utf8')) as Achado)
    : []
  const porInvencao = new Set(pendentes(material, achados).vivas.map((v) => v.ordem))

  // Não são mais as 484: as correções foram aplicadas e o material passou de
  // novo pelo portão contra o texto novo. O que ainda pode mudar são as quatro
  // que esperam o dono.
  const porTexto = pericopesAfetadas(raw, abbrevPorCodigo, AINDA_PODEM_MUDAR)
  const porRegistro = new Set(mats.flatMap((m) => varrer(m)).map((s) => s.ordem))
  const porTitulo = new Set(
    colisoes(mats.map((m) => ({ ordem: m.ordem, titulo: m.titulo_pericope_pt })))
      // 0,7 e não 0,5. O corte de 0,5 foi posto quando 15 títulos eram
      // IDÊNTICOS e o acervo inteiro era vago: ali qualquer semelhança era
      // suspeita. Depois de os 2.823 títulos ganharem âncora, ele passou a
      // segurar 567 perícopes por pares como "Jeoacaz reina três meses, filho
      // de Hamutal" × "Joaquim reina três meses, filho de Neusta" — que é
      // exatamente o que a regra da âncora produziu de melhor, dois reis
      // distintos pela mãe. Ninguém confunde os dois.
      //
      // 0,7 é o ponto onde os pares deixavam de ser distinguíveis, e os oito
      // que estavam acima dele foram desempatados à mão. Hoje o corte não pega
      // nenhum: ele fica de guarda para o que vier.
      .filter((c) => c.forca >= 0.7)
      .flatMap((c) => [c.a.ordem, c.b.ordem]),
  )

  const anterior = (() => {
    try {
      // Fallback para o caminho antigo: quando a lista mudou de lugar, o estado
      // que só existe aqui — `aguardando_decisao_do_dono` e a nota — teria se
      // perdido em silêncio, e Lv 18 e Lv 20 voltariam a ficar liberados para
      // narração sem ninguém decidir nada.
      const antigo = join(root, 'data/reenriquecimento/congeladas.json')
      const caminho = existsSync(SAIDA) ? SAIDA : antigo
      return JSON.parse(readFileSync(caminho, 'utf8'))
    } catch {
      return null
    }
  })()
  const congeladasAntes: number[] = anterior?.congeladas ?? []
  const esperavam: number[] = anterior?.aguardando_decisao_do_dono ?? []

  // `--soltar=203,206`: a espera sai por aqui, e nunca editando o JSON à mão.
  // O arquivo é CONTRATO da Sessão 4; uma edição manual solta a perícope para
  // narração sem deixar rastro de quem soltou nem contra o quê. Passando pelo
  // script, o motivo aparece no log e a nota morre junto com a lista.
  const pedidas = new Set(
    (process.argv.find((a) => a.startsWith('--soltar='))?.split('=')[1] ?? '')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  )
  const aguardando = esperavam.filter((o) => !pedidas.has(o))
  const soltas = esperavam.filter((o) => pedidas.has(o))

  const risco = (o: number) =>
    porTexto.has(o) ||
    porRegistro.has(o) ||
    reprovadasPeloPortao.has(o) ||
    porInvencao.has(o) ||
    aguardando.includes(o)
  const reescrita = prontas
    .filter(
      (o) => porTexto.has(o) || porRegistro.has(o) || reprovadasPeloPortao.has(o) || porInvencao.has(o),
    )
    .sort((a, b) => a - b)
  const soTitulo = prontas.filter((o) => porTitulo.has(o) && !risco(o)).sort((a, b) => a - b)
  const congeladas = prontas.filter((o) => !risco(o) && !porTitulo.has(o)).sort((a, b) => a - b)

  // O que ESTAVA congelado e deixou de estar: é o aviso que a Sessão 4 precisa
  // receber antes de gravar, porque ela pode já ter narrado.
  const descongeladas = congeladasAntes.filter((o) => !congeladas.includes(o))

  writeFileSync(
    SAIDA,
    JSON.stringify(
      {
        gerado: new Date().toISOString(),
        total_prontas: prontas.length,
        congeladas,
        reescrita_certa: reescrita,
        // Por que cada uma está fora, e não só que está: a Sessão 4 lê este
        // arquivo sem ter lido o relatório, e "reescrita_certa" sozinho não
        // diz se falta corrigir o texto bíblico ou uma frase que mente.
        por_invencao: [...porInvencao].sort((a, b) => a - b),
        so_titulo_pode_mudar: soTitulo,
        aguardando_decisao_do_dono: aguardando,
        // A nota descreve a espera. Sem espera ela é lixo que confunde a leitura.
        nota_aguardando: aguardando.length ? anterior?.nota_aguardando : undefined,
        descongeladas_nesta_rodada: descongeladas,
      },
      null,
      2,
    ),
  )

  console.log(`prontas ${prontas.length}`)
  console.log(`  congeladas            ${congeladas.length}`)
  console.log(
    `  reescrita certa       ${reescrita.length}  (texto ${[...porTexto].filter((o) => prontas.includes(o)).length} · registro ${porRegistro.size} · portão ${reprovadasPeloPortao.size} · invenção ${porInvencao.size})`,
  )
  console.log(`  só título pode mudar  ${soTitulo.length}`)
  console.log(`  aguardando o dono     ${aguardando.length}`)
  if (soltas.length) console.log(`  soltas nesta rodada   ${soltas.join(', ')}`)
  console.log(`\ndefeitos catalogados: ${TODAS_AS_REFS.length} em ${DEFEITOS.length} classes`)
  if (descongeladas.length) {
    // Não é item de ação por rodada. O dono decidiu esperar a corrida acabar
    // para liberar a narração de uma vez: enquanto os achados continuam
    // mudando a NATUREZA do conserto — 23 defeitos viraram regra de ETL num
    // dia —, avisar a cada rodada é ruído, e narrar em cima de uma lista
    // provisória é pagar duas vezes.
    console.log(`\n   saíram do congelamento nesta rodada: ${descongeladas.join(', ')}`)
  } else {
    console.log('\n✅ nenhuma perícope saiu do congelamento')
  }
}

main()
