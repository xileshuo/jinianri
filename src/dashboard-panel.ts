import type { App } from "obsidian";
import { Notice, Platform, setIcon } from "obsidian";
import type JinianriPlugin from "./main";
import {
  moveEventToGroup,
  normalizeGroupSortOrders,
  reorderEvent,
} from "./drag-sort";
import {
  buildMonthGrid,
  filterItemsInMonth,
  formatMonthTitle,
  getWeekdayHeaders,
  indexEventsByNextDate,
  isSameDay,
  type DashboardViewMode,
} from "./dashboard-calendar";
import { applyDashboardFilter, buildFilterOptions } from "./dashboard-filter";
import {
  formatCountdownPrimary,
  formatCountdownShort,
  sortDashboardItems,
} from "./display-labels";
import {
  computeDashboardStats,
  formatNextDateLabel,
} from "./dashboard-stats";
import { eventCalendarLabel, formatPassedLabel, formatYmd } from "./date-utils";
import {
  getCalSubLabel,
  isHolidayDate,
  isWeekendDate,
  isWorkdayDate,
} from "./calendar-decor";
import { parseEventName } from "./name-utils";
import { attachPointerDrag } from "./pointer-drag";
import type { AnniversaryComputed, EventGroup } from "./types";
import { debounce } from "./utils/debounce";
import { injectActivationPanelStyles, renderActivationPanel } from "./activation-panel";
import { injectLifeOsSharedStyles, renderLifeOsEmptyState, showLifeOsFirstRunCard, getLifeOsVaultKey } from "./lifeos-ui-shared";
import { renderTrialBanner } from "./lifeos-trial";
import { getSidebarInteractionHint, getSidebarSettingsHintLines } from "./sidebar-hints";
import { isSampleOnlyData } from "./vault-data";

/** 侧边栏 / 移动端弹层：浏览 + 拖动排序 + 直接添加/编辑 */
export class DashboardPanel {
  private app: App;
  private plugin: JinianriPlugin;
  private rootEl: HTMLElement;
  private bodyEl: HTMLElement | null = null;
  private dragCleanup: (() => void) | null = null;
  private debouncedDragRefresh!: () => void;

  constructor(
    app: App,
    plugin: JinianriPlugin,
    rootEl: HTMLElement
  ) {
    this.app = app;
    this.plugin = plugin;
    this.rootEl = rootEl;
    this.debouncedDragRefresh = debounce(() => this.rebuildBody(), 400);
  }

  mount(): void {
    this.rootEl.empty();
    this.rootEl.addClass("jnr-sidebar");
    this.bodyEl = this.rootEl.createDiv({ cls: "jnr-sidebar-body" });

    if (!this.plugin.isLicensed()) {
      this.bodyEl.addClass("jnr-activate-mode");
      injectActivationPanelStyles();
      renderActivationPanel(this.bodyEl, this.plugin);
      return;
    }

    this.refresh();
  }

  refresh(): void {
    if (!this.bodyEl || !this.rootEl.querySelector(".jnr-sidebar-body")) {
      this.mount();
      return;
    }

    if (!this.plugin.isLicensed()) {
      this.bodyEl.addClass("jnr-activate-mode");
      injectActivationPanelStyles();
      this.bodyEl.empty();
      renderActivationPanel(this.bodyEl, this.plugin);
      return;
    }

    this.bodyEl.removeClass("jnr-activate-mode");
    this.rebuildBody();
  }

