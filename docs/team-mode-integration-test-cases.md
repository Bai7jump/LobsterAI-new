# OpenClaw Team Mode Integration Test Cases

## Test Overview
This document contains integration test cases for the OpenClaw Team Mode feature, covering core scenarios: task assignment, load balancing, failover, and capability matching.

## Environment Preparation
1. Clean user data directory before each test
2. Team mode enabled by default for all tests
3. At least 2 available instances pre-configured for most tests

---

## Test Suite 1: Task Assignment

### Test Case 1.1: Basic Task Assignment
**Objective**: Verify that tasks are correctly assigned to available instances
**Preconditions**:
- 1 idle general instance exists
- Team mode enabled
**Steps**:
1. Submit a simple task with no special capabilities
2. Check task status
3. Verify instance status change
**Expected Results**:
- Task status transitions: pending → assigned → running → completed
- Instance status transitions: idle → busy → idle
- Task is assigned to the available instance
- Task completes successfully

### Test Case 1.2: Task Priority Assignment
**Objective**: Verify that higher priority tasks are assigned first
**Preconditions**:
- 1 idle instance with maxConcurrentTasks = 1
- Team mode enabled
**Steps**:
1. Submit 3 tasks with priorities: 0 (low), 2 (high), 1 (medium)
2. Monitor task execution order
**Expected Results**:
- Tasks are executed in order of priority: 2 → 1 → 0
- Lower priority tasks remain in queue until higher priority tasks complete

### Test Case 1.3: Task Queueing When No Instances Available
**Objective**: Verify tasks are queued when all instances are busy
**Preconditions**:
- 1 instance with maxConcurrentTasks = 1, already running a task
- Team mode enabled
**Steps**:
1. Submit 2 additional tasks
2. Check task statuses
3. Wait for first task to complete
**Expected Results**:
- New tasks remain in pending status initially
- When instance becomes idle, next task is automatically assigned
- All tasks eventually complete successfully

---

## Test Suite 2: Load Balancing

### Test Case 2.1: Round-Robin Scheduling Strategy
**Objective**: Verify round-robin scheduling distributes tasks evenly
**Preconditions**:
- 3 idle general instances
- Scheduling strategy set to 'round-robin'
- Team mode enabled
**Steps**:
1. Submit 6 identical tasks
2. Track which instance each task is assigned to
**Expected Results**:
- Each instance receives exactly 2 tasks
- Tasks are distributed in round-robin order

### Test Case 2.2: Least-Loaded Scheduling Strategy
**Objective**: Verify least-loaded scheduling assigns tasks to the least busy instance
**Preconditions**:
- 3 instances:
  - Instance A: currentTasks = 2
  - Instance B: currentTasks = 0
  - Instance C: currentTasks = 1
- Scheduling strategy set to 'least-loaded'
- Team mode enabled
**Steps**:
1. Submit 3 new tasks
2. Track assignment
**Expected Results**:
- First task assigned to Instance B (0 tasks)
- Second task assigned to Instance C (1 task)
- Third task assigned to Instance B (now 1 task)
- Tasks are always assigned to the instance with the lowest current task count

### Test Case 2.3: Max Concurrent Tasks Limit
**Objective**: Verify instances respect maxConcurrentTasks configuration
**Preconditions**:
- 1 instance with maxConcurrentTasks = 2
- Team mode enabled
**Steps**:
1. Submit 5 tasks
2. Monitor instance currentTasks count
**Expected Results**:
- Instance never runs more than 2 tasks concurrently
- Remaining 3 tasks stay in queue until slots free up
- All tasks complete successfully

---

## Test Suite 3: Capability Matching

### Test Case 3.1: Exact Capability Match
**Objective**: Verify tasks are assigned to instances with matching capabilities
**Preconditions**:
- 2 instances:
  - Instance X: capabilities = ['coding', 'python']
  - Instance Y: capabilities = ['analysis', 'reporting']
