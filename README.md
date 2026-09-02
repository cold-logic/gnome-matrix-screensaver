# Teal Matrix Screensaver for GNOME 50+

A modern, high-performance, GPU-accelerated Matrix digital rain idle screensaver crafted natively for **GNOME Shell 50+** by **cold-logic**.

## Highlights

* **Pure GNOME 50+ ESM Architecture:** Clean, modular ES modules with strict GObject type isolation.
* **Movie-Accurate Shaders:** Native OpenGL/GLSL fragment shader pipeline with authentic Katakana glyph sequences and floating-point sub-pixel motion.
* **Custom Teal Palette:** Default `#0de0eb` vibrant teal with single-stream lead glyph lighting.
* **Pitch-Black Background:** Zero bloom bleed with 100% opaque solid black backdrop.
* **True Idle Screensaver:** Monitors Mutter hardware idle time via DBus, covers all monitors on `uiGroup`, and wakes immediately on any mouse or keyboard input.
* **Libadwaita Settings UI:** Full GTK4 / Libadwaita preferences panel (`gnome-extensions prefs matrix-screensaver@cold-logic`).
* **Zero Overhead:** Animation timer completely yields (0% CPU/GPU usage) while you are actively working on your desktop.

## Installation

```bash
cd ~/projects/personal/gnome-matrix-screensaver
./install.sh
```

## Roadmap & Future Goals

See [ROADMAP.md](ROADMAP.md) for upcoming milestones and [GLOSSARY.md](GLOSSARY.md) for terminology, typography principles, and graphics architecture references.

## Settings & Customization

Open the native settings dialog:
```bash
gnome-extensions prefs matrix-screensaver@cold-logic
```

Or configure via GSettings:
```bash
# Set idle timeout to 60 seconds
gsettings --schemadir ~/.local/share/gnome-shell/extensions/matrix-screensaver@cold-logic/schemas set org.gnome.shell.extensions.matrix-screensaver idle-timeout 60.0

# Set lead glyph color
gsettings --schemadir ~/.local/share/gnome-shell/extensions/matrix-screensaver@cold-logic/schemas set org.gnome.shell.extensions.matrix-screensaver lead-color '#0de0eb'
```
