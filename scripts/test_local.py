#!/usr/bin/env python3
"""
Local test/validation script for metronome project.
Run: python3 scripts/test_local.py

No dependencies required — uses Python stdlib + Node.js (if available).
"""

import json
import os
import sys
import subprocess
from pathlib import Path

GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

PROJECT_ROOT = Path(__file__).parent.parent
ERRORS = []


def log(msg, color=NC):
    print(f"{color}{msg}{NC}")


def log_ok(msg):
    print(f"  {GREEN}✓{NC} {msg}")


def log_warn(msg):
    print(f"  {YELLOW}⚠{NC} {msg}")


def log_fail(msg):
    print(f"  {RED}✗{NC} {msg}")


def check(name, condition, fail_msg=""):
    if condition:
        log_ok(name)
        return True
    else:
        log_fail(fail_msg or name)
        ERRORS.append(fail_msg or name)
        return False


def run_node_syntax_check(filepath):
    """Check JS syntax using Node.js --check"""
    result = subprocess.run(
        ["node", "--check", str(PROJECT_ROOT / filepath)],
        capture_output=True, text=True
    )
    return result.returncode == 0


def test_js_syntax():
    log("JS Syntax Checks")
    log("-" * 40)
    js_files = [
        "miniapp/pages/index/index.js",
        "miniapp/app.js",
        "js/engine.js",
        "js/prefs.js",
        "sw.js",
    ]
    for f in js_files:
        path = PROJECT_ROOT / f
        if not path.exists():
            check(f"  {f}", False, f"File not found: {f}")
            continue
        ok = run_node_syntax_check(f)
        check(f"  {f}", ok, f"Syntax error in {f}")


def test_json_files():
    log("JSON Validity Checks")
    log("-" * 40)
    json_files = [
        "miniapp/app.json",
        "miniapp/project.config.json",
        "miniapp/sitemap.json",
        "miniapp/pages/index/index.json",
    ]
    for f in json_files:
        path = PROJECT_ROOT / f
        if not path.exists():
            check(f"  {f}", False, f"File not found: {f}")
            continue
        try:
            with open(path) as fp:
                json.load(fp)
            log_ok(f)
        except json.JSONDecodeError as e:
            check(f"  {f}", False, f"JSON error in {f}: {e}")
        except Exception as e:
            check(f"  {f}", False, f"Cannot read {f}: {e}")


def test_file_structure():
    log("File Structure Checks")
    log("-" * 40)
    required = [
        "miniapp/app.js",
        "miniapp/app.json",
        "miniapp/app.wxss",
        "miniapp/project.config.json",
        "miniapp/pages/index/index.js",
        "miniapp/pages/index/index.wxml",
        "miniapp/pages/index/index.wxss",
        "miniapp/pages/index/index.json",
        "miniapp/assets/sounds/click-strong.mp3",
        "miniapp/assets/sounds/click-weak.mp3",
        "miniapp/assets/sounds/click-uniform.mp3",
        "js/engine.js",
        "sw.js",
    ]
    for f in required:
        check(f"  {f}", (PROJECT_ROOT / f).exists(), f"Missing: {f}")


def test_audio_files():
    log("Audio File Checks")
    log("-" * 40)
    sounds_dir = PROJECT_ROOT / "miniapp/assets/sounds"
    if not sounds_dir.exists():
        check("  sounds dir", False, "sounds directory missing")
        return

    mp3_files = list(sounds_dir.glob("*.mp3"))
    total_size = sum(f.stat().st_size for f in mp3_files)

    voice_zh = list((sounds_dir / "voice" / "zh").glob("*.mp3"))
    check(
        f"  {len(voice_zh)} zh voice samples",
        len(voice_zh) >= 16,
        f"Expected 16 zh voice samples, found {len(voice_zh)}"
    )

    # Check file sizes
    for f in mp3_files:
        size = f.stat().st_size
        check(
            f"  {f.name} ({size} bytes)",
            size <= 2_097_152,
            f"{f.name} exceeds 2MB limit"
        )


