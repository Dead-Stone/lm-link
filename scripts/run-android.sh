#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "Java not found at $JAVA_HOME"
  echo "Install Android Studio, or set JAVA_HOME to a JDK 17+ install."
  exit 1
fi

if [ ! -d "$ANDROID_HOME" ]; then
  echo "Android SDK not found at $ANDROID_HOME"
  echo "Open Android Studio → SDK Manager, or set ANDROID_HOME."
  exit 1
fi

node scripts/write-android-local-properties.js

exec npx expo run:android "$@"
