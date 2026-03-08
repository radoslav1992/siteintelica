// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://siteintelica.com',
  output: 'server',
  integrations: [sitemap()],
  adapter: node({
    mode: 'standalone'
  })
});