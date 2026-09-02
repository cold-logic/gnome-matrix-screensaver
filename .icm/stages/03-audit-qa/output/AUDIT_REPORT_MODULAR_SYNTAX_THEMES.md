# Stage 03 Audit Report — Modular Syntax Highlighting & Chromatic Shader Sampling

**Auditor:** Devin CLI (GLM-5.2 High)
**Date:** 2026-09-02
**Scope:** GLSL chromaticity detection (`shell/shader.js`), per-glyph semantic color rendering in `_renderProceduralAtlas` (`shell/atlasManager.js`), and the `bun run lint` quality gate.
**Inputs:** `.icm/stages/01-spec/output/SPEC_MODULAR_SYNTAX_THEMES.md`, `.icm/stages/02-implementation/output/CHANGELOG_MODULAR_SYNTAX_THEMES.md`, `.icm/_config/standards.md`, `AGENTS.md`
**Target:** GNOME Shell 50+ / Wayland (Mutter 50.4+)
**Reviewed commit:** `6412eb1b` — `feat(themes): add multi-color IDE syntax highlighting & automatic chromatic shader sampling`

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 2 |
| Low      | 3 |

**Verdict:** **PASS with one functional finding.** The `bun run lint` gate is clean (**0 errors, 0 warnings** across 7 files) and the chromaticity pipeline is architecturally sound — it reuses a single texture fetch (no perf regression), correctly leaves monochrome sets (Katakana / Binary / Hex) tinted by the user's `matrix_rain_color`, and correctly lets saturated syntax colors (coral / lime / canary) and natural color-emoji palettes pass through.

However, the implementation **raised the chromaticity threshold from the spec's `0.05` to `0.08`**, which misclassifies the **warm-white syntax tokens** (`{ } [ ] ( ) ; :`, color `[0.97, 0.97, 0.95]`) as monochrome. These 8 of 36 HTML glyphs get recolored with the user's rain color (teal) instead of displaying their intended warm white — a visible spec violation. The fix is a one-line threshold revert.

---

## 1. Verification Results

### 1.1 Lint Execution (Primary Gate)

| Check | Command | Result |
| :--- | :--- | :--- |
| Default lint | `bun run lint` | **EXIT 0**, no stdout |
| Max-warnings guard | script already passes `--max-warnings=0` | **EXIT 0** |
| JSON formatter audit | `eslint . --format json` | **7 files, 0 errors, 0 warnings** |

Files linted (matches the project target set):
- `eslint.config.mjs`, `extension.js`, `prefs.js`, `shell/atlasManager.js`, `shell/matrixScreensaver.js`, `shell/quickSettings.js`, `shell/shader.js`

**The "0 errors, 0 warnings" contract from SPEC §3.1 is satisfied.**

### 1.2 SCM State

`jj status` reports a clean working copy. The feature is committed at `6412eb1b` on `main` (parent of the empty working-copy rev `aced64e6`). No uncommitted regressions.

---

## 2. Findings

### Medium

#### M1. Warm-white syntax tokens misclassified as monochrome — chromaticity threshold raised above spec

**Files:** `shell/shader.js:114`, `SPEC_MODULAR_SYNTAX_THEMES.md` §2 (Chromaticity Detection)

**Spec:** `float is_colored = step(0.05, distance(glyph_tex.rgb, vec3(glyph_alpha)));`
**Impl:** `float is_chromatic = step(0.08, length(glyph_sample.rgb - vec3(glyph_alpha)));`

`length(a - b)` is mathematically identical to `distance(a, b)`, so the only behavioral change is the **threshold: `0.05 → 0.08`**. That raise breaks detection of the warm-white syntax group.

The warm-white tokens (`{`, `}`, `[`, `]`, `(`, `)`, `;`, `:`) are rendered into the atlas at `[0.97, 0.97, 0.95]` with alpha `1.0`. Because procedural glyphs are drawn with `setSourceRGBA(..., 1.0)`, `glyph_alpha = max(r, g, b, a) = 1.0` for every fully-drawn pixel, so the chromaticity test reduces to *distance of `rgb` from white*:

