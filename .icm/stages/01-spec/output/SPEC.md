# Stage 01: Specification — Selectable Glyph Sets (Milestone 2)

## Overview & Scope
Allow users to select from multiple distinct character stream alphabets in the preferences panel:
1. **Classic Katakana (Default):** The authentic movie Katakana + numeral glyph sequence (`assets/matrixcode_mask_rgb.png`).
2. **Binary Rain:** `0` and `1` streams (high tech cyber security aesthetic).
3. **Hexadecimal Memory Dump:** `0` through `F` and hex prefixes (`0x`, byte patterns).
4. **ASCII / Matrix Operator:** Alphanumeric symbols, punctuation, and math symbols (`A-Z`, `0-9`, `$`, `#`, `@`, `%`, `*`, `&`).

---

## Technical Design & Architecture

### 1. Procedural Texture Atlas Generator (`shell/atlasGenerator.js`)
Instead of bundling multiple static PNG images or requiring external dependencies, we use GJS's native `cairo` + `gi://PangoCairo` rendering pipeline to dynamically render font atlases in-memory into a `Cogl.PixelFormat.RGBA_8888` buffer or cache them on demand.
* **Atlas Grid:** 8 columns $\times$ 8 rows = 64 cells on a $512 \times 512$ texture.
* **Cell Size:** $64 \times 64$ pixels per glyph.
* **Alignment:** Centered within cell with Pango font metrics.
* **Atlas Sets:**
  - `katakana`: Loads existing `assets/matrixcode_mask_rgb.png` (57 glyphs).
  - `binary`: Alternating bold monospace `0` and `1` with varying weights / variations (2 distinct base glyphs tiled across sequence).
  - `hex`: Hexadecimal digits `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `A`, `B`, `C`, `D`, `E`, `F` (16 glyphs).
  - `ascii`: Alphanumeric Latin uppercase, numerals, and terminal punctuation (`!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `<`, `>`, `/`, `?`).

### 2. Shader Parameterization (`shell/shader.js`)
* Introduce uniform `uniform float matrix_glyph_count;`
* In `SHADER_CODE`:
  ```glsl
  float glyph_index = floor(matrix_hash(
      cell_seed + glyph_epoch * 97.31) * matrix_glyph_count);
  ```
  This allows sets with fewer symbols (e.g. Binary with count = 2, or Hex with count = 16) to cleanly randomize only across their valid glyph cells without indexing blank cells.

### 3. Manager & Actor Dynamic Switching (`shell/matrixScreensaver.js`)
* Connect to `changed::glyph-set`.
* On change, request the appropriate atlas image from `AtlasManager`, call `_rebuildActors()`, and re-upload uniforms with the new `matrix_glyph_count`.

### 4. GSettings Schema (`schemas/org.gnome.shell.extensions.matrix-screensaver.gschema.xml`)
* New key:
  ```xml
  <key name="glyph-set" type="s">
    <choices>
      <choice value="katakana"/>
      <choice value="binary"/>
      <choice value="hex"/>
      <choice value="ascii"/>
    </choices>
    <default>'katakana'</default>
    <summary>Glyph Set</summary>
    <description>Alphabet used for the digital rain streams.</description>
  </key>
  ```

### 5. Preferences UI (`prefs.js`)
* In Group 2 (Appearance & Colors) or Group 3 (Rain Dynamics), add an `Adw.ComboRow`:
  - Title: "Glyph Character Set"
  - Subtitle: "Choose the stream alphabet"
  - Options:
    - "Classic Katakana (Authentic)"
    - "Binary Stream (0 & 1)"
    - "Hexadecimal Memory Dump (0-F)"
    - "ASCII Alphanumeric"
  - Bound to `settings.bind('glyph-set', comboRow, 'selected', ...)` with Gtk.StringList.

---

## Testing & Quality Gates
1. Verify atlas rendering produces clean anti-aliased white glyphs on transparent background.
2. Confirm 0% CPU idle is maintained (atlases generated once on startup/selection, cached in memory).
3. Validate hot-swapping glyph sets in preferences updates the active screensaver immediately.
4. Pass Stage 03 audit via Devin CLI (`GLM-5.2`).
