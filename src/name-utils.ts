/** 从名称中拆分 emoji 图标与文字 */
const EMOJI_RE =
  /^((?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)+)\s*(.*)$/u;

export function parseEventName(name: string): { icon: string; label: string } {
  const match = name.match(EMOJI_RE);
  if (match) {
    return { icon: match[1], label: match[2].trim() || "未命名" };
  }
  return { icon: "📅", label: name.trim() || "未命名" };
}

export function combineEventName(icon: string, label: string): string {
  const i = icon.trim();
  const l = label.trim();
  if (i && l) return `${i} ${l}`;
  return i || l || "未命名";
}
