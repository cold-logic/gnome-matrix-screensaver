import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {AtlasManager} from './atlasManager.js';
import {
    buildShaderCode,
    buildShaderDeclarations,
    parseColorToRgb,
} from './shader.js';

const FRAME_INTERVAL_MS = 33; // ~30 FPS
const FADE_IN_DURATION_MS = 800;
const FADE_OUT_DURATION_MS = 350;

/**
 * GLSL Effect base class.
 *
 * Shell.GLSLEffect caches the compiled pipeline on the GType class
 * (klass->base_pipeline), not per-instance. The first construction of a
 * given GType calls vfunc_build_pipeline(); all subsequent instances of
 * the same GType skip it and copy the cached pipeline.
 *
 * This means a single GType can only hold one shader variant. To support
 * multiple shader modes (random vs string), we register separate GTypes
 * per mode. Each subclass hardcodes its shader mode in
 * vfunc_build_pipeline(), getting its own class-level pipeline cache.
 *
 * Use createEffect(shaderMode) to instantiate the correct subclass.
 */
const MatrixScreensaverEffectBase = GObject.registerClass({
    GTypeName: 'MatrixScreensaverEffectBase_ColdLogic',
}, class MatrixScreensaverEffectBase extends Shell.GLSLEffect {
    _init(params = {}) {
        super._init(params);
        this._locations = new Map();
        this._state = {
            matrix_time: [0.0],
            matrix_columns: [80.0],
            matrix_rows: [45.0],
            matrix_glow: [0.0],
            matrix_glyph_scale: [0.8],
            matrix_speed: [0.4],
            matrix_stream_density: [1.0],
            matrix_soft_blur: [0.0],
            matrix_aa_sharpness: [0.5],
            matrix_glyph_count: [57.0],
            matrix_stream_length: [1.0],
            matrix_rain_color: [0.051, 0.878, 0.922],
            matrix_cursor_color: [0.051, 0.878, 0.922],
        };
    }

    vfunc_pre_paint(node, paintContext) {
        const result = super.vfunc_pre_paint(node, paintContext);

        // Override the NEAREST filter that ClutterOffscreenEffect's
        // ensure_pipeline_filter_for_scale() sets for non-fractional scaling.
        //
        // That NEAREST filter is correct for the standard offscreen use case
        // (paint FBO → screen at 1:1 texel:pixel). But our shader DOWNSAMPLES
        // the FBO: the 512×512 atlas (8×8 cells) is stretched to fill the FBO
        // at monitor resolution, then the shader maps each screen cell
        // (1/matrix_columns of screen) to an atlas cell (1/8 of FBO). This is
        // a ~12:1 downsampling ratio. NEAREST during downsampling causes
        // severe aliasing — the shader randomly hits or misses the smooth AA
        // edge texels, producing jagged glyph edges at any AA sharpness value.
        //
        // LINEAR ensures bilinear interpolation during downsampling, preserving
        // the smooth anti-aliased edges from the atlas PNG.
        const pipeline = this.get_pipeline();
        if (pipeline) {
            pipeline.set_layer_filters(
                0,
                Cogl.PipelineFilter.LINEAR,
                Cogl.PipelineFilter.LINEAR
            );
        }

        return result;
    }

    _applyUniform(name, count, values) {
        if (!this._locations) {
            this._locations = new Map();
        }
        let loc = this._locations.get(name);
        if (loc === undefined || loc === -1) {
            loc = this.get_uniform_location(name);
            if (loc !== -1) {
                this._locations.set(name, loc);
            }
        }
        if (loc !== undefined && loc !== -1) {
            this.set_uniform_float(loc, count, values);
        }
    }

    flushAllUniforms() {
        for (const [name, values] of Object.entries(this._state)) {
            this._applyUniform(name, values.length, values);
        }
    }

    setGridGeometry(cols, rows) {
        this._state.matrix_columns = [cols];
        this._state.matrix_rows = [rows];
        this._applyUniform('matrix_columns', 1, [cols]);
        this._applyUniform('matrix_rows', 1, [rows]);
    }

    setColors(trailRgb, cursorRgb) {
        this._state.matrix_rain_color = trailRgb;
        this._state.matrix_cursor_color = cursorRgb;
        this._applyUniform('matrix_rain_color', 3, trailRgb);
        this._applyUniform('matrix_cursor_color', 3, cursorRgb);
        this.queue_repaint();
    }

    setSpeed(speedPct) {
        const val = [speedPct / 100];
        this._state.matrix_speed = val;
        this._applyUniform('matrix_speed', 1, val);
        this.queue_repaint();
    }

    setGlyphScale(scalePct) {
        const val = [scalePct / 100];
        this._state.matrix_glyph_scale = val;
        this._applyUniform('matrix_glyph_scale', 1, val);
        this.queue_repaint();
    }

    setStreamDensity(densityPct) {
        const val = [densityPct / 100];
        this._state.matrix_stream_density = val;
        this._applyUniform('matrix_stream_density', 1, val);
        this.queue_repaint();
    }

    setStreamLength(lengthPct) {
        const val = [lengthPct / 100];
        this._state.matrix_stream_length = val;
        this._applyUniform('matrix_stream_length', 1, val);
        this.queue_repaint();
    }

    setGlowEnabled(enabled) {
        const val = [enabled ? 1.0 : 0.0];
        this._state.matrix_glow = val;
        this._applyUniform('matrix_glow', 1, val);
        this.queue_repaint();
    }

    setSoftBlurEnabled(enabled) {
        const val = [enabled ? 1.0 : 0.0];
        this._state.matrix_soft_blur = val;
        this._applyUniform('matrix_soft_blur', 1, val);
        this.queue_repaint();
    }

    setAaSharpness(pct) {
        const val = [Math.max(0.0, Math.min(1.0, pct / 100.0))];
        this._state.matrix_aa_sharpness = val;
        this._applyUniform('matrix_aa_sharpness', 1, val);
        this.queue_repaint();
    }

    setGlyphCount(count) {
        const val = [Math.max(2.0, count)];
        this._state.matrix_glyph_count = val;
        this._applyUniform('matrix_glyph_count', 1, val);
        this.queue_repaint();
    }

    setTime(seconds) {
        this._state.matrix_time = [seconds];
        this._applyUniform('matrix_time', 1, [seconds]);
        this.queue_repaint();
    }
});