- Scheduling strategy set to 'capability-match'
- Team mode enabled
**Steps**:
1. Submit a task with capabilities = ['coding']
2. Submit a task with capabilities = ['analysis']
**Expected Results**:
- First task assigned to Instance X
- Second task assigned to Instance Y
- Both tasks complete successfully

### Test Case 3.2: Multiple Capability Match
**Objective**: Verify tasks requiring multiple capabilities are assigned correctly
**Preconditions**:
- 3 instances:
  - Instance A: ['coding', 'python', 'testing']
  - Instance B: ['coding', 'javascript']
  - Instance C: ['analysis', 'python']
- Scheduling strategy set to 'capability-match'
**Steps**:
1. Submit a task with capabilities = ['coding', 'python']
**Expected Results**:
- Task is assigned to Instance A (only one that has both capabilities)

### Test Case 3.3: No Matching Capability Fallback
**Objective**: Verify tasks with no matching capabilities are assigned to any available instance
**Preconditions**:
- 2 instances:
  - Instance X: ['coding']
  - Instance Y: ['analysis']
- Scheduling strategy set to 'capability-match'
**Steps**:
1. Submit a task with capabilities = ['design']
**Expected Results**:
- Task is assigned to either instance (fallback behavior)
- Task completes successfully

### Test Case 3.4: Task Without Capabilities
**Objective**: Verify tasks with no capability requirements are assigned normally
**Preconditions**:
- 2 instances with different capabilities
- Scheduling strategy set to 'capability-match'
**Steps**:
1. Submit a task with no capabilities specified
**Expected Results**:
- Task is assigned to the first available instance
- Task completes successfully

---

## Test Suite 4: Failover & High Availability

### Test Case 4.1: Instance Failure Task Evacuation
**Objective**: Verify tasks from failed instances are requeued
**Preconditions**:
- 2 idle instances
- 1 running task assigned to Instance A
- Team mode enabled, autoRestart = false
**Steps**:
1. Simulate Instance A heartbeat timeout (30s without heartbeat)
2. Monitor task status
3. Verify Instance B receives the task
**Expected Results**:
- Instance A status changes to 'error'
- Running task is requeued with status 'pending'
- Task is reassigned to Instance B
- Task completes successfully on Instance B

### Test Case 4.2: Auto-Restart Failed Instance
**Objective**: Verify failed instances are automatically restarted when autoRestart is enabled
**Preconditions**:
- 1 instance running a task
- Team mode enabled, autoRestart = true
**Steps**:
1. Simulate instance heartbeat timeout
2. Monitor instance status
**Expected Results**:
- Instance status changes to 'error'
- System automatically attempts to restart the instance
- Instance eventually returns to 'idle' status
- Any evacuated tasks are reassigned

### Test Case 4.3: Manual Instance Stop Evacuation
**Objective**: Verify tasks are evacuated when stopping an instance manually
**Preconditions**:
- 2 idle instances
- 1 running task assigned to Instance A
**Steps**:
1. Send stopInstance command for Instance A
2. Monitor task and instance status
**Expected Results**:
- Running task is requeued
- Task is reassigned to Instance B
- Instance A status changes to 'stopped'
- Task completes successfully on Instance B

### Test Case 4.4: Delete Running Instance
**Objective**: Verify deleting a running instance properly evacuates tasks
**Preconditions**:
- 2 idle instances
- 1 running task assigned to Instance A
**Steps**:
1. Send deleteInstance command for Instance A
2. Monitor task and instance status
**Expected Results**:
- Running task is requeued
- Task is reassigned to Instance B
- Instance A is removed from the instance list
- Task completes successfully on Instance B

---

## Test Suite 5: Edge Cases & Boundary Conditions

### Test Case 5.1: Empty Instance Pool
**Objective**: Verify system behavior when no instances exist
**Preconditions**:
- No instances configured
- Team mode enabled
**Steps**:
1. Submit a task
2. Check task status
3. Add and start an instance
**Expected Results**:
- Task remains in pending status initially
- When instance starts, task is automatically assigned
- Task completes successfully

