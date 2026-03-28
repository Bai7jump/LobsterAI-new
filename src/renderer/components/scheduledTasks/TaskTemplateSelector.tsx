import React, { useMemo, useState } from 'react';
import { i18nService } from '../../services/i18n';
import type { TaskTemplate, TaskTemplateCategory } from '../../types/scheduledTask';

// 内置模板数据（与后端同步）
const TEMPLATE_CATEGORIES: TaskTemplateCategory[] = [
  { id: 'daily', name: 'Daily Routine' },
  { id: 'weekly', name: 'Weekly Reports' },
  { id: 'monitoring', name: 'Monitoring' },
  { id: 'productivity', name: 'Productivity' },
];

const TEMPLATES: TaskTemplate[] = [
  {
    id: 'daily-morning-briefing',
    name: 'Morning Briefing',
    description: 'Start your day with a personalized briefing',
    category: 'daily',
    icon: '☀️',
  },
  {
    id: 'daily-standup',
    name: 'Daily Standup Report',
    description: 'Prepare for team standup meetings (Mon-Fri)',
    category: 'daily',
    icon: '📋',
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Generate weekly summary and plan (Friday afternoons)',
    category: 'weekly',
    icon: '📊',
  },
  {
    id: 'end-of-day-review',
    name: 'End of Day Review',
    description: 'Reflect on the day and plan for tomorrow',
    category: 'daily',
    icon: '🌅',
  },
  {
    id: 'code-review-reminder',
    name: 'Code Review Reminder',
    description: 'Check for pending PRs and code reviews every 4 hours',
    category: 'productivity',
    icon: '👀',
  },
  {
    id: 'backup-reminder',
    name: 'Backup Reminder',
    description: 'Weekly reminder to backup important data',
    category: 'monitoring',
    icon: '💾',
  },
  {
    id: 'learning-time',
    name: 'Learning Time',
    description: 'Daily reminder for skill development',
    category: 'productivity',
    icon: '📚',
  },
  {
    id: 'system-health-check',
    name: 'System Health Check',
    description: 'Daily system health and resource check',
    category: 'monitoring',
    icon: '🩺',
  },
  {
    id: 'monthly-goal-review',
    name: 'Monthly Goal Review',
    description: 'Review and set monthly goals on the first day of each month',
    category: 'weekly',
    icon: '🎯',
  },
];

interface TaskTemplateSelectorProps {
  onSelectTemplate: (templateId: string) => void;
  onCancel: () => void;
}

