import { App, Modal, Notice } from "obsidian";
import type JinianriPlugin from "./main";
import {
  appendMobileTopSpacer,
  isMobileAppContext,
} from "./mobile-top-inset";
import { elevateLifeOsUpdateModal } from "./lifeos-suite";
import { formatLifeOsVersionLine, injectLifeOsSharedStyles } from "./lifeos-ui-shared";
import { getEditionLabel } from "./edition-label";

declare const PLUGIN_VERSION: string | undefined;
declare const PLUGIN_CHANGELOG: Record<string, string[]> | undefined;
declare const PLUGIN_DISPLAY_NAME: string | undefined;
declare const PLUGIN_INTRO: string | undefined;

const PHILOSOPHY_SUBTITLE = "生活中充满了值得记忆值得期待的美好日子，它们本不应该被遗忘。";

function getPluginVersion(): string {
  return typeof PLUGIN_VERSION === "string" ? PLUGIN_VERSION : "2.9.8";
}

function getChangelog(): Record<string, string[]> {
  return PLUGIN_CHANGELOG ?? {};
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function needsUpdateNotice(lastSeen: string, current: string): boolean {
  const seen = String(lastSeen || "").trim();
  const cur = String(current || "").trim();
  if (!cur) return false;
  if (!seen) return true;
  return compareVersions(seen, cur) < 0;
}

export function injectUpdateNoticeStyles(): void {
  return;
}

const TECHNICAL_CHANGELOG_PATTERN =
  /onunload|onload|viewByType|热重载|iCloud|register|detach|alive|flush|代码块|safeRegister|ensureSideLeaf|plugin-instance|debounce|Map\./i;

function filterChangelogForDisplay(items: string[]): string[] {
  const filtered = items.filter(
    (line) => !(line.startsWith("修复：") && TECHNICAL_CHANGELOG_PATTERN.test(line))
  );
  if (filtered.length > 0) return filtered;
  const userLines = items.filter((line) => line.startsWith("体验：") || line.startsWith("新增："));
  if (userLines.length > 0) return userLines;
  return ["体验优化与稳定性改进"];
}

function renderChangelogBody(body: HTMLElement, currentVersion: string): void {
  const changelog = getChangelog();
  const versions = Object.keys(changelog)
    .filter((v) => changelog[v]?.length)
    .sort((a, b) => compareVersions(b, a));

  if (!versions.length) {
    body.createEl("p", {
      text: "暂无更新记录。",
      cls: "jnr-update-subtitle",
    });
    return;
  }

  for (const ver of versions) {
    const items = filterChangelogForDisplay(changelog[ver]);
    if (!items?.length) continue;

    const isLatest = ver === currentVersion;
    const block = body.createDiv({
      cls: `jnr-update-version${isLatest ? " is-open is-latest" : ""}`,
    });

    const head = block.createDiv({ cls: "jnr-update-version-head" });
    head.createSpan({
      text: isLatest ? `✨ 本次更新 · v${ver}` : `v${ver}`,
    });
    head.createSpan({ cls: "jnr-update-version-chevron", text: "›" });

    const content = block.createDiv({ cls: "jnr-update-version-body" });
    const list = content.createEl("ul", { cls: "jnr-update-list" });
    items.forEach((note, idx) => {
      const item = list.createEl("li", { cls: "jnr-update-item" });
      item.createSpan({ cls: "jnr-update-num", text: String(idx + 1) });
      item.createSpan({ text: note });
    });

    if (!isLatest) {
      head.setAttr("role", "button");
      head.setAttr("tabindex", "0");
      head.setAttr("aria-expanded", "false");
      const toggle = () => {
        const open = !block.hasClass("is-open");
        block.toggleClass("is-open", open);
        head.setAttr("aria-expanded", open ? "true" : "false");
      };
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        toggle();
      });
    }
  }
}

export function showUpdateNoticeModal(
  app: App,
  plugin: JinianriPlugin,
  options?: { force?: boolean; onDismiss?: () => void }
): void {
  try {
    const version = getPluginVersion();
    if (!options?.force && !needsUpdateNotice(plugin.settings.lastSeenVersion, version)) return;

    injectUpdateNoticeStyles();
    injectLifeOsSharedStyles();

    const isMobile = isMobileAppContext(app);
    const modal = new Modal(app);
    modal.modalEl.addClass("jnr-update-modal");
    if (isMobile) modal.modalEl.addClass("jnr-update-modal-mobile");
    modal.modalEl.addClass("lifeos-modal");
    modal.titleEl.hide();
    modal.contentEl.empty();

    let seenWritten = false;
    const writeSeen = async () => {
      if (seenWritten) return;
      seenWritten = true;
      plugin.settings.lastSeenVersion = version;
      await plugin.saveSettings();
      options?.onDismiss?.();
    };

    modal.onClose = () => {
      void writeSeen();
    };

    const wrap = modal.contentEl.createDiv({ cls: "jnr-update-wrap" });
    if (isMobile) appendMobileTopSpacer(wrap);
    const hero = wrap.createDiv({ cls: "jnr-update-hero" });
    hero.createDiv({ cls: "jnr-update-badge", text: getPluginVersionLabel() });
    const displayName = typeof PLUGIN_DISPLAY_NAME === "string" && PLUGIN_DISPLAY_NAME ? PLUGIN_DISPLAY_NAME : "纪念日";
    hero.createEl("h2", { cls: "jnr-update-title", text: `${displayName} 更新日志` });
    const intro = typeof PLUGIN_INTRO === "string" ? PLUGIN_INTRO.trim() : "";
    if (intro) {
      const introEl = hero.createEl("p", { text: intro });
      introEl.addClass("jnr-update-subtitle");
      introEl.addClass("lifeos-philosophy-intro");
    }
    const subEl = hero.createEl("p", { text: PHILOSOPHY_SUBTITLE });
    subEl.addClass("jnr-update-subtitle");
    subEl.addClass("lifeos-philosophy-intro");

    const body = wrap.createDiv({ cls: "jnr-update-body" });
    renderChangelogBody(body, version);

    const foot = wrap.createDiv({ cls: "jnr-update-foot" });
    const btn = foot.createEl("button", { text: "知道了，开始使用" });
    btn.addClass("lifeos-modal-primary");
    btn.addClass("jnr-update-btn");
    btn.onclick = () => {
      void writeSeen().then(() => modal.close());
    };

    modal.open();
    elevateLifeOsUpdateModal(modal);
  } catch (err) {
    console.error("[LifeOS] showUpdateNoticeModal failed", err);
    try { new Notice("无法打开更新日志，请重试或重启 Obsidian"); } catch { /* ignore */ }
  }
}

export function getPluginVersionLabel(): string {
  const v = typeof PLUGIN_VERSION === "string" ? PLUGIN_VERSION : "2.13.0";
  return formatLifeOsVersionLine(v, getEditionLabel());
}
