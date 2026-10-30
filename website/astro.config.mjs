import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://shipnote.abhiudayg.dev',
  vite: {
    plugins: [tailwindcss()],
  },
});
