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
          // Function form: always routes react/* to vendor-react first,
        // preventing lottie-react/react-easy-crop from bundling a second copy.
        manualChunks(id) {
            // React — must be first to avoid duplicate-React issues
            if (id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('/node_modules/react/jsx-runtime')) {
              return 'vendor-react';
            }
            // Framer Motion — large, isolated
            if (id.includes('/node_modules/motion/') ||
                id.includes('/node_modules/@motionone/')) {
              return 'vendor-motion';
            }
            // Tauri APIs — only load in desktop
            if (id.includes('/node_modules/@tauri-apps/')) {
              return 'vendor-tauri';
            }
            // Networking
            if (id.includes('/node_modules/socket.io-client/') ||
                id.includes('/node_modules/engine.io-client/')) {
              return 'vendor-net';
            }
            // Markdown + sanitisation
            if (id.includes('/node_modules/marked/') ||
                id.includes('/node_modules/dompurify/')) {
              return 'vendor-content';
            }
            // UI utilities (only after React is guaranteed separate)
            if (id.includes('/node_modules/lucide-react/') ||
                id.includes('/node_modules/lottie-react/') ||
                id.includes('/node_modules/@lottiefiles/') ||
                id.includes('/node_modules/@dnd-kit/') ||
                id.includes('/node_modules/react-easy-crop/')) {
              return 'vendor-ui';
            }
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
