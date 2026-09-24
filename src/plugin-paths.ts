import { normalizePath, Notice, TFile } from "obsidian";
import type { App } from "obsidian";

export const PLUGIN_ID = "jinianri";

/** 旧版库内数据路径，首次启动自动迁移 */
export const LEGACY_VAULT_DATA_FILES = ["Life/data.json", "Life/anniversaries.json"];

/** 插件设置（Obsidian loadData / saveData） */
export function getPluginSettingsPath(app: App): string {
  return normalizePath(`${app.vault.configDir}/plugins/${PLUGIN_ID}/data.json`);
}

/** 纪念事项数据 */
export function getPluginEventsPath(app: App): string {
  return normalizePath(`${app.vault.configDir}/plugins/${PLUGIN_ID}/events.json`);
}

/** @deprecated 2.9.1 前纪念事项曾写入 data.json */
export function getLegacyCombinedDataPath(app: App): string {
  return getPluginSettingsPath(app);
}

export function getPluginIcsPath(app: App): string {
  return normalizePath(`${app.vault.configDir}/plugins/${PLUGIN_ID}/data.ics`);
}

/** 打开插件目录下的 JSON：优先 Obsidian 编辑器，其次系统默认应用。 */
export async function openPluginConfigFile(app: App, vaultPath: string): Promise<boolean> {
  const path = normalizePath(String(vaultPath || ""));
  if (!path) return false;
  let file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    await app.workspace.getLeaf(false).openFile(file);
    return true;
  }
  const adapter = app.vault.adapter;
  try {
    if (typeof adapter.exists === "function" && !(await adapter.exists(path))) {
      new Notice(`文件不存在：${path}`);
      return false;
    }
  } catch {
    /* continue */
  }
  if (typeof (app as any).openWithDefaultApp === "function") {
    try {
      await (app as any).openWithDefaultApp(path);
      return true;
    } catch {
      /* continue */
    }
  }
  if (typeof (adapter as any).getFullPath === "function") {
    try {
      const full = (adapter as any).getFullPath(path);
      if (full && typeof (window as any).require === "function") {
        (window as any).require("electron").shell.openPath(full);
        return true;
      }
    } catch {
      /* continue */
    }
  }
  new Notice(`请用文件管理器打开：${path}`);
  return false;
}
