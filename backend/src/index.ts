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

// CORS Configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3001',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization']
};

// Manual CORS middleware for all routes
app.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://nusakas.app',
    'https://meant-serves-voting-catalog.trycloudflare.com',
    'http://localhost:3001',
    'http://localhost:3000'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
    res.setHeader('Vary', 'Origin');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  
  next();
});

// Middleware
app.use(cors(corsOptions));
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

// Detailed health check for monitoring
app.get('/health/detailed', (_req: Request, res: Response) => {
  const waConnected = whatsappService.isConnected();
  const reminderRunning = reminderService.isRunning();
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  const health = {
    status: waConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    services: {
      whatsapp: waConnected ? 'connected' : 'disconnected',
      reminder: reminderRunning ? 'running' : 'stopped',
    },
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    },
  };

  res.status(waConnected ? 200 : 503).json(health);
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
