import { Plugin, addIcon, Notice, Platform, TFile, type MarkdownPostProcessor } from "obsidian";
import {
  DEFAULT_SETTINGS,
  type AnniversaryComputed,
  type AnniversaryEvent,
  type EventGroup,
  type PluginSettings,
  formatReminderTime,
  normalizeEvent,
} from "./types";
import {
  migrateGroupSettings,
  getGroupLabelFromSettings,
  addGroup,
  updateGroupLabel,
  deleteGroup,
  ensureEventGroup,
  groupSortIndex,
} from "./group-utils";
import { DashboardView, DASHBOARD_VIEW_TYPE } from "./dashboard-view";
import {
  cleanupStaleRegistrations,
  removeStalePluginSettingTabs,
  safeAddCommand,
  safeAddRibbonIcon,
  safeAddSettingTab,
  safeRegisterCodeBlockProcessor,
  safeRegisterView,
} from "./plugin-reload-guard";
import { MobileDashboardModal } from "./mobile-dashboard-modal";
import { JinianriSettingTab, type SettingsTabId } from "./settings-tab";
import { ReminderService } from "./reminder-service";
import { DataStore } from "./data-store";
import { JinianriStatusBar, cleanupStaleStatusBarItems } from "./status-bar";
import { debounce } from "./utils/debounce";
import {
  computeAll,
  computeAnniversary,
  formatYmd,
  eventCalendarLabel,
  formatPassedLabel,
  setLeapDayFallback,
} from "./date-utils";
import { exportIcsToVault, showIcsExportNotice } from "./ical-export";
import { buildTestReminderMessage } from "./reminder-messages";
import { showReminderNotice } from "./notification-utils";
import { EventModal, type EventModalOptions } from "./event-modal";
import { countSampleEvents, isSampleEvent } from "./vault-data";
import { getPluginEventsPath } from "./plugin-paths";
import { showUpdateNoticeModal } from "./update-notice";
import {
  ensureTrialStarted,
  isLicenseEnforced,
  isPluginAccessAllowed,
  isPluginLicensed,
  isTrialEdition,
  syncLicenseState,
} from "./license";
import { openWelcomeGuideOnce, type OpenGuideOptions } from "./usage-guide";
import { checkTrialExpiryReminders, runJinianriTrialStartup } from "./lifeos-trial";
import { maybeShowLifeOsSuitePrompt } from "./lifeos-suite";
import type { DashboardViewMode } from "./dashboard-calendar";
import { formatCountdownPlain } from "./display-labels";
import { shiftMonth } from "./dashboard-calendar";
import { applyDashboardFilter } from "./dashboard-filter";

const CALENDAR_HEART_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14c-1.5 1.5-4 3-4 5a2 2 0 0 0 4 0c0-2-2.5-3.5-4-5z"/></svg>`;

/** 倒计时按天粒度；12h 复检跨日即可，回到前台另有 visibilitychange 立即刷新 */
const DAY_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

