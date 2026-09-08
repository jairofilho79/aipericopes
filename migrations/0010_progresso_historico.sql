-- Histórico de conclusões por perícope, dentro da própria linha de progresso.
-- Duas colunas aditivas (padrão da 0005): nenhuma linha existente quebra.
--
-- `historico` é um json_array de ISO canônico, MAIS NOVA PRIMEIRO, no máximo
-- 50. `concluido_em` e `vezes` não existem como colunas: são json_extract($[0])
-- e json_array_length(). O merge é UNIÃO DE CONJUNTOS e roda fora da guarda do
-- LWW (ver o ON CONFLICT em worker/index.ts) — um lote que perde o LWW não pode
-- levar junto uma conclusão feita offline.
ALTER TABLE "progresso" ADD COLUMN "historico"  TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE "progresso" ADD COLUMN "para_reler" INTEGER NOT NULL DEFAULT 0;

-- Backfill: linha já concluída teve ao menos uma conclusão, e a única data que
-- existe hoje é atualizado_em (mesmo espírito do backfill da 0003).
UPDATE "progresso" SET "historico" = json_array("atualizado_em") WHERE "status" = 'concluido';
