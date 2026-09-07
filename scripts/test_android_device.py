#!/usr/bin/env python3
"""Run one Android instrumentation method. Does not loop the suite.

Success is JUnit OK + INSTRUMENTATION_CODE:-1 with no shortMsg/FAILURES/fail/skip
status. Shell exit 0 is not green.

Example:
  python3 scripts/test_android_device.py \\
    --serial 5c9a424d \\
    --method a01_playRecreateThenPauseReleasesFgs \\
    --evidence-dir /tmp/jpq-a01-run
"""

from __future__ import annotations

import argparse
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

PKG = "studio.weichao.jpq"
RUNNER = "studio.weichao.jpq.test/androidx.test.runner.AndroidJUnitRunner"
TEST_CLASS = "studio.weichao.jpq.DeviceAcceptanceTest"

# AndroidJUnitRunner: 1 start, 0 pass, -2 fail, -3 ignored, -4 assumption.
FAIL_OR_SKIP_CODES = {-1, -2, -3, -4}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--serial", required=True, help="adb device serial")
    p.add_argument(
        "--method",
        required=True,
        help="Test method name, or Class#method",
    )
    p.add_argument(
        "--evidence-dir",
        required=True,
        help="Empty new directory for this run's logs",
    )
    p.add_argument(
        "--timeout",
        type=int,
        default=180,
        help="Seconds to wait for am instrument (default 180)",
    )
    args = p.parse_args()
    try:
        class_method(args.method)
    except ValueError as exc:
        p.error(str(exc))
    if not 1 <= args.timeout <= 600:
        p.error('--timeout must be 1..600 seconds')
    return args


def class_method(raw: str) -> str:
    method = raw.removeprefix(TEST_CLASS + "#")
    if not re.fullmatch(r"a[0-9]+_[A-Za-z0-9_]+", method):
        raise ValueError('Choose one DeviceAcceptanceTest method; lists/classes/shell syntax are not allowed')
    return f"{TEST_CLASS}#{method}"


def adb(serial: str, *args: str, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["adb", "-s", serial, *args],
        text=True,
        capture_output=True,
        timeout=timeout,
    )


def kill_group(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait(timeout=2)


def package_logcat(serial: str) -> str:
    # UID filtering prevents unrelated apps' AndroidRuntime/TestRunner messages
    # from leaking into the evidence, including after the target process exits.
    packages = adb(serial, "shell", "cmd", "package", "list", "packages", "-U", PKG)
    match = re.search(r"^package:" + re.escape(PKG) + r" uid:(\d+)$", packages.stdout, re.M)
    if packages.returncode or not match:
        return "Target UID unavailable; package logs NOT CAPTURED.\n"
    result = adb(serial, "logcat", "-d", "-b", "main", "-b", "crash",
                 "--uid=" + match.group(1), "-s", "JpqDevice:I", "TestRunner:I", "AndroidRuntime:E", "*:S")
    if result.returncode:
        return "Package log capture failed: " + result.stderr
    return "\n".join(result.stdout.splitlines()[-400:]) + "\n"


def verdict(instrument_out: str) -> tuple[bool, str]:
    codes = [int(x) for x in re.findall(r"INSTRUMENTATION_STATUS_CODE:\s*(-?\d+)", instrument_out)]
    inst_code = re.findall(r"INSTRUMENTATION_CODE:\s*(-?\d+)", instrument_out)
    has_ok = bool(re.search(r"^OK \(1 test\)\s*$", instrument_out, re.M))
    has_short = bool(re.search(r"shortMsg\s*=", instrument_out))
    has_failures = "FAILURES!!!" in instrument_out or "Error in " in instrument_out
    bad_status = [c for c in codes if c in FAIL_OR_SKIP_CODES]
    if not has_ok:
        return False, "missing JUnit OK (N tests)"
    if inst_code != ["-1"]:
        return False, f"INSTRUMENTATION_CODE={inst_code or ['missing']} want [-1]"
    if has_short:
        return False, "shortMsg present"
    if has_failures:
        return False, "FAILURES/Error in present"
    if bad_status:
        return False, f"fail/skip STATUS_CODE={bad_status}"
    if codes != [1, 0]:
        return False, f"expected exactly one started/passed method [1,0], saw {codes}"
    return True, "JUnit OK + INSTRUMENTATION_CODE:-1, no fail/skip/shortMsg"


def main() -> int:
    args = parse_args()
    evidence = Path(args.evidence_dir)
    if evidence.exists():
        if any(evidence.iterdir()):
            print(f"evidence dir not empty: {evidence}", file=sys.stderr)
            return 2
    else:
        evidence.mkdir(parents=True)

    target = class_method(args.method)
    instrument_log = evidence / "instrument.txt"
    status_log = evidence / "status.txt"
    logcat_log = evidence / "package-logcat.txt"
    proc: subprocess.Popen | None = None
    timed_out = False
    cleanup_ok = False
    ok, reason = False, "test not completed"
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    cmd = [
        "adb",
        "-s",
        args.serial,
        "shell",
        "am",
        "instrument",
        "-w",
        "-r",
        "-e",
        "class",
        target,
        RUNNER,
    ]
    (evidence / "cmd.txt").write_text(" ".join(cmd) + "\n", encoding="utf-8")
    try:
        (evidence / "logcat-before.txt").write_text(package_logcat(args.serial), encoding="utf-8")
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        try:
            out, _ = proc.communicate(timeout=args.timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            kill_group(proc)
            tail, _ = proc.communicate(timeout=5)
            out = (tail or "") + f"\nTIMEOUT after {args.timeout}s\n"
        instrument_log.write_text(out or "", encoding="utf-8")
        ok, reason = verdict(out or "")
        if timed_out:
            ok, reason = False, f"timeout {args.timeout}s"
        # Shell success is necessary but never sufficient.
        shell_rc = proc.returncode if proc.returncode is not None else 124
        if shell_rc != 0:
            ok, reason = False, f"adb exited {shell_rc}; {reason}"
    finally:
        if proc is not None and proc.poll() is None:
            kill_group(proc)
        try:
            stop = adb(args.serial, "shell", "am", "force-stop", PKG)
            status = adb(args.serial, "shell", "pidof", PKG)
            svc = adb(args.serial, "shell", "dumpsys", "activity", "services", PKG)
            pid = (status.stdout or "").strip() or "none"
            cleanup_ok = (stop.returncode == 0 and status.returncode in (0, 1)
                          and pid == "none" and svc.returncode == 0
                          and "ServiceRecord{" not in svc.stdout)
            status_log.write_text(
                f"cleanup_ok={cleanup_ok}\nforce-stop_rc={stop.returncode}\npid={pid}\n{svc.stdout[:2000]}\n",
                encoding="utf-8",
            )
        except Exception as exc:
            status_log.write_text(f"cleanup error: {exc}\n", encoding="utf-8")
        try:
            logcat_log.write_text(package_logcat(args.serial), encoding="utf-8")
        except Exception:
            pass
    if not cleanup_ok:
        ok, reason = False, reason + "; cleanup not verified"
    (evidence / "verdict.txt").write_text(
        f"started={started}\nmethod={target}\nok={ok}\nreason={reason}\n"
        f"shell_rc={proc.returncode if proc else 'not-started'}\ntimeout={timed_out}\ncleanup_ok={cleanup_ok}\n",
        encoding="utf-8",
    )
    print(f"{'PASS' if ok else 'FAIL'} {target} {reason}")
    return 0 if ok else 1


def interrupted(signum, frame):
    raise KeyboardInterrupt(f"received signal {signum}")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    sys.exit(main())
