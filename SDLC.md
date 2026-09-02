# Software Development Lifecycle (SDLC)

This document formalizes the development lifecycle for **`gnome-matrix-screensaver`** and related systems projects. It defines how requirements flow from roadmap goals to production code through our multi-agent hybrid architecture.

---

## 1. Core Architecture & Philosophy

Our SDLC is built on three pillars:
1. **Opinionated SCM (`jj` first):** Working-copy commits, conflict-free rebases, and clean bookmark synchronization backed by Git.
2. **Topological Grounding (Graphify):** Knowledge-graph first navigation that eliminates blind file greps and hallucinations.
3. **Dual-Speed Execution (Hybrid ICM):**
   - **Fast-Path:** Sub-minute turnaround for shader tuning, single-file bugfixes, and UI tweaks.
   - **Lightweight ICM:** Staged, auditable pipelines for complex multi-file roadmap milestones.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             Feature Request / Issue                              │
└──────────────────────────────────────────────────────────────────────────────────┘
                                          │
                        Is it a major multi-file milestone?
                                          │
                     ┌────────────────────┴────────────────────┐
                    YES                                       NO
                     │                                         │
                     ▼                                         ▼
         [Lightweight ICM Pipeline]                    [Fast-Path Workflow]
         Stage 01: Spec & Topology                     1. Query Graphify AST
         Stage 02: Implementation                      2. Direct File Edit
         Stage 03: Devin / GLM Audit                   3. ./install.sh + Test
                     │                                 4. jj describe -m "..."
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                             Verification & Live Testing
                             - gnome-extensions prefs test
                             - Nested Wayland (./dev.sh)
                                          │
                                          ▼
                                SCM Promotion & Sync
                             - jj bookmark set master -r @
                             - jj git push
```

---

## 2. The Two Execution Paths

### Path A: Fast-Path (Sub-minute turnarounds)
* **Triggers:** Shader parameter tuning, palette adjustments, slider ranges, minor bugfixes, single-file documentation updates.
* **Process:**
  1. **Locate:** Use `graphify query "<concept>"` to identify the exact symbol and call sites.
  2. **Edit:** Apply changes directly to source code.
  3. **Build:** Run `./install.sh` (compiles schemas, bundles extension zip, enables).
  4. **Verify:** Launch test preview via desktop shortcut or `gnome-extensions prefs matrix-screensaver@cold-logic`.
  5. **Commit:** `jj describe -m "<type>(<scope>): <summary>"` and push with `jj git push`.
  6. **Auto-sync:** Background git hook updates `graphify-out/graph.json` automatically on commit.

---

### Path B: Lightweight ICM (Milestones & Architectural Changes)
* **Triggers:** Multi-file features (e.g. Lock screen overlay, Quick Settings tile, Audio-reactivity, EGO release).
* **Pipeline Structure in `.icm/`:**

#### Stage 01: Specification & Design (`stages/01-spec`)
* **Role:** Architect (Antigravity + Graphify).
* **Action:**
  - Investigate target GNOME Shell / Mutter / DBus APIs.
  - Query existing dependencies using `graphify query` and `graphify path`.
  - Define schema changes, GObject class definitions, and lifecycle boundaries.
* **Output Artifact:** `.icm/stages/01-spec/output/SPEC.md`.
* **Human Edit Surface:** The user reviews, adjusts, or approves `SPEC.md` directly on disk before implementation starts.

#### Stage 02: Implementation (`stages/02-implementation`)
* **Role:** Systems & Graphics Engineer (Antigravity / Devin CLI).
* **Action:**
  - Implement code strictly according to `SPEC.md`.
  - Adhere to graphics & lifecycle rules (0% CPU idle, `cogl_sampler_0` hardware samplers, explicit Clutter signal disconnects).
  - Run `./install.sh` to compile schemas and package the extension.
* **Output Artifact:** Working source files + `.icm/stages/02-implementation/output/CHANGELOG.md`.

#### Stage 03: Audit, QA & Verification (`stages/03-audit-qa`)
* **Role:** Independent Code Auditor & QA (Devin CLI with `GLM-5.2-Max`).
* **Action:**
  - Run autonomous static code audit via `devin -p --model glm-5-2-max` to inspect for:
    - Signal connection ref-cycles and memory leaks.
    - Cogl pipeline construction order and uniform caching.
    - GSettings schema type constraints and bounds.
  - Test in nested Wayland session (`./dev.sh` / `gnome-shell --devkit --wayland`).
* **Output Artifact:** `.icm/stages/03-audit-qa/output/AUDIT_REPORT.md`.

---

## 3. Tooling & Roles Matrix

| Tool | Role in SDLC | Key Commands |
| :--- | :--- | :--- |
| **Jujutsu (`jj`)** | Primary SCM & revision tracking | `jj --no-pager status`, `jj diff`, `jj describe`, `jj git push` |
| **Graphify** | Architectural topology & relationship index | `graphify query "<topic>"`, `graphify path "<A>" "<B>"`, `graphify update .` |
| **Antigravity** | Lead pair-programmer, coordinator, and interactive executor | System design, interactive debugging, tool execution |
| **Devin CLI** | Autonomous sub-agent & deep audit engine (`GLM-5.2-Max`) | `devin -p --model glm-5-2-max -- "Audit..."` |
| **Nested Shell** | Isolated Wayland testing harness | `./dev.sh` (`dbus-run-session gnome-shell --devkit --wayland`) |

---

## 4. Quality & Release Gates

Before any milestone is merged to `master` and tagged:
1. **0% CPU Idle Verification:** Screensaver must completely yield animation tickers when inactive (verified via `top` / `pidstat`).
2. **Signal Cleanliness:** Every `actor.connect(...)` must have a corresponding stored ID and explicit `disconnect(...)` in `destroy()`.
3. **Driver Compatibility:** GLSL shaders must compile warning-free on Mesa and proprietary drivers without scalar/vector type warnings.
4. **Schema Integrity:** Schema files compile cleanly via `glib-compile-schemas` without missing keys or unescaped markup.
