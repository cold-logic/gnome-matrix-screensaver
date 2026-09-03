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
        count: 56,
        font: 'Monospace, monospace, DejaVu Sans Mono Bold 36',
        chars: [
            // Coral / Rose Pink: Tags, element names & slashes
            { text: '<', color: [0.98, 0.15, 0.45] },
            { text: '>', color: [0.98, 0.15, 0.45] },
            { text: '/', color: [0.98, 0.15, 0.45] },
            { text: 'd', color: [0.98, 0.15, 0.45] },
            { text: 'i', color: [0.98, 0.15, 0.45] },
            { text: 'v', color: [0.98, 0.15, 0.45] },
            { text: 'p', color: [0.98, 0.15, 0.45] },
            { text: 'a', color: [0.98, 0.15, 0.45] },
            { text: 'h', color: [0.98, 0.15, 0.45] },
            { text: '1', color: [0.98, 0.15, 0.45] },

            // Multi-char HTML tokens (rendered as single atlas cells)
            { text: '<div', color: [0.98, 0.15, 0.45] },
            { text: '</>', color: [0.98, 0.15, 0.45] },
            { text: '<a>', color: [0.98, 0.15, 0.45] },
            { text: '<p>', color: [0.98, 0.15, 0.45] },
            { text: '<h1', color: [0.98, 0.15, 0.45] },
            { text: 'div>', color: [0.98, 0.15, 0.45] },

            // Warm White / Pale Slate: Braces, brackets & semicolons
            { text: '{', color: [0.97, 0.97, 0.95] },
            { text: '}', color: [0.97, 0.97, 0.95] },
            { text: '[', color: [0.97, 0.97, 0.95] },
            { text: ']', color: [0.97, 0.97, 0.95] },
            { text: '(', color: [0.97, 0.97, 0.95] },
            { text: ')', color: [0.97, 0.97, 0.95] },
            { text: ';', color: [0.97, 0.97, 0.95] },
            { text: ':', color: [0.97, 0.97, 0.95] },

            // Multi-char CSS/JS tokens
            { text: '{}', color: [0.97, 0.97, 0.95] },
            { text: '();', color: [0.97, 0.97, 0.95] },
            { text: '[]', color: [0.97, 0.97, 0.95] },

            // Electric Emerald / Lime: Attributes, identifiers & operators
            { text: '&', color: [0.65, 0.89, 0.18] },
            { text: '=', color: [0.65, 0.89, 0.18] },
            { text: '!', color: [0.65, 0.89, 0.18] },
            { text: '?', color: [0.65, 0.89, 0.18] },
            { text: '#', color: [0.65, 0.89, 0.18] },
            { text: '.', color: [0.65, 0.89, 0.18] },
            { text: '*', color: [0.65, 0.89, 0.18] },
            { text: '+', color: [0.65, 0.89, 0.18] },
            { text: '-', color: [0.65, 0.89, 0.18] },
            { text: '%', color: [0.65, 0.89, 0.18] },
            { text: '$', color: [0.65, 0.89, 0.18] },
            { text: '_', color: [0.65, 0.89, 0.18] },
            { text: '~', color: [0.65, 0.89, 0.18] },

            // Multi-char attribute tokens
            { text: 'href', color: [0.65, 0.89, 0.18] },
            { text: 'class', color: [0.65, 0.89, 0.18] },
            { text: 'id=', color: [0.65, 0.89, 0.18] },
            { text: 'src=', color: [0.65, 0.89, 0.18] },
            { text: 'rel=', color: [0.65, 0.89, 0.18] },

            // Canary Amber / Gold: Values, quotes & literals
            { text: '"', color: [0.90, 0.86, 0.45] },
            { text: '\'', color: [0.90, 0.86, 0.45] },
            { text: '2', color: [0.90, 0.86, 0.45] },
            { text: 'b', color: [0.90, 0.86, 0.45] },
            { text: 'r', color: [0.90, 0.86, 0.45] },

            // Multi-char string/value tokens
            { text: '""', color: [0.90, 0.86, 0.45] },
            { text: '"42', color: [0.90, 0.86, 0.45] },
            { text: '0px', color: [0.90, 0.86, 0.45] },
            { text: '100%', color: [0.90, 0.86, 0.45] },
            { text: 'true', color: [0.90, 0.86, 0.45] },
            { text: 'null', color: [0.90, 0.86, 0.45] },

            // Sky Blue: Keywords & function names (new 5th category)
            { text: 'fn', color: [0.33, 0.66, 0.95] },
            { text: 'var', color: [0.33, 0.66, 0.95] },
            { text: 'let', color: [0.33, 0.66, 0.95] },
            { text: 'if', color: [0.33, 0.66, 0.95] },
            { text: 'for', color: [0.33, 0.66, 0.95] },
            { text: 'return', color: [0.33, 0.66, 0.95] },
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
        } else {
            // Procedurally render vector typography into atlas texture via Cairo & Pango
            content = this._renderProceduralAtlas(coglContext, config.chars, config.font);
        }

        this._cache.set(config.id, content);
        return {
            content,
            count: config.count,
        };
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
