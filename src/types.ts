export type CalendarType = "solar" | "lunar";

/** 每年重复纪念 / 从起始日累计天数（在一起） */
export type RecurrenceType = "yearly" | "elapsed";

/** 分组 ID（内置或自定义） */
export type EventGroup = string;

export interface GroupDef {
  id: string;
  label: string;
}

export interface AnniversaryEvent {
  id: string;
  name: string;
  /** YYYY-MM-DD — 阳历为公历，阴历为农历出生/起始日期 */
  date: string;
  type: CalendarType;
  /** 每年纪念 repeat vs 累计天数（起始日） */
  recurrence?: RecurrenceType;
  /**
   * 阴历闰月标记。仅 type=lunar 时有意义；
   * 老数据无该字段 = 普通月，不能让现有纪念日跳日。
   */
  leapMonth?: boolean;
  group: EventGroup;
  sortOrder: number;
  showInSidebar: boolean;
  remindersEnabled: boolean;
  notes?: string;
}

export interface ReminderTier {
  enabled: boolean;
  days: number;
  label: string;
}

export interface PluginSettings {
  /** @deprecated 数据已迁移至插件目录 events.json */
  dataFilePath?: string;
  reminderTiers: [ReminderTier, ReminderTier, ReminderTier];
  /** Obsidian 内阻塞弹窗 */
  enableObsidianNotice: boolean;
  /** macOS / 桌面系统通知 */
  enableDesktopNotification: boolean;
  reminderHour: number;
  reminderMinute: number;
  /** 上次完成每日检查的日期 YYYY-MM-DD */
  lastReminderCheckDate: string;
  /** 阳历 2/29 在非闰年落到哪一天 */
  leapDayFallback: "feb28" | "mar1";
  /** 「在一起」累计天数事项是否也发周年提醒 */
  remindElapsedAnniversary: boolean;
  showStatusBar: boolean;
  collapsedGroups: EventGroup[];
  /** 分组定义（可增删改） */
  groups: GroupDef[];
  groupOrder: EventGroup[];
  sentReminderKeys: string[];
  /** 已读更新说明的版本号，与 manifest version 对齐 */
  lastSeenVersion: string;
  /** 用户输入的激活码 */
  licenseKey: string;
  /** 由 syncLicenseState 校验写入，不可单独篡改绕过 */
  licenseActivated: boolean;
  /** 试用开始时间 ISO（24h 体验版） */
  trialStartedAt?: string;
  /** 是否已确认开始试用 */
  trialWelcomeSeen?: boolean;
  trialReminder2hSeen?: boolean;
  trialReminder30mSeen?: boolean;
  /** 非空表示已点「知道了」，不再自动弹出使用说明 */
  welcomeGuideVersion: string;
  /** 已展示过一次侧边栏交互提示（Notice） */
  sidebarHintSeen: boolean;
  /** 侧边栏看板视图：分组列表 / 时间轴 / 月历 */
  dashboardViewMode: "list" | "timeline" | "calendar";
  /** 看板筛选：all / birthday / 分组 ID */
  dashboardFilter: string;
  /** @deprecated 已迁移至 groups */
  groupLabels?: Partial<Record<string, string>>;
}

export interface VaultAnniversaryData {
  version: number;
  updatedAt: string;
  events: AnniversaryEvent[];
}

export interface AnniversaryComputed {
  event: AnniversaryEvent;
  originDate: Date;
  nextDate: Date;
  daysUntil: number;
  yearsPassed: number;
  daysSinceLastOccurrence: number;
  totalDaysPassed: number;
  isToday: boolean;
  /** 累计天数模式：在一起第 N 天 */
  daysTogether?: number;
  isElapsed?: boolean;
}

export const DEFAULT_GROUPS: GroupDef[] = [
  { id: "birthday", label: "家人生日" },
  { id: "marriage", label: "婚姻纪念" },
  { id: "love", label: "恋爱纪念" },
  { id: "other", label: "其他" },
];

/** 内置分组默认名（迁移/兜底） */
export const LEGACY_GROUP_LABELS: Record<string, string> = {
  birthday: "家人生日",
  marriage: "婚姻纪念",
  love: "恋爱纪念",
  other: "其他",
};

export const DEFAULT_GROUP_ORDER: EventGroup[] = DEFAULT_GROUPS.map((g) => g.id);

export const DEFAULT_SETTINGS: PluginSettings = {
  reminderTiers: [
    { enabled: true, days: 30, label: "提前 30 天" },
    { enabled: true, days: 15, label: "提前 15 天" },
    { enabled: true, days: 7, label: "提前 7 天" },
  ],
  enableObsidianNotice: true,
  enableDesktopNotification: true,
  reminderHour: 9,
  reminderMinute: 0,
  lastReminderCheckDate: "",
  leapDayFallback: "feb28",
  remindElapsedAnniversary: false,
  showStatusBar: true,
  collapsedGroups: [],
  groups: DEFAULT_GROUPS.map((g) => ({ ...g })),
  groupOrder: [...DEFAULT_GROUP_ORDER],
  sentReminderKeys: [],
  lastSeenVersion: "",
  licenseKey: "",
  licenseActivated: false,
  trialStartedAt: "",
  trialWelcomeSeen: false,
  trialReminder2hSeen: false,
  trialReminder30mSeen: false,
  welcomeGuideVersion: "",
  sidebarHintSeen: false,
  dashboardViewMode: "list",
  dashboardFilter: "all",
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateGroupId(): string {
  return `grp-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeEvent(raw: Partial<AnniversaryEvent>): AnniversaryEvent {
  const type = raw.type === "lunar" ? "lunar" : "solar";
  return {
    id: raw.id ?? generateId(),
    name: raw.name ?? "📅 未命名",
    date: raw.date ?? "2000-01-01",
    type,
    recurrence: raw.recurrence === "elapsed" ? "elapsed" : "yearly",
    // 老数据无该字段 = 普通月，不能让现有纪念日跳日
    leapMonth: type === "lunar" && raw.leapMonth === true ? true : undefined,
    group: raw.group ?? "other",
    sortOrder: raw.sortOrder ?? 0,
    showInSidebar: raw.showInSidebar !== false,
    remindersEnabled: raw.remindersEnabled !== false,
    notes: raw.notes,
  };
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
