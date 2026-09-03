import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const GLYPH_OPTIONS = [
    { id: 'katakana', name: 'Classic Katakana (Authentic Movie Rain)' },
    { id: 'binary',   name: 'Binary Stream (0 & 1 Cyber Matrix)' },
    { id: 'hex',      name: 'Hexadecimal Dump (0-F Memory Feed)' },
    { id: 'html',     name: 'HTML & Web Rain (<tag>, {}, ;, &)' },
    { id: 'road',     name: 'Road & Public Signs (🛑, ⚠️, 🚸, ♿)' },
    { id: 'ui',       name: 'Digital UI Icons (⚙️, 🔍, 💾, 💻)' },
];

export default class TealMatrixPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('Screensaver'),
            icon_name: 'preferences-desktop-screensaver-symbolic',
        });
        window.add(page);

        // Group 0: Test & Live Preview
        const previewGroup = new Adw.PreferencesGroup({
            title: _('Live Preview &amp; Test'),
            description: _('Immediately preview the screensaver with your current settings.'),
        });
        page.add(previewGroup);

        const testRow = new Adw.ActionRow({
            title: _('Test Screensaver'),
            subtitle: _('Launches fullscreen screensaver now (move mouse or click to exit)'),
        });
        const testButton = new Gtk.Button({
            label: _('Launch Test Preview'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        testButton.connect('clicked', () => {
            const current = settings.get_int('test-trigger');
            settings.set_int('test-trigger', (current + 1) % 1000000);
        });
        testRow.add_suffix(testButton);
        testRow.set_activatable_widget(testButton);
        previewGroup.add(testRow);

        // Group 1: Timing & Trigger
        const timingGroup = new Adw.PreferencesGroup({
            title: _('Activation Timing &amp; Integration'),
            description: _('Configure when and where the screensaver activates.'),
        });
        page.add(timingGroup);

        const enableRow = new Adw.SwitchRow({
            title: _('Enable Idle Screensaver'),
            subtitle: _('Master switch for idle digital rain activation'),
            active: settings.get_boolean('screensaver-enabled'),
        });
        settings.bind('screensaver-enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        timingGroup.add(enableRow);

        const idleRow = new Adw.SpinRow({
            title: _('Idle Timeout'),
            subtitle: _('Seconds of inactivity before screensaver starts'),
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 3600,
                step_increment: 5,
                page_increment: 30,
                value: settings.get_double('idle-timeout'),
            }),
        });
        settings.bind('idle-timeout', idleRow.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
        timingGroup.add(idleRow);

        const inhibitRow = new Adw.SwitchRow({
            title: _('Inhibit on Fullscreen Media'),
            subtitle: _('Suppress screensaver while playing fullscreen videos or gaming'),
            active: settings.get_boolean('inhibit-fullscreen'),
        });
        settings.bind('inhibit-fullscreen', inhibitRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        timingGroup.add(inhibitRow);

        const lockscreenRow = new Adw.SwitchRow({
            title: _('Lock Screen Digital Rain'),
            subtitle: _('Render falling rain behind the GNOME lock screen &amp; shield'),
            active: settings.get_boolean('lockscreen-enabled'),
        });
        settings.bind('lockscreen-enabled', lockscreenRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        timingGroup.add(lockscreenRow);

        // Group 2: Appearance & Glyphs
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance &amp; Character Set'),
            description: _('Customize the stream alphabet and digital rain palette.'),
        });
        page.add(appearanceGroup);

        // Glyph Set Selector with Two-Way GSettings Sync
        const stringList = new Gtk.StringList();
        for (const opt of GLYPH_OPTIONS) {
            stringList.append(opt.name);
        }

        const glyphRow = new Adw.ComboRow({
            title: _('Glyph Character Set'),
            subtitle: _('Select the stream alphabet used for digital code rain'),
            model: stringList,
        });

        const syncComboFromSettings = () => {
            const currentSetId = settings.get_string('glyph-set') || 'katakana';
            let index = GLYPH_OPTIONS.findIndex(o => o.id === currentSetId);
            if (index === -1) index = 0;
            if (glyphRow.selected !== index) {
                glyphRow.selected = index;
            }
        };

        syncComboFromSettings();

        glyphRow.connect('notify::selected', () => {
            const selectedOpt = GLYPH_OPTIONS[glyphRow.selected];
            if (selectedOpt && settings.get_string('glyph-set') !== selectedOpt.id) {
                settings.set_string('glyph-set', selectedOpt.id);
            }
        });

        settings.connect('changed::glyph-set', () => {
            syncComboFromSettings();
        });

        appearanceGroup.add(glyphRow);

        this._addColorRow(settings, appearanceGroup, 'lead-color', _('Glyph Lead Color'), _('Color of the leading falling character'), '#0de0eb');
        this._addColorRow(settings, appearanceGroup, 'trail-color', _('Trail Color'), _('Color of the trailing code streams'), '#0de0eb');

        // Group 3: Rain Dynamics
        const dynamicsGroup = new Adw.PreferencesGroup({
            title: _('Rain Dynamics'),
            description: _('Control rain density, speed, and size.'),
        });
        page.add(dynamicsGroup);

        this._addScaleRow(settings, dynamicsGroup, 'rain-speed', _('Rain Speed'), _('Speed of the falling glyph streams'), 10, 200, 5, '%');
        this._addScaleRow(settings, dynamicsGroup, 'font-size', _('Font Size'), _('Size of each glyph in pixels'), 10, 48, 1, 'px');
        this._addScaleRow(settings, dynamicsGroup, 'row-spacing', _('Row Spacing / Tightness'), _('Vertical gap between characters in stream'), 50, 150, 5, '%');
        this._addScaleRow(settings, dynamicsGroup, 'glyph-scale', _('Glyph Scale'), _('Percentage of grid cell filled by symbol'), 50, 100, 5, '%');
        this._addScaleRow(settings, dynamicsGroup, 'stream-density', _('Stream Density'), _('Density of code streams'), 25, 200, 5, '%');

        // Group 4: Optics / Shaders
        const opticsGroup = new Adw.PreferencesGroup({
            title: _('Optics &amp; Glow'),
            description: _('Subpixel phosphor bloom &amp; anti-aliasing.'),
        });
        page.add(opticsGroup);

        const glowRow = new Adw.SwitchRow({
            title: _('Phosphor Glow'),
            subtitle: _('Enable subpixel halo (off for pure pitch black background)'),
            active: settings.get_boolean('glow-enabled'),
        });
        settings.bind('glow-enabled', glowRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        opticsGroup.add(glowRow);

        const blurRow = new Adw.SwitchRow({
            title: _('Cinematic Softening'),
            subtitle: _('Blend adjacent glyph samples to soften edges'),
            active: settings.get_boolean('soft-blur-enabled'),
        });
        settings.bind('soft-blur-enabled', blurRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        opticsGroup.add(blurRow);

        this._addScaleRow(settings, opticsGroup, 'aa-sharpness', _('Anti-Aliasing'), _('Glyph edge smoothness (low = sharp crisp, high = soft feathered)'), 0, 100, 1, '%');
    }

    _addColorRow(settings, group, key, title, subtitle, defaultHex) {
        const row = new Adw.ActionRow({ title, subtitle });
        const rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string(key) || defaultHex);

        const dialog = new Gtk.ColorDialog({ with_alpha: false });
        const button = new Gtk.ColorDialogButton({
            dialog,
            rgba,
            valign: Gtk.Align.CENTER,
        });

        button.connect('notify::rgba', () => {
            const newRgba = button.get_rgba();
            settings.set_string(key, newRgba.to_string());
        });

        row.add_suffix(button);
        row.set_activatable_widget(button);
        group.add(row);
    }

    _addScaleRow(settings, group, key, title, subtitle, min, max, step, unit) {
        const row = new Adw.ActionRow({ title, subtitle });
        const scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, min, max, step);
        scale.valign = Gtk.Align.CENTER;
        scale.hexpand = true;
        scale.set_size_request(240, -1);
        scale.draw_value = false;
        scale.set_value(settings.get_double(key));

        const label = new Gtk.Label({
            label: `${Math.round(scale.get_value())}${unit}`,
            width_chars: 6,
            xalign: 1,
        });

        scale.connect('value-changed', () => {
            label.label = `${Math.round(scale.get_value())}${unit}`;
        });

        settings.bind(key, scale.get_adjustment(), 'value', Gio.SettingsBindFlags.DEFAULT);

        row.add_suffix(scale);
        row.add_suffix(label);
        row.set_activatable_widget(scale);
        group.add(row);
    }
}