### Test Case 5.2: Team Mode Disable/Enable
**Objective**: Verify system behavior when team mode is toggled
**Preconditions**:
- 1 idle instance
- 1 pending task in queue
**Steps**:
1. Disable team mode
2. Check task status
3. Enable team mode
**Expected Results**:
- When disabled, no task scheduling occurs
- When enabled, pending tasks are scheduled automatically
- Task completes successfully

### Test Case 5.3: Scheduling Strategy Dynamic Update
**Objective**: Verify scheduling strategy changes take effect immediately
**Preconditions**:
- 3 idle instances
- Current strategy: round-robin
**Steps**:
1. Submit 2 tasks (verify round-robin assignment)
2. Update strategy to 'least-loaded'
3. Submit 2 more tasks
**Expected Results**:
- First 2 tasks assigned in round-robin order
- Next 2 tasks assigned using least-loaded strategy
- All tasks complete successfully

---

## Test Suite 6: IPC API Validation

### Test Case 6.1: Instance Management APIs
**Test all instance management APIs**:
- createInstance: verify instance is created with correct parameters
- listInstances: verify returns all instances
- getInstance: verify returns correct instance details
- startInstance: verify instance starts correctly
- stopInstance: verify instance stops correctly
- deleteInstance: verify instance is removed

### Test Case 6.2: Task Management APIs
**Test all task management APIs**:
- submitTask: verify task is created and queued
- getTaskStatus: verify returns correct task status
- listTasks: verify returns all tasks, filter works correctly (by status, assignedTo)

### Test Case 6.3: Configuration APIs
**Test all configuration APIs**:
- getConfig: verify returns current configuration
- updateConfig: verify configuration updates are applied correctly (scheduling strategy, autoRestart, etc.)

### Test Case 6.4: Invalid Parameter Handling
**Test all APIs with invalid parameters**:
- Missing required fields
- Invalid data types
- Non-existent instance IDs/task IDs
**Expected Results**:
- All APIs return appropriate error messages
- No crashes or unexpected behavior

---

## Test Suite 7: Backward Compatibility

### Test Case 7.1: Existing Single Instance Mode Compatibility
**Objective**: Verify team mode does not break existing single instance functionality
**Preconditions**:
- Existing user data with single OpenClaw instance configured
- Team mode disabled by default (default configuration)
**Steps**:
1. Launch application without enabling team mode
2. Submit a regular task (non-team task)
3. Verify task execution
4. Enable team mode
5. Submit both team tasks and regular tasks
**Expected Results**:
- Single instance mode works exactly as before when team mode is disabled
- Regular task execution is not affected by team mode presence
- Team mode can be enabled without breaking existing functionality
- Both team tasks and regular tasks can coexist and execute correctly

### Test Case 7.2: Legacy Scheduled Task Compatibility
**Objective**: Verify existing scheduled tasks work correctly with team mode
**Preconditions**:
- Existing scheduled tasks created before team mode implementation
- Team mode enabled
**Steps**:
1. Trigger a legacy scheduled task execution
2. Monitor task routing and execution
**Expected Results**:
- Legacy scheduled tasks are correctly routed to team instances
- Tasks execute successfully
- Scheduled task history and status tracking works as before
- No changes required for existing scheduled tasks

### Test Case 7.3: Configuration Migration Compatibility
**Objective**: Verify configuration migration works correctly for existing users
**Preconditions**:
- User data from version before team mode was introduced
**Steps**:
1. Launch new version with team mode feature
2. Check team mode configuration
3. Verify existing instance configurations are preserved
**Expected Results**:
- Team mode is disabled by default for existing users
- Existing instance configurations are migrated correctly
- No data loss or configuration corruption
- Users can enable team mode manually if desired

### Test Case 7.4: API Backward Compatibility
**Objective**: Verify existing public APIs continue to work unchanged
**Preconditions**:
- Code using pre-team-mode public APIs
**Steps**:
1. Run existing API client code without modification
2. Verify all existing API endpoints return expected responses
3. Verify new team mode APIs are optional and do not break existing clients
**Expected Results**:
- All existing APIs continue to work without any changes
- New team mode APIs are additive and optional
- No breaking changes to public API contract

