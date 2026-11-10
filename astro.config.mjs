import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // GitHub Pages отдаёт сайт из подпапки /<репозиторий>/; локально BASE_PATH не задан
  base: process.env.BASE_PATH || '/',
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