/**
 * Random mutation mode effect.
 * Each GType gets its own class-level base_pipeline cache, so this
 * shader is compiled once and reused for all random-mode instances.
 */
const MatrixScreensaverEffectRandom = GObject.registerClass({
    GTypeName: 'MatrixScreensaverEffectRandom_ColdLogic',
}, class MatrixScreensaverEffectRandom extends MatrixScreensaverEffectBase {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(
            Cogl.SnippetHook.FRAGMENT,
            buildShaderDeclarations('random'),
            buildShaderCode('random'),
            false
        );
        if (this._locations) {
            this._locations.clear();
        }
    }
});

/**
 * String mode effect.
 * Separate GType → separate class-level pipeline cache.
 */
const MatrixScreensaverEffectString = GObject.registerClass({
    GTypeName: 'MatrixScreensaverEffectString_ColdLogic',
}, class MatrixScreensaverEffectString extends MatrixScreensaverEffectBase {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(
            Cogl.SnippetHook.FRAGMENT,
            buildShaderDeclarations('string'),
            buildShaderCode('string'),
            false
        );
        if (this._locations) {
            this._locations.clear();
        }
    }
});

/**
 * Factory: create the correct effect subclass for a shader mode.
 *
 * @param {string} shaderMode - 'random' or 'string'
 * @param {object} params - Constructor params (passed through, not mutated)
 * @returns {MatrixScreensaverEffectBase} Effect instance
 */
export function createEffect(shaderMode = 'random', params = {}) {
    if (shaderMode === 'string') {
        return new MatrixScreensaverEffectString(params);
    }
    return new MatrixScreensaverEffectRandom(params);
}

/**
 * Single Monitor Matrix Actor
 */
