# OpenClaw Team Mode Test Preparation Guide

## 1. Test Environment Setup

### 1.1 Hardware Requirements
- Minimum 4 CPU cores, 8GB RAM (to support running 3-4 OpenClaw instances simultaneously
- 20GB free disk space for instance storage and test data

### 1.2 Software Requirements
- Windows 10/11 or macOS 12+ or Linux (Ubuntu 20.04+)
- Node.js 18.x or higher
- OpenClaw engine binaries pre-installed or available for download
- Git for version control

### 1.3 Environment Configuration
1. **Clean User Data Directory:
   - Before each test run, clear the user data directory to ensure no residual state
   - Default path: `%APPDATA%\LobsterAI` (Windows), `~/Library/Application Support/LobsterAI` (macOS), `~/.config/LobsterAI` (Linux)

2. **Multi-Instance Test Scenario Setup**:
   ```bash
   # Build 4 test instances with different configurations:
   - Instance 1 (General): name="General Instance 1", type="general", capabilities=["coding", "analysis"], maxConcurrentTasks=2
   - Instance 2 (General): name="General Instance 2", type="general", capabilities=["coding", "analysis"], maxConcurrentTasks=2
   - Instance 3 (Specialized): name="Python Specialist", type="specialized", capabilities=["coding", "python", "testing"], maxConcurrentTasks=1
   - Instance 4 (Specialized): name="Data Analyst", type="specialized", capabilities=["analysis", "reporting", "visualization"], maxConcurrentTasks=1
   ```

3. **Scheduling Strategy Test Configurations:
   - Test all 3 scheduling strategies: round-robin, least-loaded, capability-match
   - Auto-restart enabled by default for failover testing

## 2. Test Data Preparation

### 2.1 Test Task Templates
1. **Simple Coding Task**:
```json
{
  "input": {
    "priority": 0,
    "capabilities": ["coding"],
    "payload": {
      "kind": "agentTurn",
      "message": "Write a Python function to calculate Fibonacci sequence",
      "timeoutSeconds": 30
    }
  }
}
```

2. **High Priority Python Task**:
```json
{
  "input": {
    "priority": 2,
    "capabilities": ["coding", "python"],
    "payload": {
      "kind": "agentTurn",
      "message": "Optimize this Python data processing script",
      "timeoutSeconds": 60
    }
  }
}
```

3. **Analysis Task**:
```json
{
  "input": {
    "priority": 1,
    "capabilities": ["analysis"],
    "payload": {
      "kind": "agentTurn",
      "message": "Analyze this performance metrics and generate a report",
      "timeoutSeconds": 120
    }
  }
}
```

4. **Long Running Task**:
```json
{
  "input": {
    "priority": 0,
    "payload": {
      "kind": "agentTurn",
      "message": "Perform comprehensive code review of the provided repository",
      "timeoutSeconds": 300
    }
  }
}
```

### 2.2 Scheduled Task Test Data
- 5 scheduled tasks with different schedules:
  1. One-time task: run at specific time
  2. Recurring task: run every 1 minute (for testing)
  3. Cron schedule: run every 2 minutes
  4. High priority scheduled task with capability requirements
  5. Task with failover enabled

## 3. Test Scaffold and Automation Framework

### 3.1 Test Utilities
1. **Instance Management Helper**:
   - Functions to create/start/stop/delete instances programmatically
   - Instance state monitoring utilities

2. **Task Submission Helper**:
   - Batch task submission
   - Task status tracking
   - Task execution result verification

3. **Event Monitoring Helper**:
   - Subscribe to team mode events
   - Verify event sequence and content
   - Event consistency checking

4. **State Synchronization Verifier**:
   - Compare state across UI, IPC, and persisted storage
   - Verify no state divergence

### 3.2 Test Script Structure
```
test/
├── integration/
│   ├── team-mode/
│   │   ├── test-task-assignment.ts      # Task assignment tests
│   │   ├── test-load-balancing.ts         # Load balancing tests
│   │   ├── test-capability-matching.ts    # Capability matching tests
│   │   ├── test-failover.ts               # Failover tests
│   │   ├── test-state-sync.ts              # State synchronization tests
│   │   ├── test-config-lifecycle.ts       # Configuration and lifecycle tests
│   │   ├── test-resource-isolation.ts     # Resource isolation tests
│   │   ├── test-query-api.ts              # Unified query API tests
│   │   └── test-backward-compatibility.ts  # Backward compatibility tests
└── utils/
    ├── instance-helper.ts
    ├── task-helper.ts
    ├── event-helper.ts
    └── state-verifier.ts
```

## 4. Third-Party Dependencies and Tools

### 4.1 Required Tools
1. **Node.js Test Runner**: Built-in Node.js test runner for automated tests
2. **Playwright**: For UI testing (optional, if UI interaction tests
3. **curl/Postman**: For API testing
4. **Process Explorer**: For monitoring instance process monitoring and resource usage checking
5. **Git**: For test version control and test data management

### 4.2 External Dependencies
1. OpenClaw engine binaries (version matching the current release)
2. Any required skill packages for testing different capabilities
3. Mock external services for testing delivery channels (webhook, IM platforms)

## 5. Test Execution Checklist
- [ ] Clean user data directory
- [ ] Start application with team mode enabled
- [ ] Create and start all 4 test instances
- [ ] Verify all instances are in idle state
- [ ] Verify IPC connectivity to all instances
- [ ] Prepare test task templates
- [ ] Verify event subscription is working
- [ ] Run pre-test sanity check
