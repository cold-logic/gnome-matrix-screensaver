# Stage 03: Audit & QA Report — Road Signs (`road`) & Digital UI Icons (`ui`) Glyph Sets

**Auditor:** Devin CLI (GLM-5.2 High)
**Date:** 2026-09-02
**Scope:** Two new ideogram glyph sets — atlas rendering, font fallback chains, char array integrity, schema choices, prefs selector parity, lint gate
**Inputs:** `.icm/stages/01-spec/output/SPEC_IDEOGRAM_GLYPHS.md`, `.icm/stages/02-implementation/output/CHANGELOG_IDEOGRAM_GLYPHS.md`, `.icm/_config/standards.md`, prior `AUDIT_REPORT_GLYPH_SETS.md`
**Files reviewed:** `shell/atlasManager.js`, `shell/shader.js`, `shell/matrixScreensaver.js`, `prefs.js`, `schemas/org.gnome.shell.extensions.matrix-screensaver.gschema.xml`, `shell/quickSettings.js`, `eslint.config.mjs`, `package.json`
**Target:** GNOME Shell 50+ / Wayland

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 1 |
| Low      | 3 |

The two new glyph sets are **structurally complete and fully wired**: the `GLYPH_SETS` registry, `glyph-set` schema `<choices>`, and `GLYPH_OPTIONS` prefs entries are in perfect 6-way parity (katakana, binary, hex, html, road, ui). Char arrays are well-formed (24 entries each, no intra-set duplicates, `count` field matches array length). `bun run lint` exits cleanly with **0 errors, 0 warnings**. The prior audit's two top findings (H1 `destroy()` unrealize, M1 `surface.finish()`) have both been **addressed and verified fixed** in the current source.

The one substantive concern is a **rendering-strategy mismatch**: the new ideogram sets declare `Noto Color Emoji` as the primary font in their Pango fallback chain, but the atlas pipeline renders a white alpha mask that the fragment shader samples via the `.r` channel. Color-emoji fonts paint embedded color bitmaps and ignore `cr.setSourceRGBA(1,1,1,1)`, so the resulting atlas is **not** a clean white mask — the shader's `.r`-only sampling will produce uneven glyph brightness depending on each emoji's native red component. This needs runtime confirmation in the nested Wayland sandbox (`./dev.sh`).

---

## Verification Results

### Lint Gate (Primary Acceptance Criterion)

| Check | Command | Result |
| :--- | :--- | :--- |
| Default lint | `bun run lint` | **EXIT 0**, no stdout |
| Max-warnings guard | `eslint . --max-warnings=0` (script default) | **EXIT 0** |
| Schema compile | `glib-compile-schemas schemas --dry-run` | **EXIT 0** |

`bun run lint` passes with **0 errors, 0 warnings** — the SPEC §3 acceptance criterion is met.

### Schema ↔ Code ↔ Prefs Parity

| Source | `road` | `ui` | Total entries |
| :--- | :---: | :---: | :---: |
| `GLYPH_SETS` (`atlasManager.js:16-68`) | ✅ | ✅ | 6 |
| `glyph-set` `<choices>` (`gschema.xml:31-38`) | ✅ | ✅ | 6 |
| `GLYPH_OPTIONS` (`prefs.js:11-18`) | ✅ | ✅ | 6 |

All three registries contain exactly the same six IDs in the same order. No orphaned or missing entries. The `glyph-set` schema `<description>` was also updated to list `road, ui`. Correct.

### Char Array Integrity

| Set | `count` | `chars.length` | Unique | Status |
| :--- | :---: | :---: | :---: | :--- |
| `road` | 24 | 24 | 24 | ✅ no intra-set duplicates |
| `ui` | 24 | 24 | 24 | ✅ no intra-set duplicates |

Both arrays fit within the 8×8 = 64-cell atlas grid (24 ≤ 64). The shader's `max(2.0, matrix_glyph_count)` clamp and `floor(hash * active_glyph_count)` indexing keep all sampled cells within the rendered region. Correct.

