import { normalizePath } from "obsidian";
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