def test_dead_code():
    log("Dead Code Checks")
    log("-" * 40)
    index_js = PROJECT_ROOT / "miniapp/pages/index/index.js"
    if not index_js.exists():
        check("  index.js exists", False, "index.js not found")
        return

    content = index_js.read_text()

    check(
        "  No playNumber() in code",
        "playNumber" not in content,
        "playNumber() should be removed from index.js"
    )
    check(
        "  voice mode is live",
        "ensureVoice" in content and "sm === 'voice'" in content,
        "voice playback path missing from index.js"
    )

    app_js = (PROJECT_ROOT / "miniapp/app.js").read_text()
    check(
        "  umeng debug is off",
        "debug: false" in app_js and "debug: true" not in app_js,
        "miniapp/app.js must ship with umeng debug: false",
    )

    app_config = json.loads((PROJECT_ROOT / "miniapp/app.json").read_text())
    wxml = (PROJECT_ROOT / "miniapp/pages/index/index.wxml").read_text()
    check(
        "  personal miniapp uses copy-only support entry",
        app_config["pages"] == ["pages/index/index"]
        and 'bindtap="onCopyUrl"' in wxml
        and 'onDonate' not in content
        and 'donate_btn_open' not in wxml
        and not any("<web-view" in p.read_text()
                    for p in (PROJECT_ROOT / "miniapp/pages").rglob("*.wxml")),
        "personal miniapp must copy support links, not open a web-view",
    )

    for rel in ("index.html", "en/index.html", "js/engine.js"):
        src = (PROJECT_ROOT / rel).read_text()
        check(
            f"  no speechSynthesis in {rel}",
            "speechSynthesis" not in src,
            f"{rel} still mentions speechSynthesis",
        )
        check(
            f"  no setInterval beat clock in {rel}",
            "setInterval(tick" not in src and "setInterval(tick," not in src,
            f"{rel} still uses setInterval(tick)",
        )

    engine_src = (PROJECT_ROOT / "js/engine.js").read_text()
    check(
        "  engine start arms playing before init",
        "this.playing = true" in engine_src
        and engine_src.find("this._starting = true") < engine_src.find("this.init()"),
        "start() must set playing/_starting before init()",
    )
    for rel in ("index.html", "en/index.html"):
        body = (PROJECT_ROOT / rel).read_text()
        start = body.split("function start(){", 1)[1].split("function stop()", 1)[0]
        check(
            f"  {rel} sets s.r before engine.start",
            start.find("s.r=true") < start.find("engine.start("),
            f"{rel} still flips s.r only after engine.start resolves",
        )


def test_wxml_buttons():
    log("WXML Button Binding Checks")
    log("-" * 40)
    wxml = PROJECT_ROOT / "miniapp/pages/index/index.wxml"
    if not wxml.exists():
        check("  index.wxml exists", False, "index.wxml not found")
        return

    content = wxml.read_text()
    required_bindings = [
        ("class=\"bean-hit\"", "Share overlay button"),
        ("open-type=\"share\"", "Share open-type"),
        ("bindtap=\"onPlay\"", "Play button"),
        ("bindtap=\"onBpmMinus\"", "BPM- button"),
        ("bindtap=\"onBpmPlus\"", "BPM+ button"),
        ("bindtap=\"onToggleSettings\"", "Settings toggle"),
        ("bindtap=\"onModeChange\"", "Mode change"),
        ("bindtap=\"onTimeSigChange\"", "Time signature change"),
        ("bindtap=\"onApplyCustom\"", "Custom apply"),
        ("bindchanging=\"onBpmChanging\"", "BPM slider changing (real-time feedback)"),
        ("bindchange=\"onVolChange\"", "Volume slider"),
        ("data-mode=\"voice\"", "Voice mode button"),
    ]
    for binding, desc in required_bindings:
        check(f"  {desc}", binding in content, f"Missing: {binding}")


