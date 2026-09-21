import { Lunar, LunarMonth, LunarYear, Solar } from "lunar-javascript";
import type { AnniversaryEvent, AnniversaryComputed, CalendarType } from "./types";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function solarFromDate(date: Date): Solar {
  return Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** 阳历 2/29 非闰年回落：feb28 | mar1 */
let leapDayFallback: "feb28" | "mar1" = "feb28";

export function setLeapDayFallback(mode: "feb28" | "mar1"): void {
  leapDayFallback = mode === "mar1" ? "mar1" : "feb28";
}

export function isSolarLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 某年阳历月日的实际落点（含 2/29 非闰年回落） */
export function solarOccurrenceInYear(
  year: number,
  month: number,
  day: number
): Date {
  if (month === 2 && day === 29 && !isSolarLeapYear(year)) {
    return leapDayFallback === "mar1"
      ? new Date(year, 2, 1)
      : new Date(year, 1, 28);
  }
  return new Date(year, month - 1, day);
}

const LUNAR_MONTH_NAMES = [
  "正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊",
];

/** 农历某年的闰月序号（1–12）；无闰月返回 0 */
export function getLunarLeapMonth(year: number): number {
  try {
    const leap = LunarYear.fromYear(year).getLeapMonth();
    return typeof leap === "number" && leap > 0 ? leap : 0;
  } catch {
    return 0;
  }
}

/** 农历月天数（29/30）；无效返回 0 */
export function getLunarMonthDayCount(
  year: number,
  month: number,
  leap = false
): number {
  try {
    const m = LunarMonth.fromYm(year, leap ? -Math.abs(month) : Math.abs(month));
    return m ? m.getDayCount() : 0;
  } catch {
    return 0;
  }
}

export function lunarMonthLabel(month: number, leapMonth = false): string {
  const name = LUNAR_MONTH_NAMES[Math.abs(month) - 1] ?? String(Math.abs(month));
  return `${leapMonth ? "闰" : ""}${name}月`;
}

function lunarToSolar(
  year: number,
  month: number,
  day: number,
  leapMonth: boolean
): Date | null {
  const tryConvert = (m: number): Date | null => {
    try {
      const solar = Lunar.fromYmd(year, m, day).getSolar();
      return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
    } catch {
      return null;
    }
  };
  if (leapMonth) {
    return tryConvert(-Math.abs(month)) ?? tryConvert(Math.abs(month));
  }
  return tryConvert(Math.abs(month));
}

const LUNAR_LEAP_SEARCH_YEARS = 20;
const LUNAR_SEARCH_YEARS = 6;

function lunarOccurrenceInYear(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  leapMonth: boolean
): Date | null {
  const signed = leapMonth ? -Math.abs(lunarMonth) : Math.abs(lunarMonth);
  try {
    const solar = Lunar.fromYmd(lunarYear, signed, lunarDay).getSolar();
    return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  } catch {
    return null;
  }
}

/** 在 minDate 当天或之后，找到下一次农历月日的公历日期（支持闰月） */
export function findNextSolarForLunarMD(
  lunarMonth: number,
  lunarDay: number,
  minDate: Date,
  leapMonth = false
): Date {
  const start = startOfDay(minDate);
  const baseYear = solarFromDate(start).getLunar().getYear();
  const span = leapMonth ? LUNAR_LEAP_SEARCH_YEARS : LUNAR_SEARCH_YEARS;
  for (let i = 0; i <= span; i++) {
    const found = lunarOccurrenceInYear(
      baseYear + i,
      lunarMonth,
      lunarDay,
      leapMonth
    );
    if (found && found >= start) return found;
  }
  // 闰月生日：若近期无该闰月，回落为同月普通月
  if (leapMonth) return findNextSolarForLunarMD(lunarMonth, lunarDay, start, false);
  return addDays(start, 365);
}

function findPrevSolarForLunarMD(
  lunarMonth: number,
  lunarDay: number,
  maxDate: Date,
  leapMonth = false
): Date | null {
  const end = startOfDay(maxDate);
  const baseYear = solarFromDate(end).getLunar().getYear();
  const span = leapMonth ? LUNAR_LEAP_SEARCH_YEARS : LUNAR_SEARCH_YEARS;
  for (let i = 0; i <= span; i++) {
    const found = lunarOccurrenceInYear(
      baseYear - i,
      lunarMonth,
      lunarDay,
      leapMonth
    );
    if (found && found <= end) return found;
  }
  return null;
}

export function getNextOccurrence(event: AnniversaryEvent, from: Date = new Date()): Date {
  const origin = parseYmd(event.date);
  const today = startOfDay(from);

  if (event.type === "lunar") {
    return findNextSolarForLunarMD(
      origin.month,
      origin.day,
      today,
      event.leapMonth === true
    );
  }

  let candidate = solarOccurrenceInYear(
    today.getFullYear(),
    origin.month,
    origin.day
  );
  if (candidate < today) {
    candidate = solarOccurrenceInYear(
      today.getFullYear() + 1,
      origin.month,
      origin.day
    );
  }
  return candidate;
}

export function getOriginSolarDate(event: AnniversaryEvent): Date {
  const { year, month, day } = parseYmd(event.date);
  if (event.type === "lunar") {
    const solar = lunarToSolar(year, month, day, event.leapMonth === true);
    if (solar) return solar;
  }
  return solarOccurrenceInYear(year, month, day);
}

export function computeAnniversary(
  event: AnniversaryEvent,
  now: Date = new Date()
): AnniversaryComputed {
  if ((event.recurrence ?? "yearly") === "elapsed") {
    return computeElapsed(event, now);
  }
  return computeYearlyAnniversary(event, now);
}

function computeYearlyAnniversary(
  event: AnniversaryEvent,
  now: Date = new Date()
): AnniversaryComputed {
  const today = startOfDay(now);
  const originDate = startOfDay(getOriginSolarDate(event));
  const nextDate = startOfDay(getNextOccurrence(event, now));
  const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / 86400000);

  const originParts = parseYmd(event.date);
  let yearsPassed = today.getFullYear() - originParts.year;
  if (event.type === "solar") {
    const anniversaryThisYear = solarOccurrenceInYear(
      today.getFullYear(),
      originParts.month,
      originParts.day
    );
    if (anniversaryThisYear > today) yearsPassed -= 1;
  } else {
    const thisYearOccurrence = findNextSolarForLunarMD(
      originParts.month,
      originParts.day,
      new Date(today.getFullYear(), 0, 1),
      event.leapMonth === true
    );
    if (thisYearOccurrence > today) {
      yearsPassed -= 1;
    }
  }
  yearsPassed = Math.max(0, yearsPassed);

  const lastOccurrence = getLastOccurrence(event, now);
  const daysSinceLastOccurrence = Math.round(
    (today.getTime() - startOfDay(lastOccurrence).getTime()) / 86400000
  );

  const totalDaysPassed = Math.round(
    (today.getTime() - originDate.getTime()) / 86400000
  );

  return {
    event,
    originDate,
    nextDate,
    daysUntil,
    yearsPassed,
    daysSinceLastOccurrence,
    totalDaysPassed,
    isToday: daysUntil === 0,
    isElapsed: false,
  };
}

