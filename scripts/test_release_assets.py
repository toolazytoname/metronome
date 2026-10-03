#!/usr/bin/env python3
"""Run the actual Release collection shell with disposable fake build outputs.
No signing, network, tags, or release publishing is performed.
"""
import os
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
workflow = (root / '.github/workflows/release.yml').read_text()
block = workflow.split('      - name: Collect APKs and AAB\n        run: |\n', 1)[1].split('\n      - ', 1)[0]
script = '\n'.join(line[10:] for line in block.splitlines())
for signed in (False, True):
    with tempfile.TemporaryDirectory(prefix='metronome-release-test-') as directory:
        paths = ['apk/play/debug/app-play-debug.apk']
        if signed:
            paths += ['apk/play/release/app-play-release.apk', 'bundle/playRelease/app-play-release.aab']
        for relative in paths:
            target = Path(directory, 'android/app/build/outputs', relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(relative)
        subprocess.run(['bash', '-eu', '-c', script], cwd=directory,
                       env={**os.environ, 'VERSION_NAME': 'test'}, check=True)
        collected = sorted(p.name for p in Path(directory, 'dist').iterdir())
        expected = ['BunnyMetronome-test-debug.apk']
        if signed:
            expected += ['BunnyMetronome-test.aab', 'BunnyMetronome-test.apk']
        assert collected == sorted(expected), (signed, collected, expected)
        print('ok release collection:', 'signed + debug' if signed else 'debug only')