  private rebuildBody(): void {
    if (!this.bodyEl) return;
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.bodyEl.empty();
    injectLifeOsSharedStyles();
    const inset = this.bodyEl.createDiv({ cls: "lifeos-sidebar-inset jnr-sidebar-inset" });
    renderTrialBanner(inset, this.plugin);
    showLifeOsFirstRunCard(inset, this.plugin.app, getLifeOsVaultKey(this.plugin.app, "jnr-first-run"), {
      title: "欢迎使用纪念日",
      bullets: [
        "点「+」添加生日、恋爱纪念日等重要日期",
        "设置 → 提醒：到点库内弹窗 / 系统通知",
        "侧边栏支持列表、时间轴、月历三种视图",
      ],
      primaryLabel: "添加第一条",
      onPrimary: () => this.plugin.openAddEventModal(),
    });

    const viewMode = this.getViewMode();
    const baseItems = this.getBaseVisibleItems();
    const visibleItems = this.applyViewFilters(baseItems, viewMode);
    if (this.plugin.events.length === 0) {
      this.renderEmptyEvents(inset);
      return;
    }
    this.renderSampleBanner(inset);
    if (baseItems.length === 0) {
      if (this.plugin.events.length > 0) {
        this.renderDashboardHeader(inset, [], viewMode);
        this.renderFilterEmpty(inset);
        return;
      }
      this.renderEmptyVisible(inset);
      return;
    }

    const spotlightItems = viewMode === "calendar"
      ? []
      : this.pickSpotlightItems(visibleItems);
    const spotlightIds = new Set(spotlightItems.map((i) => i.event.id));
    const statsItems = viewMode === "calendar" ? baseItems : visibleItems;

    this.renderDashboardHeader(inset, statsItems, viewMode);
    if (spotlightItems.length > 0) {
      this.renderSpotlight(inset, spotlightItems);
    }

    const contentHost = inset.createDiv({ cls: "jnr-dashboard-content" });
    if (viewMode === "calendar") {
      this.renderCalendarView(contentHost, baseItems);
    } else if (viewMode === "timeline") {
      this.renderTimelineView(contentHost, visibleItems);
    } else {
      this.renderDisplayList(contentHost, spotlightIds);
      this.attachDragHandlers();
    }

    if (viewMode === "list") {
      this.maybeShowSidebarHintNotice();
    }
  }

  private pickSpotlightItems(items: AnniversaryComputed[]): AnniversaryComputed[] {
    const yearly = items.filter((i) => !i.isElapsed);
    const elapsed = items
      .filter((i) => i.isElapsed)
      .sort((a, b) => (b.daysTogether ?? 0) - (a.daysTogether ?? 0));
    const merged = [...yearly.slice(0, 2)];
    for (const item of elapsed) {
      if (merged.length >= 2) break;
      if (!merged.some((m) => m.event.id === item.event.id)) merged.push(item);
    }
    return merged.slice(0, 2);
  }

  private getViewMode(): DashboardViewMode {
    const mode = this.plugin.settings.dashboardViewMode;
    if (mode === "timeline" || mode === "calendar") return mode;
    return "list";
  }

  private getBaseVisibleItems(): AnniversaryComputed[] {
    const items = this.plugin.events
      .filter((e) => e.showInSidebar)
      .map((e) => this.plugin.getComputed(e));
    return sortDashboardItems(
      applyDashboardFilter(items, this.plugin.settings.dashboardFilter)
    );
  }

  private applyViewFilters(
    items: AnniversaryComputed[],
    viewMode: DashboardViewMode
  ): AnniversaryComputed[] {
    if (this.plugin.selectedCalendarDay) {
      return items.filter((i) => formatYmd(i.nextDate) === this.plugin.selectedCalendarDay);
    }
    if (viewMode === "calendar") {
      return filterItemsInMonth(
        items,
        this.plugin.calendarViewYear,
        this.plugin.calendarViewMonth
      );
    }
    return items;
  }

  private renderEmptyEvents(bodyEl: HTMLElement): void {
    const listEl = bodyEl.createDiv({ cls: "jnr-card-list" });
    renderLifeOsEmptyState(listEl, {
      icon: "📅",
      message: "还没有纪念事项。添加生日、恋爱纪念等重要日期，开启倒计时与提醒。",
      ctaLabel: "添加第一个纪念日",
      onCta: () => this.plugin.openAddEventModal(),
    });
  }

  /** 仅剩预填示例时明确提示这不是用户自己的数据，并给一键清除 */
  private renderSampleBanner(bodyEl: HTMLElement): void {
    if (!isSampleOnlyData(this.plugin.events)) return;
    const banner = bodyEl.createDiv({ cls: "jnr-sample-banner" });
    banner.createSpan({
      cls: "jnr-sample-banner-text",
      text: "以下是插件预填的示例，不是你的数据。",
    });
    banner
      .createEl("button", {
        text: "清除示例",
        cls: "jnr-sample-banner-btn",
        attr: { type: "button" },
      })
      .addEventListener("click", () => void this.plugin.clearSampleEvents());
  }

