#!/usr/bin/env node
/**
 * Pack 纪念日 两版到 Desktop：个人版 / 公版48小时试用版
 * Usage: node scripts/pack-desktop-all.mjs [outdir]
 *
 * 注意：esbuild 默认用 JNR_REQUIRE_LICENSE/JNR_TRIAL_HOURS 覆盖 header（公开仓默认 48h），
 * 打包时必须传对应环境变量，仅改 plugin-header.js 不够。
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;
const OUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.env.HOME || "", "Desktop", `V${VERSION.replace(/^v/i, "")}`);
const ASSETS = path.join(ROOT, "release-pack/assets");
const CORE_FILES = ["manifest.json", "styles.css"];
const HEADER_PATH = path.join(ROOT, "plugin-header.js");
const originalHeader = fs.readFileSync(HEADER_PATH, "utf8");

function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function patchHeader(requireLicense, trialHours = 0, edition = "personal") {
  let code = fs.readFileSync(HEADER_PATH, "utf8");
  code = code.replace(/const PLUGIN_VERSION = "[^"]+";/, `const PLUGIN_VERSION = "${VERSION}";`);
  code = code.replace(
    /const PLUGIN_EDITION = "[^"]+";/,
    `const PLUGIN_EDITION = "${edition}";`
  );
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

function writeMainJs(destDir, requireLicense, trialHours, edition) {
  patchHeader(requireLicense, trialHours, edition);
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

function packEdition(folderName, assetSubdir, requireLicense, trialHours, edition, readme) {
  const dest = path.join(OUT, folderName);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of CORE_FILES) cp(path.join(ROOT, f), path.join(dest, f));
  writeMainJs(dest, requireLicense, trialHours, edition);
  cp(path.join(ASSETS, assetSubdir, "data.json"), path.join(dest, "data.json"));
  cp(path.join(ASSETS, assetSubdir, "events.json"), path.join(dest, "events.json"));
  fs.writeFileSync(path.join(dest, "README.txt"), readme, "utf8");
  console.log("✅", dest);
}

fs.mkdirSync(OUT, { recursive: true });

const baseReadme = (label) => `纪念日 Obsidian 插件 v${VERSION} · ${label}
========================================

【安装】
1. 将本文件夹全部文件放入：你的库/.obsidian/plugins/jinianri/
2. 重启 Obsidian 后在设置 → 第三方插件 中启用「纪念日」
`;

packEdition(
  `纪念日-v${VERSION}-个人版`,
  "personal",
  false,
  0,
  "personal",
  baseReadme("个人版") + "\n- 已预填个人纪念事项 · 无需激活码\n"
);

packEdition(
  `纪念日-v${VERSION}-公版48小时试用版`,
  "public",
  true,
  48,
  "public",
  baseReadme("公版48小时试用版") + "\n- 预填 3 条示例纪念事项 · 48 小时全功能试用，到期须激活\n"
);

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
console.log(`\n纪念日两包已输出到 ${OUT}`);