export default class JinianriPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  events: AnniversaryEvent[] = [];
  dataStore!: DataStore;
  reminderService!: ReminderService;
  statusBar!: JinianriStatusBar;
  mobileDashboard: MobileDashboardModal | null = null;
  highlightEventId: string | null = null;
  pendingAddEventOnSettings = false;
  pendingSettingsTab: SettingsTabId | null = null;
  settingTab: JinianriSettingTab | null = null;

  /** 月历视图当前月份 */
  calendarViewYear = new Date().getFullYear();
  calendarViewMonth = new Date().getMonth() + 1;
  /** 月历选中日 YYYY-MM-DD，空表示未选中 */
  selectedCalendarDay = "";

  private computeCache = new Map<string, AnniversaryComputed>();
  private computeDayKey = "";
  private debouncedPersistSettings!: () => void;
  private debouncedSaveEvents!: () => void;
  private debouncedSaveEventsQuiet!: () => void;
  trialExpiredModalShown = false;
  private codeBlockProcessor: MarkdownPostProcessor | null = null;
  private alive = false;
  private inlineHosts = new Set<HTMLElement>();
  private bootstrapping = false;
  private bootstrapDone = false;

  onload(): void {
    this.alive = true;
    void this.bootstrap();
  }

  /** 异步初始化：onload 必须同步返回，否则移动端禁用插件会报「无法禁用」 */
  private async bootstrap(): Promise<void> {
    if (this.bootstrapping || this.bootstrapDone) return;
    this.bootstrapping = true;
    // 启动清理勿同步 detach（移动端禁用时会卡住）；延迟到下一 tick
    await new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (this.alive) {
          cleanupStaleRegistrations(this.app, DASHBOARD_VIEW_TYPE, "jinianri");
        }
        resolve();
      }, 0);
    });
    if (!this.alive) return;
    try {
      try {
        addIcon("calendar-heart", CALENDAR_HEART_ICON);
      } catch (err) {
        console.warn("[纪念日] 图标已存在，跳过", err);
      }

      this.debouncedPersistSettings = debounce(() => void this.saveData(this.settings), 350);
      this.debouncedSaveEvents = debounce(() => void this.flushSaveEvents(), 350);
      this.debouncedSaveEventsQuiet = debounce(() => void this.persistEventsQuiet(), 350);

      await this.loadSettings();
      if (!this.alive) return;

      this.dataStore = new DataStore(this);
      this.events = await this.dataStore.load();
      if (!this.alive) return;
      this.normalizeEventGroups();
      this.dataStore.watch(() => void this.reloadEvents());

      cleanupStaleStatusBarItems();

      if (!this.alive) return;

      this.reminderService = new ReminderService(this);
      this.reminderService.pruneSentKeys();
      this.statusBar = new JinianriStatusBar(this);

      if (!this.alive) return;

      safeRegisterView(
        this.app,
        DASHBOARD_VIEW_TYPE,
        (leaf) => new DashboardView(leaf, this),
        (type, creator) => this.registerView(type, creator)
      );

      safeAddRibbonIcon(this, "calendar-heart", "打开纪念日侧边栏", () => {
        void this.activateSidebar();
      });

      safeAddCommand(this, {
        id: "open-dashboard",
        name: "打开纪念日侧边栏",
        callback: () => void this.activateSidebar(),
      });

      safeAddCommand(this, {
        id: "open-dashboard-mobile",
        name: "打开纪念日面板（全屏）",
        callback: () => this.openMobileDashboard(),
      });

      safeAddCommand(this, {
        id: "check-reminders-now",
        name: "立即检查纪念日提醒",
        callback: () => {
          if (this.requireLicense()) this.reminderService.checkReminders(true);
        },
      });

      safeAddCommand(this, {
        id: "reimport-from-md",
        name: "从 纪念日.md 导入纪念事项",
        callback: () => {
          if (this.requireLicense()) void this.dataStore.reimportFromMarkdown({ confirm: true });
        },
      });

      safeAddCommand(this, {
        id: "export-ical",
        name: "导出 iCal 到库内 .ics",
        callback: () => void this.exportIcal(),
      });

      safeAddCommand(this, {
        id: "show-update-notice",
        name: "查看更新日志",
        callback: () => this.showUpdateNotice(true),
      });

      this.codeBlockProcessor = safeRegisterCodeBlockProcessor(
        this,
        "jinianri",
        (source, el) => this.renderInlineDashboard(el, source)
      );

      this.settingTab = new JinianriSettingTab(this.app, this);
      safeAddSettingTab(this, this.settingTab);

      if (!this.alive) return;

      this.registerInterval(
        window.setInterval(() => this.tickDayRefresh(), DAY_REFRESH_INTERVAL_MS)
      );

      this.registerDomEvent(document, "visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.onForegroundResume();
        }
      });

      this.registerEvent(
        this.app.workspace.on("active-leaf-change", (leaf) => {
          if (!this.alive || !leaf) return;
          if (leaf.view?.getViewType?.() === DASHBOARD_VIEW_TYPE) {
            this.refreshIfDateStale();
          }
        })
      );

      // 与 4.0.1 一致：onLayoutReady 返回 void，勿包进 registerEvent（否则禁用时报「无法禁用」）
      this.app.workspace.onLayoutReady(() => {
        if (!this.alive) return;
        if (this.isLicensed()) {
          this.reminderService.start();
        }
        this.statusBar.update();
        checkTrialExpiryReminders(this);
        maybeShowLifeOsSuitePrompt(this.app, this.manifest.id, this.manifest.name);
      });
      this.bootstrapDone = true;
    } catch (err) {
      if (!this.alive) return;
      console.error("纪念日插件加载失败", err);
      new Notice(`纪念日插件加载失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.bootstrapping = false;
    }
  }

  onunload(): void {
    this.alive = false;
    this.bootstrapping = false;
    const app = this.app;
    const pluginId = this.manifest.id;
    // 与 4.0.1 极简卸载一致：禁止 detach / 清 leaf DOM（会触发手机端「无法禁用」与卡顿）
    window.setTimeout(() => removeStalePluginSettingTabs(app, pluginId), 200);
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<
      PluginSettings & { events?: AnniversaryEvent[]; version?: number; updatedAt?: string }
    > | null;
    await this.ensureEventsMigratedFromSettingsFile(data);
    const { events: _legacyEvents, version: _v, updatedAt: _u, ...settingsOnly } = data ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsOnly);
    if (!Array.isArray(this.settings.sentReminderKeys)) {
      this.settings.sentReminderKeys = [];
    }
    if (!Array.isArray(this.settings.collapsedGroups)) {
      this.settings.collapsedGroups = [];
    }
    if (this.settings.dashboardViewMode !== "list"
      && this.settings.dashboardViewMode !== "timeline"
      && this.settings.dashboardViewMode !== "calendar") {
      this.settings.dashboardViewMode = "list";
    }
    if (!this.settings.dashboardFilter) {
      this.settings.dashboardFilter = "all";
    }
    if (this.settings.leapDayFallback !== "mar1") {
      this.settings.leapDayFallback = "feb28";
    }
    setLeapDayFallback(this.settings.leapDayFallback);
    migrateGroupSettings(this.settings);
    const wasActivated = !!this.settings.licenseActivated;
    syncLicenseState(this.app, this.settings);
    if (this.settings.licenseActivated && !wasActivated) {
      void this.saveSettings();
    }
    const hadEventsPayload =
      (_legacyEvents?.length ?? 0) > 0 ||
      (_v === 1 && !!_u && !data?.reminderTiers);
    if (hadEventsPayload) {
      void this.rewriteSettingsOnly();
    }
  }

  /** 旧版纪念事项写在 data.json，先迁到 events.json 再清理设置文件 */
  private async ensureEventsMigratedFromSettingsFile(
    raw: Partial<PluginSettings & { events?: AnniversaryEvent[] }> | null
  ): Promise<void> {
    if (!raw?.events?.length) return;

    const eventsPath = getPluginEventsPath(this.app);
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(eventsPath)) {
      try {
        const existing = JSON.parse(await adapter.read(eventsPath)) as { events?: AnniversaryEvent[] };
        if (existing.events?.length) return;
      } catch {
        /* 继续迁移 */
      }
    }

    const folder = eventsPath.split("/").slice(0, -1).join("/");
    if (folder) await adapter.mkdir(folder).catch(() => {});

    const content = JSON.stringify(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        events: raw.events.map((e, i) =>
          normalizeEvent({
            ...e,
            sortOrder: e.sortOrder ?? i,
          })
        ),
      },
      null,
      2
    );
    await adapter.write(eventsPath, content);
  }

  /** 旧版曾把纪念事项写入 data.json，清理为纯设置 */
  async rewriteSettingsOnly(): Promise<void> {
    await this.saveData(this.settings);
  }

  private normalizeEventGroups(): void {
    for (const event of this.events) {
      event.group = ensureEventGroup(event.group, this.settings);
    }
  }

  getGroupLabel(group: EventGroup): string {
    return getGroupLabelFromSettings(this.settings, group);
  }

  getGroupOrder(): EventGroup[] {
    return this.settings.groupOrder.length
      ? [...this.settings.groupOrder]
      : this.settings.groups.map((g) => g.id);
  }

  getGroupSortIndex(groupId: EventGroup): number {
    return groupSortIndex(this.settings, groupId);
  }

  addGroup(label: string): EventGroup {
    const def = addGroup(this.settings, label);
    void this.persistSettings();
    this.refreshViews();
    return def.id;
  }

  renameGroup(id: EventGroup, label: string): void {
    updateGroupLabel(this.settings, id, label);
    void this.persistSettings();
    this.refreshViews();
  }

  removeGroup(id: EventGroup): boolean {
    const fallback = deleteGroup(this.settings, id);
    if (!fallback) return false;
    for (const event of this.events) {
      if (event.group === id) event.group = fallback;
    }
    void this.persistSettings();
    void this.flushSaveEvents();
    this.refreshViews();
    return true;
  }

  getReminderTimeString(): string {
    return formatReminderTime(this.settings.reminderHour, this.settings.reminderMinute);
  }

  setReminderTime(value: string): boolean {
    const parsed = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!parsed) return false;
    const hour = parseInt(parsed[1], 10);
    const minute = parseInt(parsed[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
    this.settings.reminderHour = hour;
    this.settings.reminderMinute = minute;
    return true;
  }

  sendTestReminder(): void {
    if (!this.requireLicense()) return;
    const msg = buildTestReminderMessage();
    showReminderNotice(msg.title, msg.body, {
      app: this.app,
      obsidian: this.settings.enableObsidianNotice,
      desktop: this.settings.enableDesktopNotification,
    });
  }

  async saveSettings(): Promise<void> {
    this.debouncedPersistSettings.cancel();
    await this.saveData(this.settings);
  }

  isPluginAlive(): boolean {
    return this.alive;
  }

  private lastRefreshDay = new Date().toDateString();

  private hasOpenDashboardViews(): boolean {
    return (
      this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).length > 0 ||
      !!this.mobileDashboard?.isOpen
    );
  }

  private tickDayRefresh(): void {
    if (!this.alive) return;
    const dayKey = new Date().toDateString();
    const dayChanged = dayKey !== this.lastRefreshDay;
    const cacheStale = this.computeDayKey !== "" && this.computeDayKey !== dayKey;
    if (!dayChanged && !cacheStale) return;
    this.lastRefreshDay = dayKey;
    this.invalidateComputeCache();
    this.statusBar.update();
    this.refreshInlineBlocks();
    if (this.hasOpenDashboardViews()) this.refreshViews();
  }

  /** 手机后台会暂停 setInterval；回到前台时立即重算并重绘侧边栏 */
  private onForegroundResume(): void {
    if (!this.alive) return;
    const dayKey = new Date().toDateString();
    const dayChanged = this.computeDayKey !== dayKey;
    this.lastRefreshDay = dayKey;
    this.invalidateComputeCache();
    this.statusBar.update();
    this.refreshInlineBlocks();
    if (this.hasOpenDashboardViews()) this.refreshViews();
    if (dayChanged && this.isLicensed()) {
      this.reminderService?.onDayMayHaveChanged();
    }
  }

  private refreshIfDateStale(): void {
    if (!this.alive) return;
    const dayKey = new Date().toDateString();
    if (this.computeDayKey === dayKey) return;
    this.lastRefreshDay = dayKey;
    this.invalidateComputeCache();
    this.statusBar.update();
    this.refreshInlineBlocks();
    this.refreshViews();
  }

  private refreshInlineBlocks(): void {
    for (const el of [...this.inlineHosts]) {
      if (el.isConnected) {
        const source = el.dataset.jnrSource ?? "";
        this.renderInlineDashboard(el, source);
      } else this.inlineHosts.delete(el);
    }
  }

  /** 解析 ```jinianri 代码块参数：limit / filter / view=compact|cards|table */
  private parseCodeblockSource(source: string): {
    limit: number;
    filter: string;
    forceCompact: boolean | null;
  } {
    let limit = 12;
    let filter = "all";
    let forceCompact: boolean | null = null;
    for (const raw of String(source || "").split(/\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(limit|filter|view)\s*[:=]\s*(.+)$/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "limit") {
        const n = parseInt(val, 10);
        if (Number.isFinite(n) && n > 0) limit = Math.min(100, n);
      } else if (key === "filter") {
        filter = val || "all";
      } else if (key === "view") {
        if (/compact|cards?/i.test(val)) forceCompact = true;
        else if (/table/i.test(val)) forceCompact = false;
      }
    }
    return { limit, filter, forceCompact };
  }

  private renderInlineDashboard(container: HTMLElement, source = ""): void {
    this.inlineHosts.add(container);
    container.dataset.jnrSource = source;
    if (!this.isLicensed()) {
      container.empty();
      container.addClass("jnr-inline-unlicensed");
      container.createEl("p", { text: "请先激活插件后再使用嵌入看板。" });
      container
        .createEl("button", { text: "去激活", cls: "mod-cta jnr-inline-activate-btn" })
        .addEventListener("click", () => void this.activateSidebar());
      return;
    }
    container.empty();
    container.addClass("jnr-inline-dashboard");

    const opts = this.parseCodeblockSource(source);
    let items = computeAll(this.events.filter((e) => e.showInSidebar));
    items = applyDashboardFilter(items, opts.filter);
    if (items.length === 0) {
      container.createEl("p", { text: "暂无纪念事项" });
      container.createEl("p", {
        cls: "jnr-inline-empty-hint",
        text: "在 设置 → 第三方插件 → 纪念日 → 事项 中添加，或点击 Ribbon 日历图标打开侧边栏。",
      });
      container
        .createEl("button", { text: "添加纪念日", cls: "mod-cta jnr-inline-empty-cta" })
        .addEventListener("click", () => this.openAddEventModal());
      return;
    }

    const paint = () => {
      const width = container.clientWidth;
      // clientWidth===0 首帧勿当窄屏（嵌入块常未布局完）
      const compact =
        opts.forceCompact === true ||
        (opts.forceCompact !== false &&
          (Platform.isMobile || (width > 0 && width < 480)));
      container.empty();
      container.addClass("jnr-inline-dashboard");

      const shown = items.slice(0, opts.limit);
      if (compact) {
        const cards = container.createDiv({ cls: "jnr-inline-cards" });
        for (const item of shown) {
          const card = cards.createDiv({ cls: "jnr-inline-card" });
          card.createDiv({ cls: "jnr-inline-card-name", text: item.event.name });
          card.createDiv({
            cls: "jnr-inline-card-meta",
            text: `${formatCountdownPlain(item)} · ${formatYmd(item.nextDate)}`,
          });
          if (item.event.notes?.trim()) {
            card.createDiv({
              cls: "jnr-inline-card-notes",
              text: item.event.notes.trim(),
            });
          }
        }
        if (items.length > opts.limit) {
          cards.createEl("p", {
            cls: "jnr-inline-empty-hint",
            text: `还有 ${items.length - opts.limit} 项，请打开侧边栏查看全部`,
          });
        }
        return;
      }

      const tableWrap = container.createDiv({ cls: "jnr-table-wrap" });
      const table = tableWrap.createEl("table", { cls: "jnr-table" });
      const headRow = table.createEl("thead").createEl("tr");
      ["纪念事项", "原始日期", "类型", "累计时长", "下次日期 (阳)", "距离下次", "备注"].forEach(
        (h) => headRow.createEl("th", { text: h })
      );
      const tbody = table.createEl("tbody");

      for (const item of shown) {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: item.event.name });
        tr.createEl("td", { text: item.event.date });
        tr.createEl("td", { text: eventCalendarLabel(item.event) });
        tr.createEl("td", { text: formatPassedLabel(item) });
        tr.createEl("td", { text: formatYmd(item.nextDate) });
        tr.createEl("td", { text: formatCountdownPlain(item) });
        tr.createEl("td", { text: item.event.notes?.trim() || "—" });
      }
      if (items.length > opts.limit) {
        container.createEl("p", {
          cls: "jnr-inline-empty-hint",
          text: `还有 ${items.length - opts.limit} 项，请打开侧边栏查看全部`,
        });
      }
    };

    paint();
    // 首帧宽度为 0 时，等布局完成再画一次，避免误判卡片
    if (container.clientWidth === 0 && opts.forceCompact == null) {
      const ro = new ResizeObserver(() => {
        if (container.clientWidth <= 0) return;
        ro.disconnect();
        paint();
      });
      ro.observe(container);
      window.setTimeout(() => ro.disconnect(), 2000);
    }
  }

  reorderGroups(dragged: EventGroup, target: EventGroup, before: boolean): void {
    if (dragged === target) return;
    const order = this.getGroupOrder().filter((g) => g !== dragged);
    const idx = order.indexOf(target);
    if (idx < 0) return;
    order.splice(before ? idx : idx + 1, 0, dragged);
    this.settings.groupOrder = order as PluginSettings["groupOrder"];
    this.debouncedPersistSettings();
  }

  invalidateComputeCache(): void {
    this.computeCache.clear();
    this.computeDayKey = "";
  }

  getComputed(event: AnniversaryEvent): AnniversaryComputed {
    const dayKey = new Date().toDateString();
    if (this.computeDayKey !== dayKey) {
      this.computeCache.clear();
      this.computeDayKey = dayKey;
    }
    let item = this.computeCache.get(event.id);
    if (!item) {
      item = computeAnniversary(event);
      this.computeCache.set(event.id, item);
    }
    return item;
  }

  getComputedAll(filter?: (e: AnniversaryEvent) => boolean): AnniversaryComputed[] {
    const list = filter ? this.events.filter(filter) : this.events;
    return list.map((e) => this.getComputed(e));
  }

  /** 侧边栏「即将到期」区：与提醒档位联动，至少 7 天 */
  getSoonDaysThreshold(): number {
    const tierDays = this.settings.reminderTiers.filter((t) => t.enabled).map((t) => t.days);
    const maxTier = tierDays.length > 0 ? Math.max(...tierDays) : 7;
    return Math.max(7, maxTier);
  }

  openSettingsTab(forceRefresh = false): void {
    this.app.setting.open();
    this.app.setting.openTabById(this.manifest.id);
    if (
      forceRefresh ||
      this.pendingSettingsTab ||
      this.highlightEventId ||
      this.pendingAddEventOnSettings
    ) {
      this.settingTab?.display();
    }
  }

  openSettingsForEvent(eventId: string): void {
    this.highlightEventId = eventId;
    this.pendingSettingsTab = "events";
    this.openSettingsTab(true);
  }

  onLicenseActivated(): void {
    this.reminderService?.start();
    this.statusBar?.update();
    this.refreshViews();
    if (this.events.length === 0) {
      new Notice("✅ 激活成功！在侧边栏点「添加第一个纪念日」，或进入设置添加");
    }
  }

  openSettingsToAddEvent(): void {
    this.pendingAddEventOnSettings = true;
    this.pendingSettingsTab = "events";
    this.openSettingsTab(true);
  }

  /** 侧边栏直接打开添加弹窗，不经设置页 shell */
  openAddEventModal(options?: EventModalOptions): void {
    if (!this.requireLicense()) return;
    new EventModal(
      this.app,
      this,
      null,
      async (result, updated) => {
        if (result.deleted) {
          const idx = this.events.findIndex((e) => e.id === updated.id);
          if (idx >= 0) this.events.splice(idx, 1);
        } else {
          updated.sortOrder = this.events.filter(
            (e) => e.group === updated.group
          ).length;
          this.events.push(updated);
        }
        await this.flushSaveEvents();
        this.settingTab?.refreshIfOpen();
      },
      options
    ).open();
  }

  /** 侧边栏 / 时间轴 / Spotlight 点事项：直接开编辑弹窗，不绕设置页 */
  openEditEventModal(eventId: string): void {
    if (!this.requireLicense()) return;
    const event = this.events.find((e) => e.id === eventId);
    if (!event) {
      new Notice("该纪念事项已不存在");
      return;
    }
    new EventModal(this.app, this, { ...event }, async (result, updated) => {
      const idx = this.events.findIndex((e) => e.id === updated.id);
      if (result.deleted) {
        if (idx >= 0) this.events.splice(idx, 1);
      } else if (idx >= 0) {
        this.events[idx] = updated;
      }
      await this.flushSaveEvents();
      this.settingTab?.refreshIfOpen();
    }).open();
  }

  hasSampleEvents(): boolean {
    return this.events.some((e) => isSampleEvent(e));
  }

  /** 清除插件预填的示例数据，让新用户明确「这不是我的数据」 */
  async clearSampleEvents(): Promise<number> {
    const removed = countSampleEvents(this.events);
    if (removed === 0) {
      new Notice("没有示例数据可清除");
      return 0;
    }
    this.events = this.events.filter((e) => !isSampleEvent(e));
    await this.flushSaveEvents();
    new Notice(`已清除 ${removed} 条示例数据`);
    return removed;
  }

  isLicensed(): boolean {
    return isPluginLicensed(this.app, this.settings);
  }

  requireLicense(): boolean {
    if (!isLicenseEnforced()) return true;
    if (this.settings.trialWelcomeSeen || !isTrialEdition()) {
      ensureTrialStarted(this.app, this.settings, !!this.settings.trialWelcomeSeen);
    }
    syncLicenseState(this.app, this.settings);
    if (isPluginAccessAllowed(this.app, this.settings)) return true;
    if (isTrialEdition() && !this.settings.trialWelcomeSeen) {
      new Notice("请先点击「开始试用」或输入激活码");
    } else if (isTrialEdition()) {
      new Notice("试用已到期，请打开纪念日面板输入激活码");
    } else {
      new Notice("请打开纪念日面板（日历图标）或设置完成激活");
    }
    return false;
  }

  async openWelcomeGuideOnce(options?: OpenGuideOptions): Promise<void> {
    await openWelcomeGuideOnce(this.app, options);
  }

  maybeShowUpdateNotice(): void {
    showUpdateNoticeModal(this.app, this);
  }

  showUpdateNotice(force = false): void {
    showUpdateNoticeModal(this.app, this, { force });
  }

  showUpdateNoticeForce(): void {
    this.showUpdateNotice(true);
  }

  async persistSettings(): Promise<void> {
    this.debouncedPersistSettings();
  }

  scheduleSaveEvents(): void {
    this.debouncedSaveEvents();
  }

  /** 拖动排序等场景：只写盘，不重建侧边栏 */
  scheduleSaveEventsQuiet(): void {
    this.debouncedSaveEventsQuiet();
  }

  async persistEventsQuiet(): Promise<void> {
    await this.dataStore.save(this.events);
  }

  async flushSaveEvents(): Promise<void> {
    this.invalidateComputeCache();
    await this.dataStore.save(this.events);
    this.statusBar.update();
    this.refreshViews();
  }

  async reloadEvents(): Promise<void> {
    this.invalidateComputeCache();
    this.events = await this.dataStore.load();
    this.normalizeEventGroups();
    this.statusBar.update();
    this.refreshViews();
  }

  refreshViews(): void {
    if (!this.hasOpenDashboardViews()) return;
    this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DashboardView) view.refresh();
    });
    if (this.mobileDashboard?.isOpen) {
      this.mobileDashboard.refresh();
    }
  }

  setDashboardViewMode(mode: DashboardViewMode): void {
    if (this.settings.dashboardViewMode === mode) return;
    this.settings.dashboardViewMode = mode;
    if (mode !== "calendar") {
      this.selectedCalendarDay = "";
    }
    void this.persistSettings();
    this.refreshViews();
  }

  setDashboardFilter(filter: string): void {
    const next = String(filter || "all");
    if (this.settings.dashboardFilter === next) return;
    this.settings.dashboardFilter = next;
    void this.persistSettings();
    this.refreshViews();
  }

  shiftCalendarMonth(delta: number): void {
    const next = shiftMonth(this.calendarViewYear, this.calendarViewMonth, delta);
    this.calendarViewYear = next.year;
    this.calendarViewMonth = next.month;
    this.selectedCalendarDay = "";
    this.refreshViews();
  }

  toggleCalendarDay(ymd: string): void {
    this.selectedCalendarDay = this.selectedCalendarDay === ymd ? "" : ymd;
    this.refreshViews();
  }

  clearCalendarDay(): void {
    if (!this.selectedCalendarDay) return;
    this.selectedCalendarDay = "";
    this.refreshViews();
  }

  refreshAll(): void {
    this.invalidateComputeCache();
    this.statusBar?.update();
    this.refreshViews();
  }

  async exportIcal(): Promise<void> {
    if (!this.requireLicense()) return;
    try {
      const file = await exportIcsToVault(
        this.app,
        this.events,
        (e) => this.getComputed(e),
        this.settings
      );
      showIcsExportNotice(file.path);
      if (!Platform.isMobile && file instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(file);
      }
    } catch (err) {
      new Notice(`iCal 导出失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  toggleGroupCollapsed(group: EventGroup): void {
    const idx = this.settings.collapsedGroups.indexOf(group);
    if (idx >= 0) {
      this.settings.collapsedGroups.splice(idx, 1);
    } else {
      this.settings.collapsedGroups.push(group);
    }
    this.debouncedPersistSettings();
  }

  isGroupCollapsed(group: EventGroup): boolean {
    return this.settings.collapsedGroups.includes(group);
  }

  private maybeRunDashboardWelcome(): void {
    if (!this.alive) return;
    runJinianriTrialStartup(this);
  }

  async activateSidebar(options?: { focus?: boolean }): Promise<void> {
    const focus = options?.focus !== false;
    const { workspace } = this.app;

    const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
    if (existing) {
      if (focus) {
        workspace.revealLeaf(existing);
      }
      void existing.loadIfDeferred();
      this.maybeRunDashboardWelcome();
      return;
    }

    try {
      const leaf = await workspace.ensureSideLeaf(DASHBOARD_VIEW_TYPE, "right", {
        active: focus,
        reveal: focus,
      });
      await leaf.loadIfDeferred();

      if (Platform.isMobile) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        const view = leaf.view;
        if (!(view instanceof DashboardView) || !view.containerEl.isConnected) {
          this.openMobileDashboard();
          return;
        }
      }
      this.maybeRunDashboardWelcome();
    } catch (err) {
      console.error("ensureSideLeaf 失败", err);
      if (Platform.isMobile) {
        this.openMobileDashboard();
        return;
      }
      new Notice("无法打开纪念日侧边栏");
    }
  }

  openMobileDashboard(): void {
    if (this.mobileDashboard?.isOpen) {
      this.mobileDashboard.refresh();
      return;
    }
    this.mobileDashboard = new MobileDashboardModal(this.app, this);
    this.mobileDashboard.open();
    this.maybeRunDashboardWelcome();
  }
}
