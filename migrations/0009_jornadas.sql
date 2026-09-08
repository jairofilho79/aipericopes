-- Quinta entidade sincronizada: a jornada de leitura — o percurso declarado
-- pelo leitor (escopo, ponto de partida, âncora de contagem). Guarda só a
-- DEFINIÇÃO: a rota e o progresso são derivados no cliente a partir do
-- catálogo e do `progresso` global, então esta tabela é minúscula (dezenas
-- de linhas por usuário no pior caso) e não reabre o problema de paginação
-- de pull que destaques tem.
--
-- Segue a receita das outras: atualizado_em como chave do LWW, server_em
-- como cursor de pull (indexado), apagado_em como lápide. Chave é o uuid
-- gerado no cliente, como em anotacao.
--
-- `conta_desde` NULL significa "continuar" (qualquer conclusão no escopo
-- conta); uma data significa "reler" (só conclusões a partir dali).
CREATE TABLE "jornada" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "escopo" TEXT NOT NULL,
  "inicio_ordem" INTEGER NOT NULL,
  "conta_desde" TEXT,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  "arquivada_em" TEXT,
  "concluida_em" TEXT,
  "apagado_em" TEXT,
  "server_em" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "id")
);
CREATE INDEX "idx_jornada_user_server" ON "jornada" ("user_id", "server_em");
