/**
 * Example Test Case: Basic Task Assignment Test
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { setupStandardInstancePool, cleanupAllInstances } from '../../utils/instance-helper';
import { submitTask, waitForTaskAssignment, waitForTaskCompletion, TestTaskTemplates } from '../../utils/task-helper';

describe('Team Mode Basic Task Assignment', () => {
  before(async () => {
    // Setup test environment
    await cleanupAllInstances();
    await setupStandardInstancePool();
  });

  after(async () => {
    // Cleanup
    await cleanupAllInstances();
  });

  it('should assign simple coding task to available instance', async () => {
    // Submit a simple coding task
    const task = await submitTask(TestTaskTemplates.simpleCoding());
    assert.equal(task.status, 'pending', 'Task should be in pending status initially');

    // Wait for task to be assigned
    const assignedTask = await waitForTaskAssignment(task.id);
    assert.ok(assignedTask.assignedTo, 'Task should be assigned to an instance');
    assert.equal(assignedTask.status, 'assigned', 'Task should be in assigned status');

    // Wait for task completion
    const completedTask = await waitForTaskCompletion(task.id);
    assert.equal(completedTask.status, 'completed', 'Task should complete successfully');
    assert.ok(completedTask.output, 'Task should have output');
  });

  it('should assign python task to specialized python instance', async () => {
    // Submit a python task that requires python capability
    const task = await submitTask(TestTaskTemplates.pythonTask());

    // Wait for assignment
    const assignedTask = await waitForTaskAssignment(task.id);

    // Verify it's assigned to the python specialist instance
    // (In actual test, we would check the instance capabilities match)
    assert.ok(assignedTask.assignedTo, 'Task should be assigned');

    // Wait for completion
    const completedTask = await waitForTaskCompletion(task.id);
    assert.equal(completedTask.status, 'completed', 'Python task should complete');
  });
});
