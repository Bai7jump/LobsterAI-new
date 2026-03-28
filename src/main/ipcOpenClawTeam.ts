import { ipcMain, type WebContents } from 'electron';
import { getOpenClawTeamManager } from './libs/openClawTeamManager';
import type {
  CreateInstanceRequest,
  CreateInstanceResponse,
  DeleteInstanceRequest,
  DeleteInstanceResponse,
  GetConfigResponse,
  GetTaskStatusRequest,
  GetTaskStatusResponse,
  ListInstancesResponse,
  ListTasksRequest,
  ListTasksResponse,
  StartInstanceRequest,
  StartInstanceResponse,
  StopInstanceRequest,
  StopInstanceResponse,
  SubmitTaskRequest,
  SubmitTaskResponse,
  UpdateConfigRequest,
  UpdateConfigResponse,
  OpenClawTeamEvent,
} from '../renderer/types/openClawTeam';

// 订阅事件的 webContents
const eventSubscribers = new Set<WebContents>();

function broadcastEvent(event: OpenClawTeamEvent): void {
  for (const subscriber of eventSubscribers) {
    if (!subscriber.isDestroyed()) {
      subscriber.send('openClawTeam:event', event);
    }
  }
}

export function registerOpenClawTeamIPC(): void {
  const teamManager = getOpenClawTeamManager();

  // 转发 TeamManager 的事件到前端
  teamManager.on('event', (event: OpenClawTeamEvent) => {
    broadcastEvent(event);
  });

  // ============ 实例管理 ============

  ipcMain.handle('openClawTeam:listInstances', async (): Promise<ListInstancesResponse> => {
    try {
      const instances = teamManager.listInstances();
      return { instances };
    } catch (error) {
      console.error('[OpenClawTeam] listInstances error:', error);
      return { instances: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(
    'openClawTeam:startInstance',
    async (_event, request: unknown): Promise<StartInstanceResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const { instanceId } = request as StartInstanceRequest;
        if (typeof instanceId !== 'string' || !instanceId.trim()) {
          return { success: false, error: 'Invalid parameter: instanceId must be a non-empty string' };
        }

        const instance = await teamManager.startInstance(instanceId);
        return { success: true, instance };
      } catch (error) {
        console.error('[OpenClawTeam] startInstance error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  ipcMain.handle(
    'openClawTeam:stopInstance',
    async (_event, request: unknown): Promise<StopInstanceResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const { instanceId } = request as StopInstanceRequest;
        if (typeof instanceId !== 'string' || !instanceId.trim()) {
          return { success: false, error: 'Invalid parameter: instanceId must be a non-empty string' };
        }

        await teamManager.stopInstance(instanceId);
        return { success: true };
      } catch (error) {
        console.error('[OpenClawTeam] stopInstance error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  ipcMain.handle(
    'openClawTeam:createInstance',
    async (_event, request: unknown): Promise<CreateInstanceResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const req = request as CreateInstanceRequest;
        if (typeof req.name !== 'string' || !req.name.trim()) {
          return { success: false, error: 'Invalid parameter: name must be a non-empty string' };
        }
        if (req.type && req.type !== 'general' && req.type !== 'specialized') {
          return { success: false, error: 'Invalid parameter: type must be general or specialized' };
        }
        if (req.capabilities && !Array.isArray(req.capabilities)) {
          return { success: false, error: 'Invalid parameter: capabilities must be an array' };
        }

        const instance = await teamManager.createInstance({
          name: req.name.trim(),
          type: req.type,
          capabilities: req.capabilities,
          config: req.config,
        });
        return { success: true, instance };
      } catch (error) {
        console.error('[OpenClawTeam] createInstance error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  ipcMain.handle(
    'openClawTeam:deleteInstance',
    async (_event, request: unknown): Promise<DeleteInstanceResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const { instanceId } = request as DeleteInstanceRequest;
        if (typeof instanceId !== 'string' || !instanceId.trim()) {
          return { success: false, error: 'Invalid parameter: instanceId must be a non-empty string' };
        }

        const deleted = await teamManager.deleteInstance(instanceId);
        return { success: deleted, error: deleted ? undefined : 'Instance not found' };
      } catch (error) {
        console.error('[OpenClawTeam] deleteInstance error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  // ============ 任务管理 ============

  ipcMain.handle(
    'openClawTeam:submitTask',
    async (_event, request: unknown): Promise<SubmitTaskResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const req = request as SubmitTaskRequest;
        if (!req.input || typeof req.input !== 'object') {
          return { success: false, error: 'Invalid parameter: input must be an object' };
        }
        if (req.scheduledTaskId !== undefined && typeof req.scheduledTaskId !== 'string') {
          return { success: false, error: 'Invalid parameter: scheduledTaskId must be a string' };
        }

        const task = await teamManager.submitTask(req.input, req.scheduledTaskId);
        return { success: true, task };
      } catch (error) {
        console.error('[OpenClawTeam] submitTask error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  ipcMain.handle(
    'openClawTeam:getTaskStatus',
    async (_event, request: unknown): Promise<GetTaskStatusResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const { taskId } = request as GetTaskStatusRequest;
        if (typeof taskId !== 'string' || !taskId.trim()) {
          return { success: false, error: 'Invalid parameter: taskId must be a non-empty string' };
        }

        const task = teamManager.getTaskStatus(taskId);
        return { success: true, task };
      } catch (error) {
        console.error('[OpenClawTeam] getTaskStatus error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  ipcMain.handle(
    'openClawTeam:listTasks',
    async (_event, request: unknown): Promise<ListTasksResponse> => {
      try {
        // 安全验证
        const req = (request || {}) as ListTasksRequest;
        if (req.filter && typeof req.filter !== 'object') {
          return { success: false, tasks: [], total: 0, error: 'Invalid parameter: filter must be an object' };
        }

        const result = teamManager.listTasks(req.filter);
        return { success: true, ...result };
      } catch (error) {
        console.error('[OpenClawTeam] listTasks error:', error);
        return { success: false, tasks: [], total: 0, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  // ============ 配置管理 ============

  ipcMain.handle('openClawTeam:getConfig', async (): Promise<GetConfigResponse> => {
    try {
      const config = teamManager.getConfig();
      return { success: true, config };
    } catch (error) {
      console.error('[OpenClawTeam] getConfig error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(
    'openClawTeam:updateConfig',
    async (_event, request: unknown): Promise<UpdateConfigResponse> => {
      try {
        // 安全验证
        if (!request || typeof request !== 'object') {
          return { success: false, error: 'Invalid request: must be an object' };
        }
        const { config } = request as UpdateConfigRequest;
        if (!config || typeof config !== 'object') {
          return { success: false, error: 'Invalid parameter: config must be an object' };
        }

        const updatedConfig = teamManager.updateConfig(config);
        return { success: true, config: updatedConfig };
      } catch (error) {
        console.error('[OpenClawTeam] updateConfig error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  // ============ 事件订阅 ============

  ipcMain.on('openClawTeam:subscribe', (event) => {
    const webContents = event.sender;
    eventSubscribers.add(webContents);

    // 清理断开连接的订阅者
    webContents.once('destroyed', () => {
      eventSubscribers.delete(webContents);
    });
  });

  ipcMain.on('openClawTeam:unsubscribe', (event) => {
    eventSubscribers.delete(event.sender);
  });
}
