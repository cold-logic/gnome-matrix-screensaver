# Stage 01: Specification — GJS Flat Config Linting & Code Quality Gates

## 1. Goal & Objectives
Establish a modern, zero-compromise static analysis and linting pipeline adhering to:
- Official **GNOME 50+ GJS Standards** (`gjs.guide`).
- Modern **ESLint Flat Config** (`eslint.config.mjs`) compatible with ESLint v9/v10.
- Strict GObject and Wayland conventions (clean signal handlers, `vfunc_` exemptions, camelCase rules, no implicit globals, explicit scope cleanup).
- Automated CLI lint task via `bun run lint` and pre-commit verification.

---

## 2. Technical Architecture & Decisions

### Tooling Choice: `bun` + `eslint` (Flat Config)
- `bun` is already installed and available in the environment (`~/.local/share/mise/installs/bun/latest/bin/bun`).
- Extremely fast installation and execution without polluting system libraries.

### Configuration (`eslint.config.mjs`):
1. **Target Files:** `extension.js`, `prefs.js`, `shell/**/*.js`.
2. **Language Options:**
   - `ecmaVersion: 2024`
   - `sourceType: 'module'`
   - **Globals:**
     - GNOME Shell: `global`, `_`
     - Logging/Debugging: `console`
     - GJS Imports: `imports` (marked readonly, discouraged in favor of ES modules)
3. **Core Rules to Enforce:**
   - `camelcase`: Enforced on variables and functions, with explicit regex exemptions for GNOME GObject virtual methods (`^vfunc_`, `^_vfunc_`, `^on_`, `^_init`).
   - `no-unused-vars`: Error on unused variables and imports, allowing `_` prefix for intentionally unused arguments.
   - `no-undef`: Error on undefined variables (prevents runtime `ReferenceError`s in Shell).
   - `eqeqeq`: Strict equality `===` enforcement.
   - `prefer-const`: Enforce immutable declarations where possible.
   - `no-var`: Prohibit legacy `var`.
   - `arrow-body-style` & `prefer-arrow-callback`: Modern ES2024 style.

### Script Integration:
- `package.json`:
  ```json
  {
    "name": "gnome-matrix-screensaver",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "scripts": {
      "lint": "eslint .",
      "lint:fix": "eslint . --fix"
    }
  }
  ```
- `./install.sh`: Add automated pre-pack lint check (`bun run lint`).

---

## 3. Test & Verification Plan
1. Run `bun run lint` against current codebase.
2. Resolve any existing stylistic violations or dead code detected by the linter.
3. Validate that `bun run lint` exits cleanly with `0 warnings, 0 errors`.
4. Run Stage 03 audit via Devin CLI (`GLM-5.2`).
