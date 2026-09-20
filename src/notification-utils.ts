import { Notice, Platform, type App } from "obsidian";
import { showReminderModal, type ReminderAlertEntry } from "./reminder-alert-modal";

function showDesktopNotification(title: string, body: string): boolean {
  if (!Platform.isDesktopApp) return false;

  try {
    const electron = require("electron") as {
      Notification: new (options: {
        title: string;
        body: string;
        silent?: boolean;
      }) => { show: () => void };
    };
    if (electron?.Notification) {
      new electron.Notification({ title, body, silent: false }).show();
      return true;
    }
  } catch {
    // fallback
  }

  if (typeof Notification !== "undefined") {
    if (Notification.permission === "default") {
      void Notification.requestPermission();
      return false;
    }
    if (Notification.permission === "granted") {
      new Notification(title, { body, silent: false });
      return true;
    }
  }
  return false;
}

export interface ReminderNoticeOptions {
  app?: App;
  obsidian?: boolean;
  desktop?: boolean;
}

/** 批量展示提醒；至少成功一种渠道则返回 true */
export function showReminderNotices(
  entries: ReminderAlertEntry[],
  options: ReminderNoticeOptions = {}
): boolean {
  const { app, obsidian = true, desktop = false } = options;
  if (entries.length === 0) return false;

  let shown = false;
  if (obsidian && app) {
    showReminderModal(app, entries);
    shown = true;
  }

  if (desktop && Platform.isDesktopApp) {
    const posted =
      entries.length === 1
        ? showDesktopNotification(entries[0].title, entries[0].body)
        : showDesktopNotification(
            `纪念日提醒 · ${entries.length} 条`,
            entries.map((e) => e.title).join("、")
          );
    if (posted) shown = true;
  }

  if (!shown) {
    new Notice("请先开启「库内弹窗」或「系统通知」", 5000);
  }
  return shown;
}

/** 单条提醒的便捷封装 */
export function showReminderNotice(
  title: string,
  body: string,
  options: ReminderNoticeOptions = {}
): boolean {
  return showReminderNotices([{ title, body }], options);
}