| Token group | Color | `chroma = length(rgb - vec3(1.0))` | `step(0.08, …)` (impl) | `step(0.05, …)` (spec) |
| :--- | :--- | ---: | :---: | :---: |
| Warm white (braces/brackets/parens/`;`/`:`) | `[0.97, 0.97, 0.95]` | **0.0656** | **0 → MONOCHROME** ❌ | 1 → CHROMATIC ✅ |
| Canary gold (quotes/`2`/`b`/`r`) | `[0.90, 0.86, 0.45]` | 0.576 | 1 → CHROMATIC ✅ | 1 → CHROMATIC ✅ |
| Electric lime (operators) | `[0.65, 0.89, 0.18]` | 0.898 | 1 → CHROMATIC ✅ | 1 → CHROMATIC ✅ |
| Coral rose (tags/elements) | `[0.98, 0.15, 0.45]` | 1.013 | 1 → CHROMATIC ✅ | 1 → CHROMATIC ✅ |
| Pure white (Binary/Hex/Katakana mask) | `[1.0, 1.0, 1.0]` | 0.000 | 0 → MONOCHROME ✅ | 0 → MONOCHROME ✅ |

The warm-white group sits in the dead band between the two thresholds (`0.05 < 0.0656 < 0.08`). With the implementation's `0.08`, `is_chromatic = 0`, so:

```glsl
vec3 syntax_base_color = mix(matrix_rain_color, glyph_sample.rgb, 0.0); // = matrix_rain_color
```

The braces/brackets/parens/semicolons/colons are tinted with the user's `matrix_rain_color` (teal by default) and lose their distinct warm-white syntax identity — directly violating SPEC §1.1 (*"Brackets & Operators: Warm White / Muted Cream (`#f8f8f2`)"*) for **8 of the 36 HTML glyphs**.

**Fix (one line):** Revert to the spec threshold:
```glsl
float is_chromatic = step(0.05, length(glyph_sample.rgb - vec3(glyph_alpha)));
```
This restores warm-white detection (`0.0656 > 0.05`) while keeping pure-white masks monochrome (`0.0 < 0.05`). Verified above. No other token group crosses the `0.05` boundary, so there are no regressions from the revert.

**Optional hardening:** The deeper fragility is that chromaticity is *inferred from the texture* rather than known at atlas-build time. A cleaner long-term design would encode a per-glyph "has custom color" flag (e.g. a 1×N alpha-1 mask in a spare atlas row, or a uniform bitfield) so the shader doesn't have to guess from RGB distance. Not required for this stage; flagged for the roadmap.

---

#### M2. Spec deviation: Road & UI signs rely on natural emoji color instead of the spec's explicit sign-color coding

**Files:** `shell/atlasManager.js:85-106` (`road`, `ui` sets), `SPEC_MODULAR_SYNTAX_THEMES.md` §1.2

The spec defines explicit per-category colors for Road Signs:
- Regulatory/Stop (`🛑`, `⛔`, `🚨`): `#ff2a55`
- Warning (`⚠️`, `🚧`, `⚡`, `⛽`): `#ffbb00`
- Information (`🅿️`, `♿`, `🚏`, `🚲`, `⬆️`): `#00b4d8` / `#2ec4b6`

The implementation instead declares `road`/`ui` `chars` as **plain strings** with no `color` property and a `Noto Color Emoji, …` font. `PangoCairo.show_layout` renders these via the color-emoji font, which embeds its own bitmap colors and **ignores `cr.setSourceRGBA`**. The shader's chromaticity detector then picks up the natural emoji colors and passes them through. The CHANGELOG §3 acknowledges this pivot (*"natural red/amber/blue vectors of traffic ideograms glow accurately"*).

This is a **justified deviation** — bitmap color-emoji glyphs cannot be reliably recolored via Cairo source RGBA, so the spec's explicit hex mapping is not directly achievable with the chosen rendering path. But it carries two consequences worth recording:

