import { Platform } from "obsidian";

/** 侧边栏 / 全屏看板底部与顶栏交互提示 */
export function getSidebarInteractionHint(touchPreferred?: boolean): string {
  const touch = touchPreferred ?? Platform.isMobile;
  return touch
    ? "轻点折叠•拖动排序•轻点事项进设置"
    : "点击折叠•拖动排序•点击事项进设置";
}

export function getSidebarSettingsHintLines(): string[] {
  return [
    "进入 Obsidian 设置 → 纪念日 → 事项",
    "可增删改纪念事项",
  ];
}
