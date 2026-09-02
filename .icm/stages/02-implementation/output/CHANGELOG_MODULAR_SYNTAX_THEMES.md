# Stage 02: Implementation Changelog — Modular Syntax Highlighting

## Summary of Changes
Implemented an automatic multi-color syntax highlighting engine that gives code and ideogram rain themes distinct, semantic colors while preserving 60fps performance and single-color compatibility:

1. **Shader Multi-Color Chromaticity Pipeline ([`shell/shader.js`](shell/shader.js)):**
   - Upgraded `matrix_glyph_sample` to return full `vec4 tex = texture2D(cogl_sampler_0, atlas_uv)`.
   - Built real-time chromaticity detection in GLSL:
     ```glsl
     float is_chromatic = step(0.08, length(glyph_sample.rgb - vec3(glyph_alpha)));
     vec3 syntax_base_color = mix(matrix_rain_color, glyph_sample.rgb, is_chromatic);
     ```
   - Automatically detects whether an atlas character is colorful (HTML tags, road signs) or white/monochrome (Classic Katakana, Binary, Hex).
   - If chromatic: applies the individual symbol's syntax color to the trail while keeping the leading cursor white/bright.
   - If monochrome: tints uniformly with user-configured `matrix_rain_color` (`#0de0eb` or custom).

2. **Semantic Monokai Syntax Coloring ([`shell/atlasManager.js`](shell/atlasManager.js)):**
   - Enhanced `GLYPH_SETS.html` with explicit semantic color tokens:
     - **Tags & Elements (`<`, `>`, `/`, `div`, `span`, `h1`):** Rose Pink (`#f92672` / `[0.98, 0.15, 0.45]`)
     - **Brackets, Braces & Semicolons (`{`, `}`, `[`, `]`, `;`):** Warm White (`#f8f8f2` / `[0.97, 0.97, 0.95]`)
     - **Attributes, Operators & Selectors (`&`, `=`, `!`, `?`, `#`, `.`):** Electric Lime (`#a6e22e` / `[0.65, 0.89, 0.18]`)
     - **Values, Quotes & Strings (`"`, `'`, `2`, `b`, `r`):** Canary Gold (`#e6db74` / `[0.90, 0.86, 0.45]`)
   - `_renderProceduralAtlas` handles both raw strings and `{text, color}` objects, calling `cr.setSourceRGBA()` dynamically per symbol.

3. **Road Signs Natural Palette:**
   - Multi-channel sampling ensures the natural red/amber/blue vectors of traffic ideograms glow accurately without monochromatic washout.

4. **Quality Gates & Standards:**
   - `bun run lint` passes with `--max-warnings=0`.
   - Packaged and installed via `gnome-extensions pack`.
