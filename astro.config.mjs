import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

const isDev = process.env.NODE_ENV !== 'production';
const adapter = isDev
  ? undefined
  : (process.env.NETLIFY ? netlify() : vercel());

export default defineConfig({
  output: 'server',
  adapter,
  integrations: [
    react(),
  ],
  vite: {
    optimizeDeps: {
      include: ['react-is', 'recharts'],
    },
  },
});
