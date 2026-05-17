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
        "miniapp/assets/sounds/beat-strong.mp3",
        "miniapp/assets/sounds/beat-weak.mp3",
        "miniapp/assets/sounds/beat-uniform.mp3",
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

    # Check no voice files
    voice_files = list(sounds_dir.glob("voice-*.mp3"))
    check(
        "  No voice-*.mp3 files",
        len(voice_files) == 0,
        f"Found {len(voice_files)} voice files (should be deleted)"
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

    # Check voice mode guard is still present (safe — prevents edge cases)
    # This is a WARNING, not a failure
    if "voice" in content and "onModeChange" in content:
        log_warn("  voice mode guard found in onModeChange (OK - prevents edge cases)")


def test_wxml_buttons():
    log("WXML Button Binding Checks")
    log("-" * 40)
    wxml = PROJECT_ROOT / "miniapp/pages/index/index.wxml"
    if not wxml.exists():
        check("  index.wxml exists", False, "index.wxml not found")
        return

    content = wxml.read_text()
    required_bindings = [
        ("bindtap=\"onPlay\"", "Play button"),
        ("bindtap=\"onBpmMinus\"", "BPM- button"),
        ("bindtap=\"onBpmPlus\"", "BPM+ button"),
        ("bindtap=\"onToggleSettings\"", "Settings toggle"),
        ("bindtap=\"onModeChange\"", "Mode change"),
        ("bindtap=\"onTimeSigChange\"", "Time signature change"),
        ("bindtap=\"onApplyCustom\"", "Custom apply"),
        ("bindchanging=\"onBpmChanging\"", "BPM slider changing (real-time feedback)"),
    ]
    for binding, desc in required_bindings:
        check(f"  {desc}", binding in content, f"Missing: {binding}")


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