import { ItemView, WorkspaceLeaf } from "obsidian";
import type JinianriPlugin from "./main";
import { DashboardPanel } from "./dashboard-panel";

export const DASHBOARD_VIEW_TYPE = "jinianri-dashboard";

export class DashboardView extends ItemView {
  plugin: JinianriPlugin;
  private panel: DashboardPanel | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: JinianriPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "纪念日";
  }

  getIcon(): string {
    return "calendar-heart";
  }

  async onOpen(): Promise<void> {
    this.panel = new DashboardPanel(this.app, this.plugin, this.containerEl);
    this.panel.mount();
  }

  async onClose(): Promise<void> {
    this.panel?.destroy();
    this.panel = null;
    this.containerEl.empty();
  }

  refresh(): void {
    this.panel?.refresh();
  }
}
