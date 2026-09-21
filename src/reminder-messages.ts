import type { AnniversaryComputed, ReminderTier } from "./types";
import { calendarTypeLabel, formatPassedLabel, formatYmd } from "./date-utils";
import { parseEventName } from "./name-utils";

export function buildTierReminderMessage(
  item: AnniversaryComputed,
  tier: ReminderTier
): { title: string; body: string } {
  const { icon, label } = parseEventName(item.event.name);
  const title = `${icon} ${label}`;
  const body = [
    `${tier.label} · 还有 ${item.daysUntil} 天`,
    `下次：${formatYmd(item.nextDate)}（${calendarTypeLabel(item.event.type)} ${item.event.date}）`,
    formatPassedLabel(item),
  ].join("\n");
  return { title, body };
}

export function buildTodayReminderMessage(item: AnniversaryComputed): { title: string; body: string } {
  const { icon, label } = parseEventName(item.event.name);
  const title = `${icon} ${label}`;
  const body = [
    "🎉 就是今天！纪念日快乐！",
    `${calendarTypeLabel(item.event.type)} ${item.event.date} · ${formatPassedLabel(item)}`,
  ].join("\n");
  return { title, body };
}

import { Platform } from "obsidian";

export function buildTestReminderMessage(pluginName = "纪念日"): { title: string; body: string } {
  const channel = Platform.isMobile
    ? "Obsidian 内弹窗"
    : "Obsidian 内弹窗 + 桌面系统通知（如已开启）";
  return {
    title: "🎂 测试提醒",
    body: `${pluginName} 提醒正常\n${channel}`,
  };
}
