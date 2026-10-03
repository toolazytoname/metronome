#!/usr/bin/env bash
# Optional local regression entry point, not a Web build step or release command.
# Requires Node 20.19+/22.12+, Python 3, Swift and JDK 17; first run: (cd miniapp && npm ci).
set -euo pipefail
cd "$(dirname "$0")/.."
for test in test_web_prefs test_sw_fetch test_engine test_web_start test_diagnostics test_longtail; do
  node "scripts/${test}.js"
done
python3 scripts/test_local.py
python3 scripts/test_repository.py
python3 scripts/test_release_assets.py
(cd miniapp && npm test)
(cd ios && swift test)
(cd android && ./gradlew :policy:test)
git diff --check
