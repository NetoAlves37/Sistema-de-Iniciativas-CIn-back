import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/** O seed de demonstração é idempotente: rodar várias vezes não duplica nada. */
const IDS = Array.from(
  { length: 13 },
  (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
);

describe('Integração: seed de demonstração', () => {
  const prisma = new PrismaClient();

  const rodarSeed = () =>
    execFileSync(process.execPath, ['prisma/seed.mjs'], {
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'pipe',
    });

  const contar = async () => ({
    iniciativas: await prisma.iniciativa.count({
      where: { id: { in: IDS } },
    }),
    votos: await prisma.voto.count({
      where: { iniciativaId: { in: IDS } },
    }),
    placares: await prisma.placar.count({
      where: { iniciativaId: { in: IDS } },
    }),
    usuarios: await prisma.usuario.count({
      where: { id: { startsWith: '00000000-0000-4000-a000-' } },
    }),
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cria 13 iniciativas (uma sem votação) e os usuários do realm, e não duplica ao rodar de novo', async () => {
    rodarSeed();
    const primeira = await contar();
    rodarSeed();
    const segunda = await contar();

    expect(primeira).toMatchObject({ iniciativas: 13, usuarios: 6 });
    expect(segunda).toEqual(primeira);

    const semVotacao = await prisma.iniciativa.findMany({
      where: { id: { in: IDS }, comVotacao: false },
      include: { status: true },
    });
    expect(semVotacao).toHaveLength(1);
    expect(semVotacao[0].status.code).toBe('EM_ANDAMENTO');
  });

  it('o placar de cada iniciativa votada bate com os votos gravados', async () => {
    const placares = await prisma.placar.findMany({
      where: { iniciativaId: { in: IDS } },
    });
    for (const placar of placares) {
      const likes = await prisma.voto.count({
        where: { iniciativaId: placar.iniciativaId, ciclo: placar.ciclo, valor: 1 },
      });
      const dislikes = await prisma.voto.count({
        where: { iniciativaId: placar.iniciativaId, ciclo: placar.ciclo, valor: -1 },
      });
      expect({ likes: placar.likes, dislikes: placar.dislikes }).toEqual({ likes, dislikes });
    }
  });

  it('recusa rodar em produção', () => {
    expect(() =>
      execFileSync(process.execPath, ['prisma/seed.mjs'], {
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'pipe',
      }),
    ).toThrow();
  });
});