### Prior Audit Findings — Status

| Prior finding | Severity | Status | Evidence |
| :--- | :---: | :---: | :--- |
| H1 — `destroy()` never unrealized cached Cogl textures | High | **FIXED** | `atlasManager.js:175-182` now iterates `_cache.values()` and calls `content.unrealize()` (guarded by `typeof === 'function'` + try/catch) before `clear()`. |
| M1 — Procedural Cairo surface never `finish()`ed | Medium | **FIXED** | `atlasManager.js:152` calls `surface.finish()` after `writeToPNG()`. The pipeline now round-trips through a temp PNG → `GdkPixbuf.Pixbuf.new_from_file` → `read_pixel_bytes()`, so the CPU pixel buffer is released before Cogl upload. |

Both regressions from the previous audit are closed. The lifecycle cleanliness rule from `AGENTS.md` is now satisfied.

---

## Findings

### High

#### H1. Color-emoji font as primary fallback conflicts with white-mask atlas strategy

**Files:** `shell/atlasManager.js:50, 61`, `shell/atlasManager.js:130-146`, `shell/shader.js:33`

```js
// atlasManager.js — font stack for road & ui
font: 'Noto Color Emoji, DejaVu Sans, Symbola, Sans Bold 38'

// atlasManager.js — white mask rendering
cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0);
// ...
PangoCairo.show_layout(cr, layout);

// shader.js — single-channel mask sampling
return texture2D(cogl_sampler_0, atlas_uv).r;
```

