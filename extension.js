import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {MatrixScreensaverManager} from './shell/matrixScreensaver.js';
import {MatrixQuickSettingsIndicator} from './shell/quickSettings.js';

export default class TealMatrixScreensaverExtension extends Extension {
    enable() {
        // Guard against double-enable (Looking Glass reload, error-then-retry):
        // destroy any existing objects before re-creating to prevent leaks.
        if (this._manager || this._quickSettings)
            this.disable();

        this._settings = this.getSettings();

        let manager = null;
        try {
            manager = new MatrixScreensaverManager(this._settings, this.path);
        } catch (error) {
            console.error(`[matrix-screensaver] Failed to start manager: ${error}`);
            manager?.destroy();
        }
        this._manager = manager;

        let quickSettings = null;
        try {
            quickSettings = new MatrixQuickSettingsIndicator(this._settings);
            Main.panel.statusArea.quickSettings.addExternalIndicator(quickSettings);
        } catch (error) {
            console.error(`[matrix-screensaver] Failed to start Quick Settings indicator: ${error}`);
            quickSettings?.destroy();
        }
        this._quickSettings = quickSettings;
    }

    disable() {
        if (this._quickSettings) {
            this._quickSettings.destroy();
            this._quickSettings = null;
        }
        if (this._manager) {
            this._manager.destroy();
            this._manager = null;
        }
        this._settings = null;
    }
}
