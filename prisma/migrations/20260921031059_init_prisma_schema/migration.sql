-- CreateTable
CREATE TABLE "task_statuses" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_priorities" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "task_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "statusId" INTEGER NOT NULL,
    "priorityId" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_statuses_code_key" ON "task_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "task_priorities_code_key" ON "task_priorities"("code");

-- CreateIndex
CREATE INDEX "tasks_ownerId_idx" ON "tasks"("ownerId");

-- CreateIndex
CREATE INDEX "tasks_statusId_idx" ON "tasks"("statusId");

-- CreateIndex
CREATE INDEX "tasks_priorityId_idx" ON "tasks"("priorityId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "task_priorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
