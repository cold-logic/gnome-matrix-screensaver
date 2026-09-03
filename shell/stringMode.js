/**
 * Pure logic for string mode glyph generation and shader index computation.
 *
 * Extracted from atlasManager.js and shader.js so it can be unit-tested
 * without a GNOME Shell runtime.
 */

import {
    GLYPH_ATLAS_COLUMNS,
    GLYPH_ATLAS_ROWS,
} from './shader.js';

// Re-export so tests can import constants from this module
export {GLYPH_ATLAS_COLUMNS, GLYPH_ATLAS_ROWS};

/**
 * Default color when stringColors is shorter than strings.
 */
const DEFAULT_COLOR = [1.0, 1.0, 1.0];

/**
 * Generate a 64-entry chars array from vertical strings.
 *
 * Each string occupies one atlas column; character j is at atlas row j.
 * The chars array is row-major: chars[row * 8 + col].
 * Empty cells (beyond string length, or missing strings) use empty text.
 *
 * @param {string[]} strings - Up to 8 strings, each up to 8 characters.
 * @param {number[][]} stringColors - RGB color per string, defaults to white.
 * @returns {Array<{text: string, color: number[]}>} 64 entries in row-major order.
 */
export function generateStringChars(strings, stringColors) {
    const chars = [];
    for (let row = 0; row < GLYPH_ATLAS_ROWS; row++) {
        for (let col = 0; col < GLYPH_ATLAS_COLUMNS; col++) {
            const str = strings[col] || '';
            const ch = str[row] || '';
            const color = stringColors[col] || DEFAULT_COLOR;
            chars.push({text: ch, color});
        }
    }
    return chars;
}

/**
 * Compute the glyph atlas index for string mode.
 *
 * Mirrors the GLSL logic:
 *   string_index = floor(column_seed * 8.0)
 *   string_scroll = floor(animation_time * speed)
 *   char_pos = mod(cell_y - string_scroll, 8.0)
 *   glyph_index = floor(char_pos) * 8.0 + string_index
 *
 * @param {number} columnSeed - Per-column hash in [0, 1).
 * @param {number} cellY - Grid row index (integer-valued float in shader).
 * @param {number} animationTime - Elapsed time * speed multiplier.
 * @param {number} speed - Per-column scroll speed.
 * @returns {number} Integer atlas index in [0, 63].
 */
export function computeGlyphIndexString(columnSeed, cellY, animationTime, speed) {
    const stringIndex = Math.floor(columnSeed * 8.0);
    const stringScroll = Math.floor(animationTime * speed);
    const charPos = ((cellY - stringScroll) % 8 + 8) % 8; // always-positive mod
    const glyphIndex = Math.floor(charPos) * 8 + stringIndex;
    return glyphIndex;
}
