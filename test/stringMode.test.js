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
