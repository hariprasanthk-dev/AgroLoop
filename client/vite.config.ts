import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Target modern browsers — produces smaller, faster output than the default
    target: 'es2020',

    // Raise the chunk-size warning threshold to 600 kB (default: 500 kB).
    // recharts alone is ~400 kB; this avoids noisy build warnings that don't
    // reflect real performance issues in a code-split app.
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting — keeps vendor code stable across app deploys
         * so browser caches remain valid as long as deps don't change.
         *
         * Strategy:
         *  • react-vendor   — React + React DOM + React Router (always needed)
         *  • zustand        — state management (small, kept separate for clarity)
         *  • charts         — recharts (heavy, only loaded on dashboard pages)
         *  • socket         — socket.io-client (medium, used across authed pages)
         *  • ui-libs        — lucide-react + clsx (icon/utility set)
         *  • forms          — react-hook-form + zod + @hookform/resolvers
         *  • axios          — HTTP client (tiny, but changes rarely)
         */
        manualChunks(id: string) {
          // Node modules chunking
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/react-router-dom/')
            ) {
              return 'react-vendor';
            }
            if (id.includes('/zustand/')) {
              return 'zustand';
            }
            if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-')) {
              return 'charts';
            }
            if (id.includes('/socket.io-client/') || id.includes('/engine.io-client/')) {
              return 'socket';
            }
            if (id.includes('/lucide-react/') || id.includes('/clsx/')) {
              return 'ui-libs';
            }
            if (
              id.includes('/react-hook-form/') ||
              id.includes('/zod/') ||
              id.includes('/@hookform/')
            ) {
              return 'forms';
            }
            if (id.includes('/axios/')) {
              return 'axios';
            }
          }
        },
      },
    },
  },
});
