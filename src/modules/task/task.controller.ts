import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@/common/auth/current-user.interface';
import { GetCurrentUser } from '@/common/auth/decorators/current-user.decorator';
import type { PaginatedResponseDto } from '@/common/pagination/paginated-response.dto';
import type { PaginationQueryDto } from '@/common/pagination/pagination-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';
import type { Task } from './task.type';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller({ path: 'tasks', version: '1' })
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova tarefa' })
  @ApiResponse({ status: 201, description: 'Tarefa criada com sucesso' })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @GetCurrentUser() user?: CurrentUser,
  ): Promise<Task> {
    return this.taskService.create(createTaskDto, user?.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tarefas paginadas' })
  @ApiResponse({ status: 200, description: 'Lista paginada de tarefas retornada' })
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResponseDto<Task>> {
    return this.taskService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar uma tarefa por ID' })
  @ApiResponse({ status: 200, description: 'Tarefa encontrada' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Task> {
    return this.taskService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma tarefa' })
  @ApiResponse({ status: 200, description: 'Tarefa atualizada' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    return this.taskService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover uma tarefa' })
  @ApiResponse({ status: 204, description: 'Tarefa removida' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.taskService.remove(id);
  }
}
