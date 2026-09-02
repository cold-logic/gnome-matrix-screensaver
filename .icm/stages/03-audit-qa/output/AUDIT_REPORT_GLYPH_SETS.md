# Stage 03 Audit Report — Selectable Glyph Sets Feature

**Scope:** Procedural Cairo/Pango atlas rendering, Cogl texture caching, `matrix_glyph_count` uniform, `glyph-set` schema key & prefs selector, lifecycle of `AtlasManager`
**Files reviewed:** `shell/atlasManager.js`, `shell/shader.js`, `shell/matrixScreensaver.js`, `prefs.js`, `schemas/org.gnome.shell.extensions.matrix-screensaver.gschema.xml`, `shell/quickSettings.js`, `extension.js`, `metadata.json`
**Date:** 2026-09-02
**Target:** GNOME Shell 50+ / Wayland

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 3 |
| Low      | 3 |

The feature is well-architected: atlas rendering is correct, the `matrix_glyph_count` uniform is properly clamped (`max(2.0, ...)`) so small sets (binary=2, hex=16) never sample empty atlas cells, and the schema/prefs/code are all in parity. The primary concerns are **GPU texture lifecycle** (cached Cogl textures are never explicitly unrealized) and **Cairo surface finalization** (procedural surfaces are flushed but not `finish()`ed, leaving ~1 MB CPU buffers per set pending GC).

---

## High

### H1. Cached Cogl textures are never explicitly unrealized — GPU memory retained for full session

**File:** `shell/atlasManager.js:142-144`
```js
destroy() {
    this._cache.clear();
}
```

`AtlasManager._cache` holds `St.ImageContent` (Cogl texture) GObjects for each rendered glyph set. `destroy()` only drops the JS references via `Map.clear()` — it does **not** call `content.unrealize()` or otherwise release the GPU textures. The GObjects are eventually finalized by GObject reference counting when GC collects them, but this is non-deterministic.

Worse, the cache is **never evicted during the session**: switching glyph sets via `changed::glyph-set` → `_rebuildActors()` renders the new set and caches it, but the old set's texture stays cached. A user cycling through all 4 sets accumulates 4 × 512×512 RGBA textures (~4 MB GPU) for the entire session even if they settle on one set. The leak is **bounded** (max 4 entries) so it is not unbounded growth, but it violates the spirit of the AGENTS.md "Lifecycle Cleanliness" rule.

**Fix:**
```js
destroy() {
    for (const content of this._cache.values()) {
        if (content && content.unrealize) {
            try { content.unrealize(); } catch {}
        }
    }
    this._cache.clear();
}
```
Additionally, consider an LRU eviction policy (e.g., keep only the 2 most recently used sets) if the set count grows beyond 4 in the future.

---

## Medium

### M1. Procedural Cairo surfaces are flushed but never `finish()`ed — CPU buffer lingers until GC

**File:** `shell/atlasManager.js:124-139`
```js
surface.flush();
const stride = surface.getStride();
const data = surface.getData();
// ... new GLib.Bytes(data) → content.set_bytes(...) ...
return content;   // surface & cr go out of scope here
```

`surface.flush()` only ensures pending drawing is complete; it does **not** release the underlying cairo surface's pixel buffer (512×512×4 = 1 MB). The buffer remains allocated until the JS wrapper is GC'd. `new GLib.Bytes(data)` copies the pixel data, and `content.set_bytes()` copies it again into Cogl, so the surface buffer is no longer needed after `set_bytes()` returns.

Calling `surface.finish()` (and `cr.$dispose()` / `cr.destroy()` where available) after the upload would release the 1 MB CPU buffer immediately. With 4 procedural sets, this is up to 4 MB of CPU memory held pending GC.

**Fix:**
```js
content.set_bytes(coglContext, bytes, Cogl.PixelFormat.RGBA_8888, size, size, stride);

surface.finish();   // release the 1 MB pixel buffer now
return content;
```
Note: `data` (the `Uint8Array` view from `surface.getData()`) must not be used after `finish()`. Since the copy already happened in `new GLib.Bytes(data)`, this is safe.

### M2. `GdkPixbuf.Pixbuf` for static katakana asset is not explicitly released