class MonitorScreensaverActor {
    constructor(monitor, settings, glyphAtlas, onDismissCallback) {
        this._monitor = monitor;
        this._onDismiss = onDismissCallback;
        this._glyphAtlas = glyphAtlas;

        this._actor = new Clutter.Actor({
            clip_to_allocation: true,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            reactive: true,
            visible: false,
            opacity: 0,
        });

        const fontSize = settings.get_double('font-size') || 20.0;
        const rowSpacingPct = settings.get_double('row-spacing') || 100.0;
        const effectiveRowHeight = Math.max(8, fontSize * (rowSpacingPct / 100));
        const glyphWidth = Math.max(6, fontSize * 0.68);
        const cols = Math.ceil(monitor.width / glyphWidth);
        const rows = Math.ceil(monitor.height / effectiveRowHeight) + 1;

        const grid = new Clutter.Actor({
            content: glyphAtlas.content,
            content_gravity: Clutter.ContentGravity.RESIZE_FILL,
            width: monitor.width,
            height: monitor.height,
            reactive: false,
        });
        this._actor.add_child(grid);

        this._effect = createEffect(glyphAtlas.shaderMode || 'random');
        grid.add_effect(this._effect);

        this._effect.setGridGeometry(cols, rows);
        this._effect.setGlyphCount(glyphAtlas.count);
        this.updateSettings(settings);

        this._buttonPressId = this._actor.connect('button-press-event', () => {
            if (this._onDismiss) this._onDismiss();
            return Clutter.EVENT_STOP;
        });
        this._keyPressId = this._actor.connect('key-press-event', () => {
            if (this._onDismiss) this._onDismiss();
            return Clutter.EVENT_STOP;
        });

        Main.layoutManager.uiGroup.add_child(this._actor);
    }

    updateSettings(settings) {
        if (!this._effect) return;
        const leadColor = parseColorToRgb(settings.get_string('lead-color'));
        const trailColor = parseColorToRgb(settings.get_string('trail-color'));
        this._effect.setColors(trailColor, leadColor);
        this._effect.setSpeed(settings.get_double('rain-speed'));
        this._effect.setGlyphScale(settings.get_double('glyph-scale'));
        this._effect.setStreamDensity(settings.get_double('stream-density'));
        this._effect.setStreamLength(settings.get_double('stream-length'));
        this._effect.setGlowEnabled(settings.get_boolean('glow-enabled'));
        this._effect.setSoftBlurEnabled(settings.get_boolean('soft-blur-enabled'));
        this._effect.setAaSharpness(settings.get_double('aa-sharpness'));
    }

