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
    build: {
      // Target modern Chromium/WebKit (Tauri 2 minimum)
      target: ['es2020', 'chrome105', 'safari15'],
      // Raise warning threshold — we know the app is large
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // React core — changes rarely, cache-stable
            'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
            // Framer Motion — large, isolated
            'vendor-motion': ['motion'],
            // Tauri APIs — only load in desktop
            'vendor-tauri': [
              '@tauri-apps/api',
              '@tauri-apps/plugin-updater',
              '@tauri-apps/plugin-shell',
              '@tauri-apps/plugin-process',
              '@tauri-apps/plugin-autostart',
              '@tauri-apps/plugin-notification',
              '@tauri-apps/plugin-fs',
            ],
            // UI utilities
            'vendor-ui': [
              'lucide-react',
              'lottie-react',
              '@dnd-kit/core',
              '@dnd-kit/sortable',
              '@dnd-kit/utilities',
              'react-easy-crop',
            ],
            // Markdown + sanitisation
            'vendor-content': ['marked', 'dompurify'],
            // Networking
            'vendor-net': ['socket.io-client'],
          },
        },
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
