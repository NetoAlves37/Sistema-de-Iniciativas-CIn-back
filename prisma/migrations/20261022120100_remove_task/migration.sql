-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_statusId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_priorityId_fkey";

-- DropTable
DROP TABLE "task_statuses";

-- DropTable
DROP TABLE "task_priorities";

-- DropTable
DROP TABLE "tasks";

