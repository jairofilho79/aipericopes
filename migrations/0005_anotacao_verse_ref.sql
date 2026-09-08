-- Vínculo opcional de uma anotação a versículo(s): "c:v" ou "c:v-c:v".
-- Nullable e sem default: linhas anteriores à migration ficam com NULL, que é
-- exatamente o que o cliente entende como "anotação sem vínculo".
ALTER TABLE "anotacoes" ADD COLUMN "verse_ref" TEXT;
