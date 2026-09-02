# Project Roadmap & Future Goals

This document tracks planned features, architectural improvements, and milestones for **`matrix-screensaver@cold-logic`**.

---

## Milestone 1: Native Shell & Desktop Integration
- [x] **Lock Screen & Screen Shield Overlay:**
  - Leverage `session-modes: ["user", "unlock-dialog"]` to render rain behind the lock screen clock, password input, and PAM prompt.
  - Seamless transition from user screensaver into locked state without tearing or actor re-creation.
- [x] **Quick Settings Menu Toggle:**
  - Add a dedicated quick settings tile in GNOME Shell's top-right control menu.
  - Quick toggle to enable/disable screensaver, switch color profiles, or trigger an instant screensaver lock.
- [x] **Session Inhibit Awareness:**
  - Monitor `org.gnome.SessionManager.Inhibit` and full-screen video playback flags (mpv, VLC, web browsers) to automatically inhibit idle screensaver activation during media playback.

---

## Milestone 2: Visual & Shader Enhancements
- [x] **Fade-in & Dissolution Transitions:**
  - Smooth alpha and glyph decay transitions when entering and waking from screensaver mode.
- [x] **Selectable Glyph Sets:**
  - Multiple character streams selectable via preferences:
    - Classic Katakana
    - Binary code stream (`0` and `1`)
    - Hexadecimal memory dump (`0x00 - 0xFF`)
    - HTML & Web Developer code stream (`<tag>`, `{}`, `;`, `&`, `div`, etc.)
    - [x] Road & Public Signs ideogram stream (`🛑`, `⚠️`, `⛔`, `🚸`, `♿`, `🚲`, `🚦`, `⚡`)
    - [x] Digital UI Icons ideogram stream (`⚙️`, `🔍`, `💾`, `💻`, `🔔`, `🔋`, `🔒`, `🌐`)

---

## Milestone 3: Linting, Packaging & Quality Gates (Active Milestone)
- [x] **GJS Flat Config Linting & Static Code Quality (PRIORITY 1):**
  - Establish modern ESLint Flat Config (`eslint.config.mjs`) targeting modern GNOME 50 GJS standards (`gjs.guide`).
  - Configure globals (`global`, `_`, `console`), strict ECMAScript 2024 checks, GObject method naming rules (`vfunc_`), and zero-warning policy.
  - Add automated lint script and pre-commit checks.
- [x] **extensions.gnome.org (EGO) Packaging:**
  - Prepare submission package using `gnome-extensions pack`.
  - Validate bundle contents to ensure zero extraneous development artifacts.
- [ ] **Arch Linux / AUR Packaging:**
  - Create `gnome-shell-extension-matrix-screensaver-git` PKGBUILD for easy installation via `yay` / `paru`.
- [ ] **Automated GitHub CI/CD:**
  - GitHub Actions workflow for linting, schema validation, and automatic release asset zip packaging on tagged releases.

---

## Milestone 4: Desktop Graphics & Mixed-DPI
- [ ] **Per-Monitor DPI & Layout Tweaks:**
  - Independent density and scaling presets for mixed-DPI multi-display setups (e.g. 4K primary + 1080p secondary).

---

## Milestone 4: Web Portfolio Integration
- [ ] **Interactive Web Demo on [cold-logic.github.io](https://cold-logic.github.io/):**
  - Integrate an interactive canvas/WebGL sandbox demo directly into the portfolio website.
  - Allow visitors to customize colors and speed with immediate live feedback in the browser.

---

## Milestone 5: Future & Experimental
- [ ] **Audio-Reactive Mode (Experimental):**
  - Optional PipeWire / PulseAudio monitor integration to modulate rain fall speed, brightness glints, and density to system audio / bass frequencies.
