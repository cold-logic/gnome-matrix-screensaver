# Stage 01: Specification — Road Signs & Digital UI Icons Glyph Sets

## 1. Objectives & Overview
Expand the selectable character streams in **`matrix-screensaver@cold-logic`** with two rich ideogram collections:
1. **Road & Public Signs (`road`):** Physical traffic warnings, transportation symbols, and safety ideograms (`🛑`, `⚠️`, `⛔`, `🚸`, `♿`, `🚲`, `🚗`, `🚶`, `⛽`, `🚧`, `🚦`, `🚨`, `🅿️`, `⚡`, `⬆️`, `⬇️`, `⬅️`, `➡️`, `🔄`, `✈️`, `🛳️`, `🚂`, `🚭`, `🚻`).
2. **Digital UI Icons (`ui`):** Modern desktop and mobile user interface actions, states, and hardware ideograms (`⚙️`, `🔍`, `💾`, `💻`, `📱`, `🔔`, `🔋`, `📶`, `🔒`, `🔓`, `⚡`, `🗑️`, `📁`, `📂`, `✂️`, `📌`, `✉️`, `🌐`, `🔊`, `🔇`, `📷`, `⏱️`, `⭐`, `🏷️`).

---

## 2. Technical Architecture & Decisions

### Atlas Generation & Typography
- **Grid Layout:** 8 columns $\times$ 8 rows (64 cells, each $64 \times 64$ px on a $512 \times 512$ Cairo ARGB32 surface).
- **Pango Font Family Fallbacks:**
  - Standard monospace handles Latin characters, but Unicode ideograms and emoji require fallback fonts with vector coverage on Linux:
  - Font description: `'Noto Color Emoji, DejaVu Sans, Symbola, Sans Bold 40'`.
  - PangoCairo handles subpixel glyph measurement and centering within each $64 \times 64$ cell.
  - White alpha mask rendering (`cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0)`) ensures shader luminance multiplication samples cleanly.

### Schema Updates (`gschema.xml`)
- Key `glyph-set` extended to include:
  - `<choice value="katakana"/>`
  - `<choice value="binary"/>`
  - `<choice value="hex"/>`
  - `<choice value="html"/>`
  - `<choice value="road"/>`
  - `<choice value="ui"/>`

### Settings UI (`prefs.js`)
- `Adw.ComboRow` extended with new labels:
  - `_('Road & Public Signs (🛑, ⚠️, 🚸)')`
  - `_('Digital UI Icons (⚙️, 🔍, 💾)')`
- Bidirectional synchronization with GSettings.

### Resource & Memory Management
- `AtlasManager` caches each procedural texture upon first generation.
- On extension disable, `destroy()` un-realizes all St textures and flushes memory.

---

## 3. Test & Verification Plan
1. **Linting Quality Gate:** `bun run lint` must pass with `--max-warnings=0`.
2. **Compilation:** `glib-compile-schemas` succeeds without XML schema validation errors.
3. **Packaging:** `gnome-extensions pack` bundles all assets cleanly.
4. **Devin Audit:** Dispatch Stage 03 audit to Devin CLI (`GLM-5.2`).
5. **Runtime Verification:** Test both new sets in nested Wayland session.
