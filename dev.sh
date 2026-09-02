#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="matrix-screensaver@cold-logic"

echo "==> Compiling schemas..."
glib-compile-schemas "$DIR/schemas"

echo "==> Setting up isolated test environment..."
TMP_DEV_DIR="/tmp/gnome-matrix-dev-session"
rm -rf "$TMP_DEV_DIR"
mkdir -p "$TMP_DEV_DIR/gnome-shell/extensions/$UUID"
mkdir -p "$TMP_DEV_DIR/glib-2.0/schemas"

# Copy source
cp -r "$DIR/metadata.json" \
      "$DIR/extension.js" \
      "$DIR/prefs.js" \
      "$DIR/shell" \
      "$DIR/schemas" \
      "$DIR/assets" \
      "$TMP_DEV_DIR/gnome-shell/extensions/$UUID/"

cp "$DIR/schemas/"*.xml "$TMP_DEV_DIR/glib-2.0/schemas/"
glib-compile-schemas "$TMP_DEV_DIR/glib-2.0/schemas"

echo "==> Launching Official GNOME 50+ Nested Shell (--devkit)..."
echo "    [Tip] Close the window anytime to stop the test session."
echo "    [Tip] Real-time logs will stream below."
echo "---------------------------------------------------------"

export G_MESSAGES_DEBUG=all
export SHELL_DEBUG=all
export MUTTER_DEBUG_DUMMY_MODE_SPECS=1280x720
export XDG_DATA_DIRS="$TMP_DEV_DIR:/usr/local/share:/usr/share"

dbus-run-session -- bash -c "
  gsettings set org.gnome.shell enabled-extensions \"['$UUID']\"
  gnome-shell --devkit --wayland
"
