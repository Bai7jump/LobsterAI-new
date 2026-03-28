# ScheduledTasks 与 OpenClaw Team 模式集成方案

## 1. 当前执行流程分析

### 现有架构

```
┌─────────────────┐
│  TaskForm UI    │
└────────┬────────┘
         │ scheduledTask:create
         ▼
┌─────────────────────────────┐
│  Main IPC Handlers          │
│  (main.ts lines 2712-2840) │
└────────┬────────────────────┘
         │
         ▼
┌───────────────────────┐
│  CronJobService       │
│  - addJob()           │
│  - updateJob()        │
│  - runJob()           │
└────────┬──────────────┘
         │
         ▼
┌──────────────────────────┐
│  OpenClawRuntimeAdapter │
│  - getGatewayClient()   │
└────────┬─────────────────┘
         │
         ▼
┌───────────────────────┐
│  OpenClaw Gateway     │
│  cron.add / cron.run  │
└───────────────────────┘
```

### 关键代码位置

1. **IPC 处理**: `src/main/main.ts` 2712-2840 行
2. **CronJobService**: `src/main/libs/cronJobService.ts`
3. **OpenClawRuntimeAdapter**: `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
4. **类型定义**: `src/renderer/types/scheduledTask.ts`

---

## 2. 集成方案设计

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Renderer Layer                            │
│  ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │  TaskForm    │    │  TaskInstanceSelector (NEW)          │  │
│  └──────┬───────┘    └───────────────────┬──────────────────┘  │
└─────────┼──────────────────────────────────┼─────────────────────┘
          │ scheduledTask:create             │ openclawTeam config
          ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ScheduledTaskInstanceRouter (NEW)                       │  │
│  │  - selectInstanceForTask()                               │  │
│  │  - round-robin / least-loaded / capability-based         │  │
│  └────────────┬──────────────────────────────────────────────┘  │
│               │                                                  │
│  ┌────────────▼──────────────┐   ┌────────────────────────┐  │
│  │  CronJobService (Enhanced)│   │  OpenClawInstancePool  │  │
│  │  - addJob(instanceId?)    │   │  (NEW)                 │  │
│  │  - runJob(instanceId?)    │   └────────────────────────┘  │
│  └────────────┬──────────────┘                               │
└───────────────┼────────────────────────────────────────────────┘
                │
         ┌──────┴───────┐
         │              │
         ▼              ▼
  ┌──────────┐   ┌──────────┐
  │ Instance │   │ Instance │
  │ #1:18789 │   │ #2:18790 │
  └──────────┘   └──────────┘
```

---

## 3. 实现步骤

### 阶段 1: 类型扩展

**文件**: `src/renderer/types/scheduledTask.ts`

```typescript
// 在文件末尾添加

// 任务分配策略
export type TaskAssignmentStrategy =
  | 'manual'
  | 'round-robin'
  | 'least-loaded'
  | 'capability-based'
  | 'affinity-tag';

// 实例能力标签
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

// 扩展 ScheduledTaskInput
export interface ScheduledTaskInput {
  // ... 现有字段
  openclawTeam?: {
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
  };
}

// 扩展 ScheduledTask
export interface ScheduledTask {
  // ... 现有字段
  openclawTeam?: {
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
  };
}
```

### 阶段 2: 创建 ScheduledTaskInstanceRouter

**文件**: `src/main/libs/scheduledTaskInstanceRouter.ts`

