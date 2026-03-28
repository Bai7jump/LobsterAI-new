import type {
  ScheduledTask,
  ScheduledTaskInput,
} from '../../renderer/types/scheduledTask';
import type { OpenClawInstanceStatus, OpenClawInstance, OpenClawInstanceCapability, SchedulingStrategy } from '../../renderer/types/openClawTeam';
import { getOpenClawTeamManager } from './openClawTeamManager';

// 任务分配策略，与OpenClawTeam的SchedulingStrategy保持兼容
export type TaskAssignmentStrategy =
  | 'manual'
  | 'round-robin'
  | 'least-loaded'
  | 'capability-based'
  | 'capability-match' // 别名，兼容TeamManager的策略命名
  | 'affinity-tag';


// 扩展 ScheduledTaskInput - 运行时类型声明
declare module '../../renderer/types/scheduledTask' {
  export interface ScheduledTaskInput {
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

  export interface ScheduledTask {
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
}

export interface OpenClawInstance {
  id: string;
  name: string;
  status: OpenClawInstanceStatus;
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

// Default implementation using OpenClawTeamManager
const defaultDeps: RouterDeps = {
  getInstances: () => getOpenClawTeamManager().listInstances(),
  getInstance: (instanceId: string) => getOpenClawTeamManager().getInstance(instanceId) || undefined,
  getTaskAssignmentHistory: () => [], // TODO: Implement history tracking
};

export class ScheduledTaskInstanceRouter {
  private readonly deps: RouterDeps;
  private roundRobinIndex = 0;
  private taskInstanceCache = new Map<string, string>(); // taskId -> instanceId

  constructor(deps: RouterDeps = defaultDeps) {
    this.deps = deps;
  }

  /**
   * 为任务选择合适的实例
   */
  async selectInstanceForTask(
    task: ScheduledTask | ScheduledTaskInput
  ): Promise<OpenClawInstance> {
    const teamConfig = (task as any).openclawTeam;
    const strategy = teamConfig?.assignmentStrategy || 'round-robin';

    let selectedInstance: OpenClawInstance | undefined | null;

    // 手动选择策略单独处理
    if (strategy === 'manual') {
      selectedInstance = this.selectManual(teamConfig?.instanceId);
    } else {
      // 其他策略统一使用OpenClawTeamManager的调度逻辑
      const teamManager = getOpenClawTeamManager();

      // 策略名称映射
      const teamStrategy: SchedulingStrategy =
        strategy === 'capability-based' ? 'capability-match' :
        strategy as SchedulingStrategy;

      selectedInstance = teamManager.selectInstanceForScheduledTask(task, teamStrategy);
    }

    if (!selectedInstance) {
      // 回退到默认策略
      const teamManager = getOpenClawTeamManager();
      selectedInstance = teamManager.selectInstanceForScheduledTask(task, 'round-robin');
    }

    if (!selectedInstance) {
      throw new Error('No available OpenClaw instance for task');
    }

    // 缓存选择结果
    if ('id' in task) {
      this.taskInstanceCache.set(task.id, selectedInstance.id);
    }

    return selectedInstance;
  }

  /**
   * 手动选择实例
   */
  private selectManual(instanceId?: string): OpenClawInstance | undefined {
    if (!instanceId) return undefined;

    const teamManager = getOpenClawTeamManager();
    const instance = teamManager.getInstance(instanceId);
    if (instance && (instance.status === 'idle' || instance.status === 'busy')) {
      return instance;
    }
    return undefined;
  }

  /**
   * 轮询选择
   */
  private selectRoundRobin(): OpenClawInstance | undefined {
    const healthyInstances = this.getHealthyInstances();
    if (healthyInstances.length === 0) return undefined;

    const index = this.roundRobinIndex % healthyInstances.length;
    this.roundRobinIndex++;
    return healthyInstances[index];
  }

