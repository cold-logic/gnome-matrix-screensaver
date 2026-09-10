import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {MatrixScreensaverManager} from './shell/matrixScreensaver.js';
import {MatrixQuickSettingsIndicator} from './shell/quickSettings.js';
import {MatrixPanelIndicator} from './shell/panelIndicator.js';

export default class TealMatrixScreensaverExtension extends Extension {
    enable() {
        const logger = this.getLogger ? this.getLogger('MatrixScreensaver') : console;

        // Guard against double-enable (Looking Glass reload, error-then-retry):
        // destroy any existing objects before re-creating to prevent leaks.
        if (this._manager || this._quickSettings || this._indicator)
            this.disable();

        this._settings = this.getSettings();

        let manager = null;
        try {
            manager = new MatrixScreensaverManager(this._settings, this.path);
        } catch (error) {
            logger.error(`Failed to start manager: ${error}`);
            manager?.destroy();
        }
        this._manager = manager;

        let quickSettings = null;
        try {
            quickSettings = new MatrixQuickSettingsIndicator(this._settings);
            Main.panel.statusArea.quickSettings.addExternalIndicator(quickSettings);
        } catch (error) {
            logger.error(`Failed to start Quick Settings indicator: ${error}`);
            quickSettings?.destroy();
        }
        this._quickSettings = quickSettings;

        this._syncPanelIndicator(logger);
        this._panelIndicatorSettingId = this._settings.connect(
            'changed::panel-indicator-enabled',
            () => this._syncPanelIndicator(logger)
        );
    }

    _syncPanelIndicator(logger = console) {
        const enabled = this._settings?.get_boolean('panel-indicator-enabled') ?? true;

        if (enabled && !this._indicator) {
            try {
                this._indicator = new MatrixPanelIndicator(
                    this._settings,
                    () => this.openPreferences()
                );
                Main.panel.addToStatusArea('matrix-screensaver', this._indicator);
            } catch (error) {
                logger.error(`Failed to create panel indicator: ${error}`);
                this._indicator?.destroy();
                this._indicator = null;
            }
        } else if (!enabled && this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    disable() {
        if (this._settings && this._panelIndicatorSettingId) {
            this._settings.disconnect(this._panelIndicatorSettingId);
            this._panelIndicatorSettingId = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
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