---

## Test Suite 8: Architecture Optimization Verification

### Test Case 8.1: Scheduling Logic Consistency Test
**Objective**: Verify unified scheduling logic in OpenClawTeamManager produces consistent results across all entry points
**Preconditions**:
- Team mode enabled with 3 idle instances
- Scheduling strategy set to 'capability-match'
**Steps**:
1. Submit identical tasks through 3 different entry points:
   - Direct IPC API call
   - Scheduled task trigger
   - UI manual submission
2. Compare task assignment decisions for identical task inputs
3. Verify scheduling behavior is identical regardless of entry point
4. Repeat test with all 3 scheduling strategies (round-robin, least-loaded, capability-match)
**Expected Results**:
- Identical task inputs produce identical scheduling decisions regardless of submission channel
- All scheduling strategies behave consistently across all entry points
- No divergent behavior between different task submission methods

### Test Case 8.2: Data Model Compatibility Test
**Objective**: Verify unified instance capability model and status enumerations are backward compatible
**Preconditions**:
- User data with instances created using old data model (before unification)
- Mixed status values from old and new enumerations
**Steps**:
1. Load application with legacy instance data
2. Verify all instances are loaded correctly with no data loss
3. Verify old capability labels are properly migrated to the unified model
4. Verify both old and new status values are correctly interpreted and displayed
5. Create new instances and verify they use the unified data model
**Expected Results**:
- Legacy instance data is migrated automatically without loss
- Old capability labels are preserved and compatible with new matching logic
- Both old and new status enumerations are handled correctly
- New instances use unified data model while maintaining compatibility with existing logic

### Test Case 8.3: Multi-Instance State Synchronization Test
**Objective**: Verify instance and task state changes are properly synchronized across all system components
**Preconditions**:
- 2 running instances
- Multiple UI clients subscribed to team events
**Steps**:
1. Start an instance, verify status updates are reflected in:
   - Instance list in UI
   - Persisted configuration file
   - IPC event broadcasts to all subscribers
2. Submit a task and verify status transitions are synchronized across all components
3. Simulate instance status change from 'idle' → 'busy' → 'idle'
4. Verify all components see the same state at all times
**Expected Results**:
- All state changes are persisted immediately to storage
- All subscribed clients receive consistent event notifications
- No state divergence between different components
- State remains consistent even under high frequency of changes

### Test Case 8.4: Enhanced Failover and Task Evacuation Test
**Objective**: Verify robust failover and task evacuation after InstanceRouter integration
**Preconditions**:
- 4 running instances
- 10 active tasks distributed across instances
- autoRestart enabled
**Steps**:
1. Simulate simultaneous failure of 2 instances while tasks are running
2. Verify all tasks from failed instances are properly requeued
3. Verify tasks are redistributed to remaining healthy instances
4. Verify failed instances are automatically restarted
5. Verify no tasks are lost or duplicated during the failover process
6. Test evacuation during high system load (many running tasks)
**Expected Results**:
- 100% of tasks from failed instances are successfully evacuated and requeued
- No task loss or duplication occurs during failover
- Tasks are reassigned to healthy instances and complete successfully
- Failed instances are restarted automatically and return to the instance pool
- System remains stable and operational during failover events

---

## Test Suite 9: Advanced Architecture Validation

### Test Case 9.1: Multi-Instance State Synchronization Consistency Test
**Objective**: Verify strong consistency of instance states across all components under concurrent operations
**Preconditions**:
- 3 running instances
- Multiple concurrent clients performing operations
- Team events enabled and subscribed by 3+ UI clients
**Steps**:
1. Perform concurrent operations on the same instance from multiple clients:
   - Client 1: Start instance
   - Client 2: Update instance configuration
   - Client 3: Submit task targeted to this instance
