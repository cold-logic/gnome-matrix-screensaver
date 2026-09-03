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
 * HTML strings for the HTML theme.
 * Each string is a valid HTML tag (opening, closing, or void).
 * Rendered vertically: one string per atlas column, one char per atlas row.
 *
 * Single source of truth — imported by both atlasManager.js (production)
 * and test/stringMode.test.js (verification).
 */
export const HTML_STRINGS = [
    '<div>',   // 0: Coral — block container
    '</div>',  // 1: Coral — closing block
    '<span>',  // 2: Amber — inline container
    '</span>',  // 3: Amber — closing inline
    '<body>',  // 4: Coral — structural
    '<br>',    // 5: Emerald — void element (self-closing)
    '<h1>',    // 6: Sky Blue — heading
    '</h1>',   // 7: Sky Blue — closing heading
];

/**
 * Per-string RGB colors for HTML syntax highlighting.
 * Indices align with HTML_STRINGS.
 */
export const HTML_STRING_COLORS = [
    [0.98, 0.15, 0.45],  // 0: Coral
    [0.98, 0.15, 0.45],  // 1: Coral
    [0.90, 0.86, 0.45],  // 2: Amber
    [0.90, 0.86, 0.45],  // 3: Amber
    [0.98, 0.15, 0.45],  // 4: Coral
    [0.65, 0.89, 0.18],  // 5: Emerald
    [0.33, 0.66, 0.95],  // 6: Sky Blue
    [0.33, 0.66, 0.95],  // 7: Sky Blue
];

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