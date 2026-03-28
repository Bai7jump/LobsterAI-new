import { app } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { OpenClawEngineManager, type OpenClawEngineStatus, type OpenClawGatewayConnectionInfo } from './openclawEngineManager';
import type { OpenClawInstance } from '../../renderer/types/openClawTeam';

const DEFAULT_INSTANCE_BASE_DIR = 'openclaw-team/instances';
const INSTANCE_CONFIG_FILE = 'instance-config.json';

export interface PoolInstanceConfig {
  id: string;
  name: string;
  type: 'general' | 'specialized';
  capabilities: string[];
  maxConcurrentTasks: number;
  envVars: Record<string, string>;
}

export interface PoolInstance extends PoolInstanceConfig {
  manager: OpenClawEngineManager;
  status: OpenClawEngineStatus;
  connectionInfo: OpenClawGatewayConnectionInfo | null;
  currentTasks: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface InstancePoolStats {
  totalInstances: number;
  runningInstances: number;
  idleInstances: number;
  erroredInstances: number;
  totalTasks: number;
  avgLoadPercentage: number;
}

interface OpenClawInstancePoolEvents {
  'instance:added': (instance: PoolInstance) => void;
  'instance:removed': (instanceId: string) => void;
  'instance:status-changed': (instanceId: string, status: OpenClawEngineStatus) => void;
  'pool:stats-changed': (stats: InstancePoolStats) => void;
}

export class OpenClawInstancePool extends EventEmitter {
  private readonly baseDir: string;
  private instances: Map<string, PoolInstance> = new Map();
  private instanceConfigCache: Map<string, PoolInstanceConfig> = new Map();

  constructor() {
    super();
    const userDataPath = app.getPath('userData');
    this.baseDir = path.join(userDataPath, DEFAULT_INSTANCE_BASE_DIR);
    this.ensureBaseDir();
  }

  override on<U extends keyof OpenClawInstancePoolEvents>(
    event: U,
    listener: OpenClawInstancePoolEvents[U],
  ): this {
    return super.on(event, listener);
  }

  override emit<U extends keyof OpenClawInstancePoolEvents>(
    event: U,
    ...args: Parameters<OpenClawInstancePoolEvents[U]>
  ): boolean {
    return super.emit(event, ...args);
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getInstanceDir(instanceId: string): string {
    return path.join(this.baseDir, instanceId);
  }

  private getInstanceConfigPath(instanceId: string): string {
    return path.join(this.getInstanceDir(instanceId), INSTANCE_CONFIG_FILE);
  }

  private saveInstanceConfig(config: PoolInstanceConfig): void {
    const instanceDir = this.getInstanceDir(config.id);
    if (!fs.existsSync(instanceDir)) {
      fs.mkdirSync(instanceDir, { recursive: true });
    }
    fs.writeFileSync(
      this.getInstanceConfigPath(config.id),
      JSON.stringify(config, null, 2),
      'utf8'
    );
    this.instanceConfigCache.set(config.id, config);
  }

  private loadInstanceConfig(instanceId: string): PoolInstanceConfig | null {
    if (this.instanceConfigCache.has(instanceId)) {
      return this.instanceConfigCache.get(instanceId)!;
    }

    const configPath = this.getInstanceConfigPath(instanceId);
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as PoolInstanceConfig;
      this.instanceConfigCache.set(instanceId, config);
      return config;
    } catch {
      return null;
    }
  }

  private deleteInstanceConfig(instanceId: string): void {
    const configPath = this.getInstanceConfigPath(instanceId);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    this.instanceConfigCache.delete(instanceId);

    // Clean up empty instance directory
    const instanceDir = this.getInstanceDir(instanceId);
    if (fs.existsSync(instanceDir) && fs.readdirSync(instanceDir).length === 0) {
      fs.rmdirSync(instanceDir);
    }
  }

  /**
   * Create a new instance in the pool
   */
  async createInstance(config: Omit<PoolInstanceConfig, 'id'> & { id?: string }): Promise<PoolInstance> {
    const instanceId = config.id || crypto.randomUUID();
    const instanceConfig: PoolInstanceConfig = {
      id: instanceId,
      name: config.name,
      type: config.type || 'general',
      capabilities: config.capabilities || [],
      maxConcurrentTasks: config.maxConcurrentTasks || 2,
      envVars: config.envVars || {},
    };

    // Create isolated manager for this instance
    const manager = new OpenClawEngineManager();

    // Override the base dir to isolate instance state
    const instanceBaseDir = this.getInstanceDir(instanceId);
    (manager as any).baseDir = instanceBaseDir;
    (manager as any).logsDir = path.join(instanceBaseDir, 'logs');
    (manager as any).stateDir = path.join(instanceBaseDir, 'state');
    (manager as any).gatewayTokenPath = path.join(instanceBaseDir, 'state', 'gateway-token');
    (manager as any).gatewayPortPath = path.join(instanceBaseDir, 'state', 'gateway-port.json');
    (manager as any).gatewayLogPath = path.join(instanceBaseDir, 'logs', 'gateway.log');
    (manager as any).configPath = path.join(instanceBaseDir, 'state', 'openclaw.json');

    // Ensure directories exist
    if (!fs.existsSync((manager as any).logsDir)) {
      fs.mkdirSync((manager as any).logsDir, { recursive: true });
    }
    if (!fs.existsSync((manager as any).stateDir)) {
      fs.mkdirSync((manager as any).stateDir, { recursive: true });
    }

    // Set custom env vars
    manager.setSecretEnvVars(instanceConfig.envVars);

    const instance: PoolInstance = {
      ...instanceConfig,
      manager,
      status: manager.getStatus(),
      connectionInfo: null,
      currentTasks: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    // Save config and add to pool
    this.saveInstanceConfig(instanceConfig);
    this.instances.set(instanceId, instance);

    // Listen for status changes
    manager.on('status', (status) => {
      instance.status = status;
      this.emit('instance:status-changed', instanceId, status);
      this.emitPoolStats();
    });

    this.emit('instance:added', instance);
    this.emitPoolStats();

    return instance;
  }

  /**
   * Remove an instance from the pool
   */
  async removeInstance(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    // Stop the instance first
    await instance.manager.stopGateway();

    // Clean up
    this.instances.delete(instanceId);
    this.deleteInstanceConfig(instanceId);

    this.emit('instance:removed', instanceId);
    this.emitPoolStats();

    return true;
  }

  /**
   * Get an instance by ID
   */
  getInstance(instanceId: string): PoolInstance | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * List all instances in the pool
   */
  listInstances(): PoolInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * List running instances
   */
  listRunningInstances(): PoolInstance[] {
    return Array.from(this.instances.values()).filter(
      (i) => i.status.phase === 'running'
    );
  }

  /**
   * List idle instances (running and not at max capacity)
   */
  listIdleInstances(): PoolInstance[] {
    return this.listRunningInstances().filter(
      (i) => i.currentTasks < i.maxConcurrentTasks
    );
  }

  /**
   * Start an instance
   */
  async startInstance(instanceId: string): Promise<OpenClawEngineStatus> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const status = await instance.manager.startGateway();
    if (status.phase === 'running') {
      instance.connectionInfo = instance.manager.getGatewayConnectionInfo();
    }

    instance.lastUsedAt = Date.now();
    this.emitPoolStats();

    return status;
  }