2. Monitor state changes across all subscribed clients and persisted storage
3. Perform concurrent state modification operations (start/stop/config update) on multiple instances
4. Verify all clients eventually see the same final state
**Expected Results**:
- All clients receive identical event streams for state changes
- Final state is consistent across all UI clients, persisted storage, and in-memory state
- No race conditions or state corruption occur under concurrent operations
- State convergence is achieved within < 100ms for all operations

### Test Case 9.2: Configuration Linkage and Lifecycle Management Test
**Objective**: Verify configuration changes correctly trigger corresponding instance lifecycle operations
**Preconditions**:
- Team mode enabled with global autoRestart = true
- 2 running instances with configuration inherited from global defaults
**Steps**:
1. Update global default instance configuration (increase maxConcurrentTasks from 2 to 4)
2. Verify all instances automatically pick up the new configuration without restart
3. Disable team mode globally
4. Verify all running instances are gracefully stopped automatically
5. Re-enable team mode globally
6. Verify all previously running instances are automatically restarted
7. Update scheduling strategy while tasks are running
8. Verify new scheduling strategy applies to new tasks without affecting running tasks
**Expected Results**:
- Global configuration changes are automatically propagated to all relevant instances
- Team mode enable/disable correctly manages the full lifecycle of all instances
- Configuration changes do not interrupt running tasks
- Lifecycle operations are performed in the correct order with no errors

### Test Case 9.3: Multi-Instance Resource Isolation and State Conflict Test
**Objective**: Verify instances are properly isolated and do not interfere with each other
**Preconditions**:
- 3 instances configured with different resource limits:
  - Instance A: memoryLimitMB = 512, cpuLimit = 0.5
  - Instance B: memoryLimitMB = 1024, cpuLimit = 1.0
  - Instance C: memoryLimitMB = 2048, cpuLimit = 2.0
**Steps**:
1. Submit high-resource tasks to all 3 instances simultaneously
2. Monitor resource usage of each instance to verify they respect their limits
3. Verify tasks running on one instance do not affect the performance or stability of other instances
4. Simulate a crash on one instance
5. Verify other instances continue operating normally with no impact
6. Test instance-specific configuration changes to ensure they only affect the target instance
**Expected Results**:
- Strict resource isolation between instances - no resource leakage or cross-instance interference
- Instance crash does not affect other running instances
- Configuration changes to one instance have no impact on other instances
- All instances operate independently while sharing the same team management layer

### Test Case 9.4: Cross-Instance Task Execution History Unified Query Test
**Objective**: Verify unified task history query works correctly across all instances
**Preconditions**:
- 3 instances that have completed a total of 20+ tasks (mix of completed, failed, cancelled)
**Steps**:
1. Query task list with no filters - verify returns all tasks from all instances
2. Filter tasks by assignedTo instance ID - verify returns only tasks from that instance
3. Filter tasks by status (completed/failed) - verify returns matching tasks across all instances
4. Test pagination with large task volumes
5. Verify task details include correct instance assignment information
6. Verify task history is preserved even after instances are deleted or restarted
**Expected Results**:
- Unified task query returns complete and accurate results across all instances
- All filter combinations work correctly
- Task history is persistent and not lost when instances are modified
- Pagination works correctly with consistent ordering
- Task details include full execution context and instance information

---

## Test Suite 10: Scheduled Task Team Mode Integration (High Priority)

### Test Case 10.1: Scheduled Task Automatic Instance Routing Test
**Objective**: Verify scheduled tasks are correctly routed to team instances based on assignment strategy
**Preconditions**:
- Team mode enabled with 3 running instances
- Scheduled task instance router properly integrated with CronJobService
**Steps**:
1. Create 4 scheduled tasks with different assignment strategies:
   - Task 1: round-robin strategy
   - Task 2: least-loaded strategy
   - Task 3: capability-based strategy (requires python capability)
   - Task 4: manual assignment to specific instance
