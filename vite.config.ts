import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    console.log('[VITE] Loaded environment variables:');
    console.log('[VITE] VITE_API_URL from env:', env.VITE_API_URL);
    console.log('[VITE] All VITE_ vars:', Object.keys(env).filter(key => key.startsWith('VITE_')));
    
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
        allowedHosts: [
          'localhost',
          '127.0.0.1',
          '.trycloudflare.com',
          '.ngrok.io',
          '.localtunnel.me'
        ]
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3000/api'),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3000/api')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
