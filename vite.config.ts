import { defineConfig } from 'vite';

export default defineConfig({
  // chemins relatifs : le site fonctionne aussi dans un sous-dossier
  base: './',
  worker: { format: 'es' },
  build: {
    // three.js représente l'essentiel du bundle
    chunkSizeWarningLimit: 1000,
  },
});
