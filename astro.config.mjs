import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import netlify from '@astrojs/netlify';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

function getAdapter() {
  if (process.env.NETLIFY) return netlify();
  if (process.env.VERCEL) return vercel();
  // 默认生产适配器使用 Cloudflare，完全兼容 Cloudflare Pages / Workers
  return cloudflare({
    imageService: 'passthrough',
  });
}

export default defineConfig({
  output: 'server',
  adapter: getAdapter(),
  integrations: [
    react(),
  ],
  vite: {
    optimizeDeps: {
      include: ['react-is', 'recharts'],
    },
  },
});
