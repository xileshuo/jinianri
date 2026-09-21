import type { AnniversaryComputed } from "./types";
import { formatYmd } from "./date-utils";

export type DashboardViewMode = "list" | "timeline" | "calendar";

export interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

const WEEKDAY_MON_FIRST = ["一", "二", "三", "四", "五", "六", "日"];

export function formatMonthTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7;
  const cells: CalendarCell[] = [];

  for (let i = 0; i < mondayOffset; i++) {
    cells.push({
      date: new Date(year, month - 1, 1 - (mondayOffset - i)),
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month - 1, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const prev = cells[cells.length - 1].date;
    cells.push({
      date: new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1),
      inMonth: false,
    });
  }
  return cells;
}

export function indexEventsByNextDate(
  items: AnniversaryComputed[]
): Map<string, AnniversaryComputed[]> {
  const map = new Map<string, AnniversaryComputed[]>();
  for (const item of items) {
    const key = formatYmd(item.nextDate);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export function filterItemsInMonth(
  items: AnniversaryComputed[],
  year: number,
  month: number
): AnniversaryComputed[] {
  return items.filter((item) => {
    const d = item.nextDate;
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function getWeekdayHeaders(): string[] {
  return [...WEEKDAY_MON_FIRST];
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