```typescript
import type {
  ScheduledTask,
  ScheduledTaskInput,
  TaskAssignmentStrategy,
  OpenClawInstanceCapability
} from '../../renderer/types/scheduledTask';

interface OpenClawInstance {
  id: string;
  name: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  capabilities?: OpenClawInstanceCapability;
  stats?: {
    activeSessions: number;
    memoryUsageMB?: number;
    loadPercentage?: number;
  };
}

interface RouterDeps {
  getInstances: () => OpenClawInstance[];
  getInstance: (instanceId: string) => OpenClawInstance | undefined;
  getTaskAssignmentHistory: (taskId: string) => string[];
}

export class ScheduledTaskInstanceRouter {
  private readonly deps: RouterDeps;
  private roundRobinIndex = 0;
  private taskInstanceCache = new Map<string, string>();

  constructor(deps: RouterDeps) {
    this.deps = deps;
  }

  async selectInstanceForTask(
    task: ScheduledTask | ScheduledTaskInput
  ): Promise<OpenClawInstance> {
    const teamConfig = (task as any).openclawTeam;
    const strategy = teamConfig?.assignmentStrategy || 'round-robin';

    let selectedInstance: OpenClawInstance | undefined;

    switch (strategy) {
      case 'manual':
        selectedInstance = this.selectManual(teamConfig?.instanceId);
        break;
      case 'round-robin':
        selectedInstance = this.selectRoundRobin();
        break;
      case 'least-loaded':
        selectedInstance = this.selectLeastLoaded();
        break;
      case 'capability-based':
        selectedInstance = this.selectByCapability(teamConfig?.capabilityRequirements);
        break;
      case 'affinity-tag':
        selectedInstance = this.selectByAffinityTag(teamConfig?.affinityTags);
        break;
    }

    if (!selectedInstance) {
      throw new Error('No available OpenClaw instance for task');
    }

    if ('id' in task) {
      this.taskInstanceCache.set(task.id, selectedInstance.id);
    }

    return selectedInstance;
  }

  private selectManual(instanceId?: string): OpenClawInstance | undefined {
    if (!instanceId) return undefined;
    const instance = this.deps.getInstance(instanceId);
    if (instance && instance.status === 'running') {
      return instance;
    }
    return undefined;
  }

  private selectRoundRobin(): OpenClawInstance | undefined {
    const healthyInstances = this.getHealthyInstances();
    if (healthyInstances.length === 0) return undefined;
    const index = this.roundRobinIndex % healthyInstances.length;
    this.roundRobinIndex++;
    return healthyInstances[index];
  }

  private selectLeastLoaded(): OpenClawInstance | undefined {
    const healthyInstances = this.getHealthyInstances();
    if (healthyInstances.length === 0) return undefined;
    return healthyInstances.reduce((least, current) => {
      const currentLoad = current.stats?.activeSessions || 0;
      const leastLoad = least.stats?.activeSessions || 0;
      return currentLoad < leastLoad ? current : least;
    });
  }

  private selectByCapability(
    requirements?: {
      models?: string[];
      skills?: string[];
      platforms?: string[];
      minMemoryMB?: number;
    }
  ): OpenClawInstance | undefined {
    if (!requirements) {
      return this.selectRoundRobin();
    }

    const healthyInstances = this.getHealthyInstances();

    return healthyInstances.find(instance => {
      const caps = instance.capabilities;
      if (!caps) return false;

      if (requirements.models?.length) {
        const hasRequiredModel = requirements.models.some(m =>
          caps.models?.includes(m)
        );
        if (!hasRequiredModel) return false;
      }

      if (requirements.skills?.length) {
        const hasRequiredSkill = requirements.skills.some(s =>
          caps.skills?.includes(s)
        );
        if (!hasRequiredSkill) return false;
      }

      if (requirements.platforms?.length) {
        const hasRequiredPlatform = requirements.platforms.some(p =>
          caps.platforms?.includes(p)
        );
        if (!hasRequiredPlatform) return false;
      }

      if (requirements.minMemoryMB) {
        const instanceMemory = caps.resourceLimits?.maxMemoryMB;
        if (!instanceMemory || instanceMemory < requirements.minMemoryMB) {
          return false;
        }
      }

      return true;
    });
  }

  private selectByAffinityTag(tags?: string[]): OpenClawInstance | undefined {
    if (!tags || tags.length === 0) {
      return this.selectRoundRobin();
    }

    const healthyInstances = this.getHealthyInstances();

    const scoredInstances = healthyInstances.map(instance => {
      const instanceTags = instance.capabilities?.tags || [];
      const matchCount = tags.filter(tag =>
        instanceTags.includes(tag)
      ).length;
      return { instance, score: matchCount };
    });

    scoredInstances.sort((a, b) => b.score - a.score);
    return scoredInstances[0]?.instance;
  }

  private getHealthyInstances(): OpenClawInstance[] {
    return this.deps.getInstances().filter(
      instance => instance.status === 'running'
    );
  }

  getCachedInstanceForTask(taskId: string): string | undefined {
    return this.taskInstanceCache.get(taskId);
  }

  clearTaskCache(taskId: string): void {
    this.taskInstanceCache.delete(taskId);
  }
}
```

