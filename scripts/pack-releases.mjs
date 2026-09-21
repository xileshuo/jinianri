#!/usr/bin/env node
/**
 * 打包个人版 + 公版（商）到桌面与 dist/，并部署个人版到当前库
 * 用法：node scripts/pack-releases.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;

const DESKTOP = path.join(process.env.HOME || "", "Desktop");
const DIST_ROOT = path.join(ROOT, "dist");
const COMM_NAMES = [`纪念日-Obsidian插件-v${VERSION}-公版（商）`, `公版（商）`];
const PERSONAL_NAMES = [`纪念日-Obsidian插件-v${VERSION}-个人版`, `个人版`];
const COMM_DESKTOP = path.join(DESKTOP, COMM_NAMES[0]);
const PERSONAL_DESKTOP = path.join(DESKTOP, PERSONAL_NAMES[0]);
const COMM_DIST = path.join(DIST_ROOT, COMM_NAMES[1]);
const PERSONAL_DIST = path.join(DIST_ROOT, PERSONAL_NAMES[1]);
const VAULT_PLUGIN = path.join(
  process.env.HOME || "",
  "Library/Mobile Documents/iCloud~md~obsidian/Documents/大鹏一日同风起/.obsidian/plugins/jinianri"
);

const ASSETS = path.join(ROOT, "release-pack/assets");
const CORE_FILES = ["manifest.json", "styles.css"];

function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function validateMainJs(filePath) {
  execSync(`node --check "${filePath}"`, { stdio: "pipe" });
  const code = fs.readFileSync(filePath, "utf8");
  const firstLine = code.split("\n")[0] || "";
  if (/\bdebounce\b/.test(firstLine)) {
    throw new Error(`${filePath}: 首行 obsidian require 不应包含 debounce`);
  }
  const licenseCount = (code.match(/(?:const|var) PLUGIN_REQUIRE_LICENSE\s*=/g) || []).length;
  if (licenseCount !== 1) {
    throw new Error(`${filePath}: PLUGIN_REQUIRE_LICENSE 应只声明 1 次，实际 ${licenseCount} 次`);
  }
  const versionCount = (code.match(/(?:const|var) PLUGIN_VERSION\s*=/g) || []).length;
  if (versionCount !== 1) {
    throw new Error(`${filePath}: PLUGIN_VERSION 应只声明 1 次，实际 ${versionCount} 次`);
  }
  if (!code.includes("module.exports")) {
    throw new Error(`${filePath}: 缺少 module.exports`);
  }
}

function writeMainJs(destDir, requireLicense) {
  let code = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  code = code.replace(
    /const PLUGIN_REQUIRE_LICENSE = (true|false);/,
    `const PLUGIN_REQUIRE_LICENSE = ${requireLicense};`
  );
  const out = path.join(destDir, "main.js");
  fs.writeFileSync(out, code, "utf8");
  validateMainJs(out);
}

function packEdition(destDir, assetSubdir, requireLicense) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of CORE_FILES) {
    cp(path.join(ROOT, f), path.join(destDir, f));
  }
  writeMainJs(destDir, requireLicense);
  cp(path.join(ASSETS, assetSubdir, "data.json"), path.join(destDir, "data.json"));
  cp(path.join(ASSETS, assetSubdir, "events.json"), path.join(destDir, "events.json"));
  const readme =
    assetSubdir === "public"
      ? `纪念日 Obsidian 插件 v${VERSION} · 公版（商）
========================================

【安装】
1. 将本文件夹 5 个文件放入：你的库/.obsidian/plugins/jinianri/
2. 重启 Obsidian
3. 设置 → 第三方插件 → 手动开启「纪念日」（安装后默认关闭，开启后才出现首次引导）
4. 首次开启：依次点「知道了」关闭更新日志、使用说明；之后日常打开不再弹

【升级】
仅覆盖 main.js、manifest.json、styles.css
切勿覆盖 data.json / events.json（否则会重置已读状态与纪念数据）

【注意】
插件目录请只用 jinianri/。若存在旧的 .obsidian/plugins/纪念日/ 请删除，避免加载旧版。

- 默认空纪念事项 · 需激活码 · 侧边栏 Ribbon 图标打开
`
      : `纪念日 Obsidian 插件 v${VERSION} · 个人版
========================================

【安装】
1. 将本文件夹 5 个文件放入：你的库/.obsidian/plugins/jinianri/
2. 重启 Obsidian
3. 设置 → 第三方插件 → 手动开启「纪念日」（安装后默认关闭，开启后才出现首次引导）
4. 首次开启：依次点「知道了」关闭更新日志、使用说明；之后日常打开不再弹

【升级】
仅覆盖 main.js、manifest.json、styles.css
切勿覆盖 data.json / events.json

【注意】
插件目录请只用 jinianri/。若存在旧的 .obsidian/plugins/纪念日/ 请删除。

- 已预填个人纪念事项 · 无需激活码
`;
  fs.writeFileSync(path.join(destDir, "README.txt"), readme, "utf8");
}

console.log("🔨 正在 build …");
execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
validateMainJs(path.join(ROOT, "main.js"));

console.log("📦 打包公版（商）…");
for (const dir of [COMM_DESKTOP, COMM_DIST]) {
  packEdition(dir, "public", true);
}

console.log("📦 打包个人版…");
for (const dir of [PERSONAL_DESKTOP, PERSONAL_DIST]) {
  packEdition(dir, "personal", false);
}

console.log("🚀 部署个人版到库（仅代码，保留 data.json / events.json）…");
fs.mkdirSync(VAULT_PLUGIN, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  cp(path.join(PERSONAL_DESKTOP, f), path.join(VAULT_PLUGIN, f));
}

console.log("\n✅ 完成！");
console.log("公版（商）：", COMM_DESKTOP);
console.log("个人版：  ", PERSONAL_DESKTOP);
console.log("dist 公版：", COMM_DIST);
console.log("dist 个人：", PERSONAL_DIST);
console.log("已部署：  ", VAULT_PLUGIN);