**File:** `shell/atlasManager.js:68-77`
```js
const pixbuf = GdkPixbuf.Pixbuf.new_from_file(atlasPath);
content = St.ImageContent.new_with_preferred_size(GLYPH_ATLAS_SIZE, GLYPH_ATLAS_SIZE);
content.set_bytes(
    coglContext,
    pixbuf.read_pixel_bytes(),
    ...
);
```

The `pixbuf` is a local variable holding a full decoded image (up to ~1 MB for a 512×512 RGB PNG). It is only needed for `read_pixel_bytes()` and the dimension/stride queries. After `set_bytes()`, it lingers until GC. Since this path runs at most once (katakana is cached), the impact is small, but for consistency with the procedural path's cleanup, the pixbuf should be released.

**Fix:** This is handled by GObject refcounting + GC, so no explicit free API is strictly required. If desired, set `pixbuf = null` after the `set_bytes` call to drop the reference eagerly. Low priority.

### M3. `_rebuildActors()` on `changed::glyph-set` causes visible flicker during active screensaver

**File:** `shell/matrixScreensaver.js:315, 485-514`
```js
'changed::glyph-set', () => this._rebuildActors(),
```

`_rebuildActors()` destroys all monitor actors and recreates them from scratch. When the screensaver is active (`_isActive === true`), it calls `actor.show(true, locked)` with `immediate=true` (line 510), so the new actors appear at full opacity instantly. However, there is a brief frame gap between destroying the old actors and the new ones being composited, which produces a visible black flash. This is a UX issue, not a leak — but worth noting since glyph-set switching from Quick Settings or prefs while the screensaver is running would flicker.

**Fix (optional):** Create the new actors first, add them to the uiGroup, then destroy the old ones — or cross-fade. Low priority since switching glyph sets mid-screensaver is uncommon.

---

## Low

### L1. `GLYPH_SEQUENCE_LENGTH` is dead code — exported but never imported

**File:** `shell/shader.js:8`
```js
export const GLYPH_SEQUENCE_LENGTH = 57;
```

This constant was superseded by the runtime `matrix_glyph_count` uniform. A grep across `shell/` confirms zero import sites. It is misleading because the hardcoded `57` no longer reflects the active glyph count for non-katakana sets.

**Fix:** Remove the export, or if kept for documentation, rename to `KATAKANA_GLYPH_COUNT` and stop exporting it.

### L2. `cr.setSourceRGBA` called inside the per-glyph loop but never changes

**File:** `shell/atlasManager.js:120`
```js
for (let i = 0; i < chars.length && ...; i++) {
    // ...
    cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0);  // same value every iteration
    PangoCairo.show_layout(cr, layout);
}
```

The source color is constant (pure white mask). Moving it above the loop avoids redundant Cairo state calls. Micro-optimization; rendering runs at most 4 times total (cached), so no real-world impact.

### L3. `Pango.FontDescription` not explicitly freed

**File:** `shell/atlasManager.js:104`
```js
const fontDesc = Pango.FontDescription.from_string('Monospace Bold 34');
```

`Pango.FontDescription` is a boxed type in GJS; it is GC-managed. No explicit free is required, but like the Cairo surface, it lingers until GC. Negligible memory (~100 bytes). No action needed.

---

## Verified Correct

### Memory & Buffers
- **Cogl pixel upload:** `content.set_bytes()` correctly passes the cogl context, pixel format (`RGBA_8888` for procedural, `RGB_888`/`RGBA_8888` for static based on alpha), width, height, and stride. The `GLib.Bytes` from `surface.getData()` / `pixbuf.read_pixel_bytes()` is copied internally by Cogl, so JS-side buffers can be released after upload. Correct.
- **Atlas cache hit path:** `getAtlas()` returns the cached `St.ImageContent` without re-rendering. No redundant Cairo/Pango work on repeated calls. Correct.
- **Bounded cache growth:** `GLYPH_SETS` has 4 entries; the cache can hold at most 4 textures. No unbounded growth.

