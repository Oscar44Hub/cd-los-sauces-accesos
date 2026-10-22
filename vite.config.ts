import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funciona igual en GitHub Pages (subcarpeta) que en un dominio propio
export default defineConfig({
  base: './',
  plugins: [react()],
});
