import { Notice, TFile, normalizePath } from "obsidian";
import type JinianriPlugin from "./main";
import { showConfirm } from "./confirm-modal";
import type { AnniversaryEvent, VaultAnniversaryData } from "./types";
import { normalizeEvent } from "./types";
import {
  getLegacyCombinedDataPath,
  getPluginEventsPath,
  openPluginConfigFile,
  LEGACY_VAULT_DATA_FILES,
} from "./plugin-paths";
import {
  createDefaultVaultData,
  inferGroup,
  parseMarkdownAnniversaries,
  SAMPLE_EVENTS,
} from "./vault-data";

const MD_SOURCE = "Life/纪念日.md";

export class DataStore {
  private plugin: JinianriPlugin;
  private saving = false;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(plugin: JinianriPlugin) {
    this.plugin = plugin;
  }

  getEventsPath(): string {
    return getPluginEventsPath(this.plugin.app);
  }

  /** @deprecated 使用 getEventsPath */
  getDataPath(): string {
    return this.getEventsPath();
  }

  async load(): Promise<AnniversaryEvent[]> {
    const eventsPath = this.getEventsPath();
    const primary = await this.readEventsFile(eventsPath);
    if (primary.status === "ok") return primary.events;
    // 损坏：已 Notice + 备份，绝不自动写 SAMPLE_EVENTS 覆盖用户文件
    if (primary.status === "corrupt") return [];

    const legacyCombined = getLegacyCombinedDataPath(this.plugin.app);
    if (legacyCombined !== eventsPath) {
      const legacy = await this.readEventsFile(legacyCombined);
      if (legacy.status === "ok") {
        await this.writeEvents(eventsPath, legacy.events);
        return legacy.events;
      }
    }

    for (const legacy of LEGACY_VAULT_DATA_FILES) {
      const legacyPath = normalizePath(legacy);
      const hit = await this.readEventsFile(legacyPath);
      if (hit.status === "ok") {
        await this.writeEvents(eventsPath, hit.events);
        return hit.events;
      }
    }

    const fromPluginData = await this.migrateLegacyPluginData();
    if (fromPluginData.length > 0) {
      await this.writeEvents(eventsPath, fromPluginData);
      return fromPluginData;
    }

    const fromMd = await this.importFromMarkdown(false);
    if (fromMd.length > 0) {
      await this.writeEvents(eventsPath, fromMd);
      return fromMd;
    }

    const defaults = SAMPLE_EVENTS.map((e) => ({ ...e }));
    await this.writeEvents(eventsPath, defaults);
    return defaults;
  }

