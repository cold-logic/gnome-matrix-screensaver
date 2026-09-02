# Stage 03 Audit Report — Teal Matrix Screensaver

**Scope:** Quick Settings toggle, fullscreen inhibit, lockscreen awareness, Clutter fade-in transitions
**Files reviewed:** `extension.js`, `shell/quickSettings.js`, `shell/matrixScreensaver.js`, `shell/shader.js`, `prefs.js`, `schemas/org.gnome.shell.extensions.matrix-screensaver.gschema.xml`, `metadata.json`
**Date:** 2026-09-02
**Target:** GNOME Shell 50+ / Wayland

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 2 |
| Medium   | 3 |
| Low      | 4 |

Overall the lifecycle plumbing is solid: `connectObject`/`disconnectObject` is used consistently, Clutter signal IDs are stored and disconnected in `destroy()`, and GObject registrations carry unique `GTypeName`s. The new features integrate cleanly. The most serious finding is a **persistent 250ms idle poller** that contradicts the project's "0% CPU idle" rule.

---

## Critical

### C1. Persistent 250ms idle poller violates "0% CPU Idle" rule
**File:** `shell/matrixScreensaver.js:317-342`
**Rule violated:** AGENTS.md — *"The 30fps animation ticker must ONLY run when screensaver is active. No persistent timers during normal desktop usage."*

`this._idleTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, ...)` runs **continuously from constructor until `destroy()`**, even when the screensaver is disabled and the user is actively using the desktop. While the 30fps animation ticker is correctly gated, this new poller is a persistent wakeup source that burns CPU/wakes the CPU every 250ms for the entire session.

**Fix:** Replace polling with `Meta.IdleMonitor` watches:
- `add_idle_watch(timeoutMs, callback)` — fires once when idle threshold is crossed → call `_activateScreensaver(false)`.
- `add_user_active_watch(callback)` — fires when user becomes active → call `_deactivateScreensaver()`.
- Re-arm the idle watch whenever `idle-timeout` or `screensaver-enabled` changes.

This eliminates the poller entirely and restores true 0% CPU idle. The fullscreen-inhibit check can be done inside the idle-watch callback (or on `window-managed` / `notify::fullscreen` signals from `global.display` / `global.workspace_manager`) rather than polled.

---

## High

### H1. Fullscreen inhibit only checks primary monitor
**File:** `shell/matrixScreensaver.js:349-356`
```js
return windows.some(w => w.is_fullscreen() && w.is_on_primary_monitor());
```
A fullscreen game/video on a secondary monitor will not inhibit the screensaver, contradicting the setting's description ("fullscreen videos or gaming"). Multi-monitor users will get the screensaver popping over their secondary-display fullscreen content.

**Fix:** Drop the `is_on_primary_monitor()` filter, or make it a separate setting. Also consider listening to `window-managed` / `notify::fullscreen` instead of relying on the 250ms poller (see C1).

### H2. Lock-screen activation bypasses the fade-in transition
**File:** `shell/matrixScreensaver.js:361`
```js
this._activateScreensaver(false, true);  // immediate=true
```
`_onLockStateChanged` passes `immediate=true`, so when the screen locks the rain appears instantly with no fade. This contradicts the "Clutter fade-in transitions" feature being audited. If the instant transition is intentional for the lock path (sudden lock event), it should be documented; otherwise it should fade like the idle path. The manual-test and idle paths correctly use `immediate=false` and do fade.

---

## Medium

### M1. Lockscreen rain may render above the shield, not behind it
**File:** `shell/matrixScreensaver.js:184`
```js
Main.layoutManager.uiGroup.add_child(this._actor);
```
The actor is added to `uiGroup` unconditionally. In `unlock-dialog` session mode the layering relative to `ScreenShield`'s shield/lock dialog is not guaranteed — the rain may appear *above* the unlock dialog instead of behind it. The setting description promises "behind the GNOME lock screen & shield".

**Fix:** When `_isLocked()`, insert the actor below the shield group (e.g. `Main.screenShield.actor` / `Main.layoutManager.uiGroup.set_child_below_sibling(this._actor, Main.screenShield.actor)`), or add to the appropriate lock-screen background group. **Needs runtime verification in nested Wayland (`./dev.sh`) with the screen locked.**

### M2. `lockscreen-enabled` toggled off while locked does not dismiss rain
**File:** `shell/matrixScreensaver.js:358-368`
`_onLockStateChanged` returns early if `lockscreen-enabled` is false, and the idle poller only deactivates when `!this._isLocked()`. So flipping the setting off while the screen is locked leaves rain on-screen until unlock. Minor edge case but inconsistent with user expectation.

