import React from 'react';
import type { UserData } from '../../types';
import { AppIcon, type IconMode } from '../icons/AppIcon';

interface TodayOverviewProps {
  userData: UserData | null;
  seq: number;
  iconMode: IconMode;
}

export const TodayOverview = React.memo(function TodayOverview({ userData, seq, iconMode }: TodayOverviewProps): React.ReactElement {
  const todayTime = userData?.dailyTimeHistory?.length
    ? (userData.dailyTimeHistory[userData.dailyTimeHistory.length - 1].time ?? 0)
    : (userData ? 0 : '—');

  function renderTodayStatus(): React.ReactNode {
    if (!userData) {
      return (
        <div className="flex items-center justify-center gap-1 text-center text-sm text-gray-600">
          <AppIcon name="clock" mode={iconMode} size="xs" />
          <span>今日还未学习</span>
        </div>
      );
    }

    if (userData.streakExtendedToday && (!userData.xpToday || userData.xpToday === 0)) {
      return (
        <div className="flex items-center justify-center gap-1 text-center text-sm text-blue-500">
          <AppIcon name="snowflake" mode={iconMode} size="xs" />
          <span>使用了连胜冻结卡</span>
        </div>
      );
    }

    if (userData.xpToday && userData.xpToday > 0) {
      return (
        <div className="text-center text-sm">
          <div className="flex items-center justify-center gap-1 font-semibold text-gray-700">
            <AppIcon name="flame" mode={iconMode} size="xs" className="text-orange-500" />
            <span>今日已学习 {userData.xpToday} XP</span>
          </div>
          {userData.streakExtendedTime && (
            <div className="mt-1 text-xs text-gray-600">{userData.streakExtendedTime} 保住连胜</div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-1 text-center text-sm text-gray-600">
        <AppIcon name="clock" mode={iconMode} size="xs" />
        <span>今日还未学习</span>
      </div>
    );
  }

  return (
    <div className={`animate-seq seq-${seq} rounded-2xl border-2 border-b-4 border-gray-200 bg-white p-4 shadow-sm`}>
      <h2 className="mb-3 text-lg font-bold text-gray-700">今日概览</h2>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#58cc02]/10 p-3 text-center dark:bg-[#58cc02]/20">
            <div className="text-2xl font-extrabold text-[#58cc02]">
              {userData ? (userData.xpToday ?? 0) : '—'}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">今日 XP</div>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-900/30">
            <div className="text-2xl font-extrabold text-blue-500">
              {userData ? (userData.lessonsToday ?? 0) : '—'}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">今日课程</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-orange-50 p-3 text-center dark:bg-orange-900/30">
            <div className="text-2xl font-extrabold text-orange-500">
              {userData ? userData.streak : '—'}
            </div>
            <div className="mt-1 text-xs font-bold text-gray-500">连胜天数</div>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-center dark:bg-purple-900/30">
            <div className="text-2xl font-extrabold text-purple-500">{todayTime}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">学习分钟</div>
          </div>
        </div>

        {renderTodayStatus()}
      </div>
    </div>
  );
});

export default TodayOverview;
