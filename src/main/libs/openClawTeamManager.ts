import { app } from 'electron';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getOpenClawInstancePool, type PoolInstance } from './openClawInstancePool';
import type {
  OpenClawInstance,
  OpenClawInstanceStatus,
  OpenClawInstanceConfig,
  InstanceStats,
  TeamTask,
  TaskInput,
  TeamConfig,
  SchedulingStrategy,
  OpenClawTeamEvent,
} from '../../renderer/types/openClawTeam';
import type {
  ScheduledTask,
  ScheduledTaskInput,
} from '../../renderer/types/scheduledTask';

const DEFAULT_MAX_CONCURRENT_TASKS = 2;
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;

const ensureDir = (dirPath: string): void => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const generateId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

const parseJsonFile = <T>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const createDefaultInstanceConfig = (): OpenClawInstanceConfig => ({
  maxConcurrentTasks: DEFAULT_MAX_CONCURRENT_TASKS,
  envVars: {},
  allowedTaskTypes: [],
});

const createDefaultInstanceStats = (): InstanceStats => ({
  currentTasks: 0,
  totalTasksCompleted: 0,
  totalTasksFailed: 0,
  avgTaskDurationMs: 0,
});

export class OpenClawTeamManager extends EventEmitter {
  private readonly baseDir: string;
  private readonly configPath: string;
  private readonly stateDir: string;
  private readonly instancePool = getOpenClawInstancePool();

  private instances: Map<string, OpenClawInstance> = new Map();
  private poolInstances: Map<string, PoolInstance> = new Map();
  private taskQueue: TeamTask[] = [];
  private runningTasks: Map<string, TeamTask> = new Map();
  private config: TeamConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();

    const userDataPath = app.getPath('userData');
    this.baseDir = path.join(userDataPath, 'openclaw-team');
    this.stateDir = path.join(this.baseDir, 'state');
    this.configPath = path.join(this.stateDir, 'config.json');

    ensureDir(this.baseDir);
    ensureDir(this.stateDir);

    this.config = this.loadConfig();
    this.loadInstancesFromConfig();

