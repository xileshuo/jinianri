import { Modal, Notice } from "obsidian";
import type { CalendarType } from "./types";
import {
  getLunarLeapMonth,
  getLunarMonthDayCount,
  lunarMonthLabel,
} from "./date-utils";

export interface DateWheelValue {
  year: number;
  month: number;
  day: number;
  leapMonth?: boolean;
}

export interface DateWheelResult {
  date: string;
  leapMonth?: boolean;
}

export interface DateWheelAttachOptions {
  getDate: () => string;
  getType?: () => CalendarType;
  getLeapMonth?: () => boolean;
  onChange: (result: DateWheelResult) => void;
}

interface WheelItem {
  value: number;
  label: string;
}

function parseYmd(ymd: string, leapMonth = false): DateWheelValue {
  const [y, m, d] = ymd.split("-").map(Number);
  return {
    year: y || 2000,
    month: m || 1,
    day: d || 1,
    leapMonth: leapMonth || undefined,
  };
}

function formatYmd(v: DateWheelValue): string {
  const m = String(v.month).padStart(2, "0");
  const d = String(v.day).padStart(2, "0");
  return `${v.year}-${m}-${d}`;
}

function daysInSolarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function daysInValueMonth(v: DateWheelValue, type: CalendarType): number {
  if (type !== "lunar") return daysInSolarMonth(v.year, v.month);
  const count = getLunarMonthDayCount(v.year, v.month, v.leapMonth === true);
  return count > 0 ? count : 29;
}

function clampDay(v: DateWheelValue, type: CalendarType): DateWheelValue {
  const max = daysInValueMonth(v, type);
  return { ...v, day: Math.min(Math.max(1, v.day), max) };
}

function formatDateButtonLabel(
  date: string,
  type: CalendarType,
  leapMonth?: boolean
): string {
  if (type !== "lunar" || leapMonth !== true) return date;
  const month = Number(String(date).split("-")[1]);
  return `${date}（${lunarMonthLabel(month || 1, true)}）`;
}

