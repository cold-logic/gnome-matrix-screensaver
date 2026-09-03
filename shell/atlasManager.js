import Cairo from 'cairo';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import St from 'gi://St';

import {
    GLYPH_ATLAS_COLUMNS,
    GLYPH_ATLAS_ROWS,
    GLYPH_ATLAS_SIZE,
} from './shader.js';

export const GLYPH_SETS = {
    katakana: {
        id: 'katakana',
        title: 'Classic Katakana',
        count: 57,
        staticAsset: 'matrixcode_mask_rgb.png',
    },
    binary: {
        id: 'binary',
        title: 'Binary Stream',
        count: 2,
        chars: ['0', '1'],
    },
    hex: {
        id: 'hex',
        title: 'Hexadecimal Dump',
        count: 16,
        chars: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'],
    },
    html: {
        id: 'html',
        title: 'HTML & Web Rain',
        count: 64,
        stringMode: true,
        font: 'Monospace, monospace, DejaVu Sans Mono Bold 44',
        // Each string is rendered vertically in one atlas column (up to 8 chars).
        // The shader picks one string per screen column and scrolls through its
        // characters, so each rain stream displays a recognizable HTML token.
        strings: [
            '<div>',   // 0: Coral — HTML tag
            '</div>',  // 1: Coral — closing tag
            'class=',  // 2: Emerald — attribute
            'style=',  // 3: Emerald — attribute
            '<span>',  // 4: Coral — HTML tag
            'href=',   // 5: Emerald — attribute
            '<body>',  // 6: Coral — HTML tag
            'true;',   // 7: Amber — JS literal
        ],
        stringColors: [
            [0.98, 0.15, 0.45],  // 0: Coral
            [0.98, 0.15, 0.45],  // 1: Coral
            [0.65, 0.89, 0.18],  // 2: Emerald
            [0.65, 0.89, 0.18],  // 3: Emerald
            [0.98, 0.15, 0.45],  // 4: Coral
            [0.65, 0.89, 0.18],  // 5: Emerald
            [0.98, 0.15, 0.45],  // 6: Coral
            [0.90, 0.86, 0.45],  // 7: Amber
        ],
    },
    road: {
        id: 'road',
        title: 'Road & Public Signs',
        count: 24,
        font: 'Noto Color Emoji, DejaVu Sans, Symbola, Sans Bold 38',
        chars: [
            '🛑', '⚠️', '⛔', '🚸', '♿', '🚲', '🚗', '🚶',
            '⛽', '🚧', '🚦', '🚨', '🅿️', '🚏', '⬆️', '⬇️',
            '⬅️', '➡️', '🔄', '✈️', '🛳️', '🚂', '🚭', '🚻',
        ],
    },
    ui: {
        id: 'ui',
        title: 'Digital UI Icons',
        count: 24,
        font: 'Noto Color Emoji, DejaVu Sans, Symbola, Sans Bold 38',
        chars: [
            '⚙️', '🔍', '💾', '💻', '📱', '🔔', '🔋', '📶',
            '🔒', '🔓', '⚡', '🗑️', '📁', '📂', '✂️', '📌',
            '✉️', '🌐', '🔊', '🔇', '📷', '⏱️', '⭐', '🏷️',
        ],
    },
};

export class AtlasManager {
    constructor(extensionPath) {
        this._extensionPath = extensionPath;
        this._cache = new Map();
    }

    getAtlas(glyphSetId = 'katakana') {
        const config = GLYPH_SETS[glyphSetId] || GLYPH_SETS.katakana;
        if (this._cache.has(config.id)) {
            return {
                content: this._cache.get(config.id),
                count: config.count,
                stringMode: config.stringMode || false,
            };
        }

        const coglContext = global.stage.context.get_backend().get_cogl_context();
        let content;

        if (config.staticAsset) {
            // Load pre-rendered movie Katakana mask
            const atlasPath = GLib.build_filenamev([this._extensionPath, 'assets', config.staticAsset]);
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file(atlasPath);
            content = St.ImageContent.new_with_preferred_size(GLYPH_ATLAS_SIZE, GLYPH_ATLAS_SIZE);
            content.set_bytes(
                coglContext,
                pixbuf.read_pixel_bytes(),
                pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
                pixbuf.get_width(),
                pixbuf.get_height(),
                pixbuf.get_rowstride()
            );
        } else if (config.stringMode) {
            // String mode: render each string vertically in one atlas column
            const chars = this._generateStringChars(config.strings, config.stringColors);
            content = this._renderProceduralAtlas(coglContext, chars, config.font);
        } else {
            // Procedurally render vector typography into atlas texture via Cairo & Pango
            content = this._renderProceduralAtlas(coglContext, config.chars, config.font);
        }

        this._cache.set(config.id, content);
        return {
            content,
            count: config.count,
            stringMode: config.stringMode || false,
        };
    }