### 阶段 3: 增强 CronJobService

**修改文件**: `src/main/libs/cronJobService.ts`

```typescript
// 在文件顶部添加导入
import type { ScheduledTaskInstanceRouter } from './scheduledTaskInstanceRouter';

// 修改 CronJobServiceDeps 接口
interface CronJobServiceDeps {
  getGatewayClient: (instanceId?: string) => GatewayClientLike | null;
  ensureGatewayReady: (instanceId?: string) => Promise<void>;
  instanceRouter?: ScheduledTaskInstanceRouter;
}

// 修改 CronJobService 类
export class CronJobService {
  // ... 现有代码

  private readonly instanceRouter?: ScheduledTaskInstanceRouter;

  constructor(deps: CronJobServiceDeps) {
    this.getGatewayClient = deps.getGatewayClient;
    this.ensureGatewayReady = deps.ensureGatewayReady;
    this.instanceRouter = deps.instanceRouter;
  }

  // 增强版 addJob
  async addJob(
    input: ScheduledTaskInput,
    options?: { preferredInstanceId?: string }
  ): Promise<ScheduledTask> {
    let targetInstanceId = options?.preferredInstanceId;

    if (this.instanceRouter && input.openclawTeam) {
      const instance = await this.instanceRouter.selectInstanceForTask(input);
      targetInstanceId = instance.id;
    }

    const client = await this.client(targetInstanceId);
    const job = await client.request<GatewayJob>('cron.add', {
      name: input.name,
      description: input.description || undefined,
      enabled: input.enabled,
      schedule: toGatewaySchedule(input.schedule),
      sessionTarget: input.sessionTarget,
      wakeMode: input.wakeMode,
      payload: toGatewayPayload(input.payload),
      ...(toGatewayDelivery(input.delivery) ? { delivery: toGatewayDelivery(input.delivery) } : {}),
      ...(input.agentId?.trim() ? { agentId: input.agentId.trim() } : {}),
      ...(input.sessionKey?.trim() ? { sessionKey: input.sessionKey.trim() } : {}),
    });

    const mapped = mapGatewayJob(job);

    if (targetInstanceId) {
      (mapped as any).openclawTeam = {
        assignedInstanceId: targetInstanceId,
        assignmentHistory: [{
          instanceId: targetInstanceId,
          assignedAt: new Date().toISOString(),
          reason: input.openclawTeam?.assignmentStrategy || 'default'
        }]
      };
    }

    this.jobNameCache.set(mapped.id, mapped.name);
    return mapped;
  }

  // 增强版 runJob
  async runJob(
    id: string,
    options?: { failover?: boolean }
  ): Promise<void> {
    let currentInstanceId: string | undefined;

    if (this.instanceRouter) {
      currentInstanceId = this.instanceRouter.getCachedInstanceForTask(id);
    }

    try {
      const client = await this.client(currentInstanceId);
      await client.request('cron.run', { id });
    } catch (error) {
      const failoverEnabled = options?.failover ?? true;

      if (failoverEnabled && this.instanceRouter) {
        console.warn(`[CronJobService] Task ${id} failed on instance ${currentInstanceId}, attempting failover`);

        this.instanceRouter.clearTaskCache(id);

        const task = await this.getJob(id);
        if (task) {
          const newInstance = await this.instanceRouter.selectInstanceForTask(task);
          const newClient = await this.client(newInstance.id);
          await newClient.request('cron.run', { id });

          console.log(`[CronJobService] Task ${id} failed over to instance ${newInstance.id}`);
          return;
        }
      }

      throw error;
    }
  }

  // 增强版 client 方法
  private async client(instanceId?: string): Promise<GatewayClientLike> {
    let client = this.getGatewayClient(instanceId);
    if (!client) {
      await this.ensureGatewayReady(instanceId);
      client = this.getGatewayClient(instanceId);
    }
    if (!client) {
      throw new Error(
        instanceId
          ? `OpenClaw gateway client is unavailable for instance ${instanceId}`
          : 'OpenClaw gateway client is unavailable for cron operations'
      );
    }
    return client;
  }
}
```

