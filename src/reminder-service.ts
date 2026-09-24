import type JinianriPlugin from "./main";
import { Notice, Platform } from "obsidian";
import { computeAll, formatYmd } from "./date-utils";
import { showReminderNotices } from "./notification-utils";
import {
  buildTierReminderMessage,
  buildTodayReminderMessage,
} from "./reminder-messages";

const DAY_MS = 86_400_000;

export class ReminderService {
  private plugin: JinianriPlugin;
  private intervalId: number | null = null;
  /** 「请先开启提醒渠道」当天只提示一次 */
  private noChannelNoticeDay = "";
  /** 「今天已经提醒过」说明当天只提示一次 */
  private alreadySentHintDay = "";

  constructor(plugin: JinianriPlugin) {
    this.plugin = plugin;
  }

  start(): void {
    this.stop();
    this.checkReminders();
    this.intervalId = window.setInterval(() => {
      if (!this.plugin.isPluginAlive()) return;
      this.checkReminders();
    }, 60_000);
    this.plugin.registerInterval(this.intervalId);
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.noChannelNoticeDay = "";
    this.alreadySentHintDay = "";
  }

  /** 改了检查时间后允许立刻按新时间再判一次 */
  resetTodayCheck(): void {
    this.noChannelNoticeDay = "";
    this.alreadySentHintDay = "";
  }

  checkReminders(force = false): void {
    if (!this.plugin.isLicensed()) return;
    const now = new Date();
    const today = formatYmd(now);
    const { settings } = this.plugin;

    if (!force) {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const targetMins = settings.reminderHour * 60 + settings.reminderMinute;
      if (nowMins < targetMins && !this.missedFullDay(now, today)) return;
    }

    const pending = this.collectPending();
    if (pending.length === 0) {
      void this.recordCheckDate(today);
      if (this.hasTodayAlreadySent(today) && this.alreadySentHintDay !== today) {
        this.alreadySentHintDay = today;
        new Notice(
          "今天的纪念日已经提醒过了。若当时没看到弹窗（常被设置页挡住），请到设置 → 提醒点「再弹今天」。",
          8000
        );
      }
      return;
    }

    const obsidian = settings.enableObsidianNotice;
    const desktop = settings.enableDesktopNotification && Platform.isDesktopApp;
    if (!obsidian && !desktop) {
      if (this.noChannelNoticeDay !== today) {
        this.noChannelNoticeDay = today;
        new Notice("请先开启「库内弹窗」或「系统通知」", 5000);
      }
      return;
    }

    const shown = showReminderNotices(pending, {
      app: this.plugin.app,
      obsidian,
      desktop,
    });
    if (!shown) return;
    void this.markRemindersSent(
      pending.map((p) => p.key),
      today
    );
  }

  /**
   * lastReminderCheckDate 既不是今天也不是昨天 = 至少整整一天没检查过，
   * 这时不等设定时间就先补检一轮。首次安装（字段为空）仍按设定时间来。
   */
  missedFullDay(now: Date, today: string): boolean {
    const last = this.plugin.settings.lastReminderCheckDate;
    if (!last) return false;
    if (last === today) return false;
    return last !== formatYmd(new Date(now.getTime() - DAY_MS));
  }

  /**
   * 挑出该发的提醒：
   * - 档位用窗口匹配（daysUntil <= tier.days），错过当天之后打开也能补发
   * - 按天数升序，只发最紧的那一档，避免 30/15/7 同时补三条
   */
  collectPending(): Array<{ key: string; title: string; body: string }> {
    const { settings } = this.plugin;
    const computed = computeAll(this.plugin.events);
    const sent = new Set(settings.sentReminderKeys);
    const pending: Array<{ key: string; title: string; body: string }> = [];
    const tiers = settings.reminderTiers
      .filter((t) => t.enabled && t.days > 0)
      .sort((a, b) => a.days - b.days);

    for (const item of computed) {
      if (!item.event.remindersEnabled) continue;

      if (item.isToday) {
        const key = `${item.event.id}:today:${formatYmd(item.nextDate)}`;
        if (sent.has(key)) continue;
        const msg = buildTodayReminderMessage(item);
        pending.push({ key, title: msg.title, body: msg.body });
        continue;
      }

      if (item.isElapsed && !settings.remindElapsedAnniversary) continue;
      if (item.daysUntil < 0) continue;

      for (const tier of tiers) {
        if (item.daysUntil > tier.days) continue;
        const key = `${item.event.id}:${tier.days}:${formatYmd(item.nextDate)}`;
        if (!sent.has(key)) {
          const msg = buildTierReminderMessage(item, tier);
          pending.push({ key, title: msg.title, body: msg.body });
        }
        break;
      }
    }
    return pending;
  }

  /** 展示即记发，避免关库没点确认导致同日重弹 */
  async markRemindersSent(keys: string[], today: string): Promise<void> {
    const { settings } = this.plugin;
    const merged = [...settings.sentReminderKeys];
    for (const key of keys) {
      if (!merged.includes(key)) merged.push(key);
    }
    settings.sentReminderKeys = merged.slice(-500);
    settings.lastReminderCheckDate = today;
    await this.persist();
  }

  async recordCheckDate(today: string): Promise<void> {
    if (this.plugin.settings.lastReminderCheckDate === today) return;
    this.plugin.settings.lastReminderCheckDate = today;
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await this.plugin.saveSettings();
    } catch (err) {
      console.error("[纪念日] 提醒状态保存失败", err);
    }
  }

  pruneSentKeys(): void {
    const validPrefixes = new Set(this.plugin.events.map((e) => e.id));
    this.plugin.settings.sentReminderKeys =
      this.plugin.settings.sentReminderKeys.filter((key) => {
        const eventId = key.split(":")[0];
        return validPrefixes.has(eventId);
      });
  }

  /** 今天的「就是今天」已经记为发过 */
  hasTodayAlreadySent(today: string): boolean {
    const suffix = `:today:${today}`;
    return this.plugin.settings.sentReminderKeys.some((key) =>
      key.endsWith(suffix)
    );
  }

  /** 清掉今天的已读并立刻再弹（设置页挡住弹窗时用） */
  replayTodayReminders(): void {
    if (!this.plugin.isLicensed()) {
      new Notice("请先激活后再试");
      return;
    }
    const today = formatYmd(new Date());
    const suffix = `:today:${today}`;
    const before = this.plugin.settings.sentReminderKeys.length;
    this.plugin.settings.sentReminderKeys =
      this.plugin.settings.sentReminderKeys.filter(
        (key) => !key.endsWith(suffix)
      );
    this.alreadySentHintDay = "";
    this.noChannelNoticeDay = "";

    // 设置页会挡住库内弹窗：先关设置，再检查
    try {
      this.plugin.app.setting?.close?.();
    } catch {
      /* ignore */
    }

    void this.plugin.saveSettings().then(() => {
      window.setTimeout(() => {
        const pendingBefore = this.collectPending();
        if (pendingBefore.length === 0) {
          new Notice(
            before === this.plugin.settings.sentReminderKeys.length
              ? "今天没有需要再弹的纪念日提醒（没有「就是今天」的事项，或提醒已关）"
              : "已清除今日「已提醒」标记，但当前没有待提醒事项",
            5000
          );
          return;
        }
        this.checkReminders(true);
      }, 120);
    });
  }

  /** 后台挂起跨日后回到前台，再检查一轮未发过的提醒 */
  onDayMayHaveChanged(): void {
    this.checkReminders();
  }
}
