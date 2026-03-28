/**
 * OpenClaw Team Instance Management Test Helper
 */
import type { OpenClawInstance } from '../../src/renderer/types/openClawTeam';

// IPC handler mock/wrapper (to be implemented with actual IPC calls)
const ipc = {
  invoke: async (channel: string, ...args: any[]) => {
    // Actual implementation will call electron.ipcRenderer.invoke
    console.log(`IPC Invoke: ${channel}`, args);
    return { success: true };
  }
};

/**
 * Create a test instance with predefined configurations
 */
export async function createTestInstance(
  name: string,
  type: 'general' | 'specialized' = 'general',
  capabilities: string[] = [],
  maxConcurrentTasks: number = 2
): Promise<OpenClawInstance> {
  const response = await ipc.invoke('openClawTeam:createInstance', {
    name,
    type,
    capabilities,
    config: {
      maxConcurrentTasks
    }
  });

  if (!response.success) {
    throw new Error(`Failed to create instance: ${response.error}`);
  }

  return response.instance;
}

/**
 * Start an instance
 */
export async function startInstance(instanceId: string): Promise<OpenClawInstance> {
  const response = await ipc.invoke('openClawTeam:startInstance', { instanceId });

  if (!response.success) {
    throw new Error(`Failed to start instance ${instanceId}: ${response.error}`);
  }

  return response.instance;
}

/**
 * Stop an instance
 */
export async function stopInstance(instanceId: string): Promise<void> {
  const response = await ipc.invoke('openClawTeam:stopInstance', { instanceId });

  if (!response.success) {
    throw new Error(`Failed to stop instance ${instanceId}: ${response.error}`);
  }
}

/**
 * Delete an instance
 */
export async function deleteInstance(instanceId: string): Promise<void> {
  const response = await ipc.invoke('openClawTeam:deleteInstance', { instanceId });

  if (!response.success) {
    throw new Error(`Failed to delete instance ${instanceId}: ${response.error}`);
  }
}

/**
 * List all instances
 */
export async function listInstances(): Promise<OpenClawInstance[]> {
  const response = await ipc.invoke('openClawTeam:listInstances');
  return response.instances || [];
}

/**
 * Get instance by ID
 */
export async function getInstance(instanceId: string): Promise<OpenClawInstance | null> {
  const instances = await listInstances();
  return instances.find(i => i.id === instanceId) || null;
}

/**
 * Wait for instance to reach expected status
 */
export async function waitForInstanceStatus(
  instanceId: string,
  expectedStatus: OpenClawInstance['status'],
  timeoutMs: number = 30000
): Promise<OpenClawInstance> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const instance = await getInstance(instanceId);
    if (instance && instance.status === expectedStatus) {
      return instance;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Instance ${instanceId} did not reach status ${expectedStatus} within ${timeoutMs}ms`);
}

/**
 * Setup standard test instance pool (4 instances)
 */
export async function setupStandardInstancePool(): Promise<OpenClawInstance[]> {
  const instances: OpenClawInstance[] = [];

  // Create 2 general instances
  instances.push(await createTestInstance('General Instance 1', 'general', ['coding', 'analysis'], 2));
  instances.push(await createTestInstance('General Instance 2', 'general', ['coding', 'analysis'], 2));

  // Create 2 specialized instances
  instances.push(await createTestInstance('Python Specialist', 'specialized', ['coding', 'python', 'testing'], 1));
  instances.push(await createTestInstance('Data Analyst', 'specialized', ['analysis', 'reporting', 'visualization'], 1));

  // Start all instances
  for (const instance of instances) {
    await startInstance(instance.id);
    await waitForInstanceStatus(instance.id, 'idle');
  }

  return instances;
}

/**
 * Cleanup all test instances
 */
export async function cleanupAllInstances(): Promise<void> {
  const instances = await listInstances();

  for (const instance of instances) {
    if (instance.status !== 'stopped') {
      await stopInstance(instance.id);
      await waitForInstanceStatus(instance.id, 'stopped');
    }
    await deleteInstance(instance.id);
  }
}