  private renderEmptyVisible(bodyEl: HTMLElement): void {
    const listEl = bodyEl.createDiv({ cls: "jnr-card-list" });
    renderLifeOsEmptyState(listEl, {
      icon: "👀",
      message: "所有事项都被取消了侧边栏展示。在设置页勾上「展示」，或直接添一条新的。",
      ctaLabel: "添加纪念日",
      onCta: () => this.plugin.openAddEventModal(),
    });
  }

  private renderFilterEmpty(bodyEl: HTMLElement): void {
    const listEl = bodyEl.createDiv({ cls: "jnr-card-list" });
    renderLifeOsEmptyState(listEl, {
      icon: "🔎",
      message: "当前筛选下没有纪念日。换个筛选条件，或添一条新的。",
      ctaLabel: "+ 添加",
      onCta: () => this.plugin.openAddEventModal(),
    });
  }

  private renderDashboardHeader(
    bodyEl: HTMLElement,
    items: AnniversaryComputed[],
    viewMode: DashboardViewMode
  ): void {
    const header = bodyEl.createDiv({ cls: "jnr-dashboard-header" });
    const filterRow = header.createDiv({ cls: "jnr-filter-row jnr-filter-toolbar-row" });
    const seg = filterRow.createDiv({
      cls: "jnr-seg-track",
      attr: { role: "tablist", "aria-label": "筛选与视图" },
    });

    const filterWrap = seg.createDiv({ cls: "jnr-filter-select-wrap jnr-filter-select-compact jnr-seg-item" });
    const filterSelect = filterWrap.createEl("select", {
      cls: "jnr-filter-select",
      attr: { "aria-label": "筛选纪念日" },
    });
    for (const opt of buildFilterOptions(
      this.plugin.getGroupOrder(),
      (id) => this.plugin.getGroupLabel(id)
    )) {
      const option = filterSelect.createEl("option", { text: opt.label, value: opt.value });
      if (opt.value === this.plugin.settings.dashboardFilter) {
        option.selected = true;
      }
    }
    filterSelect.addEventListener("change", () => {
      this.plugin.setDashboardFilter(filterSelect.value);
    });

    this.renderViewTab(seg, "list", "列表", viewMode === "list");
    this.renderViewTab(seg, "timeline", "时间轴", viewMode === "timeline");
    this.renderViewTab(seg, "calendar", "日历", viewMode === "calendar");
    const addBtn = seg.createEl("button", {
      text: "添加",
      cls: "jnr-view-tab jnr-header-add-btn jnr-seg-item",
      attr: { type: "button", "aria-label": "添加纪念事项", role: "tab" },
    });
    addBtn.addEventListener("click", () => this.plugin.openAddEventModal());

    if (this.plugin.selectedCalendarDay) {
      const chip = filterRow.createDiv({ cls: "jnr-day-filter-chip" });
      chip.createSpan({ text: `已选 ${this.plugin.selectedCalendarDay}` });
      chip.createEl("button", { text: "清除", cls: "jnr-day-filter-clear" })
        .addEventListener("click", () => this.plugin.clearCalendarDay());
    }

    const stats = computeDashboardStats(items);
    const statsRow = header.createDiv({ cls: "jnr-stats-row" });
    this.renderStatCell(statsRow, String(stats.total), "全部");
    this.renderStatCell(statsRow, String(stats.today), "今天");
    this.renderStatCell(statsRow, String(stats.thisWeek), "本周");
    this.renderStatCell(statsRow, String(stats.thisMonth), "本月");
  }

  private renderStatCell(row: HTMLElement, num: string, label: string): void {
    const cell = row.createDiv({ cls: "jnr-stat-cell" });
    cell.createDiv({ cls: "jnr-stat-num", text: num });
    cell.createDiv({ cls: "jnr-stat-label", text: label });
  }

  private renderViewTab(
    switcher: HTMLElement,
    mode: DashboardViewMode,
    label: string,
    active: boolean
  ): void {
    const btn = switcher.createEl("button", {
      text: label,
      cls: `jnr-view-tab jnr-seg-item${active ? " is-active" : ""}`,
      attr: { role: "tab", "aria-selected": active ? "true" : "false" },
    });
    btn.addEventListener("click", () => this.plugin.setDashboardViewMode(mode));
  }

