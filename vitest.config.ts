import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        // Exclude only entry point index files, not utility index.ts
        'src/popup/main.tsx',
        'src/settings/main.tsx',
        'src/background/index.ts',
        'src/content/index.ts',
        // Exclude UI components not yet tested (Week 4 implementation)
        'src/popup/App.tsx',
        'src/settings/App.tsx',
        // Exclude shared utils index (will be tested when used)
        'src/shared/utils/index.ts',
      ],
      // MVP目標: 80%カバレッジ (CLAUDE.md Section 9.3参照)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
