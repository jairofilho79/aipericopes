-- Quarta entidade sincronizada: o checkpoint de leitura — uma linha por
-- perícope por usuário, a última âncora relevante (seção focada, versículo
-- tocado ou item de narração, com o tempo do áudio). Chave natural é a
-- perícope (como progresso), então dispensa id derivado; o resto segue a
-- receita das outras: atualizado_em como chave do LWW, server_em como cursor
-- de pull (indexado), apagado_em como lápide (concluir a perícope apaga o
-- checkpoint, e sem lápide o pull o ressuscitaria).
CREATE TABLE "posicao_leitura" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pericope_ordem" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "ref" TEXT NOT NULL,
  "tempo" REAL,
  "atualizado_em" TEXT NOT NULL,
  "apagado_em" TEXT,
  "server_em" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "pericope_ordem")
);
CREATE INDEX "idx_posicao_leitura_user_server" ON "posicao_leitura" ("user_id", "server_em");
