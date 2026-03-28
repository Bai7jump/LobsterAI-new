// OpenClaw Team 相关类型定义

// 任务分配策略
export type TaskAssignmentStrategy =
  | 'manual'
  | 'round-robin'
  | 'least-loaded'
  | 'capability-based'
  | 'affinity-tag';

// 实例能力标签定义
export interface OpenClawInstanceCapability {
  id: string;
  name: string;
  description?: string;
  models?: string[];
  skills?: string[];
  platforms?: string[];
  tags?: string[];
  resourceLimits?: {
    maxMemoryMB?: number;
    maxConcurrentSessions?: number;
  };
}

export type OpenClawInstanceStatus =
  | 'starting'
  | 'idle'
  | 'busy'
  | 'error'
  | 'stopped';

export interface OpenClawInstanceConfig {
  maxConcurrentTasks: number;
  memoryLimitMB?: number;
  cpuLimit?: number;
  envVars: Record<string, string>;
  allowedTaskTypes: string[];
}

export interface InstanceStats {
  currentTasks: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  avgTaskDurationMs: number;
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
}

export interface OpenClawInstance {
  id: string;
  name: string;
  status: OpenClawInstanceStatus;
  type: 'general' | 'specialized';
  capabilities: (string | OpenClawInstanceCapability)[]; // 能力标签，支持字符串简写或完整结构化定义
  pid?: number;
  port?: number;
  config: OpenClawInstanceConfig;
  stats: InstanceStats;
  createdAt: number;
  lastHeartbeatAt: number;
}

export interface TaskInput {
  id?: string;
  priority?: number;
  capabilities?: (string | OpenClawInstanceCapability)[];
  payload: unknown;
}

export interface TaskOutput {
  result: unknown;
  durationMs: number;
}

export type TeamTaskStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed';

export interface TeamTaskAssignmentHistory {
  instanceId: string;
  assignedAt: string;
  reason?: string;
}

export interface TeamTaskStats {
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  averageDurationMs?: number;
}

export interface TeamTask {
  id: string;
  scheduledTaskId?: string;
  status: TeamTaskStatus;
  priority: number;
  assignedTo?: string; // instanceId
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  input: TaskInput;
  output?: TaskOutput;
  error?: string;
  openclawTeam?: {
    assignedInstanceId?: string;
    assignmentHistory?: TeamTaskAssignmentHistory[];
    stats?: TeamTaskStats;
  };
}

export type SchedulingStrategy =
  | 'round-robin'
  | 'least-loaded'
  | 'capability-match';

export interface TeamConfig {
  enabled: boolean;
  instances: OpenClawInstance[];
  schedulingStrategy: SchedulingStrategy;
  defaultInstanceConfig: Partial<OpenClawInstanceConfig>;
  autoRestart: boolean;
}

// IPC 请求/响应类型
export interface ListInstancesResponse {
  instances: OpenClawInstance[];
  error?: string;
}

export interface StartInstanceRequest {
  instanceId: string;
}

export interface StartInstanceResponse {
  success: boolean;
  instance?: OpenClawInstance;
  error?: string;
}

export interface StopInstanceRequest {
  instanceId: string;
}

export interface StopInstanceResponse {
  success: boolean;
  error?: string;
}

export interface CreateInstanceRequest {
  name: string;
  type?: 'general' | 'specialized';
  capabilities?: string[];
  config?: Partial<OpenClawInstanceConfig>;
}

export interface CreateInstanceResponse {
  success: boolean;
  instance?: OpenClawInstance;
  error?: string;
}

export interface DeleteInstanceRequest {
  instanceId: string;
}

export interface DeleteInstanceResponse {
  success: boolean;
  error?: string;
}

export interface SubmitTaskRequest {
  input: TaskInput;
  scheduledTaskId?: string;
}

export interface SubmitTaskResponse {
  success: boolean;
  task?: TeamTask;
  error?: string;
}

export interface GetTaskStatusRequest {
  taskId: string;
}

export interface GetTaskStatusResponse {
  success: boolean;
  task?: TeamTask;
  error?: string;
}

export interface ListTasksRequest {
  filter?: {
    status?: TeamTaskStatus;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  };
}

export interface ListTasksResponse {
  success: boolean;
  tasks: TeamTask[];
  total: number;
  error?: string;
}

export interface GetConfigResponse {
  success: boolean;
  config?: TeamConfig;
  error?: string;
}

export interface UpdateConfigRequest {
  config: Partial<TeamConfig>;
}

export interface UpdateConfigResponse {
  success: boolean;
  config?: TeamConfig;
  error?: string;
}

// 事件类型
export type OpenClawTeamEvent =
  | { type: 'instance:updated'; instance: OpenClawInstance }
  | { type: 'instance:failed'; instance: OpenClawInstance }
  | { type: 'task:queued'; task: TeamTask }
  | { type: 'task:assigned'; task: TeamTask; instanceId: string }
  | { type: 'task:started'; task: TeamTask }
  | { type: 'task:completed'; task: TeamTask }
  | { type: 'task:failed'; task: TeamTask; error: string }
  | { type: 'task:requeued'; task: TeamTask };
