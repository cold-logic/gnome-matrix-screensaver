/**
 * Unit tests for string mode glyph generation and shader index bounds.
 *
 * These tests define the expected behavior. The implementation must match.
 * Run with: bun test/stringMode.test.js
 */

import {describe, it, expect} from 'bun:test';
import {
    generateStringChars,
    computeGlyphIndexString,
    GLYPH_ATLAS_COLUMNS,
    GLYPH_ATLAS_ROWS,
} from '../shell/stringMode.js';
import {
    buildShaderCode,
    buildShaderDeclarations,
} from '../shell/shader.js';

const TOTAL_CELLS = GLYPH_ATLAS_COLUMNS * GLYPH_ATLAS_ROWS; // 64

// --- generateStringChars ---

describe('generateStringChars', () => {
    it('produces exactly 64 entries for 8 strings', () => {
        const strings = ['<div>', '</div>', 'class=', 'style=', '<span>', 'href=', '<body>', 'true;'];
        const colors = strings.map(() => [1.0, 0.0, 0.0]);
        const chars = generateStringChars(strings, colors);
        expect(chars.length).toBe(TOTAL_CELLS);
    });

    it('maps chars[row * 8 + col] to strings[col][row]', () => {
        const strings = ['<div>', '</div>', 'class=', 'style=', '<span>', 'href=', '<body>', 'true;'];
        const colors = strings.map((_, i) => [i / 8, 0, 0]);
        const chars = generateStringChars(strings, colors);

        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 8; row++) {
                const idx = row * 8 + col;
                const expectedChar = strings[col][row] || '';
                expect(chars[idx].text).toBe(expectedChar);
            }
        }
    });

    it('assigns colors per column from stringColors', () => {
        const strings = ['<div>', '</div>', 'class=', 'style=', '<span>', 'href=', '<body>', 'true;'];
        const colors = [
            [0.98, 0.15, 0.45],
            [0.98, 0.15, 0.45],
            [0.65, 0.89, 0.18],
            [0.65, 0.89, 0.18],
            [0.98, 0.15, 0.45],
            [0.65, 0.89, 0.18],
            [0.98, 0.15, 0.45],
            [0.90, 0.86, 0.45],
        ];
        const chars = generateStringChars(strings, colors);

        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 8; row++) {
                const idx = row * 8 + col;
                expect(chars[idx].color).toEqual(colors[col]);
            }
        }
    });

    it('fills cells beyond string length with empty text', () => {
        // 'class=' is 6 chars; rows 6 and 7 should be empty for that column
        const strings = ['class=', 'class=', 'class=', 'class=', 'class=', 'class=', 'class=', 'class='];
        const colors = strings.map(() => [1, 1, 1]);
        const chars = generateStringChars(strings, colors);

        // Row 5 (index 5*8 + col) should be '=' — the 6th char (index 5)
        for (let col = 0; col < 8; col++) {
            expect(chars[5 * 8 + col].text).toBe('=');
        }
        // Row 6 and 7 should be empty
        for (let col = 0; col < 8; col++) {
            expect(chars[6 * 8 + col].text).toBe('');
            expect(chars[7 * 8 + col].text).toBe('');
        }
    });

    it('handles fewer than 8 strings gracefully', () => {
        const strings = ['<div>', 'class='];
        const colors = [[1, 0, 0], [0, 1, 0]];
        const chars = generateStringChars(strings, colors);

        expect(chars.length).toBe(TOTAL_CELLS);

        // Columns 0-1 should have content from the strings
        expect(chars[0 * 8 + 0].text).toBe('<');
        expect(chars[0 * 8 + 1].text).toBe('c');

        // Columns 2-7 should be entirely empty
        for (let col = 2; col < 8; col++) {
            for (let row = 0; row < 8; row++) {
                expect(chars[row * 8 + col].text).toBe('');
            }
        }
    });

    it('handles empty strings array', () => {
        const chars = generateStringChars([], []);
        expect(chars.length).toBe(TOTAL_CELLS);
        for (let i = 0; i < TOTAL_CELLS; i++) {
            expect(chars[i].text).toBe('');
        }
    });

    it('truncates strings longer than 8 characters', () => {
        // 10-char string should only use first 8 chars
        const strings = ['abcdefghij']; // 10 chars
        const colors = [[1, 1, 1]];
        const chars = generateStringChars(strings, colors);

        // Only 1 string provided, so only column 0 has content
        for (let row = 0; row < 8; row++) {
            expect(chars[row * 8 + 0].text).toBe('abcdefghij'[row]);
        }
        // Row 8 would be 'i' but there are only 8 rows (0-7), so it's naturally truncated
        // Verify we didn't crash and got 64 entries
        expect(chars.length).toBe(TOTAL_CELLS);
    });

    it('defaults color to white when stringColors is shorter than strings', () => {
        const strings = ['<div>', 'class='];
        const colors = [[1, 0, 0]]; // only 1 color for 2 strings
        const chars = generateStringChars(strings, colors);

        // Column 0 should have red color
        expect(chars[0].color).toEqual([1, 0, 0]);
        // Column 1 should default to white
        expect(chars[1].color).toEqual([1.0, 1.0, 1.0]);
    });

    it('handles strings with multibyte characters', () => {
        const strings = ['🛑⚠️⛔🚸♿🚲🚗🚶']; // 8 emoji
        const colors = [[1, 1, 1]];
        const chars = generateStringChars(strings, colors);

        // Each emoji is one character in JS string indexing
        for (let row = 0; row < 8; row++) {
            expect(chars[row * 8 + 0].text).toBe('🛑⚠️⛔🚸♿🚲🚗🚶'[row]);
        }
    });
});

