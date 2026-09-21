import { Notice } from "obsidian";
import type JinianriPlugin from "./main";
import {
  copyTextToClipboard,
  getDeviceFingerprint,
  getTrialHoursLabel,
  getTrialRemainingMs,
  isTrialActive,
  isTrialEdition,
  syncLicenseState,
  formatTrialRemaining,
} from "./license";
import { openUsageGuideInNewTab } from "./usage-guide";
import { injectLifeOsActivationStyles, renderLifeOsActivationPanel } from "./lifeos-suite";
import { startTrialFromActivationPanel } from "./lifeos-trial";

declare const PLUGIN_DISPLAY_NAME: string | undefined;

const PLUGIN_PHILOSOPHY =
  "记录生日、恋爱、婚姻等重要日期，自动计算「已过时长」与「距离下次还有几天」，支持三档提醒与 iCal 导出。";

function getPluginDisplayName(): string {
  return typeof PLUGIN_DISPLAY_NAME === "string" && PLUGIN_DISPLAY_NAME ? PLUGIN_DISPLAY_NAME : "纪念日";
}

function getActivationStatusText(plugin: JinianriPlugin): string {
  if (isTrialEdition() && isTrialActive(plugin.app, plugin.settings)) {
    return `试用中 · 剩余 ${formatTrialRemaining(getTrialRemainingMs(plugin.app, plugin.settings))}`;
  }
  if (isTrialEdition() && plugin.settings.trialWelcomeSeen && getTrialRemainingMs(plugin.app, plugin.settings) <= 0) {
    return `${getTrialHoursLabel()}试用已到期，请输入激活码`;
  }
  return "";
}

export function renderActivationPanel(container: HTMLElement, plugin: JinianriPlugin): void {
  renderLifeOsActivationPanel(container, {
    extraPanelClass: "jnr-activation-panel",
    pluginName: getPluginDisplayName(),
    philosophy: PLUGIN_PHILOSOPHY,
    getStatusText: () => getActivationStatusText(plugin),
    showTrialButton: isTrialEdition() && !plugin.settings.trialWelcomeSeen && !plugin.settings.licenseActivated,
    trialButtonLabel: `开启 ${getTrialHoursLabel()} 试用`,
    onTrialStart: () => startTrialFromActivationPanel(plugin),
    getFingerprint: () => getDeviceFingerprint(plugin.app),
    licenseKey: plugin.settings.licenseKey,
    activateShortLabel: "激活",
    onCopyFingerprint: async (fp) => {
      const ok = await copyTextToClipboard(fp);
      new Notice(ok ? "设备指纹已复制" : "请手动全选复制指纹");
    },
    onActivate: async (key, msgEl) => {
      if (!key) {
        msgEl.setText("请输入激活码");
        msgEl.addClass("error");
        return;
      }
      msgEl.removeClass("error");
      plugin.settings.licenseKey = key;
      syncLicenseState(plugin.app, plugin.settings);
      if (plugin.settings.licenseActivated) {
        await plugin.saveSettings();
        new Notice("激活成功，之后将永久有效");
        plugin.onLicenseActivated();
      } else {
        plugin.settings.licenseActivated = false;
        await plugin.saveSettings();
        msgEl.setText("激活码不正确，请核对后再试");
        msgEl.addClass("error");
      }
    },
    openUsageGuide: () => openUsageGuideInNewTab(plugin.app),
    updateNoticeTarget: plugin,
    openSettings: () => plugin.openSettingsTab(),
  });
}

export function injectActivationPanelStyles(): void {
  injectLifeOsActivationStyles();
}
