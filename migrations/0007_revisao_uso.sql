-- Uso da revisão do ditado (POST /api/revisar-ditado) por usuário e por dia,
-- em caracteres enviados. O modelo de texto cobra por token, e caracteres é a
-- aproximação honesta (e barata de medir) do que cada pedido custa. Sustenta
-- as duas cotas: a pessoal (uma linha por usuário/dia) e o teto global (a
-- soma do dia), que existe para o free tier do Workers AI nunca virar
-- fatura. `dia` é YYYY-MM-DD em UTC — a mesma fronteira em que a Cloudflare
-- zera a franquia. Como transcricao_uso: só contabilidade do servidor, não
-- sincroniza com o cliente.
CREATE TABLE "revisao_uso" (
  "user_id" TEXT NOT NULL,
  "dia" TEXT NOT NULL,
  "caracteres" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "dia")
);
-- A soma global filtra só por dia; sem este índice ela varreria a tabela
-- inteira a cada revisão.
CREATE INDEX "revisao_uso_dia" ON "revisao_uso" ("dia");