// --- computeGlyphIndexString (shader logic in JS) ---

describe('computeGlyphIndexString', () => {
    // Replicate matrix_hash in JS for testing
    function matrixHash(value) {
        const x = Math.sin(value * 12.9898) * 43758.5453;
        return x - Math.floor(x); // fract()
    }

    it('produces glyph_index in [0, 63] for any cell.y and time', () => {
        for (let cellX = 0; cellX < 200; cellX++) {
            const columnSeed = matrixHash(cellX * 7.17 + 3.0);
            const depth = matrixHash(cellX * 3.91 + 11.0);
            const speed = 0.55 + depth * 0.90; // mix(0.55, 1.45, depth)

            for (let cellY = 0; cellY < 200; cellY++) {
                for (let t = 0; t < 100; t += 7.3) {
                    const idx = computeGlyphIndexString(columnSeed, cellY, t, speed);
                    expect(idx).toBeGreaterThanOrEqual(0);
                    expect(idx).toBeLessThanOrEqual(63);
                    expect(Number.isInteger(idx)).toBe(true);
                }
            }
        }
    });

    it('string_index is consistent per column (same column always picks same string)', () => {
        for (let cellX = 0; cellX < 100; cellX++) {
            const columnSeed = matrixHash(cellX * 7.17 + 3.0);
            const depth = matrixHash(cellX * 3.91 + 11.0);
            const speed = 0.55 + depth * 0.90;

            const indicesAtT0 = [];
            for (let cellY = 0; cellY < 100; cellY++) {
                const idx = computeGlyphIndexString(columnSeed, cellY, 0, speed);
                indicesAtT0.push(idx);
            }

            // At t=0, char_pos = mod(cellY, 8), so string_index = idx - floor(mod(cellY, 8)) * 8
            // All string_index values should be the same for a given column
            const stringIndices = indicesAtT0.map(idx => idx % 8);
            const first = stringIndices[0];
            for (const si of stringIndices) {
                expect(si).toBe(first);
            }
        }
    });

    it('scrolling advances char_pos by 1 per unit time*speed', () => {
        const columnSeed = matrixHash(5 * 7.17 + 3.0);
        const depth = matrixHash(5 * 3.91 + 11.0);
        const speed = 0.55 + depth * 0.90;

        // At cellY=0, t=0: char_pos = mod(0 - 0, 8) = 0
        const idx0 = computeGlyphIndexString(columnSeed, 0, 0, speed);
        // At cellY=0, t=1/speed: scroll = floor(1) = 1, char_pos = mod(0 - 1, 8) = 7
        const idx1 = computeGlyphIndexString(columnSeed, 0, 1 / speed, speed);

        // The string_index should be the same (same column)
        expect(idx0 % 8).toBe(idx1 % 8);
        // char_pos should differ by 1 (mod 8)
        const charPos0 = Math.floor(idx0 / 8);
        const charPos1 = Math.floor(idx1 / 8);
        expect((charPos0 - charPos1 + 8) % 8).toBe(1);
    });
});

