-- Cursor de pull baseado no relógio do SERVIDOR.
-- `atualizado_em` vem do relógio do cliente (é a chave do LWW e continua sendo).
-- Usá-lo também como cursor fazia com que um dispositivo adiantado gravasse
-- linhas com timestamp futuro: o `agora` devolvido no pull ficava atrás delas e
-- as escritas de outro dispositivo eram descartadas para sempre. `server_em` é
-- carimbado pelo Worker, então é monotônico dentro do mesmo relógio do servidor.
ALTER TABLE "progresso" ADD COLUMN "server_em" TEXT NOT NULL DEFAULT '';
ALTER TABLE "anotacoes" ADD COLUMN "server_em" TEXT NOT NULL DEFAULT '';
-- Backfill: o DEFAULT '' é menor que qualquer cursor não vazio, então uma linha
-- anterior à migration ficaria invisível em todo pull incremental. Herdar
-- atualizado_em é a melhor aproximação disponível para o que já está gravado.
UPDATE "progresso" SET "server_em" = "atualizado_em" WHERE "server_em" = '';
UPDATE "anotacoes" SET "server_em" = "atualizado_em" WHERE "server_em" = '';
CREATE INDEX "progresso_user_server" ON "progresso"("user_id", "server_em");
CREATE INDEX "anotacoes_user_server" ON "anotacoes"("user_id", "server_em");
