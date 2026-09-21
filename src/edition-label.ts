import { isLicenseEnforced, isTrialEdition } from "./license";

/** 个人版 / 公版 / 体验版标识（BrainCore 双版本对齐） */
export function getEditionLabel(): string {
  if (isTrialEdition()) return "48小时体验版";
  return isLicenseEnforced() ? "公版" : "个人版";
}

export function renderEditionBadge(parent: HTMLElement): void {
  const label = getEditionLabel();
  parent.createSpan({
    cls: "jnr-edition-badge",
    text: label,
    attr: {
      title: isTrialEdition()
        ? "48 小时全功能试用"
        : isLicenseEnforced()
          ? "需激活后使用全部功能"
          : "已内置授权，可直接使用",
    },
  });
}
