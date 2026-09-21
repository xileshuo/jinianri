#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).version;

const outputs = [
  "/Users/xile/Desktop",
  "/Users/xile/Library/CloudStorage/OneDrive-个人/大伟哥/Just do it/纪念日",
];

const variants = [
  {
    id: "public",
    suffix: "公版",
    desc: "新用户安装包，含默认提醒设置 + 3 条示例纪念事项",
  },
  {
    id: "personal",
    suffix: "个人版",
    desc: "已预填你的 14 条纪念事项与个人设置",
  },
];

function buildDocs(v, variant) {
  return {
    "安装说明.md": `# 纪念日 · Obsidian 插件 — 安装说明（${variant.suffix}）

**版本 ${version}** · 作者 **囍樂** · [小红书主页](https://xhslink.com/m/2WkEXvZiKri)

${variant.desc}

---

## 一、安装步骤

1. 打开 Obsidian **库文件夹** → 进入 \`.obsidian/plugins/\`
2. 将 **jinianri** 整个文件夹复制进去，确认包含 **5 个文件**：
   - \`manifest.json\`
   - \`main.js\`
   - \`styles.css\`
   - \`data.json\`（插件设置：提醒档位、分组等）
   - \`events.json\`（纪念事项数据）
3. **设置 → 第三方插件** → 关闭安全模式 → 启用「纪念日」

## 二、数据文件说明

| 文件 | 内容 |
|------|------|
| \`data.json\` | 提醒规则、分组名称、通知开关等 **设置** |
| \`events.json\` | 全部 **纪念事项**（生日、纪念日等） |

路径均在 \`.obsidian/plugins/jinianri/\`，随库 / iCloud 同步。

## 三、升级说明

- **保留** 你的 \`data.json\` 和 \`events.json\`
- 只覆盖 \`main.js\`、\`styles.css\`、\`manifest.json\`
- 从 v2.9.0 及更早版本升级：插件会自动把旧 \`data.json\` 里的纪念事项迁到 \`events.json\`

---

作者：囍樂 · https://xhslink.com/m/2WkEXvZiKri
`,
    "使用说明.md": `# 纪念日 · 使用说明（${variant.suffix}）

**版本 ${version}** · 作者 **囍樂**

## 数据存储（v${version}）

- **data.json** — 插件设置（三档提醒 30/15/7 天、分组、通知等）
- **events.json** — 纪念事项列表

两者均在 \`.obsidian/plugins/jinianri/\`，互不覆盖。

## 功能

- 侧边栏倒计时 + **已过 X 年 X 月 X 天**
- 阴历 / 阳历自动换算
- 三档提醒、iCal 导出、移动端支持

## ${variant.suffix}说明

${variant.desc}

感谢使用「纪念日」插件。
`,
    "CHANGELOG.md": `# 更新日志

## ${version}

- **设置与纪念事项拆分**：\`data.json\`（设置）+ \`events.json\`（事项），不再互相覆盖
- 自动从旧版单文件 \`data.json\` 及 \`Life/*.json\` 迁移
- 发布 **公版**（3 条示例）与 **个人版**（预填数据）安装包

## 2.9.0

- 「已过 X 年 X 月 X 天」显示
- 数据迁至插件目录
`,
    "LICENSE.txt": `纪念日 Obsidian 插件

版权所有 © 囍樂
https://xhslink.com/m/2WkEXvZiKri

本插件供个人学习与交流使用。转载或二次分发请注明作者与来源。
`,
  };
}

function resolveMainJs() {
  const built = path.join(root, "main.js");
  if (fs.existsSync(built) && fs.statSync(built).size > 100_000) return built;
  const fallback = path.join(
    root,
    "release-pack/纪念日-Obsidian插件-v2.7.1/jinianri/main.js"
  );
  if (fs.existsSync(fallback)) return fallback;
  throw new Error("找不到 main.js，请先运行 npm run build");
}

const mainSrc = resolveMainJs();

for (const variant of variants) {
  const pkgName = `纪念日-Obsidian插件-v${version}-${variant.suffix}`;
  const pkg = path.join(root, "release-pack", pkgName);
  const jinianri = path.join(pkg, "jinianri");
  const assets = path.join(root, "release-pack/assets", variant.id);

  fs.mkdirSync(jinianri, { recursive: true });
  fs.copyFileSync(mainSrc, path.join(jinianri, "main.js"));
  fs.copyFileSync(path.join(root, "styles.css"), path.join(jinianri, "styles.css"));
  fs.copyFileSync(path.join(root, "manifest.json"), path.join(jinianri, "manifest.json"));
  fs.copyFileSync(path.join(assets, "data.json"), path.join(jinianri, "data.json"));
  fs.copyFileSync(path.join(assets, "events.json"), path.join(jinianri, "events.json"));

  for (const [name, content] of Object.entries(buildDocs(version, variant))) {
    fs.writeFileSync(path.join(pkg, name), content);
  }

  for (const outDir of outputs) {
    fs.mkdirSync(outDir, { recursive: true });
    const dest = path.join(outDir, pkgName);
    const zip = path.join(outDir, `${pkgName}.zip`);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
    fs.cpSync(pkg, dest, { recursive: true });
    if (fs.existsSync(zip)) fs.unlinkSync(zip);
    execSync(
      `cd ${JSON.stringify(outDir)} && zip -r ${JSON.stringify(`${pkgName}.zip`)} ${JSON.stringify(pkgName)} -x "*.DS_Store"`
    );
    const mainStat = fs.statSync(path.join(dest, "jinianri/main.js"));
    const zipStat = fs.statSync(zip);
    console.log(`✅ ${variant.suffix}: ${dest}`);
    console.log(`   main.js ${mainStat.size} bytes`);
    console.log(`✅ ${variant.suffix}: ${zip} (${zipStat.size} bytes)`);
  }
}

console.log("\n完成。公版 = 3 条示例；个人版 = 14 条真实数据。");