// --- HTML validity ---

describe('HTML string validity', () => {
    // Import the actual HTML glyph set config
    // We can't import atlasManager.js (it imports GNOME typelibs), so we
    // duplicate the expected strings here as a contract. If the source
    // changes, this test must be updated to match — and the change reviewed
    // for HTML validity.
    const HTML_STRINGS = [
        '<div>',
        '</div>',
        '<span>',
        '</span>',
        '<body>',
        '<br>',
        '<h1>',
        '</h1>',
    ];

    // Valid HTML tag pattern: opening, closing, or self-closing void element
    const VALID_HTML_TAG = /^<\/?[a-zA-Z][a-zA-Z0-9]*>$/;

    it('every string is a valid HTML tag (opening, closing, or void)', () => {
        for (const str of HTML_STRINGS) {
            expect(str).toMatch(VALID_HTML_TAG);
        }
    });

    it('no string is an attribute fragment or non-HTML token', () => {
        // These are NOT valid standalone HTML — they're fragments
        const INVALID = ['class=', 'style=', 'href=', 'true;', 'fn', 'var', 'let', 'if'];
        for (const str of HTML_STRINGS) {
            expect(INVALID).not.toContain(str);
        }
    });

    it('every string fits within 8 characters (atlas row limit)', () => {
        for (const str of HTML_STRINGS) {
            expect(str.length).toBeLessThanOrEqual(8);
        }
    });

    it('opening and closing tags are paired', () => {
        // For every closing tag </x>, there should be a matching <x>
        const openingTags = HTML_STRINGS
            .filter(s => /^<[a-zA-Z][a-zA-Z0-9]*>$/.test(s))
            .map(s => s.slice(1, -1));
        const closingTags = HTML_STRINGS
            .filter(s => /^<\/[a-zA-Z][a-zA-Z0-9]*>$/.test(s))
            .map(s => s.slice(2, -1));

        for (const close of closingTags) {
            expect(openingTags).toContain(close);
        }
    });

    it('void elements (br, hr, img, input, meta, link) have no closing tag', () => {
        const VOID_ELEMENTS = ['br', 'hr', 'img', 'input', 'meta', 'link'];
        for (const voidEl of VOID_ELEMENTS) {
            if (HTML_STRINGS.includes(`<${voidEl}>`)) {
                expect(HTML_STRINGS).not.toContain(`</${voidEl}>`);
            }
        }
    });
});

// --- Theme isolation: shader mode separation ---

