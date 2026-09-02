# Stage 01: Specification — Modular Syntax & Thematic Color Shaders

## 1. Goal & Objectives
Elevate glyph character streams from monochrome symbols to **Modular Themes** that carry their own **multi-color syntax highlighting** and thematic palettes:
1. **HTML & Web Rain:** True IDE syntax highlighting:
   - Tags (`<`, `>`, `/`, `div`, `span`): Coral Red / Pink (`#f92672`).
   - Brackets & Operators (`{`, `}`, `[`, `]`, `(`, `)`, `;`): Warm White / Muted Cream (`#f8f8f2`).
   - Identifiers & Keywords (`class`, `href`, `&`, `#`): Electric Lime / Emerald (`#a6e22e`).
   - Values & Digits (`0`-`9`, quotes, strings): Bright Canary / Amber (`#e6db74`).
2. **Road & Public Signs:** Distinct sign color coding:
   - Regulatory / Stop (`🛑`, `⛔`, `🚨`): Vivid Traffic Red (`#ff2a55`).
   - Warning & Caution (`⚠️`, `🚧`, `⚡`, `⛽`): Safety Amber (`#ffbb00`).
   - Information & Directional (`🅿️`, `♿`, `🚏`, `🚲`, `⬆️`): Highway Blue & Green (`#00b4d8` / `#2ec4b6`).
3. **Monochrome Themes (Katakana, Binary, Hex):**
   - Seamlessly preserve user-selected custom lead and trail colors (`lead-color`, `trail-color`).

---

## 2. Technical Architecture & Shader Pipeline

### Shader Texture Sampling: Multi-Color vs Monochrome Mode
- **Atlas Sampling:**
  In [`shell/shader.js`](shell/shader.js), sample the full RGBA vector from the texture:
  ```glsl
  vec4 glyph_tex = matrix_glyph_sample(glyph_index, glyph_local);
  ```
- **Chromaticity Detection:**
  Determine whether the sampled glyph has natural chromatic color in the atlas:
  ```glsl
  float glyph_alpha = max(max(glyph_tex.r, glyph_tex.g), max(glyph_tex.b, glyph_tex.a));
  float is_colored = step(0.05, distance(glyph_tex.rgb, vec3(glyph_alpha)));
  ```
- **Color Modulation:**
  - If `is_colored == 1.0` (Syntax / Multi-color Theme):
    Multiply the natural syntax color by the drop illumination and trail decay, while still highlighting the leading cursor with `active_cursor_color`.
  - If `is_colored == 0.0` (White monochrome mask):
    Tint with `active_rain_color` (Teal / Green / User setting).

### Atlas Generation ([`shell/atlasManager.js`](shell/atlasManager.js))
- In `GLYPH_SETS`, allow `chars` to specify either simple strings or structured syntax objects:
  ```javascript
  chars: [
      { text: '<', color: [0.98, 0.15, 0.45] }, // Coral
      { text: '{', color: [0.97, 0.97, 0.95] }, // White
      { text: '&', color: [0.65, 0.89, 0.18] }, // Green
      ...
  ]
  ```
- `_renderProceduralAtlas`: If item has `.color`, call `cr.setSourceRGBA(item.color[0], item.color[1], item.color[2], 1.0)` before rendering layout.

---

## 3. Test & Verification Plan
1. `bun run lint` passes with `--max-warnings=0`.
2. `install.sh` builds and compiles schemas without error.
3. Test HTML and Road glyph streams in nested Wayland session to observe vivid multi-color syntax highlighting.
4. Verify that Classic Katakana still strictly respects custom single-color settings.
5. Audit via Devin CLI (`GLM-5.2`).
