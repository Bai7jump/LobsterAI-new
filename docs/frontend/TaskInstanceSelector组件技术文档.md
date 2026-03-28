# TaskInstanceSelector 组件技术文档

## 1. 组件概述
TaskInstanceSelector 是 OpenClaw 团队模式下的前端核心组件，用于定时任务的实例分配配置，支持多种调度策略、能力匹配、亲和标签和重试策略配置。

## 2. 功能特性
### 2.1 调度策略支持
| 策略名称 | 说明 | 使用场景 |
|---------|------|---------|
| 轮询 (Round Robin) | 任务依次分配到各个实例，均衡负载 | 任务类型相似，需要均匀分布的场景 |
| 最少负载 (Least Loaded) | 优先分配到当前任务最少的实例 | 任务执行时间差异较大，需要提高资源利用率的场景 |
| 能力匹配 (Capability Based) | 自动匹配满足任务能力要求的实例 | 任务有特定的模型、技能、平台或资源要求的场景 |
| 亲和标签 (Affinity Tag) | 优先分配到包含指定标签的实例 | 需要将任务固定到具备特定属性的实例的场景 |
| 手动选择 (Manual) | 用户手动指定运行实例 | 测试、调试或需要固定运行位置的场景 |

### 2.2 核心功能
- **实例状态实时同步**：通过订阅 OpenClawTeam 事件，自动更新实例列表和状态
- **亲和标签管理**：支持动态添加/删除标签，按Enter快速添加
- **能力要求配置**：支持配置模型、技能、平台、最小内存等多维要求
- **重试策略配置**：支持最大重试次数、重试延迟、故障转移配置
- **表单校验**：自动校验配置项的合法性，提供友好的错误提示

## 3. 组件接口
### 3.1 Props
```typescript
interface TaskInstanceSelectorProps {
  value?: ScheduledTaskTeamConfig;  // 初始配置值
  onChange: (config: ScheduledTaskTeamConfig) => void;  // 配置变更回调
  disabled?: boolean;  // 是否禁用组件
}
```

### 3.2 输出数据结构
```typescript
interface ScheduledTaskTeamConfig {
  assignmentStrategy: TaskAssignmentStrategy;
  instanceId?: string;  // 手动模式下的实例ID
  affinityTags?: string[];  // 亲和标签模式下的标签列表
  capabilityRequirements?: {
    models?: string[];  // 要求的模型列表
    skills?: string[];  // 要求的技能列表
    platforms?: string[];  // 要求的平台列表
    minMemoryMB?: number;  // 最小内存要求（MB）
  };
  retryStrategy: {
    maxRetries: number;  // 最大重试次数
    retryDelayMs: number;  // 重试延迟（毫秒）
    failoverToOtherInstance: boolean;  // 是否允许故障转移
  };
}
```

## 4. 使用示例
### 4.1 基础使用
```tsx
import TaskInstanceSelector from './components/scheduledTasks/TaskInstanceSelector';
import type { ScheduledTaskTeamConfig } from './types/scheduledTask';

function App() {
  const [teamConfig, setTeamConfig] = useState<ScheduledTaskTeamConfig>({
    assignmentStrategy: 'round-robin',
    retryStrategy: {
      maxRetries: 3,
      retryDelayMs: 1000,
      failoverToOtherInstance: true,
    },
  });

  return (
    <TaskInstanceSelector
      value={teamConfig}
      onChange={setTeamConfig}
    />
  );
}
```

### 4.2 在TaskForm中集成
组件已自动集成到TaskForm表单中，当会话目标选择"isolated"时自动显示：
```tsx
{form.sessionTarget === 'isolated' && (
  <TaskInstanceSelector
    value={form.teamConfig}
    onChange={(teamConfig) => updateForm({ teamConfig })}
    disabled={submitting}
  />
)}
```

## 5. 依赖接口
### 5.1 IPC接口
| 接口名称 | 说明 |
|---------|------|
| `window.electronAPI.openClawTeam.listInstances()` | 获取实例列表 |
| `window.electronAPI.openClawTeam.onEvent()` | 订阅实例状态变更事件 |

### 5.2 事件类型
- `instance:updated`：实例状态更新时触发
- `instance:failed`：实例故障时触发

## 6. 技术实现
### 6.1 状态管理
组件内部使用React useState管理表单状态，包括：
- 分配策略选择
- 手动选择的实例ID
- 亲和标签列表
- 能力要求配置
- 重试策略配置

### 6.2 性能优化
- 实例列表只在组件初始化和状态变更时重新加载
- 表单变更使用防抖处理，避免频繁触发onChange
- 标签列表使用虚拟滚动（当标签数量超过20个时）

### 6.3 边界场景处理
- 无可用实例时显示提示信息
- 实例状态变更时自动刷新列表
- 禁用状态下所有输入控件不可操作
- 空输入和重复输入的校验拦截

## 7. 国际化
组件支持中英文双语，所有文本均通过i18nService管理，翻译Key前缀为`scheduledTasksInstance*`。

## 8. 维护说明
### 8.1 添加新的调度策略
1. 在`src/renderer/types/scheduledTask.ts`中扩展`TaskAssignmentStrategy`类型
2. 在`STRATEGY_OPTIONS`数组中添加新策略的翻译Key
3. 添加对应的配置表单UI逻辑
4. 更新后端对应调度逻辑

### 8.2 扩展能力要求维度
1. 在`ScheduledTaskTeamConfig`中添加新的能力字段
2. 在组件中添加对应的输入控件
3. 更新表单提交和回显逻辑
4. 同步更新后端能力匹配逻辑

## 9. 版本历史
| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-03-25 | 初始版本，支持5种调度策略和完整配置功能 | frontend-dev |
