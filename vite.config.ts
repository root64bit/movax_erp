import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && env.VITE_USE_MOCK_DATA === 'true') {
    throw new Error('VITE_USE_MOCK_DATA não pode ser ativado numa compilação de produção.')
  }
  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@app': resolve(__dirname, './src/app'),
        '@features': resolve(__dirname, './src/features'),
        '@shared': resolve(__dirname, './src/shared'),
        '@integrations': resolve(__dirname, './src/integrations'),
      },
    },
    build: {
      outDir: 'dist',
    },
    plugins: [
      tailwindcss(),
      react(),
    ],
  }
})

