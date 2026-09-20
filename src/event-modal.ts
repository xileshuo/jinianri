import { App, Modal } from "obsidian";
import { attachDateWheelButton } from "./date-wheel-picker";
import { showConfirm } from "./confirm-modal";
import { combineEventName, parseEventName } from "./name-utils";
import type JinianriPlugin from "./main";
import type { AnniversaryEvent, CalendarType, RecurrenceType } from "./types";
import { generateId } from "./types";
import { formatYmd } from "./date-utils";
import { recurrenceLabel } from "./display-labels";

export interface EventModalResult {
  saved: boolean;
  deleted?: boolean;
}

export interface EventModalOptions {
  defaultGroup?: string;
  defaultDate?: string;
}

export class EventModal extends Modal {
  private plugin: JinianriPlugin;
  private event: AnniversaryEvent;
  private isNew: boolean;
  private onSubmit: (result: EventModalResult, event: AnniversaryEvent) => void;
  private iconValue = "📅";
  private labelValue = "";
  private notesValue = "";
  private refreshDateButton: (() => void) | null = null;

  constructor(
    app: App,
    plugin: JinianriPlugin,
    event: AnniversaryEvent | null,
    onSubmit: (result: EventModalResult, event: AnniversaryEvent) => void,
    options?: string | EventModalOptions
  ) {
    super(app);
    const opts: EventModalOptions =
      typeof options === "string"
        ? { defaultGroup: options }
        : options ?? {};
    this.plugin = plugin;
    this.isNew = !event;
    this.event = event ?? {
      id: generateId(),
      name: "",
      // 本地日历日；toISOString 在东八区深夜会写成昨天
      date: opts.defaultDate || formatYmd(new Date()),
      type: "solar",
      group: opts.defaultGroup ?? "other",
      sortOrder: 0,
      remindersEnabled: true,
      showInSidebar: true,
      recurrence: "yearly",
    };
    const parsed = parseEventName(this.event.name);
    this.iconValue = parsed.icon;
    this.labelValue = parsed.label === "未命名" ? "" : parsed.label;
    this.notesValue = this.event.notes ?? "";
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl, titleEl, modalEl } = this;
    contentEl.empty();
    titleEl.setText(this.isNew ? "添加纪念事项" : "编辑纪念事项");
    modalEl.addClass("jnr-event-modal");

    const form = contentEl.createDiv({ cls: "jnr-event-form" });

    const nameField = form.createDiv({ cls: "jnr-event-field" });
    nameField.createDiv({ cls: "jnr-event-field-label", text: "名称" });
    const nameRow = nameField.createDiv({ cls: "jnr-event-name-row" });
    const iconInput = nameRow.createEl("input", {
      cls: "jnr-event-icon-input",
      attr: { maxlength: "4", placeholder: "📅", "aria-label": "图标 emoji" },
    });
    iconInput.value = this.iconValue;
    iconInput.addEventListener("input", () => (this.iconValue = iconInput.value));
    const labelInput = nameRow.createEl("input", {
      cls: "jnr-event-label-input",
      attr: { placeholder: "纪念事项名称", "aria-label": "名称" },
    });
    labelInput.value = this.labelValue;
    labelInput.addEventListener("input", () => (this.labelValue = labelInput.value));

    const dateField = form.createDiv({ cls: "jnr-event-field" });
    dateField.createDiv({ cls: "jnr-event-field-label", text: "日期" });
    const dateBtn = dateField.createEl("button", {
      cls: "jnr-date-btn jnr-event-date-btn",
      type: "button",
    });
    this.refreshDateButton = attachDateWheelButton(this.app, dateBtn, {
      getDate: () => this.event.date,
      getType: () => this.event.type,
      getLeapMonth: () => this.event.leapMonth === true,
      onChange: (result) => {
        this.event.date = result.date;
        this.event.leapMonth = result.leapMonth ? true : undefined;
      },
    }).refresh;

    const modeField = form.createDiv({ cls: "jnr-event-field" });
    modeField.createDiv({ cls: "jnr-event-field-label", text: "类型" });
    const modeSelect = modeField.createEl("select", {
      cls: "jnr-event-select",
      attr: { "aria-label": "纪念类型" },
    });
    modeSelect.createEl("option", { value: "yearly", text: recurrenceLabel("yearly") });
    modeSelect.createEl("option", { value: "elapsed", text: recurrenceLabel("elapsed") });
    modeSelect.value = this.event.recurrence ?? "yearly";

