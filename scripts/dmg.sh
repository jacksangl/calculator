#!/bin/bash
# Builds out/Jotter.dmg with the standard drag-to-Applications window layout.
# Uses only hdiutil/osascript so there is no dmg-builder dependency to keep working.
set -euo pipefail
cd "$(dirname "$0")/.."
APP="out/Jotter-darwin-arm64/Jotter.app"
[ -d "$APP" ] || { echo "Run npm run package first; $APP is missing." >&2; exit 1; }

rm -rf out/dmg out/Jotter.dmg out/rw.dmg
mkdir out/dmg
cp -R "$APP" out/dmg/
ln -s /Applications out/dmg/Applications

# A writable image is required: the icon layout lives in the volume's .DS_Store.
hdiutil create -volname Jotter -srcfolder out/dmg -ov -format UDRW -fs HFS+ out/rw.dmg >/dev/null
DEV=$(hdiutil attach out/rw.dmg -nobrowse -noverify -noautoopen | grep -Eo '/dev/disk[0-9]+' | head -1)
trap 'hdiutil detach "$DEV" -quiet 2>/dev/null || true' EXIT

osascript <<'APPLESCRIPT' >/dev/null
tell application "Finder"
  tell disk "Jotter"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {200, 150, 800, 550}
    set theOptions to the icon view options of container window
    set arrangement of theOptions to not arranged
    set icon size of theOptions to 128
    set position of item "Jotter.app" of container window to {150, 190}
    set position of item "Applications" of container window to {450, 190}
    close
  end tell
end tell
APPLESCRIPT

# Finder flushes the layout to .DS_Store when the window closes, so let it land before unmounting.
sleep 1
sync
[ -f /Volumes/Jotter/.DS_Store ] || { echo "Finder did not write the window layout." >&2; exit 1; }
hdiutil detach "$DEV" -quiet
trap - EXIT
hdiutil convert out/rw.dmg -format UDZO -imagekey zlib-level=9 -o out/Jotter.dmg >/dev/null
rm -rf out/dmg out/rw.dmg
echo "Built out/Jotter.dmg"
