import { Notice, Setting } from "obsidian";
import type JinianriPlugin from "./main";
import { renderLifeOsActivationPreview, openLifeOsPluginSettings } from "./lifeos-ui-shared";

const LIFEOS_PLUGIN_CATALOG = [
  {
    id: "plain-ledger",
    name: "PlainLedger",
    intro: "专为 Obsidian 开发的记账软件",
    philosophy: "记账不必离开笔记——PlainLedger 把账单、分类、订阅规则保存在 Obsidian 库内，随 iCloud / Git 同步，和日记、复盘同屏共存",
    price: "¥39.9",
    repoUrl: "https://github.com/xileshuo/plain-ledger-obsidian",
  },
  {
    id: "jinianri",
    name: "纪念日",
    intro: "专为 Obsidian 开发的纪念日管理软件",
    philosophy: "记录生日、恋爱、婚姻等重要日期，自动计算「已过时长」与「距离下次还有几天」，支持三档提醒与 iCal 导出",
    price: "¥29.9",
    repoUrl: "https://github.com/xileshuo/jinianri",
  },
  {
    id: "braincore-lifeos",
    name: "BrainCore LifeOS",
    intro: "专为 Obsidian 开发的生活管理控制台",
    philosophy: "Obsidian 知识库的「核心呼吸机」，它由 7 大模块组成，涵盖了时间感知、极速收集、工作流转、习惯养成与知识内化。一切信息从这里输入，最终也会在这里沉淀",
    price: "¥49.9",
    repoUrl: "https://github.com/xileshuo/BrainCore-LifeOS",
  },
];

const LIFEOS_AUTHOR_NAME = "囍樂";
const LIFEOS_COPYRIGHT = "所有版权©囍樂說。保留所有权利。";
const LIFEOS_AUTHOR_HOMEPAGE = "https://xhslink.com/m/3uOoUHv2rI1";

export function getLifeOsVaultKey(app: JinianriPlugin["app"], suffix: string): string {
  const vaultName = app.vault?.getName?.() || "UnknownVault";
  return `lifeos:${vaultName}:${suffix}`;
}

function getEnabledLifeOsPlugins(app: JinianriPlugin["app"]) {
  const plugins = app.plugins?.plugins || {};
  return LIFEOS_PLUGIN_CATALOG.filter((p) => {
    const inst =
      plugins[p.id] ||
      (p.id === "braincore-lifeos"
        ? plugins["braincore-lifeos-personal"] || plugins["braincore-dashboard"]
        : null);
    return inst && (inst as { _loaded?: boolean })._loaded !== false;
  });
}

export function maybeShowLifeOsSuitePrompt(app: JinianriPlugin["app"], selfId: string, selfName: string): void {
  const braincoreFamily = new Set(["braincore-lifeos", "braincore-lifeos-personal", "braincore-dashboard"]);
  const peers = getEnabledLifeOsPlugins(app)
    .filter((p) => {
      if (p.id === selfId) return false;
      if (braincoreFamily.has(selfId) && p.id === "braincore-lifeos") return false;
      return true;
    })
    .map((p) => p.name);
  if (peers.length === 0) return;
  const storageKey = getLifeOsVaultKey(app, "suitePromptSeen");
  try {
    if (localStorage.getItem(storageKey) === "1") return;
  } catch { /* ignore */ }
  window.setTimeout(() => {
    new Notice(`${selfName} 可与 ${peers.join("、")} 并排使用，数据均保存在同一 Obsidian 库内。`, 8000);
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  }, 2200);
}

function openLifeOsExternalUrl(url: string): void {
  if (!url) return;
  try {
    window.open(url, "_blank");
  } catch (err) {
    console.warn("[LifeOS] open external url", err);
  }
}

export interface LifeOsActivationConfig {
  extraPanelClass?: string;
  pluginName: string;
  philosophy?: string;
  getStatusText?: () => string;
  showTrialButton?: boolean;
  trialButtonLabel?: string;
  onTrialStart?: () => void | Promise<void>;
  getFingerprint: () => string;
  licenseKey?: string;
  activateShortLabel?: string;
  activationPreviewRows?: Array<{ label: string; value: string }>;
  activationPreviewNote?: string;
  onCopyFingerprint?: (fp: string) => void | Promise<void>;
  onActivate?: (key: string, msgEl: HTMLElement) => void | Promise<void>;
  openUsageGuide?: () => void | Promise<void>;
  updateNoticeTarget?: { showUpdateNotice?: (force?: boolean) => void; showUpdateNoticeForce?: () => void; maybeShowUpdateNotice?: (onDismiss?: unknown, force?: boolean) => void };
  openSettings?: () => void;
}

