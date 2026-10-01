import { Test, type TestingModule } from '@nestjs/testing';
import { ResourceNotFoundException } from '@/common/exceptions/resource-not-found.exception';
import { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import { PrismaService } from '@/database/prisma.service';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let service: TaskService;
  let prisma: {
    task: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const mockTask = {
    id: 'a7b7c7d7-e7f7-4a7b-8c7d-7e7f7a7b7c7d',
    title: 'Implementar autenticação',
    description: 'Implementar JWT com refresh token',
    dueDate: new Date('2026-12-31'),
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: { code: 'PENDING' },
    priority: { code: 'HIGH' },
  };

  beforeEach(async () => {
    prisma = {
      task: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a task successfully', async () => {
      const dto = {
        title: 'Implementar autenticação',
        description: 'Implementar JWT com refresh token',
        priority: 'HIGH' as const,
        dueDate: '2026-12-31',
      };
      prisma.task.create.mockResolvedValue(mockTask);

      const result = await service.create(dto);

      expect(prisma.task.create).toHaveBeenCalled();
      expect(result.title).toBe(mockTask.title);
      expect(result.status).toBe('PENDING');
      expect(result.priority).toBe('HIGH');
    });
  });

  describe('findAll', () => {
    it('should return a paginated response of tasks', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);
      prisma.task.count.mockResolvedValue(1);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });

      const result = await service.findAll(query);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await service.findOne(mockTask.id);

      expect(prisma.task.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockTask.id } }),
      );
      expect(result.id).toBe(mockTask.id);
    });

    it('should throw ResourceNotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('update', () => {
    it('should update a task successfully', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      prisma.task.update.mockResolvedValue({ ...mockTask, title: 'Título atualizado' });

      const result = await service.update(mockTask.id, { title: 'Título atualizado' });

      expect(prisma.task.findUnique).toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalled();
      expect(result.title).toBe('Título atualizado');
    });

    it('should throw ResourceNotFoundException if task to update not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', {})).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a task successfully', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTask);
      prisma.task.delete.mockResolvedValue(mockTask);

      await service.remove(mockTask.id);

      expect(prisma.task.findUnique).toHaveBeenCalled();
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: mockTask.id } });
    });

    it('should throw ResourceNotFoundException if task to remove not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