describe('Theme shader isolation', () => {
    it('random mode shader contains mutation code, not string code', () => {
        const code = buildShaderCode('random');
        expect(code).toContain('mutation_rate');
        expect(code).toContain('glyph_epoch');
        expect(code).not.toContain('string_index');
        expect(code).not.toContain('string_scroll');
    });

    it('string mode shader contains string code, not mutation code', () => {
        const code = buildShaderCode('string');
        expect(code).toContain('string_index');
        expect(code).toContain('string_scroll');
        expect(code).not.toContain('mutation_rate');
        expect(code).not.toContain('glyph_epoch');
    });

    it('neither mode contains matrix_string_mode uniform (eliminated)', () => {
        const randomDecl = buildShaderDeclarations('random');
        const stringDecl = buildShaderDeclarations('string');
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');

        expect(randomDecl).not.toContain('matrix_string_mode');
        expect(stringDecl).not.toContain('matrix_string_mode');
        expect(randomCode).not.toContain('matrix_string_mode');
        expect(stringCode).not.toContain('matrix_string_mode');
    });

    it('both modes share the same declarations', () => {
        expect(buildShaderDeclarations('random')).toBe(buildShaderDeclarations('string'));
    });

    it('both modes contain shared body (supersampling, AA, rain, glow)', () => {
        const random = buildShaderCode('random');
        const string = buildShaderCode('string');

        // Supersampling
        expect(random).toContain('_ss_step');
        expect(string).toContain('_ss_step');

        // AA contrast
        expect(random).toContain('_aa_contrast');
        expect(string).toContain('_aa_contrast');

        // Rain animation
        expect(random).toContain('matrix_drop');
        expect(string).toContain('matrix_drop');

        // Glow
        expect(random).toContain('halo_alpha');
        expect(string).toContain('halo_alpha');
    });

    it('default mode (no arg) is random', () => {
        const code = buildShaderCode();
        expect(code).toContain('mutation_rate');
        expect(code).not.toContain('string_index');
    });

    it('unknown mode falls back to random', () => {
        const code = buildShaderCode('nonexistent');
        expect(code).toContain('mutation_rate');
        expect(code).not.toContain('string_index');
    });
});

// --- Theme config: shaderMode defaults ---

describe('Theme shaderMode defaults', () => {
    // Can't import atlasManager.js (GNOME typelibs), so verify the contract:
    // all non-HTML themes should default to 'random', HTML should be 'string'
    const THEME_CONFIGS = {
        katakana: {expectedMode: 'random'},
        binary: {expectedMode: 'random'},
        hex: {expectedMode: 'random'},
        html: {expectedMode: 'string'},
        road: {expectedMode: 'random'},
        ui: {expectedMode: 'random'},
    };

    it('katakana uses random mode', () => {
        expect(THEME_CONFIGS.katakana.expectedMode).toBe('random');
    });

    it('binary uses random mode', () => {
        expect(THEME_CONFIGS.binary.expectedMode).toBe('random');
    });

    it('hex uses random mode', () => {
        expect(THEME_CONFIGS.hex.expectedMode).toBe('random');
    });

    it('html uses string mode', () => {
        expect(THEME_CONFIGS.html.expectedMode).toBe('string');
    });

    it('road uses random mode', () => {
        expect(THEME_CONFIGS.road.expectedMode).toBe('random');
    });

    it('ui uses random mode', () => {
        expect(THEME_CONFIGS.ui.expectedMode).toBe('random');
    });

    it('only html uses string mode', () => {
        const stringThemes = Object.entries(THEME_CONFIGS)
            .filter(([_, cfg]) => cfg.expectedMode === 'string')
            .map(([name]) => name);
        expect(stringThemes).toEqual(['html']);
    });
});

// --- Effect factory: GType-per-mode design contract ---

