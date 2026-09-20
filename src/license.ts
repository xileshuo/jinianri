import type { App } from "obsidian";
import type { PluginSettings } from "./types";

declare const PLUGIN_REQUIRE_LICENSE: boolean | undefined;
declare const PLUGIN_TRIAL_HOURS: number | undefined;

export const LICENSE_FINGERPRINT_LABEL = "设备指纹";
export const LICENSE_FINGERPRINT_HINT =
  "基于 Obsidian appId，本设备一次激活永久有效（兼容旧版库名激活码）";

function isLicenseRequired(): boolean {
  return typeof PLUGIN_REQUIRE_LICENSE === "undefined" ? true : !!PLUGIN_REQUIRE_LICENSE;
}

export function isTrialEdition(): boolean {
  const hours = Number(typeof PLUGIN_TRIAL_HOURS !== "undefined" ? PLUGIN_TRIAL_HOURS : 0);
  return hours > 0 && isLicenseRequired();
}

export function getTrialHoursLabel(): string {
  const h = Number(typeof PLUGIN_TRIAL_HOURS !== "undefined" ? PLUGIN_TRIAL_HOURS : 0);
  return h > 0 ? `${h} 小时` : "";
}

export function formatTrialRemaining(ms: number): string {
  if (ms <= 0) return "0 分钟";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}

function getVaultScopedStorageKey(app: App, suffix: string): string {
  const vaultName = app.vault?.getName?.() || "UnknownVault";
  return `jinianri:${vaultName}:${suffix}`;
}

export function ensureTrialStarted(app: App, settings: PluginSettings, force = false): void {
  if (!isTrialEdition() || syncLicenseState(app, settings)) return;
  if (!force && !settings.trialWelcomeSeen) return;
  const storageKey = getVaultScopedStorageKey(app, "trialStartedAt");
  let started = settings.trialStartedAt || "";
  if (!started) {
    try { started = localStorage.getItem(storageKey) || ""; } catch { /* ignore */ }
  }
  if (!started) {
    started = new Date().toISOString();
    try { localStorage.setItem(storageKey, started); } catch { /* ignore */ }
  }
  if (settings.trialStartedAt !== started) settings.trialStartedAt = started;
}

export function getTrialRemainingMs(app: App, settings: PluginSettings): number {
  if (!isTrialEdition() || syncLicenseState(app, settings)) return 0;
  ensureTrialStarted(app, settings);
  const started = settings.trialStartedAt;
  if (!started) return 0;
  const elapsed = Date.now() - new Date(started).getTime();
  const total = Number(typeof PLUGIN_TRIAL_HOURS !== "undefined" ? PLUGIN_TRIAL_HOURS : 0) * 60 * 60 * 1000;
  return Math.max(0, total - elapsed);
}

export function isTrialActive(app: App, settings: PluginSettings): boolean {
  return isTrialEdition() && getTrialRemainingMs(app, settings) > 0;
}

export function isPluginAccessAllowed(app: App, settings: PluginSettings): boolean {
  if (!isLicenseRequired()) return true;
  if (syncLicenseState(app, settings)) return true;
  return isTrialActive(app, settings);
}

function hashStringToHex(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase();
}

/** 主指纹：优先 appId（同 BrainCore）；无 appId 时回退库名 */
export function getDeviceFingerprint(app: App): string {
  if (app.appId) return "JNR-" + hashStringToHex(String(app.appId));
  const vaultName = app.vault?.getName?.() || "UnknownVault";
  return "JNR-" + hashStringToHex(String(vaultName));
}

/** @deprecated 使用 getDeviceFingerprint */
export function getVaultFingerprint(app: App): string {
  return getDeviceFingerprint(app);
}

function computeExpectedLicenseKeyFromFingerprint(fp: string): string {
  let hash = 0;
  for (let i = 0; i < fp.length; i++) {
    hash = (hash << 5) - hash + fp.charCodeAt(i);
    hash |= 0;
  }
  return "KEY-" + Math.abs(hash ^ 0x8899).toString(16).toUpperCase();
}

function getExpectedLicenseKeys(app: App): Set<string> {
  const keys = new Set<string>();
  keys.add(computeExpectedLicenseKeyFromFingerprint(getDeviceFingerprint(app)));
  const vaultName = app.vault?.getName?.() || "UnknownVault";
  keys.add(computeExpectedLicenseKeyFromFingerprint("JNR-" + hashStringToHex(String(vaultName))));
  return keys;
}

export function computeExpectedLicenseKey(app: App): string {
  return computeExpectedLicenseKeyFromFingerprint(getDeviceFingerprint(app));
}

export function isLicenseValid(app: App, key: string | undefined): boolean {
  if (!key || !String(key).trim()) return false;
  const normalized = String(key).trim().toUpperCase();
  for (const expected of getExpectedLicenseKeys(app)) {
    if (normalized === expected) return true;
  }
  return false;
}

export function syncLicenseState(app: App, settings: PluginSettings): boolean {
  if (!isLicenseRequired()) {
    settings.licenseActivated = true;
    return true;
  }
  const ok = isLicenseValid(app, settings.licenseKey);
  settings.licenseActivated = ok;
  return ok;
}

export function isPluginLicensed(app: App, settings: PluginSettings): boolean {
  return isPluginAccessAllowed(app, settings);
}

export function isLicenseEnforced(): boolean {
  return isLicenseRequired();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
