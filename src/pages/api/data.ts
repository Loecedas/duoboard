import type { APIRoute } from 'astro';
import type { CacheEntry, UserData } from '../../types';
import { transformDuolingoData } from '../../services/duolingoService';
import { getEnv, jsonResponse, createAuthChecker } from '../../utils/api-helpers';

export const prerender = false;

const DUOLINGO_BASE_URL = 'https://www.duolingo.com';
const CACHE_TTL = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

const cache = new Map<string, CacheEntry<UserData>>();

const checkToken = createAuthChecker(() => getEnv('API_SECRET_TOKEN'));

async function fetchWithTimeout(url: string, headers: HeadersInit, timeoutMs = DEFAULT_TIMEOUT, options: RequestInit = {}): Promise<{ data: unknown; status: number; text?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      ...options
    });
    clearTimeout(timeoutId);
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { data, status: res.status, text: text.substring(0, 1000) };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { data: null, status: 0, text: err.message };
  }
}

function extractUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    let json = '';
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(padded, 'base64').toString('utf8');
    } else if (typeof atob !== 'undefined') {
      json = decodeURIComponent(
        Array.prototype.map.call(atob(padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
    }
    const payload = JSON.parse(json);
    const sub = payload.sub || payload.id || payload.userId || payload.user_id;
    return sub ? String(sub) : null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ request }) => {
  if (!checkToken(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userTimeZone = request.headers.get('x-user-timezone') || DEFAULT_TIMEZONE;
  const username = getEnv('DUOLINGO_USERNAME');
  const jwt = getEnv('DUOLINGO_JWT');

  if (!username) {
    return jsonResponse({ error: 'Not configured' }, 400);
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('force') === 'true';

  const cacheKey = `user:${username}:tz:${userTimeZone}`;
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return jsonResponse({ data: cached.data, cached: true }, 200, { cacheControl: 'private, max-age=60' });
  }

  const publicHeaders: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.duolingo.com/',
  };

  const cleanJwt = jwt ? jwt.trim() : '';
  const decodedJwt = cleanJwt ? (() => { try { return decodeURIComponent(cleanJwt); } catch { return cleanJwt; } })() : '';
  const preExtractedUserId = decodedJwt ? extractUserIdFromJwt(decodedJwt) : null;

  // 完整的 Web App 请求头 - 与探测脚本一致（探测脚本确认这套 headers 能通过 403 限制）
  const authHeaders: HeadersInit = decodedJwt
    ? {
      ...publicHeaders,
      'Cookie': `jwt_token=${decodedJwt}`,
      'Referer': 'https://www.duolingo.com/learn',
      'Origin': 'https://www.duolingo.com',
      'Duolingo-Platform': 'web',
      'app-platform': 'WebPlayer',
      'x-duolingo-language': 'zh-CN',
      'x-duolingo-referrer': 'https://www.duolingo.com/learn',
    }
    : publicHeaders;

  try {
    let publicData: any = null;
    let amebaResultData: any = null;
    let xpSummariesData: any = null;
    let fieldsData: any = null;
    let targetUserId = preExtractedUserId;

    // 🚀 性能取长补短：若已从 JWT 解析出 userId，直接全并发发起所有请求，消除原本 2 次串行等待
    if (decodedJwt && targetUserId) {
      const [profileSettled, amebaSettled, xpSettled, fieldsSettled] = await Promise.allSettled([
        // 1. 2017 公开基础档案
        fetchWithTimeout(`${DUOLINGO_BASE_URL}/2017-06-30/users?username=${username}`, publicHeaders, 8000),
        // 2. 2023 Ameba 架构接口：明确请求核心档案、totalXp、sessionCount 以及多科目与当前状态
        fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2023-05-23/users/${targetUserId}?fields=id,username,name,picture,streak,creationDate,totalXp,sessionCount,courses,currentCourse,fromLanguage,learningLanguage,trackingProperties,monthlyXp,weeklyXp,xpGains`,
          authHeaders, 8000
        ),
        // 3. 2017 历史 XP 流水 (包含每日真实 totalSessionTime)
        fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${targetUserId}/xp_summaries?startDate=1970-01-01`,
          authHeaders, 12000
        ),
        // 4. 2017 账户资产与段位 (合并 gems,lingots,trackingProperties,totalXp,totalSessionTime 为单个网络请求)
        fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${targetUserId}?fields=gems,lingots,trackingProperties,totalXp,total_xp,totalTime,totalSessionTime`,
          authHeaders, 8000
        )
      ]);

      if (profileSettled.status === 'fulfilled' && profileSettled.value.status === 200 && profileSettled.value.data) {
        const raw = profileSettled.value.data as any;
        publicData = raw?.users?.[0] || (raw && !raw.users ? raw : null);
      }

      // 🛡️ 容灾互补兜底：若 2017 公开用户名接口被 Cloudflare 拦截 (403/429)，用带凭证的 2017 users/{id} 救回基础档案
      if (!publicData) {
        const authedUserResult = await fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${targetUserId}`,
          authHeaders, 8000
        );
        if (authedUserResult.status === 200 && authedUserResult.data) {
          const raw = authedUserResult.data as any;
          publicData = raw?.users?.[0] || (raw && !raw.users ? raw : null);
        }
      }

      if (amebaSettled.status === 'fulfilled' && amebaSettled.value.status === 200 && amebaSettled.value.data) {
        amebaResultData = amebaSettled.value.data;
      }

      // 🛡️ 终极容灾降级：若 2017 所有接口均无法获取，但 2023 Ameba 成功返回，直接将 2023 数据作为 publicData
      if (!publicData && amebaResultData) {
        publicData = amebaResultData;
      }
      if (xpSettled.status === 'fulfilled' && xpSettled.value.status === 200 && xpSettled.value.data) {
        xpSummariesData = (xpSettled.value.data as any)?.summaries;
      }
      if (fieldsSettled.status === 'fulfilled' && fieldsSettled.value.status === 200 && fieldsSettled.value.data) {
        fieldsData = fieldsSettled.value.data;
      }
    } else {
      // 未知 userId 或无 JWT：先查询 2017 公开用户名接口
      const v2Url = `${DUOLINGO_BASE_URL}/2017-06-30/users?username=${username}`;
      const v2Result = await fetchWithTimeout(v2Url, publicHeaders);
      const v2Raw = v2Result.data as any;
      publicData = v2Raw?.users?.[0] || (v2Raw && !v2Raw.users ? v2Raw : null);

      if (publicData) {
        targetUserId = publicData.id || publicData.user_id;
      }

      // 若有 JWT 但未提前解析出 userId，在此拿到 userId 后并发获取子接口
      if (decodedJwt && targetUserId) {
        const [amebaSettled, xpSettled, fieldsSettled] = await Promise.allSettled([
          fetchWithTimeout(
            `${DUOLINGO_BASE_URL}/2023-05-23/users/${targetUserId}?fields=id,username,name,picture,streak,creationDate,totalXp,sessionCount,courses,currentCourse,fromLanguage,learningLanguage,trackingProperties,monthlyXp,weeklyXp,xpGains`,
            authHeaders, 8000
          ),
          fetchWithTimeout(
            `${DUOLINGO_BASE_URL}/2017-06-30/users/${targetUserId}/xp_summaries?startDate=1970-01-01`,
            authHeaders, 12000
          ),
          fetchWithTimeout(
            `${DUOLINGO_BASE_URL}/2017-06-30/users/${targetUserId}?fields=gems,lingots,trackingProperties,totalXp,total_xp,totalTime,totalSessionTime`,
            authHeaders, 8000
          )
        ]);

        if (amebaSettled.status === 'fulfilled' && amebaSettled.value.status === 200 && amebaSettled.value.data) {
          amebaResultData = amebaSettled.value.data;
        }
        if (xpSettled.status === 'fulfilled' && xpSettled.value.status === 200 && xpSettled.value.data) {
          xpSummariesData = (xpSettled.value.data as any)?.summaries;
        }
        if (fieldsSettled.status === 'fulfilled' && fieldsSettled.value.status === 200 && fieldsSettled.value.data) {
          fieldsData = fieldsSettled.value.data;
        }
      }
    }

    if (!publicData && amebaResultData) {
      publicData = amebaResultData;
    }

    if (!publicData) {
      return jsonResponse({ error: 'Failed to fetch user data from Duolingo.' }, 500);
    }

    let userData: any = { ...publicData };

    // 注入 2023 Ameba 架构的新多科目课程、当前学习状态、官方经验与时长
    if (amebaResultData) {
      if (amebaResultData.courses) userData._amebaCourses = amebaResultData.courses;
      if (amebaResultData.currentCourse) userData._amebaCurrentCourse = amebaResultData.currentCourse;
      if (typeof amebaResultData.totalXp === 'number') userData._amebaTotalXp = amebaResultData.totalXp;
      if (typeof amebaResultData.xp === 'number') userData._amebaTotalXp = userData._amebaTotalXp ?? amebaResultData.xp;
      if (typeof amebaResultData.sessionCount === 'number') userData._amebaSessionCount = amebaResultData.sessionCount;
      if (typeof amebaResultData.totalTime === 'number') userData._amebaTotalTime = amebaResultData.totalTime;
      if (typeof amebaResultData.timeSpent === 'number') userData._amebaTimeSpent = amebaResultData.timeSpent;
    }

    // 注入 2017 XP 历史 (每条含官方统计的 gainedXp 与 totalSessionTime)
    if (xpSummariesData) {
      userData._xpSummaries = xpSummariesData;
    }

    // 注入真实宝石/红宝石资产与显式接口经验/时长
    if (fieldsData) {
      if (typeof fieldsData.gems === 'number') {
        userData._inventoryGems = fieldsData.gems;
      } else if (typeof fieldsData.lingots === 'number') {
        userData._inventoryGems = fieldsData.lingots;
      }
      if (typeof fieldsData.totalXp === 'number') userData._fieldsTotalXp = fieldsData.totalXp;
      if (typeof fieldsData.total_xp === 'number') userData._fieldsTotalXp = fieldsData.total_xp;
      if (typeof fieldsData.totalTime === 'number') userData._fieldsTotalTime = fieldsData.totalTime;
      if (typeof fieldsData.totalSessionTime === 'number') userData._fieldsTotalTime = fieldsData.totalSessionTime;
    }

    // 注入段位：优先从 2017 fields 获取，亦可从 2023 trackingProperties 互补提取
    const tracking = fieldsData?.trackingProperties || amebaResultData?.trackingProperties;
    if (tracking) {
      if (typeof tracking.leaderboard_league === 'number') {
        userData._leaderboardTier = tracking.leaderboard_league;
      } else if (typeof tracking.league_tier === 'number') {
        userData._leaderboardTier = tracking.league_tier;
      }
    }

    const transformed = transformDuolingoData(userData, userTimeZone);

    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(cacheKey, { data: transformed, timestamp: Date.now() });

    return jsonResponse({ data: transformed }, 200, { cacheControl: 'private, max-age=60' });

  } catch (error: unknown) {
    console.error(`[FATAL] Global Error:`, error);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
};
