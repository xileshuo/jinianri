import { App, Notice, Platform, PluginSettingTab, Setting, setIcon } from "obsidian";
import type JinianriPlugin from "./main";
import { attachDateWheelButton } from "./date-wheel-picker";
import { EventModal } from "./event-modal";
import { isSampleOnlyData } from "./vault-data";
import { getPluginSettingsPath } from "./plugin-paths";
import { showConfirm } from "./confirm-modal";
import { getEditionLabel } from "./edition-label";
import { openUsageGuideInNewTab } from "./usage-guide";
import {
  copyTextToClipboard,
  getDeviceFingerprint,
  isLicenseEnforced,
  syncLicenseState,
} from "./license";
import { combineEventName, parseEventName } from "./name-utils";
import { applyMobileSettingsLayout, isMobileSettingsContext } from "./settings-mobile-layout";
import { renderLifeOsAboutPanel, renderLifeOsLicenseSettingsPanel } from "./lifeos-suite";
import { formatPluginSettingsTitle } from "./lifeos-ui-shared";
import { setLeapDayFallback } from "./date-utils";
import type { AnniversaryEvent, CalendarType, EventGroup, RecurrenceType } from "./types";

export type SettingsTabId = "license" | "reminder" | "events" | "general" | "data" | "about";

export class JinianriSettingTab extends PluginSettingTab {
  plugin: JinianriPlugin;