const TaskTemplateSelector: React.FC<TaskTemplateSelectorProps> = ({
  onSelectTemplate,
  onCancel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return TEMPLATES;
    return TEMPLATES.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold dark:text-claude-darkText text-claude-text">
          {i18nService.t('scheduledTasksTemplatesTitle') || 'Choose a Template'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
        >
          {i18nService.t('cancel')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selectedCategory === 'all'
              ? 'bg-claude-accent text-white'
              : 'dark:text-claude-darkText text-claude-text hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover'
          }`}
        >
          {i18nService.t('scheduledTasksTemplatesAll') || 'All'}
        </button>
        {TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              selectedCategory === category.id
                ? 'bg-claude-accent text-white'
                : 'dark:text-claude-darkText text-claude-text hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template.id)}
            className="p-4 text-left rounded-xl border dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkSurface bg-white hover:border-claude-accent/50 dark:hover:border-claude-accent/50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium dark:text-claude-darkText text-claude-text group-hover:text-claude-accent transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary mt-1">
                  {template.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8">
          <p className="dark:text-claude-darkTextSecondary text-claude-textSecondary">
            {i18nService.t('scheduledTasksTemplatesNone') || 'No templates in this category'}
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskTemplateSelector;

export function getTemplateInput(templateId: string): Partial<{
  name: string;
  description: string;
  schedule: any;
  sessionTarget: 'main' | 'isolated';
  wakeMode: 'now' | 'next-heartbeat';
  payload: any;
  delivery: any;
}> {
  switch (templateId) {
    case 'daily-morning-briefing':
      return {
        name: 'Daily Morning Briefing',
        description: 'Generate a daily morning briefing',
        schedule: { kind: 'cron', expr: '0 8 * * *' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Please provide a morning briefing including:
1. A quick summary of today's date and day of week
2. Suggest 3 priority tasks for the day
3. A positive motivational quote
4. Remind me to check my calendar and emails

Keep it concise and friendly.`,
          timeoutSeconds: 300,
        },
        delivery: { mode: 'none' },
      };

    case 'daily-standup':
      return {
        name: 'Daily Standup Report',
        description: 'Prepare for team standup meetings',
        schedule: { kind: 'cron', expr: '0 9 * * 1-5' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Help me prepare a daily standup report. Please create a template with:

1. What I accomplished yesterday
2. What I plan to work on today
3. Any blockers or impediments
4. Quick status update on ongoing projects

Make it concise and suitable for a team standup meeting.`,
          timeoutSeconds: 300,
        },
        delivery: { mode: 'none' },
      };

    case 'weekly-report':
      return {
        name: 'Weekly Report',
        description: 'Generate a comprehensive weekly summary and plan',
        schedule: { kind: 'cron', expr: '0 17 * * 5' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Please help me create a weekly report. Include:

1. Week in review - key accomplishments
2. Metrics and progress towards goals
3. Challenges encountered and how they were addressed
4. Next week's priorities and plan
5. Any learnings or insights from this week

Make it professional but not overly formal.`,
          timeoutSeconds: 600,
        },
        delivery: { mode: 'none' },
      };

    case 'end-of-day-review':
      return {
        name: 'End of Day Review',
        description: 'Daily reflection and planning for tomorrow',
        schedule: { kind: 'cron', expr: '0 17 * * 1-5' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Let's do a quick end-of-day review.

Please help me reflect:
1. What went well today?
2. What could have gone better?
3. What did I learn?
4. What are the top 3 priorities for tomorrow?
5. Is there anything I need to follow up on?

Keep it concise - this should only take 5-10 minutes.`,
          timeoutSeconds: 300,
        },
        delivery: { mode: 'none' },
      };

    case 'code-review-reminder':
      return {
        name: 'Code Review Reminder',
        description: 'Check for pending code reviews and PRs',
        schedule: { kind: 'every', everyMs: 4 * 60 * 60 * 1000 },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Please check for any pending code reviews or pull requests that need attention.

This is a reminder to check your code review queue!`,
          timeoutSeconds: 300,
        },
        delivery: { mode: 'none' },
      };

    case 'backup-reminder':
      return {
        name: 'Backup Reminder',
        description: 'Regular reminder to backup important data',
        schedule: { kind: 'cron', expr: '0 20 * * 0' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `This is your regular backup reminder!

Please verify:
1. Important project files are backed up
2. Database backups are recent
3. Configuration files are version controlled
4. Any new documentation is saved

It's better to spend 5 minutes now than regret it later!`,
          timeoutSeconds: 120,
        },
        delivery: { mode: 'none' },
      };

    case 'learning-time':
      return {
        name: 'Learning Time',
        description: 'Daily reminder for skill development and learning',
        schedule: { kind: 'cron', expr: '0 18 * * 1-5' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Time for your daily learning session!

Suggestions for today:
1. Read one article about new technologies
2. Watch a short tutorial video
3. Experiment with a new library or tool
4. Review and refactor some old code
5. Document something you learned recently

Pick one and dive in for 15-30 minutes!`,
          timeoutSeconds: 300,
        },
        delivery: { mode: 'none' },
      };

    case 'system-health-check':
      return {
        name: 'System Health Check',
        description: 'Check system status and disk space',
        schedule: { kind: 'cron', expr: '0 10 * * *' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Please perform a system health check.

This is a reminder to manually check your system health!`,
          timeoutSeconds: 300,
        },
        delivery: { mode: 'none' },
      };

    case 'monthly-goal-review':
      return {
        name: 'Monthly Goal Review',
        description: 'Review monthly goals and progress',
        schedule: { kind: 'cron', expr: '0 9 1 * *' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `Let's review your monthly goals and progress.

Please help me with:
1. Review goals from last month
2. Assess what was accomplished
3. Identify any unfinished goals and why
4. Set goals for this month
5. Break down monthly goals into weekly milestones
6. Identify potential obstacles and how to address them

Make this thorough but actionable.`,
          timeoutSeconds: 900,
        },
        delivery: { mode: 'none' },
      };

    default:
      return {};
  }
}
