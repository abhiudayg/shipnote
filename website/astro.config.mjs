import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://shipnote.abhiuday.dev',
  vite: {
    plugins: [tailwindcss()],
  },
});