  constructor(app: App, plugin: JinianriPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** 弹窗内改完数据后，若设置页仍开着则同步刷新表格 */
  refreshIfOpen(): void {
    if (!this.containerEl?.isConnected) return;
    this.display();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("jnr-settings-compact");
    const isMobile = isMobileSettingsContext(this.app);
    if (isMobile) {
      containerEl.addClass("jnr-settings-mobile");
      applyMobileSettingsLayout(containerEl, true);
    }

    if (!isMobile) {
      containerEl.createEl("h2", {
        text: formatPluginSettingsTitle("纪念日 配置", getEditionLabel()),
      });
    }

    const locked = isLicenseEnforced() && !this.plugin.isLicensed();
    const tabDefs: { id: SettingsTabId; label: string }[] = [];
    if (isLicenseEnforced()) tabDefs.push({ id: "license", label: "授权" });
    if (!locked) {
      tabDefs.push(
        { id: "reminder", label: "提醒" },
        { id: "events", label: "事项" },
        { id: "general", label: "通用" }
      );
    }
    tabDefs.push({ id: "data", label: "数据" });
    tabDefs.push({ id: "about", label: "关于" });

    const tabBar = containerEl.createDiv({ cls: "jnr-settings-tab-bar" });
    if (tabDefs.length >= 5) tabBar.addClass("is-many-tabs");
    tabBar.setAttr("role", "tablist");
    tabBar.setAttr("aria-label", "纪念日设置");
    const panelsWrap = containerEl.createDiv({ cls: "jnr-settings-panels" });
    const panels = {} as Record<SettingsTabId, HTMLElement>;
    tabDefs.forEach((t) => {
      panels[t.id] = panelsWrap.createDiv({
        cls: "jnr-settings-panel",
        attr: {
          role: "tabpanel",
          id: `jnr-panel-${t.id}`,
          "aria-labelledby": `jnr-tab-${t.id}`,
        },
      });
      panels[t.id].style.display = "none";
    });

    const showTab = (id: SettingsTabId) => {
      tabDefs.forEach((t) => {
        panels[t.id].style.display = t.id === id ? "block" : "none";
      });
      tabBar.querySelectorAll("button").forEach((btn) => {
        const el = btn as HTMLElement;
        const active = el.dataset.tab === id;
        el.toggleClass("mod-cta", active);
        el.setAttr("aria-selected", active ? "true" : "false");
      });
    };

    tabDefs.forEach((t) => {
      const btn = tabBar.createEl("button", { text: t.label });
      btn.dataset.tab = t.id;
      btn.setAttr("role", "tab");
      btn.setAttr("id", `jnr-tab-${t.id}`);
      btn.setAttr("aria-controls", `jnr-panel-${t.id}`);
      btn.setAttr("aria-selected", "false");
      btn.addEventListener("click", () => showTab(t.id));
    });

    const pendingTab = this.plugin.pendingSettingsTab;
    this.plugin.pendingSettingsTab = null;
    if (pendingTab && tabDefs.some((t) => t.id === pendingTab)) {
      showTab(pendingTab);
    } else {
      showTab(tabDefs[0].id);
    }

    if (isLicenseEnforced()) this.renderLicensePanel(panels.license);
    if (!locked) {
      this.renderReminderPanel(panels.reminder);
      this.renderEventsPanel(panels.events);
      this.renderGeneralPanel(panels.general);
    }
    this.renderDataPanel(panels.data);

    renderLifeOsAboutPanel(panels.about, this.plugin, {
      openUsageGuide: () => openUsageGuideInNewTab(this.app),
    });

    this.scrollToHighlightedEvent();

    if (this.plugin.pendingAddEventOnSettings) {
      this.plugin.pendingAddEventOnSettings = false;
      requestAnimationFrame(() => this.openEventModal(null));
    }
  }

  private createBlock(parent: HTMLElement, title: string, desc?: string): HTMLElement {
    const block = parent.createDiv({ cls: "jnr-settings-block" });
    block.createEl("h3", { text: title });
    if (desc) {
      block.createEl("p", { cls: "setting-item-description", text: desc });
    }
    return block;
  }

  private addSubgroupTitle(block: HTMLElement, title: string): void {
    block.createEl("h4", { text: title });
  }

  private scrollToHighlightedEvent(): void {
    const eventId = this.plugin.highlightEventId;
    if (!eventId) return;
    this.plugin.highlightEventId = null;
    requestAnimationFrame(() => {
      const row = this.containerEl.querySelector<HTMLElement>(
        `#jnr-panel-events [data-event-id="${eventId}"]`
      );
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.addClass("jnr-settings-highlight");
      window.setTimeout(() => row.removeClass("jnr-settings-highlight"), 2200);
    });
  }

  private renderLicensePanel(panel: HTMLElement): void {
    renderLifeOsLicenseSettingsPanel(panel, {
      desc: isLicenseEnforced() ? "本安装包需激活后使用全部功能。" : undefined,
      getFingerprint: () => getDeviceFingerprint(this.app),
      licenseKey: this.plugin.settings.licenseKey,
      activated: this.plugin.settings.licenseActivated,
      onCopyFingerprint: async (fp) => {
        const ok = await copyTextToClipboard(fp);
        new Notice(ok ? "设备指纹已复制" : "请手动全选复制指纹");
      },
      onActivate: async (key) => {
        const wasActivated = this.plugin.settings.licenseActivated;
        if (!key) {
          new Notice("请输入激活码");
          return;
        }
        this.plugin.settings.licenseKey = key;
        syncLicenseState(this.app, this.plugin.settings);
        if (this.plugin.settings.licenseActivated) {
          new Notice("激活成功，之后将永久有效");
        } else {
          new Notice("激活码无效，请核对后再试");
          await this.plugin.saveSettings();
          this.display();
          return;
        }
        await this.plugin.saveSettings();
        if (!wasActivated) this.plugin.onLicenseActivated();
        else this.plugin.refreshViews();
        this.display();
      },
    });
  }

  private renderReminderPanel(panel: HTMLElement): void {
    const grid = panel.createDiv({ cls: "jnr-settings-grid" });
    const card = this.createBlock(
      grid,
      "提醒",
      "每天在设定时间检查一次；若当时未打开 Obsidian，之后首次打开仍会补发。侧边栏「即将到期」区与已启用的最大提醒档位联动（至少 7 天）。"
    );

    this.addSubgroupTitle(card, "提醒档位");
    this.plugin.settings.reminderTiers.forEach((tier, index) => {
      const labels = ["A", "B", "C"];
      new Setting(card)
        .setName(`档位 ${labels[index] ?? index + 1}`)
        .addText((text) => {
          text.inputEl.addClass("jnr-reminder-days");
          text.setValue(String(tier.days));
          text.inputEl.type = "number";
          text.inputEl.min = "0";
          text.inputEl.max = "365";
          text.onChange(async (value) => {
            const days = parseInt(value, 10);
            if (!isNaN(days) && days >= 0) {
              tier.days = days;
              tier.label = `提前 ${days} 天`;
              await this.plugin.persistSettings();
              this.plugin.refreshViews();
            }
          });
        })
        .addToggle((toggle) =>
          toggle.setValue(tier.enabled).onChange(async (value) => {
            tier.enabled = value;
            await this.plugin.persistSettings();
            this.plugin.refreshViews();
          })
        );
    });

    this.addSubgroupTitle(card, "通知渠道");
    new Setting(card)
      .setName("库内弹窗")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableObsidianNotice)
          .onChange(async (value) => {
            this.plugin.settings.enableObsidianNotice = value;
            await this.plugin.persistSettings();
          })
      );

