#!/usr/bin/env node
/**
 * 作者用：根据指纹 JNR-xxx、Obsidian appId 或库名生成激活码 KEY-xxx
 *
 * 用法：
 *   node scripts/gen-license-key.mjs JNR-4708F398
 *   node scripts/gen-license-key.mjs --appid <Obsidian-appId>
 *   node scripts/gen-license-key.mjs 大鹏一日同风起
 *   node scripts/gen-license-key.mjs --vault "My Vault"
 */

function hashStringToHex(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase();
}

function fingerprintFromVaultName(vaultName) {
  return "JNR-" + hashStringToHex(String(vaultName));
}

function fingerprintFromAppId(appId) {
  return "JNR-" + hashStringToHex(String(appId));
}

function licenseKeyFromFingerprint(fp) {
  let hash = 0;
  for (let i = 0; i < fp.length; i++) {
    hash = (hash << 5) - hash + fp.charCodeAt(i);
    hash |= 0;
  }
  return "KEY-" + Math.abs(hash ^ 0x8899).toString(16).toUpperCase();
}

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(`用法:
  node scripts/gen-license-key.mjs <指纹 JNR-xxx>
  node scripts/gen-license-key.mjs --appid <Obsidian appId>
  node scripts/gen-license-key.mjs <Obsidian 库名称>
  node scripts/gen-license-key.mjs --vault "库名"

示例:
  node scripts/gen-license-key.mjs JNR-4708F398
  node scripts/gen-license-key.mjs --appid 550e8400-e29b-41d4-a716-446655440000
  node scripts/gen-license-key.mjs 大鹏一日同风起

说明:
  v2.9.9+ 主指纹优先绑定 Obsidian appId（同 BrainCore），仍兼容旧版库名指纹。`);
  process.exit(args.length ? 0 : 1);
}

let input = args.join(" ").trim();
let fp;

if (args[0] === "--appid") {
  input = args.slice(1).join(" ").trim();
  fp = fingerprintFromAppId(input);
} else if (args[0] === "--vault") {
  input = args.slice(1).join(" ").trim();
  fp = fingerprintFromVaultName(input);
} else if (input.toUpperCase().startsWith("JNR-")) {
  fp = input.toUpperCase();
} else {
  fp = fingerprintFromVaultName(input);
}

const key = licenseKeyFromFingerprint(fp);

console.log("指纹：  ", fp);
console.log("激活码：", key);
if (args[0] === "--appid") {
  console.log("\n（由 Obsidian appId 推算；用户插件内显示的 JNR- 指纹应与此一致）");
} else if (!input.toUpperCase().startsWith("JNR-")) {
  console.log("\n（由库名推算指纹；v2.9.9+ 用户侧主指纹通常为 appId，旧库名激活码仍可用）");
}