export function injectLifeOsActivationStyles(): void {
  return;
}

export function renderLifeOsActivationPanel(container: HTMLElement, config: LifeOsActivationConfig): void {
  injectLifeOsActivationStyles();
  container.empty();
  container.addClass("lifeos-act-panel");
  if (config.extraPanelClass) container.addClass(config.extraPanelClass);

  const wrap = container.createDiv({ cls: "lifeos-act-wrap" });
  const card = wrap.createDiv({ cls: "lifeos-act-card" });
  card.createDiv({ cls: "lifeos-act-title", text: config.pluginName });

  const statusText = config.getStatusText?.() || "";
  if (statusText) card.createEl("p", { cls: "lifeos-act-status", text: statusText });
  if (config.philosophy) card.createEl("p", { cls: "lifeos-act-philosophy lifeos-philosophy-intro", text: config.philosophy });

  if (config.activationPreviewRows?.length) {
    renderLifeOsActivationPreview(card, config.activationPreviewRows, config.activationPreviewNote);
  }

  if (config.showTrialButton && config.onTrialStart) {
    const trialBtn = card.createEl("button", {
      cls: "lifeos-act-trial-btn mod-cta",
      text: config.trialButtonLabel || "开启试用",
      type: "button",
    });
    trialBtn.onclick = () => void config.onTrialStart?.();
  }

  const fp = config.getFingerprint();
  const fpRow = card.createDiv({ cls: "lifeos-act-row" });
  const fpInput = fpRow.createEl("input", {
    type: "text",
    cls: "lifeos-act-input lifeos-act-fp",
    attr: { readonly: "readonly", value: fp, "aria-label": "设备指纹" },
  });
  fpInput.onclick = () => fpInput.select();
  fpRow.createEl("button", { cls: "lifeos-act-btn", text: "复制", type: "button" }).onclick = () =>
    void config.onCopyFingerprint?.(fp);

  const keyRow = card.createDiv({ cls: "lifeos-act-row" });
  const keyInput = keyRow.createEl("input", {
    type: "text",
    cls: "lifeos-act-input lifeos-act-key",
    attr: { placeholder: "输入激活码", "aria-label": "激活码" },
  });
  if (config.licenseKey) keyInput.value = config.licenseKey;
  const activateBtn = keyRow.createEl("button", {
    cls: "lifeos-act-btn lifeos-act-btn-primary",
    text: config.activateShortLabel || "验证并激活",
    type: "button",
  });

  const msgEl = card.createDiv({ cls: "lifeos-act-msg" });
  const nav = card.createDiv({ cls: "lifeos-act-nav" });
  const row1 = nav.createDiv({ cls: "lifeos-act-nav-row" });
  const row2 = nav.createDiv({ cls: "lifeos-act-nav-row" });
  const mkNav = (parent: HTMLElement, label: string, onClick?: () => void) => {
    const btn = parent.createEl("button", { cls: "lifeos-act-nav-btn", text: label, type: "button" });
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      void onClick?.();
    };
  };
  mkNav(row1, "使用说明", () => void config.openUsageGuide?.());
  mkNav(row1, "更新日志", () => openLifeOsUpdateNoticeFromPlugin(config.updateNoticeTarget));
  mkNav(row2, "配置", () => config.openSettings?.());

  const activate = () => void config.onActivate?.(keyInput.value.trim(), msgEl);
  activateBtn.onclick = activate;
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") activate();
  });
}

function injectLifeOsSettingsSharedStyles(): void {
  return;
}

function injectLifeOsAboutStyles(): void {
  injectLifeOsSettingsSharedStyles();
}

export interface LifeOsLicenseSettingsConfig {
  desc?: string;
  trialHint?: string;
  getFingerprint: () => string;
  licenseKey?: string;
  activated?: boolean;
  onCopyFingerprint?: (fp: string) => void | Promise<void>;
  onActivate?: (key: string) => void | Promise<void>;
}

