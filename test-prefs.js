#!/usr/bin/env -S GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0 LD_LIBRARY_PATH=/usr/lib/gnome-shell gjs -m

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GIRepository from 'gi://GIRepository';

try {
    GIRepository.Repository.prepend_search_path('/usr/lib/gnome-shell/girepository-1.0');
    GIRepository.Repository.prepend_library_path('/usr/lib/gnome-shell');
} catch (e) {}

for (const resPath of [
    '/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource',
    '/usr/share/gnome-shell/org.gnome.Extensions.src.gresource',
]) {
    try {
        const res = Gio.Resource.load(resPath);
        res._register();
    } catch (e) {}
}

import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';

const app = new Adw.Application({
    application_id: 'org.gnome.MatrixScreensaver.PrefsTest',
    flags: Gio.ApplicationFlags.FLAGS_NONE,
});

app.connect('activate', async () => {
    try {
        const window = new Adw.PreferencesWindow({
            application: app,
            title: 'Teal Matrix Screensaver Preferences',
            default_width: 680,
            default_height: 720,
        });

        const curDir = GLib.path_get_dirname(import.meta.url.replace('file://', ''));
        const metadataFile = Gio.File.new_for_path(curDir + '/metadata.json');
        const [, contents] = metadataFile.load_contents(null);
        const metadata = JSON.parse(new TextDecoder().decode(contents));
        metadata.path = curDir;
        metadata.dir = Gio.File.new_for_path(curDir);

        const schemaDir = Gio.File.new_for_path(curDir + '/schemas');
        const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        const schema = schemaSource.lookup(metadata['settings-schema'], false);
        const settings = new Gio.Settings({ settings_schema: schema });

        const {default: TealMatrixPreferences} = await import('./prefs.js');

        const prefs = new TealMatrixPreferences({
            metadata,
            dir: metadata.dir,
            path: metadata.path,
        });
        prefs.getSettings = () => settings;
        prefs.fillPreferencesWindow(window);

        window.present();
    } catch (error) {
        console.error('Error launching preferences:', error);
    }
});

app.run([imports.system.programInvocationName]);
