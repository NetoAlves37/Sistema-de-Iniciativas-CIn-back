import { Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions/resource-not-found.exception';
import { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import type { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import { PrismaService } from '@/database/prisma.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS } from './task.constants';
import type { Task } from './task.type';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto, ownerId?: string): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description ?? null,
        dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null,
        ownerId: ownerId ?? null,
        status: { connect: { code: createTaskDto.status ?? DEFAULT_TASK_STATUS } },
        priority: { connect: { code: createTaskDto.priority ?? DEFAULT_TASK_PRIORITY } },
      },
      include: { status: true, priority: true },
    });
    return this.serialize(task);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponseDto<Task>> {
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { status: true, priority: true },
      }),
      this.prisma.task.count(),
    ]);
    return PaginatedResponseDto.of(
      items.map((item) => this.serialize(item)),
      total,
      query,
    );
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { status: true, priority: true },
    });
    if (!task) {
      throw new ResourceNotFoundException('Tarefa', id);
    }
    return this.serialize(task);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    await this.findOne(id);
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(updateTaskDto.title !== undefined ? { title: updateTaskDto.title } : {}),
        ...(updateTaskDto.description !== undefined
          ? { description: updateTaskDto.description }
          : {}),
        ...(updateTaskDto.dueDate !== undefined
          ? { dueDate: updateTaskDto.dueDate ? new Date(updateTaskDto.dueDate) : null }
          : {}),
        ...(updateTaskDto.status !== undefined
          ? { status: { connect: { code: updateTaskDto.status } } }
          : {}),
        ...(updateTaskDto.priority !== undefined
          ? { priority: { connect: { code: updateTaskDto.priority } } }
          : {}),
      },
      include: { status: true, priority: true },
    });
    return this.serialize(task);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
  }

  private serialize(task: {
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    ownerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    status: { code: string };
    priority: { code: string };
  }): Task {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status.code as Task['status'],
      priority: task.priority.code as Task['priority'],
      dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
      ownerId: task.ownerId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
