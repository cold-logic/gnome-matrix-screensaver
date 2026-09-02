# Stage 02: Implementation Changelog — Selectable Glyph Sets

## Summary of Changes
Implemented dynamic character sets across procedural and static texture atlases:

1. **Procedural & Static Atlas Architecture ([`shell/atlasManager.js`](shell/atlasManager.js)):**
   - Built `AtlasManager` utilizing native GJS `cairo` + `gi://PangoCairo` to render vector monospace typography dynamically into in-memory `Cogl.PixelFormat.RGBA_8888` buffers.
   - Built support for 4 distinct character sets:
     - **`katakana` (Classic Katakana):** Movie-accurate Katakana atlas (`matrixcode_mask_rgb.png`, 57 glyphs).
     - **`binary` (Binary Stream):** Pure cyber `0` and `1` streams (2 glyphs).
     - **`hex` (Hexadecimal Dump):** Memory dump stream `0` through `F` (16 glyphs).
     - **`ascii` (ASCII Operator):** Full alphanumeric Latin uppercase, digits, and terminal symbols (42 glyphs).
   - In-memory caching so each atlas is only compiled once.

2. **Dynamic Glyph Count Parameterization ([`shell/shader.js`](shell/shader.js)):**
   - Added uniform `uniform float matrix_glyph_count;`
   - Clamped glyph indexing strictly to valid atlas cells (`max(2.0, matrix_glyph_count)`), preventing blank texture cells for smaller sets like Binary or Hex.

3. **Runtime Switching & Rebuild ([`shell/matrixScreensaver.js`](shell/matrixScreensaver.js)):**
   - Connected `changed::glyph-set` listener to rebuild actors and update uniform state dynamically when changed.

4. **Preferences Selector & Schema ([`prefs.js`](prefs.js), [`schemas/`](schemas/)):**
   - Added `glyph-set` enum choice key in `gschema.xml`.
   - Added `Adw.ComboRow` in Preferences to choose between Katakana, Binary, Hex, and ASCII.

## Verification
- Clean build and schema compilation via `./install.sh`.
- Re-enabled in GNOME Shell without warnings or errors.
- Handing off to Stage 03 for Devin CLI (`GLM-5.2`) audit.
