import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

const GLYPH_SHORT_NAMES = {
    katakana: 'Katakana',
    binary: 'Binary',
    hex: 'Hex',
    html: 'HTML',
    road: 'Signs',
    ui: 'Icons',
};

export const MatrixQuickToggle = GObject.registerClass({
    GTypeName: 'MatrixQuickToggle_ColdLogic',
}, class MatrixQuickToggle extends QuickSettings.QuickToggle {
    _init(settings) {
        super._init({
            title: 'Matrix Rain',
            iconName: 'preferences-desktop-screensaver-symbolic',
            toggleMode: true,
        });

        this._settings = settings;
        this._settingsSignals = [];

        this._settings.bind(
            'screensaver-enabled',
            this,
            'checked',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._updateSubtitle();
        this.connect('notify::checked', () => this._updateSubtitle());
        this._settingsSignals.push(
            this._settings.connect('changed::glyph-set', () => this._updateSubtitle()),
            this._settings.connect('changed::idle-timeout', () => this._updateSubtitle())
        );
    }

    _updateSubtitle() {
        if (!this.checked) {
            this.subtitle = 'Disabled';
            return;
        }
        const glyph = this._settings?.get_string('glyph-set') || 'katakana';
        const timeout = Math.round(this._settings?.get_double('idle-timeout') || 60);
        const glyphName = GLYPH_SHORT_NAMES[glyph] ?? glyph;
        this.subtitle = `${glyphName} • ${timeout}s`;
    }

    destroy() {
        if (this._settings && this._settingsSignals) {
            for (const id of this._settingsSignals)
                this._settings.disconnect(id);
            this._settingsSignals = [];
        }
        this._settings = null;
        super.destroy();
    }
});

export const MatrixQuickSettingsIndicator = GObject.registerClass({
    GTypeName: 'MatrixQuickSettingsIndicator_ColdLogic',
}, class MatrixQuickSettingsIndicator extends QuickSettings.SystemIndicator {
    _init(settings) {
        super._init();
        this._settings = settings;
        this._toggle = new MatrixQuickToggle(this._settings);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        if (this._toggle) {
            this._toggle.destroy();
            this._toggle = null;
        }
        super.destroy();
    }
});
