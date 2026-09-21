#!/usr/bin/env python3
import shutil, subprocess, zipfile, os
from pathlib import Path

root = Path("/Users/xile/Projects/纪念日")
pkg = "纪念日-Obsidian插件-v2.9.0"
src_main = root / "release-pack/纪念日-Obsidian插件-v2.7.1/jinianri/main.js"
if not src_main.exists():
    src_main = root / "main.js"

release_src = root / "release-pack" / pkg
jnr = release_src / "jinianri"
jnr.mkdir(parents=True, exist_ok=True)
shutil.copy2(src_main, jnr / "main.js")
shutil.copy2(root / "manifest.json", jnr / "manifest.json")
shutil.copy2(root / "styles.css", jnr / "styles.css")

desktop = Path("/Users/xile/Desktop") / pkg
zip_path = Path("/Users/xile/Desktop") / f"{pkg}.zip"
onedrive = Path("/Users/xile/Library/CloudStorage/OneDrive-个人/大伟哥/Just do it/纪念日") / pkg
onedrive_zip = onedrive.parent / f"{pkg}.zip"

for dest in [desktop, onedrive]:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(release_src, dest)

for zpath, folder in [(zip_path, desktop), (onedrive_zip, onedrive)]:
    if zpath.exists():
        zpath.unlink()
    subprocess.run(["/usr/bin/zip", "-r", "-q", str(zpath), pkg], cwd=str(folder.parent), check=True)

log = Path("/Users/xile/Projects/纪念日/pack-done.txt")
log.write_text(
    f"desktop={desktop}\n"
    f"zip={zip_path} ({zip_path.stat().st_size})\n"
    f"main={desktop/'jinianri/main.js'} ({(desktop/'jinianri/main.js').stat().st_size})\n"
    f"onedrive={onedrive}\n"
)
print(log.read_text())
