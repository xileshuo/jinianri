import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import builtins from "builtin-modules";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === "production";

const header = fs.readFileSync(path.join(__dirname, "plugin-header.js"), "utf8");

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
