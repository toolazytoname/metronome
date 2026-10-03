#!/usr/bin/env python3
"""Dependency-free repository consistency checks (no production/account access)."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).digest()


def main():
    source = ROOT / 'assets/sounds'
    samples = list(source.rglob('*.mp3'))
    check(len(samples) == 92, 'expected 35 free and 57 pack samples')
    for folder, include_pack in [('miniapp/assets/sounds', False),
                                 ('ios/BunnyMetronome/Sounds', True),
                                 ('android/app/src/main/assets/sounds', True)]:
        expected = {p.relative_to(source) for p in samples
                    if include_pack or 'pack' not in p.relative_to(source).parts}
        dest = ROOT / folder
        actual = {p.relative_to(dest) for p in dest.rglob('*.mp3')}
        check(actual == expected, f'{folder}: missing or unexpected samples')
        for rel in expected:
            check(digest(source / rel) == digest(dest / rel), f'{folder}: sample drift: {rel}')
        print(f'ok {folder}: {len(expected)} byte-identical samples')

    keys = None
    for lang in ['zh', 'en']:
        table = json.loads((ROOT / f'packages/strings/{lang}.json').read_text())
        check(all(isinstance(v, str) and v for v in table.values()), f'{lang}: empty strings')
        check(keys is None or keys == table.keys(), 'zh/en key mismatch')
        keys = table.keys()
        for folder in ['ios/BunnyMetronome/Strings', 'android/app/src/main/assets/strings']:
            check(json.loads((ROOT / folder / f'{lang}.json').read_text()) == table, f'{folder}/{lang}: string drift')
        print(f'ok {lang}: {len(keys)} keys, native copies match source')

    ignore = (ROOT / '.vercelignore').read_text().splitlines()
    for folder in ['ios/', 'android/', 'harmony/', 'miniapp/', 'docs/', '.claude/']:
        check(folder in ignore, 'native/private directory not excluded from web: ' + folder)
    print('ok web deployment excludes native sources and local tooling')

    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    forbidden = re.compile(r'\.(?:p8|p12|pfx|jks|keystore|mobileprovision)$|(?:^|/)(?:Secrets\.xcconfig|play-service-account\.json)$', re.I)
    private_key = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----')
    for name in filter(None, tracked):
        check(not forbidden.search(name), 'sensitive file tracked: ' + name)
        p = ROOT / name
        if p.is_file() and p.stat().st_size < 2_000_000:
            check(not private_key.search(p.read_bytes()), 'private key marker in: ' + name)
    print('ok tracked signing-file / private-key-marker check (not a complete secret audit)')

    for rel in ['index.html', 'en/index.html']:
        page = (ROOT / rel).read_text()
        check('id="settings-panel" inert aria-hidden="true"' in page, rel + ': collapsed panel must be inert')
        check(len(re.findall(r'<button[^>]+data-mode=', page)) == 3, rel + ': sound modes must be keyboard buttons')
        for control in ['bpm-slider', 'bpm-minus', 'bpm-plus', 'custom-beats', 'custom-unit']:
            check(re.search(r'id="' + control + r'"[^>]*aria-label=', page), rel + ': unnamed ' + control)
    print('ok bilingual web control semantics')
    worker = (ROOT / 'sw.js').read_text()
    for script in ['engine', 'prefs', 'diagnostics']:
        version = hashlib.sha256((ROOT / f'js/{script}.js').read_bytes()).hexdigest()[:12]
        url = f'/js/{script}.js?v={version}'
        for rel in ['index.html', 'en/index.html']:
            check(f'src="{url}"' in (ROOT / rel).read_text(), f'{rel}: stale script version URL')
        check(f"'{url}'" in worker, f'SW missing versioned {script} precache')
    print('ok content-versioned scripts match zh/en HTML and SW precache')


if __name__ == '__main__':
    main()

config = json.loads((ROOT / 'vercel.json').read_text())
for route in ['/', '/en/:path*', '/(index|landing|en/index|en/landing).html']:
    entry = next(x for x in config['headers'] if x['source'] == route)
    assert 'max-age=0' in next(x['value'] for x in entry['headers'] if x['key'] == 'Cache-Control')
for rel in ['index.html', 'en/index.html']:
    html = (ROOT / rel).read_text()
    assert 'Web 2026.10.03.3' in html and 'id="diagnostics"' in html
    assert html.index('/js/diagnostics.js?v=') < html.index('/js/engine.js?v=')
print('ok practice HTML revalidation and diagnostic boot order / release label')
