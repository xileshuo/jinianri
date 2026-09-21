/**
 * 一次性合并脚本：把 src/ 编译成 BrainCore 风格的单文件 main.js
 * 用法：node scripts/assemble-main.mjs
 * 合并后只需维护根目录 main.js（顶部 PLUGIN_UPDATE_SECTIONS 等）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import esbuild from "esbuild";
import builtins from "builtin-modules";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const HEADER = `const { Plugin, ItemView, WorkspaceLeaf, Modal, Notice, Menu, debounce, PluginSettingTab, Setting, Platform, TFile, normalizePath, setIcon, addIcon } = require("obsidian");

// ═══════════════════════════════════════════════════════════════════════════════
// 【可编辑区】版本 / 更新说明 / 授权开关 — 与 BrainCore 一样改这里即可
// ═══════════════════════════════════════════════════════════════════════════════

const PLUGIN_VERSION = "4.0.1";
const PLUGIN_REQUIRE_LICENSE = true;

const PLUGIN_UPDATE_SECTIONS = [
  {
    title: "一、插件诞生与核心能力",
    items: [
      "从 Life/纪念日.md 的 DataviewJS 看板演进为独立 Obsidian 插件",
      "纪念看板：倒计时、已过时长、下次公历日期一目了然",
      "阴历 / 阳历：农历生日自动换算当年公历，无需手写 solar 字段",
      "三档全局提醒（默认 30 / 15 / 7 天），每档可独立开关并改天数",
      "Obsidian 内通知 + macOS 桌面系统通知（Electron 原生通道）",
      "笔记嵌入：\`\`\`jinianri\`\`\` 代码块实时渲染看板",
      "命令面板：打开侧边栏、立即检查提醒、导出 iCal 等"
    ]
  },
  {
    title: "二、设置页与日期选择",
    items: [
      "设置页表格管理纪念事项，告别左侧名称与输入框重复显示",
      "iOS 风格年 / 月 / 日三列滚动轮盘选日期",
      "提醒档位改为三行列表：天数 + Obsidian 原生 Toggle",
      "名称列加宽、历法列收窄，表头与数据行 grid 对齐",
      "编辑 / 删除按钮右对齐，统一 Obsidian 图标（pencil / trash）",
      "分组 + 事项合并为一块管理：导入、导出 iCal、添加分组 / 事项",
      "每日检查时间改为 <input type=\\"time\\">，精确到分钟"
    ]
  },
  {
    title: "三、数据存储与分组",
    items: [
      "v2.0：纪念事项迁入库内 Life/anniversaries.json，支持 iCloud / Git 同步",
      "侧边栏分组展示：家人生日 / 婚姻纪念 / 恋爱纪念 / 其他，可折叠",
      "状态栏显示最近一项倒计时，点击打开侧边栏",
      "v2.5+：分组可增删改，自定义分组名称，至少保留 1 个分组",
      "v2.9.1：设置存 data.json，纪念事项存 events.json，互不覆盖",
      "自动迁移：旧版单文件、Life/anniversaries.json、data.json 内 events 均可搬迁",
      "公版 3 条示例；个人版可预填真实数据"
    ]
  },
  {
    title: "四、侧边栏交互与拖动",
    items: [
      "侧边栏透明融入 Obsidian 主题，去掉卡片底色块",
      "无 ⋮⋮ 手柄：整卡 / 分组标题直接拖动，轻点仍编辑",
      "组内排序、拖到分组标题换组、分组本身可调整顺序",
      "iOS 风格让位动画 + 液态玻璃 ghost，拖动更跟手",
      "拖动排序静默写盘，不再整页重建侧边栏（解决连续拖动卡顿）",
      "移动端触摸阈值 22px，减少误触；列表仍可纵向滚动",
      "「即将到期」置顶区与提醒档位联动（至少 7 天）"
    ]
  },
  {
    title: "五、提醒机制",
    items: [
      "每天在设定时间检查；当天未开 Obsidian，首次打开会补发",
      "每条事项可单独开关提醒；当天再发「就是今天」提醒",
      "v2.6：Obsidian 内提醒改为主编辑区居中阻塞弹窗，须点「知道了」",
      "多条提醒依次排队；Mac 系统通知可独立开关",
      "设置页「发送测试」一键预览弹窗与通知效果"
    ]
  },
  {
    title: "六、移动端与 iCal",
    items: [
      "修复移动端插件加载失败：onload try/catch、Platform 分支处理",
      "ensureSideLeaf 打开右侧边栏；失败时自动全屏「纪念日」面板（非 md 笔记）",
      "新增命令「打开纪念日面板（全屏）」作备用入口",
      "iCal 导出：Life/anniversaries.ics，YEARLY 重复 + VALARM 三档提醒",
      "备注字段写入 iCal DESCRIPTION；导出后可导入 macOS 日历"
    ]
  },
  {
    title: "七、体验与发行（v2.7 — v2.9）",
    items: [
      "侧边栏仅浏览 + 拖动；增删改集中在设置页，职责清晰",
      "Markdown 导入、删除事项 / 分组：二次确认",
      "新用户默认 2 条示例 + 设置页「开始使用」引导",
      "「已过」显示改为 X 年 X 月 X 天（日历粒度，更直观）",
      "作者信息更新为囍樂，附小红书主页链接",
      "移动端 / iCloud 读写优化；数据保存失败不再锁死",
      "设置页展示 data.json 与 events.json 路径，可一键打开"
    ]
  },
  {
    title: "八、更新说明弹窗",
    items: [
      "升级后首次启动弹出更新说明（BrainCore 同款交互）",
      "分组展示全部历史更新要点，头部与底部按钮固定",
      "内容过长时，手机与电脑均可在中部列表无痕惯性滑动",
      "点击「知道了，开始使用」后标记已读，不再重复弹出",
      "设置页可随时重新打开更新说明"
    ]
  },
  {
    title: "九、授权与使用说明",
    items: [
      "新增：验证码激活，绑定库名称（Mac / iPhone 同库共享）",
      "新增：未激活时侧边栏显示初始化向导（指纹 + 激活码 + 操作指南）",
      "新增：首次启动在主编辑区自动打开《纪念日 插件使用说明》",
      "修复：手动修改 data.json 中 licenseActivated 无法绕过校验",
      "设置页顶部增加「授权激活」与「打开操作指南」入口",
      "源码合并为单文件 main.js，与 BrainCore 相同维护方式"
    ]
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// 【以下插件逻辑】一般不需改；改功能时可继续编辑下方代码
// ═══════════════════════════════════════════════════════════════════════════════

`;

const bodyOut = path.join(ROOT, ".assemble-body.js");
const finalOut = path.join(ROOT, "main.js");

await esbuild.build({
  entryPoints: [path.join(ROOT, "src/main.ts")],
  bundle: true,
  format: "cjs",
  target: "es2018",
  outfile: bodyOut,
  minify: false,
  treeShaking: true,
  legalComments: "none",
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
});

let body = fs.readFileSync(bodyOut, "utf8");
body = body.replace(/^["']use strict["'];\s*/, "");

// 去掉 body 里重复的 PLUGIN_VERSION / UPDATE 常量定义，改用顶部 HEADER
body = body.replace(/const PLUGIN_VERSION = "[^"]+";?\s*/g, "");
body = body.replace(/var PLUGIN_VERSION = "[^"]+";?\s*/g, "");
// 去掉 body 里重复的 PLUGIN_UPDATE_SECTIONS 大数组（保留顶部可编辑区那份）
body = body.replace(
  /(?:const|var) PLUGIN_UPDATE_SECTIONS = \[\s*\{[\s\S]*?\n\];\s*/m,
  ""
);

const merged = HEADER + body;
fs.writeFileSync(finalOut, merged, "utf8");
fs.unlinkSync(bodyOut);

const lines = merged.split("\n").length;
console.log(`✅ 已生成 ${finalOut}（${lines} 行）`);
console.log("   更新说明：编辑文件顶部 PLUGIN_VERSION + PLUGIN_UPDATE_SECTIONS");
