import type { App } from "obsidian";
import { Notice } from "obsidian";
import { getEditionLabel } from "./edition-label";

declare const PLUGIN_VERSION: string | undefined;

export const LIFEOS_MOBILE_TOP_INSET_PX = 41;
export const LIFEOS_RELEASE = "2026.07.16";

export function getLifeOsReleaseLabel(): string {
  return LIFEOS_RELEASE;
}

export function formatPluginSettingsTitle(baseTitle: string, editionLabel?: string): string {
  const edition = editionLabel ? ` · ${editionLabel}` : "";
  const v = typeof PLUGIN_VERSION === "string" ? PLUGIN_VERSION.trim() : "";
  return v ? `${baseTitle}${edition} v${v}` : `${baseTitle}${edition}`;
}

export function formatLifeOsVersionLine(version: string, editionLabel?: string): string {
  const v = String(version || "").trim() || "0.0.0";
  const ed = editionLabel ? ` · ${editionLabel}` : "";
  return `LifeOS ${LIFEOS_RELEASE} · v${v}${ed}`;
}

export function getPluginVersionDisplayLine(): string {
  const v = typeof PLUGIN_VERSION === "string" ? PLUGIN_VERSION : "0.0.0";
  return formatLifeOsVersionLine(v, getEditionLabel());
}

export function injectLifeOsSharedStyles(): void {
  return;
}

export function renderLifeOsEmptyState(
  parent: HTMLElement,
  options: { icon?: string; message?: string; ctaLabel?: string; onCta?: () => void }
): HTMLElement {
  injectLifeOsSharedStyles();
  parent.empty();
  const wrap = parent.createDiv({ cls: "lifeos-empty-state" });
  if (options.icon) wrap.createDiv({ cls: "lifeos-empty-icon", text: options.icon });
  wrap.createEl("p", { cls: "lifeos-empty-msg", text: options.message || "暂无内容" });
  if (options.ctaLabel && options.onCta) {
    const btn = wrap.createEl("button", { cls: "lifeos-empty-cta", text: options.ctaLabel, type: "button" });
    btn.onclick = () => void options.onCta?.();
  }
  return wrap;
}

export function showLifeOsFirstRunCard(
  container: HTMLElement,
  app: App,
  storageKey: string,
  options: {
    title?: string;
    bullets?: string[];
    primaryLabel?: string;
    secondaryLabel?: string;
    laterLabel?: string;
    onPrimary?: () => void;
    onSecondary?: () => void;
  }
): HTMLElement | null {
  injectLifeOsSharedStyles();
  try {
    // 首启标记用浏览器 localStorage（勿用高于 minApp 的 App 存储 API）
    if (localStorage.getItem(storageKey) === "1") return null;
  } catch { /* ignore */ }
  const card = container.createDiv({ cls: "lifeos-first-run-card" });
  card.createEl("p", { cls: "lifeos-first-run-title", text: options.title || "欢迎使用 LifeOS" });
  const list = card.createEl("ul", { cls: "lifeos-first-run-list" });
  (options.bullets || []).forEach((line) => list.createEl("li", { text: line }));
  const actions = card.createDiv({ cls: "lifeos-first-run-actions" });
  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch { /* ignore */ }
    card.remove();
  };
  if (options.primaryLabel) {
    const primary = actions.createEl("button", {
      cls: "lifeos-first-run-primary",
      text: options.primaryLabel,
      type: "button",
    });
    primary.onclick = () => {
      dismiss();
      options.onPrimary?.();
    };
  }
  if (options.secondaryLabel) {
    const secondary = actions.createEl("button", {
      cls: "lifeos-first-run-secondary",
      text: options.secondaryLabel,
      type: "button",
    });
    secondary.onclick = () => {
      dismiss();
      options.onSecondary?.();
    };
  }
  actions.createEl("button", { text: options.laterLabel || "知道了", type: "button" }).onclick = dismiss;
  return card;
}

export function renderLifeOsActivationPreview(
  card: HTMLElement,
  rows: Array<{ label: string; value: string }>,
  note?: string
): HTMLElement {
  injectLifeOsSharedStyles();
  const preview = card.createDiv({ cls: "plg-activation-preview lifeos-activation-preview" });
  rows.forEach((row) => {
    const line = preview.createDiv({ cls: "plg-activation-preview-row" });
    line.createSpan({ text: row.label });
    line.createEl("strong", { text: row.value });
  });
  if (note) preview.createEl("p", { cls: "plg-activation-preview-note", text: note });
  return preview;
}

export function openLifeOsPluginSettings(app: App, pluginId: string): void {
  if (!app?.setting) return;
  const openTab = () => {
    try {
      if (typeof app.setting.openTabById === "function") {
        app.setting.openTabById(pluginId);
        return true;
      }
      const tab = app.setting.pluginTabs?.find?.((t) => t.id === pluginId);
      if (tab && typeof app.setting.openTab === "function") {
        app.setting.openTab(tab);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  };
  try { app.setting.open(); } catch { /* ignore */ }
  if (openTab()) return;
  window.setTimeout(() => {
    if (!openTab()) new Notice("无法打开插件设置，请手动进入 设置 → 第三方插件");
  }, 80);
}

export function appendLifeOsSettingsFamilyFoot(container: HTMLElement): void {
  /* 已迁移至「关于」Tab，见 renderLifeOsFamilyFoot */
}

export function renderLifeOsFamilyFoot(_container: HTMLElement, _app: App, _selfId: string): void {
  /* 已迁移至「关于 → 所有作品」，保留空实现避免旧调用报错 */
}

export function getLifeOsVaultKey(app: App, suffix: string): string {
  const vaultName = app.vault?.getName?.() || "UnknownVault";
  return `lifeos:${vaultName}:${suffix}`;
}
