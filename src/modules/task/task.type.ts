import type { TaskPriorityCode, TaskStatusCode } from './task.constants';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatusCode;
  priority: TaskPriorityCode;
  dueDate: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