  /**
   * 最少负载选择
   */
  private selectLeastLoaded(): OpenClawInstance | undefined {
    const healthyInstances = this.getHealthyInstances();
    if (healthyInstances.length === 0) return undefined;

    return healthyInstances.reduce((least, current) => {
      const currentLoad = current.stats?.activeSessions || 0;
      const leastLoad = least.stats?.activeSessions || 0;
      return currentLoad < leastLoad ? current : least;
    });
  }

  /**
   * 基于能力匹配选择
   */
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
      const instanceCaps = instance.capabilities;
      if (!instanceCaps || instanceCaps.length === 0) return false;

      // 处理字符串能力标签和结构化能力对象
      const isStringCapability = (cap: string | OpenClawInstanceCapability): cap is string =>
        typeof cap === 'string';
      const isStructCapability = (cap: string | OpenClawInstanceCapability): cap is OpenClawInstanceCapability =>
        typeof cap === 'object' && cap !== null;

      // 收集所有能力值
      const allModels: string[] = [];
      const allSkills: string[] = [];
      const allPlatforms: string[] = [];
      let maxMemoryMB = 0;

      for (const cap of instanceCaps) {
        if (isStringCapability(cap)) {
          // 字符串能力统一加入技能列表
          allSkills.push(cap);
        } else if (isStructCapability(cap)) {
          // 结构化能力提取各个字段
          if (cap.models) allModels.push(...cap.models);
          if (cap.skills) allSkills.push(...cap.skills);
          if (cap.platforms) allPlatforms.push(...cap.platforms);
          if (cap.resourceLimits?.maxMemoryMB) {
            maxMemoryMB = Math.max(maxMemoryMB, cap.resourceLimits.maxMemoryMB);
          }
        }
      }

      // 检查模型要求
      if (requirements.models?.length) {
        const hasRequiredModel = requirements.models.some(m => allModels.includes(m));
        if (!hasRequiredModel) return false;
      }

      // 检查技能要求
      if (requirements.skills?.length) {
        const hasRequiredSkill = requirements.skills.some(s => allSkills.includes(s));
        if (!hasRequiredSkill) return false;
      }

      // 检查平台要求
      if (requirements.platforms?.length) {
        const hasRequiredPlatform = requirements.platforms.some(p => allPlatforms.includes(p));
        if (!hasRequiredPlatform) return false;
      }

      // 检查内存要求
      if (requirements.minMemoryMB) {
        if (maxMemoryMB < requirements.minMemoryMB) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 基于亲和性标签选择
   */
  private selectByAffinityTag(tags?: string[]): OpenClawInstance | undefined {
    if (!tags || tags.length === 0) {
      return this.selectRoundRobin();
    }

    const healthyInstances = this.getHealthyInstances();

    // 计算匹配分数
    const scoredInstances = healthyInstances.map(instance => {
      const instanceCaps = instance.capabilities || [];
      const allTags: string[] = [];

      // 处理两种能力格式的标签
      for (const cap of instanceCaps) {
        if (typeof cap === 'string') {
          allTags.push(cap);
        } else if (typeof cap === 'object' && cap !== null && cap.tags) {
          allTags.push(...cap.tags);
        }
      }

      const matchCount = tags.filter(tag =>
        allTags.includes(tag)
      ).length;
      return { instance, score: matchCount };
    });

    // 返回分数最高的实例
    scoredInstances.sort((a, b) => b.score - a.score);
    return scoredInstances[0]?.instance;
  }

  /**
   * 获取健康的实例列表
   */
  private getHealthyInstances(): OpenClawInstance[] {
    const teamManager = getOpenClawTeamManager();
    return teamManager.listInstances().filter(
      instance => instance.status === 'idle' || instance.status === 'busy'
    );
  }

  /**
   * 获取任务缓存的实例
   */
  getCachedInstanceForTask(taskId: string): string | undefined {
    return this.taskInstanceCache.get(taskId);
  }

  /**
   * 清除任务缓存
   */
  clearTaskCache(taskId: string): void {
    this.taskInstanceCache.delete(taskId);
  }

  /**
   * 清除所有缓存
   */
  clearAllCaches(): void {
    this.taskInstanceCache.clear();
  }
}
