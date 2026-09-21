import type { GroupDef, PluginSettings } from "./types";
import {
  DEFAULT_GROUPS,
  DEFAULT_GROUP_ORDER,
  generateGroupId,
  LEGACY_GROUP_LABELS,
} from "./types";

export function migrateGroupSettings(settings: PluginSettings): void {
  if (!Array.isArray(settings.groups) || settings.groups.length === 0) {
    const legacyLabels = settings.groupLabels ?? {};
    settings.groups = DEFAULT_GROUPS.map((g) => ({
      id: g.id,
      label: legacyLabels[g.id]?.trim() || g.label,
    }));
  }

  if (!Array.isArray(settings.groupOrder) || settings.groupOrder.length === 0) {
    settings.groupOrder = settings.groups.map((g) => g.id);
  }

  for (const g of settings.groups) {
    if (!settings.groupOrder.includes(g.id)) {
      settings.groupOrder.push(g.id);
    }
  }

  settings.groupOrder = settings.groupOrder.filter((id) =>
    settings.groups.some((g) => g.id === id)
  );

  for (const g of settings.groups) {
    if (!settings.groupOrder.includes(g.id)) {
      settings.groupOrder.push(g.id);
    }
  }

  if (typeof settings.reminderMinute !== "number") {
    settings.reminderMinute = 0;
  }
  if (typeof settings.lastReminderCheckDate !== "string") {
    settings.lastReminderCheckDate = "";
  }
  if (settings.enableObsidianNotice === undefined) {
    settings.enableObsidianNotice = true;
  }
}

export function getGroupLabelFromSettings(settings: PluginSettings, groupId: string): string {
  const found = settings.groups.find((g) => g.id === groupId);
  if (found?.label.trim()) return found.label.trim();
  return LEGACY_GROUP_LABELS[groupId] ?? groupId;
}

export function addGroup(settings: PluginSettings, label: string): GroupDef {
  const trimmed = label.trim() || "新分组";
  const def: GroupDef = { id: generateGroupId(), label: trimmed };
  settings.groups.push(def);
  settings.groupOrder.push(def.id);
  return def;
}

export function updateGroupLabel(settings: PluginSettings, id: string, label: string): void {
  const g = settings.groups.find((x) => x.id === id);
  if (g) g.label = label.trim() || g.label;
}

export function deleteGroup(settings: PluginSettings, id: string): string | null {
  if (settings.groups.length <= 1) return null;
  const fallback = settings.groups.find((g) => g.id !== id)?.id ?? "other";
  settings.groups = settings.groups.filter((g) => g.id !== id);
  settings.groupOrder = settings.groupOrder.filter((g) => g !== id);
  settings.collapsedGroups = settings.collapsedGroups.filter((g) => g !== id);
  return fallback;
}

export function ensureEventGroup(groupId: string, settings: PluginSettings): string {
  if (settings.groups.some((g) => g.id === groupId)) return groupId;
  const legacy = LEGACY_GROUP_LABELS[groupId];
  if (legacy) {
    settings.groups.push({ id: groupId, label: legacy });
    if (!settings.groupOrder.includes(groupId)) settings.groupOrder.push(groupId);
    return groupId;
  }
  return settings.groups[0]?.id ?? DEFAULT_GROUP_ORDER[0];
}

export function groupSortIndex(settings: PluginSettings, groupId: string): number {
  const idx = settings.groupOrder.indexOf(groupId);
  return idx >= 0 ? idx : 999;
}
