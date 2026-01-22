/**
 * PocketBase Sync Service
 *
 * Each user runs their own PocketBase instance
 * All their devices connect to their personal PocketBase
 */

import PocketBase from 'pocketbase';

interface PocketBaseConfig {
  url: string;      // User's PocketBase URL (e.g., http://192.168.1.100:8090)
  email: string;    // Their admin email
  password: string; // Their admin password
}

class PocketBaseSyncService {
  private pb: PocketBase | null = null;
  private config: PocketBaseConfig | null = null;

  /**
   * Initialize connection to user's personal PocketBase
   */
  async initialize(config: PocketBaseConfig) {
    this.config = config;
    this.pb = new PocketBase(config.url);

    // Authenticate
    await this.pb.collection('users').authWithPassword(
      config.email,
      config.password
    );

    // Set up real-time subscriptions
    this.setupRealtimeSync();

    console.log('✅ Connected to your personal PocketBase');
  }

  /**
   * Real-time sync - updates instantly across all devices
   */
  private setupRealtimeSync() {
    // Subscribe to tasks changes
    this.pb?.collection('tasks').subscribe('*', (e) => {
      console.log('Task updated:', e.action, e.record);

      if (e.action === 'create') {
        // New task created on another device
        this.handleRemoteTaskCreate(e.record);
      } else if (e.action === 'update') {
        // Task updated on another device
        this.handleRemoteTaskUpdate(e.record);
      } else if (e.action === 'delete') {
        // Task deleted on another device
        this.handleRemoteTaskDelete(e.record.id);
      }
    });

    // Subscribe to domains changes
    this.pb?.collection('domains').subscribe('*', (e) => {
      console.log('Domain updated:', e.action, e.record);
      // Handle domain changes
    });
  }

  /**
   * Create a new task (syncs to all devices automatically)
   */
  async createTask(task: {
    taskName: string;
    status: string;
    taskPriority: string;
    dueDate?: Date;
    recurrence?: string;
    actionPoints?: number;
    notes?: string;
    domainId?: string;
  }) {
    const record = await this.pb?.collection('tasks').create({
      ...task,
      userId: this.pb?.authStore.model?.id, // Link to user
    });

    return record;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: any) {
    const record = await this.pb?.collection('tasks').update(taskId, updates);
    return record;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string) {
    await this.pb?.collection('tasks').delete(taskId);
  }

  /**
   * Get all tasks
   */
  async getTasks(filter?: string) {
    const records = await this.pb?.collection('tasks').getFullList({
      filter: filter || `userId = "${this.pb?.authStore.model?.id}"`,
      sort: '-created',
    });

    return records;
  }

  /**
   * Mark task as done
   */
  async markTaskDone(taskId: string) {
    return this.updateTask(taskId, {
      status: 'Done',
      lastCompleted: new Date().toISOString(),
    });
  }

  /**
   * Handle remote task creation (from another device)
   */
  private async handleRemoteTaskCreate(record: any) {
    // Update UI to show new task
    // Or update local SQLite if you're using hybrid approach
    console.log('New task from another device:', record);
  }

  /**
   * Handle remote task update (from another device)
   */
  private async handleRemoteTaskUpdate(record: any) {
    console.log('Task updated on another device:', record);
  }

  /**
   * Handle remote task deletion (from another device)
   */
  private async handleRemoteTaskDelete(taskId: string) {
    console.log('Task deleted on another device:', taskId);
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.pb !== null && this.pb.authStore.isValid;
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.pb?.collection('tasks').unsubscribe();
    this.pb?.collection('domains').unsubscribe();
    this.pb?.authStore.clear();
  }
}

export const pocketbaseSync = new PocketBaseSyncService();

/**
 * Helper: Save user's PocketBase config
 */
export async function savePocketBaseConfig(config: PocketBaseConfig) {
  // Save to AsyncStorage (React Native) or localStorage (Web)
  await AsyncStorage.setItem('pocketbase_config', JSON.stringify(config));
}

/**
 * Helper: Load user's PocketBase config
 */
export async function loadPocketBaseConfig(): Promise<PocketBaseConfig | null> {
  const configStr = await AsyncStorage.getItem('pocketbase_config');
  return configStr ? JSON.parse(configStr) : null;
}
