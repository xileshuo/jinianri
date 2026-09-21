import {
  MOBILE_TOP_INSET_PX,
  MOBILE_TOP_SPACER_CLASS,
  appendMobileTopSpacer,
  isMobileAppContext,
  mobileTopSpacerCss,
} from "./mobile-top-inset";

const MOBILE_STYLE_ID = "jnr-settings-mobile-styles-v15";

/** 移动端设置页：safe-area + 41px 下沉，避开 Obsidian 固定顶栏（对齐 PlainLedger / BrainCore） */
export function applyMobileSettingsLayout(containerEl: HTMLElement, isMobile: boolean): void {
  document.querySelectorAll(".jnr-settings-mobile-host").forEach((el) => {
    el.removeClass("jnr-settings-mobile-host");
  });

  if (!isMobile) return;

  injectMobileSettingsStyles();

  const host =
    containerEl.closest(".vertical-tab-content") ??
    containerEl.closest(".vertical-tab-content-container") ??
    containerEl.parentElement;
  host?.addClass("jnr-settings-mobile-host");

  appendMobileTopSpacer(containerEl);
}

function injectMobileSettingsStyles(): void {
  if (document.getElementById(MOBILE_STYLE_ID)) return;
  for (const id of [
    "jnr-settings-mobile-styles-v1",
    "jnr-settings-mobile-styles-v8",
    "jnr-settings-mobile-styles-v9",
    "jnr-settings-mobile-styles-v10",
    "jnr-settings-mobile-styles-v13",
    "jnr-settings-mobile-styles-v14",
  ]) {
    document.getElementById(id)?.remove();
  }

  const style = document.createElement("style");
  style.id = MOBILE_STYLE_ID;
  style.textContent = `
.is-mobile .vertical-tab-content.jnr-settings-mobile-host,
.is-mobile .vertical-tab-content-container.jnr-settings-mobile-host {
  padding-top: env(safe-area-inset-top, 0px) !important;
  box-sizing: border-box !important;
}
.jnr-settings-mobile {
  padding-top: 0 !important;
  padding-inline: max(12px, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px)) !important;
  padding-bottom: max(16px, env(safe-area-inset-bottom, 0px)) !important;
  box-sizing: border-box !important;
  overflow-x: hidden !important;
  overscroll-behavior-x: none;
  touch-action: pan-y;
  max-width: 100% !important;
}
${mobileTopSpacerCss()}
.jnr-settings-mobile .${MOBILE_TOP_SPACER_CLASS} {
  display: block;
  width: 100%;
  height: ${MOBILE_TOP_INSET_PX}px;
  min-height: ${MOBILE_TOP_INSET_PX}px;
  margin-bottom: 0;
}
.jnr-settings-mobile .setting-item {
  justify-content: space-between !important;
  min-width: 0 !important;
  max-width: 100% !important;
}
.jnr-settings-compact .jnr-settings-action-row,
.jnr-settings-mobile .jnr-settings-action-row {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  width: 100% !important;
}
.jnr-settings-compact .jnr-settings-action-row .setting-item-info,
.jnr-settings-mobile .jnr-settings-action-row .setting-item-info {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
}
.jnr-settings-compact .jnr-settings-action-row .setting-item-control,
.jnr-settings-mobile .jnr-settings-action-row .setting-item-control {
  flex: 0 0 auto !important;
  width: auto !important;
  margin-left: auto !important;
  justify-content: flex-end !important;
}
.jnr-settings-mobile .setting-item:not(:has(input)):not(:has(select)):not(:has(textarea)):not(:has(.checkbox-container)) .setting-item-info {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
}
.jnr-settings-mobile .setting-item:not(:has(input)):not(:has(select)):not(:has(textarea)):not(:has(.checkbox-container)) .setting-item-control {
  flex: 0 0 auto !important;
  width: auto !important;
  margin-left: auto !important;
}
.jnr-settings-mobile .jnr-settings-actions-row {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 8px 12px !important;
}
.jnr-settings-mobile .jnr-settings-actions-row button {
  width: auto !important;
  flex: 0 0 auto !important;
}
.jnr-settings-mobile .setting-item-control {
  margin-left: auto !important;
}
.jnr-settings-mobile .setting-item-control button {
  margin-left: auto !important;
  margin-right: 0 !important;
}
.jnr-settings-mobile .jnr-settings-tab-bar {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
  width: 100% !important;
  margin-top: 8px !important;
  margin-bottom: 14px !important;
  justify-content: stretch !important;
}
.jnr-settings-mobile .jnr-settings-tab-bar button {
  flex: 1 1 auto !important;
  min-width: 4.5em !important;
  min-height: 44px !important;
  width: auto !important;
  text-align: center !important;
  padding: 8px 8px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  white-space: nowrap !important;
}
.jnr-settings-mobile .jnr-settings-tab-bar button.mod-cta {
  font-weight: 700 !important;
}
.is-mobile .jnr-update-modal-mobile.modal {
  padding-top: 0 !important;
  box-sizing: border-box !important;
  max-height: calc(100dvh - 12px) !important;
}
.is-mobile .jnr-update-modal-mobile .modal-close-button {
  top: calc(env(safe-area-inset-top, 0px) + 41px - 22px) !important;
  top: max(10px, calc(env(safe-area-inset-top, 0px) + 19px)) !important;
  right: max(8px, env(safe-area-inset-right, 0px)) !important;
  width: 44px !important;
  height: 44px !important;
  opacity: 1 !important;
}
.is-mobile .jnr-update-modal-mobile .modal-content {
  max-height: calc(100dvh - 12px) !important;
}
.is-mobile .jnr-update-modal-mobile .jnr-update-wrap {
  max-height: calc(100dvh - 12px) !important;
}
`;
  document.head.appendChild(style);
}

export { isMobileAppContext as isMobileSettingsContext };
