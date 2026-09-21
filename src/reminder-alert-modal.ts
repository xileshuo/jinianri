import { App, Modal } from "obsidian";

export interface ReminderAlertEntry {
  title: string;
  body: string;
}

/** 居中提醒弹窗：支持多条合并；Esc /「知道了」关闭（展示时已记发） */
export class ReminderAlertModal extends Modal {
  private entries: ReminderAlertEntry[];
  private onDismiss: (() => void) | null;

  constructor(app: App, entries: ReminderAlertEntry[], onDismiss?: () => void) {
    super(app);
    this.entries =
      entries.length > 0 ? entries : [{ title: "纪念日提醒", body: "" }];
    this.onDismiss = onDismiss ?? null;
  }

  onOpen(): void {
    const { modalEl, contentEl } = this;
    modalEl.addClass("jnr-reminder-alert-modal");
    const host = this.containerEl;
    host.addClass("jnr-reminder-alert-host");

    contentEl.empty();
    contentEl.addClass("jnr-reminder-alert-content");

    const multiple = this.entries.length > 1;
    contentEl.createEl("div", { cls: "jnr-reminder-alert-icon", text: "🔔" });
    contentEl.createDiv({
      cls: "jnr-reminder-alert-title",
      text: multiple
        ? `纪念日提醒 · ${this.entries.length} 条`
        : this.entries[0].title,
    });
    contentEl.createEl("p", {
      cls: "jnr-reminder-alert-hint",
      text: "已记为提醒过，可按 Esc 或点「知道了」关闭",
    });

    for (const entry of this.entries) {
      const group = contentEl.createDiv({ cls: "jnr-reminder-alert-group" });
      if (multiple) {
        group.createDiv({
          cls: "jnr-reminder-alert-subtitle",
          text: entry.title,
        });
      }
      const bodyEl = group.createDiv({ cls: "jnr-reminder-alert-body" });
      for (const line of entry.body.split("\n")) {
        if (line.trim()) bodyEl.createEl("p", { text: line });
      }
    }

    const btnRow = contentEl.createDiv({ cls: "jnr-reminder-alert-actions" });
    btnRow
      .createEl("button", { text: "知道了", cls: "mod-cta" })
      .addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
    this.onDismiss?.();
  }
}

class ReminderModalQueue {
  private queue: Array<{
    entries: ReminderAlertEntry[];
    onDismiss?: () => void;
  }> = [];
  private showing = false;
  private app: App | null = null;

  enqueue(
    app: App,
    entries: ReminderAlertEntry[],
    onDismiss?: () => void
  ): void {
    this.app = app;
    this.queue.push({ entries, onDismiss });
    this.drain();
  }

  private drain(): void {
    if (this.showing || this.queue.length === 0 || !this.app) return;
    this.showing = true;
    const { entries, onDismiss } = this.queue.shift()!;
    new ReminderAlertModal(this.app, entries, () => {
      onDismiss?.();
      this.showing = false;
      this.drain();
    }).open();
  }
}

const modalQueue = new ReminderModalQueue();

export function showReminderModal(
  app: App,
  entries: ReminderAlertEntry[],
  onDismiss?: () => void
): void {
  modalQueue.enqueue(app, entries, onDismiss);
}
