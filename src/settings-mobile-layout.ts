import {
  appendMobileTopSpacer,
  isMobileAppContext,
} from "./mobile-top-inset";

/** 移动端设置页：safe-area + 41px 下沉，避开 Obsidian 固定顶栏（对齐 PlainLedger / BrainCore） */
export function applyMobileSettingsLayout(containerEl: HTMLElement, isMobile: boolean): void {
  document.querySelectorAll(".jnr-settings-mobile-host, .jnr-settings-host").forEach((el) => {
    el.removeClass("jnr-settings-mobile-host");
    el.removeClass("jnr-settings-host");
  });

  injectMobileSettingsStyles();

  const host =
    containerEl.closest(".vertical-tab-content") ??
    containerEl.closest(".vertical-tab-content-container") ??
    containerEl.parentElement;
  host?.addClass("jnr-settings-host");

  if (!isMobile) return;

  host?.addClass("jnr-settings-mobile-host");
  appendMobileTopSpacer(containerEl);
}

function injectMobileSettingsStyles(): void {
  return;
}

export { isMobileAppContext as isMobileSettingsContext };
