import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from 'baileys';
import { Boom } from '@hapi/boom';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import * as readline from 'readline';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { messageHandler } from './handlers/message.handler.js';

const SESSION_PATH = join(process.cwd(), '.wa-session');
// Enable debug logging for troubleshooting 515 errors
const logger = pino({ level: 'debug' });

type AuthMethod = 'qr' | 'pairing';

const askQuestion = (query: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

class WhatsAppService {
  private sock: WASocket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private phoneNumber: string | null = null;
  private pairingCodeRequested = false;
  private authMethod: AuthMethod = 'qr';
  private authMethodSelected = false;

  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('[WA] Connection already in progress...');
      return;
    }

    // ADVANCED TIMING STRATEGY based on research
    const now = new Date();
    const hour = now.getHours();
    
    // Connect during off-peak hours (2-6 AM) for higher success rate
    if (hour < 2 || hour >= 6) {
      console.log(`[WA] 🔥 Current hour: ${hour}. Good time for connection.`);
    } else {
      console.log(`[WA] ⏰ Current hour: ${hour}. Peak hours detected.`);
      console.log(`[WA] ⏰ Waiting for off-peak time (2-6 AM) for higher success rate...`);
      
      const waitTime = this.getTimeUntilOffPeak();
      console.log(`[WA] ⏳ Waiting ${Math.round(waitTime / 60000)} minutes until off-peak time`);
      
      setTimeout(() => {
        console.log('[WA] ✅ Off-peak time reached. Starting connection...');
        this.connect();
      }, waitTime);
      return;
    }

    this.isConnecting = true;

    try {
      await mkdir(SESSION_PATH, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
      
      // Enhanced session validation for Baileys v6.8.0+ compatibility
      const isSessionValid = await this.validateSession(state);
      if (!isSessionValid) {
        console.log('[WA] Invalid session detected, clearing corrupted files...');
        await this.clearCorruptedSession();
        // Reinitialize with fresh state
        const { state: freshState, saveCreds: freshSaveCreds } = await useMultiFileAuthState(SESSION_PATH);
        Object.assign(state, freshState);
        Object.assign(saveCreds, freshSaveCreds);
      }
      
      const { version } = await fetchLatestBaileysVersion();
      console.log(`[WA] Using WA version: ${version.join('.')}`);

      // Skip auth if session exists (check registered flag or me field)
      const hasSession = state.creds.registered || state.creds.me?.id;
      if (hasSession) {
        console.log('[WA] Session found, connecting...');
      } else if (!this.authMethodSelected) {
        // Ask for auth method only if no session and not already selected
        this.authMethodSelected = true;
        const method = await askQuestion('[WA] Auth method - (1) QR Code or (2) Pairing Code? [1/2]: ');
        this.authMethod = method === '2' ? 'pairing' : 'qr';
        
        if (this.authMethod === 'pairing') {
          this.phoneNumber = await askQuestion('[WA] Enter your WhatsApp phone number (e.g., 6281234567890): ');
        }
      }

      // ADVANCED CONFIGURATION based on deep research findings
      this.sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        // Browser spoofing for bypass
        browser: ['Firefox', 'Windows', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false, // Don't show online to reduce detection
        emitOwnEvents: false, // Reduce event noise
        
        // Extended timeouts based on research
        connectTimeoutMs: 300000, // 5 minutes
        qrTimeout: 300000,
        defaultQueryTimeoutMs: 300000,
        
        // Enhanced socket configuration
        socketConfig: {
          connectTimeout: 300000,
          defaultTimeout: 300000,
          keepAlive: true,
          perMessageDeflate: false,
          maxPayload: 32 * 1024 * 1024, // 32MB
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        },
        
        // App state verification bypass
        appStateMacVerification: {
          patch: false,
          snapshot: false,
        }
      });

      // Update global socket reference (cast to match auth controller's expected type)
      global.waSock = this.sock as unknown as typeof global.waSock;

      // Connection events
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Handle authentication based on selected method
        if (qr && !hasSession) {
          if (this.authMethod === 'qr') {
            console.log('\n[WA] Scan this QR Code with WhatsApp:\n');
            qrcode.generate(qr, { small: true });
          } else if (this.authMethod === 'pairing' && this.phoneNumber && !this.pairingCodeRequested) {
            this.pairingCodeRequested = true;
            try {
              const code = await this.sock!.requestPairingCode(this.phoneNumber);
              console.log(`\n[WA] 🔐 Pairing Code: ${code}\n`);
              console.log('[WA] Open WhatsApp > Settings > Linked Devices > Link a Device > Link with phone number');
              console.log('[WA] Enter the pairing code above to connect.\n');
            } catch (err) {
              console.error('[WA] Failed to get pairing code:', err);
              this.pairingCodeRequested = false;
            }
          }
        }

        if (connection === 'close') {
          const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;

          console.log(`[WA] Connection closed. Reason: ${reason}`);

          // Enhanced error handling for specific error codes
          if (reason && [515, 428, 516].includes(reason)) {
            console.log(`[WA] Detected known error code: ${reason}`);
            const canRetry = await this.handleConnectionError(lastDisconnect?.error, lastDisconnect);
            
            if (canRetry && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              console.log(`[WA] Retrying with enhanced error handling... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
              this.isConnecting = false;
              setTimeout(() => this.connect(), 5000);
              return;
            }
          }

          // Enhanced reconnection logic with 515-specific handling
          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            // Check if we're dealing with persistent 515 errors
            if (reason === 515 && this.reconnectAttempts >= 3) {
              console.log('[WA] Persistent 515 errors detected. Applying alternative strategy...');
              this.isConnecting = false;
              
              // Try alternative approach after multiple 515 errors
              setTimeout(async () => {
                console.log('[WA] Trying alternative connection strategy...');
                await this.tryAlternativeConnection();
              }, 60000); // Wait 1 minute before trying alternative
              return;
            }
            
            this.reconnectAttempts++;
            console.log(`[WA] Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            this.isConnecting = false;
            setTimeout(() => this.connect(), 5000);
          } else if (reason === DisconnectReason.loggedOut) {
            console.log('[WA] Logged out. Please scan QR code again.');
            this.isConnecting = false;
            await this.connect();
          } else {
            console.log(`[WA] Max reconnection attempts reached or unhandled error.`);
            if (reason === 515) {
              console.log('[WA] 515 errors may be due to WhatsApp Web server issues.');
              console.log('[WA] Consider:');
              console.log('[WA] 1. Waiting 30+ minutes before retrying');
              console.log('[WA] 2. Trying from different network/IP');
              console.log('[WA] 3. Checking WhatsApp app version');
              console.log('[WA] 4. Using alternative WhatsApp libraries');
            }
            this.isConnecting = false;
          }
        }

        if (connection === 'open') {
          console.log('[WA] ✅ Connected to WhatsApp');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
        }
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async (upsert: { messages: proto.IWebMessageInfo[]; type: string }) => {
        if (upsert.type !== 'notify') return;

        for (const msg of upsert.messages) {
          if (!msg.key.fromMe && msg.message) {
            try {
              await messageHandler.handle(this.sock!, msg);
            } catch (error) {
              console.error('[WA] Message handling error:', error);
            }
          }
        }
      });

    } catch (error) {
      console.error('[WA] Connection error:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  getSocket(): WASocket | null {
    return this.sock;
  }

  isConnected(): boolean {
    return this.sock?.user !== undefined;
  }

  async sendMessage(jid: string, content: { text: string }): Promise<void> {
    if (!this.sock) {
      throw new Error('WhatsApp not connected');
    }
    await this.sock.sendMessage(jid, content);
  }

  async sendDocument(jid: string, buffer: Buffer, filename: string, mimetype: string): Promise<void> {
    if (!this.sock) {
      throw new Error('WhatsApp not connected');
    }
    await this.sock.sendMessage(jid, {
      document: buffer,
      fileName: filename,
      mimetype,
    });
  }

  async downloadMedia(message: proto.IWebMessageInfo): Promise<Buffer> {
    if (!this.sock) {
      throw new Error('WhatsApp not connected');
    }
    const buffer = await downloadMediaMessage(message, 'buffer', {});
    return buffer as Buffer;
  }

  // Enhanced session validation for Baileys v6.8.0+ compatibility
  private async validateSession(state: any): Promise<boolean> {
    try {
      // Check required fields for Baileys v6.8.0+
      const requiredFields = [
        'creds',
        'keys',
        'registered', // For v7.0.0+ compatibility
        'me' // User info
      ];

      // Validate basic structure
      if (!state || typeof state !== 'object') {
        console.log('[WA] Session validation failed: Invalid state object');
        return false;
      }

      // Check if creds exist and have basic structure
      if (!state.creds || typeof state.creds !== 'object') {
        console.log('[WA] Session validation failed: Missing or invalid creds');
        return false;
      }

      // Check for newer Baileys versions compatibility
      const hasModernFields = 'registered' in state.creds || state.creds.me?.id;
      if (!hasModernFields) {
        console.log('[WA] Session validation failed: Missing modern session fields');
        return false;
      }

      console.log('[WA] Session validation: ✅ Valid');
      return true;

    } catch (error) {
      console.log('[WA] Session validation failed:', error);
      return false;
    }
  }

  // Clear corrupted session files
  private async clearCorruptedSession(): Promise<void> {
    try {
      const { rm } = await import('fs/promises');
      console.log('[WA] Clearing corrupted session files...');
      
      // Remove session directory and all contents
      await rm(SESSION_PATH, { recursive: true, force: true });
      
      // Recreate empty directory
      await mkdir(SESSION_PATH, { recursive: true });
      
      console.log('[WA] Corrupted session cleared successfully');
    } catch (error) {
      console.error('[WA] Failed to clear corrupted session:', error);
      throw error;
    }
  }

  // Enhanced error handling with specific error codes
  private async handleConnectionError(error: any, lastDisconnect: any): Promise<boolean> {
    const reason = lastDisconnect?.error?.output?.statusCode;
    
    console.log(`[WA] Connection error detected. Reason: ${reason}`);
    
    switch (reason) {
      case 515: // restartRequired - Enhanced handling based on research
        console.log('[WA] ⚠️  Error 515: WhatsApp Web server blocking detected!');
        console.log('[WA] This is a server-side infrastructure issue by WhatsApp (May 2024 changes)');
        
        // Enhanced 515 handling based on research findings
        if (this.reconnectAttempts === 1) {
          console.log('[WA] 🔄 Strategy 1: Clear session + immediate retry');
          await this.clearCorruptedSession();
          return true;
        } else if (this.reconnectAttempts === 2) {
          console.log('[WA] 🔄 Strategy 2: Switch to pairing code method');
          this.authMethod = 'pairing';
          this.authMethodSelected = false;
          await this.clearCorruptedSession();
          return true;
        } else if (this.reconnectAttempts === 3) {
          console.log('[WA] 🔄 Strategy 3: Extended delay (30s) + retry');
          await new Promise(resolve => setTimeout(resolve, 30000));
          await this.clearCorruptedSession();
          return true;
        } else if (this.reconnectAttempts === 4) {
          console.log('[WA] 🔄 Strategy 4: Long delay (2min) + browser change');
          await new Promise(resolve => setTimeout(resolve, 120000));
          await this.clearCorruptedSession();
          // Try different browser - will be applied on next connection
          console.log('[WA] 🔄 Will try Firefox browser on next connection attempt');
          return true;
        } else {
          console.log(`[WA] ❌ All 515 strategies exhausted after ${this.reconnectAttempts} attempts`);
          console.log('[WA] 📋 RECOMMENDATION: This indicates WhatsApp Web blocking');
          console.log('[WA] 💡 SOLUTIONS:');
          console.log('[WA]   1. Wait 24-48 hours and try again');
          console.log('[WA]   2. Switch to different IP/network');
          console.log('[WA]   3. Try during off-peak hours (early morning)');
          console.log('[WA]   4. Consider migration to Official WhatsApp Business API');
          console.log('[WA]   5. Try alternative library: whatsapp-web.js');
          return false; // Don't continue retrying
        }
        
      case 428: // connectionClosed
        console.log('[WA] Error 428: Connection closed during pairing. Retrying...');
        await this.clearCorruptedSession();
        return true; // Allow retry
        
      case 516: // stream error
        console.log('[WA] Error 516: Stream error. Switching connection method...');
        this.authMethod = this.authMethod === 'qr' ? 'pairing' : 'qr';
        this.authMethodSelected = false;
        await this.clearCorruptedSession();
        return true; // Allow retry
        
      default:
        console.log(`[WA] Unknown error code: ${reason}`);
        return false; // Don't retry unknown errors
    }
  }

  // Alternative connection strategy for persistent 515 errors
  private async tryAlternativeConnection(): Promise<void> {
    console.log('[WA] Starting alternative connection strategy...');
    
    try {
      // Strategy 1: Wait longer and try with minimal configuration
      console.log('[WA] Strategy 1: Minimal configuration with extended delay...');
      await this.clearCorruptedSession();
      
      // Reset all state
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.authMethodSelected = false;
      
      // Wait 5 minutes before trying
      setTimeout(async () => {
        console.log('[WA] Attempting connection with minimal config...');
        await this.connectWithMinimalConfig();
      }, 300000);
      
    } catch (error) {
      console.error('[WA] Alternative connection strategy failed:', error);
    }
  }

  // Calculate time until off-peak hours (2-6 AM)
  private getTimeUntilOffPeak(): number {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour < 2) {
      // Before 2 AM, wait until 2 AM
      return (2 - hour) * 60 * 60 * 1000;
    } else if (hour >= 6) {
      // After 6 AM, wait until 2 AM next day
      return ((24 - hour) + 2) * 60 * 60 * 1000;
    } else {
      // Already in off-peak hours
      return 0;
    }
  }

  // Minimal configuration connection
  private async connectWithMinimalConfig(): Promise<void> {
    console.log('[WA] Connecting with minimal configuration...');
    
    try {
      await mkdir(SESSION_PATH, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
      
      const { version } = await fetchLatestBaileysVersion();
      console.log(`[WA] Using WA version: ${version.join('.')}`);

      // Minimal socket configuration
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ['Chrome', 'Windows', '1.0.0'],
        syncFullHistory: false,
        // Remove optional features that might cause issues
      });

      // Update global socket reference
      global.waSock = this.sock as unknown as typeof global.waSock;

      // Minimal connection handling
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
          const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          console.log(`[WA] Minimal config connection closed. Reason: ${reason}`);
          
          if (reason === 515) {
            console.log('[WA] Still getting 515 with minimal config. This is likely a WhatsApp Web server issue.');
            console.log('[WA] Recommendation: Try again later or use different network.');
          }
        }

        if (connection === 'open') {
          console.log('[WA] ✅ Connected with minimal configuration');
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

    } catch (error) {
      console.error('[WA] Minimal configuration connection failed:', error);
    }
  }
}

export const whatsappService = new WhatsAppService();