### 阶段 4: 修改 main.ts 中的初始化

**修改文件**: `src/main/main.ts`

```typescript
// 修改 getCronJobService 函数
const getCronJobService = (): CronJobService => {
  if (!cronJobService) {
    if (!openClawRuntimeAdapter) {
      throw new Error('OpenClaw runtime adapter not initialized. CronJobService requires OpenClaw.');
    }
    const adapter = openClawRuntimeAdapter;

    // 创建实例路由器（临时实现，待 OpenClawInstancePool 完成）
    const instanceRouter = new ScheduledTaskInstanceRouter({
      getInstances: () => [{
        id: 'default',
        name: 'Default Instance',
        status: 'running',
        stats: { activeSessions: 0 }
      }],
      getInstance: (id) => id === 'default' ? {
        id: 'default',
        name: 'Default Instance',
        status: 'running',
        stats: { activeSessions: 0 }
      } : undefined,
      getTaskAssignmentHistory: () => []
    });

    cronJobService = new CronJobService({
      getGatewayClient: (instanceId) => adapter.getGatewayClient(),
      ensureGatewayReady: () => adapter.ensureReady(),
      instanceRouter
    });
  }
  return cronJobService;
};
```

### 阶段 5: 扩展 preload.ts

**修改文件**: `src/main/preload.ts`

```typescript
// 在 scheduledTasks 部分添加
scheduledTasks: {
  // ... 现有 API

  createWithInstance: (input: any, instanceId?: string) =>
    ipcRenderer.invoke('scheduledTask:createWithInstance', input, instanceId),
  runOnInstance: (taskId: string, instanceId?: string) =>
    ipcRenderer.invoke('scheduledTask:runOnInstance', taskId, instanceId),
}
```

### 阶段 6: 添加新的 IPC handlers

**在 main.ts 中添加**:

```typescript
ipcMain.handle('scheduledTask:createWithInstance', async (_event, input: any, instanceId?: string) => {
  try {
    const normalizedInput = input && typeof input === 'object' ? { ...input } : {};
    const task = await getCronJobService().addJob(normalizedInput, { preferredInstanceId: instanceId });
    return { success: true, task };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create task' };
  }
});

ipcMain.handle('scheduledTask:runOnInstance', async (_event, taskId: string, instanceId?: string) => {
  try {
    await getCronJobService().runJob(taskId, { failover: !instanceId });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[IPC] Manual run failed for ${taskId}:`, msg);
    return { success: false, error: msg };
  }
});
```

---

## 4. 向后兼容性

1. **默认行为不变**: 如果不配置 `openclawTeam`，任务直接使用默认实例
2. **类型安全**: 所有新增字段都是可选的
3. **渐进式采用**: 可以逐个任务启用团队模式

---

## 5. 下一步

- [ ] 实现完整的 `OpenClawInstancePool`（backend-dev）
- [ ] 创建 `TaskInstanceSelector` UI 组件（frontend-dev）
- [ ] 添加 i18n 翻译（frontend-dev）
- [ ] 集成测试（test-engineer）
