import React, { useEffect, useState, useCallback, useRef } from 'react';
import { i18nService } from '../../services/i18n';
import type {
  TaskAssignmentStrategy,
  ScheduledTaskTeamConfig,
  OpenClawInstanceCapability,
} from '../../types/scheduledTask';
import type { OpenClawInstance } from '../../types/openClawTeam';

interface TaskInstanceSelectorProps {
  value?: ScheduledTaskTeamConfig;
  onChange: (config: ScheduledTaskTeamConfig) => void;
  disabled?: boolean;
}

interface FormState {
  assignmentStrategy: TaskAssignmentStrategy;
  selectedInstanceId: string;
  affinityTags: string[];
  newAffinityTag: string;
  requiredModels: string[];
  newRequiredModel: string;
  requiredSkills: string[];
  newRequiredSkill: string;
  requiredPlatforms: string[];
  newRequiredPlatform: string;
  minMemoryMB: string;
  maxRetries: string;
  retryDelayMs: string;
  failoverToOtherInstance: boolean;
}

const DEFAULT_FORM_STATE: FormState = {
  assignmentStrategy: 'round-robin',
  selectedInstanceId: '',
  affinityTags: [],
  newAffinityTag: '',
  requiredModels: [],
  newRequiredModel: '',
  requiredSkills: [],
  newRequiredSkill: '',
  requiredPlatforms: [],
  newRequiredPlatform: '',
  minMemoryMB: '',
  maxRetries: '3',
  retryDelayMs: '1000',
  failoverToOtherInstance: true,
};

const STRATEGY_OPTIONS: Array<{ value: TaskAssignmentStrategy; label: string }> = [
  { value: 'round-robin', label: 'scheduledTasksInstanceStrategyRoundRobin' },
  { value: 'least-loaded', label: 'scheduledTasksInstanceStrategyLeastLoaded' },
  { value: 'capability-based', label: 'scheduledTasksInstanceStrategyCapabilityBased' },
  { value: 'affinity-tag', label: 'scheduledTasksInstanceStrategyAffinityTag' },
  { value: 'manual', label: 'scheduledTasksInstanceStrategyManual' },
];

