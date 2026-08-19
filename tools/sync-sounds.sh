#!/usr/bin/env bash
# Copy the free sound bank from assets/sounds into every consumer.
# Pack sounds (assets/sounds/pack/) are native-only and synced once those
# resource directories exist.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/assets/sounds"

copy_free() {
  local dest="$1"
  mkdir -p "$dest"
  cp "$src"/click-strong.mp3 "$src"/click-weak.mp3 "$src"/click-uniform.mp3 "$dest/"
  rm -rf "$dest/voice"
  cp -R "$src/voice" "$dest/voice"
  echo "synced free bank -> $dest"
}

copy_free "$root/miniapp/assets/sounds"

if [ -d "$root/ios/BunnyMetronome" ]; then
  mkdir -p "$root/ios/BunnyMetronome/Sounds"
  copy_free "$root/ios/BunnyMetronome/Sounds"
  if [ -d "$src/pack" ]; then
    rm -rf "$root/ios/BunnyMetronome/Sounds/pack"
    cp -R "$src/pack" "$root/ios/BunnyMetronome/Sounds/pack"
    echo "synced pack -> ios"
  fi
fi

if [ -d "$root/android/app/src/main/assets" ]; then
  mkdir -p "$root/android/app/src/main/assets/sounds"
  copy_free "$root/android/app/src/main/assets/sounds"
  if [ -d "$src/pack" ]; then
    rm -rf "$root/android/app/src/main/assets/sounds/pack"
    cp -R "$src/pack" "$root/android/app/src/main/assets/sounds/pack"
    echo "synced pack -> android"
  fi
fi
