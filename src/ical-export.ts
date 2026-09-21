import { normalizePath, Notice, Platform, TFile } from "obsidian";
import type { App } from "obsidian";
import type { AnniversaryComputed, AnniversaryEvent, PluginSettings } from "./types";
import { getNextOccurrence } from "./date-utils";
import { parseEventName } from "./name-utils";
import { getPluginIcsPath } from "./plugin-paths";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatIcsDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatIcsDateTimeUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildIcsContent(
  events: AnniversaryEvent[],
  getComputed: (event: AnniversaryEvent) => AnniversaryComputed,
  settings: PluginSettings
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Obsidian//Jinianri//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:纪念日",
  ];

  const dtstamp = formatIcsDateTimeUtc(new Date());

  for (const event of events) {
    const computed = getComputed(event);
    const { label } = parseEventName(event.name);
    const summary = escapeIcs(label || event.name);

    const appendEvent = (occurrence: Date, uidSuffix: string, withYearly = false) => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:jinianri-${event.id}-${uidSuffix}@obsidian`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(occurrence)}`);
      if (withYearly) lines.push("RRULE:FREQ=YEARLY");
      lines.push(`SUMMARY:${summary}`);
      const daysUntil = Math.round(
        (startOfDay(occurrence).getTime() - startOfDay(new Date()).getTime()) / 86400000
      );
      const descParts = [
        `${event.type === "lunar" ? "阴历" : "阳历"} ${event.date}${
          event.type === "lunar" && event.leapMonth ? "（闰月）" : ""
        }`,
        daysUntil === 0 ? "就是今天" : `还有 ${daysUntil} 天`,
      ];
      if (event.notes) descParts.push(event.notes);
      lines.push(`DESCRIPTION:${escapeIcs(descParts.join(" · "))}`);
      if (event.remindersEnabled) {
        for (const tier of settings.reminderTiers) {
          if (!tier.enabled || tier.days <= 0) continue;
          lines.push("BEGIN:VALARM");
          lines.push("ACTION:DISPLAY");
          lines.push(`DESCRIPTION:${escapeIcs(`${summary} · ${tier.label}`)}`);
          lines.push(`TRIGGER:-P${tier.days}D`);
          lines.push("END:VALARM");
        }
      }
      lines.push("END:VEVENT");
    };

    if (event.type === "lunar") {
      const baseYear = new Date().getFullYear();
      for (let i = 0; i < 30; i += 1) {
        const ref = new Date(baseYear + i, 0, 1);
        const occurrence = getNextOccurrence(event, ref);
        appendEvent(occurrence, String(baseYear + i), false);
      }
      continue;
    }

    appendEvent(computed.nextDate, "yearly", true);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function exportIcsToVault(
  app: App,
  events: AnniversaryEvent[],
  getComputed: (event: AnniversaryEvent) => AnniversaryComputed,
  _settings: PluginSettings,
  icsPath?: string
): Promise<TFile | { path: string }> {
  const path = normalizePath(icsPath ?? getPluginIcsPath(app));
  const content = buildIcsContent(events, getComputed, _settings);

  const folder = path.split("/").slice(0, -1).join("/");
  if (folder) await app.vault.adapter.mkdir(normalizePath(folder)).catch(() => {});

  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }

  const adapter = app.vault.adapter;
  if (await adapter.exists(path)) {
    await adapter.write(path, content);
    return { path };
  }

  try {
    return await app.vault.create(path, content);
  } catch {
    await adapter.write(path, content);
    return { path };
  }
}

export function showIcsExportNotice(path: string): void {
  let hint: string;
  if (Platform.isMacOS) {
    hint = "macOS：在「日历」→ 文件 → 导入，或双击 .ics 文件";
  } else if (Platform.isMobile) {
    hint = "可将 .ics 文件分享到系统日历 App";
  } else {
    hint = "可用系统日历或 Outlook 等应用导入 .ics 文件";
  }
  new Notice(`已导出 ${path}\n${hint}`, 10_000);
}