**Fix:** Add a `changed::lockscreen-enabled` handler that calls `_deactivateScreensaver()` when toggled off while locked.

### M3. Magic number for `Gio.SettingsBindFlags`
**File:** `shell/quickSettings.js:16-21`
```js
this._settings.bind('screensaver-enabled', this, 'checked', 3);
```
The literal `3` is fragile and the `Gio` import is missing from this file. If the enum value ever changes, this silently breaks.

**Fix:** `import Gio from 'gi://Gio';` and use `Gio.SettingsBindFlags.DEFAULT`.

---

## Low

### L1. `get_tab_list` workspace argument
**File:** `shell/matrixScreensaver.js:351`
`global.display.get_tab_list(Meta.TabList.NORMAL, null)` — passing `null` for the workspace may not enumerate windows on all workspaces in some Mutter versions. Verify behavior on GNOME 50; if needed, iterate `global.workspace_manager.get_n_workspaces()`.

### L2. `_hasFullscreenWindow` swallows all errors silently
**File:** `shell/matrixScreensaver.js:353`
`catch {}` returns `false` on any error, which would unexpectedly *enable* the screensaver during a fullscreen session if the API throws. At minimum log via `console.warn` so failures are diagnosable.

### L3. Fade-out `onComplete` closure captures `this._actor`
**File:** `shell/matrixScreensaver.js:230-234`
The `ease` `onComplete` references `this._actor`. `destroy()` calls `remove_all_transitions()` first, so the callback cannot fire post-destroy — safe today, but the closure keeps the actor alive until GC. Minor; consider binding a weak check or using `EASE_OUT_CUBIC` with a flag.

### L4. `prefs.js` HTML entities in titles
**File:** `prefs.js:23,47,84,91,113`
Titles use `&amp;` (e.g. `'Live Preview &amp; Test'`). Adw `PreferencesGroup`/`ActionRow` titles are plain text, not markup — this will render the literal string `&amp;` rather than `&`. Use a plain `&`.

---

## Verified Correct

- **GObject registration:** `MatrixScreensaverEffect`, `MatrixQuickToggle`, `MatrixQuickSettingsIndicator` all use `GObject.registerClass` with unique `GTypeName`s (`_ColdLogic` / `_ColdLogicGnome50` suffixes). `MonitorScreensaverActor` and `MatrixScreensaverManager` are plain JS classes (correct — they don't subclass GObject).
- **Signal lifecycle:** `button-press-event` / `key-press-event` IDs stored on `MonitorScreensaverActor` and disconnected in `destroy()` (lines 175-182, 247-254). Compliant with AGENTS.md lifecycle rule.
- **`connectObject`/`disconnectObject`:** Manager uses the modern GNOME pattern for `layoutManager`, `screenShield`, and `settings`, with a single `disconnectObject(this)` sweep in `destroy()` (lines 511-515). Correct.
- **Animation ticker gating:** `_startAnimation`/`_stopAnimation` correctly ensure the 30fps timer only runs while `_isActive` (lines 376-398). Compliant with 0% CPU rule for the *animation* ticker.
- **GLSL sampler:** `cogl_sampler_0` used correctly (shader.js:11, 33). No ternary `length()` on `vec3`. Compliant with AGENTS.md graphics rules.
- **State caching:** `_state` object pre-caches uniforms; `flushAllUniforms` pushes on show (line 203). Compliant.
- **Schema/code key parity:** All 12 schema keys are consumed by the code; no orphaned keys, no missing keys. `inhibit-fullscreen`, `lockscreen-enabled`, `screensaver-enabled` all present and bound.
- **Extension enable/disable:** `extension.js` nulls `_manager`, `_quickSettings`, `_settings` in `disable()`. Clean.
- **Quick Settings indicator:** `addExternalIndicator` + explicit `_toggle.destroy()` in indicator `destroy()` (quickSettings.js:35-41). Clean.
- **`session-modes: ["user", "unlock-dialog"]`** in metadata.json — correct for lock-screen awareness.
- **`shell-version`** includes `50`. Compatible.

---

## Recommended Action Priority

1. **C1** — Replace 250ms poller with `Meta.IdleMonitor` watches (restores 0% CPU idle, biggest win).
2. **H1** — Fix fullscreen inhibit to cover all monitors.
3. **M1** — Verify/fix lock-screen layering in nested Wayland.
4. **H2** — Decide on fade vs. instant for lock activation; document or fix.
5. **M2, M3, L4** — Small correctness/polish fixes.

All findings are localized to `shell/matrixScreensaver.js` and `shell/quickSettings.js`; no architectural rework needed.