    /**
     * Generate a 64-entry chars array from vertical strings.
     * Each string occupies one atlas column; character j is at atlas row j.
     * The chars array is row-major: chars[row * 8 + col].
     * Empty cells (beyond string length) use empty text (transparent).
     */
    _generateStringChars(strings, stringColors) {
        const chars = [];
        for (let row = 0; row < GLYPH_ATLAS_ROWS; row++) {
            for (let col = 0; col < GLYPH_ATLAS_COLUMNS; col++) {
                const str = strings[col] || '';
                const ch = str[row];
                if (ch) {
                    chars.push({text: ch, color: stringColors[col] || [1.0, 1.0, 1.0]});
                } else {
                    chars.push({text: '', color: [0, 0, 0]});
                }
            }
        }
        return chars;
    }

    _renderProceduralAtlas(coglContext, chars, font = 'Monospace, monospace, DejaVu Sans Mono Bold 44') {
        const size = GLYPH_ATLAS_SIZE;
        const cellWidth = size / GLYPH_ATLAS_COLUMNS;
        const cellHeight = size / GLYPH_ATLAS_ROWS;

        const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
        const cr = new Cairo.Context(surface);

        // Transparent background
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        // Explicit High-Fidelity Subpixel Antialiasing
        cr.setAntialias(Cairo.Antialias.SUBPIXEL);

        const layout = PangoCairo.create_layout(cr);
        const fontDesc = Pango.FontDescription.from_string(font);
        layout.set_font_description(fontDesc);

        for (let i = 0; i < chars.length && i < (GLYPH_ATLAS_COLUMNS * GLYPH_ATLAS_ROWS); i++) {
            const item = chars[i];
            const text = (typeof item === 'string') ? item : item.text;
            // Skip empty entries (e.g. padding beyond string length in string mode)
            if (!text)
                continue;
            const color = (typeof item === 'object' && item.color) ? item.color : [1.0, 1.0, 1.0];

            cr.setSourceRGBA(color[0], color[1], color[2], 1.0);

            const col = i % GLYPH_ATLAS_COLUMNS;
            const row = Math.floor(i / GLYPH_ATLAS_COLUMNS);

            layout.set_text(text, -1);
            const [, extents] = layout.get_pixel_extents();

            // Center character in cell
            const x = col * cellWidth + (cellWidth - extents.width) / 2 - extents.x;
            const y = row * cellHeight + (cellHeight - extents.height) / 2 - extents.y;

            cr.moveTo(x, y);
            PangoCairo.show_layout(cr, layout);
        }

        // Use temporary PNG to guarantee reliable Cogl texture pixel conversion in modern GJS
        const tmpPath = GLib.build_filenamev([GLib.get_tmp_dir(), `matrix_atlas_${GLib.random_int()}.png`]);
        surface.writeToPNG(tmpPath);
        surface.finish();

        const pixbuf = GdkPixbuf.Pixbuf.new_from_file(tmpPath);
        const file = Gio.File.new_for_path(tmpPath);
        try {
            file.delete(null);
        } catch {
            // Cleaned up
        }

        const content = St.ImageContent.new_with_preferred_size(size, size);
        content.set_bytes(
            coglContext,
            pixbuf.read_pixel_bytes(),
            pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
            pixbuf.get_width(),
            pixbuf.get_height(),
            pixbuf.get_rowstride()
        );

        return content;
    }

    destroy() {
        for (const content of this._cache.values()) {
            if (typeof content.unrealize === 'function') {
                content.unrealize();
            }
        }
        this._cache.clear();
    }
}
