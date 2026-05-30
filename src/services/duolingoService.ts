import type { UserData, DuolingoRawUser, Course } from "../types";

const LEAGUE_TIERS = [
  "青铜", "白银", "黄金", "蓝宝石", "红宝石",
  "祖母绿", "紫水晶", "珍珠", "黑曜石", "钻石"
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

const SUBJECT_MAP: Record<string, string> = {
  chess: '国际象棋',
  math: '数学',
  music: '音乐',
};

const LANGUAGE_NAME_MAP: Record<string, string> = {
  en: '英语',
  zh: '中文',
  zs: '中文',
  zc: '粤语',
  'zh-hk': '粤语',
  es: '西班牙语',
  fr: '法语',
  de: '德语',
  ja: '日语',
  ko: '韩语',
  it: '意大利语',
  pt: '葡萄牙语',
  ru: '俄语',
  vi: '越南语',
  tr: '土耳其语',
  ar: '阿拉伯语',
  hi: '印地语',
  el: '希腊语',
  he: '希伯来语',
  sv: '瑞典语',
  nl: '荷兰语',
  pl: '波兰语',
  hu: '匈牙利语',
  uk: '乌克兰语',
};

// 日期格式化器单例，避免重复创建
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: DEFAULT_TIMEZONE
});

// 日期解析缓存，减少重复的 Date 解析开销
const dateParseCache = new Map<string, number>();

function getCachedDateTimestamp(dateStr: string): number {
  let ts = dateParseCache.get(dateStr);
  if (ts === undefined) {
    ts = new Date(dateStr).getTime();
    // 限制缓存大小，防止内存泄漏
    if (dateParseCache.size > 1000) {
      const firstKey = dateParseCache.keys().next().value;
      if (firstKey) dateParseCache.delete(firstKey);
    }
    dateParseCache.set(dateStr, ts);
  }
  return ts;
}

/**
 * 将 Date 对象转换为 YYYY-MM-DD 格式的本地日期键
 * 为了保证一致性，默认使用 'Asia/Shanghai' 时区
 */
function toLocalDateKey(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!date || isNaN(date.getTime())) return '1970-01-01';

  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone
    }).format(date);
  } catch (e) {
    // Fallback if timezone is invalid or Intl fails
    const offsetDate = new Date(date.getTime() + (timeZone === 'Asia/Shanghai' ? 8 : 0) * 3600000);
    return offsetDate.toISOString().split('T')[0];
  }
}

/**
 * 获取指定时区的当天开始时间戳（毫秒）
 * 使用与 toLocalDateKey 相同的时区，确保一致性
 */
function getStartOfDayInTimezone(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const dateKey = toLocalDateKey(date, timeZone);
  // 构造该时区的午夜时间
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  });
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '+08:00';
  // 解析偏移量，如 "GMT+8" -> "+08:00"
  // 支持整点偏移 (GMT+8) 和半小时偏移 (GMT+5:30)
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const offset = offsetMatch
    ? `${offsetMatch[1]}${offsetMatch[2].padStart(2, '0')}:${(offsetMatch[3] || '0').padStart(2, '0')}`
    : '+08:00';
  return new Date(`${dateKey}T00:00:00${offset}`).getTime();
}

/**
 * 将 xpSummary 的日期字段解析为日期键
 * 统一处理数字时间戳和字符串日期格式
 * 返回 null 表示无效日期
 */
