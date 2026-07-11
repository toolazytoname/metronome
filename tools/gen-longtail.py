#!/usr/bin/env python3
"""
gen-longtail.py — render the 10 long-tail landing pages from tools/longtail.json.

Outputs:
  p/<slug>.html       (Chinese, paired with /p/longtail.css)
  en/p/<slug>.html    (English, paired via /p/longtail.css with ../p/ relative path)

Run from the metronome repo root:
  python3 tools/gen-longtail.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "tools" / "longtail.json"
TPL_ZH = ROOT / "tools" / "template_zh.html"
TPL_EN = ROOT / "tools" / "template_en.html"
OUT_ZH = ROOT / "p"
OUT_EN = ROOT / "en" / "p"

# Mapping between the slug's "audio mode" enum stored in our config
# and the data-mode attribute the live app expects. We keep the same
# three values: traditional / uniform / voice.
MODE_PARAM = {
    "traditional": "traditional",
    "uniform": "uniform",
    "voice": "voice",
}

def render(tpl_path, item, lang):
    tpl = tpl_path.read_text()
    out = (
        tpl
        .replace("{{TITLE}}", item["title_zh"] if lang == "zh" else item["title_en"])
        .replace("{{DESC}}", item["desc_zh"] if lang == "zh" else item["desc_en"])
        .replace("{{NARRATIVE}}", item["narrative_zh"] if lang == "zh" else item["narrative_en"])
        .replace("{{SLUG}}", item["slug"])
        .replace("{{BPM}}", str(item["bpm"]))
        .replace("{{SIG}}", item["sig"])
        .replace("{{MODE}}", MODE_PARAM[item["mode"]])
        .replace("{{MODE_LABEL}}", item["mode_label_zh"] if lang == "zh" else item["mode_label_en"])
    )
    return out

def main():
    items = json.loads(DATA.read_text())
    OUT_ZH.mkdir(parents=True, exist_ok=True)
    OUT_EN.mkdir(parents=True, exist_ok=True)
    if not TPL_ZH.exists() or not TPL_EN.exists():
        print(f"missing templates: {TPL_ZH} or {TPL_EN}", file=sys.stderr)
        sys.exit(1)
    for it in items:
        z = render(TPL_ZH, it, "zh")
        e = render(TPL_EN, it, "en")
        (OUT_ZH / f"{it['slug']}.html").write_text(z)
        (OUT_EN / f"{it['slug']}.html").write_text(e)
    print(f"rendered {len(items)} x 2 = {len(items)*2} pages")

if __name__ == "__main__":
    main()
