import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

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
        this._settings.bind(
            'screensaver-enabled',
            this,
            'checked',
            Gio.SettingsBindFlags.DEFAULT
        );
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
