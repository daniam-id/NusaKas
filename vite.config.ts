import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    console.log('[VITE] Production configuration loaded');
    console.log('[VITE] Using Cloudflare API endpoint exclusively');
    console.log('[VITE] All VITE_ vars:', Object.keys(env).filter(key => key.startsWith('VITE_')));
    
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
        allowedHosts: [
          'localhost',
          '127.0.0.1',
          '.trycloudflare.com'
        ]
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_USE_CLOUDFLARE_API': JSON.stringify(env.VITE_USE_CLOUDFLARE_API || 'true'),
        'process.env.VITE_USE_CLOUDFLARE_API': JSON.stringify(env.VITE_USE_CLOUDFLARE_API || 'true')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