  /**
   * Stop an instance
   */
  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    await instance.manager.stopGateway();
    instance.connectionInfo = null;
    this.emitPoolStats();
  }

  /**
   * Restart an instance
   */
  async restartInstance(instanceId: string): Promise<OpenClawEngineStatus> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const status = await instance.manager.restartGateway();
    if (status.phase === 'running') {
      instance.connectionInfo = instance.manager.getGatewayConnectionInfo();
    }

    instance.lastUsedAt = Date.now();
    this.emitPoolStats();

    return status;
  }

  /**
   * Acquire an instance for task execution
   */
  acquireInstance(strategy: 'round-robin' | 'least-loaded' | 'capability-match' = 'round-robin', requiredCapabilities?: string[]): PoolInstance | null {
    const idleInstances = this.listIdleInstances();
    if (idleInstances.length === 0) return null;

    let selectedInstance: PoolInstance | null = null;

    switch (strategy) {
      case 'least-loaded':
        selectedInstance = idleInstances.sort((a, b) => a.currentTasks - b.currentTasks)[0];
        break;

      case 'capability-match':
        if (requiredCapabilities && requiredCapabilities.length > 0) {
          selectedInstance = idleInstances.find((instance) =>
            requiredCapabilities.every((cap) => instance.capabilities.includes(cap))
          ) || idleInstances[0];
        } else {
          selectedInstance = idleInstances[0];
        }
        break;

      case 'round-robin':
      default:
        // Simple round-robin: return first idle instance
        selectedInstance = idleInstances[0];
        break;
    }

    if (selectedInstance) {
      selectedInstance.currentTasks++;
      selectedInstance.lastUsedAt = Date.now();
      this.emitPoolStats();
    }

    return selectedInstance;
  }

  /**
   * Release an instance after task completion
   */
  releaseInstance(instanceId: string, taskSuccess: boolean): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    instance.currentTasks = Math.max(0, instance.currentTasks - 1);
    if (taskSuccess) {
      instance.totalTasksCompleted++;
    } else {
      instance.totalTasksFailed++;
    }

    this.emitPoolStats();
  }

  /**
   * Get pool statistics
   */
  getStats(): InstancePoolStats {
    const instances = Array.from(this.instances.values());
    const runningInstances = instances.filter((i) => i.status.phase === 'running');
    const erroredInstances = instances.filter((i) => i.status.phase === 'error');
    const totalTasks = instances.reduce((sum, i) => sum + i.currentTasks, 0);
    const totalCapacity = runningInstances.reduce((sum, i) => sum + i.maxConcurrentTasks, 0);
    const avgLoadPercentage = totalCapacity > 0 ? Math.round((totalTasks / totalCapacity) * 100) : 0;

    return {
      totalInstances: instances.length,
      runningInstances: runningInstances.length,
      idleInstances: this.listIdleInstances().length,
      erroredInstances: erroredInstances.length,
      totalTasks,
      avgLoadPercentage,
    };
  }

  private emitPoolStats(): void {
    this.emit('pool:stats-changed', this.getStats());
  }

  /**
   * Shutdown all instances
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.instances.values()).map(
      (instance) => instance.manager.stopGateway()
    );
    await Promise.allSettled(shutdownPromises);
    this.instances.clear();
  }

  /**
   * Load persisted instances from disk
   */
  async loadPersistedInstances(): Promise<PoolInstance[]> {
    if (!fs.existsSync(this.baseDir)) return [];

    const instanceIds = fs.readdirSync(this.baseDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const loadedInstances: PoolInstance[] = [];

    for (const instanceId of instanceIds) {
      const config = this.loadInstanceConfig(instanceId);
      if (config) {
        const instance = await this.createInstance(config);
        loadedInstances.push(instance);
      }
    }

    return loadedInstances;
  }
}

// Singleton instance
let poolInstance: OpenClawInstancePool | null = null;

export function getOpenClawInstancePool(): OpenClawInstancePool {
  if (!poolInstance) {
    poolInstance = new OpenClawInstancePool();
  }
  return poolInstance;
}