def test_web_app_hooks():
    log("Web app hooks")
    log("-" * 40)
    for rel in ("index.html", "en/index.html"):
        src = (PROJECT_ROOT / rel).read_text()
        check(f"  {rel} loads MetronomeEngine", "MetronomeEngine" in src and 'src="/js/engine.js"' in src)
        check(f"  {rel} loads MetronomePrefs", "MetronomePrefs" in src and 'src="/js/prefs.js"' in src)
        check(
            f"  {rel} does not raw-parse metronome storage",
            'JSON.parse(localStorage.getItem("metronome")' not in src,
        )
        check(f"  {rel} has #vol-slider", 'id="vol-slider"' in src)
        check(f"  {rel} registers service worker", "serviceWorker.register" in src)
        check(f"  {rel} has play button", 'id="play-btn"' in src)
        for mode in ("traditional", "uniform", "voice"):
                check(f"  {rel} exposes {mode}", f'data-mode="{mode}"' in src)
    en_html = (PROJECT_ROOT / "en/index.html").read_text()
    check(
        "  en footer has no leaked CSS",
        "</style> 0.06)" not in en_html and "border-top-color: rgba(255, 255, 255, 0.1)" not in en_html,
        "en/index.html still leaks broken footer CSS into the page",
    )


def test_en_brand_bunny():
    log("English brand (Bunny Metronome)")
    log("-" * 40)
    tpl = (PROJECT_ROOT / "tools/template_en.html").read_text()
    check("  template_en og:site_name Bunny Metronome", 'og:site_name" content="Bunny Metronome"' in tpl)
    check("  template_en JSON-LD name Bunny Metronome", '"name": "Bunny Metronome"' in tpl)
    check(
        "  template_en keeps historical alternateName",
        '"alternateName": "Little Rabbit Metronome"' in tpl,
    )
    pages = sorted((PROJECT_ROOT / "en/p").glob("*.html"))
    check("  en/p has 10 pages", len(pages) == 10)
    for p in pages:
        body = p.read_text()
        check(f"  {p.name} site_name Bunny", 'og:site_name" content="Bunny Metronome"' in body)
        check(f"  {p.name} JSON-LD name Bunny", '"name": "Bunny Metronome"' in body)
        check(f"  {p.name} not titled Little Rabbit Metronome", "— Little Rabbit Metronome" not in body)
        check(f"  {p.name} keeps slug path", f"/en/p/{p.stem}.html" in body)
    en_index = (PROJECT_ROOT / "en/index.html").read_text()
    check("  en/index.jsonld name Bunny", '"name": "Bunny Metronome"' in en_index)
    landing = (PROJECT_ROOT / "en/landing.html").read_text()
    check("  en/landing title Bunny", "Bunny Metronome" in landing.split("<title>", 1)[1][:80])
    check("  en/landing alternateName history", '"alternateName": "Little Rabbit Metronome"' in landing)


def test_sw_fetch_handler():
    log("Service worker fetch handler")
    log("-" * 40)
    result = subprocess.run(
        ["node", str(PROJECT_ROOT / "scripts" / "test_sw_fetch.js")],
        capture_output=True, text=True
    )
    check(
        "  scripts/test_sw_fetch.js executes sw.js fetch handler",
        result.returncode == 0,
        result.stdout + result.stderr or "sw fetch handler test failed",
    )


def test_miniapp_config():
    log("MiniApp Config Checks")
    log("-" * 40)
    config = PROJECT_ROOT / "miniapp/project.config.json"
    try:
        with open(config) as fp:
            data = json.load(fp)
        appid = data.get("appid", "")
        if not appid or appid == "YOUR_APPID_HERE":
            log_warn(f"  project.config.json has placeholder AppID (needed for upload)")
        else:
            log_ok(f"  AppID configured ({appid})")
    except Exception as e:
        check("  project.config.json readable", False, str(e))


def main():
    print()
    log("🐰 小兔头节拍器 - 本地验证", GREEN)
    log("=" * 50)
    print()

    test_file_structure()
    print()
    test_js_syntax()
    print()
    test_json_files()
    print()
    test_audio_files()
    print()
    test_dead_code()
    print()
    test_wxml_buttons()
    print()
    test_web_app_hooks()
    print()
    test_en_brand_bunny()
    print()
    test_sw_fetch_handler()
    print()
    test_miniapp_config()
    print()

    log("=" * 50)
    if ERRORS:
        log(f"❌ Failed with {len(ERRORS)} error(s):", RED)
        for e in ERRORS:
            print(f"  - {e}")
        sys.exit(1)
    else:
        log("✅ All checks passed!", GREEN)

    print()


if __name__ == "__main__":
    main()