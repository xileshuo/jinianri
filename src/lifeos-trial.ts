import { Modal, Notice } from "obsidian";
import type JinianriPlugin from "./main";
import {
  ensureTrialStarted,
  formatTrialRemaining,
  getTrialHoursLabel,
  getTrialRemainingMs,
  isPluginAccessAllowed,
  isTrialActive,
  isTrialEdition,
} from "./license";
import { injectLifeOsSharedStyles } from "./lifeos-ui-shared";

export function renderTrialBanner(container: HTMLElement, plugin: JinianriPlugin): void {
  if (!isTrialEdition() || plugin.settings.licenseActivated) return;
  if (!isTrialActive(plugin.app, plugin.settings)) return;
  injectLifeOsSharedStyles();
  const remain = getTrialRemainingMs(plugin.app, plugin.settings);
  const banner = container.createDiv({ cls: "lifeos-trial-banner" });
  banner.setText(`试用中，剩余 ${formatTrialRemaining(remain)} · 点此激活永久使用`);
  banner.onclick = () => plugin.openSettingsTab(true);
}

export function maybeShowTrialWelcomeModal(plugin: JinianriPlugin, onDone?: () => void): void {
  if (!isTrialEdition() || plugin.settings.trialWelcomeSeen || plugin.settings.licenseActivated) {
    onDone?.();
    return;
  }
  injectLifeOsSharedStyles();
  const modal = new Modal(plugin.app);
  modal.modalEl.addClass("lifeos-modal");
  modal.modalEl.addClass("jnr-trial-modal");
  modal.titleEl.setText("开始免费试用");
  modal.contentEl.createEl("p", {
    cls: "setting-item-description",
    text: `您正在使用纪念日 ${getTrialHoursLabel()}体验版。确认后将开始全功能试用，到期须激活才能继续管理事项。`,
  });
  modal.contentEl.createEl("p", {
    cls: "setting-item-description",
    text: "试用期间可随时输入激活码永久绑定本设备；纪念事项数据不会丢失。",
  });
  const row = modal.contentEl.createDiv({ cls: "lifeos-trial-actions" });
  const startBtn = row.createEl("button", { text: "开始试用", cls: "mod-cta lifeos-modal-primary" });
  const laterBtn = row.createEl("button", { text: "稍后再说" });
  const finish = async (start: boolean) => {
    if (start) {
      plugin.settings.trialWelcomeSeen = true;
      ensureTrialStarted(plugin.app, plugin.settings, true);
      await plugin.saveSettings();
      new Notice(`已开始 ${getTrialHoursLabel()} 试用`);
      plugin.refreshViews();
    }
    modal.close();
    onDone?.();
  };
  startBtn.onclick = () => void finish(true);
  laterBtn.onclick = () => void finish(false);
  modal.open();
}

export function checkTrialExpiryReminders(plugin: JinianriPlugin): void {
  if (!isTrialEdition() || plugin.settings.licenseActivated) return;
  if (plugin.settings.trialWelcomeSeen) ensureTrialStarted(plugin.app, plugin.settings, true);
  const remain = getTrialRemainingMs(plugin.app, plugin.settings);
  if (remain <= 0 && plugin.settings.trialStartedAt && plugin.settings.trialWelcomeSeen) {
    maybeShowTrialExpiredModal(plugin);
    return;
  }
  if (remain <= 0) return;
  const twoHours = 2 * 60 * 60 * 1000;
  const thirtyMin = 30 * 60 * 1000;
  if (remain <= twoHours && !plugin.settings.trialReminder2hSeen) {
    plugin.settings.trialReminder2hSeen = true;
    void plugin.saveSettings();
    maybeShowTrialRenewModal(plugin, remain, "2h");
  } else if (remain <= thirtyMin && !plugin.settings.trialReminder30mSeen) {
    plugin.settings.trialReminder30mSeen = true;
    void plugin.saveSettings();
    maybeShowTrialRenewModal(plugin, remain, "30m");
  }
}

function maybeShowTrialRenewModal(plugin: JinianriPlugin, remainMs: number, kind: "2h" | "30m"): void {
  injectLifeOsSharedStyles();
  const modal = new Modal(plugin.app);
  modal.modalEl.addClass("lifeos-modal");
  modal.titleEl.setText(kind === "30m" ? "试用即将结束" : "试用剩余不足 2 小时");
  modal.contentEl.createEl("p", {
    cls: "setting-item-description",
    text: `试用剩余 ${formatTrialRemaining(remainMs)}。到期后提醒与编辑将暂停，库内事项不会丢失。`,
  });
  const row = modal.contentEl.createDiv({ cls: "lifeos-trial-actions" });
  row.createEl("button", { text: "去激活", cls: "mod-cta lifeos-modal-primary" }).onclick = () => {
    modal.close();
    plugin.activateSidebar();
  };
  row.createEl("button", { text: "知道了" }).onclick = () => modal.close();
  modal.open();
}

function maybeShowTrialExpiredModal(plugin: JinianriPlugin): void {
  if (plugin.trialExpiredModalShown) return;
  if (!isTrialEdition() || isPluginAccessAllowed(plugin.app, plugin.settings)) return;
  plugin.trialExpiredModalShown = true;
  injectLifeOsSharedStyles();
  const modal = new Modal(plugin.app);
  modal.modalEl.addClass("lifeos-modal");
  modal.titleEl.setText("试用已到期");
  modal.contentEl.createEl("p", {
    cls: "setting-item-description",
    text: `${getTrialHoursLabel()}免费试用已结束。您的纪念事项均保留在库中，激活后即可继续使用。`,
  });
  const row = modal.contentEl.createDiv({ cls: "lifeos-trial-actions" });
  row.createEl("button", { text: "立即激活", cls: "mod-cta lifeos-modal-primary" }).onclick = () => {
    modal.close();
    plugin.activateSidebar();
  };
  row.createEl("button", { text: "稍后" }).onclick = () => modal.close();
  modal.open();
}

export async function startTrialFromActivationPanel(plugin: JinianriPlugin): Promise<void> {
  if (!isTrialEdition() || plugin.settings.licenseActivated || plugin.settings.trialWelcomeSeen) return;
  plugin.settings.trialWelcomeSeen = true;
  ensureTrialStarted(plugin.app, plugin.settings, true);
  await plugin.saveSettings();
  new Notice(`已开始 ${getTrialHoursLabel()} 试用`);
  plugin.refreshViews();
}

export function runJinianriTrialStartup(plugin: JinianriPlugin, onDone?: () => void): void {
  checkTrialExpiryReminders(plugin);
  onDone?.();
}
