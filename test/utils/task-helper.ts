/**
 * Team Mode Task Management Test Helper
 */
import type { TeamTask, TaskInput } from '../../src/renderer/types/openClawTeam';

// IPC handler mock/wrapper
const ipc = {
  invoke: async (channel: string, ...args: any[]) => {
    console.log(`IPC Invoke: ${channel}`, args);
    return { success: true };
  }
};

/**
 * Submit a task to the team
 */
export async function submitTask(
  input: TaskInput,
  scheduledTaskId?: string
): Promise<TeamTask> {
  const response = await ipc.invoke('openClawTeam:submitTask', { input, scheduledTaskId });

  if (!response.success) {
    throw new Error(`Failed to submit task: ${response.error}`);
  }

  return response.task;
}

/**
 * Get task status
 */
export async function getTaskStatus(taskId: string): Promise<TeamTask | null> {
  const response = await ipc.invoke('openClawTeam:getTaskStatus', { taskId });

  if (!response.success) {
    throw new Error(`Failed to get task status ${taskId}: ${response.error}`);
  }

  return response.task || null;
}

/**
 * List tasks with optional filters
 */
export async function listTasks(filter?: {
  status?: TeamTask['status'];
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: TeamTask[]; total: number }> {
  const response = await ipc.invoke('openClawTeam:listTasks', { filter });

  if (!response.success) {
    throw new Error(`Failed to list tasks: ${response.error}`);
  }

  return {
    tasks: response.tasks || [],
    total: response.total || 0
  };
}

/**
 * Wait for task to complete (success or failure)
 */
export async function waitForTaskCompletion(
  taskId: string,
  timeoutMs: number = 300000 // 5 minutes default
): Promise<TeamTask> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const task = await getTaskStatus(taskId);
    if (task && ['completed', 'failed'].includes(task.status)) {
      return task;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Task ${taskId} did not complete within ${timeoutMs}ms`);
}

/**
 * Wait for task to be assigned
 */
export async function waitForTaskAssignment(
  taskId: string,
  timeoutMs: number = 30000
): Promise<TeamTask> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const task = await getTaskStatus(taskId);
    if (task && task.assignedTo && ['assigned', 'running', 'completed', 'failed'].includes(task.status)) {
      return task;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Task ${taskId} was not assigned within ${timeoutMs}ms`);
}

/**
 * Submit multiple tasks in batch
 */
export async function submitBatchTasks(
  inputs: TaskInput[]
): Promise<TeamTask[]> {
  const tasks: TeamTask[] = [];

  for (const input of inputs) {
    const task = await submitTask(input);
    tasks.push(task);
  }

  return tasks;
}

/**
 * Wait for all tasks to complete
 */
export async function waitForAllTasksCompletion(
  taskIds: string[],
  timeoutMs: number = 600000 // 10 minutes default
): Promise<TeamTask[]> {
  const tasks: TeamTask[] = [];

  for (const taskId of taskIds) {
    const task = await waitForTaskCompletion(taskId, timeoutMs);
    tasks.push(task);
  }

  return tasks;
}

/**
 * Create test task inputs
 */
export const TestTaskTemplates = {
  simpleCoding: (priority: number = 0): TaskInput => ({
    priority,
    capabilities: ['coding'],
    payload: {
      kind: 'agentTurn',
      message: 'Write a JavaScript function to reverse a string',
      timeoutSeconds: 30
    }
  }),

  pythonTask: (priority: number = 0): TaskInput => ({
    priority,
    capabilities: ['coding', 'python'],
    payload: {
      kind: 'agentTurn',
      message: 'Write a Python function to calculate factorial',
      timeoutSeconds: 30
    }
  }),

  analysisTask: (priority: number = 0): TaskInput => ({
    priority,
    capabilities: ['analysis'],
    payload: {
      kind: 'agentTurn',
      message: 'Analyze these metrics and provide a summary',
      timeoutSeconds: 60
    }
  }),

  longRunningTask: (priority: number = 0): TaskInput => ({
    priority,
    payload: {
      kind: 'agentTurn',
      message: 'Perform a comprehensive code review of the provided repository',
      timeoutSeconds: 300
    }
  })
};