The atlas pipeline is designed around a **white alpha mask**: glyphs are drawn in pure white on a transparent background, and the fragment shader samples only the `.r` channel as a luminance mask (multiplied by the user's chosen rain color). This works correctly for monochrome outline fonts (DejaVu Sans, Symbola, monospace).

`Noto Color Emoji` is a **color (CBDT/sbix) emoji font**. When PangoCairo renders a layout whose resolved font is a color-emoji font, `pango_cairo_show_layout` paints the embedded color bitmap **in the emoji's native colors** — the `cr.setSourceRGBA(1,1,1,1)` source is ignored for color-glyph runs. The resulting atlas cells are therefore **not** a clean white mask; they contain the emoji's actual RGBA pixels.

Consequences for the `.r`-only shader sampling:
- Red-dominant emojis (🛑 stop sign, 🚨 rotating light, ⛽ fuel pump) → high `.r` → bright glyph. ✅
- Blue/green-dominant emojis (🚦 traffic light, 🔋 battery, 📶 signal, 💾 floppy) → low `.r` → dim or near-invisible glyph. ❌
- Yellow emojis (⚠️, ⭐, 🚧) → moderate `.r` → washed-out glyph. ⚠️

The visual result is an uneven rain where some ideograms glow brightly and others are barely visible, contradicting the SPEC §2 "white alpha mask rendering ensures shader luminance multiplication samples cleanly" guarantee.

**Caveat:** This analysis is based on PangoCairo's documented behavior for color-font runs. The actual resolved font and rendering path depend on the system's Pango/harfbuzz version and whether the GNOME Shell Pango context forces a monochrome fallback. **Runtime verification in `./dev.sh` (nested Wayland) is required to confirm.** If the nested session shows uneven glyph brightness, this is confirmed.

**Fix (if confirmed):**
1. **Preferred — use a monochrome symbol font as primary:** reorder the fallback to `'Symbola, Noto Sans Symbols2, DejaVu Sans, Sans Bold 38'`. Symbola renders ideograms as monochrome outlines that respect `setSourceRGBA`, producing a clean white mask. `Noto Color Emoji` should be a last resort, not the first choice, for a mask-based pipeline.
2. **Alternative — force monochrome rendering:** set `Pango.AttrList` with `Pango.attr_foreground_new(0xFFFF, 0xFFFF, 0xFFFF)` on the layout, or use `pango_cairo_layout_path` + `cr.fill()` which bypasses color-bitmap rendering. This is more invasive.
3. **Alternative — sample luminance instead of `.r`:** change the shader to `dot(texture2D(...).rgb, vec3(0.299, 0.587, 0.114))` to use perceived luminance of the color emoji. This makes color-emoji rendering usable but changes the mask semantics for all glyph sets and may dim the existing katakana/binary/hex/html sets.

Option 1 is the lowest-risk fix and aligns the font stack with the mask-based architecture.

---

### Medium

#### M1. Cross-set glyph overlap: ⚡ (high voltage) appears in both `road` and `ui`

**Files:** `shell/atlasManager.js:54, 65`

`⚡` is present in both the `road` chars array (index 13) and the `ui` chars array (index 10). This is not a bug — each set renders its own independent atlas, so there is no texture conflict — but it is a content-design smell. The two sets are marketed as distinct visual themes ("Road & Public Signs" vs "Digital UI Icons"), and a shared glyph dilutes that distinctiveness. A user switching between the two sets will see the same symbol in both, which reduces the perceived variety of the feature.

**Impact:** Cosmetic / content-design only. No functional or rendering impact.

**Fix (optional):**
- In `ui`, replace `⚡` with a UI-specific icon not already in `road`, e.g. `🔌` (electric plug) or `⏰` (alarm clock) or `🖥️` (desktop). Or
- In `road`, replace `⚡` with `🚷` (no pedestrians) or `🚯` (no littering) to keep the road set purely traffic/safety-themed.

---

### Low

#### L1. SPEC deviation: font size is `Bold 38`, SPEC specifies `Bold 40`

**File:** `shell/atlasManager.js:50, 61`
**Spec:** `SPEC_IDEOGRAM_GLYPHS.md` §2 — `'Noto Color Emoji, DejaVu Sans, Symbola, Sans Bold 40'`
**Actual:** `'Noto Color Emoji, DejaVu Sans, Symbola, Sans Bold 38'`

The implementation uses 38pt instead of the specified 40pt. This is a 5% reduction — likely an intentional tuning decision during implementation to prevent glyph clipping in the 64×64 atlas cells, but it is an undocumented deviation from the SPEC. The `CHANGELOG_IDEOGRAM_GLYPHS.md` repeats the `38` value without noting the change from spec.

**Impact:** Negligible visual difference. No functional impact. The glyph still fits within the cell.

**Fix:** Either amend `SPEC_IDEOGRAM_GLYPHS.md` to read `Bold 38` (preferred — record the tuning decision), or revert the code to `Bold 40` if the spec value was intentional and the clipping concern was unfounded.

---

#### L2. SPEC deviation: prefs labels show 4 sample emojis, SPEC specifies 3

**File:** `prefs.js:16-17`
**Spec:** `SPEC_IDEOGRAM_GLYPHS.md` §2 — `_('Road & Public Signs (🛑, ⚠️, 🚸)')` and `_('Digital UI Icons (⚙️, 🔍, 💾)')`
**Actual:** `'Road & Public Signs (🛑, ⚠️, 🚸, ♿)'` and `'Digital UI Icons (⚙️, 🔍, 💾, 💻)'`

The implementation adds a fourth sample emoji to each prefs label. This is a minor enhancement (more representative preview) but deviates from the spec text. The `♿` and `💻` additions are arguably more inclusive/representative of each set's theme.

**Impact:** None — the labels render correctly and are arguably more informative. Pure documentation drift.

**Fix:** Amend `SPEC_IDEOGRAM_GLYPHS.md` §2 to match the implemented 4-emoji labels.

---

#### L3. Bounded cache growth increased from 4 to 6 entries (~6 MB GPU ceiling)

**File:** `shell/atlasManager.js:16-68`

The prior audit (`AUDIT_REPORT_GLYPH_SETS.md`) noted the cache was bounded at 4 entries (~4 MB GPU). With the two new sets, the ceiling is now 6 entries (~6 MB GPU for 6 × 512×512 RGBA textures). This remains bounded and is not a leak — but the prior audit's recommendation to consider LRU eviction (keep only the 2 most recently used sets) becomes more relevant as the set count grows. If future roadmap items add more sets (e.g. astrological, weather), the unbounded-for-session cache will continue to grow linearly.

**Impact:** Low — 6 MB is negligible on modern GPUs. No action needed for this release.

**Fix (future-proofing):** Consider an LRU cap (e.g. 3–4 most recently used) in `getAtlas()` if the set count is expected to grow beyond 8. Not required for the current 6-set release.

---

## Verified Correct

### Atlas Rendering Pipeline
- **Temp-PNG round-trip:** `_renderProceduralAtlas` writes the Cairo surface to a temp PNG, loads it via `GdkPixbuf.Pixbuf.new_from_file`, uploads `read_pixel_bytes()` to Cogl, then deletes the temp file (guarded by try/catch). This is a reliable cross-GJS-version pattern for pixel conversion. Correct.
- **Surface finalization:** `surface.finish()` called after `writeToPNG()` (line 152). CPU pixel buffer released immediately. Compliant with `AGENTS.md` lifecycle rules. **Addresses prior M1.**
- **Transparent background:** `Cairo.Operator.CLEAR` paint before `OVER` (lines 122-124). Unrendered atlas cells are transparent → `.r = 0.0` → `glyph_alpha = 0`. Correct.
- **Cell centering:** Per-glyph `get_pixel_extents()` + offset math (lines 139-143) centers each ideogram in its 64×64 cell. Correct.
- **Atlas grid safety:** Loop guard `i < (GLYPH_ATLAS_COLUMNS * GLYPH_ATLAS_ROWS)` (line 133) prevents out-of-bounds writes even if a char array exceeds 64 entries. Defensive. Correct.

### Texture Lifecycle
- **`destroy()` unrealize:** `atlasManager.js:175-182` iterates all cached `St.ImageContent` and calls `unrealize()` (guarded) before `Map.clear()`. GPU textures released deterministically. **Addresses prior H1.** Compliant with `AGENTS.md` "Lifecycle Cleanliness".
- **Cache hit path:** `getAtlas()` returns cached content without re-rendering (lines 78-83). No redundant Cairo/Pango work. Correct.
- **Manager integration:** `MatrixScreensaverManager.destroy()` calls `this._atlasManager.destroy()` (verified via prior audit, unchanged). Correct.

### Uniform State Caching
- **`matrix_glyph_count` initialized to `[57.0]`** in `_state` (`matrixScreensaver.js:39`). Updated via `setGlyphCount(glyphAtlas.count)` after atlas build (line 183). For `road`/`ui`, this pushes `24.0` to the uniform. Correct.
- **`setGlyphCount` clamping:** `Math.max(2.0, count)` (line 130) mirrors shader `max(2.0, matrix_glyph_count)` (shader.js:70). Double-safe. Correct.
- **`flushAllUniforms()`** pushes cached state on `show()` even if `setGlyphCount` was called before pipeline build (location = -1). Correct.

### Shader Correctness (unchanged by this feature)
- **`cogl_sampler_0`** used for all texture sampling (shader.js:10, 33). Compliant with `AGENTS.md` graphics rules.
- **No ternary `length()` on `vec3`:** Shader uses `max()`, `mix()`, `step()`, `smoothstep()`, `clamp()`, `dot()`-free. Compliant.
- **Atlas cell indexing:** `mod(glyph_index, 8.0)` / `floor(glyph_index / 8.0)` maps glyph indices 0–23 into the 8×8 grid (cells 0–23, all in rows 0–2). Correct for both new sets.

### Schema & Prefs
- **`glyph-set` schema key** (type `s`, 6 `<choices>`) matches `GLYPH_SETS` IDs and `GLYPH_OPTIONS` IDs exactly. No orphans. Correct.
- **Defensive fallbacks:** `GLYPH_SETS[glyphSetId] || GLYPH_SETS.katakana` (atlasManager.js:77) and `settings.get_string('glyph-set') || 'katakana'` (matrixScreensaver.js:498). Unknown values gracefully fall back. Correct.
- **ComboRow sync:** `prefs.js:118-138` bidirectional `notify::selected` ↔ `changed::glyph-set` synchronization with `findIndex` fallback to 0. Correct.
- **Schema description updated:** `gschema.xml:41` description now lists `road, ui`. Correct.

### Font Fallback Chain (system verification)
- **`Noto Color Emoji`** — installed at `/usr/share/fonts/noto/NotoColorEmoji.ttf`. ✅ present
- **`DejaVu Sans`** — installed at `/usr/share/fonts/TTF/DejaVuSans.ttf` (+ Bold variant). ✅ present
- **`Symbola`** — **not installed** on this system. ⚠️ absent (but third in chain; Pango falls through to DejaVu Sans for missing Symbola coverage)
- **`Sans`** — generic family alias, always resolves. ✅ present

The fallback chain is functional on this system, though Symbola (the monochrome symbol font that would be ideal for the mask-based pipeline — see H1) is not installed. Installing `ttf-symbola` or `fonts-noto-symbols` would improve monochrome ideogram coverage.

---

## Recommended Action Priority

| # | Severity | Finding | Effort | Blocks release? |
| :---: | :---: | :--- | :---: | :---: |
| 1 | High | **H1** — Confirm color-emoji rendering in `./dev.sh`; if uneven, reorder font stack to put monochrome `Symbola`/`Noto Sans Symbols2` first | 30 min | Conditional |
| 2 | Medium | **M1** — Replace duplicate `⚡` in one of the two sets | 2 min | No |
| 3 | Low | **L1** — Reconcile font size (38 vs 40) between SPEC and code | 1 min | No |
| 4 | Low | **L2** — Reconcile prefs label emoji count (4 vs 3) between SPEC and code | 1 min | No |
| 5 | Low | **L3** — Consider LRU cache cap if more glyph sets are planned | 15 min | No |

**Release blocker:** Only H1, and only if runtime verification confirms uneven glyph brightness. All other findings are advisory.

---

## Stage 03 Sign-off

| Criterion | Status |
| :--- | :---: |
| `bun run lint` → 0 errors, 0 warnings | ✅ PASS |
| `glib-compile-schemas` succeeds | ✅ PASS |
| `GLYPH_SETS` ↔ schema `<choices>` ↔ `GLYPH_OPTIONS` parity | ✅ PASS (6/6/6) |
| Char arrays well-formed (`count` === `chars.length`, no intra-set dups) | ✅ PASS |
| Prior audit H1 (`destroy` unrealize) fixed | ✅ PASS |
| Prior audit M1 (`surface.finish`) fixed | ✅ PASS |
| Atlas rendering pipeline correct | ✅ PASS |
| Texture lifecycle compliant with `AGENTS.md` | ✅ PASS |
| Shader sampling correct for mask-based atlas | ✅ PASS (architecture) |
| Color-emoji font choice produces clean white mask | ⚠️ NEEDS RUNTIME VERIFICATION (see H1) |
| No cross-set glyph duplication | ⚠️ ADVISORY (see M1) |
| SPEC ↔ implementation text drift | ⚠️ ADVISORY (see L1, L2) |

**Audit Result: APPROVED WITH CONDITIONAL FOLLOW-UP** — The feature is structurally complete, lint-clean, and schema-parity-verified. Prior audit regressions are fixed. The single conditional item (H1) requires runtime confirmation in the nested Wayland sandbox (`./dev.sh`) to verify that the color-emoji font stack produces visually uniform glyph brightness under the `.r`-channel mask sampling pipeline. If H1 is confirmed, apply the font-stack reorder fix (Option 1) before release.
