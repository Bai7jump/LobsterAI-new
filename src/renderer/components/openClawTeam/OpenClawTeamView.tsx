import React, { useCallback, useEffect, useState } from 'react';
import type {
  OpenClawInstance,
  TeamTask,
  TeamConfig,
  OpenClawTeamEvent,
} from '../../types/openClawTeam';

const OpenClawTeamView: React.FC = () => {
  const [instances, setInstances] = useState<OpenClawInstance[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [config, setConfig] = useState<TeamConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [instancesRes, configRes, tasksRes] = await Promise.all([
        window.electron.openClawTeam.listInstances(),
        window.electron.openClawTeam.getConfig(),
        window.electron.openClawTeam.listTasks(),
      ]);

      if (instancesRes.instances) {
        setInstances(instancesRes.instances);
      }
      if (configRes.success && configRes.config) {
        setConfig(configRes.config);
      }
      if (tasksRes.success && tasksRes.tasks) {
        setTasks(tasksRes.tasks);
      }
    } catch (error) {
      console.error('[OpenClawTeam] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // 订阅事件
    window.electron.openClawTeam.subscribe();
    const unsubscribe = window.electron.openClawTeam.onEvent((event: OpenClawTeamEvent) => {
      console.log('[OpenClawTeam] Event received:', event);
      loadData();
    });

    return () => {
      window.electron.openClawTeam.unsubscribe();
      unsubscribe();
    };
  }, [loadData]);

  const handleStartInstance = useCallback(async (instanceId: string) => {
    try {
      await window.electron.openClawTeam.startInstance({ instanceId });
    } catch (error) {
      console.error('[OpenClawTeam] Failed to start instance:', error);
    }
  }, []);

  const handleStopInstance = useCallback(async (instanceId: string) => {
    try {
      await window.electron.openClawTeam.stopInstance({ instanceId });
    } catch (error) {
      console.error('[OpenClawTeam] Failed to stop instance:', error);
    }
  }, []);

  const handleCreateInstance = useCallback(async () => {
    if (!newInstanceName.trim()) return;

    try {
      await window.electron.openClawTeam.createInstance({
        name: newInstanceName.trim(),
        type: 'general',
        capabilities: [],
      });
      setNewInstanceName('');
      setCreateModalOpen(false);
    } catch (error) {
      console.error('[OpenClawTeam] Failed to create instance:', error);
    }
  }, [newInstanceName]);

  const handleToggleTeamEnabled = useCallback(async () => {
    if (!config) return;

    try {
      await window.electron.openClawTeam.updateConfig({
        config: { enabled: !config.enabled },
      });
    } catch (error) {
      console.error('[OpenClawTeam] Failed to update config:', error);
    }
  }, [config]);

  const getStatusColor = (status: OpenClawInstance['status']) => {
    switch (status) {
      case 'idle':
        return 'text-green-500';
      case 'busy':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      case 'starting':
        return 'text-blue-500';
      case 'stopped':
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: OpenClawInstance['status']) => {
    switch (status) {
      case 'idle':
        return '🟢';
      case 'busy':
        return '🟡';
      case 'error':
        return '🔴';
      case 'starting':
        return '🔵';
      case 'stopped':
      default:
        return '⚫';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="dark:text-claude-darkTextSecondary text-claude-textSecondary">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold dark:text-claude-darkText text-claude-text">
          🤖 OpenClaw 团队管理
        </h1>
        <div className="flex gap-2">
          {config && (
            <button
              onClick={handleToggleTeamEnabled}
              className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                config.enabled
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              {config.enabled ? '团队已启用' : '团队已禁用'}
            </button>
          )}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3 py-1 text-sm font-medium bg-claude-accent text-white rounded-lg hover:bg-claude-accentHover transition-colors"
          >
            + 添加实例
          </button>
        </div>
      </div>

      {/* Team Overview */}
      <div className="border dark:border-claude-darkBorder border-claude-border rounded-lg p-4">
        <h2 className="text-sm font-medium dark:text-claude-darkText text-claude-text mb-2">
          📊 团队概览
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">在线实例:</span>
            <span className="ml-2 font-medium dark:text-claude-darkText text-claude-text">
              {instances.filter((i) => i.status !== 'stopped').length}/{instances.length}
            </span>
          </div>
          <div>
            <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">运行中任务:</span>
            <span className="ml-2 font-medium dark:text-claude-darkText text-claude-text">
              {tasks.filter((t) => t.status === 'running').length}
            </span>
          </div>
          <div>
            <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">队列中:</span>
            <span className="ml-2 font-medium dark:text-claude-darkText text-claude-text">
              {tasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length}
            </span>
          </div>
          <div>
            <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">调度策略:</span>
            <span className="ml-2 font-medium dark:text-claude-darkText text-claude-text">
              {config?.schedulingStrategy || 'round-robin'}
            </span>
          </div>
        </div>
      </div>

      {/* Instances */}
      <div>
        <h2 className="text-sm font-medium dark:text-claude-darkText text-claude-text mb-3">
          实例列表
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="border dark:border-claude-darkBorder border-claude-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getStatusIcon(instance.status)}</span>
                  <h3 className="font-medium dark:text-claude-darkText text-claude-text">
                    {instance.name}
                  </h3>
                </div>
                <span className={`text-xs ${getStatusColor(instance.status)}`}>
                  {instance.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">当前任务:</span>
                  <span className="ml-1 font-medium dark:text-claude-darkText text-claude-text">
                    {instance.stats.currentTasks}/{instance.config.maxConcurrentTasks}
                  </span>
                </div>
                <div>
                  <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">已完成:</span>
                  <span className="ml-1 font-medium dark:text-claude-darkText text-claude-text">
                    {instance.stats.totalTasksCompleted}
                  </span>
                </div>
                {instance.stats.memoryUsageMB !== undefined && (
                  <div>
                    <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">内存:</span>
                    <span className="ml-1 font-medium dark:text-claude-darkText text-claude-text">
                      {instance.stats.memoryUsageMB} MB
                    </span>
                  </div>
                )}
                {instance.stats.cpuUsagePercent !== undefined && (
                  <div>
                    <span className="dark:text-claude-darkTextSecondary text-claude-textSecondary">CPU:</span>
                    <span className="ml-1 font-medium dark:text-claude-darkText text-claude-text">
                      {instance.stats.cpuUsagePercent}%
                    </span>
                  </div>
                )}
              </div>

              {instance.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {instance.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {instance.status === 'stopped' && (
                  <button
                    onClick={() => handleStartInstance(instance.id)}
                    className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                  >
                    启动
                  </button>
                )}
                {(instance.status === 'idle' || instance.status === 'busy') && (
                  <button
                    onClick={() => handleStopInstance(instance.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  >
                    停止
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <div>
          <h2 className="text-sm font-medium dark:text-claude-darkText text-claude-text mb-3">
            任务队列
          </h2>
          <div className="border dark:border-claude-darkBorder border-claude-border rounded-lg divide-y dark:divide-claude-darkBorder divide-claude-border">
            {tasks.map((task) => (
              <div key={task.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      task.status === 'running'
                        ? 'bg-yellow-500'
                        : task.status === 'completed'
                          ? 'bg-green-500'
                          : task.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm dark:text-claude-darkText text-claude-text">
                      任务 {task.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
                      {task.status}
                      {task.assignedTo && ` • 分配至: ${task.assignedTo.slice(0, 8)}...`}
                    </p>
                  </div>
                </div>
                <span className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
                  优先级: {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Instance Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-claude-darkSurface rounded-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-lg font-semibold dark:text-claude-darkText text-claude-text mb-4">
              添加实例
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium dark:text-claude-darkText text-claude-text mb-1">
                实例名称
              </label>
              <input
                type="text"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="w-full rounded-lg border dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkSurface bg-white px-3 py-2 text-sm dark:text-claude-darkText text-claude-text focus:outline-none focus:ring-2 focus:ring-claude-accent/50"
                placeholder="输入实例名称"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={!newInstanceName.trim()}
                className="px-4 py-2 text-sm font-medium bg-claude-accent text-white rounded-lg hover:bg-claude-accentHover transition-colors disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenClawTeamView;
