import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Havok ships a wasm file that Vite's dependency pre-bundler cannot handle.
  optimizeDeps: { exclude: ['@babylonjs/havok'] },
  server: { host: true, port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
});
