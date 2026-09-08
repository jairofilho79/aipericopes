-- Uso do ditado (POST /api/transcrever) por usuário e por dia, em segundos de
-- áudio. É o que sustenta as duas cotas: a pessoal (uma linha por usuário/dia)
-- e o teto global (a soma do dia), que existe para o free tier do Workers AI
-- nunca virar fatura. `dia` é YYYY-MM-DD em UTC — a mesma fronteira em que a
-- Cloudflare zera a franquia. Sem apagado_em nem server_em: não sincroniza
-- com o cliente, é só contabilidade do servidor.
CREATE TABLE "transcricao_uso" (
  "user_id" TEXT NOT NULL,
  "dia" TEXT NOT NULL,
  "segundos" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "dia")
);
-- A soma global filtra só por dia; sem este índice ela varreria a tabela
-- inteira (todos os dias de todos os usuários) a cada ditado.
CREATE INDEX "transcricao_uso_dia" ON "transcricao_uso" ("dia");
