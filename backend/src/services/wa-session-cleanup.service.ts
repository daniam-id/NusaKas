import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const WA_SESSION_PATH = env.WA_SESSION_PATH || '.wa-session';
const PROTECTED_FILES = ['creds.json'];

class WASessionCleanupService {
  private isRunning = false;

  start() {
    // Run every 6 hours: 0 */6 * * *
    cron.schedule('0 */6 * * *', () => {
      this.cleanup();
    });

    console.log('[WA-Cleanup] Session cleanup scheduler started (every 6 hours)');
    
    // Run once on startup after 1 minute
    setTimeout(() => this.cleanup(), 60 * 1000);
  }

  async cleanup() {
    if (this.isRunning) {
      console.log('[WA-Cleanup] Cleanup already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[WA-Cleanup] Starting session cleanup...');

    try {
      const sessionPath = path.resolve(WA_SESSION_PATH);
      
      if (!fs.existsSync(sessionPath)) {
        console.log('[WA-Cleanup] Session folder not found, skipping');
        return;
      }

      const files = fs.readdirSync(sessionPath);
      let deletedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        if (PROTECTED_FILES.includes(file)) {
          skippedCount++;
          continue;
        }

        const filePath = path.join(sessionPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        } else if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true });
          deletedCount++;
        }
      }

      console.log(`[WA-Cleanup] Completed: ${deletedCount} deleted, ${skippedCount} protected`);
    } catch (error) {
      console.error('[WA-Cleanup] Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Manual trigger
  async runNow() {
    await this.cleanup();
  }
}

export const waSessionCleanupService = new WASessionCleanupService();
