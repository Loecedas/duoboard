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
    // 1. 获取公开基础数据
    const v2Url = `${DUOLINGO_BASE_URL}/2017-06-30/users?username=${username}`;
    const v2Result = await fetchWithTimeout(v2Url, publicHeaders);

    const v2Raw = v2Result.data as any;
    const publicData = v2Raw?.users?.[0] || (v2Raw && !v2Raw.users ? v2Raw : null);

    if (!publicData) {
      return jsonResponse({ error: `Failed to fetch user data. Duolingo returned status ${v2Result.status}` }, 500);
    }

    let userData: any = { ...publicData };
    const userId = publicData.id || publicData.user_id;

    // 有 JWT 时并行获取：XP 历史 + gems + leaderboard tier + ameba 数据
    if (decodedJwt && userId) {
      const amebaUrl = `${DUOLINGO_BASE_URL}/2023-05-23/users/${userId}?fields=courses,currentCourse,fromLanguage,learningLanguage,trackingProperties`;
      
      const [xpResult, gemsResult, tierResult, amebaResult] = await Promise.all([
        // XP 历史
        fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${userId}/xp_summaries?startDate=1970-01-01`,
          authHeaders, 12000
        ),
        // gems/lingots（需要 App headers 才能返回）
        fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${userId}?fields=gems,lingots`,
          authHeaders, 8000
        ),
        // leaderboard_league via trackingProperties
        fetchWithTimeout(
          `${DUOLINGO_BASE_URL}/2017-06-30/users/${userId}?fields=trackingProperties`,
          authHeaders, 8000
        ),
        // 4. 获取新科目数据 (Ameba Architecture)
        fetchWithTimeout(amebaUrl, authHeaders, 8000)
      ]);
      
      if (amebaResult.status === 200 && amebaResult.data) {
        const amebaData = amebaResult.data as any;
        if (amebaData.courses) userData._amebaCourses = amebaData.courses;
        if (amebaData.currentCourse) userData._amebaCurrentCourse = amebaData.currentCourse;
      }

      if (xpResult.status === 200 && xpResult.data) {
        userData._xpSummaries = (xpResult.data as any).summaries;
      }

      // 注入 gems 真实数据
      if (gemsResult.status === 200 && gemsResult.data) {
        const gemsData = gemsResult.data as any;
        if (typeof gemsData.gems === 'number') {
          userData._inventoryGems = gemsData.gems;
        } else if (typeof gemsData.lingots === 'number') {
          userData._inventoryGems = gemsData.lingots;
        }
      }

      // 注入 leaderboard tier 真实数据
      if (tierResult.status === 200 && tierResult.data) {
        const tierData = tierResult.data as any;
        const tracking = tierData.trackingProperties;
        if (tracking && typeof tracking.leaderboard_league === 'number') {
          userData._leaderboardTier = tracking.leaderboard_league;
        } else if (tracking && typeof tracking.league_tier === 'number') {
          userData._leaderboardTier = tracking.league_tier;
        }
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
