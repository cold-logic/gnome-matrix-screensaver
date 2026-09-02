import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {MatrixScreensaverManager} from './shell/matrixScreensaver.js';
import {MatrixQuickSettingsIndicator} from './shell/quickSettings.js';

export default class TealMatrixScreensaverExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        try {
            this._manager = new MatrixScreensaverManager(this._settings, this.path);
        } catch (error) {
            console.error(`[matrix-screensaver] Failed to start manager: ${error}`);
            this._manager = null;
        }

        try {
            this._quickSettings = new MatrixQuickSettingsIndicator(this._settings);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._quickSettings);
        } catch (error) {
            console.error(`[matrix-screensaver] Failed to start Quick Settings indicator: ${error}`);
            this._quickSettings = null;
        }
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