function computeElapsed(event: AnniversaryEvent, now: Date = new Date()): AnniversaryComputed {
  const today = startOfDay(now);
  const originDate = startOfDay(getOriginSolarDate({ ...event, type: "solar" }));
  const daysTogether = Math.max(
    1,
    Math.round((today.getTime() - originDate.getTime()) / 86400000) + 1
  );

  const yearlyProbe: AnniversaryEvent = {
    ...event,
    type: "solar",
    recurrence: "yearly",
  };
  const nextDate = startOfDay(getNextOccurrence(yearlyProbe, now));
  const daysUntil = Math.round((nextDate.getTime() - today.getTime()) / 86400000);

  const originParts = parseYmd(event.date);
  let yearsPassed = today.getFullYear() - originParts.year;
  const anniversaryThisYear = solarOccurrenceInYear(
    today.getFullYear(),
    originDate.getMonth() + 1,
    originDate.getDate()
  );
  if (anniversaryThisYear > today) yearsPassed -= 1;
  yearsPassed = Math.max(0, yearsPassed);

  const lastOccurrence = getLastOccurrence(yearlyProbe, now);
  const daysSinceLastOccurrence = Math.round(
    (today.getTime() - startOfDay(lastOccurrence).getTime()) / 86400000
  );

  return {
    event,
    originDate,
    nextDate,
    daysUntil,
    yearsPassed,
    daysSinceLastOccurrence,
    totalDaysPassed: daysTogether - 1,
    isToday: daysUntil === 0,
    daysTogether,
    isElapsed: true,
  };
}

/** 今天或之前，最近的一次纪念日日期 */
export function getLastOccurrence(
  event: AnniversaryEvent,
  now: Date = new Date()
): Date {
  const today = startOfDay(now);
  const origin = startOfDay(getOriginSolarDate(event));
  const parts = parseYmd(event.date);

  if (event.type === "lunar") {
    const prev = findPrevSolarForLunarMD(
      parts.month,
      parts.day,
      today,
      event.leapMonth === true
    );
    return prev && prev >= origin ? prev : origin;
  }

  let candidate = solarOccurrenceInYear(
    today.getFullYear(),
    parts.month,
    parts.day
  );
  if (candidate > today) {
    candidate = solarOccurrenceInYear(
      today.getFullYear() - 1,
      parts.month,
      parts.day
    );
  }
  return candidate >= origin ? candidate : origin;
}

/** 两个日期之间的年 / 月 / 日差（日历粒度） */
export function diffCalendar(
  from: Date,
  to: Date
): { years: number; months: number; days: number } {
  const start = startOfDay(from);
  const end = startOfDay(to);
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

export function formatPassedLabel(item: AnniversaryComputed): string {
  const { years, months, days } = diffCalendar(item.originDate, new Date());
  return `已过 ${years} 年 ${months} 月 ${days} 天`;
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calendarTypeLabel(type: CalendarType): string {
  return type === "lunar" ? "🏮 阴历" : "☀️ 阳历";
}

/** 看板/卡片用：阴历闰月显示「阴历 闰×月」 */
export function eventCalendarLabel(event: AnniversaryEvent): string {
  const base = calendarTypeLabel(event.type);
  if (event.type !== "lunar" || event.leapMonth !== true) return base;
  const { month } = parseYmd(event.date);
  return `${base} ${lunarMonthLabel(month, true)}`;
}

export function sortByDaysUntil(items: AnniversaryComputed[]): AnniversaryComputed[] {
  return [...items].sort((a, b) => a.daysUntil - b.daysUntil);
}

export function computeAll(events: AnniversaryEvent[]): AnniversaryComputed[] {
  return sortByDaysUntil(events.map((e) => computeAnniversary(e)));
}
