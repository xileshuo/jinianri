import { HolidayUtil, Solar } from "lunar-javascript";

export function getLunarDayLabel(date: Date): string {
  const lunar = Solar.fromYmd(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  ).getLunar();
  if (lunar.getDay() === 1) return `${lunar.getMonthInChinese()}月`;
  return lunar.getDayInChinese();
}

function getHolidayDuty(date: Date): { duty: "work" | "rest" | null; name: string } {
  const h = HolidayUtil.getHoliday(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  if (!h) return { duty: null, name: "" };
  const raw = String(h.getName() || "")
    .replace(/节$/, "")
    .replace(/调休$/, "")
    .replace(/中秋$/, "中秋");
  if (h.isWork()) return { duty: "work", name: "班" };
  const short = raw.length > 3 ? raw.slice(0, 2) : raw;
  return { duty: "rest", name: short || "休" };
}

export function getFestivalLabel(date: Date): string {
  const solar = Solar.fromYmd(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  const lunar = solar.getLunar();
  const festivals = [
    ...(solar.getFestivals() || []),
    ...(lunar.getFestivals() || []),
  ].filter(Boolean);
  if (!festivals.length) return "";
  const f = String(festivals[0]).replace(/节$/, "");
  return f.length > 3 ? f.slice(0, 2) : f;
}

export function getCalSubLabel(date: Date): string {
  const { duty, name } = getHolidayDuty(date);
  if (duty === "work") return "班";
  if (duty === "rest" && name) return name;
  const fest = getFestivalLabel(date);
  if (fest) return fest;
  return getLunarDayLabel(date);
}

export function isWeekendDate(date: Date): boolean {
  if (getHolidayDuty(date).duty === "work") return false;
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

export function isHolidayDate(date: Date): boolean {
  if (getHolidayDuty(date).duty === "rest") return true;
  return !!getFestivalLabel(date);
}

export function isWorkdayDate(date: Date): boolean {
  return getHolidayDuty(date).duty === "work";
}
