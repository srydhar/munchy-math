#!/usr/bin/env python3
"""
Munchy Math -> CrazyGames build packager.

Usage:
    python3 build_crazygames_zip.py /path/to/munchy-math-repo

What it does:
  1. Reads index.html from your repo folder
  2. Injects <script src="munchy-cg-adapter.js"></script> just before </body>
     (skips if already present)
  3. Removes any service-worker registration (not wanted inside the portal)
  4. Copies index.html + munchy-cg-adapter.js + icon PNGs into ./cg-build/
  5. Zips it all into munchy-math-crazygames.zip  (upload this to
     developer.crazygames.com)

The adapter file must sit next to this script.
"""
import os, re, shutil, sys, zipfile

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 build_crazygames_zip.py /path/to/munchy-math-repo")
        sys.exit(1)
    repo = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    adapter_src = os.path.join(here, "munchy-cg-adapter.js")
    index_src = os.path.join(repo, "index.html")
    if not os.path.exists(index_src):
        sys.exit("index.html not found in " + repo)
    if not os.path.exists(adapter_src):
        sys.exit("munchy-cg-adapter.js not found next to this script")

    html = open(index_src, encoding="utf-8").read()

    # 1. strip service-worker registration (whole register()...then()...catch(); chain)
    html, n_sw = re.subn(
        r"navigator\.serviceWorker\.register\([\s\S]*?\}\);",
        "/* sw disabled for portal build */", html)

    # 2. inject adapter before </body> (once)
    tag = '<script src="munchy-cg-adapter.js"></script>'
    if tag not in html:
        if "</body>" not in html:
            sys.exit("No </body> tag found — is this the right index.html?")
        html = html.replace("</body>", tag + "\n</body>", 1)

    # 3. assemble build folder
    build = os.path.join(here, "cg-build")
    if os.path.exists(build):
        shutil.rmtree(build)
    os.makedirs(build)
    open(os.path.join(build, "index.html"), "w", encoding="utf-8").write(html)
    shutil.copy(adapter_src, build)
    for f in os.listdir(repo):
        if re.match(r"icon-\d+\.png$", f):
            shutil.copy(os.path.join(repo, f), build)
    # splash-screen assets used by the adapter's intro sequence
    for extra in ("studio-logo.png", "munchy-face.png"):
        extra_src = os.path.join(repo, extra)
        if os.path.exists(extra_src):
            shutil.copy(extra_src, build)

    # 4. zip
    zpath = os.path.join(here, "munchy-math-crazygames.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(build)):
            z.write(os.path.join(build, f), f)

    size_mb = os.path.getsize(zpath) / 1e6
    print("OK: removed %d service-worker registration(s)" % n_sw)
    print("OK: adapter injected")
    print("OK: %s (%.2f MB, %d files)" % (zpath, size_mb, len(os.listdir(build))))
    print("\nUpload this zip at https://developer.crazygames.com -> Submit a game")

if __name__ == "__main__":
    main()
