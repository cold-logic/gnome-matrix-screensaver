# System & Project Standards

## Target Environment
- **Platform:** GNOME Shell 50+ on Wayland (Mutter 50.4+)
- **Architecture:** Pure ESM (`import`/`export`), GTK4 + Libadwaita Preferences
- **UUID:** `matrix-screensaver@cold-logic`
- **GSettings Schema:** `org.gnome.shell.extensions.matrix-screensaver`
- **Primary SCM:** **Jujutsu (`jj`)** colocated with Git. Always prefer `jj` CLI operations over standard Git.

## Performance & Lifecycle Rules
1. **0% CPU Idle:** Animation tickers (`GLib.timeout_add`) must ONLY run when screensaver is active. No persistent timers during normal desktop usage.
2. **Cogl Hardware Samplers:** GLSL shaders must sample layer 0 via Cogl's native `cogl_sampler_0` and avoid uninitialized texels.
3. **Explicit Signal Disconnects:** All Clutter actor signal connections must store connection IDs and disconnect explicitly in `destroy()`.
4. **State Caching:** Pre-cache uniform state to push values immediately when Cogl constructs the pipeline.

## Multi-Agent & Tooling Conventions
- **SCM:** `jj` for change management (`jj describe`, `jj new`, `jj git push`).
- **Antigravity:** Architecture, planning, stage coordination, and interactive testing.
- **Devin CLI:** Independent audits, batch refactoring, deep reviews via `GLM-5.2-Max`.
- **Graphify:** Codebase topology and AST relationship queries before edits.
