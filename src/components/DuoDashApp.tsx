import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import type { UserData } from '../types';
import { LoginScreen } from './LoginScreen';
import { Navbar, PageHeader, StatCard, CourseList, TodayOverview } from './dashboard';
import { ShareModal } from './share';
import { AppIcon, type IconMode } from './icons/AppIcon';

const LazyXpHistoryChart = lazy(() => import('./charts/XpHistoryChart'));
const LazyTimeHistoryChart = lazy(() => import('./charts/TimeHistoryChart'));
const LazyHeatmapChart = lazy(() => import('./Charts').then(m => ({ default: m.HeatmapChart })));
const LazyAchievementsSection = lazy(() => import('./achievements/AchievementsSection'));
const LazyAiCoach = lazy(() => import('./AiCoach').then(m => ({ default: m.AiCoach })));

function getTimezoneHeaders(): HeadersInit {
  const timeZone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'Asia/Shanghai';

  return {
    'x-user-timezone': timeZone,
  };
}

function ChartSkeleton(): React.ReactElement {
  return (
    <div className="h-40 w-full bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse flex items-center justify-center" style={{ minHeight: '160px' }}>
      <span className="text-gray-600 dark:text-slate-300 text-sm">加载中...</span>
    </div>
  );
}

const ANIMATION_STYLES = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-seq { animation: fadeInUp 0.2s ease-out forwards; opacity: 0; }
.seq-1 { animation-delay: 0s; }
.seq-2 { animation-delay: 0.1s; }
.seq-3 { animation-delay: 0.15s; }
.seq-4 { animation-delay: 0.2s; }
.seq-5 { animation-delay: 0.25s; }
.seq-6 { animation-delay: 0.3s; }
.seq-7 { animation-delay: 0.35s; }
.seq-8 { animation-delay: 0.4s; }
.seq-9 { animation-delay: 0.45s; }
.seq-10 { animation-delay: 0.5s; }
.seq-11 { animation-delay: 0.55s; }
.seq-12 { animation-delay: 0.6s; }
`;

const DEMO_DATA: UserData = {
  streak: 2045,
  totalXp: 202663,
  gems: 15400,
  league: "钻石 (Diamond)",
  leagueTier: 9,
  learningLanguage: "英语",
  learningLanguageCode: "en",
  creationDate: "2015 年 5 月 12 日",
  accountAgeDays: 3200,
  isPlus: true,
  dailyGoal: 50,
  estimatedLearningTime: "562 小时 57 分钟",
  courses: [
    { id: 'en', title: "英语", xp: 243820, fromLanguage: "zh", learningLanguage: "en", crowns: 150 },
    { id: 'chess', title: "国际象棋", xp: 36697, fromLanguage: "en", learningLanguage: "en", crowns: 10, subject: "chess" },
    { id: 'zh', title: "中文", xp: 15634, fromLanguage: "en", learningLanguage: "zh", crowns: 20 },
    { id: 'zc', title: "粤语", xp: 1445, fromLanguage: "zh", learningLanguage: "zc", crowns: 5 },
  ],
  dailyXpHistory: [
    { date: '11/29', xp: 120 }, { date: '11/30', xp: 250 }, { date: '12/1', xp: 45 },
    { date: '12/2', xp: 320 }, { date: '12/3', xp: 150 }, { date: '12/4', xp: 550 }, { date: '12/5', xp: 400 },
  ],
  dailyTimeHistory: [
    { date: '11/29', time: 40 }, { date: '11/30', time: 83 }, { date: '12/1', time: 15 },
    { date: '12/2', time: 107 }, { date: '12/3', time: 50 }, { date: '12/4', time: 183 }, { date: '12/5', time: 133 },
  ],
  xpToday: 180,
  lessonsToday: 5,
  streakExtendedToday: true,
  streakExtendedTime: "09:32"
};

const PLACEHOLDER_DATA: UserData = {
  streak: 0,
  totalXp: 0,
  gems: 0,
  league: '加载中…',
  leagueTier: -1,
  learningLanguage: '—',
  creationDate: '—',
  accountAgeDays: 0,
  isPlus: false,
  dailyGoal: 0,
  estimatedLearningTime: '—',
  courses: [],
  dailyXpHistory: [],
  dailyTimeHistory: [],
  yearlyXpHistory: [],
};

type ThemeMode = 'light' | 'dark' | 'system';

interface DashboardContentProps {
  userData: UserData | null;
  viewData: UserData;
  shouldRenderAboveFoldCharts: boolean;
  shouldRenderHeatmap: boolean;
  hasTimeHistory: boolean;
  hasYearlyHistory: boolean;
  iconMode: IconMode;
  heatmapSentinelRef?: React.RefObject<HTMLDivElement | null>;
  isMirror?: boolean;
}

const DashboardContent = React.memo(({
  userData,
  viewData,
  shouldRenderAboveFoldCharts,
  shouldRenderHeatmap,
  hasTimeHistory,
  hasYearlyHistory,
  iconMode,
  heatmapSentinelRef,
  isMirror = false
}: DashboardContentProps) => {
  return (
    <div className={isMirror ? "p-8" : ""}>
      <PageHeader userData={userData} viewData={viewData} iconMode={iconMode} />

      <div className="space-y-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
          <StatCard iconName="bolt" iconMode={iconMode} value={userData ? viewData.totalXp.toLocaleString() : '—'} label="总经验" colorClass="text-yellow-500" seq={1} />
          <StatCard iconName="calendar" iconMode={iconMode} value={userData ? viewData.accountAgeDays : '—'} label="注册天数" colorClass="text-blue-500" seq={2} />
          <StatCard iconName="books" iconMode={iconMode} value={userData ? viewData.courses.length : '—'} label="学习课程" colorClass="text-teal-500" seq={3} />
          <StatCard iconName="stopwatch" iconMode={iconMode} value={userData ? viewData.estimatedLearningTime : '—'} label="预估投入" colorClass="text-purple-500" seq={4} isLargeText={false} />
        </div>

        <div className={`grid gap-4 ${hasTimeHistory ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border-2 border-b-4 border-gray-200 dark:border-slate-700 animate-seq seq-5">
            <h2 className="text-gray-700 dark:text-slate-100 font-bold text-lg mb-3 flex items-center gap-2">
              <AppIcon name="bolt" mode={iconMode} className="text-yellow-500" />
              <span>最近 7 天经验</span>
            </h2>
            {userData && (shouldRenderAboveFoldCharts || isMirror) ? (
              <Suspense fallback={<ChartSkeleton />}>
                <LazyXpHistoryChart data={viewData.dailyXpHistory} />
              </Suspense>
            ) : (
              <ChartSkeleton />
            )}
          </div>
          {hasTimeHistory && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border-2 border-b-4 border-gray-200 dark:border-slate-700 animate-seq seq-6">
              <h2 className="text-gray-700 dark:text-slate-100 font-bold text-lg mb-3 flex items-center gap-2">
                <AppIcon name="stopwatch" mode={iconMode} className="text-purple-500" />
                <span>最近 7 天学习时间</span>
              </h2>
              {userData && (shouldRenderAboveFoldCharts || isMirror) ? (
                <Suspense fallback={<ChartSkeleton />}>
                  <LazyTimeHistoryChart data={viewData.dailyTimeHistory || []} />
                </Suspense>
              ) : (
                <ChartSkeleton />
              )}
            </div>
          )}
        </div>

        <CourseList courses={viewData.courses} seq={7} iconMode={iconMode} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 animate-seq seq-8">
            {userData ? (
              <Suspense fallback={<div className="bg-white dark:bg-slate-900 rounded-2xl p-6 h-32 animate-pulse" />}>
                <LazyAiCoach userData={userData} iconMode={iconMode} />
              </Suspense>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 h-32 animate-pulse" />
            )}
          </div>
          <TodayOverview userData={userData} seq={9} iconMode={iconMode} />
        </div>

        {hasYearlyHistory && (
          <div
            ref={heatmapSentinelRef}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border-2 border-b-4 border-gray-200 dark:border-slate-700 animate-seq seq-10"
          >
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-700 dark:text-slate-100">
              <AppIcon name="calendar" mode={iconMode} className="text-blue-500" />
              <span>年度学习热力图</span>
            </h2>
            {(shouldRenderHeatmap || isMirror) ? (
              <Suspense fallback={<div className="h-48 w-full bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />}>
                <LazyHeatmapChart data={userData?.yearlyXpHistory || []} forceViewMode={isMirror ? 'year' : undefined} />
              </Suspense>
            ) : (
              <div className="h-48 w-full bg-gray-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-gray-600 dark:text-slate-300 text-sm">
                向下滚动时加载热力图…
              </div>
            )}
          </div>
        )}

        {hasYearlyHistory && (
          <div className="animate-seq seq-11">
            <Suspense fallback={<div className="h-64 w-full bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />}>
              <LazyAchievementsSection data={userData?.yearlyXpHistory || []} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
});

export function DuoDashApp(): React.ReactElement {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [shouldRenderHeatmap, setShouldRenderHeatmap] = useState(false);
  const [shouldRenderAboveFoldCharts, setShouldRenderAboveFoldCharts] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('duodash:theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored as ThemeMode;
      } catch {}
    }
    return 'system';
  });
  const [iconMode, setIconMode] = useState<IconMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('duodash:icon-mode');
        if (stored === 'emoji' || stored === 'svg') return stored as IconMode;
      } catch {}
    }
    return 'emoji';
  });
  const heatmapSentinelRef = useRef<HTMLDivElement | null>(null);
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
      if (mode === 'system') return media.matches ? 'dark' : 'light';
      return mode;
    };

    root.dataset.theme = resolveTheme(themeMode);

    try {
      localStorage.setItem('duodash:theme', themeMode);
    } catch {
      // ignore storage errors
    }

    function handleSystemChange() {
      if (themeMode === 'system') {
        root.dataset.theme = resolveTheme('system');
      }
    }

    if (themeMode === 'system') {
      media.addEventListener('change', handleSystemChange);
      return () => media.removeEventListener('change', handleSystemChange);
    }
    return undefined;
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem('duodash:icon-mode', iconMode);
    } catch {
      // ignore storage errors
    }
  }, [iconMode]);

  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        let hasLocalCache = false;
        let isFresh = false;
        try {
          const cached = localStorage.getItem('duodash:userData');
          const cachedTs = localStorage.getItem('duodash:userDataTs');
          if (cached) {
            setUserData(JSON.parse(cached) as UserData);
            setIsConfigured(true);
            setShowLogin(false);
            hasLocalCache = true;
            if (cachedTs) {
              const ts = Number(cachedTs);
              setLastUpdated(ts || null);
              // Check if cache is less than 5 minutes old
              isFresh = Date.now() - ts < 5 * 60 * 1000;
            }
          }
        } catch {
          // ignore cache errors
        }

        // If we have a fresh local cache, skip the backend fetch to prevent rate limits
        if (hasLocalCache && isFresh) {
          setLoading(false);
          return;
        }

        await new Promise<void>(resolve => setTimeout(resolve, 0));

        const dataRes = await fetch('/api/data', { headers: getTimezoneHeaders() });
        let result: any = {};
        if (dataRes.ok) {
          try {
            result = await dataRes.json();
          } catch {
            result = { error: '解析服务器响应失败' };
          }
        } else {
          try {
            const errJson = await dataRes.json();
            result = { error: errJson.error || `HTTP 错误 ${dataRes.status}` };
          } catch {
            result = { error: `服务器返回了错误 (${dataRes.status})` };
          }
        }

        if (dataRes.status === 400 && result.error === 'Not configured') {
          if (!hasLocalCache) setShowLogin(true);
          setLoading(false);
          return;
        }

        if (result.data) {
          const next = result.data as UserData;
          setUserData(next);
          setIsConfigured(true);
          setShowLogin(false);
          try {
            localStorage.setItem('duodash:userData', JSON.stringify(next));
            localStorage.setItem('duodash:userDataTs', String(Date.now()));
            setLastUpdated(Date.now());
          } catch {
            // ignore persistence errors
          }
        } else if (result.error !== 'Not configured') {
          setError(result.error || '加载数据失败');
          setIsConfigured(true);
        }
      } catch {
        setError('连接服务器失败');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!userData?.yearlyXpHistory?.length || shouldRenderHeatmap) return;

    const el = heatmapSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setShouldRenderHeatmap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [userData?.yearlyXpHistory?.length, shouldRenderHeatmap]);

  useEffect(() => {
    setShouldRenderAboveFoldCharts(!!userData);
  }, [userData]);

  async function handleConnect(username: string, jwt: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const { fetchDuolingoData } = await import('../services/duolingoService');
      const data = await fetchDuolingoData();
      setUserData(data);
      setShowLogin(false);
    } catch {
      setError("连接失败：请尝试使用「粘贴 JSON」模式，或检查环境变量配置。");
    } finally {
      setLoading(false);
    }
  }

  function handleJsonInput(jsonStr: string): void {
    setLoading(true);
    setError(null);
    import('../services/duolingoService')
      .then(({ transformDuolingoData }) => {
        try {
          const raw = JSON.parse(jsonStr);
          const userObj = raw.users ? raw.users[0] : raw;
          setUserData(transformDuolingoData(userObj));
          setShowLogin(false);
        } catch {
          setError("JSON 格式无效。请确保你复制了完整的页面内容。");
        }
      })
      .catch(() => {
        setError("加载数据处理模块失败，请刷新页面重试。");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleDemo(): void {
    setUserData(DEMO_DATA);
    setShowLogin(false);
  }

  async function handleRefresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const dataRes = await fetch('/api/data', { headers: getTimezoneHeaders() });
      let result: any = {};
      if (dataRes.ok) {
        try {
          result = await dataRes.json();
        } catch {
          result = { error: '解析服务器响应失败' };
        }
      } else {
        try {
          const errJson = await dataRes.json();
          result = { error: errJson.error || `HTTP 错误 ${dataRes.status}` };
        } catch {
          result = { error: `服务器返回了异常 (${dataRes.status})` };
        }
      }

      if (result.data) {
        const next = result.data as UserData;
        setUserData(next);
        setShowLogin(false);
        try {
          localStorage.setItem('duodash:userData', JSON.stringify(next));
          localStorage.setItem('duodash:userDataTs', String(Date.now()));
          setLastUpdated(Date.now());
        } catch {
          // ignore persistence errors
        }
      } else {
        setError(result.error || '刷新数据失败');
      }
    } catch {
      setError('刷新失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-12 text-center border-2 border-gray-100 dark:border-slate-700 max-w-sm w-full transition-all">
          <img src="/green-owl.svg" alt="Duo" width="96" height="96" className="w-24 h-24 mx-auto mb-6 animate-bounce" />
          <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-100 mb-4">正在加载数据...</h2>
          <p className="text-gray-500 dark:text-slate-400">正在连接 Duolingo API</p>
        </div>
      </div>
    );
  }

  if (!userData && isConfigured && error) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-12 text-center max-w-md border-2 border-gray-100 dark:border-slate-700">
          <div className="mb-6 flex justify-center">
            <AppIcon name="sad" mode={iconMode} size="xl" className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-100 mb-4">连接失败</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <p className="text-gray-700 dark:text-slate-300 text-sm mb-6">请检查环境变量中的 DUOLINGO_USERNAME 和 DUOLINGO_JWT 配置是否正确</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#58cc02] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#4caf00]"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!userData && showLogin) {
    return (
      <LoginScreen
        onConnect={handleConnect}
        onJsonInput={handleJsonInput}
        onDemo={handleDemo}
        loading={loading}
        error={error}
        iconMode={iconMode}
      />
    );
  }

  const viewData = userData ?? PLACEHOLDER_DATA;
  const hasTimeHistory = viewData.dailyTimeHistory?.some(d => d.time > 0);
  const hasYearlyHistory = userData?.yearlyXpHistory?.length;

  return (
    <div className="min-h-screen bg-[#f7f7f7] dark:bg-slate-950 transition-colors">
      <style>{ANIMATION_STYLES}</style>

      <Navbar
        loading={loading}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        onShare={() => setShowShareModal(true)}
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        iconMode={iconMode}
        onIconModeToggle={() => setIconMode((current) => current === 'emoji' ? 'svg' : 'emoji')}
      />

      <main ref={dashboardRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent
          userData={userData}
          viewData={viewData}
          shouldRenderAboveFoldCharts={shouldRenderAboveFoldCharts}
          shouldRenderHeatmap={shouldRenderHeatmap}
          hasTimeHistory={!!hasTimeHistory}
          hasYearlyHistory={!!hasYearlyHistory}
          iconMode={iconMode}
          heatmapSentinelRef={heatmapSentinelRef}
        />
      </main>

      {userData && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          userData={userData}
          cardRef={cardRef}
          dashboardRef={dashboardRef}
          onPrepareFull={() => setShouldRenderHeatmap(true)}
          iconMode={iconMode}
        />
      )}
    </div>
  );
}

export default DuoDashApp;