const TaskInstanceSelector: React.FC<TaskInstanceSelectorProps> = ({ value, onChange, disabled = false }) => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [instances, setInstances] = useState<OpenClawInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖处理onChange回调
  const debouncedOnChange = useCallback((config: ScheduledTaskTeamConfig) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(config);
    }, 300);
  }, [onChange]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 加载实例列表
  const loadInstances = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await window.electronAPI.openClawTeam.listInstances();
      if (response.success && response.instances) {
        setInstances(response.instances);
      } else {
        setLoadError(response.error || 'Failed to load instances');
      }
    } catch (error) {
      console.error('Failed to load instances:', error);
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadInstances();

    // 订阅实例状态变更事件，实时更新实例列表
    const cleanupEventListener = window.electronAPI.openClawTeam.onEvent((event) => {
      if (event.type === 'instance:updated' || event.type === 'instance:failed') {
        void loadInstances();
      }
    });

    return () => {
      cancelled = true;
      cleanupEventListener();
    };
  }, [loadInstances]);

  // 从props初始化表单
  useEffect(() => {
    if (!value) return;

    setForm((current) => ({
      ...current,
      assignmentStrategy: value.assignmentStrategy || 'round-robin',
      selectedInstanceId: value.instanceId || '',
      affinityTags: value.affinityTags || [],
      requiredModels: value.capabilityRequirements?.models || [],
      requiredSkills: value.capabilityRequirements?.skills || [],
      requiredPlatforms: value.capabilityRequirements?.platforms || [],
      minMemoryMB: value.capabilityRequirements?.minMemoryMB ? String(value.capabilityRequirements.minMemoryMB) : '',
      maxRetries: value.retryStrategy?.maxRetries ? String(value.retryStrategy.maxRetries) : '3',
      retryDelayMs: value.retryStrategy?.retryDelayMs ? String(value.retryStrategy.retryDelayMs) : '1000',
      failoverToOtherInstance: value.retryStrategy?.failoverToOtherInstance ?? true,
    }));
  }, [value]);

  // 表单更新时触发onChange
  useEffect(() => {
    const config: ScheduledTaskTeamConfig = {
      assignmentStrategy: form.assignmentStrategy,
      ...(form.assignmentStrategy === 'manual' && form.selectedInstanceId ? { instanceId: form.selectedInstanceId } : {}),
      ...(form.assignmentStrategy === 'affinity-tag' ? { affinityTags: form.affinityTags } : {}),
      ...(form.assignmentStrategy === 'capability-based' ? {
        capabilityRequirements: {
          models: form.requiredModels.length > 0 ? form.requiredModels : undefined,
          skills: form.requiredSkills.length > 0 ? form.requiredSkills : undefined,
          platforms: form.requiredPlatforms.length > 0 ? form.requiredPlatforms : undefined,
          minMemoryMB: form.minMemoryMB ? Number.parseInt(form.minMemoryMB, 10) : undefined,
        },
      } : {}),
      retryStrategy: {
        maxRetries: Number.parseInt(form.maxRetries, 10),
        retryDelayMs: Number.parseInt(form.retryDelayMs, 10),
        failoverToOtherInstance: form.failoverToOtherInstance,
      },
    };

    debouncedOnChange(config);
  }, [form, debouncedOnChange]);

  const updateForm = (patch: Partial<FormState>) => {
    if (disabled) return;
    setForm((current) => ({ ...current, ...patch }));
  };

  const addAffinityTag = () => {
    if (!form.newAffinityTag.trim() || form.affinityTags.includes(form.newAffinityTag.trim())) return;
    updateForm({
      affinityTags: [...form.affinityTags, form.newAffinityTag.trim()],
      newAffinityTag: '',
    });
  };

  const removeAffinityTag = (tag: string) => {
    updateForm({
      affinityTags: form.affinityTags.filter((t) => t !== tag),
    });
  };

  const addRequiredModel = () => {
    if (!form.newRequiredModel.trim() || form.requiredModels.includes(form.newRequiredModel.trim())) return;
    updateForm({
      requiredModels: [...form.requiredModels, form.newRequiredModel.trim()],
      newRequiredModel: '',
    });
  };

  const removeRequiredModel = (model: string) => {
    updateForm({
      requiredModels: form.requiredModels.filter((m) => m !== model),
    });
  };

  const addRequiredSkill = () => {
    if (!form.newRequiredSkill.trim() || form.requiredSkills.includes(form.newRequiredSkill.trim())) return;
    updateForm({
      requiredSkills: [...form.requiredSkills, form.newRequiredSkill.trim()],
      newRequiredSkill: '',
    });
  };

  const removeRequiredSkill = (skill: string) => {
    updateForm({
      requiredSkills: form.requiredSkills.filter((s) => s !== skill),
    });
  };

  const addRequiredPlatform = () => {
    if (!form.newRequiredPlatform.trim() || form.requiredPlatforms.includes(form.newRequiredPlatform.trim())) return;
    updateForm({
      requiredPlatforms: [...form.requiredPlatforms, form.newRequiredPlatform.trim()],
      newRequiredPlatform: '',
    });
  };

  const removeRequiredPlatform = (platform: string) => {
    updateForm({
      requiredPlatforms: form.requiredPlatforms.filter((p) => p !== platform),
    });
  };

  const inputClass = 'w-full rounded-lg border dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkSurface bg-white px-3 py-2 text-sm dark:text-claude-darkText text-claude-text focus:outline-none focus:ring-2 focus:ring-claude-accent/50 disabled:opacity-50 disabled:cursor-not-allowed';
  const labelClass = 'block text-sm font-medium dark:text-claude-darkText text-claude-text mb-1';
  const tagClass = 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-claude-accent/10 text-claude-accent dark:bg-claude-accent/20';
  const tagRemoveClass = 'cursor-pointer hover:text-red-500';

  return (
    <div className="space-y-4 p-4 border dark:border-claude-darkBorder border-claude-border rounded-lg">
      <h3 className="text-md font-semibold dark:text-claude-darkText text-claude-text">
        {i18nService.t('scheduledTasksInstanceSelectorTitle')}
      </h3>

      {/* 分配策略选择 */}
      <div>
        <label className={labelClass}>{i18nService.t('scheduledTasksInstanceStrategy')}</label>
        <select
          value={form.assignmentStrategy}
          onChange={(e) => updateForm({ assignmentStrategy: e.target.value as TaskAssignmentStrategy })}
          className={inputClass}
          disabled={disabled || loading}
        >
          {STRATEGY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {i18nService.t(option.label)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {form.assignmentStrategy === 'round-robin' && '依次分配到各个实例，均衡任务分布'}
          {form.assignmentStrategy === 'least-loaded' && '分配到当前任务最少的实例，提高资源利用率'}
          {form.assignmentStrategy === 'capability-based' && '自动匹配满足任务能力要求的实例'}
          {form.assignmentStrategy === 'affinity-tag' && '优先分配到包含指定标签的实例'}
          {form.assignmentStrategy === 'manual' && '手动指定固定的运行实例'}
        </p>
      </div>

      {/* 手动选择实例 */}
      {form.assignmentStrategy === 'manual' && (
        <div>
          <label className={labelClass}>{i18nService.t('scheduledTasksInstanceSelectInstance')}</label>
          <select
            value={form.selectedInstanceId}
            onChange={(e) => updateForm({ selectedInstanceId: e.target.value })}
            className={inputClass}
            disabled={disabled || loading}
          >
            <option value="">{i18nService.t('scheduledTasksInstanceSelectInstancePlaceholder')}</option>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id} disabled={instance.status === 'stopped' || instance.status === 'error'}>
                {instance.name} ({instance.status === 'idle' ? i18nService.t('scheduledTasksInstanceStatusIdle') : instance.status === 'busy' ? i18nService.t('scheduledTasksInstanceStatusBusy') : i18nService.t('scheduledTasksInstanceStatusUnavailable')})
              </option>
            ))}
          </select>
          {loadError && (
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-red-500">加载实例失败: {loadError}</p>
              <button
                type="button"
                onClick={loadInstances}
                className="text-xs text-claude-accent hover:underline"
                disabled={loading}
              >
                重试
              </button>
            </div>
          )}
          {!loadError && instances.length === 0 && !loading && (
            <p className="text-xs text-yellow-500 mt-1">{i18nService.t('scheduledTasksInstanceNoInstancesAvailable')}</p>
          )}
        </div>
      )}

      {/* 亲和标签配置 */}
      {form.assignmentStrategy === 'affinity-tag' && (
        <div>
          <label className={labelClass}>{i18nService.t('scheduledTasksInstanceAffinityTags')}</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={form.newAffinityTag}
              onChange={(e) => updateForm({ newAffinityTag: e.target.value })}
              className={inputClass}
              placeholder={i18nService.t('scheduledTasksInstanceAffinityTagsPlaceholder')}
              disabled={disabled}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAffinityTag())}
            />
            <button
              type="button"
              onClick={addAffinityTag}
              className="px-3 py-2 text-sm font-medium bg-claude-accent text-white rounded-lg hover:bg-claude-accentHover transition-colors disabled:opacity-50"
              disabled={disabled || !form.newAffinityTag.trim()}
            >
              {i18nService.t('add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.affinityTags.slice(0, 5).map((tag) => (
              <span key={tag} className={tagClass}>
                {tag}
                <span className={tagRemoveClass} onClick={() => removeAffinityTag(tag)}>×</span>
              </span>
            ))}
            {form.affinityTags.length > 5 && (
              <span className={`${tagClass} cursor-help`} title={form.affinityTags.slice(5).join(', ')}>
                +{form.affinityTags.length - 5} more
              </span>
            )}
          </div>
          {form.affinityTags.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">{i18nService.t('scheduledTasksInstanceAffinityTagsHelp')}</p>
          )}
        </div>
      )}

      {/* 能力要求配置 */}
      {form.assignmentStrategy === 'capability-based' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{i18nService.t('scheduledTasksInstanceCapabilityRequirementsHelp')}</p>

          {/* 模型要求 */}
          <div>
            <label className={labelClass}>{i18nService.t('scheduledTasksInstanceRequiredModels')}</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={form.newRequiredModel}
                onChange={(e) => updateForm({ newRequiredModel: e.target.value })}
                className={inputClass}
                placeholder={i18nService.t('scheduledTasksInstanceRequiredModelsPlaceholder')}
                disabled={disabled}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequiredModel())}
              />
              <button
                type="button"
                onClick={addRequiredModel}
                className="px-3 py-2 text-sm font-medium bg-claude-accent text-white rounded-lg hover:bg-claude-accentHover transition-colors disabled:opacity-50"
                disabled={disabled || !form.newRequiredModel.trim()}
              >
                {i18nService.t('add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.requiredModels.slice(0, 5).map((model) => (
                <span key={model} className={tagClass}>
                  {model}
                  <span className={tagRemoveClass} onClick={() => removeRequiredModel(model)}>×</span>
                </span>
              ))}
              {form.requiredModels.length > 5 && (
                <span className={`${tagClass} cursor-help`} title={form.requiredModels.slice(5).join(', ')}>
                  +{form.requiredModels.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* 技能要求 */}
          <div>
            <label className={labelClass}>{i18nService.t('scheduledTasksInstanceRequiredSkills')}</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={form.newRequiredSkill}
                onChange={(e) => updateForm({ newRequiredSkill: e.target.value })}
                className={inputClass}
                placeholder={i18nService.t('scheduledTasksInstanceRequiredSkillsPlaceholder')}
                disabled={disabled}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequiredSkill())}
              />
              <button
                type="button"
                onClick={addRequiredSkill}
                className="px-3 py-2 text-sm font-medium bg-claude-accent text-white rounded-lg hover:bg-claude-accentHover transition-colors disabled:opacity-50"
                disabled={disabled || !form.newRequiredSkill.trim()}
              >
                {i18nService.t('add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.requiredSkills.slice(0, 5).map((skill) => (
                <span key={skill} className={tagClass}>
                  {skill}
                  <span className={tagRemoveClass} onClick={() => removeRequiredSkill(skill)}>×</span>
                </span>
              ))}
              {form.requiredSkills.length > 5 && (
                <span className={`${tagClass} cursor-help`} title={form.requiredSkills.slice(5).join(', ')}>
                  +{form.requiredSkills.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* 平台要求 */}
          <div>
            <label className={labelClass}>{i18nService.t('scheduledTasksInstanceRequiredPlatforms')}</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={form.newRequiredPlatform}
                onChange={(e) => updateForm({ newRequiredPlatform: e.target.value })}
                className={inputClass}
                placeholder={i18nService.t('scheduledTasksInstanceRequiredPlatformsPlaceholder')}
                disabled={disabled}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequiredPlatform())}
              />
              <button
                type="button"
                onClick={addRequiredPlatform}
                className="px-3 py-2 text-sm font-medium bg-claude-accent text-white rounded-lg hover:bg-claude-accentHover transition-colors disabled:opacity-50"
                disabled={disabled || !form.newRequiredPlatform.trim()}
              >
                {i18nService.t('add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.requiredPlatforms.slice(0, 5).map((platform) => (
                <span key={platform} className={tagClass}>
                  {platform}
                  <span className={tagRemoveClass} onClick={() => removeRequiredPlatform(platform)}>×</span>
                </span>
              ))}
              {form.requiredPlatforms.length > 5 && (
                <span className={`${tagClass} cursor-help`} title={form.requiredPlatforms.slice(5).join(', ')}>
                  +{form.requiredPlatforms.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* 内存要求 */}
          <div>
            <label className={labelClass}>{i18nService.t('scheduledTasksInstanceMinMemoryMB')}</label>
            <input
              type="number"
              min="0"
              value={form.minMemoryMB}
              onChange={(e) => updateForm({ minMemoryMB: e.target.value })}
              className={inputClass}
              placeholder={i18nService.t('scheduledTasksInstanceMinMemoryMBPlaceholder')}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* 重试策略配置 */}
      <div className="border-t dark:border-claude-darkBorder border-claude-border pt-4">
        <h4 className="text-sm font-medium dark:text-claude-darkText text-claude-text mb-3">
          {i18nService.t('scheduledTasksInstanceRetryStrategy')}
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
            (任务执行失败时的重试规则)
          </span>
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{i18nService.t('scheduledTasksInstanceMaxRetries')}</label>
            <input
              type="number"
              min="0"
              value={form.maxRetries}
              onChange={(e) => updateForm({ maxRetries: e.target.value })}
              className={inputClass}
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              最多重试次数，0表示不重试
            </p>
          </div>
          <div>
            <label className={labelClass}>{i18nService.t('scheduledTasksInstanceRetryDelayMs')}</label>
            <input
              type="number"
              min="0"
              value={form.retryDelayMs}
              onChange={(e) => updateForm({ retryDelayMs: e.target.value })}
              className={inputClass}
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              两次重试之间的等待时间（毫秒）
            </p>
          </div>
        </div>
        <div className="mt-3">
          <label className="inline-flex items-center gap-2 text-sm dark:text-claude-darkText text-claude-text">
            <input
              type="checkbox"
              checked={form.failoverToOtherInstance}
              onChange={(e) => updateForm({ failoverToOtherInstance: e.target.checked })}
              className="rounded border-claude-border dark:border-claude-darkBorder"
              disabled={disabled}
            />
            {i18nService.t('scheduledTasksInstanceFailoverToOtherInstance')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
            开启后如果当前实例故障，将自动尝试在其他可用实例上运行
          </p>
        </div>
      </div>
    </div>
  );
};

export default TaskInstanceSelector;
