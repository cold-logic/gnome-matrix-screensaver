#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GI_TYPELIB_PATH="/usr/lib/gnome-shell/girepository-1.0:${GI_TYPELIB_PATH}"
export LD_LIBRARY_PATH="/usr/lib/gnome-shell:${LD_LIBRARY_PATH}"

exec gjs -m "$DIR/test-prefs.js" "$@"
