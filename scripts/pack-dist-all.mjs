#!/usr/bin/env node
/**
 * Pack 纪念日 into dist/ (个人版 / 公版（商） / 48小时体验版)
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(ROOT, "release-pack/assets");
const HEADER_PATH = path.join(ROOT, "plugin-header.js");
const originalHeader = fs.readFileSync(HEADER_PATH, "utf8");

function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function patchHeader(requireLicense, trialHours = 0) {
  let code = fs.readFileSync(HEADER_PATH, "utf8");
  code = code.replace(
    /const PLUGIN_REQUIRE_LICENSE = (true|false);/,
    `const PLUGIN_REQUIRE_LICENSE = ${requireLicense};`
  );
  if (/const PLUGIN_TRIAL_HOURS = \d+;/.test(code)) {
    code = code.replace(/const PLUGIN_TRIAL_HOURS = \d+;/, `const PLUGIN_TRIAL_HOURS = ${trialHours};`);
  } else {
    code = code.replace(
      /const PLUGIN_REQUIRE_LICENSE = (true|false);/,
      `const PLUGIN_REQUIRE_LICENSE = ${requireLicense};\nconst PLUGIN_TRIAL_HOURS = ${trialHours};`
    );
  }
  fs.writeFileSync(HEADER_PATH, code, "utf8");
}

function writeMainJs(destDir, requireLicense, trialHours) {
  patchHeader(requireLicense, trialHours);
  execSync("npm run build", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      JNR_REQUIRE_LICENSE: String(requireLicense),
      JNR_TRIAL_HOURS: String(trialHours),
    },
  });
  execSync(`node --check "${path.join(ROOT, "main.js")}"`, { stdio: "pipe" });
  cp(path.join(ROOT, "main.js"), path.join(destDir, "main.js"));
}

function packEdition(folderName, assetSubdir, requireLicense, trialHours, readme) {
  const dest = path.join(DIST, folderName);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  cp(path.join(ROOT, "manifest.json"), path.join(dest, "manifest.json"));
  cp(path.join(ROOT, "styles.css"), path.join(dest, "styles.css"));
  writeMainJs(dest, requireLicense, trialHours);
  cp(path.join(ASSETS, assetSubdir, "data.json"), path.join(dest, "data.json"));
  cp(path.join(ASSETS, assetSubdir, "events.json"), path.join(dest, "events.json"));
  fs.writeFileSync(path.join(dest, "README.txt"), readme, "utf8");
  console.log("✅", dest);
}

const baseReadme = (label) => `纪念日 Obsidian 插件 v${VERSION} · ${label}
========================================

【安装】
1. 将本文件夹 5 个文件放入：你的库/.obsidian/plugins/jinianri/
2. 重启 Obsidian 后在设置 → 第三方插件 中启用「纪念日」
`;

packEdition("个人版", "personal", false, 0, baseReadme("个人版") + "\n- 已预填个人纪念事项 · 无需激活码\n");
packEdition("公版（商）", "public", true, 0, baseReadme("公版（商）") + "\n- 预填 3 条示例纪念事项 · 需激活码\n");
packEdition("48小时体验版", "public", true, 48, baseReadme("48小时体验版") + "\n- 48 小时全功能试用，到期须激活\n");

fs.writeFileSync(HEADER_PATH, originalHeader, "utf8");
execSync("npm run build", {
  cwd: ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    JNR_REQUIRE_LICENSE: "true",
    JNR_TRIAL_HOURS: "48",
  },
});
console.log(`\n纪念日 dist/ v${VERSION} 完成。`);
