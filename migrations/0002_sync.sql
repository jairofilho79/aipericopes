CREATE TABLE "progresso" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pericope_ordem" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "pericope_ordem")
);
CREATE INDEX "progresso_user_upd" ON "progresso"("user_id", "atualizado_em");
CREATE TABLE "anotacoes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pericope_ordem" INTEGER NOT NULL,
  "texto" TEXT NOT NULL,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  "apagado_em" TEXT,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX "anotacoes_user_upd" ON "anotacoes"("user_id", "atualizado_em");
