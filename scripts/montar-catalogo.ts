/**
 * Junta o raw (estrutura) com o cache de enriquecimento (material editorial).
 *
 * A separação importa: `data/enriched/<ordem>.json` guarda o objeto inteiro,
 * texto bíblico incluído. Montar o catálogo a partir do cache cru congelava a
 * estrutura na forma em que ela estava quando a IA rodou — uma correção de
 * limites no ETL ou uma troca de fonte nunca chegavam ao app.
 *
 * Regra: limites e `texto` vêm SEMPRE do raw; título, contexto, resenha,
 * perguntas e tópicos vêm do cache.
 */
import type { Pericope, RawPericope } from '../src/lib/types.ts'

/** O que a IA escreve — tudo que não é estrutura. */
export type Editorial = Pick<
  Pericope,
  'titulo_pericope_pt' | 'contexto_historico_literario' | 'resenha' | 'perguntas_reflexao'
> & { topicos_pregar?: string }

export function montarPericope(raw: RawPericope, editorial: Editorial): Pericope {
  return {
    ordem: raw.ordem,
    // Sem isto o catálogo sai com seq undefined e o shard não tem como ordenar.
    seq: raw.seq,
    livro: raw.livro,
    abbrev: raw.abbrev,
    capitulo_inicio: raw.capitulo_inicio,
    versiculo_inicio: raw.versiculo_inicio,
    capitulo_fim: raw.capitulo_fim,
    versiculo_fim: raw.versiculo_fim,
    texto: raw.texto,
    ...(raw.sobrescrito ? { sobrescrito: raw.sobrescrito } : {}),
    titulo_pericope_pt: editorial.titulo_pericope_pt,
    contexto_historico_literario: editorial.contexto_historico_literario,
    resenha: editorial.resenha,
    perguntas_reflexao: editorial.perguntas_reflexao,
    ...(editorial.topicos_pregar ? { topicos_pregar: editorial.topicos_pregar } : {}),
  }
}

/**
 * O material editorial foi escrito sobre um texto que não é mais este?
 * Serve para reenriquecer só o que mudou, em vez de rodar tudo de novo.
 */
export function cacheDesatualizado(
  raw: RawPericope,
  cached: Pick<
    Pericope,
    'capitulo_inicio' | 'versiculo_inicio' | 'capitulo_fim' | 'versiculo_fim' | 'texto'
  > | null,
): boolean {
  if (!cached) return true
  return (
    cached.capitulo_inicio !== raw.capitulo_inicio ||
    cached.versiculo_inicio !== raw.versiculo_inicio ||
    cached.capitulo_fim !== raw.capitulo_fim ||
    cached.versiculo_fim !== raw.versiculo_fim ||
    cached.texto !== raw.texto
  )
}
