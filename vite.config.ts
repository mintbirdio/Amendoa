import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        content: 'src/content/index.tsx',
        injector: 'src/content/injector.ts',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        format: 'es', // Use ES modules
      }
    },
    minify: false,
    emptyOutDir: true,
  }
});