    show(immediate = false, isLocked = false) {
        if (!this._actor) return;
        this._actor.remove_all_transitions();
        this._actor.visible = true;
        this._effect?.flushAllUniforms();

        // Layering: If locked, position below shield/lock dialog to ensure clock & PAM inputs are unobstructed
        try {
            if (isLocked && Main.screenShield?.actor && Main.layoutManager?.uiGroup) {
                Main.layoutManager.uiGroup.set_child_below_sibling(this._actor, Main.screenShield.actor);
            } else if (Main.layoutManager?.uiGroup) {
                Main.layoutManager.uiGroup.set_child_above_sibling(this._actor, null);
            }
        } catch (err) {
            console.warn(`[matrix-screensaver] Warning setting layer z-order: ${err}`);
        }

        if (immediate) {
            this._actor.opacity = 255;
        } else {
            this._actor.opacity = 0;
            this._actor.ease({
                opacity: 255,
                duration: FADE_IN_DURATION_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    hide(immediate = false) {
        if (!this._actor) return;
        this._actor.remove_all_transitions();

        if (immediate) {
            this._actor.opacity = 0;
            this._actor.visible = false;
        } else {
            const actor = this._actor;
            actor.ease({
                opacity: 0,
                duration: FADE_OUT_DURATION_MS,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    actor.visible = false;
                },
            });
        }
    }

    tick(seconds) {
        if (!this._actor || !this._actor.visible) return;
        this._effect.setTime(seconds);
    }

    destroy() {
        if (this._actor) {
            this._actor.remove_all_transitions();
            if (this._buttonPressId) {
                this._actor.disconnect(this._buttonPressId);
                this._buttonPressId = 0;
            }
            if (this._keyPressId) {
                this._actor.disconnect(this._keyPressId);
                this._keyPressId = 0;
            }
            this._actor.destroy();
            this._actor = null;
        }
        this._effect = null;
        this._glyphAtlas = null;
    }
}

/**
 * Main Screensaver Manager
 */
export class MatrixScreensaverManager {
    constructor(settings, extensionPath) {
        this._settings = settings;
        this._extensionPath = extensionPath;
        this._isActive = false;
        this._isManualTest = false;
        this._manualTestArmSourceId = null;
        this._actors = [];
        this._idleWatchId = 0;
        this._userActiveWatchId = 0;
        this._animTimerId = null;
        this._screenShieldLockedId = 0;

        // Atlas manager for static & procedural sets
        this._atlasManager = new AtlasManager(extensionPath);

        this._rebuildActors();

        // Connect shell signals
        Main.layoutManager.connectObject('monitors-changed', () => this._rebuildActors(), this);
        
        // Lock screen awareness — screenShield is a Signals.EventEmitter,
        // not a GObject, so connectObject() is unavailable. Use plain connect().
        if (Main.screenShield) {
            this._screenShieldLockedId = Main.screenShield.connect('locked-changed',
                () => this._onLockStateChanged());
        }

        // Settings change listeners
        this._settings.connectObject(
            'changed::lead-color', () => this._syncSettings(),
            'changed::trail-color', () => this._syncSettings(),
            'changed::rain-speed', () => this._syncSettings(),
            'changed::font-size', () => this._rebuildActors(),
            'changed::row-spacing', () => this._rebuildActors(),
            'changed::glyph-scale', () => this._syncSettings(),
            'changed::stream-density', () => this._syncSettings(),
            'changed::stream-length', () => this._syncSettings(),
            'changed::glow-enabled', () => this._syncSettings(),
            'changed::soft-blur-enabled', () => this._syncSettings(),
            'changed::aa-sharpness', () => this._syncSettings(),
            'changed::glyph-set', () => this._rebuildActors(),
            'changed::idle-timeout', () => this._armIdleWatch(),
            'changed::screensaver-enabled', () => this._onEnabledChanged(),
            'changed::lockscreen-enabled', () => this._onLockSettingChanged(),
            'changed::test-trigger', () => this._activateScreensaver(true),
            this
        );

        // Pure Event-Driven Idle Watcher (True 0% CPU Idle)
        this._idleMonitor = global.backend.get_core_idle_monitor();
        this._armIdleWatch();
    }

    _armIdleWatch() {
        if (!this._idleMonitor) return;
        if (this._idleWatchId) {
            this._idleMonitor.remove_watch(this._idleWatchId);
            this._idleWatchId = 0;
        }

        if (!this._settings.get_boolean('screensaver-enabled')) return;

        const timeoutSec = this._settings.get_double('idle-timeout') || 60.0;
        const timeoutMs = Math.max(5000, timeoutSec * 1000);

        this._idleWatchId = this._idleMonitor.add_idle_watch(timeoutMs, () => {
            if (this._isActive) return;

            // Inhibit check: Fullscreen window across any connected display
            if (this._settings.get_boolean('inhibit-fullscreen') && this._hasFullscreenWindow()) {
                return;
            }

            this._activateScreensaver(false);
        });
    }

    _isLocked() {
        // ScreenShield stores lock state in the private _isLocked field;
        // there is no public .locked property.
        return Main.screenShield ? (Main.screenShield._isLocked ?? false) : false;
    }

    _hasFullscreenWindow() {
        try {
            const windows = global.display.get_tab_list(Meta.TabList.NORMAL, null);
            return windows.some(w => w.is_fullscreen());
        } catch (error) {
            console.warn(`[matrix-screensaver] Error inspecting fullscreen windows: ${error}`);
            return false;
        }
    }

    _onLockStateChanged() {
        if (!this._settings.get_boolean('lockscreen-enabled')) return;
        if (this._isLocked()) {
            this._activateScreensaver(false, false);
        } else {
            this._deactivateScreensaver();
            this._armIdleWatch();
        }
    }

    _onLockSettingChanged() {
        if (!this._settings.get_boolean('lockscreen-enabled') && this._isLocked() && this._isActive) {
            this._deactivateScreensaver();
        }
    }

    _onEnabledChanged() {
        const enabled = this._settings.get_boolean('screensaver-enabled');
        if (!enabled && this._isActive && !this._isLocked()) {
            this._deactivateScreensaver();
        }
        this._armIdleWatch();
    }

    _startAnimation() {
        if (this._animTimerId) return;
        const startTime = GLib.get_monotonic_time();
        this._animTimerId = GLib.timeout_add(GLib.PRIORITY_LOW, FRAME_INTERVAL_MS, () => {
            if (!this._isActive) {
                this._animTimerId = null;
                return GLib.SOURCE_REMOVE;
            }

            const elapsed = (GLib.get_monotonic_time() - startTime) / 1000000;
            for (const actor of this._actors) {
                actor.tick(elapsed % 4096);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopAnimation() {
        if (this._animTimerId) {
            GLib.Source.remove(this._animTimerId);
            this._animTimerId = null;
        }
    }

    _activateScreensaver(isManualTest = false, immediate = false) {
        if (this._isActive) return;
        this._isActive = true;
        this._isManualTest = isManualTest;

        const locked = this._isLocked();
        for (const actor of this._actors) {
            actor.show(immediate, locked);
        }
        this._startAnimation();

        if (this._userActiveWatchId) {
            this._idleMonitor?.remove_watch(this._userActiveWatchId);
            this._userActiveWatchId = 0;
        }

        if (this._manualTestArmSourceId) {
            GLib.Source.remove(this._manualTestArmSourceId);
            this._manualTestArmSourceId = null;
        }

        if (isManualTest) {
            this._manualTestArmSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._manualTestArmSourceId = null;
                if (this._isActive && this._idleMonitor) {
                    this._userActiveWatchId = this._idleMonitor.add_user_active_watch(() => {
                        this._deactivateScreensaver();
                    });
                }
                return GLib.SOURCE_REMOVE;
            });
        } else {
            if (this._idleMonitor && !locked) {
                this._userActiveWatchId = this._idleMonitor.add_user_active_watch(() => {
                    if (!this._isLocked()) {
                        this._deactivateScreensaver();
                    }
                });
            }
        }
    }

    _deactivateScreensaver(immediate = false) {
        if (!this._isActive) return;
        this._isActive = false;
        this._isManualTest = false;
        this._stopAnimation();

        if (this._manualTestArmSourceId) {
            GLib.Source.remove(this._manualTestArmSourceId);
            this._manualTestArmSourceId = null;
        }

        if (this._userActiveWatchId && this._idleMonitor) {
            this._idleMonitor.remove_watch(this._userActiveWatchId);
            this._userActiveWatchId = 0;
        }

        for (const actor of this._actors) {
            actor.hide(immediate);
        }

        this._armIdleWatch();
    }

    _syncSettings() {
        for (const actor of this._actors) {
            actor.updateSettings(this._settings);
        }
    }

    _rebuildActors() {
        for (const actor of this._actors) {
            actor.destroy();
        }
        this._actors = [];

        const glyphSetId = this._settings.get_string('glyph-set') || 'katakana';
        const glyphAtlas = this._atlasManager.getAtlas(glyphSetId);

        for (const monitor of Main.layoutManager.monitors) {
            this._actors.push(new MonitorScreensaverActor(
                monitor,
                this._settings,
                glyphAtlas,
                () => {
                    if ((!this._isManualTest || !this._manualTestArmSourceId) && !this._isLocked()) {
                        this._deactivateScreensaver();
                    }
                }
            ));
        }

        if (this._isActive) {
            const locked = this._isLocked();
            for (const actor of this._actors) {
                actor.show(true, locked);
            }
            this._startAnimation();
        }
    }

    destroy() {
        this._stopAnimation();
        if (this._manualTestArmSourceId) {
            GLib.Source.remove(this._manualTestArmSourceId);
            this._manualTestArmSourceId = null;
        }
        if (this._userActiveWatchId && this._idleMonitor) {
            this._idleMonitor.remove_watch(this._userActiveWatchId);
            this._userActiveWatchId = 0;
        }
        if (this._idleWatchId && this._idleMonitor) {
            this._idleMonitor.remove_watch(this._idleWatchId);
            this._idleWatchId = 0;
        }

        Main.layoutManager.disconnectObject(this);
        if (Main.screenShield && this._screenShieldLockedId) {
            Main.screenShield.disconnect(this._screenShieldLockedId);
            this._screenShieldLockedId = 0;
        }
        this._settings.disconnectObject(this);

        for (const actor of this._actors) {
            actor.destroy();
        }
        this._actors = [];

        if (this._atlasManager) {
            this._atlasManager.destroy();
            this._atlasManager = null;
        }

        this._settings = null;
    }
}