1. **Environment dependency:** On systems without `Noto Color Emoji` (or a color-emoji fallback), Pango renders monochrome outline glyphs via `DejaVu Sans` / `Symbola`. Those render white → `is_chromatic = 0` → tinted with `matrix_rain_color`. The entire Road/UI sign color-coding feature silently degrades to a monochrome rain. The spec's intent is lost on such systems with no warning.
2. **Spec/impl drift:** The spec's explicit hex palette is unimplemented and will mislead future contributors who try to "fix" sign colors by adding `color` properties (which won't work for color-emoji fonts).

**Fix (recommended):**
- Amend `SPEC_MODULAR_SYNTAX_THEMES.md` §1.2 to document the natural-emoji-color approach as the chosen implementation, marking the explicit hex palette as deferred/not-applicable for color-emoji glyphs.
- Optionally detect color-emoji availability at atlas-build time and log a `console.warn` if the fallback font is used, so the degradation is observable. (Low priority — graceful degradation, not a crash.)

---

### Low

#### L1. Chromaticity check references the `glyph_cell_mask`-masked `glyph_alpha`

**File:** `shell/shader.js:79, 114`
```glsl
float glyph_alpha = max(max(glyph_sample.r, glyph_sample.g), max(glyph_sample.b, glyph_sample.a)) * glyph_cell_mask;
// …
float is_chromatic = step(0.08, length(glyph_sample.rgb - vec3(glyph_alpha)));
```
`glyph_alpha` is multiplied by `glyph_cell_mask` (which is `0.0` outside the resolved glyph cell). Outside the cell, `glyph_alpha = 0.0`, so `is_chromatic = step(threshold, length(rgb))` — i.e. it flips based on raw texture brightness rather than distance-from-alpha. This has **no visual effect** because `glyph_vis` is `0` outside the cell (`core_alpha = glyph_alpha * illumination = 0`, and `halo` is also masked), so the misclassified `syntax_base_color` is never written. But it is logically muddy: the chromaticity decision should be a property of the *texel*, not the cell mask.

**Fix (clarity):** Compute chromaticity from an unmasked luminance reference:
```glsl
float glyph_luma = max(max(glyph_sample.r, glyph_sample.g), max(glyph_sample.b, glyph_sample.a));
float glyph_alpha = glyph_luma * glyph_cell_mask;
float is_chromatic = step(0.05, length(glyph_sample.rgb - vec3(glyph_luma)));
```
Cosmetic; no behavior change inside the cell.

---

#### L2. Commit scope creep — rain animation model reworked inside the syntax-highlighting commit

**File:** `shell/shader.js:81-109` (diff vs parent)

The `feat(themes)` commit bundles a substantial rewrite of the rain dynamics that is unrelated to color:
- `period` / `speed` / `phase` formulas changed (`gap`-based → `mix()`-based).
- `second_probability` changed from `clamp((stream_density - 0.75) * 0.70, 0, 0.70)` to `min(stream_density * 0.42, 1.0)`.
- `rain.z` semantics changed from a *redraw-glint* term (`max(rain.z, redraw_glint * rain.x * (1 - rain.y) * 0.72)`) to an *overlap-glow* term (`mix(first_drop.x, second_drop.x, 0.5) * step(0.01, …)`).
- The `depth_brightness` quantization (`floor(clamp(rain.x,0,1)*7+0.5)/7`) and redraw-glint machinery were removed.

These are legitimate animation tweaks, but they change the visual rhythm of *all* glyph sets (including monochrome Katakana), not just the new themed ones, and are undocumented in either the spec or the changelog. This makes the commit harder to revert/bisect if a regression in rain feel is reported.

**Fix (process):** Split such animation-model changes into their own commit (or at minimum add a bullet to `CHANGELOG_MODULAR_SYNTAX_THEMES.md` noting the rain-dynamics retuning). No code change required.

---