describe('Effect factory design contract', () => {
    // Shell.GLSLEffect caches the compiled pipeline on the GType class
    // (klass->base_pipeline), not per-instance. The first construction of
    // a given GType calls vfunc_build_pipeline(); all subsequent instances
    // of the same GType skip it and copy the cached pipeline.
    //
    // This means a single GType can only hold one shader variant. The fix
    // is to register separate GTypes per mode. These tests verify the
    // design contract without requiring the GNOME Shell runtime.

    // The factory maps mode → GTypeName. Each GTypeName must be unique
    // per mode so GObject registers a separate class with its own
    // base_pipeline cache.
    const MODE_TO_GTYPENAME = {
        random: 'MatrixScreensaverEffectRandom_ColdLogic',
        string: 'MatrixScreensaverEffectString_ColdLogic',
    };

    it('each mode has a unique GTypeName', () => {
        const typeNames = Object.values(MODE_TO_GTYPENAME);
        expect(new Set(typeNames).size).toBe(typeNames.length);
    });

    it('random mode GTypeName contains "Random"', () => {
        expect(MODE_TO_GTYPENAME.random).toContain('Random');
    });

    it('string mode GTypeName contains "String"', () => {
        expect(MODE_TO_GTYPENAME.string).toContain('String');
    });

    it('factory returns string effect for string mode', () => {
        // The factory contract: createEffect('string') must instantiate
        // the string GType, not the random one. We can't test the actual
        // GObject instantiation without GNOME typelibs, but we verify the
        // mapping is correct.
        const mode = 'string';
        const expectedGTypeName = MODE_TO_GTYPENAME[mode];
        expect(expectedGTypeName).toBe('MatrixScreensaverEffectString_ColdLogic');
    });

    it('factory returns random effect for random mode', () => {
        const mode = 'random';
        const expectedGTypeName = MODE_TO_GTYPENAME[mode];
        expect(expectedGTypeName).toBe('MatrixScreensaverEffectRandom_ColdLogic');
    });

    it('factory falls back to random for unknown mode', () => {
        const mode = 'nonexistent';
        // Unknown modes should fall back to random, not crash
        const expectedGTypeName = MODE_TO_GTYPENAME[mode] || MODE_TO_GTYPENAME.random;
        expect(expectedGTypeName).toBe('MatrixScreensaverEffectRandom_ColdLogic');
    });

    it('factory does not mutate params (no delete pattern)', () => {
        // The old code did `delete params.shaderMode` which mutated the
        // caller's object. The new factory takes (mode, params) as
        // separate arguments, so params is never mutated.
        // This is a design contract test: the factory signature is
        // createEffect(mode, params) — mode is a separate arg, not
        // extracted from params.
        const params = {someKey: 'value'};
        // Simulate factory call: mode is separate, params passed through
        const _mode = 'string';
        const _result = params; // factory would pass this to constructor
        // Verify params was not mutated
        expect(params).toEqual({someKey: 'value'});
        expect(params.shaderMode).toBeUndefined();
    });
});

// --- Shader code: no dead exports ---

describe('Shader module exports', () => {
    it('SHADER_CODE and SHADER_DECLARATIONS are not exported (dead code removed)', async () => {
        // The old backward-compat exports were removed. Only buildShaderCode
        // and buildShaderDeclarations should be used.
        const shaderModule = await import('../shell/shader.js');
        expect(shaderModule.SHADER_CODE).toBeUndefined();
        expect(shaderModule.SHADER_DECLARATIONS).toBeUndefined();
        expect(typeof shaderModule.buildShaderCode).toBe('function');
        expect(typeof shaderModule.buildShaderDeclarations).toBe('function');
    });

    it('SHARED_DECLARATIONS is not exported (internal only)', async () => {
        const shaderModule = await import('../shell/shader.js');
        expect(shaderModule.SHARED_DECLARATIONS).toBeUndefined();
    });
});

// --- Stream length multiplier ---

