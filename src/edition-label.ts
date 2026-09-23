import { isLicenseEnforced, isTrialEdition } from "./license";

/** 个人版 / 公版 / 体验版标识（BrainCore 双版本对齐） */
export function getEditionLabel(settings?: { licenseActivated?: boolean }): string {
  // 体验包激活后按「公版」展示，避免标题仍写「48小时体验版」造成歧义
  if (isTrialEdition()) {
    if (settings?.licenseActivated) return "公版";
    return "48小时体验版";
  }
  return isLicenseEnforced() ? "公版" : "个人版";
}

export function renderEditionBadge(
  parent: HTMLElement,
  settings?: { licenseActivated?: boolean },
): void {
  const label = getEditionLabel(settings);
  const activated = !!settings?.licenseActivated;
  parent.createSpan({
    cls: "jnr-edition-badge",
    text: label,
    attr: {
      title: isTrialEdition()
        ? activated
          ? "已激活，按公版使用"
          : "48 小时全功能试用"
        : isLicenseEnforced()
          ? "需激活后使用全部功能"
          : "已内置授权，可直接使用",
    },
  });
}
