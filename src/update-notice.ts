import { App, Modal, Notice } from "obsidian";
import type JinianriPlugin from "./main";
import {
  MOBILE_TOP_INSET_PX,
  appendMobileTopSpacer,
  isMobileAppContext,
  mobileTopSpacerCss,
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

const STYLE_ID = "jnr-update-notice-styles";

export function injectUpdateNoticeStyles(): void {
  const old = document.getElementById(STYLE_ID);
  if (old) old.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.lifeos-modal.modal,
.jnr-update-modal.modal {
  width: min(680px, calc(100vw - 32px));
  max-width: 680px;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
}
.lifeos-modal .modal-content,
.jnr-update-modal .modal-content {
  border-radius: 16px;
  overflow: hidden;
}
.lifeos-modal-primary,
.jnr-update-btn {
  border-radius: 10px;
  font-weight: 700;
}
.jnr-update-modal.modal {
  width: min(680px, calc(100vw - 32px));
  max-width: 680px;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
}
.jnr-update-modal .modal-close-button { top: 14px; right: 14px; z-index: 2; }
.jnr-update-modal .modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
}
.jnr-update-wrap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
}
.jnr-update-hero {
  flex: 0 0 auto;
  padding: 28px 28px 22px;
  background: linear-gradient(135deg, var(--lifeos-accent-soft, rgba(180, 130, 70, 0.12)), rgba(45,90,71,0.08));
  border-bottom: 1px solid var(--background-modifier-border);
}
.jnr-update-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--lifeos-accent-soft, rgba(180, 130, 70, 0.14));
  color: var(--lifeos-accent, #b48246);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.4px;
  margin-bottom: 10px;
}
.jnr-update-title {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  color: var(--text-normal);
  line-height: 1.25;
}
.jnr-update-subtitle {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-muted);
  text-indent: 2em;
}
.jnr-update-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 18px var(--lifeos-sidebar-inset, 10px) 8px;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.jnr-update-body::-webkit-scrollbar { display: none; width: 0; height: 0; }
.jnr-update-version {
  border: 1px solid var(--background-modifier-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--background-primary);
  flex-shrink: 0;
}
.jnr-update-version-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 800;
  color: #2d5a47;
  background: rgba(45,90,71,0.06);
  border-bottom: 1px solid transparent;
  user-select: none;
}
.jnr-update-version.is-open .jnr-update-version-head {
  border-bottom-color: var(--background-modifier-border);
}
.jnr-update-version.is-latest .jnr-update-version-head {
  color: var(--lifeos-accent, #b48246);
  background: var(--lifeos-accent-soft, rgba(180, 130, 70, 0.08));
}
.jnr-update-version:not(.is-latest) .jnr-update-version-head {
  cursor: pointer;
}
.jnr-update-version:not(.is-latest) .jnr-update-version-head:hover {
  background: rgba(45,90,71,0.1);
}
.jnr-update-version-chevron {
  flex: 0 0 auto;
  font-size: 16px;
  line-height: 1;
  color: var(--text-muted);
  transition: transform 0.18s ease;
}
.jnr-update-version.is-open .jnr-update-version-chevron {
  transform: rotate(90deg);
}
.jnr-update-version.is-latest .jnr-update-version-chevron {
  display: none;
}
.jnr-update-version-body {
  display: none;
}
.jnr-update-version.is-open .jnr-update-version-body {
  display: block;
}
.jnr-update-list { list-style: none; margin: 0; padding: 8px 0; }
.jnr-update-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  border-top: 1px solid rgba(0,0,0,0.03);
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-normal);
  word-break: break-word;
}
.jnr-update-item:first-child { border-top: none; }
.jnr-update-num {
  flex: 0 0 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--lifeos-accent-soft, rgba(180, 130, 70, 0.12));
  color: var(--lifeos-accent, #b48246);
  font-size: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}
.jnr-update-foot {
  flex: 0 0 auto;
  padding: 16px 24px 22px;
  padding-bottom: max(22px, env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--background-modifier-border);
  display: flex;
  justify-content: flex-end;
  background: var(--background-primary);
}
.jnr-update-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  background: var(--lifeos-accent, #b48246);
  color: #fff;
  box-shadow: 0 6px 18px var(--lifeos-accent-border, rgba(180, 130, 70, 0.28));
}
.jnr-update-btn:hover { filter: brightness(1.05); }
${mobileTopSpacerCss()}
.is-mobile .jnr-update-modal-mobile.modal {
  width: calc(100vw - 16px);
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - ${MOBILE_TOP_INSET_PX}px - 12px);
  padding-top: env(safe-area-inset-top, 0px);
  box-sizing: border-box;
}
.is-mobile .jnr-update-modal-mobile .modal-close-button {
  top: calc(env(safe-area-inset-top, 0px) + ${MOBILE_TOP_INSET_PX}px + 10px);
  z-index: 2;
}
.is-mobile .jnr-update-modal-mobile .modal-content,
.is-mobile .jnr-update-modal-mobile .jnr-update-wrap {
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - ${MOBILE_TOP_INSET_PX}px - 12px);
}
@media (max-width: 768px) {
  .jnr-update-modal.modal {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 12px);
  }
  .jnr-update-modal-mobile.modal {
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - ${MOBILE_TOP_INSET_PX}px - 12px);
  }
  .jnr-update-modal .modal-content,
  .jnr-update-wrap {
    max-height: calc(100dvh - 12px);
  }
  .jnr-update-hero { padding: 20px 16px 14px; }
  .jnr-update-title { font-size: 20px; }
  .jnr-update-subtitle { font-size: 13px; }
  .jnr-update-body { padding: 12px var(--lifeos-sidebar-inset, 10px) 6px; }
  .jnr-update-item { font-size: 13px; padding: 9px 12px; }
  .jnr-update-foot { padding: 12px 14px max(14px, env(safe-area-inset-bottom, 14px)); }
  .jnr-update-btn { width: 100%; text-align: center; padding: 12px 16px; }
}
`;
  document.head.appendChild(style);
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
