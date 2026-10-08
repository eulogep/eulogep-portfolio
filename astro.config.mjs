import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import process from 'node:process';

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_ORIGIN,
  vite: {
    build: { assetsInlineLimit: 0 },
    plugins: [tailwindcss()],
  },
});