#### L3. `_renderProceduralAtlas` color array is not validated

**File:** `shell/atlasManager.js:172`
```js
const color = (typeof item === 'object' && item.color) ? item.color : [1.0, 1.0, 1.0];
cr.setSourceRGBA(color[0], color[1], color[2], 1.0);
```
`item.color` is assumed to be a 3-element array of 0–1 floats. A malformed entry (e.g. a 2-element array, or values > 1) would silently produce a wrong color or `undefined` channels (→ `NaN` → Cairo no-op) with no error. Today the config is hand-curated and correct, so this is defensive only.

**Fix (optional):** Clamp/normalize defensively, or assert length 3:
```js
const c = item.color ?? [1.0, 1.0, 1.0];
cr.setSourceRGBA(c[0] ?? 1, c[1] ?? 1, c[2] ?? 1, 1.0);
```
Low priority — the config is static and controlled.

---

## 3. Verified Correct

### Chromaticity Pipeline (`shell/shader.js`)
- **`cogl_sampler_0` usage:** All sampling goes through the Cogl-native `cogl_sampler_0` uniform (lines 11, 33). Compliant with AGENTS.md "Cogl Hardware Samplers" rule.
- **No scalar `length()` on `vec3` ternary:** The shader uses `length()` on a `vec3` difference (line 114) — a legitimate vector operation, not the banned scalar `length()` on a `vec3` ternary. Compliant with AGENTS.md graphics rules.
- **Single-fetch reuse:** The refactor from `matrix_glyph_alpha()` to `matrix_glyph_sample()` + inline `max()` (lines 78–79) means the main path fetches the texture **once** and reuses `glyph_sample` for both alpha and chromaticity. The halo path still does 4 neighbor fetches via `matrix_glyph_alpha` (unchanged). **No new texture fetches were introduced** — performance-neutral, 30 fps budget preserved.
- **Monochrome set handling:** For Binary/Hex (plain strings → default white `[1,1,1]`) and the Katakana static mask (`assets/matrixcode_mask_rgb.png`, 8-bit grayscale, sampled as `(v,v,v,1)`), white texels yield `chroma = 0` → `is_chromatic = 0` → tinted with `matrix_rain_color`. SPEC §1.3 ("monochrome themes preserve custom lead/trail colors") is honored. Correct.
- **Cursor preserved:** The leading cursor still uses `active_cursor_color = matrix_cursor_color` (line 119) regardless of chromaticity, mixed in via `rain.y` (line 124). Matches SPEC §2 "highlighting the leading cursor with `active_cursor_color`". Correct.
- **Anti-aliasing graceful:** At partial coverage `c`, a colored texel becomes `(r·c, g·c, b·c, c)`, so `glyph_alpha = c` and `chroma = c · length(rgb − 1)`. Below ~8% coverage the texel falls back to monochrome tint, but `glyph_vis ≈ 0` there anyway, so the transition is invisible. Correct.

### Per-Glyph Color Rendering (`shell/atlasManager.js:_renderProceduralAtlas`)
- **Polymorphic item handling:** Strings and `{text, color}` objects are both handled (lines 171–172). Plain strings default to white `[1,1,1]` → monochrome path. Correct.
- **Color space:** `cr.setSourceRGBA` is called with 0–1 floats (e.g. `0.98, 0.15, 0.45`), not 0–255. Correct for Cairo's API.
- **Per-glyph source set:** `setSourceRGBA` is called inside the loop with each item's color (line 174) — necessary now that colors vary per glyph (the prior audit's L2 "constant source" finding is obsolete). Correct.
- **Color-emoji pass-through:** `road`/`ui` use `Noto Color Emoji` and plain strings; the emoji font's embedded bitmap colors are preserved through the PNG round-trip and detected as chromatic by the shader. Correct for the chosen design (see M2).
- **Premultiplied-alpha safety:** Cairo `ARGB32` stores premultiplied alpha; `writeToPNG` writes unpremultiplied; `GdkPixbuf.new_from_file` reads unpremultiplied; `set_bytes` with `RGBA_8888`/`RGB_888` uploads unpremultiplied. No double premultiplication. Correct.
- **Atlas capacity guard:** Loop bound `i < GLYPH_ATLAS_COLUMNS * GLYPH_ATLAS_ROWS` (64) prevents overflow of the 8×8 grid. HTML (36), Road (24), UI (24) all fit. Correct.
- **HTML `count` parity:** `GLYPH_SETS.html.count = 36` matches the 36 `chars` entries (10 coral + 8 white + 13 lime + 5 canary). `matrix_glyph_count` is set to 36 via `setGlyphCount(glyphAtlas.count)` and clamped `max(2.0, …)` in-shader. Correct.

