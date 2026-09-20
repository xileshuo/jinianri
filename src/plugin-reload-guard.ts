import {
  type App,
  type Command,
  type MarkdownPostProcessor,
  type Plugin,
  type ViewCreator,
} from "obsidian";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isAlreadyRegisteredError(err: unknown): boolean {
  return /already registered|existing view type/i.test(errMsg(err));
}

const JNR_UI_ROOT_SELECTOR = ".jnr-sidebar, .jnr-activation-panel, .jnr-mobile-dashboard-root";

/** 仅清空 DOM，不 detach leaf（onunload 内安全，不会触发「无法禁用」） */
export function emptyDashboardDom(): void {
  try {
    document.querySelectorAll(JNR_UI_ROOT_SELECTOR).forEach((el) => {
      const leafContent = el.closest(".workspace-leaf-content");
      if (leafContent instanceof HTMLElement) leafContent.empty();
    });
  } catch {
    /* 忽略 */
  }
}

/** 插件禁用完成后延迟 detach（同步 detach 会导致 Obsidian 报「无法禁用」） */
export function scheduleDeferredDashboardCleanup(app: App, type: string): void {
  window.setTimeout(() => {
    try {
      app.workspace.detachLeavesOfType(type);
    } catch {
      /* 忽略 */
    }
    emptyDashboardDom();
  }, 150);
}

function tryUnregisterCodeBlockLanguage(app: App, language: string): void {
  try {
    const appAny = app as App & Record<string, unknown>;
    const registry = appAny.viewRegistry as Record<string, unknown> | undefined;
    for (const map of [
      appAny.codeBlockPostProcessors,
      registry?.codeBlockPostProcessors,
      registry?.codeBlockLanguageProcessors,
    ]) {
      if (!map || typeof map !== "object") continue;
      if (map instanceof Map) map.delete(language);
      else delete (map as Record<string, unknown>)[language];
    }
  } catch {
    /* 忽略 */
  }
}

function tryUnregisterView(app: App, type: string): void {
  // 与 4.0.1 一致：仅在「启动重注册冲突」时同步 detach；勿在 onunload 调用
  try {
    app.workspace.detachLeavesOfType(type);
  } catch {
    /* 忽略 */
  }
  try {
    const registry = (app as App & { viewRegistry?: { unregisterView?: (t: string) => void } })
      .viewRegistry;
    registry?.unregisterView?.(type);
  } catch {
    /* 忽略 */
  }
  emptyDashboardDom();
}

/** 启动前清残留：延迟 detach + 代码块去重 + 设置 Tab 去重（不抛错） */
export function cleanupStaleRegistrations(
  app: App,
  viewType: string,
  codeBlockLang: string,
  pluginId = "jinianri"
): void {
  emptyDashboardDom();
  removeStalePluginSettingTabs(app, pluginId);
  tryUnregisterCodeBlockLanguage(app, codeBlockLang);
  window.setTimeout(() => {
    try {
      app.workspace.detachLeavesOfType(viewType);
    } catch {
      /* 忽略 */
    }
    emptyDashboardDom();
  }, 0);
}

export function safeRegisterView(
  app: App,
  type: string,
  creator: ViewCreator,
  register: (type: string, creator: ViewCreator) => void
): void {
  try {
    register(type, creator);
    return;
  } catch (err) {
    if (!isAlreadyRegisteredError(err)) {
      console.warn("[纪念日] 视图注册失败", err);
      return;
    }
  }

  tryUnregisterView(app, type);
  try {
    register(type, creator);
  } catch (err) {
    console.warn("[纪念日] 视图仍冲突，请重启 Obsidian 后使用侧边栏", err);
  }
}

export function safeRegisterCodeBlockProcessor(
  plugin: Plugin,
  language: string,
  handler: (source: string, el: HTMLElement) => void
): MarkdownPostProcessor | null {
  const register = () =>
    plugin.registerMarkdownCodeBlockProcessor(language, (source, el) => handler(source, el));

  try {
    return register();
  } catch (err) {
    if (!isAlreadyRegisteredError(err)) {
      console.warn("[纪念日] 代码块注册失败", err);
      return null;
    }
    tryUnregisterCodeBlockLanguage(plugin.app, language);
  }

  try {
    return register();
  } catch (err) {
    console.warn("[纪念日] 代码块仍冲突，笔记嵌入需重启 Obsidian", err);
    return null;
  }
}

export function safeAddCommand(plugin: Plugin, command: Command): void {
  try {
    plugin.addCommand(command);
    return;
  } catch (err) {
    if (!isAlreadyRegisteredError(err)) {
      console.warn(`[纪念日] 命令 ${command.id} 注册失败`, err);
      return;
    }
  }

  try {
    plugin.removeCommand(command.id);
    plugin.addCommand(command);
  } catch (err) {
    console.warn(`[纪念日] 命令 ${command.id} 仍冲突`, err);
  }
}

export function safeAddRibbonIcon(
  plugin: Plugin,
  icon: string,
  title: string,
  callback: () => void
): void {
  try {
    plugin.addRibbonIcon(icon, title, callback);
  } catch (err) {
    console.warn("[纪念日] Ribbon 图标注册失败", err);
  }
}

/** 移除同一插件在设置侧栏的重复 Tab（反复启用/禁用会累积） */
export function removeStalePluginSettingTabs(app: App, pluginId: string): void {
  try {
    const tabs = app.setting?.pluginTabs;
    if (!Array.isArray(tabs)) return;
    for (let i = tabs.length - 1; i >= 0; i--) {
      const tab = tabs[i] as {
        id?: string;
        plugin?: { manifest?: { id?: string } };
      };
      const tabPluginId = tab?.plugin?.manifest?.id ?? tab?.id;
      if (tabPluginId === pluginId) tabs.splice(i, 1);
    }
  } catch {
    /* 忽略 */
  }
}

export function safeAddSettingTab(plugin: Plugin, tab: ConstructorParameters<Plugin["addSettingTab"]>[0]): void {
  removeStalePluginSettingTabs(plugin.app, plugin.manifest.id);
  try {
    plugin.addSettingTab(tab);
  } catch (err) {
    console.warn("[纪念日] 设置页注册失败", err);
  }
}
