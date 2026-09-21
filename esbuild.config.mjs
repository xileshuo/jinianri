import esbuild from "esbuild";
import process from "process";
import module from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === "production";
const builtins = module.builtinModules;

// Scorecard / public default: trial header flags so `npm run build` ≡ Release 48h main.js.
// Pack scripts override via JNR_REQUIRE_LICENSE / JNR_TRIAL_HOURS.
const requireLicense = String(process.env.JNR_REQUIRE_LICENSE ?? "true") === "true";
const trialHours = Number.parseInt(process.env.JNR_TRIAL_HOURS ?? "48", 10);
let header = fs.readFileSync(path.join(__dirname, "plugin-header.js"), "utf8");
header = header
  .replace(/const PLUGIN_REQUIRE_LICENSE = (true|false);/, `const PLUGIN_REQUIRE_LICENSE = ${requireLicense};`)
  .replace(/const PLUGIN_TRIAL_HOURS = \d+;/, `const PLUGIN_TRIAL_HOURS = ${Number.isFinite(trialHours) ? trialHours : 48};`);

const context = await esbuild.context({
  banner: { js: header + "\n" },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: false,
  legalComments: "none",
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  let code = fs.readFileSync("main.js", "utf8");
  const marker = "// 【以下插件逻辑 + 农历库】";
  const idx = code.indexOf(marker);
  if (idx > 0) {
    const header = code.slice(0, idx);
    let body = code.slice(idx);
    body = body.replace(/(?:const|var) PLUGIN_REQUIRE_LICENSE = (true|false);?\s*/g, "");
    body = body.replace(/(?:const|var) PLUGIN_VERSION = (?:typeof globalThis[^\n]+|"[^"]+");?\s*/g, "");
    body = body.replace(
      /(?:const|var) PLUGIN_UPDATE_SECTIONS = (?:typeof globalThis[\s\S]*?\n\];|\[[\s\S]*?\n\]);?\s*/m,
      ""
    );
    code = header + body;
  }
  fs.writeFileSync("main.js", code, "utf8");
  console.log("✅ main.js 已生成（顶部 plugin-header.js = 可编辑区）");
  process.exit(0);
} else {
  await context.watch();
}
