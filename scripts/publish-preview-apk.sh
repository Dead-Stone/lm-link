#!/usr/bin/env bash
# Build a preview APK and publish it to GitHub Releases (install.html picks it up automatically).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
TAG="${1:-v${VERSION}-preview.1}"
NOTES="${2:-Preview build for testers.

Install on Android: https://dead-stone.github.io/lm-link/install.html

Package: com.lmlink.android}"

echo "Building preview APK…"
npm run build:apk:local

APK="$(ls -t "$ROOT"/builds/lm-link-preview-*.apk 2>/dev/null | head -1)"
if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "No preview APK found in builds/"
  exit 1
fi

APK_NAME="lm-link-preview-v${VERSION}.apk"
STAGE="$ROOT/builds/$APK_NAME"
cp "$APK" "$STAGE"

echo "APK: $STAGE ($(du -h "$STAGE" | cut -f1))"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG exists — uploading APK asset…"
  gh release upload "$TAG" "$STAGE" --clobber
else
  echo "Creating release $TAG…"
  gh release create "$TAG" "$STAGE" --title "LM Link $TAG" --notes "$NOTES" --prerelease
fi

echo ""
echo "Done. Share: https://dead-stone.github.io/lm-link/install.html"
echo "Direct releases page: https://github.com/Dead-Stone/lm-link/releases/tag/$TAG"
