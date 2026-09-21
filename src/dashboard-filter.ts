import type { AnniversaryComputed } from "./types";

/** 看板筛选：全部 / 分组 ID */
export function applyDashboardFilter(
  items: AnniversaryComputed[],
  filter: string
): AnniversaryComputed[] {
  const key = String(filter || "all");
  if (key === "all") return items;
  return items.filter((i) => i.event.group === key);
}

export function buildFilterOptions(
  groupOrder: string[],
  getGroupLabel: (id: string) => string
): { value: string; label: string }[] {
  const options = [{ value: "all", label: "全部" }];
  for (const gid of groupOrder) {
    options.push({ value: gid, label: getGroupLabel(gid) });
  }
  return options;
}
