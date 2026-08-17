#!/usr/bin/env python3
"""Generate metronome clicks + pre-rendered count samples.

Clicks are synthesized (woodblock-ish, peak ≈ -3 dBFS).
Counts are rendered once via edge-tts (zh-CN-XiaoyiNeural / en-US-AnaNeural),
then trimmed, peak-normalized, and time-fit so they can sit on a beat.

Requires: numpy, ffmpeg, edge-tts
"""
from __future__ import annotations

import array
import math
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_OUT = ROOT / "assets" / "sounds"
MINI_OUT = ROOT / "miniapp" / "assets" / "sounds"

SR = 44100
ZH_VOICE = "zh-CN-XiaoyiNeural"
EN_VOICE = "en-US-AnaNeural"

ZH = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
      "十一", "十二", "十三", "十四", "十五", "十六"]
EN = ["one", "two", "three", "four", "five", "six", "seven", "eight",
      "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
      "fifteen", "sixteen"]


def write_wav(path: Path, samples, sr: int = SR) -> None:
    samples = [max(-1.0, min(1.0, float(x))) for x in samples]
    pcm = array.array("h", (int(x * 32767) for x in samples))
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def read_wav(path: Path):
    with wave.open(str(path), "r") as w:
        sr = w.getframerate()
        nch = w.getnchannels()
        raw = w.readframes(w.getnframes())
    data = array.array("h")
    data.frombytes(raw)
    if nch == 2:
        data = data[0::2]
    return [x / 32768.0 for x in data], sr


def peak_normalize(samples, peak_db: float = -3.0):
    peak = max((abs(x) for x in samples), default=0.0)
    if peak < 1e-6:
        return samples
    target = 10 ** (peak_db / 20.0)
    g = target / peak
    return [x * g for x in samples]


def trim_silence(samples, sr: int, thresh: float = 0.018, pad_ms: float = 4.0):
    first = next((i for i, x in enumerate(samples) if abs(x) > thresh), 0)
    last = len(samples) - 1 - next(
        (i for i, x in enumerate(reversed(samples)) if abs(x) > thresh), 0
    )
    pad = int(sr * pad_ms / 1000)
    first = max(0, first - pad)
    last = min(len(samples) - 1, last + pad)
    return samples[first:last + 1]


def fade(samples, sr: int, in_ms: float = 0.4, out_ms: float = 12.0):
    n = len(samples)
    fi = max(1, int(sr * in_ms / 1000))
    fo = max(1, int(sr * out_ms / 1000))
    out = list(samples)
    for i in range(min(fi, n)):
        out[i] *= i / fi
    for i in range(min(fo, n)):
        out[n - 1 - i] *= i / fo
    return out


def time_fit(samples, sr: int, max_ms: float):
    dur = len(samples) / sr * 1000
    if dur <= max_ms or len(samples) < 8:
        return samples
    target = int(sr * max_ms / 1000)
    # linear resample = speed up (keeps pitch roughly, fine for counts)
    out = []
    for i in range(target):
        src = i * (len(samples) - 1) / (target - 1)
        lo = int(src)
        hi = min(lo + 1, len(samples) - 1)
        t = src - lo
        out.append(samples[lo] * (1 - t) + samples[hi] * t)
    return out


def to_mp3(wav: Path, mp3: Path, bitrate: str = "80k") -> None:
    mp3.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav), "-ac", "1", "-ar", "22050",
         "-b:a", bitrate, "-q:a", "5", str(mp3)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {wav}: {r.stderr[-400:]}")


def synth_click(freqs, decay: float, noise_ms: float, tick_hz: float,
                peak_db: float = -3.0, length_ms: float = 55.0):
    n = int(SR * length_ms / 1000)
    y = [0.0] * n
    for i, f in enumerate(freqs):
        amp = 0.85 / (i + 1) ** 0.7
        for k in range(n):
            t = k / SR
            y[k] += amp * math.sin(2 * math.pi * f * t) * math.exp(-t / decay)
    nlen = int(SR * noise_ms / 1000)
    # deterministic noise so regenerating the script is stable
    seed = 1
    for k in range(nlen):
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        noise = (seed / 0x7fffffff) * 2 - 1
        t = k / SR
        # high-passed-ish: emphasize differences + short env
        y[k] += 0.55 * noise * math.exp(-t / 0.0035)
    for k in range(n):
        t = k / SR
        y[k] += 0.28 * math.sin(2 * math.pi * tick_hz * t) * math.exp(-t / 0.007)
    y = fade(y, SR, in_ms=0.25, out_ms=10)
    return peak_normalize(y, peak_db)


