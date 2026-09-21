import type { AnniversaryEvent, EventGroup, VaultAnniversaryData } from "./types";
import { generateId, normalizeEvent } from "./types";

/** 新用户默认示例（3 条） */
export const SAMPLE_EVENTS: AnniversaryEvent[] = [
  {
    id: "sample-birthday",
    name: "🎂 示例生日",
    date: "1990-01-01",
    type: "solar",
    group: "birthday",
    sortOrder: 0,
    showInSidebar: true,
    remindersEnabled: true,
    notes: "可在设置中编辑或删除此示例，添加你自己的纪念日",
  },
  {
    id: "sample-anniversary",
    name: "💍 示例纪念日",
    date: "2020-06-01",
    type: "solar",
    group: "marriage",
    sortOrder: 0,
    showInSidebar: true,
    remindersEnabled: true,
  },
  {
    id: "sample-love",
    name: "💌 示例恋爱纪念",
    date: "2020-02-14",
    type: "solar",
    group: "love",
    sortOrder: 0,
    showInSidebar: true,
    remindersEnabled: true,
  },
];

export const SAMPLE_EVENT_IDS = new Set(SAMPLE_EVENTS.map((e) => e.id));

export function isSampleEvent(event: AnniversaryEvent): boolean {
  return (event as AnniversaryEvent & { isSample?: boolean }).isSample === true
    || SAMPLE_EVENT_IDS.has(event.id);
}

export function isSampleOnlyData(events: AnniversaryEvent[]): boolean {
  return events.length > 0 && events.every((e) => isSampleEvent(e));
}

export function countSampleEvents(events: AnniversaryEvent[]): number {
  return events.filter((e) => isSampleEvent(e)).length;
}

export function createDefaultVaultData(): VaultAnniversaryData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    events: SAMPLE_EVENTS.map((e) => ({ ...e })),
  };
}

const GROUP_BY_NAME: Array<{ pattern: RegExp; group: EventGroup }> = [
  { pattern: /生日|父皇|母上|女王|宝宝/, group: "birthday" },
  { pattern: /结婚|领证|求婚/, group: "marriage" },
  { pattern: /相识|表白|旅行|拥抱|Kiss|亲密/, group: "love" },
];

export function inferGroup(name: string): EventGroup {
  for (const rule of GROUP_BY_NAME) {
    if (rule.pattern.test(name)) return rule.group;
  }
  return "other";
}

/** 从 纪念日.md 的 dataviewjs 块解析纪念事项 */
export function parseMarkdownAnniversaries(content: string): AnniversaryEvent[] {
  const blockMatch = content.match(/```dataviewjs([\s\S]*?)```/);
  if (!blockMatch) return [];

  const block = blockMatch[1];
  const itemRegex =
    /\{\s*name:\s*"([^"]+)"\s*,\s*date:\s*"(\d{4}-\d{2}-\d{2})"\s*,\s*type:\s*"(阴|阳)"/g;

  const sortCounters: Record<EventGroup, number> = {
    birthday: 0,
    marriage: 0,
    love: 0,
    other: 0,
  };
  const events: AnniversaryEvent[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(block)) !== null) {
    const name = match[1];
    const group = inferGroup(name);
    events.push(
      normalizeEvent({
        id: generateId(),
        name,
        date: match[2],
        type: match[3] === "阴" ? "lunar" : "solar",
        group,
        sortOrder: sortCounters[group]++,
        showInSidebar: true,
        remindersEnabled: true,
      })
    );
  }

  return events;
}
