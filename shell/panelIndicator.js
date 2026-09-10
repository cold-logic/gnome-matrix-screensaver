import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const GLYPH_LABELS = {
    katakana: 'Classic Katakana',
    binary: 'Binary Stream',
    hex: 'Hexadecimal Dump',
    html: 'HTML & Web Rain',
    road: 'Road & Public Signs',
    ui: 'Digital UI Icons',
};

export const MatrixPanelIndicator = GObject.registerClass({
    GTypeName: 'MatrixPanelIndicator_ColdLogic',
}, class MatrixPanelIndicator extends PanelMenu.Button {
    _init(settings, openPreferences) {
        super._init(0.0, 'Matrix Screensaver', false);

        this._settings = settings;
        this._openPreferences = openPreferences;
        this._settingsSignals = [];

        this.accessible_name = 'Matrix Screensaver';

        // Top-bar icon with native styling and accessibility
        this._icon = new St.Icon({
            icon_name: 'preferences-desktop-screensaver-symbolic',
            style_class: 'system-status-icon',
            accessible_name: 'Matrix Screensaver',
        });
        this.add_child(this._icon);

        // Build modern popup menu
        this._buildMenu();

        // Connect GSettings changes
        this._updateVisualState();
        this._settingsSignals.push(
            this._settings.connect('changed::screensaver-enabled', () => {
                this._updateVisualState();
            }),
            this._settings.connect('changed::glyph-set', () => {
                this._updateStatusLabel();
            }),
            this._settings.connect('changed::idle-timeout', () => {
                this._updateStatusLabel();
            })
        );
    }

    _buildMenu() {
        // Toggle item: Enable/Disable Screensaver
        const isEnabled = this._settings.get_boolean('screensaver-enabled');
        this._toggleItem = new PopupMenu.PopupSwitchMenuItem(
            'Matrix Screensaver',
            isEnabled
        );
        this._toggleItem.connect('toggled', (_item, state) => {
            if (this._settings.get_boolean('screensaver-enabled') !== state)
                this._settings.set_boolean('screensaver-enabled', state);
        });
        this.menu.addMenuItem(this._toggleItem);

        // Informational subtitle / status line
        this._statusItem = new PopupMenu.PopupMenuItem('', {
            reactive: false,
            can_focus: false,
            style_class: 'popup-inactive-menu-item',
        });
        this.menu.addMenuItem(this._statusItem);
        this._updateStatusLabel();

        // Action item: Trigger Preview Now
        this._triggerItem = new PopupMenu.PopupMenuItem('Trigger Screensaver Now');
        this._triggerItem.connect('activate', () => {
            const current = this._settings.get_int('test-trigger');
            this._settings.set_int('test-trigger', (current + 1) % 1000000);
        });
        this.menu.addMenuItem(this._triggerItem);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Action item: Settings
        if (typeof this._openPreferences === 'function') {
            this._settingsItem = new PopupMenu.PopupMenuItem('Settings…');
            this._settingsItem.connect('activate', () => {
                this._openPreferences();
            });
            this.menu.addMenuItem(this._settingsItem);
        }
    }

    _updateStatusLabel() {
        if (!this._statusItem)
            return;

        const isEnabled = this._settings.get_boolean('screensaver-enabled');
        if (!isEnabled) {
            this._statusItem.label.text = 'Screensaver is currently disabled';
            return;
        }

        const glyph = this._settings.get_string('glyph-set') || 'katakana';
        const timeout = Math.round(this._settings.get_double('idle-timeout'));
        const glyphName = GLYPH_LABELS[glyph] ?? glyph;
        this._statusItem.label.text = `${glyphName} • ${timeout}s idle`;
    }

    _updateVisualState() {
        const isEnabled = this._settings.get_boolean('screensaver-enabled');
        if (this._toggleItem && this._toggleItem.state !== isEnabled)
            this._toggleItem.setToggleState(isEnabled);

        this._updateStatusLabel();

        if (this._icon) {
            const targetOpacity = isEnabled ? 255 : 130;
            this._icon.remove_all_transitions();
            if (typeof this._icon.easeAsync === 'function') {
                this._icon.easeAsync({
                    opacity: targetOpacity,
                    duration: 200,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                }).catch(() => {});
            } else if (typeof this._icon.ease === 'function') {
                this._icon.ease({
                    opacity: targetOpacity,
                    duration: 200,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            } else {
                this._icon.opacity = targetOpacity;
            }
        }
    }

    destroy() {
        if (this._settings && this._settingsSignals) {
            for (const id of this._settingsSignals)
                this._settings.disconnect(id);
            this._settingsSignals = [];
        }
        this._settings = null;
        this._openPreferences = null;
        this._icon = null;
        this._toggleItem = null;
        this._statusItem = null;
        this._triggerItem = null;
        this._settingsItem = null;

        super.destroy();
    }
});
