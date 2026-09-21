import type { AnniversaryComputed } from "./types";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** 周一为一周起点 */
export function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const weekday = d.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(d, offset);
}

export function isNextDateInThisWeek(nextDate: Date, now: Date = new Date()): boolean {
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addDays(weekStart, 7);
  const d = startOfDay(nextDate);
  return d >= weekStart && d < weekEnd;
}

export function isNextDateInThisMonth(nextDate: Date, now: Date = new Date()): boolean {
  const d = startOfDay(nextDate);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export interface DashboardStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

export function computeDashboardStats(items: AnniversaryComputed[]): DashboardStats {
  const now = new Date();
  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  for (const item of items) {
    if (item.isToday) today += 1;
    if (isNextDateInThisWeek(item.nextDate, now)) thisWeek += 1;
    if (isNextDateInThisMonth(item.nextDate, now)) thisMonth += 1;
  }

  return {
    total: items.length,
    today,
    thisWeek,
    thisMonth,
  };
}

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function formatNextDateLabel(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}月${d}日 ${WEEKDAY_ZH[date.getDay()]}`;
}
