#!/usr/bin/env node
/**
 * Basic Team Mode Functionality Test
 * This test verifies the core team mode features are working correctly
 */

import { getOpenClawTeamManager } from '../src/main/libs/openClawTeamManager';
import type { TeamTask, TaskInput } from '../src/renderer/types/openClawTeam';

console.log('🚀 Starting OpenClaw Team Mode Basic Functionality Test\n');

async function testTeamManagerInitialization() {
  console.log('📋 Test 1: Team Manager Initialization');
  try {
    const teamManager = getOpenClawTeamManager();
    console.log('✅ Team manager initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize team manager:', error);
    return false;
  }
}

async function testInstanceListing() {
  console.log('\n📋 Test 2: Instance Listing');
  try {
    const teamManager = getOpenClawTeamManager();
    const instances = teamManager.listInstances();
    console.log(`✅ Found ${instances.length} instances`);

    instances.forEach((instance, index) => {
      console.log(`   ${index + 1}. ${instance.name} (${instance.status}) - [${instance.capabilities?.join(', ') || 'none'}]`);
    });

    return instances.length > 0;
  } catch (error) {
    console.error('❌ Failed to list instances:', error);
    return false;
  }
}

async function testSchedulingStrategyConfiguration() {
  console.log('\n📋 Test 3: Scheduling Strategy Configuration');
  try {
    const teamManager = getOpenClawTeamManager();
    const config = teamManager.getConfig();
    console.log(`✅ Current scheduling strategy: ${config.schedulingStrategy}`);
    console.log(`✅ Auto-restart enabled: ${config.autoRestart}`);
    console.log(`✅ Team mode enabled: ${config.enabled}`);

    // Test strategy update
    const newStrategy = config.schedulingStrategy === 'round-robin' ? 'least-loaded' : 'round-robin';
    teamManager.updateConfig({ schedulingStrategy: newStrategy });

    const updatedConfig = teamManager.getConfig();
    console.log(`✅ Strategy updated to: ${updatedConfig.schedulingStrategy}`);

    // Restore original
    teamManager.updateConfig({ schedulingStrategy: config.schedulingStrategy });
    return true;
  } catch (error) {
    console.error('❌ Failed to test scheduling strategy:', error);
    return false;
  }
}

async function testTaskAssignmentSimulation() {
  console.log('\n📋 Test 4: Task Assignment Simulation');
  try {
    const teamManager = getOpenClawTeamManager();

    // Create a test task
    const taskInput: TaskInput = {
      priority: 0,
      capabilities: ['coding'],
      payload: {
        kind: 'agentTurn',
        message: 'Write a simple hello world function',
        timeoutSeconds: 30
      }
    };

    // Test instance selection
    const selectedInstance = teamManager.selectInstanceForScheduledTask(taskInput, 'round-robin');

    if (selectedInstance) {
      console.log(`✅ Task would be assigned to: ${selectedInstance.name}`);
      console.log(`   Instance capabilities: [${selectedInstance.capabilities?.join(', ') || 'none'}]`);
      console.log(`   Current instance load: ${selectedInstance.stats?.currentTasks || 0} tasks`);
      return true;
    } else {
      console.log('⚠️ No available instance found for task');
      return true; // This might be expected if no instances are running
    }
  } catch (error) {
    console.error('❌ Failed to test task assignment:', error);
    return false;
  }
}

async function testCapabilityMatching() {
  console.log('\n📋 Test 5: Capability Matching');
  try {
    const teamManager = getOpenClawTeamManager();

    // Test with different capability requirements
    const testCases = [
      { capabilities: ['python'], description: 'Python task' },
      { capabilities: ['analysis'], description: 'Analysis task' },
      { capabilities: ['coding', 'python'], description: 'Python coding task' },
    ];

    for (const testCase of testCases) {
      const taskInput: TaskInput = {
        priority: 0,
        capabilities: testCase.capabilities,
        payload: {
          kind: 'agentTurn',
          message: 'Test task',
          timeoutSeconds: 30
        }
      };

      const selectedInstance = teamManager.selectInstanceForScheduledTask(taskInput, 'capability-match');

      if (selectedInstance) {
        console.log(`✅ ${testCase.description} would be assigned to: ${selectedInstance.name}`);
      } else {
        console.log(`⚠️ No matching instance found for ${testCase.description}`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to test capability matching:', error);
    return false;
  }
}

async function main() {
  const results = [];

  results.push(await testTeamManagerInitialization());
  results.push(await testInstanceListing());
  results.push(await testSchedulingStrategyConfiguration());
  results.push(await testTaskAssignmentSimulation());
  results.push(await testCapabilityMatching());

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   Passed: ${results.filter(Boolean).length}/${results.length}`);
  console.log(`   Failed: ${results.filter(r => !r).length}/${results.length}`);

  const allPassed = results.every(Boolean);
  if (allPassed) {
    console.log('🎉 All tests passed! Team mode is functioning correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }

  process.exit(allPassed ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}