import { Platform } from "obsidian";
import type JinianriPlugin from "./main";
import { isLicenseEnforced } from "./license";
import { parseEventName } from "./name-utils";
import { formatCountdownPlain } from "./display-labels";

const STATUS_BAR_CLASS = "jnr-status-bar";

/** 热重载 / 异常卸载后残留的状态栏项（同一文案重复多份即此问题） */
export function cleanupStaleStatusBarItems(): void {
  try {
    document.querySelectorAll(`.${STATUS_BAR_CLASS}`).forEach((el) => el.remove());
  } catch {
    /* 忽略 */
  }
}

export class JinianriStatusBar {
  private plugin: JinianriPlugin;
  private el: HTMLElement | null = null;

  constructor(plugin: JinianriPlugin) {
    this.plugin = plugin;
    if (Platform.isMobile) return;

    cleanupStaleStatusBarItems();
    this.el = plugin.addStatusBarItem();
    this.el.addClass(STATUS_BAR_CLASS);
    this.el.addEventListener("click", () => this.handleClick());
  }

  private handleClick(): void {
    const visible = this.plugin.events.filter((e) => e.showInSidebar);
    if (visible.length === 0) {
      void this.plugin.openAddEventModal();
      return;
    }
    void this.plugin.activateSidebar();
  }

  update(): void {
    if (!this.el) return;

    if (!this.plugin.settings.showStatusBar) {
      this.el.empty();
      this.el.removeAttribute("title");
      this.el.hide();
      return;
    }
    this.el.show();

    if (isLicenseEnforced() && !this.plugin.isLicensed()) {
      this.el.setText("纪念日 · 请激活");
      this.el.setAttr("title", "纪念日 · 请激活");
      return;
    }

    const visible = this.plugin.events.filter((e) => e.showInSidebar);
    if (visible.length === 0) {
      this.el.setText("纪念日 · 去添加");
      this.el.setAttr("title", "纪念日 · 去添加纪念事项");
      return;
    }

    const items = visible
      .map((e) => this.plugin.getComputed(e))
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const todayItems = items.filter((i) => i.isToday);
    if (todayItems.length > 1) {
      const text = `纪念日 · 今天 ${todayItems.length} 个`;
      this.el.setText(text);
      this.el.setAttr("title", text);
      return;
    }

    const nearest = items[0];
    const { icon, label } = parseEventName(nearest.event.name);

    if (nearest.isToday) {
      const text = `${icon} 今天：${label}`;
      this.el.setText(text);
      this.el.setAttr("title", text);
      return;
    }

    const text = `${icon} ${label} · ${formatCountdownPlain(nearest).replace("🎉 ", "")}`;
    this.el.setText(text);
    this.el.setAttr("title", text);
  }

  destroy(): void {
    try {
      this.el?.remove();
    } catch {
      /* 忽略 */
    }
    this.el = null;
  }
}
