import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskInstanceSelector from './TaskInstanceSelector';
import type { ScheduledTaskTeamConfig } from '../../types/scheduledTask';
import type { OpenClawInstance } from '../../types/openClawTeam';

// Mock electron API
vi.stubGlobal('window', {
  electronAPI: {
    openClawTeam: {
      listInstances: vi.fn(),
    },
  },
});

const mockInstances: OpenClawInstance[] = [
  {
    id: 'instance-1',
    name: 'Instance 1',
    status: 'idle',
    type: 'general',
    capabilities: ['coding', 'analysis'],
    config: { maxConcurrentTasks: 5, envVars: {}, allowedTaskTypes: [] },
    stats: { currentTasks: 0, totalTasksCompleted: 10, totalTasksFailed: 1, avgTaskDurationMs: 1000 },
    createdAt: Date.now() - 86400000,
    lastHeartbeatAt: Date.now() - 1000,
  },
  {
    id: 'instance-2',
    name: 'Instance 2',
    status: 'busy',
    type: 'specialized',
    capabilities: ['coding', 'search'],
    config: { maxConcurrentTasks: 3, envVars: {}, allowedTaskTypes: [] },
    stats: { currentTasks: 2, totalTasksCompleted: 20, totalTasksFailed: 2, avgTaskDurationMs: 1500 },
    createdAt: Date.now() - 86400000,
    lastHeartbeatAt: Date.now() - 1000,
  },
  {
    id: 'instance-3',
    name: 'Instance 3',
    status: 'stopped',
    type: 'general',
    capabilities: [],
    config: { maxConcurrentTasks: 5, envVars: {}, allowedTaskTypes: [] },
    stats: { currentTasks: 0, totalTasksCompleted: 0, totalTasksFailed: 0, avgTaskDurationMs: 0 },
    createdAt: Date.now() - 86400000,
    lastHeartbeatAt: Date.now() - 3600000,
  },
];

