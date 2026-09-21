import type { AnniversaryComputed } from "./types";
import type { RecurrenceType } from "./types";

export function formatCountdownPrimary(item: AnniversaryComputed): string {
  if (item.isElapsed && item.daysTogether != null) {
    return `已经 ${item.daysTogether} 天`;
  }
  if (item.isToday) return "🎉 就是今天！";
  return `还有 ${item.daysUntil} 天`;
}

export function formatCountdownShort(item: AnniversaryComputed): string {
  if (item.isElapsed && item.daysTogether != null) {
    return `已经 ${item.daysTogether} 天`;
  }
  if (item.isToday) return "就是今天";
  return `还有 ${item.daysUntil} 天`;
}

export function formatCountdownPlain(item: AnniversaryComputed): string {
  if (item.isElapsed && item.daysTogether != null) {
    return `已经 ${item.daysTogether} 天`;
  }
  if (item.isToday) return "🎉 今天";
  return `还有 ${item.daysUntil} 天`;
}

export function recurrenceLabel(mode: RecurrenceType): string {
  return mode === "elapsed" ? "累计天数" : "每年纪念";
}

export function sortDashboardItems(items: AnniversaryComputed[]): AnniversaryComputed[] {
  return [...items].sort((a, b) => {
    if (a.isElapsed && b.isElapsed) {
      return (b.daysTogether ?? 0) - (a.daysTogether ?? 0);
    }
    if (a.isElapsed !== b.isElapsed) {
      return a.isElapsed ? 1 : -1;
    }
    return a.daysUntil - b.daysUntil || a.event.sortOrder - b.event.sortOrder;
  });
}
