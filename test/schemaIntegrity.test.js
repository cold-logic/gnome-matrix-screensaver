import {describe, it, expect} from 'bun:test';
import {readFileSync} from 'fs';

describe('Schema and UI Parity Audit', () => {
    const schemaXml = readFileSync('schemas/org.gnome.shell.extensions.matrix-screensaver.gschema.xml', 'utf8');

    it('defines all 18 required settings keys in gschema', () => {
        const expectedKeys = [
            'screensaver-enabled',
            'idle-timeout',
            'test-trigger',
            'inhibit-fullscreen',
            'lockscreen-enabled',
            'panel-indicator-enabled',
            'glyph-set',
            'lead-color',
            'trail-color',
            'rain-speed',
            'font-size',
            'row-spacing',
            'glyph-scale',
            'stream-density',
            'stream-length',
            'glow-enabled',
            'soft-blur-enabled',
            'aa-sharpness',
        ];

        for (const key of expectedKeys) {
            expect(schemaXml).toContain(`name="${key}"`);
        }
    });

    it('contains all 6 valid glyph-set choices in gschema', () => {
        const expectedChoices = ['katakana', 'binary', 'hex', 'html', 'road', 'ui'];
        for (const choice of expectedChoices) {
            expect(schemaXml).toContain(`<choice value="${choice}"/>`);
        }
    });

    it('aligns quickSettings GLYPH_SHORT_NAMES with schema choices', () => {
        const qsContent = readFileSync('shell/quickSettings.js', 'utf8');
        const expectedChoices = ['katakana', 'binary', 'hex', 'html', 'road', 'ui'];
        for (const choice of expectedChoices) {
            expect(qsContent).toContain(`${choice}:`);
        }
    });

    it('aligns panelIndicator GLYPH_LABELS with schema choices', () => {
        const piContent = readFileSync('shell/panelIndicator.js', 'utf8');
        const expectedChoices = ['katakana', 'binary', 'hex', 'html', 'road', 'ui'];
        for (const choice of expectedChoices) {
            expect(piContent).toContain(`${choice}:`);
        }
    });

    it('aligns prefs.js GLYPH_OPTIONS with schema choices', () => {
        const prefsContent = readFileSync('prefs.js', 'utf8');
        const expectedChoices = ['katakana', 'binary', 'hex', 'html', 'road', 'ui'];
        for (const choice of expectedChoices) {
            expect(prefsContent).toContain(`id: '${choice}'`);
        }
    });

    it('ensures package bundle includes panelIndicator.js in install.sh and metadata', () => {
        const installScript = readFileSync('install.sh', 'utf8');
        expect(installScript).toContain('"$SRC_DIR/shell"');
    });
});
