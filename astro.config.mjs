// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://siteintelica.com',
  output: 'server',
  integrations: [sitemap()],
  security: {
    checkOrigin: false
  },
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    ssr: {
      external: ['@google/generative-ai']
    },
    build: {
      rollupOptions: {
        external: ['@google/generative-ai']
      }
    }
  }
});