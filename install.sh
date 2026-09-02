#!/usr/bin/env bash
set -e

UUID="matrix-screensaver@cold-logic"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building Teal Matrix Screensaver for GNOME 50+ ($UUID)..."

# Quality Gate: Run ESLint
if command -v bun >/dev/null 2>&1; then
    echo "==> Running ESLint quality gates..."
    bun run lint
fi

# Compile GLib Schemas locally and system-wide for user
echo "==> Compiling schemas..."
glib-compile-schemas "$SRC_DIR/schemas"
mkdir -p "$HOME/.local/share/glib-2.0/schemas"
cp "$SRC_DIR/schemas/"*.xml "$HOME/.local/share/glib-2.0/schemas/"
glib-compile-schemas "$HOME/.local/share/glib-2.0/schemas"

# Clean target dir
echo "==> Installing to $DEST_DIR..."
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

# Copy files
cp -r "$SRC_DIR/metadata.json" \
      "$SRC_DIR/extension.js" \
      "$SRC_DIR/prefs.js" \
      "$SRC_DIR/shell" \
      "$SRC_DIR/schemas" \
      "$SRC_DIR/assets" \
      "$DEST_DIR/"

# Create official EGO zip bundle
echo "==> Creating official distributable zip via gnome-extensions pack..."
mkdir -p "$SRC_DIR/build"
gnome-extensions pack \
  --extra-source=assets \
  --extra-source=shell \
  --schema=schemas/org.gnome.shell.extensions.matrix-screensaver.gschema.xml \
  --force \
  --out-dir="$SRC_DIR/build" \
  "$SRC_DIR"

echo "==> Enabling extension..."
gnome-extensions install --force "$SRC_DIR/build/$UUID.shell-extension.zip" || true
gnome-extensions enable "$UUID" || true

echo "==> Successfully installed $UUID!"
echo "    Preferences: gnome-extensions prefs $UUID"
