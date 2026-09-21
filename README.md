# Anniversaries

> **Paid · 48-hour trial · ¥29.9 permanent unlock**

## Overview

Anniversaries (jinianri) is a paid LifeOS plugin for birthdays and memorial dates in Obsidian, with lunar/solar calendars, sidebar countdowns, multi-level reminders, and iCal export.

Current public build: **4.0.8** (48-hour trial).

## Pricing

| Item | Details |
| --- | --- |
| Install | Free from Community Plugins (when listed), BRAT, or GitHub Releases |
| Trial | Start a **48-hour full trial** inside the plugin |
| Unlock | **¥29.9** one-time payment, permanent activation per device fingerprint |
| Purchase | Contact the author on Xiaohongshu → pay → paste your device fingerprint → receive an activation code |

## Installation

### Community plugins

Settings → Community plugins → Browse → search **Anniversaries** → Install → Enable.

### BRAT

1. Install and enable **BRAT**
2. Add this repository:

```text
https://github.com/xileshuo/jinianri
```

3. Enable the plugin; use BRAT to check for updates later.

### Manual install

Download `main.js` and `manifest.json` from the [Latest Release](https://github.com/xileshuo/jinianri/releases/latest) into `.obsidian/plugins/jinianri/`.

## Usage

1. Enable **Anniversaries** and open it from the left ribbon (or the command palette).
2. Start the **48-hour trial** from the in-plugin activation panel when prompted.
3. Use the sidebar / main panel for daily work; full help is also available inside **Settings → Usage guide**.
4. After the trial ends, copy your device fingerprint and unlock with a purchased activation code.

### Links

- Author: https://github.com/xileshuo
- Repository: https://github.com/xileshuo/jinianri
- Buy / support: Xiaohongshu (order link in the Chinese section below)
---
## 中文
> **付费 · 48 小时试用 · ¥29.9 永久激活**
Obsidian 生日与纪念日插件（LifeOS）。阴历/阳历、侧边栏倒计时、三档提醒、iCal 导出。
当前公开版本：**4.0.8 · 48 小时试用**
## 定价与购买
| 项目 | 说明 |
| --- | --- |
| **试用** | 插件内开启后 48 小时全功能 |
| **付费** | ¥29.9 一次付费，按设备指纹永久激活 |
| **购买** | 小红书联系作者下单 → 复制设备指纹 → 粘贴激活码 |
作者：[github.com/xileshuo](https://github.com/xileshuo) · 小红书：[下单入口](https://xhslink.com/m/3uOoUHv2rI1)
## 安装

### 社区插件

设置 → 第三方插件 → 浏览 → 搜索 **Anniversaries** → 安装 → 启用。

### BRAT

1. 安装并启用 **BRAT**
2. 添加仓库：

```text
https://github.com/xileshuo/jinianri
```

3. 启用插件；之后可用 BRAT 检查更新。

### 手动安装

下载 [Latest Release](https://github.com/xileshuo/jinianri/releases/latest) 的 `main.js`、`manifest.json` 到 `.obsidian/plugins/jinianri/`。
## 使用说明
纪念日插件用于记录生日、恋爱、婚姻等重要日期，自动计算「已过时长」与「距离下次还有几天」，并支持三档全局提醒与 iCal 导出。

---

## 目录

- 一、插件能做什么
- 二、如何安装
- 三、如何打开侧边栏
- 四、首次使用与激活
- 五、侧边栏使用说明
- 六、设置页说明
- 七、提醒机制
- 八、数据文件说明
- 九、常见问题

---

## 一、插件能做什么

- **纪念看板**：侧边栏分组展示，支持拖动排序
- **阴历 / 阳历**：农历日期自动换算当年公历
- **三档提醒**：默认提前 30 / 15 / 7 天，可自定义
- **Obsidian 弹窗 + 桌面系统通知**
- **iCal 导出**：可导入系统日历
- **笔记嵌入**：\`\`\`jinianri\`\`\` 代码块渲染表格看板（随笔记刷新更新）

---

## 二、如何安装

解压后将 \`main.js\`、\`manifest.json\` 等文件放入：

\`\`\`text
你的库/.obsidian/plugins/jinianri/
\`\`\`

然后在 **设置 → 第三方插件** 中开启「纪念日」，建议重启 Obsidian。

> 插件目录请使用 \`jinianri/\`。若库内同时存在 \`.obsidian/plugins/纪念日/\` 旧目录，请删除以免加载旧版。

**个人版** 与 **公版** 标识会显示在：电脑端设置页标题（含版本号，如「纪念日 配置 · 个人版 v4.0.3」）、移动端全屏看板顶栏徽章。公版需激活后使用全部功能；个人版已内置授权。

启动 Obsidian **不会自动弹出** 更新日志或使用说明。需要时请手动在侧边栏激活页或 **设置 → 第三方插件 → 纪念日** 打开。

---

## 三、如何打开侧边栏

- 点击左侧 Ribbon 的 **日历爱心图标**
- 或命令面板：**打开纪念日侧边栏**

移动端若右侧栏不可用，会使用 **打开纪念日面板（全屏）** 命令或 Ribbon 打开全屏看板。移动端无状态栏倒计时，请用 Ribbon 或上述命令进入看板。

---

## 四、首次使用与激活

第一次打开侧边栏时，若尚未激活（公版），会进入 **初始化向导**。

### 步骤

1. **复制设备专属指纹**（形如 \`JNR-XXXXXXXX\`）
2. **发送给作者**，获取专属激活码（形如 \`KEY-XXXXXXXX\`）
3. 在向导或设置页 **输入激活码**，点击 **验证并激活**
4. 激活成功后 **永久有效**（绑定 Obsidian appId，本设备一次激活）

> 公版与体验版首次安装预填 3 条示例，可编辑或删除后添加自己的纪念日。仍兼容旧版按库名生成的激活码。

---

## 五、侧边栏使用说明

侧边栏用于 **浏览**，增删改在设置页。**列表视图**底部提示 **点击折叠 · 拖动排序 · 点击事项进设置**，下方两行 **进入 Obsidian 设置 → 纪念日 → 事项** / **可增删改纪念事项**（月历、时间轴不显示该提示；移动端首次进入列表会弹 Notice）。

- **顶部统计**：全部 / 今天 / 本周 / 本月（按「下次纪念日」落在的时间范围统计）
- **焦点大卡**：最近 2 项纪念日倒计时（无标题行）
- **列表 / 时间轴 / 日历**：顶部工具栏一行切换（筛选下拉与视图 Tab 同排；移动端侧边栏与桌面一致）
- **筛选**：全部 + 各分组（下拉高亮显示）
- **累计天数**：类型选「累计天数」显示已经 X 天（如在一起）
- **月历**：点日期筛选当日纪念日，可清除筛选

- **点击 / 轻点名称旁箭头区域**：折叠 / 展开分组
- **拖动 / 长按分组标题栏**：调整分组顺序（含数字区）
- **拖动 / 长按卡片**：组内排序或拖到分组标题换组
- **点击 / 轻点卡片**：跳转设置 **事项** Tab 并定位到该条目
- **即将到期**：与已启用的提醒档位联动（至少 7 天），临近事项会置顶显示

增删改纪念事项请进入 **设置 → 第三方插件 → 纪念日**。

---

## 六、设置页说明

设置页采用 **标签页 + 卡片区块** 布局（BrainCore 风格）。未激活公版时，仅 **授权** 与 **数据** 可用。

| Tab | 内容 |
|-----|------|
| **授权** | 设备指纹、激活码、验证并激活、打开使用说明（公版） |
| **提醒** | 三档提前天数、Obsidian 弹窗 / 系统通知、每日检查时间、测试提醒 |
| **事项** | 分组管理、表格编辑（emoji + 名称）、导入 \`纪念日.md\`、导出 iCal |
| **通用** | 状态栏开关、看板视图说明、笔记嵌入代码 \`\`\`jinianri\`\`\` |
| **数据** | 打开 \`data.json\` / \`events.json\` |
| **关于** | 更新日志、使用说明、作者与套装作品 |

移动端设置页顶部已与 Obsidian 原生顶栏对齐（41px 下沉），显示紧凑版插件标题。

---

## 七、提醒机制

每天在设定时间检查一次。若当时未打开 Obsidian，**首次打开会补发**。

当天还会再发「就是今天 🎉」提醒。每条事项可单独关闭提醒。

仅开启 **系统通知** 时，展示后即视为已提醒，不会重复弹窗。开启 **库内弹窗** 时，弹窗一出现即记为已提醒（避免关库未点确认导致同日重弹），可按 Esc 或点「知道了」关闭。若当时被设置页挡住没看到，可用设置 → 提醒 →「再弹今天」。

---

## 八、数据文件说明

| 文件 | 内容 |
|------|------|
| \`data.json\` | 提醒档位、分组、激活状态等设置 |
| \`events.json\` | 全部纪念事项 |

路径可在设置 **数据** Tab 查看并一键打开。随库 / iCloud 同步。

---

## 九、常见问题

### Q：激活码在哪里输入？

侧边栏初始化向导，或 **设置 → 纪念日 → 授权**（输入后点 **验证激活**）。

### Q：升级后如何查看更新说明？

更新日志 **不会自动弹出**。随时可在设置 **关于 → 更新日志** 手动查看。

### Q：完整使用说明在哪里？

本文件即为完整说明。请在侧边栏激活页或设置页点击 **打开使用说明** 按需打开（不存在则自动生成）。

> 若你在本文件中自行修改了内容，插件不会覆盖你的编辑；仅当内置说明版本升级且文件仍带版本标记时才会同步更新。

### Q：公版有示例数据吗？

公版与 48 小时体验版首次安装 **预填 3 条示例纪念事项**（生日 / 纪念日 / 恋爱纪念），并非空列表，可编辑或删除后添加自己的。个人版内置个人纪念事项。

### Q：插件目录有两个文件夹（jinianri 与 纪念日）？

请只保留 **jinianri** 文件夹。若存在 \`.obsidian/plugins/纪念日/\` 旧目录，请删除或禁用，避免加载旧版插件。

---

## 一句话总结

打开 Obsidian → 点击日历爱心图标 → 激活后管理你的重要日期 → 到点自动提醒，不再错过。
## 更新日志
### 4.0.8

- 社区审核：设置页与关于/授权区块统一 Setting.setHeading()，消除 scorecard heading Error
- 社区审核：提醒弹窗标题改为非 heading 元素；补齐 lifeos 区块 setHeading 样式

### 4.0.7

- 社区审核：去掉运行时注入 style / 内联样式；设置标题改用 Setting.setHeading()
- 构建：公开仓 plugin-header 与 48h 体验包一致，通过 Build verification

### 4.0.6

- 社区审核：公开 README 英文 Installation / Usage 前置；去掉 :has 选择器
- 样式：手机全屏看板高度去掉重复声明，减少 CSS lint 警告

### 4.0.5

- 社区目录：manifest.name 改为 Anniversaries（符合英文命名规范；插件内仍显示「纪念日」）

### 4.0.4

- 社区分发：公开包改为 48 小时试用，到期后 ¥29.9 永久激活
- 关于：所有作品互相介绍售价，未安装可跳转 GitHub 了解/安装
- 体验版：试用时长与显示名统一为 48 小时

### 4.0.3

- 关于：所有作品改为纵向排列
- 设置·数据：移除与关于重复的「更新日志」入口
- 文档：使用说明中更新日志入口改为「设置 → 关于」

### 4.0.2

- 数据安全：events.json 损坏时只提示并备份，不再自动用示例数据覆盖
- 手机顶距：LIFEOS / 设置统一固定 41px spacer（host 负责 safe-area）
- 手机：设置样式 v15；事项卡片触控加大；更新日志关闭钮与顶 spacer 对齐
- 设置：事项操作行可换行；数据页按钮保持右对齐

### 4.0.1

- 手机设置：恢复 safe-area + 41px 顶栏下沉，与 PlainLedger / BrainCore 对齐
- 手机设置 → 事项：「+ 添加事项 / 导入 / 导出 iCal」同一行（窄屏自动换行），卡片编辑删除与展示提醒紧凑排齐
- 手机设置 → 数据：「查看 / 打开」右对齐
- 手机全屏看板：最后几条可滑到底；只用顶栏关闭，不再和系统 × 叠在刘海上
- 手机顶栏：列表 / 时间轴 / 日历 / 添加加大并可换行；选日期后的筛选单独一行
- 手机编辑：输入 16px；键盘起来后仍能滚到保存；三按钮可换行
- 手机设置：Tab 可换行；事项窄屏卡片；编辑 / 删除始终可见
- 手机日历、试用、更新、提醒：底垫安全区，长内容可滚动
---
## 分发说明
本仓库用于社区插件 / BRAT / GitHub Release 分发与产品介绍，并附带 `src/` 等源码便于社区审核。
仓库：https://github.com/xileshuo/jinianri