### Lifecycle & Standards
- **`surface.finish()` present:** The earlier GLYPH_SETS audit's M1 finding (CPU buffer lingering) is now addressed — `surface.finish()` is called after `writeToPNG` (line 193). Correct.
- **`AtlasManager.destroy()` unrealizes textures:** The earlier H1 finding is addressed — `destroy()` iterates the cache and calls `content.unrealize()` (lines 217–221). Compliant with AGENTS.md "Lifecycle Cleanliness".
- **Tmp-file cleanup:** `writeToPNG` → `new_from_file` → `file.delete(null)` with try/catch (lines 191–201). Unique name via `GLib.random_int()`. Correct.
- **0% CPU idle unaffected:** No new timers introduced; the chromaticity work is purely fragment-shader-side and only runs while the screensaver is active (gated by the existing 30 fps ticker). Compliant with AGENTS.md.

---

## 4. Recommended Action Priority

| # | Severity | Finding | Effort |
| :---: | :---: | :--- | :--- |
| 1 | Medium | **M1** — Revert chromaticity threshold `0.08 → 0.05` so warm-white syntax tokens render correctly | 1 min |
| 2 | Medium | **M2** — Amend SPEC §1.2 to document natural-emoji-color approach (and optionally warn on missing color-emoji font) | 10 min |
| 3 | Low | **L1** — Use unmasked `glyph_luma` for the chromaticity reference (clarity only) | 2 min |
| 4 | Low | **L2** — Document/split the rain-dynamics retune out of the themes commit | process |
| 5 | Low | **L3** — Defensively normalize `item.color` in `_renderProceduralAtlas` | 2 min |

Only **M1** is a functional bug visible to users; the rest are spec/process/hygiene items. M1 is a one-line, low-risk fix with no threshold-edge regressions (verified in §2 M1's table).

---

## 5. Stage 03 Sign-off

| Criterion | Status |
| :--- | :---: |
| `bun run lint` → 0 errors, 0 warnings (SPEC §3.1) | ✅ PASS |
| `cogl_sampler_0` used for all sampling (AGENTS.md) | ✅ PASS |
| No banned scalar `length()` on `vec3` ternary (AGENTS.md) | ✅ PASS |
| No new texture fetches / 30 fps budget preserved | ✅ PASS |
| Monochrome sets respect custom `matrix_rain_color` (SPEC §1.3) | ✅ PASS |
| Saturated syntax colors pass through chromatically | ✅ PASS |
| Warm-white syntax tokens render as warm white (SPEC §1.1) | ❌ FAIL — see M1 |
| Road sign color coding matches SPEC §1.2 | ⚠️ DEVIATION — see M2 (justified) |
| Lifecycle: `surface.finish()` + `content.unrealize()` | ✅ PASS |
| 0% CPU idle preserved | ✅ PASS |
| SCM clean (no uncommitted regressions) | ✅ PASS |

**Audit Result: APPROVED WITH REQUIRED FIX.** The lint gate and architectural criteria are met. Apply the **M1** one-line threshold revert (`0.08 → 0.05`) before considering the Modular Syntax Highlighting feature fully spec-compliant; the warm-white syntax group is otherwise silently recolored. M2 is an acceptable design deviation that should be reflected back into the spec for traceability.
