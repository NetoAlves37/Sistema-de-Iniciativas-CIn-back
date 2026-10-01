export const TASK_STATUS_CODES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TaskStatusCode = (typeof TASK_STATUS_CODES)[number];

export const TASK_PRIORITY_CODES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriorityCode = (typeof TASK_PRIORITY_CODES)[number];

export const DEFAULT_TASK_STATUS: TaskStatusCode = 'PENDING';
export const DEFAULT_TASK_PRIORITY: TaskPriorityCode = 'MEDIUM';