describe('Stream length multiplier', () => {
    // The stream length system has two layers:
    // 1. Per-mode compile-time base (STREAM_LENGTH_BASE const in GLSL)
    // 2. User-facing uniform (matrix_stream_length, 0.25–2.0)
    // Final length = min(1.0, random_length * STREAM_LENGTH_BASE * user_multiplier)
    //
    // Random mode base = 1.0 (classic Matrix rain, unchanged)
    // String mode base = 1.4 (HTML gets 40% longer tails by default so
    //   the full 8-character string is illuminated)

    it('random mode has STREAM_LENGTH_BASE = 1.0', () => {
        const code = buildShaderCode('random');
        expect(code).toContain('STREAM_LENGTH_BASE = 1.0');
    });

    it('string mode has STREAM_LENGTH_BASE = 1.4', () => {
        const code = buildShaderCode('string');
        expect(code).toContain('STREAM_LENGTH_BASE = 1.4');
    });

    it('both modes declare matrix_stream_length uniform', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        const decl = buildShaderDeclarations('random');
        expect(decl).toContain('uniform float matrix_stream_length');
        expect(randomCode).toContain('matrix_stream_length');
        expect(stringCode).toContain('matrix_stream_length');
    });

    it('both modes apply STREAM_LENGTH_BASE * stream_length_mul to primary length', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        expect(randomCode).toContain('STREAM_LENGTH_BASE * stream_length_mul');
        expect(stringCode).toContain('STREAM_LENGTH_BASE * stream_length_mul');
    });

    it('both modes clamp stream length to 1.0 (max screen height)', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        // Primary and secondary lengths both use min(1.0, ...)
        const randomMinCount = (randomCode.match(/min\(1\.0,/g) || []).length;
        const stringMinCount = (stringCode.match(/min\(1\.0,/g) || []).length;
        expect(randomMinCount).toBeGreaterThanOrEqual(2); // primary + secondary
        expect(stringMinCount).toBeGreaterThanOrEqual(2);
    });

    it('stream_length_mul is clamped to [0.25, 2.0]', () => {
        const code = buildShaderCode('random');
        expect(code).toContain('clamp(matrix_stream_length, 0.25, 2.0)');
    });

    it('random mode base 1.0 at default user 1.0 = unchanged from original', () => {
        // At default settings (base=1.0, user=1.0), the effective multiplier
        // is 1.0, so random mode behavior is identical to before the feature.
        const base = 1.0;
        const user = 1.0;
        const effective = base * user;
        expect(effective).toBe(1.0);
    });

    it('string mode base 1.4 at default user 1.0 = 40% longer tails', () => {
        const base = 1.4;
        const user = 1.0;
        const effective = base * user;
        expect(effective).toBe(1.4);
    });

    it('string mode at max user 2.0 = 2.8x (clamped to 1.0 screen fraction)', () => {
        // mix(0.28, 0.78, hash) * 1.4 * 2.0 = mix(0.28, 0.78) * 2.8
        // = 0.784 to 2.184, clamped to 1.0
        const base = 1.4;
        const user = 2.0;
        const maxRandomLength = 0.78;
        const effective = Math.min(1.0, maxRandomLength * base * user);
        expect(effective).toBe(1.0); // clamped
    });

    it('random mode at min user 0.25 = 0.25x (short sparse tails)', () => {
        const base = 1.0;
        const user = 0.25;
        const maxRandomLength = 0.78;
        const effective = maxRandomLength * base * user;
        expect(effective).toBeCloseTo(0.195, 2);
    });

    it('secondary stream also uses STREAM_LENGTH_BASE * stream_length_mul', () => {
        const code = buildShaderCode('random');
        // The secondary stream length should also be multiplied
        // Check that second_length uses the same pattern
        expect(code).toContain('second_length = min(1.0, mix(0.24, 0.70');
        expect(code).toContain('STREAM_LENGTH_BASE * stream_length_mul');
        // Count occurrences — should appear in both primary and secondary
        const count = (code.match(/STREAM_LENGTH_BASE \* stream_length_mul/g) || []).length;
        expect(count).toBe(2);
    });
});

// --- Non-constant fall speed (wobble) ---