function parseSummaryDateKey(date: number | string, timeZone: string = DEFAULT_TIMEZONE): string | null {
  if (typeof date === 'number') {
    // Duolingo timestamps are usually in seconds
    const d = new Date(date < 10000000000 ? date * 1000 : date);
    if (isNaN(d.getTime())) return null;
    return toLocalDateKey(d, timeZone);
  }
  // Standardize string date parsing
  const dateStr = String(date).replace(/\//g, '-');
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return toLocalDateKey(d, timeZone);
}


/**
 * 获取指定日期所在自然周的周一（一周的第一天）
 * 使用 Asia/Shanghai 时区确保一致性
 */
function getMonday(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  // 获取该时区下的日期信息
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    timeZone
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');

  // 创建本地日期对象
  const localDate = new Date(year, month, day);
  const dayOfWeek = localDate.getDay(); // 0 = 周日，1 = 周一，..., 6 = 周六

  // 计算到周一的偏移量（周日需要回退 6 天，其他天回退 dayOfWeek - 1 天）
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  return monday;
}

function calcDaysSince(createdAt: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  // 使用与其他日期处理一致的 Asia/Shanghai 时区，避免在 UTC 服务器上注册天数计算错误
  const todayKey = toLocalDateKey(new Date(), timeZone);
  const createdKey = toLocalDateKey(createdAt, timeZone);
  const diffMs = new Date(todayKey).getTime() - new Date(createdKey).getTime();
  return Math.max(0, Math.floor(diffMs / MS_PER_DAY));
}

function resolveTierIndex(rawAny: any, rawData: DuolingoRawUser): number {
  // 优先从手动注入的 _leaderboardTier 获取（来自 fields 请求）
  if (rawAny._leaderboardTier !== undefined && rawAny._leaderboardTier >= 0) return rawAny._leaderboardTier;

  // 其次从专用排行榜 API 获取（覆盖多种可能的响应结构）
  const lb = rawAny._leaderboard as any;
  if (lb !== undefined && lb !== null) {
    // 格式1: { active_leaderboard: { tier: N } }
    if (lb.active_leaderboard?.tier !== undefined) return lb.active_leaderboard.tier;
    // 格式2: { tier: N }
    if (lb.tier !== undefined && lb.tier >= 0) return lb.tier;
    // 格式3: { data: { tier: N } }
    if (lb.data?.tier !== undefined) return lb.data.tier;
    // 格式4: { ranked_users: [{ tier: N }] }
    if (Array.isArray(lb.ranked_users) && lb.ranked_users[0]?.tier !== undefined)
      return lb.ranked_users[0].tier;
  }
  // 回退到旧字段
  if (rawAny.tier !== undefined && rawAny.tier >= 0 && rawAny.tier <= 10) return rawAny.tier;
  if (rawAny.trackingProperties?.league_tier !== undefined) return rawAny.trackingProperties.league_tier;
  if (rawAny.trackingProperties?.leaderboard_league !== undefined) return rawAny.trackingProperties.leaderboard_league;
  if (rawAny.tracking_properties?.league_tier !== undefined) return rawAny.tracking_properties.league_tier;
  if (rawAny.tracking_properties?.leaderboard_league !== undefined) return rawAny.tracking_properties.leaderboard_league;
  if (rawData.language_data) {
    const currentLang = Object.values(rawData.language_data).find((l: any) => l.current_learning) as any;
    if (currentLang?.tier !== undefined) return currentLang.tier;
  }
  return -1;
}

function parseCreationDate(creationTs: number | undefined, created: string | undefined, timeZone: string = DEFAULT_TIMEZONE): { dateStr: string; ageDays: number } {
  if (creationTs) {
    const ts = creationTs < 10000000000 ? creationTs * 1000 : creationTs;
    const cDate = new Date(ts);
    if (!isNaN(cDate.getTime())) {
      return {
        dateStr: cDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone }),
        ageDays: calcDaysSince(cDate, timeZone)
      };
    }
  }
  if (created) {
    const cDate = new Date(created);
    if (!isNaN(cDate.getTime())) {
      return {
        dateStr: cDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone }),
        ageDays: calcDaysSince(cDate, timeZone)
      };
    }
  }
  return { dateStr: "未知", ageDays: 0 };
}