export class DateWheelModal extends Modal {
  private type: CalendarType;
  private value: DateWheelValue;
  private onConfirm: (result: DateWheelResult) => void;
  private wheels!: {
    year: HTMLElement;
    month: HTMLElement;
    day: HTMLElement;
  };

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    initial: { date: string; type?: CalendarType; leapMonth?: boolean },
    onConfirm: (result: DateWheelResult) => void
  ) {
    super(app);
    this.type = initial.type === "lunar" ? "lunar" : "solar";
    this.value = clampDay(
      parseYmd(initial.date, this.type === "lunar" && initial.leapMonth === true),
      this.type
    );
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl, titleEl, modalEl } = this;
    contentEl.empty();
    titleEl.setText(this.type === "lunar" ? "选择农历日期" : "选择日期");
    modalEl.addClass("jnr-date-wheel-modal");

    const container = contentEl.createDiv({ cls: "jnr-date-wheel" });
    const cols = container.createDiv({ cls: "jnr-date-wheel-cols" });
    this.wheels = {
      year: this.buildWheel(cols, "年", this.yearRange(), this.value.year, (y) => {
        this.value.year = y;
        this.rebuildMonthWheel();
        this.rebuildDayWheel();
      }),
      month: this.buildWheel(
        cols,
        "月",
        this.monthRange(),
        this.monthWheelValue(),
        (m) => {
          this.value.month = Math.abs(m);
          this.value.leapMonth = this.type === "lunar" && m < 0;
          this.rebuildDayWheel();
        }
      ),
      day: this.buildWheel(cols, "日", this.dayRange(), this.value.day, (d) => {
        this.value.day = d;
      }),
    };

    this.syncWheels();

    if (this.type === "lunar") {
      contentEl.createDiv({
        cls: "jnr-date-wheel-hint",
        text: "农历月份含「闰×月」时，闰月生日请选带「闰」的那一项；农历某月只有 29 或 30 天。",
      });
    }

    const preview = contentEl.createDiv({ cls: "jnr-date-wheel-preview" });
    preview.setText(this.previewText());

    const btns = contentEl.createDiv({ cls: "jnr-modal-buttons" });
    btns
      .createEl("button", { text: "确定", cls: "mod-cta" })
      .addEventListener("click", () => this.submit());
    btns.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
  }

  private submit(): void {
    const max = daysInValueMonth(this.value, this.type);
    if (this.value.day > max) {
      const where =
        this.type === "lunar"
          ? `农历 ${this.value.year} 年${lunarMonthLabel(this.value.month, this.value.leapMonth === true)}`
          : `${this.value.year} 年 ${this.value.month} 月`;
      new Notice(`${where}只有 ${max} 天，请重新选择日期`);
      return;
    }
    this.onConfirm({
      date: formatYmd(this.value),
      leapMonth: this.type === "lunar" && this.value.leapMonth === true,
    });
    this.close();
  }

  private previewText(): string {
    const base = formatYmd(clampDay(this.value, this.type));
    if (this.type !== "lunar") return base;
    return `${base}（${lunarMonthLabel(this.value.month, this.value.leapMonth === true)}）`;
  }

  private monthWheelValue(): number {
    return this.value.leapMonth ? -this.value.month : this.value.month;
  }

  private yearRange(): WheelItem[] {
    const now = new Date().getFullYear();
    const years: WheelItem[] = [];
    for (let y = now + 5; y >= 1920; y--) years.push({ value: y, label: String(y) });
    return years;
  }

  /** 公历恒 1–12；农历在该年有闰月时插入「闰×月」（值取负） */
  private monthRange(): WheelItem[] {
    if (this.type !== "lunar") {
      return Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
      }));
    }
    const leap = getLunarLeapMonth(this.value.year);
    const items: WheelItem[] = [];
    for (let m = 1; m <= 12; m++) {
      items.push({ value: m, label: lunarMonthLabel(m, false) });
      if (leap === m) items.push({ value: -m, label: lunarMonthLabel(m, true) });
    }
    return items;
  }

  private dayRange(): WheelItem[] {
    const max = daysInValueMonth(this.value, this.type);
    return Array.from({ length: max }, (_, i) => ({
      value: i + 1,
      label: String(i + 1),
    }));
  }

  private buildWheel(
    parent: HTMLElement,
    label: string,
    items: WheelItem[],
    selected: number,
    onSelect: (v: number) => void
  ): HTMLElement {
    const col = parent.createDiv({ cls: "jnr-wheel-col" });
    col.createDiv({ cls: "jnr-wheel-label", text: label });

    const wrap = col.createDiv({ cls: "jnr-wheel-wrap" });
    wrap.createDiv({ cls: "jnr-wheel-highlight" });

    const list = wrap.createDiv({ cls: "jnr-wheel-list" });
    list.dataset.selected = String(selected);
    this.fillWheel(list, items, selected);

    list.addEventListener("scroll", () => {
      window.requestAnimationFrame(() => {
        const picked = this.getCenterValue(list);
        if (picked === null) return;
        list.querySelectorAll(".jnr-wheel-item").forEach((node) => {
          node.toggleClass("is-selected", node.getAttribute("data-value") === String(picked));
        });
        onSelect(picked);
        this.refreshPreview();
      });
    });

    return list;
  }

  private fillWheel(list: HTMLElement, items: WheelItem[], selected: number): void {
    list.empty();
    for (const item of items) {
      const el = list.createDiv({
        cls: "jnr-wheel-item",
        text: item.label,
        attr: { "data-value": String(item.value) },
      });
      if (item.value === selected) el.addClass("is-selected");
    }
  }

  private refreshPreview(): void {
    const preview = this.contentEl.querySelector(".jnr-date-wheel-preview");
    if (preview) preview.setText(this.previewText());
  }

  private getCenterValue(list: HTMLElement): number | null {
    const items = list.querySelectorAll<HTMLElement>(".jnr-wheel-item");
    if (!items.length) return null;
    const rect = list.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    let picked: number | null = null;
    let minDist = Infinity;
    items.forEach((item) => {
      const r = item.getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - center);
      if (dist < minDist) {
        minDist = dist;
        const raw = item.getAttribute("data-value");
        picked = raw === null ? null : parseInt(raw, 10);
      }
    });
    return picked !== null && Number.isFinite(picked) ? picked : null;
  }

  private scrollToSelected(list: HTMLElement, value: number): void {
    const item = list.querySelector(`[data-value="${value}"]`) as HTMLElement | null;
    if (!item) return;
    const offset = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
    list.scrollTop = offset;
  }

  private syncWheels(): void {
    window.requestAnimationFrame(() => {
      this.scrollToSelected(this.wheels.year, this.value.year);
      this.scrollToSelected(this.wheels.month, this.monthWheelValue());
      this.scrollToSelected(this.wheels.day, this.value.day);
    });
  }

  /** 换年后该农历年可能不再有原来的闰月，需要重建月轮盘 */
  private rebuildMonthWheel(): void {
    if (this.type !== "lunar" || !this.wheels?.month) return;
    if (this.value.leapMonth && getLunarLeapMonth(this.value.year) !== this.value.month) {
      this.value.leapMonth = false;
    }
    const items = this.monthRange();
    this.fillWheel(this.wheels.month, items, this.monthWheelValue());
    this.scrollToSelected(this.wheels.month, this.monthWheelValue());
  }

  private rebuildDayWheel(): void {
    if (!this.wheels?.day) return;
    const max = daysInValueMonth(this.value, this.type);
    if (this.value.day > max) this.value.day = max;
    this.fillWheel(this.wheels.day, this.dayRange(), this.value.day);
    this.scrollToSelected(this.wheels.day, this.value.day);
    this.refreshPreview();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** 创建可点击的日期按钮，点击弹出轮盘（支持农历闰月） */
export function attachDateWheelButton(
  appOrBtn: ConstructorParameters<typeof Modal>[0] | HTMLButtonElement,
  btnOrGetDate: HTMLButtonElement | (() => string),
  optionsOrOnChange?:
    | DateWheelAttachOptions
    | ((ymd: string) => void)
): { refresh: () => void } {
  // 兼容旧签名 attachDateWheelButton(btn, getDate, onChange)
  let app: ConstructorParameters<typeof Modal>[0];
  let btn: HTMLButtonElement;
  let options: DateWheelAttachOptions;

  if (typeof btnOrGetDate === "function") {
    btn = appOrBtn as HTMLButtonElement;
    app = (window as unknown as { app: ConstructorParameters<typeof Modal>[0] }).app;
    const getDate = btnOrGetDate;
    const onChange = optionsOrOnChange as (ymd: string) => void;
    options = {
      getDate,
      onChange: (result) => onChange(result.date),
    };
  } else {
    app = appOrBtn as ConstructorParameters<typeof Modal>[0];
    btn = btnOrGetDate;
    options = optionsOrOnChange as DateWheelAttachOptions;
  }

  btn.addClass("jnr-date-btn");
  const refresh = () => {
    const type = options.getType?.() ?? "solar";
    btn.setText(
      formatDateButtonLabel(options.getDate(), type, options.getLeapMonth?.())
    );
  };
  refresh();
  btn.addEventListener("click", () => {
    new DateWheelModal(
      app,
      {
        date: options.getDate(),
        type: options.getType?.() ?? "solar",
        leapMonth: options.getLeapMonth?.(),
      },
      (result) => {
        options.onChange(result);
        refresh();
      }
    ).open();
  });
  return { refresh };
}