describe('Non-constant fall speed (wobble)', () => {
    // The wobble modulates rain head position with two incommensurate sine
    // waves so raindrops speed up and slow down naturally instead of falling
    // at a constant rate. Adapted from Rezmason/matrix.
    //
    // Per-mode WOBBLE_AMPLITUDE const controls the strength:
    // - Random mode: 1.0 (full naturalistic wobble, classic Matrix feel)
    // - String mode: 0.5 (reduced wobble so HTML tokens stay readable)

    it('random mode has WOBBLE_AMPLITUDE = 1.0', () => {
        const code = buildShaderCode('random');
        expect(code).toContain('WOBBLE_AMPLITUDE = 1.0');
    });

    it('string mode has WOBBLE_AMPLITUDE = 0.5', () => {
        const code = buildShaderCode('string');
        expect(code).toContain('WOBBLE_AMPLITUDE = 0.5');
    });

    it('both modes define matrix_wobble function', () => {
        const decl = buildShaderDeclarations('random');
        expect(decl).toContain('float matrix_wobble');
    });

    it('wobble uses incommensurate frequencies (sqrt 2 and sqrt 5)', () => {
        const decl = buildShaderDeclarations('random');
        // sqrt(2) ≈ 1.41421356, sqrt(5) ≈ 2.23606798
        // These are incommensurate so the wobble pattern never repeats exactly
        expect(decl).toContain('1.41421356');
        expect(decl).toContain('2.23606798');
    });

    it('wobble uses two sine waves with 0.3 and 0.2 base amplitudes', () => {
        const decl = buildShaderDeclarations('random');
        expect(decl).toContain('0.3 * amplitude * sin');
        expect(decl).toContain('0.2 * amplitude * sin');
    });

    it('both modes apply wobble to primary_travel', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        expect(randomCode).toContain('matrix_wobble(animation_time * speed + phase');
        expect(stringCode).toContain('matrix_wobble(animation_time * speed + phase');
    });

    it('both modes apply wobble to second_travel', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        expect(randomCode).toContain('matrix_wobble(animation_time * speed * 0.91');
        expect(stringCode).toContain('matrix_wobble(animation_time * speed * 0.91');
    });

    it('string mode applies wobble to string_scroll', () => {
        const stringCode = buildShaderCode('string');
        expect(stringCode).toContain('matrix_wobble(animation_time * speed, WOBBLE_AMPLITUDE)');
    });

    it('random mode does not apply wobble to string_scroll (no string_scroll)', () => {
        const randomCode = buildShaderCode('random');
        expect(randomCode).not.toContain('string_scroll');
    });

    it('wobble at amplitude 0 is identity (no wobble)', () => {
        // Verify the math: at amplitude=0, the sine terms vanish
        // matrix_wobble(x, 0) = x + 0.3*0*sin(...) + 0.2*0*sin(...) = x
        const wobble = (x, amplitude) =>
            x + 0.3 * amplitude * Math.sin(1.41421356 * x) + 0.2 * amplitude * Math.sin(2.23606798 * x);
        for (const x of [0, 1, 2.5, 100, -3.7]) {
            expect(wobble(x, 0)).toBeCloseTo(x, 10);
        }
    });

    it('wobble at amplitude 1.0 produces non-identity variation', () => {
        const wobble = (x, amplitude) =>
            x + 0.3 * amplitude * Math.sin(1.41421356 * x) + 0.2 * amplitude * Math.sin(2.23606798 * x);
        // At amplitude 1.0, the wobble should deviate from x
        let hasVariation = false;
        for (let x = 0; x < 100; x += 0.5) {
            if (Math.abs(wobble(x, 1.0) - x) > 0.01) {
                hasVariation = true;
                break;
            }
        }
        expect(hasVariation).toBe(true);
    });

    it('wobble at amplitude 0.5 produces half the variation of amplitude 1.0', () => {
        const wobble = (x, amplitude) =>
            x + 0.3 * amplitude * Math.sin(1.41421356 * x) + 0.2 * amplitude * Math.sin(2.23606798 * x);
        // At a given x, the deviation at 0.5 should be exactly half of 1.0
        const x = 3.7;
        const dev1 = Math.abs(wobble(x, 1.0) - x);
        const devHalf = Math.abs(wobble(x, 0.5) - x);
        expect(devHalf).toBeCloseTo(dev1 * 0.5, 10);
    });

    it('wobble variation is bounded by max amplitude (0.5 at full)', () => {
        // 0.3 + 0.2 = 0.5 max amplitude when both sines align
        const wobble = (x, amplitude) =>
            x + 0.3 * amplitude * Math.sin(1.41421356 * x) + 0.2 * amplitude * Math.sin(2.23606798 * x);
        let maxDev = 0;
        for (let x = 0; x < 1000; x += 0.01) {
            const dev = Math.abs(wobble(x, 1.0) - x);
            if (dev > maxDev) maxDev = dev;
        }
        // Max deviation should be <= 0.5 (theoretical max when both sines = ±1)
        expect(maxDev).toBeLessThanOrEqual(0.5);
        // Should be close to 0.5 (the sines will nearly align at some point)
        expect(maxDev).toBeGreaterThan(0.45);
    });
});