2. Trigger each scheduled task to run
3. Verify task instance assignment matches the configured strategy
4. Verify task execution completes successfully
**Expected Results**:
- All scheduled tasks are correctly routed to appropriate instances based on their configured strategy
- Tasks with capability requirements are assigned to instances matching those capabilities
- Manually assigned tasks run on the specified instance
- All tasks execute successfully and return expected results

### Test Case 10.2: Scheduled Task Failover Retry Test
**Objective**: Verify scheduled tasks automatically failover to other instances when the assigned instance fails
**Preconditions**:
- Team mode enabled with 2 running instances
- Scheduled task with failover enabled and maxRetries=2
- Task assigned to Instance A
**Steps**:
1. Start the scheduled task execution on Instance A
2. Simulate Instance A failure immediately after task starts
3. Monitor task execution and failover process
4. Verify task is retried on Instance B
**Expected Results**:
- Task execution failure on Instance A is detected
- System automatically re-routes the task to Instance B
- Task completes successfully on Instance B
- Task execution history shows both the failed attempt on A and successful attempt on B
- No task loss or duplicate execution occurs

### Test Case 10.3: Scheduled Task Capability Matching Test
**Objective**: Verify scheduled tasks with capability requirements are always assigned to matching instances
**Preconditions**:
- 3 instances with different capabilities:
  - Instance X: capabilities = ['coding', 'python']
  - Instance Y: capabilities = ['analysis', 'reporting']
  - Instance Z: capabilities = ['testing', 'automation']
- Scheduling strategy set to 'capability-based'
**Steps**:
1. Create 3 scheduled tasks with different capability requirements:
   - Task 1: requires ['python']
   - Task 2: requires ['reporting']
   - Task 3: requires ['testing']
2. Trigger all three tasks to run
3. Verify instance assignment for each task
4. Verify all tasks complete successfully
**Expected Results**:
- Task 1 is assigned to Instance X (only one with python capability)
- Task 2 is assigned to Instance Y (only one with reporting capability)
- Task 3 is assigned to Instance Z (only one with testing capability)
- All tasks execute successfully with correct instance assignment
- No tasks are assigned to instances that don't meet their capability requirements

### Test Case 10.4: Cross-Instance Scheduled Task History Unified Query Test
**Objective**: Verify scheduled task execution history from all instances is accessible through unified query
**Preconditions**:
- 3 instances that have each executed 5+ scheduled tasks
- Mix of successful, failed, and skipped task executions
**Steps**:
1. Query global scheduled task run history (listAllRuns API)
2. Verify all executions from all instances are included in the results
3. Filter runs by task ID - verify returns all runs of that task regardless of which instance executed it
4. Filter runs by status - verify returns matching runs across all instances
**Expected Results**:
- Unified scheduled task history includes all executions from all instances
- All filter operations work correctly across instance boundaries
- Execution records include accurate instance assignment information
- History is preserved even after instances are stopped or deleted

---

## Test Suite 11: State Consistency (High Priority)

### Test Case 11.1: Multi-Client Instance State Synchronization Test
**Objective**: Verify instance state changes are synchronized in real-time across all connected UI clients
**Preconditions**:
- 2 UI clients connected and subscribed to team mode events
- 1 idle instance running
**Steps**:
1. From Client 1, send a startInstance command for the idle instance
2. Monitor instance status on both Client 1 and Client 2
3. From Client 2, update the instance's maxConcurrentTasks configuration
4. Verify configuration change is reflected on both clients
5. From Client 1, stop the instance
6. Verify stopped status is shown on both clients
**Expected Results**:
- All state changes are reflected on both clients within < 1 second
- No state divergence between clients at any point
- All operations complete successfully with consistent state across all subscribers