export function renderLifeOsLicenseSettingsPanel(panel: HTMLElement, config: LifeOsLicenseSettingsConfig): void {
  injectLifeOsSettingsSharedStyles();
  panel.empty();
  const grid = panel.createDiv({ cls: "lifeos-settings-grid" });
  const card = grid.createDiv({ cls: "lifeos-settings-block" });
  const heading = new Setting(card).setName("授权激活").setHeading();
  if (config.desc) heading.setDesc(config.desc);
  if (config.trialHint) card.createEl("p", { cls: "lifeos-license-trial-hint", text: config.trialHint });

  const fp = config.getFingerprint?.() || "";
  const fpRow = card.createDiv({ cls: "lifeos-act-row" });
  const fpInput = fpRow.createEl("input", {
    type: "text",
    cls: "lifeos-act-input lifeos-act-fp",
    attr: { readonly: "readonly", value: fp, "aria-label": "设备指纹" },
  });
  fpInput.onclick = () => fpInput.select();
  fpRow.createEl("button", { cls: "lifeos-act-btn", text: "复制", type: "button" }).onclick = () =>
    void config.onCopyFingerprint?.(fp);

  let keyValue = config.licenseKey || "";
  const keyRow = card.createDiv({ cls: "lifeos-act-row" });
  const keyInput = keyRow.createEl("input", {
    type: "text",
    cls: "lifeos-act-input lifeos-act-key",
    attr: { placeholder: "输入激活码", "aria-label": "激活码" },
  });
  keyInput.value = keyValue;
  keyInput.addEventListener("input", () => { keyValue = keyInput.value.trim(); });
  keyRow.createEl("button", {
    cls: "lifeos-act-btn lifeos-act-btn-primary",
    text: "验证并激活",
    type: "button",
  }).onclick = () => void config.onActivate?.(keyValue.trim());
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void config.onActivate?.(keyValue.trim());
  });

  if (config.activated) {
    card.createEl("p", { cls: "lifeos-license-status", text: "已激活，永久有效" });
  }
}

export function renderLifeOsAboutPanel(
  panel: HTMLElement,
  plugin: JinianriPlugin,
  options: { openUsageGuide?: () => void | Promise<void> } = {}
): void {
  injectLifeOsAboutStyles();
  panel.empty();
  const wrap = panel.createDiv({ cls: "lifeos-about-panel lifeos-settings-grid" });

  const helpBlock = wrap.createDiv({ cls: "lifeos-settings-block" });
  new Setting(helpBlock).setName("文档").setHeading();
  const helpRows = helpBlock.createDiv();
  const addLinkRow = (parent: HTMLElement, label: string, onClick: () => void) => {
    const row = parent.createDiv({ cls: "lifeos-about-link-row" });
    row.createSpan({ text: label });
    const btn = row.createEl("button", { text: "打开", type: "button" });
    btn.onclick = () => void onClick();
  };
  addLinkRow(helpRows, "使用说明", () => void options.openUsageGuide?.());
  addLinkRow(helpRows, "更新日志", () => openLifeOsUpdateNoticeFromPlugin(plugin));

  const authorBlock = wrap.createDiv({ cls: "lifeos-settings-block" });
  new Setting(authorBlock).setName("作者").setHeading();
  authorBlock.createEl("p", { cls: "lifeos-about-meta", text: `作者：${LIFEOS_AUTHOR_NAME}` });
  authorBlock.createEl("p", { cls: "lifeos-about-meta", text: `版权信息：${LIFEOS_COPYRIGHT}` });
  const homeRow = authorBlock.createDiv({ cls: "lifeos-about-home-row" });
  homeRow.createSpan({ text: "主页：" });
  const homeLink = homeRow.createEl("a", {
    cls: "lifeos-about-home-link",
    text: LIFEOS_AUTHOR_HOMEPAGE,
    href: LIFEOS_AUTHOR_HOMEPAGE,
  });
  homeLink.onclick = (e) => {
    e.preventDefault();
    openLifeOsExternalUrl(LIFEOS_AUTHOR_HOMEPAGE);
  };

  const worksBlock = wrap.createDiv({ cls: "lifeos-settings-block" });
  new Setting(worksBlock).setName("所有作品").setHeading();
  const enabled = getEnabledLifeOsPlugins(plugin.app);
  const selfId = plugin.manifest.id;
  worksBlock.createEl("p", {
    cls: "lifeos-suite-badge",
    text: `LifeOS 套装已安装 ${enabled.length}/3`,
  });
  const works = worksBlock.createDiv({ cls: "lifeos-about-works" });
  LIFEOS_PLUGIN_CATALOG.forEach((item) => {
    const itemEl = works.createDiv({ cls: "lifeos-about-work-item" });
    itemEl.createEl("p", { cls: "lifeos-about-work-name", text: item.name });
    itemEl.createEl("p", { cls: "lifeos-about-work-intro", text: item.intro });
    if (item.price) {
      itemEl.createEl("p", {
        cls: "lifeos-about-work-price",
        text: `48 小时试用 · ${item.price} 永久激活`,
      });
    }
    if (item.philosophy) {
      itemEl.createEl("p", { cls: "lifeos-about-work-philosophy", text: item.philosophy });
    }
    const actions = itemEl.createDiv({ cls: "lifeos-about-work-actions" });
    const installed = !!(
      plugin.app.plugins?.plugins?.[item.id] ||
      (item.id === "braincore-lifeos" &&
        (plugin.app.plugins?.plugins?.["braincore-lifeos-personal"] ||
          plugin.app.plugins?.plugins?.["braincore-dashboard"]))
    );
    if (item.id === selfId) {
      actions.createEl("button", { text: "当前插件", type: "button", cls: "is-self" });
    } else if (installed) {
      const btn = actions.createEl("button", { text: "打开设置", type: "button" });
      btn.onclick = () => {
        const targetId =
          item.id === "braincore-lifeos" && plugin.app.plugins?.plugins?.["braincore-lifeos-personal"]
            ? "braincore-lifeos-personal"
            : item.id;
        openLifeOsPluginSettings(plugin.app, targetId);
      };
    } else {
      const btn = actions.createEl("button", { text: "去了解", type: "button" });
      btn.onclick = () => {
        if (item.repoUrl) openLifeOsExternalUrl(item.repoUrl);
        else new Notice(`请先在 Obsidian 设置 → 第三方插件 中启用 ${item.name}`);
      };
    }
  });
}

