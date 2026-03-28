/**
 * Test Environment Setup Script for OpenClaw Team Mode
 * Usage: node setup-test-env.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { setupStandardInstancePool, cleanupAllInstances } from '../utils/instance-helper.ts';

// IPC handler mock/wrapper
const ipc = {
  invoke: async (channel: string, ...args: any[]) => {
    console.log(`IPC Invoke: ${channel}`, args);
    return { success: true };
  }
};

/**
 * Load test environment configuration
 */
async function loadTestConfig() {
  const configPath = path.join(__dirname, '../config/test-env.config.json');
  const configContent = await fs.readFile(configPath, 'utf8');
  return JSON.parse(configContent);
}

/**
 * Clean user data directory (simulated)
 */
async function cleanUserData() {
  console.log('🧹 Cleaning user data directory...');
  // In actual implementation, this would clear the application user data folder
  // For test purposes, we just cleanup existing instances
  await cleanupAllInstances();
  console.log('✅ User data cleaned');
}

/**
 * Configure team mode settings
 */
async function configureTeamMode(config: any) {
  console.log('⚙️ Configuring team mode settings...');
  const response = await ipc.invoke('openClawTeam:updateConfig', {
    config: config.teamConfig
  });

  if (!response.success) {
    throw new Error(`Failed to configure team mode: ${response.error}`);
  }

  console.log('✅ Team mode configured successfully');
  console.log(`   - Enabled: ${config.teamConfig.enabled}`);
  console.log(`   - Scheduling strategy: ${config.teamConfig.schedulingStrategy}`);
  console.log(`   - Auto-restart: ${config.teamConfig.autoRestart}`);
}

/**
 * Run pre-test sanity checks
 */
async function runSanityChecks() {
  console.log('🔍 Running pre-test sanity checks...');

  // Check team mode is enabled
  const configResponse = await ipc.invoke('openClawTeam:getConfig');
  if (!configResponse.success || !configResponse.config?.enabled) {
    throw new Error('Team mode is not enabled');
  }

  // Check all instances are running
  const instancesResponse = await ipc.invoke('openClawTeam:listInstances');
  if (!instancesResponse.success || instancesResponse.instances?.length !== 4) {
    throw new Error(`Expected 4 instances, found ${instancesResponse.instances?.length || 0}`);
  }

  const instances = instancesResponse.instances;
  for (const instance of instances) {
    if (instance.status !== 'idle') {
      throw new Error(`Instance ${instance.name} is not idle (status: ${instance.status})`);
    }
  }

  // Test task submission
  console.log('   Testing task submission...');
  const taskResponse = await ipc.invoke('openClawTeam:submitTask', {
    input: {
      priority: 0,
      payload: {
        kind: 'agentTurn',
        message: 'Say hello world',
        timeoutSeconds: 10
      }
    }
  });

  if (!taskResponse.success) {
    throw new Error(`Failed to submit test task: ${taskResponse.error}`);
  }

  console.log('✅ All sanity checks passed');
}

/**
 * Main setup function
 */
async function main() {
  try {
    console.log('🚀 Starting OpenClaw Team Mode test environment setup...\n');

    const config = await loadTestConfig();

    // Step 1: Clean environment
    if (config.testEnvironment.cleanUserDataBeforeRun) {
      await cleanUserData();
    }

    // Step 2: Setup instance pool
    console.log('\n🖥️ Setting up test instance pool...');
    const instances = await setupStandardInstancePool();
    console.log(`✅ Created ${instances.length} test instances:`);
    instances.forEach((inst: any) => {
      console.log(`   - ${inst.name} (${inst.type}): [${inst.capabilities.join(', ')}]`);
    });

    // Step 3: Configure team mode
    await configureTeamMode(config);

    // Step 4: Run sanity checks
    await runSanityChecks();

    console.log('\n🎉 Test environment setup completed successfully!');
    console.log('📋 Environment ready for integration testing.');
    console.log(`📍 ${instances.length} instances running in idle state.`);

  } catch (error) {
    console.error('\n❌ Test environment setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { loadTestConfig, cleanUserData, configureTeamMode, runSanityChecks };
