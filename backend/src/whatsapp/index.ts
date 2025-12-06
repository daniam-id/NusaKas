import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import * as readline from 'readline';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { messageHandler } from './handlers/message.handler.js';

const SESSION_PATH = join(process.cwd(), '.wa-session');
const logger = pino({ level: 'silent' });

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

    this.isConnecting = true;

    try {
      await mkdir(SESSION_PATH, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
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

      this.sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ['NusaKas Bot', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
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

          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WA] Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            this.isConnecting = false;
            setTimeout(() => this.connect(), 5000);
          } else if (reason === DisconnectReason.loggedOut) {
            console.log('[WA] Logged out. Please scan QR code again.');
            this.isConnecting = false;
            await this.connect();
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
}

export const whatsappService = new WhatsAppService();
