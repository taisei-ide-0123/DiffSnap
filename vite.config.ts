import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { crx } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // @crxjs/vite-plugin handles all Chrome extension build requirements
    // including proper bundling of content/background scripts without import errors
    crx({ manifest }),
  ],
  build: {
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'esbuild' : false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
}))
