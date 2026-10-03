/**
 * 公共 API 工具函数
 * 用于消除 API 端点之间的代码重复
 */

let cfWorkersEnv: Record<string, string> = {};

// ⚡ Astro v6 官方标准：Cloudflare Workers 运行时环境变量来自 'cloudflare:workers'
try {
  // @ts-ignore
  const cfModule = await import('cloudflare:workers');
  if (cfModule && cfModule.env) {
    cfWorkersEnv = cfModule.env;
  }
} catch {
  // 非 Cloudflare Workers 运行时（如本地 Node.js、Vercel、Netlify），安全忽略
}

/**
 * 获取环境变量，兼容 Astro v6 (cloudflare:workers)、Node.js、Vercel、Netlify 等各类运行时
 */
export function getEnv(key: string, requestLocals?: unknown): string {
  // 1. Astro v6 Cloudflare Workers 官方运行时环境：从 cloudflare:workers 的 env 获取
  if (cfWorkersEnv && typeof cfWorkersEnv[key] === 'string' && cfWorkersEnv[key].trim() !== '') {
    return cfWorkersEnv[key].trim();
  }

  // 2. 从 Node.js 运行时 process.env 中获取
  if (typeof process !== 'undefined' && process.env && process.env[key] && process.env[key].trim() !== '') {
    return process.env[key].trim();
  }

  // 3. 从 Vite 构建注入环境 import.meta.env 中获取
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as Record<string, string>)[key]) {
    const v = (import.meta.env as Record<string, string>)[key];
    if (typeof v === 'string' && v.trim() !== '') {
      return v.trim();
    }
  }

  // 4. 从 globalThis 中直接获取
  if (typeof globalThis !== 'undefined' && (globalThis as any)[key] && typeof (globalThis as any)[key] === 'string') {
    return (globalThis as any)[key].trim();
  }

  return '';
}

/**
 * 创建 JSON 响应
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  options?: { cacheControl?: string }
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
  if (options?.cacheControl) {
    headers['Cache-Control'] = options.cacheControl;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

// 重新导出 auth-helpers 的函数
export { createAuthChecker, timingSafeEqual } from './auth-helpers';
