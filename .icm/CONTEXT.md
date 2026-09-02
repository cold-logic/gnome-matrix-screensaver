# Hybrid Agent Workflow (Graphify + Lightweight ICM + Devin)

This project uses a **hybrid development workflow** balancing rapid iteration with structured multi-agent execution:

```
┌────────────────────────────────────────────────────────┐
│               Task Type Classification                 │
└────────────────────────────────────────────────────────┘
            │                                  │
    [Minor / Direct]                   [Major Milestone]
            │                                  │
            ▼                                  ▼
   Fast-Path Workflow                   Lightweight ICM
   - Query Graphify AST                - Stage 01: Spec
   - Direct code edit                  - Stage 02: Implement
   - Live test preview                 - Stage 03: Devin / GLM Audit
```

---

## 1. Fast-Path (Quick Fixes, Shader Tweaks, Bugfixes)
* **When to use:** Shader parameter tuning, slider range adjustments, UI label changes, bug fixes.
* **Process:**
  1. `graphify query "<symbol or concept>"` for immediate AST topology.
  2. Perform edit directly in the source file.
  3. Run `./install.sh` and test via `gnome-extensions prefs matrix-screensaver@cold-logic` ("Launch Test Preview").
  4. Commit. Background git hook auto-updates `graph.json`.

---

## 2. Structured ICM Pipeline (Roadmap Milestones & Architectural Changes)
* **When to use:** Multi-file roadmap goals (e.g. Lock screen overlay, Quick Settings tile, Audio-reactivity, EGO release).
* **Pipeline:**

| Stage | Name | Role / Tool | Action | Output Handoff |
| :--- | :--- | :--- | :--- | :--- |
| **01** | `01-spec` | **Antigravity** + `graphify` | Investigate GNOME/Mutter APIs, query dependencies, define schemas & architecture. | `.icm/stages/01-spec/output/SPEC.md` |
| **02** | `02-implementation` | **Antigravity** / **Devin** | Implement code against `SPEC.md`, run `./install.sh`. | `.icm/stages/02-implementation/output/CHANGELOG.md` |
| **03** | `03-audit-qa` | **Devin CLI** (`GLM-5.2-Max`) | Autonomous static code audit, leak detection, and nested sandbox verification (`./dev.sh`). | `.icm/stages/03-audit-qa/output/AUDIT_REPORT.md` |

---

## 3. Human Edit Surface
Between stages, the human developer can open and edit the stage's markdown output (e.g., modifying `SPEC.md` before implementation begins). The next agent strictly consumes the edited artifact as its working input.
