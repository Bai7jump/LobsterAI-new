# OpenClaw Team Mode Test Environment Validation Checklist

## Environment Setup Status
- [ ] User data directory cleaned
- [ ] Team mode enabled
- [ ] Scheduling strategy configured (default: round-robin)
- [ ] Auto-restart enabled

## Instance Pool Validation
| Instance Name          | Type         | Capabilities                          | Max Concurrent Tasks | Status | Verified |
|------------------------|--------------|---------------------------------------|----------------------|--------|----------|
| General Instance 1     | general      | coding, analysis                      | 2                    | idle   | [ ]      |
| General Instance 2     | general      | coding, analysis                      | 2                    | idle   | [ ]      |
| Python Specialist      | specialized  | coding, python, testing               | 1                    | idle   | [ ]      |
| Data Analyst           | specialized  | analysis, reporting, visualization   | 1                    | idle   | [ ]      |

## IPC Interface Validation
- [ ] `openClawTeam:listInstances` - returns all 4 instances
- [ ] `openClawTeam:createInstance` - works correctly
- [ ] `openClawTeam:startInstance` - works correctly
- [ ] `openClawTeam:stopInstance` - works correctly
- [ ] `openClawTeam:deleteInstance` - works correctly
- [ ] `openClawTeam:submitTask` - works correctly
- [ ] `openClawTeam:getTaskStatus` - works correctly
- [ ] `openClawTeam:listTasks` - works correctly
- [ ] `openClawTeam:getConfig` - returns correct configuration
- [ ] `openClawTeam:updateConfig` - works correctly
- [ ] Event subscription - receives instance and task events

## Sanity Checks
- [ ] Simple task submission completes successfully
- [ ] Task is assigned to an instance automatically
- [ ] Instance status changes correctly from idle → busy → idle
- [ ] Task status transitions correctly from pending → assigned → running → completed
- [ ] Events are received for all state changes

## Scheduled Task Integration Validation
- [ ] `scheduledTask:create` - works correctly with team mode options
- [ ] `scheduledTask:runManually` - triggers task execution on correct instance
- [ ] Scheduled task failover works correctly
- [ ] Scheduled task history is available across all instances

## Environment Readiness
- [ ] All validation checks passed
- [ ] No critical errors found
- [ ] Test environment ready for integration testing

## Test Environment Information
- Setup date: 2026-03-25
- Test framework version: 1.0.0
- OpenClaw engine version: [ ]
- Application build version: [ ]