  private renderCalendarView(host: HTMLElement, baseItems: AnniversaryComputed[]): void {
    const wrap = host.createDiv({ cls: "jnr-calendar-view" });
    const year = this.plugin.calendarViewYear;
    const month = this.plugin.calendarViewMonth;
    const monthItems = filterItemsInMonth(baseItems, year, month);
    const byDay = indexEventsByNextDate(monthItems);
    const today = new Date();

    const nav = wrap.createDiv({ cls: "jnr-calendar-nav" });
    const prevBtn = nav.createEl("button", {
      cls: "clickable-icon jnr-calendar-nav-btn",
      attr: { "aria-label": "上个月" },
    });
    setIcon(prevBtn, "chevron-left");
    prevBtn.addEventListener("click", () => this.plugin.shiftCalendarMonth(-1));
    nav.createDiv({ cls: "jnr-calendar-month-title", text: formatMonthTitle(year, month) });
    const nextBtn = nav.createEl("button", {
      cls: "clickable-icon jnr-calendar-nav-btn",
      attr: { "aria-label": "下个月" },
    });
    setIcon(nextBtn, "chevron-right");
    nextBtn.addEventListener("click", () => this.plugin.shiftCalendarMonth(1));

    const grid = wrap.createDiv({ cls: "jnr-calendar-grid" });
    const head = grid.createDiv({ cls: "jnr-calendar-weekhead" });
    getWeekdayHeaders().forEach((label, i) => {
      head.createDiv({
        cls: `jnr-calendar-weekday${i >= 5 ? " is-weekend" : ""}`,
        text: label,
      });
    });

    const byDayAll = indexEventsByNextDate(baseItems);
    const body = grid.createDiv({ cls: "jnr-calendar-days" });
    for (const cell of buildMonthGrid(year, month)) {
      const dayEl = body.createDiv({
        cls: `jnr-calendar-day${cell.inMonth ? "" : " is-outside"}`,
      });
      const ymd = formatYmd(cell.date);
      const dayItems = cell.inMonth
        ? byDay.get(ymd) ?? []
        : byDayAll.get(ymd) ?? [];
      const isToday = isSameDay(cell.date, today);
      const isSelected = cell.inMonth && this.plugin.selectedCalendarDay === ymd;
      const weekend = isWeekendDate(cell.date);
      const holiday = isHolidayDate(cell.date);
      const workday = isWorkdayDate(cell.date);

      dayEl.toggleClass("is-today", isToday);
      dayEl.toggleClass("is-selected", isSelected);
      dayEl.toggleClass("has-events", dayItems.length > 0);
      dayEl.toggleClass("is-weekend", weekend);
      dayEl.toggleClass("is-holiday", holiday);
      dayEl.toggleClass("is-workday", workday);
      dayEl.createDiv({
        cls: "jnr-calendar-day-num",
        text: String(cell.date.getDate()),
      });
      const sub = getCalSubLabel(cell.date);
      if (sub) {
        dayEl.createDiv({
          cls: `jnr-calendar-day-sub${holiday || workday ? " is-mark" : ""}${workday ? " is-work" : ""}`,
          text: sub,
        });
      }
      if (dayItems.length > 0) {
        const dots = dayEl.createDiv({ cls: "jnr-calendar-dots" });
        const show = dayItems.slice(0, 3);
        for (let i = 0; i < show.length; i++) {
          dots.createDiv({ cls: "jnr-calendar-dot" });
        }
        if (dayItems.length > 3) {
          dots.createSpan({ cls: "jnr-calendar-dot-more", text: "+" });
        }
      }

      if (!cell.inMonth) continue;
      dayEl.setAttr("role", "button");
      dayEl.setAttr("tabindex", "0");
      dayEl.addEventListener("click", () => this.plugin.toggleCalendarDay(ymd));
      dayEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.plugin.toggleCalendarDay(ymd);
        }
      });
    }

    const listHost = wrap.createDiv({ cls: "jnr-calendar-day-list" });
    const selectedDay = this.plugin.selectedCalendarDay;
    const listHead = listHost.createDiv({ cls: "jnr-calendar-list-head" });
    listHead.createDiv({
      cls: "jnr-calendar-list-title",
      text: selectedDay
        ? `${selectedDay} 的纪念日`
        : `${formatMonthTitle(year, month)} 内的纪念日`,
    });
    if (selectedDay) {
      listHead
        .createEl("button", {
          text: "在这天添加",
          cls: "jnr-text-btn jnr-calendar-add-btn",
          attr: { type: "button" },
        })
        .addEventListener("click", () =>
          this.plugin.openAddEventModal({ defaultDate: selectedDay })
        );
    }

    const listItems = this.applyViewFilters(baseItems, "calendar");
    if (listItems.length === 0) {
      const emptyHost = listHost.createDiv({ cls: "jnr-calendar-list-empty" });
      renderLifeOsEmptyState(emptyHost, {
        icon: "📅",
        message: selectedDay
          ? "这一天还没有纪念日，可以直接添一条。"
          : "本月没有纪念日，换个月看看或先添一条。",
        ctaLabel: selectedDay ? "在这天添加" : "+ 添加",
        onCta: () =>
          this.plugin.openAddEventModal(
            selectedDay ? { defaultDate: selectedDay } : undefined
          ),
      });
      return;
    }

    const soonDays = this.plugin.getSoonDaysThreshold();
    for (const item of listItems) {
      this.renderCard(listHost, item, soonDays, false);
    }
  }

  private renderSpotlight(bodyEl: HTMLElement, items: AnniversaryComputed[]): void {
    if (items.length === 0) return;
    const section = bodyEl.createDiv({ cls: "jnr-spotlight-section" });
    const row = section.createDiv({ cls: "jnr-spotlight-row" });
    for (const item of items) {
      this.renderSpotlightCard(row, item);
    }
  }

  private renderSpotlightCard(parent: HTMLElement, item: AnniversaryComputed): void {
    const { icon, label } = parseEventName(item.event.name);
    const card = parent.createDiv({
      cls: `jnr-spotlight-card${item.isToday ? " is-today" : ""}`,
      attr: { role: "button", tabindex: "0" },
    });
    card.createDiv({ cls: "jnr-spotlight-icon", text: icon });
    card.createDiv({ cls: "jnr-spotlight-name", text: label });
    card.createDiv({
      cls: "jnr-spotlight-countdown",
      text: formatCountdownShort(item).replace("🎉 ", ""),
    });
    card.createDiv({
      cls: "jnr-spotlight-date",
      text: item.isElapsed
        ? `起 ${formatYmd(item.originDate)}`
        : formatNextDateLabel(item.nextDate),
    });
    const open = () => this.plugin.openEditEventModal(item.event.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  private renderTimelineView(listEl: HTMLElement, items: AnniversaryComputed[]): void {
    const track = listEl.createDiv({ cls: "jnr-timeline" });
    for (const item of items) {
      const row = track.createDiv({
        cls: `jnr-timeline-item${item.isToday ? " is-today" : ""}`,
        attr: { role: "button", tabindex: "0" },
      });
      const axis = row.createDiv({ cls: "jnr-timeline-axis" });
      axis.createDiv({ cls: "jnr-timeline-dot" });
      axis.createDiv({ cls: "jnr-timeline-line" });

      const body = row.createDiv({ cls: "jnr-timeline-body" });
      const top = body.createDiv({ cls: "jnr-timeline-top" });
      const { icon, label } = parseEventName(item.event.name);
      top.createSpan({ cls: "jnr-timeline-icon", text: icon });
      top.createSpan({ cls: "jnr-timeline-name", text: label });
      body.createDiv({
        cls: "jnr-timeline-countdown",
        text: formatCountdownPrimary(item),
      });
      body.createDiv({
        cls: "jnr-timeline-date",
        text: `${formatYmd(item.nextDate)} · ${formatNextDateLabel(item.nextDate)}`,
      });
      body.createDiv({
        cls: "jnr-timeline-meta",
        text: `${eventCalendarLabel(item.event)} · ${this.plugin.getGroupLabel(item.event.group)}`,
      });
      if (item.event.notes?.trim()) {
        body.createDiv({
          cls: "jnr-timeline-notes",
          text: item.event.notes.trim(),
        });
      }

      const open = () => this.plugin.openEditEventModal(item.event.id);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    }
  }

  private attachDragHandlers(): void {
    if (!this.bodyEl) return;
    this.dragCleanup = attachPointerDrag(this.bodyEl, {
      onEventReorder: (draggedId, targetId, before) => {
        reorderEvent(this.plugin.events, draggedId, targetId, before);
        this.plugin.scheduleSaveEventsQuiet();
        const el = this.bodyEl?.querySelector<HTMLElement>(`[data-event-id="${draggedId}"]`);
        const container = el?.parentElement;
        if (container instanceof HTMLElement && container.matches("[data-group-body]")) {
          this.sortEventNodesInContainer(container);
        } else {
          this.debouncedDragRefresh();
        }
      },
      onEventToGroup: (eventId, group) => {
        moveEventToGroup(this.plugin.events, eventId, group);
        normalizeGroupSortOrders(this.plugin.events, group);
        this.plugin.scheduleSaveEventsQuiet();
        const el = this.bodyEl?.querySelector<HTMLElement>(`[data-event-id="${eventId}"]`);
        const targetBody = this.bodyEl?.querySelector<HTMLElement>(`[data-group-body="${group}"]`);
        if (el && targetBody) {
          targetBody.appendChild(el);
          this.sortEventNodesInContainer(targetBody);
        } else {
          this.debouncedDragRefresh();
        }
      },
      onGroupReorder: (dragged, target, before) => {
        this.plugin.reorderGroups(dragged, target, before);
        this.syncGroupDomOrder();
      },
    });
  }

  private sortEventNodesInContainer(container: HTMLElement): void {
    const groupId = container.dataset.groupBody;
    if (!groupId) return;
    const events = this.plugin.events
      .filter((e) => e.group === groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const event of events) {
      const node = container.querySelector(`[data-event-id="${event.id}"]`);
      if (node) container.appendChild(node);
    }
  }

  private syncGroupDomOrder(): void {
    if (!this.bodyEl) return;
    const list = this.bodyEl.querySelector(".jnr-card-list");
    if (!list) return;
    for (const gid of this.plugin.getGroupOrder()) {
      const section = list.querySelector(`[data-group-section="${gid}"]`);
      if (section) list.appendChild(section);
    }
    const footer = list.querySelector(".jnr-sidebar-footer");
    if (footer) list.appendChild(footer);
  }

  private updateGroupChevron(header: HTMLElement, collapsed: boolean): void {
    const chevron = header.querySelector<HTMLElement>(".jnr-group-chevron");
    if (chevron) setIcon(chevron, collapsed ? "chevron-right" : "chevron-down");
  }

  private toggleGroupSection(
    group: EventGroup,
    section: HTMLElement,
    header: HTMLElement
  ): void {
    this.plugin.toggleGroupCollapsed(group);
    const nowCollapsed = this.plugin.isGroupCollapsed(group);
    section.toggleClass("is-collapsed", nowCollapsed);
    header.setAttr("aria-expanded", nowCollapsed ? "false" : "true");
    this.updateGroupChevron(header, nowCollapsed);
  }

  destroy(): void {
    this.debouncedDragRefresh?.cancel();
    this.dragCleanup?.();
    this.dragCleanup = null;
  }

  private getGroupedVisible(excludeIds: Set<string>): Map<EventGroup, AnniversaryComputed[]> {
    const map = new Map<EventGroup, AnniversaryComputed[]>();
    for (const group of this.plugin.getGroupOrder()) map.set(group, []);

    for (const item of this.getBaseVisibleItems()) {
      if (excludeIds.has(item.event.id)) continue;
      const list = map.get(item.event.group) ?? [];
      list.push(item);
      map.set(item.event.group, list);
    }

    for (const [group, list] of map) {
      list.sort((a, b) => a.event.sortOrder - b.event.sortOrder || a.daysUntil - b.daysUntil);
      map.set(group, list);
    }
    return map;
  }

  private renderDisplayList(bodyEl: HTMLElement, excludeIds: Set<string>): void {
    const listEl = bodyEl.createDiv({ cls: "jnr-card-list" });
    const grouped = this.getGroupedVisible(excludeIds);
    const soonDays = this.plugin.getSoonDaysThreshold();

    const soonIds = new Set<string>();
    const soon = [...grouped.values()]
      .flat()
      .filter((i) => i.daysUntil <= soonDays)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    soon.forEach((i) => soonIds.add(i.event.id));

    if (soon.length > 0) {
      const section = listEl.createDiv({ cls: "jnr-group-section jnr-group-soon" });
      section.createDiv({
        cls: "jnr-group-header jnr-group-header-glass jnr-group-header-soon",
        text: `⏰ ${soonDays} 天内`,
      });
      for (const item of soon) this.renderCard(section, item, soonDays, false);
    }

    for (const group of this.plugin.getGroupOrder()) {
      const items = grouped.get(group) ?? [];
      const displayItems = items.filter((i) => !soonIds.has(i.event.id));
      if (items.length === 0 || displayItems.length === 0) continue;

      const collapsed = this.plugin.isGroupCollapsed(group);
      const groupLabel = this.plugin.getGroupLabel(group);
      const section = listEl.createDiv({
        cls: `jnr-group-section ${collapsed ? "is-collapsed" : ""}`,
        attr: { "data-group-section": group },
      });

      const header = section.createDiv({
        cls: "jnr-group-header jnr-group-header-glass jnr-group-toggle jnr-draggable",
        attr: {
          "data-drag-kind": "group",
          "data-group": group,
          "aria-expanded": collapsed ? "false" : "true",
        },
      });
      const chevron = header.createSpan({ cls: "jnr-group-chevron" });
      setIcon(chevron, collapsed ? "chevron-right" : "chevron-down");
      const title = header.createSpan({
        text: groupLabel,
        cls: "jnr-group-title jnr-group-title-btn",
        attr: {
          role: "button",
          tabindex: "0",
          "aria-label": `${groupLabel}，${collapsed ? "展开" : "折叠"}分组`,
        },
      });
      title.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        this.toggleGroupSection(group, section, header);
      });
      header.addEventListener("jnr-group-click", () => {
        this.toggleGroupSection(group, section, header);
      });
      const countLabel =
        displayItems.length < items.length
          ? `${displayItems.length}/${items.length}`
          : String(items.length);
      header.createSpan({ text: countLabel, cls: "jnr-group-count" });

      const groupBody = section.createDiv({
        cls: "jnr-group-body",
        attr: { "data-group-body": group },
      });
      for (const item of displayItems) {
        this.renderCard(groupBody, item, soonDays);
      }
    }

    this.renderFooter(listEl);
  }

  private maybeShowSidebarHintNotice(): void {
    if (this.plugin.settings.sidebarHintSeen) return;
    this.plugin.settings.sidebarHintSeen = true;
    void this.plugin.persistSettings();
    new Notice(getSidebarInteractionHint(Platform.isMobile), 8000);
  }

  private renderFooter(listEl: HTMLElement): void {
    const foot = listEl.createDiv({ cls: "jnr-sidebar-footer" });
    foot.createDiv({ text: getSidebarInteractionHint(Platform.isMobile) });
    getSidebarSettingsHintLines().forEach((line) => {
      foot.createDiv({ cls: "jnr-sidebar-footer-sub", text: line });
    });
  }

  private renderCard(
    parent: HTMLElement,
    item: AnniversaryComputed,
    soonDays: number,
    draggable = true
  ): void {
    const card = parent.createDiv({
      cls: draggable ? "jnr-card jnr-draggable" : "jnr-card jnr-card-static",
      attr: draggable
        ? {
            "data-drag-kind": "event",
            "data-event-id": item.event.id,
          }
        : { "data-event-id": item.event.id },
    });
    if (item.daysUntil <= soonDays) card.addClass("jnr-card-soon");
    if (item.isToday) card.addClass("jnr-card-today");

    const top = card.createDiv({ cls: "jnr-card-top" });
    const { icon, label } = parseEventName(item.event.name);
    const nameWrap = top.createDiv({ cls: "jnr-card-name-wrap" });
    nameWrap.createSpan({ text: icon, cls: "jnr-card-icon" });
    nameWrap.createSpan({ text: label, cls: "jnr-card-name" });

    card.createDiv({
      cls: "jnr-card-countdown",
      text: formatCountdownPrimary(item),
    });
    card.createDiv({
      cls: "jnr-card-next",
      text: item.isElapsed
        ? `起始 ${formatYmd(item.originDate)}`
        : `下次 ${formatYmd(item.nextDate)}`,
    });
    card.createDiv({
      cls: "jnr-card-meta",
      text: item.isElapsed
        ? `累计天数 · ${formatPassedLabel(item)}`
        : `${eventCalendarLabel(item.event)} · ${formatPassedLabel(item)}`,
    });
    if (item.event.notes?.trim()) {
      card.createDiv({
        cls: "jnr-card-notes",
        text: item.event.notes.trim(),
      });
    }

    card.addEventListener(draggable ? "jnr-card-click" : "click", () => {
      this.plugin.openEditEventModal(item.event.id);
    });
  }
}
