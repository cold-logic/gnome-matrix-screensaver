# Teal Matrix Screensaver — Agent Development Guidelines

This repository contains the **Teal Matrix Screensaver** extension (`matrix-screensaver@cold-logic`) built for **GNOME Shell 50+** on Wayland.

## SCM & Version Control (Jujutsu First)
- **Primary SCM: Jujutsu (`jj`):** Always prioritize `jj` CLI commands over standard `git` for commit authoring, diffs, status inspection, and branch management:
  - Status: `jj --no-pager status`
  - Diff: `jj --no-pager diff`
  - Log: `jj --no-pager log -n 5`
  - Commit/Describe: `jj describe -m "commit message"`
  - Git Push: `jj bookmark set main -r @ && jj git push`
- Fall back to raw `git` only for git-specific tools or hooks.

## Codebase Topology & Navigation (Graphify)
- **Consult the Graph First:** Before performing broad codebase greps or speculating on architecture, consult `graphify query "<question>"` or `graphify path "<A>" "<B>"`.
- **Keep Graph Synchronized:** Run `graphify update .` after code modifications (also handled automatically on commit via git hook).
- **Interactive Visualizers:** `graph.html` and `graphify-out/gnome-matrix-screensaver-callflow.html` are available for visual inspection.

## Hybrid Development Model
- **Fast-Path (Bugfixes, shader tuning, UI tweaks):**
  - Make direct edits to source files.
  - Recompile schemas & bundle via `./install.sh`.
  - Test live preview via desktop shortcut or `gnome-extensions prefs matrix-screensaver@cold-logic`.
  - Describe and commit via `jj describe -m "..."`.
- **Lightweight ICM (Roadmap Milestones & Architectural features):**
  - Follow the 3-stage pipeline in `.icm/`:
    - **Stage 01 (`01-spec`):** Scoped specification in `output/SPEC.md`.
    - **Stage 02 (`02-implementation`):** Code changes & `output/CHANGELOG.md`.
    - **Stage 03 (`03-audit-qa`):** Autonomous audit via Devin CLI (`devin -p --model glm-5-2-max`) and nested Wayland testing (`./dev.sh`).

## Research-First Engineering & Ground-Truth Verification
- **Mandatory Pre-Flight Research:** Never rely solely on internal LLM pre-trained weights for modern APIs, library versions, or architectural specs. Before generating or refactoring code involving external libraries or compositor APIs, you MUST actively research upstream documentation, release notes, and community repos using web search and URL extraction tools (`search_web`, `read_url_content`).
- **Prioritize Primary Sources:** Prefer authoritative upstream documentation (e.g., `gjs.guide`, GNOME GitLab MRs, Mutter C-API/typelibs, PyPI/npm release notes) over legacy blogs or outdated forum posts.
- **Traceable Attribution:** When introducing new API conventions, flags, or configuration keys, explicitly reference the upstream documentation or official issue/commit verifying its correctness.
- **Zero-Speculation Rule:** If upstream documentation does not clearly verify a method signature or behavior, inspect the local system typelib/binary directly (`g-ir-inspect`, CLI `--help`) or test in an isolated sandbox (`./dev.sh`) rather than guessing.

## GNOME 50+ & Graphics Architecture Rules
- **0% CPU Idle:** The 30fps animation ticker (`GLib.timeout_add`) must ONLY run when screensaver is active. No persistent timers during normal desktop usage.
- **Cogl Hardware Samplers:** GLSL fragment shaders must sample Layer 0 via `cogl_sampler_0` and ensure proper vector types (avoid ternary scalar `length()` operations on `vec3`).
- **Lifecycle Cleanliness:** Store all Clutter actor signal connection IDs (`button-press-event`, `key-press-event`) and disconnect explicitly in `destroy()`.
- **State Caching:** Pre-cache uniform state to push values immediately when Cogl constructs the pipeline.
- **Testing:** Test screensaver behavior using the official nested Wayland session (`./dev.sh` / `gnome-shell --devkit --wayland`).