### Test Case 11.2: In-Memory vs Persisted State Consistency Test
**Objective**: Verify in-memory state always matches persisted state in storage
**Preconditions**:
- Team mode enabled with 2 running instances
- Multiple pending and running tasks
**Steps**:
1. Perform a series of operations: create instance, start instance, submit 5 tasks, update configuration
2. After each operation, immediately compare in-memory state (from IPC query) with persisted state (from config.json file)
3. Simulate application crash and restart
4. Compare state after restart with state before crash
**Expected Results**:
- After every operation, in-memory state exactly matches persisted state
- After application restart, all instances, tasks, and configuration are restored exactly as before the crash
- No state loss or corruption occurs during crash recovery
- All task execution statuses are preserved correctly

### Test Case 11.3: Concurrent Operation State Convergence Test
**Objective**: Verify state remains consistent even when multiple concurrent operations are performed
**Preconditions**:
- 3 running instances
- Multiple test clients performing operations simultaneously
**Steps**:
1. Perform 10 concurrent operations from different clients:
   - 3x submit task
   - 2x update instance configuration
   - 2x start/stop instance
   - 2x update team configuration
   - 1x delete instance
2. After all operations complete, verify state across all clients and persisted storage
3. Verify no race conditions or corrupted state
**Expected Results**:
- All operations complete successfully (or fail with appropriate error messages)
- Final state is consistent across all clients and persisted storage
- No invalid intermediate states are visible to clients
- No data corruption or state loss occurs under concurrent load

---

## Test Suite 12: Architecture Optimization Verification

### Test Case 12.1: Unified Scheduling Logic Consistency Test
**Objective**: Verify all task entry points use the same unified scheduling logic in OpenClawTeamManager
**Preconditions**:
- Team mode enabled with 4 running instances
- Scheduling strategy set to 'least-loaded'
**Steps**:
1. Submit identical tasks through 4 different entry points:
   - Direct openClawTeam IPC API
   - Scheduled task execution trigger
   - UI manual task submission
   - External webhook trigger
2. Compare instance assignment decisions for all 4 tasks
3. Repeat test with all 3 scheduling strategies
**Expected Results**:
- Identical tasks submitted through different entry points receive identical instance assignment decisions
- All scheduling strategies behave consistently regardless of entry point
- No divergent behavior between different task submission channels

### Test Case 12.2: Unified Data Model Compatibility Test
**Objective**: Verify unified instance capability model and status enumerations work correctly across all system components
**Preconditions**:
- Legacy instance data using old data model formats
- Mixed components using both old and new data model interfaces
**Steps**:
1. Load application with legacy instance data
2. Verify all instances are correctly loaded and displayed in UI
3. Verify scheduling logic correctly reads and uses the unified capability model
4. Verify instance status enumerations are correctly interpreted by all components (CronJobService, InstanceRouter, UI)
**Expected Results**:
- Legacy data is automatically migrated to the unified model without loss
- All components correctly interpret both old and new data formats
- No compatibility issues between components using different versions of the data model
- Scheduling decisions based on unified capability model are correct

### Test Case 12.3: InstanceRouter and OpenClawTeamManager Integration Test
**Objective**: Verify end-to-end integration between InstanceRouter and OpenClawTeamManager works correctly
**Preconditions**:
- InstanceRouter fully integrated with OpenClawTeamManager
- 4 running instances with diverse capabilities
**Steps**:
1. Submit scheduled tasks using all 5 assignment strategies (manual, round-robin, least-loaded, capability-based, affinity-tag)
2. Verify InstanceRouter correctly selects instances based on strategy
3. Verify OpenClawTeamManager correctly executes the task on the selected instance
4. Verify task execution results and status are correctly propagated back through all components
**Expected Results**:
- All assignment strategies work correctly end-to-end
- Tasks are always assigned to the correct instance as per the strategy
- Task execution completes successfully with correct status tracking
- No integration issues between InstanceRouter and TeamManager components

---

## Test Suite 13: Additional Scenario Coverage (Final Review)

### Test Case 13.1: Affinity-Tag Scheduling Strategy Specialized Test
**Objective**: Verify affinity-tag scheduling strategy correctly matches tasks to instances with highest tag match score
**Preconditions**:
- 3 instances with different affinity tags:
  - Instance A: tags = ['project-x', 'frontend', 'react']
  - Instance B: tags = ['project-x', 'backend', 'python']
  - Instance C: tags = ['project-y', 'data', 'analysis']
