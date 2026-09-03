/**
 * Unit tests for string mode glyph generation and shader code structure.
 *
 * These tests define the expected behavior. The implementation must match.
 * Run with: bun test/stringMode.test.js
 */

import {describe, it, expect} from 'bun:test';
import {
    generateStringChars,
    HTML_STRINGS,
    HTML_STRING_COLORS,
} from '../shell/stringMode.js';
import {
    buildShaderCode,
    buildShaderDeclarations,
    GLYPH_ATLAS_COLUMNS,
    GLYPH_ATLAS_ROWS,
} from '../shell/shader.js';

const TOTAL_CELLS = GLYPH_ATLAS_COLUMNS * GLYPH_ATLAS_ROWS; // 64

// --- generateStringChars ---

describe('generateStringChars', () => {
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

    it('defaults color to white when stringColors is shorter than strings', () => {
        const strings = ['<div>', 'class='];
        const colors = [[1, 0, 0]]; // only 1 color for 2 strings
        const chars = generateStringChars(strings, colors);

        // Column 0 should have red color
        expect(chars[0].color).toEqual([1, 0, 0]);
        // Column 1 should default to white
        expect(chars[1].color).toEqual([1.0, 1.0, 1.0]);
    });
});

// --- HTML validity ---

describe('HTML string validity', () => {
    // HTML_STRINGS is imported from stringMode.js (single source of truth).
    // atlasManager.js also imports from stringMode.js, so tests and production
    // code share the same data — no duplication drift risk.

    // Valid HTML tag pattern: opening, closing, or self-closing void element
    const VALID_HTML_TAG = /^<\/?[a-zA-Z][a-zA-Z0-9]*>$/;

    it('every string is a valid HTML tag (opening, closing, or void)', () => {
        for (const str of HTML_STRINGS) {
            expect(str).toMatch(VALID_HTML_TAG);
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

    it('void elements in the set have no closing tag', () => {
        // For every opening tag <x> that is a void element, verify no </x> exists.
        // This is only meaningful for elements actually present in HTML_STRINGS.
        const VOID_ELEMENTS = ['br', 'hr', 'img', 'input', 'meta', 'link'];
        const presentVoidElements = VOID_ELEMENTS.filter(el =>
            HTML_STRINGS.includes(`<${el}>`));
        expect(presentVoidElements.length).toBeGreaterThan(0); // at least one void element
        for (const voidEl of presentVoidElements) {
            expect(HTML_STRINGS).not.toContain(`</${voidEl}>`);
        }
    });

    it('HTML_STRING_COLORS aligns with HTML_STRINGS', () => {
        expect(HTML_STRING_COLORS.length).toBe(HTML_STRINGS.length);
        for (const color of HTML_STRING_COLORS) {
            expect(color).toHaveLength(3);
            for (const channel of color) {
                expect(channel).toBeGreaterThanOrEqual(0.0);
                expect(channel).toBeLessThanOrEqual(1.0);
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
        const stringCode = buildShaderCode('string');
        const decl = buildShaderDeclarations();
        expect(decl).toContain('uniform float matrix_stream_length');
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
        const decl = buildShaderDeclarations();
        expect(decl).toContain('float matrix_wobble');
    });

    it('wobble uses incommensurate frequencies (sqrt 2 and sqrt 5)', () => {
        const decl = buildShaderDeclarations();
        // sqrt(2) ≈ 1.41421356, sqrt(5) ≈ 2.23606798
        // These are incommensurate so the wobble pattern never repeats exactly
        expect(decl).toContain('1.41421356');
        expect(decl).toContain('2.23606798');
    });

    it('wobble uses two sine waves with 0.3 and 0.2 base amplitudes', () => {
        const decl = buildShaderDeclarations();
        expect(decl).toContain('0.3 * amplitude * sin');
        expect(decl).toContain('0.2 * amplitude * sin');
    });

    it('both modes apply wobble to primary_travel', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        // Random mode inlines the travel expression
        expect(randomCode).toContain('matrix_wobble(animation_time * speed + phase');
        // String mode uses base_travel variable (for scroll sync) but still wobbles
        expect(stringCode).toContain('primary_travel = matrix_wobble(base_travel');
    });

    it('both modes apply wobble to second_travel', () => {
        const randomCode = buildShaderCode('random');
        const stringCode = buildShaderCode('string');
        expect(randomCode).toContain('matrix_wobble(animation_time * speed * 0.91');
        expect(stringCode).toContain('matrix_wobble(animation_time * speed * 0.91');
    });

    it('string mode does NOT apply wobble to string_scroll', () => {
        const stringCode = buildShaderCode('string');
        // string_scroll uses unwobbled base_travel to prevent character jumping.
        // The wobble on the rain head provides naturalistic speed; the string
        // scroll stays smooth.
        expect(stringCode).toContain('string_scroll = mod(base_travel');
        expect(stringCode).not.toContain('matrix_wobble(animation_time * speed, WOBBLE_AMPLITUDE)');
    });
});

// --- String mode: scroll sync and variety ---

describe('String mode scroll sync', () => {
    it('string_scroll uses base_travel (synced to rain head)', () => {
        const stringCode = buildShaderCode('string');
        // base_travel is the unwobbled travel, shared between rain head and string scroll
        expect(stringCode).toContain('float base_travel = animation_time * speed + phase');
        expect(stringCode).toContain('string_scroll = mod(base_travel, period)');
    });

    it('string_index changes per rain cycle (not fixed per column)', () => {
        const stringCode = buildShaderCode('string');
        // string_index uses primary_cycle so each column shows different strings
        // over time, instead of being locked to one string forever
        expect(stringCode).toContain('string_index = floor(matrix_hash(');
        expect(stringCode).toContain('primary_cycle');
        // Must NOT use the old fixed-per-column pattern
        expect(stringCode).not.toContain('string_index = floor(column_seed * 8.0)');
    });

    it('string mode rain head and string scroll share base_travel', () => {
        const stringCode = buildShaderCode('string');
        // Both primary_travel and string_scroll derive from base_travel
        const baseTravelCount = (stringCode.match(/base_travel/g) || []).length;
        expect(baseTravelCount).toBeGreaterThanOrEqual(3); // definition + wobble + scroll
    });

    it('random mode does not contain base_travel', () => {
        const randomCode = buildShaderCode('random');
        // base_travel is string-mode-only (for scroll sync)
        expect(randomCode).not.toContain('base_travel');
    });
});
