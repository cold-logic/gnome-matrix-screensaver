---
trigger: always_on
description: Opinionated SCM preference for Jujutsu (jj) over Git, along with Graphify and ICM rules.
---

# Project SCM & Workflow Standards

## 1. Opinionated SCM Preference: Jujutsu (`jj`)
This repository is configured as a colocated **Jujutsu (`jj`)** repository backed by Git:
- **Default to `jj`:** Always prefer `jj` CLI commands over `git` for version control, commit authoring, diff inspection, branching, and rebasing.
- **Key Commands:**
  - Status: `jj --no-pager status`
  - Diff: `jj --no-pager diff`
  - Log: `jj --no-pager log -n 5`
  - Describe/Commit: `jj describe -m "commit message"`
  - New revision: `jj new`
  - Git sync: `jj git push` / `jj git fetch`
- **Fallback:** Use `git` only if a tool specifically requires raw git commands or git hooks execution.

## 2. Codebase Topology & Navigation (Graphify)
- When querying architecture, symbol relationships, or dependency call trees, first check `graphify query "<question>"` or `graphify path "<A>" "<B>"`.
- Run `graphify update .` after making code changes.

## 3. Hybrid Development Model (Fast-Path vs. Lightweight ICM)
- **Fast-Path (Small fixes, shader tweaks, single-file edits):** Edit directly, recompile schemas via `./install.sh`, test, and describe with `jj describe -m "..."`.
- **Lightweight ICM (Roadmap Milestones & Architectural features):** Use the 3-stage pipeline in `.icm/`:
  - **Stage 01 (`01-spec`):** Scoped `SPEC.md`
  - **Stage 02 (`02-implementation`):** Implementation and `CHANGELOG.md`
  - **Stage 03 (`03-audit-qa`):** Autonomous audit via Devin CLI (`GLM-5.2-Max`) and nested shell verification (`./dev.sh`).
