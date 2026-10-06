import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode artifact` gera um único bundle (sem divisão de chunks),
// usado por scripts/build-artifact.mjs para montar a versão de página única.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  build:
    mode === 'artifact'
      ? { outDir: 'dist-artifact', cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
      : {
          rollupOptions: {
            output: { manualChunks: { charts: ['recharts'], react: ['react', 'react-dom', 'react-router-dom'] } },
          },
        },
}))