- Scheduling strategy set to 'affinity-tag'
**Steps**:
1. Submit task with affinityTags = ['project-x', 'frontend']
2. Verify task is assigned to Instance A (highest tag match score: 2)
3. Submit task with affinityTags = ['project-x', 'python']
4. Verify task is assigned to Instance B (highest tag match score: 2)
5. Submit task with affinityTags = ['project-x', 'unknown-tag']
6. Verify task is assigned to either Instance A or B (both have 1 matching tag)
7. Submit task with affinityTags = ['data']
8. Verify task is assigned to Instance C (only matching tag)
**Expected Results**:
- All tasks are assigned to the instance with the highest number of matching affinity tags
- When multiple instances have the same match score, any of them can be selected
- Tasks with no matching tags fall back to round-robin selection
- Affinity tag matching is case-sensitive and exact match

### Test Case 13.2: Task Assignment History Persistence Test
**Objective**: Verify task instance assignment history is correctly persisted and survives restarts
**Preconditions**:
- Team mode enabled with 2 running instances
- Multiple tasks executed with instance assignment history
**Steps**:
1. Submit 3 tasks, wait for them to complete successfully
2. For each task, verify assignment history shows which instance it was assigned to
3. Simulate application restart (close and reopen)
4. After restart, query task history for all 3 tasks
5. Verify assignment history is preserved exactly as before the restart
6. Delete an instance that has executed tasks in the past
7. Verify historical task assignment records for that instance are still preserved
**Expected Results**:
- Task assignment history is persisted to storage and survives application restarts
- Assignment history includes instance ID, assignment timestamp, and assignment reason
- Historical records are not deleted even when the assigned instance is removed
- Assignment history is visible in both task details and execution history queries

### Test Case 13.3: Task Execution Failure Retry Strategy Test
**Objective**: Verify task failure retry strategies work correctly including failover between instances
**Preconditions**:
- 2 running instances
- Task configured with maxRetries = 3, retryDelayMs = 1000, failoverToOtherInstance = true
**Steps**:
1. Submit a task that will intentionally fail on first execution
2. Monitor task retry behavior
3. Verify task is retried up to maxRetries times
4. Simulate the first instance becoming unavailable during retries
5. Verify task automatically fails over to the second instance for subsequent retries
6. Verify task execution history shows all retry attempts, including which instance each attempt ran on
7. Test with failoverToOtherInstance = false - verify retries always run on the same instance
**Expected Results**:
- Failed tasks are retried exactly maxRetries times before giving up
- Retry delays follow the configured retryDelayMs setting
- When failover is enabled, retries will be routed to other instances if the original instance is unavailable
- When failover is disabled, all retries run on the originally assigned instance
- All retry attempts are recorded in the task execution history with instance information and error details

### Test Case 13.4: Scheduled Task Team Mode Integration Completeness Test
**Objective**: Verify complete integration between scheduled tasks and team mode covering all 4 required test points
**Preconditions**:
- CronJobService fully integrated with ScheduledTaskInstanceRouter and OpenClawTeamManager
- 3 running instances with different capabilities
**Steps**:
1. **Test Point 1: Strategy-based routing**: Create scheduled tasks with all 5 assignment strategies, verify each task is routed correctly according to its strategy
2. **Test Point 2: Failover retry**: Simulate instance failure during scheduled task execution, verify automatic failover and retry on healthy instance
3. **Test Point 3: Capability matching**: Create scheduled tasks with specific capability requirements, verify they are only assigned to instances that meet the requirements
4. **Test Point 4: Unified history query**: Execute scheduled tasks on multiple instances, verify all runs are visible in the unified cross-instance history query
**Expected Results**:
- All 4 scheduled task integration test points pass successfully
- Scheduled tasks work seamlessly with team mode without any integration issues
- No functional gaps between scheduled tasks and team mode features