function resolveStreakExtendedTime(
  streakExtendedToday: boolean,
  rawAny: any,
  rawData: DuolingoRawUser,
  localTodayStart: number,
  timeZone: string = DEFAULT_TIMEZONE
): string | undefined {
  if (!streakExtendedToday) return undefined;

  if (rawAny.streakData?.currentStreak?.lastExtendedDate) {
    return new Date(rawAny.streakData.currentStreak.lastExtendedDate)
      .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone });
  }

  if (rawData.calendar?.length) {
    const todayStr = new Date().toDateString();
    const todayEvents = rawData.calendar
      .filter(e => e && e.datetime && new Date(e.datetime).toDateString() === todayStr)
      .sort((a, b) => a.datetime - b.datetime);
    if (todayEvents.length > 0) {
      return new Date(todayEvents[0].datetime)
        .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone });
    }
  }

  if (rawAny.xpGains?.length) {
    const todayGains = rawAny.xpGains
      .filter((g: any) => g && typeof g.time === 'number' && g.time * 1000 >= localTodayStart)
      .sort((a: any, b: any) => a.time - b.time);
    if (todayGains.length > 0) {
      return new Date(todayGains[0].time * 1000)
        .toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone });
    }
  }

  return undefined;
}

function sumPoints(items: Array<{ points?: number; xp?: number }> | undefined): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.points || item.xp || 0), 0);
}

