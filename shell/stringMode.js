/**
 * Pure logic for string mode glyph generation.
 *
 * Extracted from atlasManager.js so it can be unit-tested
 * without a GNOME Shell runtime.
 */

import {
    GLYPH_ATLAS_COLUMNS,
    GLYPH_ATLAS_ROWS,
} from './shader.js';

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