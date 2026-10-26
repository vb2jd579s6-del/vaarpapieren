#!/bin/bash
# Builds Vaarpapieren and installs it in /Applications, replacing an earlier version.
# Your documents and settings live in ~/Library/Application Support/nl.tharsis.vaarpapieren
# and are not touched.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="Vaarpapieren.app"
BUNDLE_ID="nl.tharsis.vaarpapieren"
SRC="src-tauri/target/release/bundle/macos/$APP_NAME"
DEST="/Applications/$APP_NAME"
RUNNING="$APP_NAME/Contents/MacOS/vaarpapieren"

npm run tauri build -- --bundles app

# A running copy has to quit before it can be replaced.
if pgrep -f "$RUNNING" >/dev/null; then
  echo "Vaarpapieren afsluiten…"
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    pgrep -f "$RUNNING" >/dev/null || break
    sleep 0.5
  done
  if pgrep -f "$RUNNING" >/dev/null; then
    echo "Vaarpapieren draait nog; sluit de app af (menubalk → Afsluiten) en probeer opnieuw." >&2
    exit 1
  fi
fi

# Copy next to the old version first, then swap, so a failed copy leaves the old app in place.
rm -rf "$DEST.new"
ditto "$SRC" "$DEST.new"
rm -rf "$DEST"
mv "$DEST.new" "$DEST"

echo "Geïnstalleerd: $DEST"
open "$DEST"