type UpdateNoticePlugin = {
  app?: JinianriPlugin["app"];
  showUpdateNotice?: (force?: boolean) => void;
  showUpdateNoticeForce?: () => void;
  maybeShowUpdateNotice?: (onDismiss?: unknown, force?: boolean) => void;
};

interface ModalLike {
  modalEl: HTMLElement;
}

export function getLifeOsMaxOverlayZIndex(): number {
  let max = 100000;
  document.querySelectorAll(".modal-container, .modal-bg, .vertical-tab-content, .vertical-tab-header").forEach((el) => {
    const raw = (el as HTMLElement).style.zIndex || window.getComputedStyle(el).zIndex || "0";
    const z = parseInt(raw, 10);
    if (!Number.isNaN(z) && z > max) max = z;
  });
  return max + 200;
}

function isObsidianSettingsOpen(app: JinianriPlugin["app"]): boolean {
  try {
    const setting = app?.setting;
    if (!setting) return false;
    if (setting.activeTab) return true;
    const el = setting.containerEl as HTMLElement | undefined;
    if (el?.isConnected && el.offsetParent !== null) return true;
  } catch { /* ignore */ }
  for (const c of document.querySelectorAll(".modal-container")) {
    if (c.querySelector(".vertical-tab-content, .vertical-tab-header")) return true;
  }
  return false;
}

function runLifeOsUpdateNotice(plugin?: UpdateNoticePlugin | null): boolean {
  if (!plugin) return false;
  try {
    if (typeof plugin.showUpdateNoticeForce === "function") {
      plugin.showUpdateNoticeForce();
      return true;
    }
    if (typeof plugin.showUpdateNotice === "function") {
      plugin.showUpdateNotice(true);
      return true;
    }
    if (typeof plugin.maybeShowUpdateNotice === "function") {
      plugin.maybeShowUpdateNotice(undefined, true);
      return true;
    }
  } catch (err) {
    console.error("[LifeOS] Failed to open update notice", err);
    try { new Notice("无法打开更新日志，请重试或重启 Obsidian"); } catch { /* ignore */ }
  }
  return false;
}

export function openLifeOsUpdateNoticeFromPlugin(plugin?: UpdateNoticePlugin | { app?: JinianriPlugin["app"] } | null): void {
  if (!plugin) return;
  const app = (plugin as { app?: JinianriPlugin["app"] }).app;
  const open = () => runLifeOsUpdateNotice(plugin as UpdateNoticePlugin);
  if (app && isObsidianSettingsOpen(app)) {
    try { app.setting.close(); } catch { /* ignore */ }
    let tries = 0;
    const poll = () => {
      tries += 1;
      if (!isObsidianSettingsOpen(app) || tries >= 30) {
        open();
        return;
      }
      window.setTimeout(poll, 80);
    };
    window.setTimeout(poll, 80);
    return;
  }
  open();
}

export function elevateLifeOsUpdateModal(modal: ModalLike): void {
  const apply = () => {
    if (!modal?.modalEl) return;
    const container = modal.modalEl.closest(".modal-container") as HTMLElement | null;
    if (!container) return;
    container.addClass("lifeos-update-modal-host");
    container.querySelector(".modal-bg")?.addClass("lifeos-update-modal-bg");
    modal.modalEl.addClass("lifeos-update-modal-el");
  };
  window.requestAnimationFrame(() => {
    apply();
    window.requestAnimationFrame(apply);
  });
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 180);
}