def write_click(name: str, samples) -> Path:
    tmp = Path(tempfile.mkdtemp()) / f"{name}.wav"
    write_wav(tmp, samples)
    dest = WEB_OUT / f"{name}.mp3"
    to_mp3(tmp, dest, "96k")
    return dest


def edge_tts(text: str, voice: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["edge-tts", "--voice", voice, "--rate=+18%", "--pitch=+8Hz",
         "--text", text, "--write-media", str(dest)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"edge-tts failed ({voice} {text!r}): {r.stderr or r.stdout}")


def render_count(text: str, voice: str, dest_mp3: Path, max_ms: float) -> None:
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.mp3"
        wav = Path(td) / "raw.wav"
        edge_tts(text, voice, raw)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(raw), "-ac", "1", "-ar", str(SR), str(wav)],
            capture_output=True, check=True,
        )
        samples, sr = read_wav(wav)
        samples = trim_silence(samples, sr, thresh=0.02, pad_ms=3)
        samples = time_fit(samples, sr, max_ms)
        samples = fade(samples, sr, in_ms=0.4, out_ms=14)
        samples = peak_normalize(samples, -3.0)
        out_wav = Path(td) / "out.wav"
        write_wav(out_wav, samples, sr)
        to_mp3(out_wav, dest_mp3, "64k")


def copy_tree_to_miniapp() -> None:
    MINI_OUT.mkdir(parents=True, exist_ok=True)
    for name in ("click-strong.mp3", "click-weak.mp3", "click-uniform.mp3"):
        shutil.copy2(WEB_OUT / name, MINI_OUT / name)
        # keep old names as aliases so leftover docs/tools don't 404
        alias = {
            "click-strong.mp3": "beat-strong.mp3",
            "click-weak.mp3": "beat-weak.mp3",
            "click-uniform.mp3": "beat-uniform.mp3",
        }[name]
        shutil.copy2(WEB_OUT / name, MINI_OUT / alias)
    for lang in ("zh", "en"):
        src = WEB_OUT / "voice" / lang
        dst = MINI_OUT / "voice" / lang
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)


def main() -> int:
    if not shutil.which("ffmpeg"):
        print("ffmpeg is required", file=sys.stderr)
        return 1
    if not shutil.which("edge-tts"):
        print("edge-tts is required (pip install edge-tts)", file=sys.stderr)
        return 1

    WEB_OUT.mkdir(parents=True, exist_ok=True)

    print("== clicks ==")
    strong = synth_click([980, 1490, 2380], decay=0.016, noise_ms=3.2,
                         tick_hz=3200, peak_db=-3.0, length_ms=48)
    weak = synth_click([1680, 2520], decay=0.011, noise_ms=2.4,
                       tick_hz=3800, peak_db=-4.5, length_ms=36)
    uniform = synth_click([1240, 1860, 2740], decay=0.013, noise_ms=2.8,
                          tick_hz=3400, peak_db=-3.5, length_ms=42)
    for name, samples in (
        ("click-strong", strong),
        ("click-weak", weak),
        ("click-uniform", uniform),
    ):
        dest = write_click(name, samples)
        print(f"  {dest.relative_to(ROOT)}  {dest.stat().st_size} bytes")

    print("== voice zh (Xiaoyi) ==")
    for i, text in enumerate(ZH, start=1):
        max_ms = 230 if i <= 10 else 270
        dest = WEB_OUT / "voice" / "zh" / f"{i:02d}.mp3"
        render_count(text, ZH_VOICE, dest, max_ms)
        print(f"  {text:4} -> {dest.relative_to(ROOT)}  {dest.stat().st_size}B")

    print("== voice en (Ana) ==")
    for i, text in enumerate(EN, start=1):
        max_ms = 230 if i <= 10 else 270
        dest = WEB_OUT / "voice" / "en" / f"{i:02d}.mp3"
        render_count(text, EN_VOICE, dest, max_ms)
        print(f"  {text:10} -> {dest.relative_to(ROOT)}  {dest.stat().st_size}B")

    print("== copy to miniapp ==")
    copy_tree_to_miniapp()
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
