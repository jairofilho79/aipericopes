-- BYOK de IA. A chave do provedor é do usuário e fica cifrada (AES-GCM, segredo
-- AI_KEY_SECRET do Worker): nunca volta ao cliente, só `ultimos4` e o estado.
-- Uma chave por usuário na v1 (PK = user_id). `versao_segredo` permite rotacionar
-- o segredo mestre re-cifrando as linhas aos poucos.
-- `conta_id` só existe para a Cloudflare (Account ID do Workers AI do usuário);
-- não é segredo, por isso fica em claro.
CREATE TABLE "ia_chave" (
  "user_id" TEXT NOT NULL PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "provedor" TEXT NOT NULL,
  "modelo" TEXT NOT NULL,
  "conta_id" TEXT,
  "chave_cifrada" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "versao_segredo" INTEGER NOT NULL DEFAULT 1,
  "ultimos4" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ativa',
  "validada_em" TEXT,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL
);

-- Explicação rápida: um pedido, uma resposta. Só se grava o que deu certo (erro,
-- limite e interrupção não persistem), então não há coluna de status. A
-- referência é desnormalizada para a lista do Perfil não depender do catálogo.
-- Não sincroniza (online-only).
CREATE TABLE "ia_explicacao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pericope_ordem" INTEGER NOT NULL,
  "livro" TEXT NOT NULL,
  "capitulo_inicio" INTEGER NOT NULL,
  "versiculo_inicio" INTEGER NOT NULL,
  "capitulo_fim" INTEGER NOT NULL,
  "versiculo_fim" INTEGER NOT NULL,
  "versiculos_json" TEXT NOT NULL,
  "trecho_texto" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "resposta" TEXT NOT NULL,
  "provedor" TEXT NOT NULL,
  "modelo" TEXT NOT NULL,
  "criado_em" TEXT NOT NULL,
  "apagado_em" TEXT
);
CREATE INDEX "idx_ia_explicacao_user" ON "ia_explicacao" ("user_id", "criado_em" DESC);
CREATE INDEX "idx_ia_explicacao_livro" ON "ia_explicacao" ("user_id", "livro", "capitulo_inicio");

-- Chat. `escopo`: 'selecao' (nasceu de versículos), 'pericope' (aba Conversar,
-- com chips de contexto) ou 'avulsa'. `explicacao_id` liga a conversa criada
-- pelo botão "Continuar conversa" à explicação de origem.
CREATE TABLE "ia_conversa" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "titulo" TEXT NOT NULL,
  "escopo" TEXT NOT NULL DEFAULT 'avulsa',
  "explicacao_id" TEXT REFERENCES "ia_explicacao"("id") ON DELETE SET NULL,
  "contexto_flags" TEXT,
  "pericope_ordem" INTEGER,
  "livro" TEXT,
  "capitulo_inicio" INTEGER,
  "versiculo_inicio" INTEGER,
  "capitulo_fim" INTEGER,
  "versiculo_fim" INTEGER,
  "criado_em" TEXT NOT NULL,
  "atualizado_em" TEXT NOT NULL,
  "apagado_em" TEXT
);
CREATE INDEX "idx_ia_conversa_user" ON "ia_conversa" ("user_id", "atualizado_em" DESC);

-- Pergunta e resposta são gravadas juntas, só após sucesso.
CREATE TABLE "ia_mensagem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversa_id" TEXT NOT NULL REFERENCES "ia_conversa"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "papel" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "modelo" TEXT,
  "criado_em" TEXT NOT NULL
);
CREATE INDEX "idx_ia_mensagem_conversa" ON "ia_mensagem" ("conversa_id", "criado_em");
