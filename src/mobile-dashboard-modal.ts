import { App, Modal, setIcon } from "obsidian";
import type JinianriPlugin from "./main";
import { DashboardPanel } from "./dashboard-panel";
import { renderEditionBadge } from "./edition-label";
import { appendMobileTopSpacer, isMobileAppContext } from "./mobile-top-inset";

/** 移动端侧边栏不可用时的全屏备用面板 */
export class MobileDashboardModal extends Modal {
  private plugin: JinianriPlugin;
  private panel: DashboardPanel | null = null;

  constructor(app: App, plugin: JinianriPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl, modalEl, titleEl } = this;
    titleEl.hide();
    modalEl.addClass("jnr-mobile-dashboard-modal");
    contentEl.empty();
    contentEl.addClass("jnr-mobile-dashboard-root");

    if (isMobileAppContext(this.app)) {
      appendMobileTopSpacer(contentEl);
    }

    const topBar = contentEl.createDiv({ cls: "jnr-mobile-topbar" });
    const titleWrap = topBar.createDiv({ cls: "jnr-mobile-title-wrap" });
    titleWrap.createSpan({ cls: "jnr-mobile-title", text: "纪念日" });
    renderEditionBadge(titleWrap);

    const closeBtn = topBar.createEl("button", {
      cls: "clickable-icon jnr-mobile-close",
      attr: { "aria-label": "关闭" },
    });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => this.close());

    const bodyWrap = contentEl.createDiv({ cls: "jnr-mobile-body-wrap" });
    const shell = bodyWrap.createDiv({ cls: "jnr-mobile-dashboard-shell jnr-sidebar" });
    this.panel = new DashboardPanel(this.app, this.plugin, shell);
    this.panel.mount();
  }

  onClose(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  refresh(): void {
    this.panel?.refresh();
  }
}
