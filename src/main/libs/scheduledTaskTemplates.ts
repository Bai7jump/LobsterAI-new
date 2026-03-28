import type { ScheduledTaskInput } from '../../renderer/types/scheduledTask';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  createInput: () => Partial<ScheduledTaskInput>;
}

const TEMPLATE_CATEGORIES = {
  daily: 'Daily Routine',
  weekly: 'Weekly Reports',
  monitoring: 'Monitoring',
  productivity: 'Productivity',
  custom: 'Custom',
} as const;

type TemplateCategory = keyof typeof TEMPLATE_CATEGORIES;

const dailyMorningBriefing = (): Partial<ScheduledTaskInput> => ({
  name: 'Daily Morning Briefing',
  description: 'Generate a daily morning briefing with weather, news summary, and priority tasks',
  schedule: {
    kind: 'cron',
    expr: '0 8 * * *',
  },
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
  delivery: {
    mode: 'none',
  },
});

const dailyStandupReport = (): Partial<ScheduledTaskInput> => ({
  name: 'Daily Standup Report',
  description: 'Generate a daily standup report template',
  schedule: {
    kind: 'cron',
    expr: '0 9 * * 1-5',
  },
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
  delivery: {
    mode: 'none',
  },
});

const weeklyReport = (): Partial<ScheduledTaskInput> => ({
  name: 'Weekly Report',
  description: 'Generate a comprehensive weekly summary and plan',
  schedule: {
    kind: 'cron',
    expr: '0 17 * * 5',
  },
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
  delivery: {
    mode: 'none',
  },
});

const codeReviewReminder = (): Partial<ScheduledTaskInput> => ({
  name: 'Code Review Reminder',
  description: 'Check for pending code reviews and PRs',
  schedule: {
    kind: 'every',
    everyMs: 4 * 60 * 60 * 1000, // 4 hours
  },
  sessionTarget: 'isolated',
  wakeMode: 'now',
  payload: {
    kind: 'agentTurn',
    message: `Please check for any pending code reviews or pull requests that need attention.

If this were connected to your git repository, I would help you:
1. List open PRs waiting for review
2. Check for PRs you've been requested to review
3. Prioritize reviews by urgency

For now, this is a reminder to check your code review queue!`,
    timeoutSeconds: 300,
  },
  delivery: {
    mode: 'none',
  },
});

const backupReminder = (): Partial<ScheduledTaskInput> => ({
  name: 'Backup Reminder',
  description: 'Regular reminder to backup important data',
  schedule: {
    kind: 'cron',
    expr: '0 20 * * 0',
  },
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
  delivery: {
    mode: 'none',
  },
});

const learningTime = (): Partial<ScheduledTaskInput> => ({
  name: 'Learning Time',
  description: 'Daily reminder for skill development and learning',
  schedule: {
    kind: 'cron',
    expr: '0 18 * * 1-5',
  },
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
  delivery: {
    mode: 'none',
  },
});

const healthCheck = (): Partial<ScheduledTaskInput> => ({
  name: 'System Health Check',
  description: 'Check system status and disk space',
  schedule: {
    kind: 'cron',
    expr: '0 10 * * *',
  },
  sessionTarget: 'isolated',
  wakeMode: 'now',
  payload: {
    kind: 'agentTurn',
    message: `Please perform a system health check.

If I had direct system access, I would:
1. Check available disk space
2. Verify memory usage
3. Check for any system updates
4. Review running processes
5. Check log files for errors

For now, this is a reminder to manually check your system health!`,
    timeoutSeconds: 300,
  },
  delivery: {
    mode: 'none',
  },
});

const endOfDayReview = (): Partial<ScheduledTaskInput> => ({
  name: 'End of Day Review',
  description: 'Daily reflection and planning for tomorrow',
  schedule: {
    kind: 'cron',
    expr: '0 17 * * 1-5',
  },
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
  delivery: {
    mode: 'none',
  },
});

const monthlyGoalReview = (): Partial<ScheduledTaskInput> => ({
  name: 'Monthly Goal Review',
  description: 'Review monthly goals and progress',
  schedule: {
    kind: 'cron',
    expr: '0 9 1 * *',
  },
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
  delivery: {
    mode: 'none',
  },
});

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'daily-morning-briefing',
    name: 'Morning Briefing',
    description: 'Start your day with a personalized briefing',
    category: 'daily',
    icon: '☀️',
    createInput: dailyMorningBriefing,
  },
  {
    id: 'daily-standup',
    name: 'Daily Standup Report',
    description: 'Prepare for team standup meetings (Mon-Fri)',
    category: 'daily',
    icon: '📋',
    createInput: dailyStandupReport,
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Generate weekly summary and plan (Friday afternoons)',
    category: 'weekly',
    icon: '📊',
    createInput: weeklyReport,
  },
  {
    id: 'end-of-day-review',
    name: 'End of Day Review',
    description: 'Reflect on the day and plan for tomorrow',
    category: 'daily',
    icon: '🌅',
    createInput: endOfDayReview,
  },
  {
    id: 'code-review-reminder',
    name: 'Code Review Reminder',
    description: 'Check for pending PRs and code reviews every 4 hours',
    category: 'productivity',
    icon: '👀',
    createInput: codeReviewReminder,
  },
  {
    id: 'backup-reminder',
    name: 'Backup Reminder',
    description: 'Weekly reminder to backup important data',
    category: 'monitoring',
    icon: '💾',
    createInput: backupReminder,
  },
  {
    id: 'learning-time',
    name: 'Learning Time',
    description: 'Daily reminder for skill development',
    category: 'productivity',
    icon: '📚',
    createInput: learningTime,
  },
  {
    id: 'system-health-check',
    name: 'System Health Check',
    description: 'Daily system health and resource check',
    category: 'monitoring',
    icon: '🩺',
    createInput: healthCheck,
  },
  {
    id: 'monthly-goal-review',
    name: 'Monthly Goal Review',
    description: 'Review and set monthly goals on the first day of each month',
    category: 'weekly',
    icon: '🎯',
    createInput: monthlyGoalReview,
  },
];

export function getTemplatesByCategory(category?: TemplateCategory): TaskTemplate[] {
  if (!category) return TASK_TEMPLATES;
  return TASK_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find(t => t.id === id);
}

export function getCategories(): Array<{ id: TemplateCategory; name: string }> {
  return Object.entries(TEMPLATE_CATEGORIES).map(([id, name]) => ({
    id: id as TemplateCategory,
    name,
  }));
}

export function createTaskFromTemplate(templateId: string): Partial<ScheduledTaskInput> | null {
  const template = getTemplateById(templateId);
  if (!template) return null;
  return template.createInput();
}
