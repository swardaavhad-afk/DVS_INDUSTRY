import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Proxy /api requests to the backend dev server
  server: {
    proxy: {
      '/api': {
        target:      backendUrl,
        changeOrigin: true,
        secure:       false,
      },
      // Also proxy /uploads (profile images served by backend)
      '/uploads': {
        target:      backendUrl,
        changeOrigin: true,
        secure:       false,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          charts: ['recharts'],
          vendor: ['axios', 'date-fns', 'lucide-react', 'sonner'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
