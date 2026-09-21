import { App, Modal } from "obsidian";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  warning?: boolean;
}

/** 与 Obsidian Modal 风格一致的确认对话框，替代原生 confirm() */
export function showConfirm(app: App, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmModal(app, options, resolve);
    modal.open();
  });
}

class ConfirmModal extends Modal {
  private resolve: (value: boolean) => void;
  private options: ConfirmOptions;
  private settled = false;

  constructor(app: App, options: ConfirmOptions, resolve: (value: boolean) => void) {
    super(app);
    this.options = options;
    this.resolve = resolve;
  }

  onOpen(): void {
    const { contentEl, titleEl, modalEl } = this;
    modalEl.addClass("lifeos-modal");
    modalEl.addClass("jnr-confirm-host");
    titleEl.setText(this.options.title);
    contentEl.empty();
    contentEl.addClass("jnr-confirm-modal");

    contentEl.createEl("p", {
      cls: "jnr-confirm-message",
      text: this.options.message,
    });

    const actions = contentEl.createDiv({ cls: "jnr-confirm-actions" });
    actions
      .createEl("button", { text: this.options.cancelText ?? "取消" })
      .addEventListener("click", () => this.finish(false));

    actions
      .createEl("button", {
        text: this.options.confirmText ?? "确定",
        cls: this.options.warning ? "mod-warning" : "mod-cta",
      })
      .addEventListener("click", () => this.finish(true));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.finish(false);
  }

  private finish(value: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}
