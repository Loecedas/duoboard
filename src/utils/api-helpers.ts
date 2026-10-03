/**
 * 公共 API 工具函数
 * 用于消除 API 端点之间的代码重复
 */

/**
 * 获取环境变量，兼容 Node.js、Cloudflare Workers/Pages、Vite 等各类运行时
 */
export function getEnv(key: string): string {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as Record<string, string>)[key]) {
    return (import.meta.env as Record<string, string>)[key];
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
    return String((globalThis as any)[key]);
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
