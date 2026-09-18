-- Adiciona `fim_ordem` à tabela jornada: a última perícope da jornada
-- (inclusive). NULL = \"até o fim do escopo\", que é o comportamento original.
-- Coluna opcional para compatibilidade retroativa: jornadas antigas não
-- precisam ser migradas, pois o cliente trata NULL como fim aberto.
ALTER TABLE "jornada" ADD COLUMN "fim_ordem" INTEGER;
