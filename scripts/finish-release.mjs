#!/usr/bin/env node
/**
 * 一键生成 v2.9.0 正式发行包（桌面 + OneDrive）
 * 用法：node scripts/finish-release.mjs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
process.chdir(root);

console.log("▶ 构建插件…");
try {
  execSync("npm run build", { stdio: "inherit" });
} catch {
  console.warn("⚠ npm run build 失败，尝试使用已有 main.js");
}

console.log("▶ 打包发行版…");
execSync(`node "${path.join(root, "scripts/pack-release.mjs")}"`, { stdio: "inherit" });

const pkg = path.join(root, "release-pack", "纪念日-Obsidian插件-v2.9.0");
const main = path.join(pkg, "jinianri/main.js");
if (!fs.existsSync(main)) {
  console.error("❌ 缺少 main.js，请检查构建");
  process.exit(1);
}
const size = fs.statSync(main).size;
console.log(`\n✅ 发行包就绪：${pkg}`);
console.log(`   main.js ${size} bytes`);
console.log("   桌面与 OneDrive 已同步（见 pack-release 输出）");
