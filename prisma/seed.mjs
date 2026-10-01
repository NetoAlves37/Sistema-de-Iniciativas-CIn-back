import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TASK_STATUSES = [
  { code: 'PENDING', label: 'Pendente' },
  { code: 'IN_PROGRESS', label: 'Em andamento' },
  { code: 'COMPLETED', label: 'Concluída' },
  { code: 'CANCELLED', label: 'Cancelada' },
];

const TASK_PRIORITIES = [
  { code: 'LOW', label: 'Baixa' },
  { code: 'MEDIUM', label: 'Média' },
  { code: 'HIGH', label: 'Alta' },
  { code: 'URGENT', label: 'Urgente' },
];

async function upsertLookup(model, rows) {
  for (const row of rows) {
    await model.upsert({
      where: { code: row.code },
      update: { label: row.label },
      create: row,
    });
  }
}

async function main() {
  await upsertLookup(prisma.taskStatus, TASK_STATUSES);
  await upsertLookup(prisma.taskPriority, TASK_PRIORITIES);

  console.log('Seed da aplicação concluído.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