    const typeField = form.createDiv({ cls: "jnr-event-field" });
    typeField.createDiv({ cls: "jnr-event-field-label", text: "历法" });
    const typeSelect = typeField.createEl("select", {
      cls: "jnr-event-select",
      attr: { "aria-label": "历法" },
    });
    typeSelect.createEl("option", { value: "solar", text: "☀️ 阳历" });
    typeSelect.createEl("option", { value: "lunar", text: "🏮 阴历" });
    typeSelect.value = this.event.type;

    const syncModeUi = () => {
      const elapsed = modeSelect.value === "elapsed";
      typeField.toggleClass("is-hidden", elapsed);
    };
    modeSelect.addEventListener("change", () => {
      this.event.recurrence = modeSelect.value as RecurrenceType;
      if (this.event.recurrence === "elapsed") {
        this.event.type = "solar";
        this.event.leapMonth = undefined;
        typeSelect.value = "solar";
        this.refreshDateButton?.();
      }
      syncModeUi();
    });
    typeSelect.addEventListener("change", () => {
      this.event.type = typeSelect.value as CalendarType;
      if (this.event.type !== "lunar") this.event.leapMonth = undefined;
      this.refreshDateButton?.();
    });
    syncModeUi();

    const groupField = form.createDiv({ cls: "jnr-event-field" });
    groupField.createDiv({ cls: "jnr-event-field-label", text: "分组" });
    const groupSelect = groupField.createEl("select", {
      cls: "jnr-event-select",
      attr: { "aria-label": "分组" },
    });
    for (const key of this.plugin.getGroupOrder()) {
      groupSelect.createEl("option", {
        value: key,
        text: this.plugin.getGroupLabel(key),
      });
    }
    groupSelect.value = this.event.group;
    groupSelect.addEventListener("change", () => {
      this.event.group = groupSelect.value;
    });

    const toggles = form.createDiv({ cls: "jnr-event-toggles" });

    const showRow = toggles.createDiv({ cls: "jnr-event-toggle-row" });
    showRow.createSpan({ cls: "jnr-event-toggle-label", text: "侧边栏展示" });
    const showCb = showRow.createEl("input", {
      type: "checkbox",
      cls: "jnr-event-toggle",
      attr: { "aria-label": "侧边栏展示" },
    });
    showCb.checked = this.event.showInSidebar;
    showCb.addEventListener("change", () => {
      this.event.showInSidebar = showCb.checked;
    });

    const remindRow = toggles.createDiv({ cls: "jnr-event-toggle-row" });
    remindRow.createSpan({ cls: "jnr-event-toggle-label", text: "启用提醒" });
    const remindCb = remindRow.createEl("input", {
      type: "checkbox",
      cls: "jnr-event-toggle",
      attr: { "aria-label": "启用提醒" },
    });
    remindCb.checked = this.event.remindersEnabled;
    remindCb.addEventListener("change", () => {
      this.event.remindersEnabled = remindCb.checked;
    });

    const notesField = form.createDiv({ cls: "jnr-event-field jnr-event-field-notes" });
    notesField.createDiv({ cls: "jnr-event-field-label", text: "备注" });
    notesField.createDiv({
      cls: "jnr-event-field-hint",
      text: "可选；看板会展示，也会写入 iCal 导出描述",
    });
    const notesArea = notesField.createEl("textarea", {
      cls: "jnr-event-notes",
      attr: {
        rows: "3",
        placeholder: "例如：礼物清单、庆祝计划…",
        "aria-label": "备注",
      },
    });
    notesArea.value = this.notesValue;
    notesArea.addEventListener("input", () => (this.notesValue = notesArea.value));

    const btnRow = contentEl.createDiv({ cls: "jnr-modal-buttons" });

    btnRow
      .createEl("button", { text: "保存", cls: "mod-cta" })
      .addEventListener("click", () => {
        this.event.name = combineEventName(this.iconValue, this.labelValue);
        if (!this.event.name.trim()) this.event.name = "📅 未命名";
        this.event.notes = this.notesValue.trim() || undefined;
        this.onSubmit({ saved: true }, { ...this.event });
        this.close();
      });

    if (!this.isNew) {
      btnRow
        .createEl("button", { text: "删除", cls: "mod-warning" })
        .addEventListener("click", () => {
          void showConfirm(this.app, {
            title: "删除纪念事项",
            message: `确定删除「${this.event.name}」？此操作不可撤销。`,
            confirmText: "删除",
            warning: true,
          }).then((ok) => {
            if (!ok) return;
            this.onSubmit({ saved: false, deleted: true }, { ...this.event });
            this.close();
          });
        });
    }

    btnRow
      .createEl("button", { text: "取消" })
      .addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
