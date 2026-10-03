import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async function (context, next) {
  // Astro v6 中 Cloudflare 环境变量已由 cloudflare:workers 接管，无需在 locals.runtime.env 中手动解构
  const response = await next();
  return response;
};
