#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "Java not found at $JAVA_HOME"
  echo "Install Android Studio or set JAVA_HOME to a JDK 17+ install."
  exit 1
fi

if [ ! -d "$ANDROID_HOME" ]; then
  echo "Android SDK not found at $ANDROID_HOME"
  echo "Open Android Studio → SDK Manager and install the Android SDK,"
  echo "or set ANDROID_HOME to your SDK path."
  exit 1
fi

echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

echo "Regenerating brand icons + syncing native Android assets…"
npm run prepare-build-assets

# Avoid Gradle journal lock conflicts with Android Studio.
if [ -d android ]; then
  (cd android && ./gradlew --stop) >/dev/null 2>&1 || true
fi

PROFILE="${1:-preview}"
shift || true

BUILD_DIR="$ROOT/builds"
mkdir -p "$BUILD_DIR"

VERSION="$(node -p "require('./package.json').version")"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

case "$PROFILE" in
  production) EXT="aab" ;;
  *) EXT="apk" ;;
esac

OUTPUT="$BUILD_DIR/lm-link-${PROFILE}-v${VERSION}-${TIMESTAMP}.${EXT}"

echo "Build output → $OUTPUT"

eas build --platform android --profile "$PROFILE" --local --output "$OUTPUT" "$@"

echo ""
echo "Saved: $OUTPUT"
