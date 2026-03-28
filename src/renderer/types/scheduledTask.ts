import type {
  TaskAssignmentStrategy,
  OpenClawInstanceCapability,
  OpenClawInstance
} from './openClawTeam';

export interface ScheduleAt {
  kind: 'at';
  at: string;
}

export interface ScheduleEvery {
  kind: 'every';
  everyMs: number;
  anchorMs?: number;
}

export interface ScheduleCron {
  kind: 'cron';
  expr: string;
  tz?: string;
  staggerMs?: number;
}

export type Schedule = ScheduleAt | ScheduleEvery | ScheduleCron;

export interface AgentTurnPayload {
  kind: 'agentTurn';
  message: string;
  timeoutSeconds?: number;
}

export interface SystemEventPayload {
  kind: 'systemEvent';
  text: string;
}

export type ScheduledTaskPayload = AgentTurnPayload | SystemEventPayload;

export interface ScheduledTaskDelivery {
  mode: 'none' | 'announce' | 'webhook';
  channel?: string;
  to?: string;
  accountId?: string;
  bestEffort?: boolean;
}

export type TaskLastStatus = 'success' | 'error' | 'skipped' | 'running' | null;

export interface TaskState {
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: TaskLastStatus;
  lastError: string | null;
  lastDurationMs: number | null;
  runningAtMs: number | null;
  consecutiveErrors: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule: Schedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: ScheduledTaskPayload;
  delivery: ScheduledTaskDelivery;
  agentId: string | null;
  sessionKey: string | null;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  openclawTeam?: ScheduledTaskTeamRuntime;
}

export interface ScheduledTaskRun {
  id: string;
  taskId: string;
  sessionId: string | null;
  sessionKey: string | null;
  status: 'running' | 'success' | 'error' | 'skipped';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface ScheduledTaskRunWithName extends ScheduledTaskRun {
  taskName: string;
}

export interface ScheduledTaskInput {
  name: string;
  description: string;
  enabled: boolean;
  schedule: Schedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: ScheduledTaskPayload;
  delivery?: ScheduledTaskDelivery;
  agentId?: string | null;
  sessionKey?: string | null;
  openclawTeam?: ScheduledTaskTeamConfig;
}

export interface ScheduledTaskStatusEvent {
  taskId: string;
  state: TaskState;
}

export interface ScheduledTaskRunEvent {
  run: ScheduledTaskRunWithName;
}

export interface ScheduledTaskChannelOption {
  value: string;
  label: string;
}


// 团队模式配置 - ScheduledTaskInput 扩展
export interface ScheduledTaskTeamConfig {
  assignmentStrategy?: TaskAssignmentStrategy;
  instanceId?: string;
  affinityTags?: string[];
  capabilityRequirements?: {
    models?: string[];
    skills?: string[];
    platforms?: string[];
    minMemoryMB?: number;
  };
  retryStrategy?: {
    maxRetries?: number;
    retryDelayMs?: number;
    failoverToOtherInstance?: boolean;
  };
}

// 团队模式运行时信息 - ScheduledTask 扩展
export interface ScheduledTaskTeamRuntime {
  assignedInstanceId?: string;
  assignmentHistory?: Array<{
    instanceId: string;
    assignedAt: string;
    reason?: string;
  }>;
  stats?: {
    totalRuns: number;
    successRuns: number;
    errorRuns: number;
    averageDurationMs?: number;
  };
}

export type ScheduledTaskViewMode =
  | 'list'
  | 'create'
  | 'edit'
  | 'detail'
  | 'templates'
  | 'select-instance';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
}

export interface TaskTemplateCategory {
  id: string;
  name: string;
}

