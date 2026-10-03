/**
 * 公共 API 工具函数
 * 用于消除 API 端点之间的代码重复
 */

let runtimeEnv: Record<string, string> = {};

/**
 * 注入运行时环境变量（由中间件从 Cloudflare locals.runtime.env 中提取）
 */
export function setRuntimeEnv(env: Record<string, unknown>): void {
  if (!env || typeof env !== 'object') return;
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') {
      runtimeEnv[k] = v;
    }
  }
}

/**
 * 获取环境变量，兼容 Node.js、Cloudflare Workers/Pages（locals.runtime.env）、Vite 等各类运行时
 */
export function getEnv(key: string, requestLocals?: unknown): string {
  // 1. 优先从请求上下文 locals.runtime.env 获取（Cloudflare 官方端点标准）
  const localsEnv = (requestLocals as any)?.runtime?.env;
  if (localsEnv && typeof localsEnv[key] === 'string' && localsEnv[key].trim() !== '') {
    return localsEnv[key].trim();
  }

  // 2. 从中间件拦截并暂存的 runtimeEnv 中获取
  if (runtimeEnv[key] && runtimeEnv[key].trim() !== '') {
    return runtimeEnv[key].trim();
  }

  // 3. 从全局挂载的 __CF_ENV__ 获取
  const globalCf = (globalThis as any)?.__CF_ENV__;
  if (globalCf && typeof globalCf[key] === 'string' && globalCf[key].trim() !== '') {
    return globalCf[key].trim();
  }

  // 4. 从 Node.js 运行时 process.env 中获取
  if (typeof process !== 'undefined' && process.env && process.env[key] && process.env[key].trim() !== '') {
    return process.env[key].trim();
  }

  // 5. 从 Vite 构建注入环境 import.meta.env 中获取
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as Record<string, string>)[key]) {
    const v = (import.meta.env as Record<string, string>)[key];
    if (typeof v === 'string' && v.trim() !== '') {
      return v.trim();
    }
  }

  // 6. 从 globalThis 中直接获取
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