    // Listen for pool events
    this.instancePool.on('instance:status-changed', (instanceId, status) => {
      const poolInstance = this.instancePool.getInstance(instanceId);
      if (poolInstance) {
        this.syncInstanceFromPool(poolInstance);
        const instance = this.instances.get(instanceId);
        if (instance) {
          this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });
          this.saveConfig();
        }
      }
    });

    this.instancePool.on('instance:added', (poolInstance) => {
      this.poolInstances.set(poolInstance.id, poolInstance);
      this.syncInstanceFromPool(poolInstance);
      const instance = this.instances.get(poolInstance.id);
      if (instance) {
        this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });
        this.saveConfig();
      }
    });

    this.instancePool.on('instance:removed', (instanceId) => {
      this.poolInstances.delete(instanceId);
      this.instances.delete(instanceId);
      this.emitTeamEvent({ type: 'instance:updated', instance: { id: instanceId, status: 'stopped' } as OpenClawInstance });
      this.saveConfig();
    });

    // Load persisted instances
    this.instancePool.loadPersistedInstances().then(poolInstances => {
      for (const poolInstance of poolInstances) {
        this.poolInstances.set(poolInstance.id, poolInstance);
        this.syncInstanceFromPool(poolInstance);
      }
      // Save config to include loaded instances
      this.saveConfig();
    });
  }

  private syncInstanceFromPool(poolInstance: PoolInstance): void {
    // Map engine phase to instance status
    let status: OpenClawInstanceStatus = 'stopped';
    switch (poolInstance.status.phase) {
      case 'starting':
        status = 'starting';
        break;
      case 'running':
        status = poolInstance.currentTasks > 0 ? 'busy' : 'idle';
        break;
      case 'error':
        status = 'error';
        break;
      case 'not_installed':
      case 'installing':
      case 'ready':
      default:
        status = 'stopped';
        break;
    }

    const instance: OpenClawInstance = {
      id: poolInstance.id,
      name: poolInstance.name,
      status,
      type: poolInstance.type,
      capabilities: poolInstance.capabilities,
      config: {
        maxConcurrentTasks: poolInstance.maxConcurrentTasks,
        envVars: poolInstance.envVars,
        allowedTaskTypes: []
      },
      stats: {
        currentTasks: poolInstance.currentTasks,
        totalTasksCompleted: poolInstance.totalTasksCompleted,
        totalTasksFailed: poolInstance.totalTasksFailed,
        avgTaskDurationMs: 0,
        memoryUsageMB: poolInstance.status.memoryUsageMB,
        cpuUsagePercent: poolInstance.status.cpuUsagePercent,
      },
      createdAt: poolInstance.createdAt,
      lastHeartbeatAt: poolInstance.lastUsedAt,
      port: poolInstance.connectionInfo?.port || undefined,
    };
    this.instances.set(instance.id, instance);
  }

  private loadConfig(): TeamConfig {
    const saved = parseJsonFile<TeamConfig>(this.configPath);
    if (saved) {
      return saved;
    }

    return {
      enabled: false,
      instances: [],
      schedulingStrategy: 'round-robin',
      defaultInstanceConfig: {},
      autoRestart: true,
    };
  }

  private saveConfig(): void {
    this.config.instances = Array.from(this.instances.values());
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  private loadInstancesFromConfig(): void {
    for (const instance of this.config.instances) {
      this.instances.set(instance.id, instance);
    }
  }

  override emit(eventName: string, ...args: unknown[]): boolean {
    // 类型安全的事件发射
    return super.emit(eventName, ...args);
  }

  emitTeamEvent(event: OpenClawTeamEvent): void {
    this.emit('event', event);
  }

  // ============ 配置管理 ============

  getConfig(): TeamConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<TeamConfig>): TeamConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();

    if (this.config.enabled && !this.heartbeatTimer) {
      this.startHeartbeat();
    } else if (!this.config.enabled && this.heartbeatTimer) {
      this.stopHeartbeat();
    }

    return { ...this.config };
  }

  // ============ 实例管理 ============

  listInstances(): OpenClawInstance[] {
    return Array.from(this.instances.values()).map((i) => ({ ...i }));
  }

  getInstance(instanceId: string): OpenClawInstance | null {
    return this.instances.get(instanceId) ? { ...this.instances.get(instanceId)! } : null;
  }

  async createInstance(request: {
    name: string;
    type?: 'general' | 'specialized';
    capabilities?: string[];
    config?: Partial<OpenClawInstanceConfig>;
  }): Promise<OpenClawInstance> {
    const defaultConfig = createDefaultInstanceConfig();
    const instanceConfig = {
      ...defaultConfig,
      ...this.config.defaultInstanceConfig,
      ...request.config,
    };

    // Create instance in pool
    const poolInstance = await this.instancePool.createInstance({
      name: request.name,
      type: request.type || 'general',
      capabilities: request.capabilities || [],
      maxConcurrentTasks: instanceConfig.maxConcurrentTasks,
      envVars: instanceConfig.envVars,
    });

    this.poolInstances.set(poolInstance.id, poolInstance);
    this.syncInstanceFromPool(poolInstance);

    const instance = this.instances.get(poolInstance.id)!;
    this.saveConfig();
    this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });

    return { ...instance };
  }

  async deleteInstance(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    if (instance.status !== 'stopped') {
      // 先疏散任务
      await this.evacuateInstance(instanceId);
    }

    // Remove from pool
    await this.instancePool.removeInstance(instanceId);
    this.poolInstances.delete(instanceId);
    this.instances.delete(instanceId);
    this.saveConfig();
    return true;
  }

  async startInstance(instanceId: string): Promise<OpenClawInstance> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status !== 'stopped' && instance.status !== 'error') {
      return { ...instance };
    }

    instance.status = 'starting';
    this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });

    // Start the instance via pool
    await this.instancePool.startInstance(instanceId);

    const poolInstance = this.instancePool.getInstance(instanceId);
    if (poolInstance) {
      this.syncInstanceFromPool(poolInstance);
    }

    this.saveConfig();
    this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });

    // 尝试调度等待中的任务
    await this.scheduleTasks();

    return { ...instance };
  }

  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status === 'stopped') return;

    // 疏散任务
    await this.evacuateInstance(instanceId);

    // Stop the instance via pool
    await this.instancePool.stopInstance(instanceId);

    const poolInstance = this.instancePool.getInstance(instanceId);
    if (poolInstance) {
      this.syncInstanceFromPool(poolInstance);
    }

    instance.pid = undefined;
    instance.port = undefined;
    this.saveConfig();
    this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });
  }

  async restartInstance(instanceId: string): Promise<OpenClawInstance> {
    await this.stopInstance(instanceId);
    return this.startInstance(instanceId);
  }

  private async evacuateInstance(instanceId: string): Promise<void> {
    const tasksToRequeue = Array.from(this.runningTasks.values())
      .filter((t) => t.assignedTo === instanceId && t.status === 'running');

    for (const task of tasksToRequeue) {
      task.status = 'pending';
      task.assignedTo = undefined;
      task.assignedAt = undefined;
      this.runningTasks.delete(task.id);
      this.emitTeamEvent({ type: 'task:requeued', task: { ...task } });
    }

    await this.scheduleTasks();
  }

  // ============ 任务管理 ============

  /**
   * 为任务选择合适的实例（公开方法，供外部调度器使用）
   */
  public selectInstanceForScheduledTask(
    task: ScheduledTaskInput | ScheduledTask,
    strategy?: SchedulingStrategy
  ): OpenClawInstance | null {
    const capabilities = (task as any).input?.capabilities || (task as any).openclawTeam?.capabilityRequirements || [];
    const selectedStrategy = strategy || this.config.schedulingStrategy;

    const poolInstance = this.instancePool.acquireInstance(
      selectedStrategy,
      capabilities
    );

    if (!poolInstance) return null;
    return this.instances.get(poolInstance.id) || null;
  }

  async submitTask(input: TaskInput, scheduledTaskId?: string): Promise<TeamTask> {
    const task: TeamTask = {
      id: generateId(),
      status: 'pending',
      priority: input.priority || 0,
      input,
      scheduledTaskId,
    };

    this.taskQueue.push(task);
    this.emitTeamEvent({ type: 'task:queued', task: { ...task } });

    await this.scheduleTasks();
    return { ...task };
  }

  getTaskStatus(taskId: string): TeamTask | null {
    const task = this.runningTasks.get(taskId) || this.taskQueue.find((t) => t.id === taskId);
    return task ? { ...task } : null;
  }

  listTasks(filter?: {
    status?: TeamTask['status'];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): { tasks: TeamTask[]; total: number } {
    let allTasks = [...this.taskQueue, ...this.runningTasks.values()];

    if (filter?.status) {
      allTasks = allTasks.filter((t) => t.status === filter.status);
    }
    if (filter?.assignedTo) {
      allTasks = allTasks.filter((t) => t.assignedTo === filter.assignedTo);
    }

    const total = allTasks.length;

    if (filter?.offset !== undefined) {
      allTasks = allTasks.slice(filter.offset);
    }
    if (filter?.limit !== undefined) {
      allTasks = allTasks.slice(0, filter.limit);
    }

    return { tasks: allTasks.map((t) => ({ ...t })), total };
  }

  // ============ 任务调度 ============

  private async scheduleTasks(): Promise<void> {
    if (!this.config.enabled) return;

    const pendingTasks = this.taskQueue
      .filter((t) => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority);

    for (const task of pendingTasks) {
      const instance = this.selectInstanceForTask(task);
      if (instance) {
        await this.assignTask(task, instance);
      }
    }
  }

  private selectInstanceForTask(task: TeamTask): OpenClawInstance | null {
    // Use instance pool's acquisition logic for unified scheduling
    const poolInstance = this.instancePool.acquireInstance(
      this.config.schedulingStrategy,
      task.input.capabilities
    );

    if (!poolInstance) return null;

    // Return the synchronized instance from our map
    return this.instances.get(poolInstance.id) || null;
  }

  private async assignTask(task: TeamTask, instance: OpenClawInstance): Promise<void> {
    task.status = 'assigned';
    task.assignedTo = instance.id;
    task.assignedAt = Date.now();

    instance.status = 'busy';
    instance.stats.currentTasks++;

    // 从队列移到运行中
    this.taskQueue = this.taskQueue.filter((t) => t.id !== task.id);
    this.runningTasks.set(task.id, task);

    this.emitTeamEvent({
      type: 'task:assigned',
      task: { ...task },
      instanceId: instance.id,
    });
    this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });

    // TODO: 实际执行任务
    await this.executeTask(task, instance);
  }

  private async executeTask(task: TeamTask, instance: OpenClawInstance): Promise<void> {
    task.status = 'running';
    task.startedAt = Date.now();
    this.emitTeamEvent({ type: 'task:started', task: { ...task } });

    let taskSuccess = false;

    try {
      // Get the pool instance for connection info
      const poolInstance = this.instancePool.getInstance(instance.id);
      if (!poolInstance || !poolInstance.connectionInfo) {
        throw new Error('Instance not running or no connection info available');
      }

      // TODO: 实际调用 OpenClaw 实例执行任务
      // 这里可以通过 poolInstance.connectionInfo.url 连接到实例的 gateway 提交任务
      await new Promise((resolve) => setTimeout(resolve, 1000));

      task.status = 'completed';
      task.completedAt = Date.now();
      task.output = {
        result: { success: true },
        durationMs: (task.completedAt - task.startedAt!),
      };

      instance.stats.totalTasksCompleted++;
      taskSuccess = true;
      this.emitTeamEvent({ type: 'task:completed', task: { ...task } });
    } catch (error) {
      task.status = 'failed';
      task.completedAt = Date.now();
      task.error = error instanceof Error ? error.message : 'Unknown error';

      instance.stats.totalTasksFailed++;
      taskSuccess = false;
      this.emitTeamEvent({ type: 'task:failed', task: { ...task }, error: task.error });
    } finally {
      this.runningTasks.delete(task.id);
      instance.stats.currentTasks--;

      // Release the instance back to the pool
      this.instancePool.releaseInstance(instance.id, taskSuccess);

      if (instance.stats.currentTasks === 0) {
        instance.status = 'idle';
      }

      this.emitTeamEvent({ type: 'instance:updated', instance: { ...instance } });
      this.saveConfig();

      // 继续调度其他任务
      await this.scheduleTasks();
    }
  }

  // ============ 心跳检测 ============

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [instanceId, instance] of this.instances) {
        if (
          instance.status !== 'stopped' &&
          now - instance.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS
        ) {
          this.handleInstanceFailure(instanceId);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleInstanceFailure(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    console.warn(`[OpenClawTeam] Instance ${instanceId} heartbeat timeout`);
    instance.status = 'error';
    this.emitTeamEvent({ type: 'instance:failed', instance: { ...instance } });

    this.evacuateInstance(instanceId).catch((err) => {
      console.error(`[OpenClawTeam] Failed to evacuate instance ${instanceId}:`, err);
    });

    if (this.config.autoRestart) {
      this.startInstance(instanceId).catch((err) => {
        console.error(`[OpenClawTeam] Failed to restart instance ${instanceId}:`, err);
      });
    }
  }

  // ============ 生命周期 ============

  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    // 停止所有实例
    for (const instanceId of this.instances.keys()) {
      try {
        await this.stopInstance(instanceId);
      } catch (err) {
        console.error(`[OpenClawTeam] Failed to stop instance ${instanceId}:`, err);
      }
    }

    // Shutdown the instance pool
    await this.instancePool.shutdown();
  }
}

// 单例实例
let teamManagerInstance: OpenClawTeamManager | null = null;

export function getOpenClawTeamManager(): OpenClawTeamManager {
  if (!teamManagerInstance) {
    teamManagerInstance = new OpenClawTeamManager();
  }
  return teamManagerInstance;
}
