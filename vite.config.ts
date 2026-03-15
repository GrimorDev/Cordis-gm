import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    // Tauri: don't clear the terminal so cargo output is visible
    clearScreen: false,
    // Expose VITE_ and TAURI_ prefixed env vars to the app
    envPrefix: ['VITE_', 'TAURI_'],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      // Tauri needs a fixed port — fail instead of trying another
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      // Dev proxy: forward API/socket calls to backend
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
          ws: true,
        },
        '/uploads': {
          target: env.VITE_BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
