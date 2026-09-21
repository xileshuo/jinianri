import { Platform } from "obsidian";

/** 移动端顶部下沉距离（设置页、更新日志等共用） */
export const MOBILE_TOP_INSET_PX = 41;

export function isMobileAppContext(app: { isMobile: boolean }): boolean {
  return app.isMobile || Platform.isMobileApp;
}

export const MOBILE_TOP_SPACER_CLASS = "jnr-mobile-top-spacer";

export function appendMobileTopSpacer(parent: HTMLElement): void {
  parent.createDiv({ cls: MOBILE_TOP_SPACER_CLASS });
}

export function mobileTopSpacerCss(): string {
  return `
.${MOBILE_TOP_SPACER_CLASS} {
  display: block;
  flex-shrink: 0;
  width: 100%;
  height: ${MOBILE_TOP_INSET_PX}px;
  min-height: ${MOBILE_TOP_INSET_PX}px;
  pointer-events: none;
}`;
}
