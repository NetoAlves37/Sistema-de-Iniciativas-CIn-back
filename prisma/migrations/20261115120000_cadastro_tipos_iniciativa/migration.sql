-- Cadastro de tipos de iniciativa (tela "Tipos de iniciativa", comitê e ADMIN).
-- Os tipos deixam de ser fixos: ganham cor, ativo e um log de auditoria.

-- AlterTable
ALTER TABLE "iniciativas_tipos"
  ALTER COLUMN "code" SET DATA TYPE VARCHAR(40),
  ALTER COLUMN "label" SET DATA TYPE VARCHAR(60),
  ADD COLUMN "cor" VARCHAR(7) NOT NULL DEFAULT '#9CA3AF',
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- A cor passa a ser sempre informada no cadastro; o default só serviu às linhas existentes.
ALTER TABLE "iniciativas_tipos" ALTER COLUMN "cor" DROP DEFAULT;

ALTER TABLE "iniciativas_tipos" ADD CONSTRAINT "iniciativas_tipos_cor_check"
  CHECK ("cor" ~ '^#[0-9A-Fa-f]{6}$');

-- Os três tipos que já existiam ficam com as cores que o calendário usava.
UPDATE "iniciativas_tipos" SET "cor" = '#9BE0A0' WHERE "code" = 'EXTENSAO';
UPDATE "iniciativas_tipos" SET "cor" = '#A7C7F2' WHERE "code" = 'PESQUISA';
UPDATE "iniciativas_tipos" SET "cor" = '#F7AE85' WHERE "code" = 'EVENTO';

-- Instalação nova começa sem tipos (ADR-024): os três tipos de fábrica que a migration
-- anterior inseriu são removidos SÓ se o banco ainda não tem nenhuma iniciativa. Nada que um
-- usuário tenha criado é afetado: até esta migration não existia cadastro de tipos, e bancos
-- com iniciativas mantêm os três. Exceção aprovada na verificação de migrations (ADR-025).
DELETE FROM "iniciativas_tipos"
WHERE "code" IN ('EXTENSAO', 'PESQUISA', 'EVENTO')
  AND NOT EXISTS (SELECT 1 FROM "iniciativas");

-- CreateTable
CREATE TABLE "iniciativas_tipos_acoes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "iniciativas_tipos_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas_tipos_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seq" BIGSERIAL NOT NULL,
    "tipo_id" INTEGER,
    "tipo_code" VARCHAR(40) NOT NULL,
    "tipo_label" VARCHAR(60) NOT NULL,
    "acao_id" INTEGER NOT NULL,
    "por" TEXT NOT NULL,
    "por_nome" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "ocorreu_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "iniciativas_tipos_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iniciativas_tipos_acoes_code_key" ON "iniciativas_tipos_acoes"("code");

-- CreateIndex
CREATE INDEX "iniciativas_tipos_log_tipo_id_ocorreu_em_idx" ON "iniciativas_tipos_log"("tipo_id", "ocorreu_em");

-- CreateIndex
CREATE INDEX "iniciativas_tipos_log_ocorreu_em_idx" ON "iniciativas_tipos_log"("ocorreu_em");

-- AddForeignKey
ALTER TABLE "iniciativas_tipos_log" ADD CONSTRAINT "iniciativas_tipos_log_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "iniciativas_tipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas_tipos_log" ADD CONSTRAINT "iniciativas_tipos_log_acao_id_fkey" FOREIGN KEY ("acao_id") REFERENCES "iniciativas_tipos_acoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lookup das ações do log (exigido pelo domínio, por isso fica na migration).
INSERT INTO "iniciativas_tipos_acoes" ("code", "label") VALUES
  ('CRIADO', 'Criado'),
  ('ALTERADO', 'Alterado'),
  ('ATIVADO', 'Ativado'),
  ('DESATIVADO', 'Desativado'),
  ('EXCLUIDO', 'Excluído');