### Uniform Caching
- **`_locations` Map:** Uniform locations are cached per-name in `MatrixScreensaverEffect._locations`. `_applyUniform` fetches from cache, falls back to `get_uniform_location`, and stores the result. `vfunc_buildPipeline` clears the cache on rebuild (with a null guard). Compliant with AGENTS.md "State Caching" rule.
- **`_state` pre-caching:** `matrix_glyph_count` is initialized to `[57.0]` in `_state` (line 39) and updated via `setGlyphCount`. `flushAllUniforms()` pushes all cached state on `show()`. Even if `setGlyphCount` is called before the pipeline is built (location = -1), the value is preserved in `_state` and pushed by `flushAllUniforms` after build. Correct.
- **`setGlyphCount` clamping:** `Math.max(2.0, count)` (line 130) mirrors the shader's `max(2.0, matrix_glyph_count)` (shader.js:71). Double-safe. Correct.

### GTypeName Uniqueness
- **No new GTypeNames added** by this feature. `AtlasManager` is a plain JS class (correct — does not subclass GObject). Existing registrations remain unique:
  - `MatrixScreensaverEffect_ColdLogicGnome50`
  - `MatrixQuickToggle_ColdLogic`
  - `MatrixQuickSettingsIndicator_ColdLogic`
- No collision risk. Compliant.

### Lifecycle Cleanup
- **`AtlasManager.destroy()` called from manager:** `MatrixScreensaverManager.destroy()` calls `this._atlasManager.destroy()` then nulls the reference (lines 542-545). Correct.
- **`MonitorScreensaverActor.destroy()`** nulls `this._glyphAtlas` (line 273), dropping the actor's reference to the shared content. The cache retains its reference for reuse. Correct by design.
- **Signal lifecycle unchanged:** `_buttonPressId` / `_keyPressId` stored and disconnected in `destroy()` (lines 261-268). Compliant with AGENTS.md.
- **`changed::glyph-set` handler** registered via `connectObject` and cleaned up by `disconnectObject(this)` in manager `destroy()`. Correct.
- **Extension re-enable:** New `AtlasManager` created per `enable()`; old cache cleared in `disable()` → `destroy()`. No stale cache across sessions. Correct.

### Shader Correctness
- **`cogl_sampler_0`** used for all texture sampling (shader.js:11, 34). Compliant with AGENTS.md graphics rules.
- **No ternary `length()` on `vec3`:** The shader uses `max()`, `mix()`, `step()`, `smoothstep()`, `clamp()` — no scalar `length()` on vec3. Compliant.
- **Atlas cell indexing:** `mod(glyph_index, 8.0)` / `floor(glyph_index / 8.0)` maps glyph indices to the 8×8 atlas grid. For binary (2 glyphs), only cells (0,0) and (1,0) are sampled. For ascii (42 glyphs), cells 0-41. All within 64-cell grid. Correct.
- **Empty cell safety:** Procedural atlases use `Cairo.Operator.CLEAR` for transparent background (line 99). Unrendered cells return `.r = 0.0`, yielding `glyph_alpha = 0`. Combined with `max(2.0, matrix_glyph_count)` indexing, the shader never samples unrendered cells for active glyphs. Correct.

### Schema & Prefs Parity
- **`glyph-set` schema key** (type `s`, 4 `<choices>`) matches `GLYPH_SETS` IDs in `atlasManager.js` and `GLYPH_OPTIONS` in `prefs.js`. No orphaned or missing entries.
- **Defensive fallback:** `GLYPH_SETS[glyphSetId] || GLYPH_SETS.katakana` (atlasManager.js:54) and `settings.get_string('glyph-set') || 'katakana'` (matrixScreensaver.js:491) handle unknown/empty values. Correct.
- **ComboRow initialization:** `prefs.js:105-107` resolves current setting to a valid index, defaulting to 0. Correct.

---

## Recommended Action Priority

1. **H1** — Add explicit `content.unrealize()` in `AtlasManager.destroy()` to release GPU textures deterministically.
2. **M1** — Call `surface.finish()` after `set_bytes()` in `_renderProceduralAtlas` to release the 1 MB CPU pixel buffer immediately.
3. **L1** — Remove dead `GLYPH_SEQUENCE_LENGTH` export.
4. **M2, M3, L2** — Minor cleanup / UX polish; no functional bugs.

All findings are localized to `shell/atlasManager.js` (H1, M1, M2, L2, L3) and `shell/shader.js` (L1). No architectural rework needed; the feature is production-ready with the H1 + M1 fixes applied.
