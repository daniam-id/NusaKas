import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { env, validateEnv } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import statsRoutes from './routes/stats.routes.js';
import reportRoutes from './routes/report.routes.js';
import registerRoutes from './routes/register.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import { whatsappService } from './whatsapp/index.js';
import { reminderService } from './services/reminder.service.js';

// Initialize global WhatsApp socket (will be set by WhatsApp bot module)
global.waSock = null;

// Validate environment before starting
validateEnv();

const app: Express = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://nusakas.app'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes placeholder
app.get('/api', (_req: Request, res: Response) => {
  res.json({ 
    message: 'NusaKas API v1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      stats: '/api/stats',
      transactions: '/api/transactions',
      report: '/api/report/download',
      register: '/api/register/start',
      settings: '/api/settings',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(env.PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════╗
║       NusaKas Backend Server              ║
╠═══════════════════════════════════════════╣
║  Status:  Running                         ║
║  Port:    ${env.PORT.toString().padEnd(33)}║
║  Env:     ${env.NODE_ENV.padEnd(33)}║
╚═══════════════════════════════════════════╝
  `);

  // Start WhatsApp bot connection
  try {
    console.log('[WA] Starting WhatsApp bot...');
    await whatsappService.connect();

    // Initialize reminder service with WhatsApp send function
    reminderService.setSendMessageFn(async (waNumber: string, text: string) => {
      const jid = `${waNumber}@s.whatsapp.net`;
      await whatsappService.sendMessage(jid, { text });
    });

    // Start reminder scheduler
    reminderService.startScheduler();
  } catch (error) {
    console.error('[WA] Failed to start WhatsApp bot:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  reminderService.stopScheduler();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app };
