#!/bin/bash
# 补全 dist 里缺的 main.js / styles.css（在项目目录执行）
set -e
ROOT="/Users/xile/Projects/jinianri"
for dir in "公版（商）" "个人版"; do
  cp "$ROOT/styles.css" "$ROOT/dist/$dir/styles.css"
  cp "$ROOT/main.js" "$ROOT/dist/$dir/main.js"
done
sed -i '' 's/const PLUGIN_REQUIRE_LICENSE = true/const PLUGIN_REQUIRE_LICENSE = false/' "$ROOT/dist/个人版/main.js"
echo "✅ dist 已补全 main.js + styles.css"
echo "公版：$ROOT/dist/公版（商）"
echo "个人：$ROOT/dist/个人版"