describe('TaskInstanceSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window.electronAPI.openClawTeam.listInstances as vi.Mock).mockResolvedValue({
      success: true,
      instances: mockInstances,
    });
  });

  it('renders correctly with default props', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);

    // 等待实例加载
    await waitFor(() => {
      expect(screen.getByText('实例分配配置')).toBeInTheDocument();
    });

    // 检查默认策略是轮询
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    expect(strategySelect.value).toBe('round-robin');

    // 检查默认重试策略
    expect(screen.getByLabelText('最大重试次数')).toHaveValue('3');
    expect(screen.getByLabelText('重试延迟 (毫秒)')).toHaveValue('1000');
    expect(screen.getByLabelText('实例故障时自动转移到其他实例')).toBeChecked();
  });

  it('loads and displays instances correctly', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);

    // 切换到手动选择模式
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    fireEvent.change(strategySelect, { target: { value: 'manual' } });

    await waitFor(() => {
      const instanceSelect = screen.getByLabelText('目标实例') as HTMLSelectElement;
      expect(instanceSelect.options).toHaveLength(4); // 请选择 + 3个实例
      expect(instanceSelect.options[1].text).toContain('Instance 1 (空闲)');
      expect(instanceSelect.options[2].text).toContain('Instance 2 (繁忙)');
      expect(instanceSelect.options[3].text).toContain('Instance 3 (不可用)');
      expect(instanceSelect.options[3].disabled).toBe(true); // 停止的实例不可选
    });
  });

  it('shows strategy description when selecting different strategies', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;

    // 轮询
    fireEvent.change(strategySelect, { target: { value: 'round-robin' } });
    expect(screen.getByText('依次分配到各个实例，均衡任务分布')).toBeInTheDocument();

    // 最少负载
    fireEvent.change(strategySelect, { target: { value: 'least-loaded' } });
    expect(screen.getByText('分配到当前任务最少的实例，提高资源利用率')).toBeInTheDocument();

    // 能力匹配
    fireEvent.change(strategySelect, { target: { value: 'capability-based' } });
    expect(screen.getByText('自动匹配满足任务能力要求的实例')).toBeInTheDocument();
    expect(screen.getByText('模型要求')).toBeInTheDocument();
    expect(screen.getByText('技能要求')).toBeInTheDocument();
    expect(screen.getByText('平台要求')).toBeInTheDocument();

    // 亲和标签
    fireEvent.change(strategySelect, { target: { value: 'affinity-tag' } });
    expect(screen.getByText('优先分配到包含指定标签的实例')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入标签，按Enter添加')).toBeInTheDocument();

    // 手动选择
    fireEvent.change(strategySelect, { target: { value: 'manual' } });
    expect(screen.getByText('手动指定固定的运行实例')).toBeInTheDocument();
    expect(screen.getByLabelText('目标实例')).toBeInTheDocument();
  });

  it('handles affinity tag addition and removal correctly', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);

    // 切换到亲和标签模式
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    fireEvent.change(strategySelect, { target: { value: 'affinity-tag' } });

    const tagInput = screen.getByPlaceholderText('输入标签，按Enter添加') as HTMLInputElement;
    const addButton = screen.getByText('添加');

    // 添加标签
    fireEvent.change(tagInput, { target: { value: 'production' } });
    fireEvent.click(addButton);
    expect(screen.getByText('production')).toBeInTheDocument();

    // 添加重复标签不会生效
    fireEvent.change(tagInput, { target: { value: 'production' } });
    fireEvent.click(addButton);
    expect(screen.getAllByText('production')).toHaveLength(1);

    // 按Enter添加标签
    fireEvent.change(tagInput, { target: { value: 'high-memory' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    expect(screen.getByText('high-memory')).toBeInTheDocument();

    // 删除标签
    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText('production')).not.toBeInTheDocument();
  });

  it('handles capability requirements correctly', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);

    // 切换到能力匹配模式
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    fireEvent.change(strategySelect, { target: { value: 'capability-based' } });

    // 添加模型要求
    const modelInput = screen.getByPlaceholderText('输入模型名称，按Enter添加') as HTMLInputElement;
    fireEvent.change(modelInput, { target: { value: 'claude-3-opus' } });
    fireEvent.click(screen.getAllByText('添加')[0]);
    expect(screen.getByText('claude-3-opus')).toBeInTheDocument();

    // 添加技能要求
    const skillInput = screen.getByPlaceholderText('输入技能名称，按Enter添加') as HTMLInputElement;
    fireEvent.change(skillInput, { target: { value: 'python' } });
    fireEvent.click(screen.getAllByText('添加')[1]);
    expect(screen.getByText('python')).toBeInTheDocument();

    // 添加平台要求
    const platformInput = screen.getByPlaceholderText('输入平台名称，按Enter添加') as HTMLInputElement;
    fireEvent.change(platformInput, { target: { value: 'linux' } });
    fireEvent.click(screen.getAllByText('添加')[2]);
    expect(screen.getByText('linux')).toBeInTheDocument();

    // 设置内存要求
    const memoryInput = screen.getByPlaceholderText('输入最小内存大小') as HTMLInputElement;
    fireEvent.change(memoryInput, { target: { value: '4096' } });
    expect(memoryInput).toHaveValue('4096');
  });

  it('updates retry strategy correctly', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);

    const maxRetriesInput = screen.getByLabelText('最大重试次数') as HTMLInputElement;
    const retryDelayInput = screen.getByLabelText('重试延迟 (毫秒)') as HTMLInputElement;
    const failoverCheckbox = screen.getByLabelText('实例故障时自动转移到其他实例') as HTMLInputElement;

    // 修改重试次数
    fireEvent.change(maxRetriesInput, { target: { value: '5' } });
    expect(maxRetriesInput).toHaveValue('5');

    // 修改重试延迟
    fireEvent.change(retryDelayInput, { target: { value: '2000' } });
    expect(retryDelayInput).toHaveValue('2000');

    // 取消故障转移
    fireEvent.click(failoverCheckbox);
    expect(failoverCheckbox).not.toBeChecked();
  });

  it('triggers onChange with correct config when values change', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} />);

    // 切换到手动模式并选择实例
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    fireEvent.change(strategySelect, { target: { value: 'manual' } });

    await waitFor(() => {
      const instanceSelect = screen.getByLabelText('目标实例') as HTMLSelectElement;
      fireEvent.change(instanceSelect, { target: { value: 'instance-1' } });
    });

    // 修改重试策略
    const maxRetriesInput = screen.getByLabelText('最大重试次数') as HTMLInputElement;
    fireEvent.change(maxRetriesInput, { target: { value: '2' } });

    // 检查onChange被调用，并且包含正确的配置
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      assignmentStrategy: 'manual',
      instanceId: 'instance-1',
      retryStrategy: expect.objectContaining({
        maxRetries: 2,
        retryDelayMs: 1000,
        failoverToOtherInstance: true,
      }),
    }));
  });

  it('initializes with provided value correctly', async () => {
    const initialValue: ScheduledTaskTeamConfig = {
      assignmentStrategy: 'affinity-tag',
      affinityTags: ['prod', 'gpu'],
      retryStrategy: {
        maxRetries: 1,
        retryDelayMs: 5000,
        failoverToOtherInstance: false,
      },
    };

    render(<TaskInstanceSelector value={initialValue} onChange={mockOnChange} />);

    // 检查策略被正确初始化
    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    expect(strategySelect.value).toBe('affinity-tag');

    // 检查标签被正确加载
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(screen.getByText('gpu')).toBeInTheDocument();

    // 检查重试策略被正确初始化
    expect(screen.getByLabelText('最大重试次数')).toHaveValue('1');
    expect(screen.getByLabelText('重试延迟 (毫秒)')).toHaveValue('5000');
    expect(screen.getByLabelText('实例故障时自动转移到其他实例')).not.toBeChecked();
  });

  it('disables all inputs when disabled prop is true', async () => {
    render(<TaskInstanceSelector onChange={mockOnChange} disabled={true} />);

    const strategySelect = screen.getByLabelText('分配策略') as HTMLSelectElement;
    const maxRetriesInput = screen.getByLabelText('最大重试次数') as HTMLInputElement;
    const failoverCheckbox = screen.getByLabelText('实例故障时自动转移到其他实例') as HTMLInputElement;

    expect(strategySelect.disabled).toBe(true);
    expect(maxRetriesInput.disabled).toBe(true);
    expect(failoverCheckbox.disabled).toBe(true);
  });
});
