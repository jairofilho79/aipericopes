/** Metadados de uma perícope: o que o índice de boot carrega. */
export type PericopeIndex = {
  /**
   * ID estável e opaco. NÃO é a posição de leitura — para isso existe `seq`.
   * É chave de dado de usuário em progresso, anotacoes, destaques,
   * posicao_leitura e jornada.inicio_ordem, é a rota /leitura/:ordem, e é o nome
   * do arquivo de áudio no R2. Nunca renumerar: renumerar reatribui histórico de
   * leitura à passagem errada, em silêncio.
   */
  ordem: number
  /**
   * Posição de leitura, densa a partir de 0. O `index.json` já sai do shard
   * ordenado por ela e o app NÃO reordena — a navegação anda por posição no
   * array. Existe porque as perícopes novas entram no meio do catálogo com
   * `ordem >= 3000`, e sem separar os dois papéis seria preciso renumerar.
   */
  seq: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  titulo_pericope_pt: string
  /** Minutos de leitura, pré-calculados pelo gerador de shards. */
  minutos: number
}

/** Perícope completa: índice + o conteúdo que vem dos shards do livro. */
export type Pericope = PericopeIndex & {
  texto: string
  /**
   * Epígrafe que vem ANTES do versículo 1 e fora da numeração: o sobrescrito
   * do salmo ("Salmo de Davi, quando ele fugia da presença de seu filho
   * Absalão"), o título de seção de Provérbios, a revelação de Isaías.
   * 125 perícopes têm. Ver scripts/blivre-epigrafes.ts.
   */
  sobrescrito?: string
  /** O que saber ANTES de ler o texto */
  contexto_historico_literario: string
  /** Apanhado do que aconteceu e por quê; Deus/Jesus só quando couber com naturalidade */
  resenha: string
  perguntas_reflexao: string[]
  /** Outline curto para o pregador; markdown com **negrito** */
  topicos_pregar?: string
}

export type ProgressoStatus = 'nao_iniciado' | 'em_andamento' | 'concluido'

export type Progresso = {
  pericopeOrdem: number
  status: ProgressoStatus
  /**
   * Conclusões desta perícope, em ISO canônico, MAIS NOVA PRIMEIRO, no máximo
   * MAX_HISTORICO. Nunca esvaziado: desmarcar e zerar mexem em `status` e
   * `paraReler`, o fato de ter sido lida fica.
   *
   * `concluidoEm` e `vezes` não são campos — são `historico[0]` e
   * `historico.length`.
   */
  historico: string[]
  /** Pin manual "quero revisitar", independente do status. */
  paraReler: boolean
  /** Chave do LWW. */
  atualizadoEm: string
}

export type Anotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  /** Vínculo opcional a versículo(s): "c:v" ou "c:v-c:v". */
  verseRef: string | null
  criadoEm: string
  atualizadoEm: string
}

/** 'amarelo' saiu no rebranding; ver corVigente() em user-db.ts para o legado. */
export type DestaqueCor = 'verde' | 'azul' | 'rosa'

/** `id` determinístico `${pericopeOrdem}:${verseId}`: um destaque por versículo
 * por usuário, então destacar de novo é um upsert e o LWW resolve sozinho. */
export type Destaque = {
  id: string
  pericopeOrdem: number
  /** "capitulo:versiculo", igual ao TextoBlock.id */
  verseId: string
  cor: DestaqueCor
  criadoEm: string
  atualizadoEm: string
}

export type PosicaoTipo = 'secao' | 'versiculo' | 'narracao'

/** Checkpoint de leitura: uma linha por perícope, a última âncora relevante.
 * `ref` fala o vocabulário do DOM da Leitura — id de seção ("texto"),
 * verseId ("3:16"), parágrafo em prosa ("resenha-0") ou alvo de narração. */
export type PosicaoLeitura = {
  pericopeOrdem: number
  tipo: PosicaoTipo
  ref: string
  /** Segundos do áudio quando tipo é "narracao"; null nos demais. */
  tempo: number | null
  atualizadoEm: string
}

export type RawPericope = {
  ordem: number
  /** Posição de leitura. Ver PericopeIndex.seq. */
  seq: number
  /** Ausente nas perícopes nascidas do recorte: elas não vêm do dataset inglês. */
  titulo_en?: string
  livro_en?: string
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  texto: string
  /** Epígrafe do versículo de abertura. Ver SOBRESCRITO em Pericope. */
  sobrescrito?: string
}

export type JornadaTipo = 'sequencia' | 'bloco' | 'livro' // 'cronologica' depois

/**
 * Percurso declarado pelo leitor. Guarda só a DEFINIÇÃO — a rota e o
 * progresso são derivados em runtime do índice e do `progresso` global
 * (src/lib/jornadas.ts). Nunca uma segunda contabilidade de leitura.
 */
export type Jornada = {
  id: string
  nome: string
  tipo: JornadaTipo
  /**
   * 'sequencia' → 'biblia' | 'vt' | 'nt'
   * 'bloco'     → id de BLOCOS (ex.: 'pentateuco')
   * 'livro'     → nome do livro, como em PericopeIndex.livro
   */
  escopo: string
  /** Ordem da 1ª perícope da jornada dentro da rota do escopo. */
  inicioOrdem: number
  /**
   * Âncora da atribuição.
   * `null` → "continuar": qualquer conclusão no escopo conta, de qualquer época.
   * ISO    → "reler": só conclusões a partir dali contam, e o cursor volta ao início.
   */
  contaDesde: string | null
  criadoEm: string
  atualizadoEm: string
  arquivadaEm: string | null
  concluidaEm: string | null
}
