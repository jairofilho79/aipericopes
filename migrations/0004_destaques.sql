-- Terceira entidade sincronizada: um destaque de cor por versículo por usuário.
-- Mesma receita das outras: PK (user_id, id), atualizado_em como chave do LWW,
-- server_em como cursor de pull (indexado), apagado_em como lápide.
CREATE TABLE "destaques" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "id" TEXT NOT NULL,
  "pericope_ordem" INTEGER NOT NULL,
  "verse_id" TEXT NOT NULL,
  "cor" TEXT NOT NULL,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  "apagado_em" TEXT,
  "server_em" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX "idx_destaques_user_server" ON "destaques" ("user_id", "server_em");