  /** ok=解析成功；missing=文件不存在；corrupt=存在但损坏（已 Notice + 备份，勿写示例覆盖） */
  private async readEventsFile(
    path: string,
  ): Promise<{ status: "ok"; events: AnniversaryEvent[] } | { status: "missing" } | { status: "corrupt" }> {
    const adapter = this.plugin.app.vault.adapter;
    const exists =
      this.plugin.app.vault.getAbstractFileByPath(path) instanceof TFile ||
      (await adapter.exists(path));
    if (!exists) return { status: "missing" };

    const backupCorrupt = async (raw: string) => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = normalizePath(`${path}.corrupt-${stamp}.bak`);
      try {
        await adapter.write(backupPath, raw);
        new Notice(`events.json 已损坏，已备份为 ${backupPath.split("/").pop()}，未覆盖原文件`);
      } catch {
        new Notice("events.json 已损坏，备份失败；原文件未改动，请手动检查");
      }
    };

    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    try {
      const raw =
        file instanceof TFile
          ? await this.plugin.app.vault.read(file)
          : await adapter.read(path);
      let parsed: VaultAnniversaryData;
      try {
        parsed = JSON.parse(raw) as VaultAnniversaryData;
      } catch {
        await backupCorrupt(raw);
        return { status: "corrupt" };
      }
      if (!Array.isArray(parsed.events)) {
        await backupCorrupt(raw);
        return { status: "corrupt" };
      }
      return { status: "ok", events: parsed.events.map((e) => normalizeEvent(e)) };
    } catch {
      new Notice("纪念日数据读取失败，请在设置 → 数据 → events.json 检查文件格式");
      return { status: "corrupt" };
    }
  }

  async save(events: AnniversaryEvent[]): Promise<void> {
    if (this.saving) {
      await this.saveQueue;
      return this.save(events);
    }
    this.saving = true;
    this.saveQueue = this.doSave(events).finally(() => {
      this.saving = false;
    });
    return this.saveQueue;
  }

  private async doSave(events: AnniversaryEvent[]): Promise<void> {
    await this.writeEvents(this.getEventsPath(), events);
  }

  private async writeEvents(
    path: string,
    eventsOrContent: AnniversaryEvent[] | string
  ): Promise<void> {
    const folder = path.split("/").slice(0, -1).join("/");
    if (folder) {
      await this.plugin.app.vault.adapter.mkdir(normalizePath(folder)).catch(() => {});
    }

    const content =
      typeof eventsOrContent === "string"
        ? eventsOrContent
        : JSON.stringify(
            {
              version: 1,
              updatedAt: new Date().toISOString(),
              events: eventsOrContent.map((e) => normalizeEvent(e)),
            } satisfies VaultAnniversaryData,
            null,
            2
          );

    try {
      const existing = this.plugin.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        await this.plugin.app.vault.modify(existing, content);
        return;
      }

      const adapter = this.plugin.app.vault.adapter;
      if (await adapter.exists(path)) {
        await adapter.write(path, content);
        return;
      }

      try {
        await this.plugin.app.vault.create(path, content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists|ENOENT|EEXIST/i.test(msg)) {
          await adapter.write(path, content);
          return;
        }
        throw err;
      }
    } catch (err) {
      console.error("纪念日数据保存失败", err);
      new Notice(`保存失败：${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async importFromMarkdown(notify = true): Promise<AnniversaryEvent[]> {
    const file = this.plugin.app.vault.getAbstractFileByPath(normalizePath(MD_SOURCE));
    if (!(file instanceof TFile)) {
      if (notify) new Notice(`未找到 ${MD_SOURCE}`);
      return [];
    }
    const content = await this.plugin.app.vault.read(file);
    const events = parseMarkdownAnniversaries(content);
    if (events.length === 0 && notify) {
      new Notice("未能从 纪念日.md 解析到数据");
    }
    return events;
  }

  async reimportFromMarkdown(options?: { confirm?: boolean }): Promise<number> {
    const events = await this.importFromMarkdown(true);
    if (events.length === 0) return 0;

    if (options?.confirm !== false) {
      const current = this.plugin.events.length;
      const ok = await showConfirm(this.plugin.app, {
        title: "从 Markdown 导入",
        message: `从 ${MD_SOURCE} 导入将覆盖当前 ${current} 条纪念事项，替换为 ${events.length} 条。\n\n此操作不可撤销，是否继续？`,
        confirmText: "导入",
        warning: true,
      });
      if (!ok) return 0;
    }

    await this.save(events);
    this.plugin.events = events;
    this.plugin.refreshAll();
    new Notice(`已从 纪念日.md 导入 ${events.length} 条纪念事项`);
    return events.length;
  }

  async openEventsFile(): Promise<void> {
    const path = this.getEventsPath();
    let file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      await this.save(this.plugin.events);
      file = this.plugin.app.vault.getAbstractFileByPath(path);
    }
    if (file instanceof TFile) {
      await this.plugin.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    const opened = await openPluginConfigFile(this.plugin.app, path);
    if (!opened) {
      new Notice(`数据文件：${path}\n（位于插件目录，可用文件管理器打开）`);
    }
  }

  /** @deprecated 使用 openEventsFile */
  async openDataFile(): Promise<void> {
    return this.openEventsFile();
  }

  watch(onExternalChange: () => void): void {
    const eventsPath = this.getEventsPath();
    this.plugin.registerEvent(
      this.plugin.app.vault.on("modify", (file) => {
        if (file.path === eventsPath && !this.saving) {
          onExternalChange();
        }
      })
    );
  }

  private async migrateLegacyPluginData(): Promise<AnniversaryEvent[]> {
    const raw = (await this.plugin.loadData()) as { events?: AnniversaryEvent[] } | null;
    if (!raw?.events?.length) return [];
    return raw.events.map((e, i) =>
      normalizeEvent({
        ...e,
        group: e.group ?? inferGroup(e.name),
        sortOrder: e.sortOrder ?? i,
      })
    );
  }
}

export { createDefaultVaultData, SAMPLE_EVENTS };
