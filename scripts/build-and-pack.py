#!/usr/bin/env python3
"""Build main.js and pack 公版/个人版 release packages."""
import json
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path("/Users/xile/Projects/纪念日")
VERSION = json.loads((ROOT / "manifest.json").read_text())["version"]
OUTPUTS = [
    Path("/Users/xile/Desktop"),
    Path("/Users/xile/Library/CloudStorage/OneDrive-个人/大伟哥/Just do it/纪念日"),
]
VARIANTS = [
    ("public", "公版", "新用户安装包，含默认提醒设置 + 3 条示例纪念事项"),
    ("personal", "个人版", "已预填你的 14 条纪念事项与个人设置"),
]
VAULT_PLUGIN = Path(
    "/Users/xile/Library/Mobile Documents/iCloud~md~obsidian/Documents/"
    "大鹏一日同风起/.obsidian/plugins/jinianri"
)


def run_build():
    print("Building main.js …")
    r = subprocess.run(
        ["npm", "run", "build"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    print(r.stdout or r.stderr)
    if r.returncode != 0:
        raise SystemExit(f"build failed: {r.returncode}")
    main = ROOT / "main.js"
    if not main.exists() or main.stat().st_size < 100_000:
        raise SystemExit("main.js missing or too small after build")
    text = main.read_text(encoding="utf-8", errors="replace")
    if "events.json" not in text:
        raise SystemExit("main.js does not contain events.json — build stale?")


def zip_dir(src: Path, zip_path: Path):
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in src.rglob("*"):
            if f.is_file() and f.name != ".DS_Store":
                zf.write(f, f.relative_to(src.parent))


def pack_variants():
    main_src = ROOT / "main.js"
    for asset_id, suffix, desc in VARIANTS:
        pkg_name = f"纪念日-Obsidian插件-v{VERSION}-{suffix}"
        pkg = ROOT / "release-pack" / pkg_name
        jnr = pkg / "jinianri"
        assets = ROOT / "release-pack" / "assets" / asset_id

        if pkg.exists():
            shutil.rmtree(pkg)
        jnr.mkdir(parents=True)

        shutil.copy2(main_src, jnr / "main.js")
        shutil.copy2(ROOT / "styles.css", jnr / "styles.css")
        shutil.copy2(ROOT / "manifest.json", jnr / "manifest.json")
        shutil.copy2(assets / "data.json", jnr / "data.json")
        shutil.copy2(assets / "events.json", jnr / "events.json")

        (pkg / "安装说明.md").write_text(
            f"# 纪念日 · 安装说明（{suffix}）\n\n版本 {VERSION} · {desc}\n\n"
            "插件目录需含：manifest.json、main.js、styles.css、data.json（设置）、events.json（纪念事项）。\n",
            encoding="utf-8",
        )

        for out in OUTPUTS:
            out.mkdir(parents=True, exist_ok=True)
            dest = out / pkg_name
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(pkg, dest)
            zip_path = out / f"{pkg_name}.zip"
            zip_dir(dest, zip_path)
            print(f"✅ {suffix}: {dest}")
            print(f"   main.js { (dest / 'jinianri' / 'main.js').stat().st_size } bytes")
            print(f"✅ {suffix}: {zip_path} ({zip_path.stat().st_size} bytes)")


def deploy_personal_to_vault():
    personal = ROOT / "release-pack" / f"纪念日-Obsidian插件-v{VERSION}-个人版" / "jinianri"
    if not personal.exists():
        raise SystemExit("personal pack not found")
    VAULT_PLUGIN.mkdir(parents=True, exist_ok=True)
    for name in ("main.js", "styles.css", "manifest.json", "data.json", "events.json"):
        shutil.copy2(personal / name, VAULT_PLUGIN / name)
    print(f"✅ 个人版已部署到库: {VAULT_PLUGIN}")


if __name__ == "__main__":
    run_build()
    pack_variants()
    deploy_personal_to_vault()
    print("\n完成。")