    if (Platform.isMobile) {
      card.createEl("p", {
        cls: "jnr-settings-section-hint",
        text: "移动端不支持系统通知，提醒统一走库内弹窗。",
      });
    } else {
      new Setting(card)
        .setName("系统通知")
        .setDesc("仅桌面端有效")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.enableDesktopNotification)
            .onChange(async (value) => {
              this.plugin.settings.enableDesktopNotification = value;
              await this.plugin.persistSettings();
            })
        );
      if (Platform.isMacOS) {
        card.createEl("p", {
          cls: "jnr-settings-section-hint",
          text: "系统通知显示在 macOS 桌面右上角，需 Obsidian 有通知权限。",
        });
      }
    }

    new Setting(card)
      .setName("累计项也提醒周年")
      .setDesc("「在一起」这类累计天数事项默认不发周年提醒")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.remindElapsedAnniversary)
          .onChange(async (value) => {
            this.plugin.settings.remindElapsedAnniversary = value;
            await this.plugin.persistSettings();
          })
      );

    this.addSubgroupTitle(card, "检查时间");
    new Setting(card)
      .setName("每日时间")
      .addText((text) => {
        text.inputEl.type = "time";
        text.inputEl.step = "60";
        text.inputEl.addClass("jnr-time-input");
        text.setValue(this.plugin.getReminderTimeString());
        let saved = this.plugin.getReminderTimeString();
        const apply = async (value: string) => {
          if (!value) return;
          if (!this.plugin.setReminderTime(value)) {
            new Notice(
              `时间没记住，仍是 ${this.plugin.getReminderTimeString()}。请再选一次。`
            );
            text.setValue(this.plugin.getReminderTimeString());
            return;
          }
          const t = this.plugin.getReminderTimeString();
          if (t === saved) return;
          saved = t;
          this.plugin.reminderService?.resetTodayCheck();
          await this.plugin.saveSettings();
          this.plugin.reminderService?.checkReminders();
          new Notice(
            `提醒时间已改为 ${t}。当天的纪念日到点会弹窗，不占用 30 / 15 / 7 档。`
          );
        };
        text.onChange((value) => void apply(value));
        text.inputEl.addEventListener("change", () =>
          void apply(text.inputEl.value)
        );
      });

    card.createEl("p", {
      cls: "jnr-settings-section-hint",
      text: "到点后检查未提醒过的事项。当天本身会单独弹一次，和提前 30 / 15 / 7 天是两回事。改时间后立刻按新时间生效。",
    });

    new Setting(card)
      .setName("测试提醒")
      .setDesc("只测弹窗渠道，不走每日时间和档位")
      .addButton((btn) =>
        btn.setButtonText("发送测试").onClick(() => this.plugin.sendTestReminder())
      );

    new Setting(card)
      .setName("再弹今天")
      .setDesc("今天已经记为提醒过、但没看到弹窗时用（弹窗常被设置页挡住）")
      .addButton((btn) =>
        btn.setButtonText("再弹一次").onClick(() => {
          this.plugin.reminderService?.replayTodayReminders();
        })
      );
  }

  private renderOnboarding(parent: HTMLElement): void {
    const box = parent.createDiv({ cls: "jnr-onboarding" });
    box.createEl("h4", { text: "开始使用" });
    const events = this.plugin.events;

    if (events.length === 0) {
      box.createEl("p", { text: "还没有纪念事项，你可以：" });
    } else if (isSampleOnlyData(events)) {
      box.createEl("p", {
        text: "当前为示例数据，可编辑、删除后添加自己的纪念日，或从 Markdown 导入。",
      });
    }

    const actions = box.createDiv({ cls: "jnr-onboarding-actions" });
    actions
      .createEl("button", { text: "+ 添加第一项", cls: "mod-cta" })
      .addEventListener("click", () => this.openEventModal(null));
    actions
      .createEl("button", { text: "从 纪念日.md 导入", cls: "jnr-text-btn" })
      .addEventListener("click", () => void this.confirmImportFromMarkdown());
  }

  private renderEventsPanel(panel: HTMLElement): void {
    const grid = panel.createDiv({ cls: "jnr-settings-grid" });
    const card = this.createBlock(
      grid,
      "纪念事项",
      "表格内可快速改 emoji + 名称 / 日期 / 开关；点 ✏️ 打开完整编辑（备注、分组等）。侧边栏 **列表视图** 用于浏览、折叠分组与拖动排序；月历 / 时间轴为只读浏览。"
    );

    const actions = card.createDiv({ cls: "jnr-settings-actions-row" });
    actions
      .createEl("button", { text: "+ 添加事项", cls: "mod-cta" })
      .addEventListener("click", () => this.openEventModal(null));
    actions
      .createEl("button", { text: "从 纪念日.md 导入", cls: "jnr-text-btn" })
      .addEventListener("click", () => void this.confirmImportFromMarkdown());
    actions
      .createEl("button", { text: "导出 iCal", cls: "jnr-text-btn" })
      .addEventListener("click", () => void this.plugin.exportIcal());

    if (this.plugin.events.length === 0 || isSampleOnlyData(this.plugin.events)) {
      this.renderOnboarding(card);
    }

    for (const groupId of this.plugin.getGroupOrder()) {
      const def = this.plugin.settings.groups.find((g) => g.id === groupId);
      if (!def) continue;

      const block = grid.createDiv({
        cls: "jnr-settings-block jnr-settings-group-block",
        attr: { "data-group": groupId },
      });
      block.createEl("h4", { text: def.label });

      const groupHead = block.createDiv({ cls: "jnr-settings-group-head" });
      const nameInput = groupHead.createEl("input", {
        cls: "jnr-settings-group-name",
        attr: { placeholder: "分组名称" },
      });
      nameInput.value = def.label;
      nameInput.addEventListener("change", () => {
        this.plugin.renameGroup(groupId, nameInput.value);
      });

      groupHead
        .createEl("button", { text: "+ 事项", cls: "jnr-text-btn jnr-no-drag" })
        .addEventListener("click", () => {
          this.openEventModal(null, groupId);
        });

      groupHead
        .createEl("button", { text: "删除分组", cls: "jnr-text-btn mod-warning" })
        .addEventListener("click", () => {
          if (this.plugin.settings.groups.length <= 1) {
            new Notice("至少保留一个分组");
            return;
          }
          const count = this.plugin.events.filter((e) => e.group === groupId).length;
          const msg =
            count > 0
              ? `删除「${def.label}」？其中 ${count} 项将移入其他分组。`
              : `删除空分组「${def.label}」？`;
          void showConfirm(this.app, {
            title: "删除分组",
            message: msg,
            confirmText: "删除",
            warning: true,
          }).then((ok) => {
            if (ok && this.plugin.removeGroup(groupId)) this.display();
          });
        });

      const events = this.plugin.events
        .filter((e) => e.group === groupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (events.length === 0) {
        block.createDiv({ cls: "jnr-settings-group-empty", text: "暂无事项，点击 + 事项 添加" });
        continue;
      }

      const scrollWrap = block.createDiv({ cls: "jnr-settings-table-scroll" });
      const list = scrollWrap.createDiv({ cls: "jnr-settings-events-list" });
      this.renderTableHeader(list);
      events.forEach((event, index) => this.renderEventRow(list, event, index + 1));
    }
  }

  private renderGeneralPanel(panel: HTMLElement): void {
    const grid = panel.createDiv({ cls: "jnr-settings-grid" });
    const card = this.createBlock(grid, "通用", "状态栏、笔记嵌入与看板显示选项。");

    if (Platform.isMobile) {
      card.createEl("p", {
        cls: "jnr-settings-section-hint",
        text: "移动端无状态栏倒计时，可用 Ribbon 日历图标或命令「打开纪念日面板（全屏）」进入看板。",
      });
    }

    card.createEl("p", {
      cls: "jnr-settings-section-hint",
      text: "看板支持列表 / 时间轴 / 月历三种视图。折叠分组、拖动排序与底部交互提示仅在 **列表** 视图；顶部筛选下拉适用于全部视图。",
    });

    new Setting(card)
      .setName("状态栏")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showStatusBar)
          .onChange(async (value) => {
            this.plugin.settings.showStatusBar = value;
            await this.plugin.persistSettings();
            this.plugin.statusBar.update();
          })
      );

    this.addSubgroupTitle(card, "日期规则");
    new Setting(card)
      .setName("2 月 29 日")
      .setDesc("阳历 2/29 的纪念日在非闰年落在哪天")
      .addDropdown((dd) => {
        dd.addOption("feb28", "落到 2 月 28 日（推荐）");
        dd.addOption("mar1", "落到 3 月 1 日");
        dd.setValue(
          this.plugin.settings.leapDayFallback === "mar1" ? "mar1" : "feb28"
        );
        dd.onChange(async (value) => {
          this.plugin.settings.leapDayFallback =
            value === "mar1" ? "mar1" : "feb28";
          setLeapDayFallback(this.plugin.settings.leapDayFallback);
          await this.plugin.persistSettings();
          this.plugin.refreshAll();
        });
      });

    card.createEl("p", {
      cls: "jnr-settings-section-hint",
      text: "中文习惯多按 2 月 28 日过；选 3 月 1 日则顺延到下一天。",
    });

    this.addSubgroupTitle(card, "笔记嵌入");
    new Setting(card)
      .setName("嵌入代码")
      .addButton((btn) =>
        btn.setButtonText("复制").onClick(async () => {
          const ok = await copyTextToClipboard("```jinianri\n```");
          new Notice(ok ? "✅ 已复制嵌入代码" : "复制失败，请手动输入 ```jinianri```");
        })
      );

    card.createEl("p", {
      cls: "jnr-settings-section-hint",
      text: "在笔记中插入 ```jinianri``` 代码块，渲染纪念看板表格（随笔记刷新更新）。",
    });
  }

  private renderDataPanel(panel: HTMLElement): void {
    const grid = panel.createDiv({ cls: "jnr-settings-grid" });
    const card = this.createBlock(grid, "数据", "插件数据文件路径。");

    this.addSubgroupTitle(card, "数据文件");

    const settingsPath = getPluginSettingsPath(this.plugin.app);
    const eventsPath = this.plugin.dataStore.getEventsPath();

    new Setting(card)
      .setName("data.json")
      .setClass("jnr-settings-action-row")
      .addButton((btn) =>
        btn.setButtonText("打开").onClick(() => void this.openSettingsFile())
      );

    card.createEl("p", {
      cls: "jnr-settings-section-hint",
      text: `提醒档位、分组名称等插件设置。\n${settingsPath}`,
    });

    new Setting(card)
      .setName("events.json")
      .setClass("jnr-settings-action-row")
      .addButton((btn) =>
        btn.setButtonText("打开").onClick(() => void this.plugin.dataStore.openEventsFile())
      );

    card.createEl("p", {
      cls: "jnr-settings-section-hint",
      text: `全部纪念事项数据，随库 / iCloud 同步。\n${eventsPath}`,
    });
  }

  private async confirmImportFromMarkdown(): Promise<void> {
    const events = await this.plugin.dataStore.importFromMarkdown(false);
    if (events.length === 0) return;

    const current = this.plugin.events.length;
    const message =
      current === 0
        ? `将从 纪念日.md 导入 ${events.length} 条纪念事项，是否继续？`
        : `从 纪念日.md 导入将替换当前 ${current} 条，共 ${events.length} 条。\n\n此操作不可撤销，是否继续？`;
    const ok = await showConfirm(this.app, {
      title: "从 Markdown 导入",
      message,
      confirmText: "导入",
      warning: true,
    });
    if (!ok) return;

    await this.plugin.dataStore.reimportFromMarkdown({ confirm: false });
    this.display();
  }

  private async openSettingsFile(): Promise<void> {
    const path = getPluginSettingsPath(this.plugin.app);
    await this.plugin.rewriteSettingsOnly();
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file) {
      await this.plugin.app.workspace.getLeaf().openFile(file);
      return;
    }
    new Notice(`设置文件：${path}`);
  }

  private renderTableHeader(list: HTMLElement): void {
    const colHeader = list.createDiv({ cls: "jnr-settings-colhead" });
    [
      ["jnr-col-index", "#"],
      ["jnr-col-icon", "图标"],
      ["jnr-col-name", "名称"],
      ["jnr-col-date", "日期"],
      ["jnr-col-type", "类型"],
      ["jnr-col-show", "展示"],
      ["jnr-col-remind", "提醒"],
      ["jnr-col-action", ""],
    ].forEach(([cls, text]) => {
      const span = colHeader.createSpan({ cls: `jnr-col ${cls}`, text });
      if (cls === "jnr-col-type") span.setAttr("title", "每年纪念 / 累计天数");
    });
  }

  private renderEventRow(list: HTMLElement, event: AnniversaryEvent, index: number): void {
    const row = list.createDiv({
      cls: "jnr-settings-event-row",
      attr: { "data-event-id": event.id },
    });

    row.createSpan({ cls: "jnr-col jnr-col-index", text: String(index) });

    const parsed = parseEventName(event.name);
    const iconCell = row.createDiv({ cls: "jnr-col jnr-col-icon" });
    const iconInput = iconCell.createEl("input", {
      cls: "jnr-event-icon-input",
      attr: { placeholder: "📅", title: "图标 emoji" },
    });
    iconInput.value = parsed.icon;

    const nameCell = row.createDiv({ cls: "jnr-col jnr-col-name jnr-event-name-cell" });
    const labelInput = nameCell.createEl("input", {
      cls: "jnr-event-label-input",
      attr: { placeholder: "名称", title: "纪念日名称" },
    });
    labelInput.value = parsed.label;
    const saveName = () => {
      if (!iconInput.value.trim() && !labelInput.value.trim()) {
        new Notice("名称不能为空，已保留原来的名称");
        const current = parseEventName(event.name);
        iconInput.value = current.icon;
        labelInput.value = current.label;
        return;
      }
      event.name = combineEventName(iconInput.value, labelInput.value);
      this.plugin.scheduleSaveEvents();
    };
    iconInput.addEventListener("change", saveName);
    labelInput.addEventListener("change", saveName);

    const dateCell = row.createDiv({ cls: "jnr-col jnr-col-date" });
    const dateBtn = dateCell.createEl("button", { cls: "jnr-date-btn" });
    const dateWheel = attachDateWheelButton(this.app, dateBtn, {
      getDate: () => event.date,
      getType: () => event.type,
      getLeapMonth: () => event.leapMonth === true,
      onChange: (result) => {
        event.date = result.date;
        event.leapMonth = result.leapMonth ? true : undefined;
        this.plugin.scheduleSaveEvents();
      },
    });

    const typeCell = row.createDiv({ cls: "jnr-col jnr-col-type jnr-col-type-compact" });
    const modeSelect = typeCell.createEl("select", {
      cls: "jnr-event-mode-select jnr-event-type-compact",
    });
    modeSelect.createEl("option", { value: "yearly", text: "每年" });
    modeSelect.createEl("option", { value: "elapsed", text: "累计" });
    modeSelect.value = event.recurrence ?? "yearly";
    const typeSelect = typeCell.createEl("select", {
      cls: "jnr-event-type-select jnr-event-type-compact",
    });
    typeSelect.createEl("option", { value: "solar", text: "阳历" });
    typeSelect.createEl("option", { value: "lunar", text: "阴历" });
    typeSelect.value = event.type;
    const syncMode = () => {
      const elapsed = modeSelect.value === "elapsed";
      typeSelect.toggleClass("is-hidden", elapsed);
      if (elapsed) typeSelect.value = "solar";
    };
    modeSelect.addEventListener("change", () => {
      event.recurrence = modeSelect.value as RecurrenceType;
      if (event.recurrence === "elapsed") {
        event.type = "solar";
        event.leapMonth = undefined;
      }
      syncMode();
      dateWheel.refresh();
      this.plugin.scheduleSaveEvents();
    });
    typeSelect.addEventListener("change", () => {
      event.type = typeSelect.value as CalendarType;
      if (event.type !== "lunar") event.leapMonth = undefined;
      dateWheel.refresh();
      this.plugin.scheduleSaveEvents();
    });
    syncMode();

    const showCell = row.createDiv({ cls: "jnr-col jnr-col-show jnr-event-toggle-cell" });
    const showCb = showCell.createEl("input", {
      type: "checkbox",
      attr: { "aria-label": `${event.name} 在侧边栏展示` },
    });
    showCb.checked = event.showInSidebar;
    showCb.addEventListener("change", () => {
      event.showInSidebar = showCb.checked;
      this.plugin.scheduleSaveEvents();
    });

    const remindCell = row.createDiv({ cls: "jnr-col jnr-col-remind jnr-event-toggle-cell" });
    const remindCb = remindCell.createEl("input", {
      type: "checkbox",
      attr: { "aria-label": `${event.name} 开启提醒` },
    });
    remindCb.checked = event.remindersEnabled;
    remindCb.addEventListener("change", () => {
      event.remindersEnabled = remindCb.checked;
      this.plugin.scheduleSaveEvents();
    });

    const actionCell = row.createDiv({ cls: "jnr-col jnr-col-action jnr-event-action-cell" });
    const editBtn = actionCell.createEl("button", {
      cls: "clickable-icon jnr-event-edit",
      attr: { "aria-label": "完整编辑", title: "完整编辑（备注、分组等）" },
    });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", () => this.openEventModal(event));

    const deleteBtn = actionCell.createEl("button", {
      cls: "clickable-icon jnr-event-delete",
      attr: { "aria-label": "删除" },
    });
    setIcon(deleteBtn, "trash");
    deleteBtn.addEventListener("click", () => {
      void showConfirm(this.app, {
        title: "删除纪念事项",
        message: `确定删除「${event.name}」？此操作不可撤销。`,
        confirmText: "删除",
        warning: true,
      }).then((ok) => {
        if (!ok) return;
        const idx = this.plugin.events.findIndex((e) => e.id === event.id);
        if (idx >= 0) {
          this.plugin.events.splice(idx, 1);
          void this.plugin.flushSaveEvents().then(() => this.display());
        }
      });
    });
  }

  private openEventModal(event: AnniversaryEvent | null, defaultGroup?: EventGroup): void {
    new EventModal(
      this.app,
      this.plugin,
      event,
      async (result, updated) => {
        if (result.deleted) {
          const idx = this.plugin.events.findIndex((e) => e.id === updated.id);
          if (idx >= 0) this.plugin.events.splice(idx, 1);
        } else if (event) {
          const idx = this.plugin.events.findIndex((e) => e.id === updated.id);
          if (idx >= 0) this.plugin.events[idx] = updated;
        } else {
          updated.sortOrder = this.plugin.events.filter((e) => e.group === updated.group).length;
          this.plugin.events.push(updated);
        }
        await this.plugin.flushSaveEvents();
        this.display();
      },
      defaultGroup
    ).open();
  }
}
