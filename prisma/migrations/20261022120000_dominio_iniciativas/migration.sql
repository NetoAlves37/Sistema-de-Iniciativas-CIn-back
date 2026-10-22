-- CreateTable
CREATE TABLE "identidade_perfis" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "identidade_perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identidade_usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "perfil_id" INTEGER NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identidade_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas_tipos" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "iniciativas_tipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas_periodicidades" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "iniciativas_periodicidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas_status" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "iniciativas_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "autor_id" TEXT NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "resumo" VARCHAR(280) NOT NULL,
    "detalhe" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "hora_inicio" VARCHAR(5),
    "hora_fim" VARCHAR(5),
    "periodicidade_id" INTEGER NOT NULL,
    "espaco" VARCHAR(200) NOT NULL,
    "organizadores" VARCHAR(500) NOT NULL,
    "membros" VARCHAR(500),
    "participantes" INTEGER NOT NULL,
    "com_votacao" BOOLEAN NOT NULL DEFAULT true,
    "status_id" INTEGER NOT NULL,
    "ciclo" INTEGER NOT NULL DEFAULT 1,
    "fim_refinamento" TIMESTAMPTZ(3),
    "fim_votacao" TIMESTAMPTZ(3),
    "justificativa" VARCHAR(2000),
    "decisor_id" TEXT,
    "decidida_em" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "iniciativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativas_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seq" BIGSERIAL NOT NULL,
    "iniciativa_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "de_id" INTEGER,
    "para_id" INTEGER NOT NULL,
    "por" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "justificativa" VARCHAR(2000),
    "ocorreu_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "iniciativas_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refinamento_comentarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "iniciativa_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "autor_id" TEXT NOT NULL,
    "texto" VARCHAR(1000) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refinamento_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votacao_votos" (
    "iniciativa_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "valor" SMALLINT NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "votacao_votos_pkey" PRIMARY KEY ("iniciativa_id","ciclo","usuario_id")
);

-- CreateTable
CREATE TABLE "votacao_placar" (
    "iniciativa_id" UUID NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "dislikes" INTEGER NOT NULL DEFAULT 0,
    "relevancia" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "votacao_placar_pkey" PRIMARY KEY ("iniciativa_id","ciclo")
);

-- CreateIndex
CREATE UNIQUE INDEX "identidade_perfis_code_key" ON "identidade_perfis"("code");

-- CreateIndex
CREATE INDEX "identidade_usuarios_perfil_id_idx" ON "identidade_usuarios"("perfil_id");

-- CreateIndex
CREATE UNIQUE INDEX "iniciativas_tipos_code_key" ON "iniciativas_tipos"("code");

-- CreateIndex
CREATE UNIQUE INDEX "iniciativas_periodicidades_code_key" ON "iniciativas_periodicidades"("code");

-- CreateIndex
CREATE UNIQUE INDEX "iniciativas_status_code_key" ON "iniciativas_status"("code");

-- CreateIndex
CREATE INDEX "iniciativas_status_id_fim_refinamento_idx" ON "iniciativas"("status_id", "fim_refinamento");

-- CreateIndex
CREATE INDEX "iniciativas_status_id_fim_votacao_idx" ON "iniciativas"("status_id", "fim_votacao");

-- CreateIndex
CREATE INDEX "iniciativas_autor_id_idx" ON "iniciativas"("autor_id");

-- CreateIndex
CREATE INDEX "iniciativas_status_id_inicio_idx" ON "iniciativas"("status_id", "inicio");

-- CreateIndex
CREATE INDEX "iniciativas_historico_iniciativa_id_ocorreu_em_idx" ON "iniciativas_historico"("iniciativa_id", "ocorreu_em");

-- CreateIndex
CREATE INDEX "refinamento_comentarios_iniciativa_id_ciclo_criado_em_idx" ON "refinamento_comentarios"("iniciativa_id", "ciclo", "criado_em");

-- CreateIndex
CREATE INDEX "votacao_placar_relevancia_idx" ON "votacao_placar"("relevancia");

-- AddForeignKey
ALTER TABLE "identidade_usuarios" ADD CONSTRAINT "identidade_usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "identidade_perfis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "iniciativas_tipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_periodicidade_id_fkey" FOREIGN KEY ("periodicidade_id") REFERENCES "iniciativas_periodicidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "iniciativas_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas_historico" ADD CONSTRAINT "iniciativas_historico_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas_historico" ADD CONSTRAINT "iniciativas_historico_de_id_fkey" FOREIGN KEY ("de_id") REFERENCES "iniciativas_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativas_historico" ADD CONSTRAINT "iniciativas_historico_para_id_fkey" FOREIGN KEY ("para_id") REFERENCES "iniciativas_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integridade que o Prisma não expressa no schema.
ALTER TABLE "votacao_votos" ADD CONSTRAINT "votacao_votos_valor_check" CHECK ("valor" IN (-1, 1));
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_participantes_check" CHECK ("participantes" >= 1);
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_periodo_check" CHECK ("fim" >= "inicio");
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_horario_check" CHECK (
  ("hora_inicio" IS NULL AND "hora_fim" IS NULL)
  OR ("hora_inicio" IS NOT NULL AND "hora_fim" IS NOT NULL AND "hora_fim" > "hora_inicio")
);
ALTER TABLE "iniciativas" ADD CONSTRAINT "iniciativas_ciclo_check" CHECK ("ciclo" >= 1);

-- Dados de referência (lookups) exigidos pelo domínio. Ficam na migration, e não só no
-- seed, para existirem em qualquer ambiente que rode `prisma migrate deploy`.
INSERT INTO "identidade_perfis" ("code", "label") VALUES
  ('ALUNO', 'Aluno'),
  ('PROFESSOR', 'Professor'),
  ('COMITE', 'Comitê avaliador'),
  ('ADMIN', 'Administrador');

INSERT INTO "iniciativas_tipos" ("code", "label") VALUES
  ('EXTENSAO', 'Extensão'),
  ('PESQUISA', 'Pesquisa'),
  ('EVENTO', 'Evento');

INSERT INTO "iniciativas_periodicidades" ("code", "label") VALUES
  ('EVENTO_UNICO', 'Evento único'),
  ('DIARIA', 'Diária'),
  ('SEMANAL', 'Semanal'),
  ('QUINZENAL', 'Quinzenal'),
  ('MENSAL', 'Mensal');

INSERT INTO "iniciativas_status" ("code", "label") VALUES
  ('EM_ANDAMENTO', 'Em andamento'),
  ('EM_VOTACAO', 'Em votação'),
  ('EM_ANALISE', 'Em análise'),
  ('APROVADA', 'Aprovada'),
  ('REPROVADA', 'Reprovada');