export function transformDuolingoData(rawData: DuolingoRawUser, timeZone: string = DEFAULT_TIMEZONE): UserData {
  // 输入验证
  if (!rawData || typeof rawData !== 'object') {
    throw new TypeError('transformDuolingoData: 输入必须是有效的用户数据对象');
  }

  const rawAny = rawData as any;

  const streak = rawData.site_streak ?? rawData.streak ?? 0;

  // 钻石数量：优先从手动注入的字段获取（来自 inventory 或 fields 请求）
  // gems/钻石：通过添加 Duolingo-Platform: web 等 App headers 后，API 现在能正确返回真实数据
  // _inventoryGems 由 data.ts 注入，来自 /users/{id}?fields=gems,lingots 端点
  const gems: number = rawAny._inventoryGems ?? rawAny._fieldsData?.gems ?? rawAny._inventory?.gems
    ?? rawAny._inventory?.lingots ?? rawAny._inventory?.gem_count
    ?? rawData.gemsTotalCount ?? rawData.totalGems ?? rawData.gems
    ?? rawData.tracking_properties?.gems ?? rawData.lingots ?? rawData.rupees ?? 0;

  let totalXp = rawData.total_xp ?? rawData.totalXp ?? 0;
  if (totalXp === 0) totalXp = sumPoints(rawData.languages);
  if (totalXp === 0 && rawData.language_data) totalXp = sumPoints(Object.values(rawData.language_data));
  if (totalXp === 0) totalXp = sumPoints(rawData.courses);

  const dailyGoal = rawData.dailyGoal ?? rawData.daily_goal ?? rawData.xpGoal ?? 0;
  const creationTs = rawData.creation_date || rawData.creationDate;

  let courses: Course[] = [];

  // 优先处理 Ameba 架构的新课程数据
  const amebaCourses = rawAny._amebaCourses || [];
  if (amebaCourses.length > 0) {
    courses = amebaCourses.map((c: any) => {
      const subject = c.subject;
      let title = c.title;
      
      if (subject) {
        // 新科目：根据 subject 映射中文名
        title = SUBJECT_MAP[subject] || title || subject;
      } else {
        // 语言：强制使用中文映射，如果没有则保留原标题或从 language_data 获取
        const langCode = c.learningLanguage || '';
        title = LANGUAGE_NAME_MAP[langCode.toLowerCase()] || rawData.language_data?.[langCode]?.language_string || title || langCode;
      }

      return {
        id: c.id || c.learningLanguage || subject || Math.random().toString(36).substr(2, 9),
        title: title || '未知课程',
        xp: c.xp || 0,
        fromLanguage: c.fromLanguage || 'en',
        learningLanguage: c.learningLanguage || subject || '',
        crowns: c.crowns || 0,
        subject: subject,
        timeSpent: c.timeSpent || c.duration || 0,
      };
    });
  }

  // 如果没有 Ameba 数据，尝试回退到旧版 courses 字段
  if (courses.length === 0 && rawData.courses?.length) {
    courses = rawData.courses
      .filter((c: any) => (c.xp || 0) > 0 || c.current_learning)
      .map(c => ({
        title: c.title,
        xp: c.xp,
        fromLanguage: c.fromLanguage,
        learningLanguage: c.learningLanguage,
        crowns: c.crowns || 0,
        id: c.id
      }));
  }

  // 进一步回退到 languages 列表（V1 API）
  if (courses.length === 0 && rawAny.languages?.length) {
    const v1Courses = rawAny.languages
      .filter((l: any) => l.points > 0 || l.current_learning)
      .map((l: any) => ({
        id: l.language,
        title: l.language_string,
        xp: l.points || 0,
        crowns: l.crowns || 0,
        fromLanguage: 'en',
        learningLanguage: l.language,
      }));

    for (const v1c of v1Courses) {
      const exists = courses.some(c =>
        c.title === v1c.title ||
        c.learningLanguage === v1c.learningLanguage ||
        (c.id && v1c.id && v1c.id.length > 0 && c.id.includes(v1c.id))
      );
      if (!exists) courses.push(v1c);
    }
  }

  // 最后回退到 language_data 映射
  if (courses.length === 0 && rawData.language_data) {
    courses = Object.entries(rawData.language_data)
      .filter(([_, langDetail]: [string, any]) => {
        const xp = langDetail.points || langDetail.level_progress || 0;
        return xp > 0 || langDetail.current_learning;
      })
      .map(([langCode, langDetail]: [string, any]) => {
        let crowns = langDetail.crowns || 0;
        if (crowns === 0 && langDetail.skills?.length) {
          crowns = langDetail.skills.reduce((acc: number, skill: any) =>
            acc + (skill.levels_finished || skill.crowns || skill.finishedLevels || 0), 0);
        }
        return {
          id: langDetail.learning_language || langCode,
          title: langDetail.language_string,
          xp: langDetail.points || langDetail.level_progress || 0,
          crowns,
          fromLanguage: langDetail.from_language || 'en',
          learningLanguage: langDetail.learning_language || langCode,
        };
      });
  }

  let learningLanguage = "None";
  let learningLanguageCode: string | undefined = undefined;
  let learningSubject: string | undefined = undefined;

  if (rawAny._amebaCurrentCourse) {
    const curr = rawAny._amebaCurrentCourse;
    // 如果 subject 是 'language'，则它其实是语言课程，需要按语言逻辑处理
    if (curr.subject && curr.subject !== 'language') {
      learningSubject = curr.subject;
      learningLanguage = SUBJECT_MAP[curr.subject] || curr.subject;
    } else {
      learningLanguageCode = curr.learningLanguage;
      learningLanguage = (learningLanguageCode ? LANGUAGE_NAME_MAP[learningLanguageCode.toLowerCase()] : null) || curr.title || curr.learningLanguage;
    }
  } else if (rawData.language_data) {
    const current = Object.values(rawData.language_data).find(l => (l as any).current_learning);
    learningLanguageCode = (current as any)?.learning_language || courses[0]?.learningLanguage;
    learningLanguage = (learningLanguageCode ? LANGUAGE_NAME_MAP[learningLanguageCode.toLowerCase()] : null) || (current as any)?.language_string || courses[0]?.title || "None";
  } else if (rawData.currentCourse) {
    learningLanguageCode = rawData.currentCourse.learningLanguage;
    learningLanguage = (learningLanguageCode ? LANGUAGE_NAME_MAP[learningLanguageCode.toLowerCase()] : null) || rawData.currentCourse.title;
  } else if (courses.length > 0) {
    learningLanguageCode = courses[0].learningLanguage;
    learningLanguage = (learningLanguageCode ? LANGUAGE_NAME_MAP[learningLanguageCode.toLowerCase()] : null) || courses[0].title;
  }

  const xpByDate = new Map<string, number>();
  const timeByDate = new Map<string, number>();

  function addCalendarEvent(event: { datetime: number; improvement?: number }): void {
    if (!event || !event.datetime) return;
    const d = new Date(event.datetime);
    if (isNaN(d.getTime())) return;
    const dateKey = toLocalDateKey(d, timeZone);
    const improvement = event.improvement || 0;
    xpByDate.set(dateKey, (xpByDate.get(dateKey) || 0) + improvement);
    timeByDate.set(dateKey, (timeByDate.get(dateKey) || 0) + Math.ceil((improvement || 10) / 3));
  }

  if (rawAny._xpSummaries?.length) {
    for (const summary of rawAny._xpSummaries) {
      const dateKey = parseSummaryDateKey(summary.date, timeZone);
      if (!dateKey) continue;

      const gainedXp = summary.gainedXp ?? summary.gained_xp ?? 0;
      xpByDate.set(dateKey, gainedXp);

      const sessionTimeSeconds = summary.totalSessionTime ?? summary.total_session_time ?? 0;
      const minutes = Math.round(sessionTimeSeconds / 60);
      timeByDate.set(dateKey, minutes > 0 ? minutes : Math.ceil(gainedXp / 3));
    }
  } else if (rawData.calendar?.length) {
    rawData.calendar.forEach(addCalendarEvent);
  } else if (rawData.language_data) {
    Object.values(rawData.language_data).forEach((lang: any) => {
      if (lang.calendar?.length) lang.calendar.forEach(addCalendarEvent);
    });
  }

  // 滚动 7 天数据（用于首页图表）
  const dailyXpHistory: { date: string; xp: number }[] = [];
  const dailyTimeHistory: { date: string; time: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY);
    const dateKey = toLocalDateKey(d, timeZone);
    const dayLabel = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', timeZone });
    dailyXpHistory.push({ date: dayLabel, xp: xpByDate.get(dateKey) || 0 });
    dailyTimeHistory.push({ date: dayLabel, time: timeByDate.get(dateKey) || 0 });
  }

  // 自然周数据（用于分享卡片，周一到周日）
  const weeklyXpHistory: { date: string; xp: number; isFuture: boolean }[] = [];
  const weeklyTimeHistory: { date: string; time: number; isFuture: boolean }[] = [];
  const monday = getMonday(today, timeZone);
  const todayDateKey = toLocalDateKey(today, timeZone);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateKey = toLocalDateKey(d, timeZone);
    const dayLabel = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', timeZone });
    const isFuture = dateKey > todayDateKey;

    weeklyXpHistory.push({
      date: dayLabel,
      xp: isFuture ? 0 : (xpByDate.get(dateKey) || 0),
      isFuture
    });
    weeklyTimeHistory.push({
      date: dayLabel,
      time: isFuture ? 0 : (timeByDate.get(dateKey) || 0),
      isFuture
    });
  }

  const yearlyXpHistory: { date: string; xp: number; time?: number }[] = [];
  xpByDate.forEach((xp, date) => yearlyXpHistory.push({ date, xp, time: timeByDate.get(date) }));

  const tierIndex = resolveTierIndex(rawAny, rawData);
  const leagueName = (tierIndex >= 0 && tierIndex < LEAGUE_TIERS.length)
    ? LEAGUE_TIERS[tierIndex] : "—";

  const { dateStr: creationDateStr, ageDays: accountAgeDays } = parseCreationDate(creationTs, rawData.created, timeZone);

  const hasInventoryPremium = rawAny.inventory?.premium_subscription || rawAny.inventory?.super_subscription;
  const hasItemPremium = rawAny.has_item_premium_subscription || rawAny.has_item_immersive_subscription;
  const isPlus = !!(rawData.hasPlus || rawData.hasSuper || rawData.plusStatus === 'active' || rawAny.has_plus || rawAny.is_plus || hasInventoryPremium || hasItemPremium);

  // 计算总学习时间
  let totalMinutes = 0;
  let hasRealTimeData = false;
  
  // 1. 尝试从课程数据中累加 timeSpent (Ameba)
  const amebaTimeSeconds = courses.reduce((acc, c) => acc + (c.timeSpent || 0), 0);
  if (amebaTimeSeconds > 0) {
    totalMinutes = Math.floor(amebaTimeSeconds / 60);
    hasRealTimeData = true;
  }
  
  // 2. 如果没有课程时间，使用 xp_summaries 中的真实 totalSessionTime
  if (!hasRealTimeData && rawAny._xpSummaries?.length) {
    const totalSeconds = rawAny._xpSummaries.reduce((acc: number, s: any) =>
      acc + (s.totalSessionTime ?? s.total_session_time ?? 0), 0);
    totalMinutes = Math.floor(totalSeconds / 60);
    hasRealTimeData = totalSeconds > 0;
  }
  const estimatedLearningTime = hasRealTimeData
    ? `${Math.floor(totalMinutes / 60)}小时 ${totalMinutes % 60}分钟`
    : '暂无数据';

  let xpToday = 0;
  let lessonsToday = 0;
  const streakExtendedToday = rawAny.streak_extended_today ?? rawAny.streakExtendedToday ?? false;

  const now = new Date();
  const localTodayStart = getStartOfDayInTimezone(now, timeZone);
  const localTodayEnd = localTodayStart + MS_PER_DAY;
  const localTodayDateKey = toLocalDateKey(now, timeZone);

  const streakExtendedTime = resolveStreakExtendedTime(streakExtendedToday, rawAny, rawData, localTodayStart, timeZone);

  // 优先从 xpSummaries 获取今日数据（包含官方统计的 numSessions）
  if (rawAny._xpSummaries?.length) {
    const todaySummary = rawAny._xpSummaries.find((s: any) =>
      parseSummaryDateKey(s.date, timeZone) === localTodayDateKey
    );
    if (todaySummary) {
      xpToday = todaySummary.gainedXp ?? todaySummary.gained_xp ?? 0;
      lessonsToday = todaySummary.numSessions ?? 0;
    }
  }

  // 备用：从其他数据源获取
  if (xpToday === 0) {
    const todayXpFromHistory = xpByDate.get(localTodayDateKey) || 0;

    if (rawAny.xp_today !== undefined) {
      xpToday = rawAny.xp_today;
    } else if (todayXpFromHistory > 0) {
      xpToday = todayXpFromHistory;
    } else if (rawAny.streakData?.currentStreak?.endDate) {
      const streakEndTs = new Date(rawAny.streakData.currentStreak.endDate).getTime();
      if (streakEndTs >= localTodayStart && streakEndTs < localTodayEnd) {
        xpToday = rawAny.streakData.currentStreak.lastExtendedDate ? 1 : 0;
      }
    } else if (rawData.calendar?.length) {
      const todayEvents = rawData.calendar.filter(e =>
        e.datetime >= localTodayStart && e.datetime < localTodayEnd
      );
      xpToday = todayEvents.reduce((acc, e) => acc + (e.improvement || 0), 0);
      if (lessonsToday === 0) lessonsToday = todayEvents.length;
    }
  }

  // 最终备用：从 xpGains 获取
  if (xpToday === 0 && rawAny.xpGains?.length) {
    const todayGains = rawAny.xpGains.filter((g: any) => {
      const gainTs = g.time * 1000;
      return gainTs >= localTodayStart && gainTs < localTodayEnd;
    });
    xpToday = todayGains.reduce((acc: number, g: any) => acc + (g.xp || 0), 0);
    if (lessonsToday === 0) lessonsToday = todayGains.length;
  }

  return {
    streak, totalXp, gems,
    league: leagueName, leagueTier: tierIndex, courses, dailyXpHistory,
    dailyTimeHistory, yearlyXpHistory,
    weeklyXpHistory, weeklyTimeHistory,
    learningLanguage, learningLanguageCode, learningSubject, creationDate: creationDateStr, accountAgeDays,
    isPlus, dailyGoal, estimatedLearningTime,
    xpToday,
    lessonsToday: lessonsToday || undefined,
    streakExtendedToday,
    streakExtendedTime,
    weeklyXp: rawAny.weeklyXp,
    numSessionsCompleted: rawAny.numSessionsCompleted,
    streakFreezeCount: rawAny.streakFreezeCount
  };
};

/**
 * 客户端使用此函数从本服务 API 获取数据
 * 替代了之前直接访问 Duolingo 的逻辑，解决了 CORS 和 安全问题
 */
export async function fetchDuolingoData(): Promise<UserData> {
  const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : DEFAULT_TIMEZONE;
  const response = await fetch('/api/data', {
    headers: {
      'x-user-timezone': timeZone,
    },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Fetch failed');
  }

  return result.data as UserData;
}
