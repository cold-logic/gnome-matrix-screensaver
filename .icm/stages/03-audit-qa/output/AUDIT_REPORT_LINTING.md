# Stage 03: Audit & QA Report — GJS ESLint Flat Config & Code Quality Pipeline

**Auditor:** Devin CLI (GLM-5.2 High)
**Date:** 2026-09-02
**Scope:** `eslint.config.mjs`, `package.json`, `install.sh` quality gates, `.gitignore`
**Inputs:** `.icm/stages/01-spec/output/SPEC_LINTING.md`, `.icm/stages/02-implementation/output/CHANGELOG_LINTING.md`, `.icm/_config/standards.md`
**Verdict:** **PASS with advisory findings** — `bun run lint` exits cleanly with **0 errors, 0 warnings** across 7 files. The pipeline is production-ready; findings below are hardening recommendations, not blockers.

---

## 1. Verification Results

### 1.1 Lint Execution (Primary Gate)

| Check | Command | Result |
| :--- | :--- | :--- |
| Default lint | `bun run lint` | **EXIT 0**, no stdout |
| Max-warnings guard | `bun run lint -- --max-warnings=0` | **EXIT 0** |
| JSON formatter audit | `eslint . --format json` | **7 files, 0 errors, 0 warnings** |

Files actually linted (matches SPEC §2.1 target set):
- `extension.js`
- `prefs.js`
- `shell/quickSettings.js`
- `shell/atlasManager.js`
- `shell/shader.js`
- `shell/matrixScreensaver.js`
- (`test-prefs.js` correctly excluded via `ignores`)

**The "0 errors, 0 warnings" contract from SPEC §3.3 is satisfied.**

### 1.2 Dependency Installation

`bun install` resolves cleanly:
```
+ @eslint/js@10.0.1
+ eslint@10.9.1
+ globals@17.12.0
71 packages installed
```
Lockfile (`bun.lock`) generated and gitignored. No peer-dependency warnings.

### 1.3 Quality Gate (`install.sh`)

```bash
set -e
# ...
if command -v bun >/dev/null 2>&1; then
    echo "==> Running ESLint quality gates..."
    bun run lint
fi
```
- `set -e` ensures a lint failure **aborts the build** before schema compilation and zip packaging. Correct hard-fail behavior when `bun` is present.
- Gate runs **before** `glib-compile-schemas`, `cp`, and `gnome-extensions install` — correct ordering (fail fast, no partial install on lint break).

### 1.4 `.gitignore` Coverage

| Artifact | Ignored? | Notes |
| :--- | :---: | :--- |
| `node_modules/` | ✅ | |
| `bun.lock` / `bun.lockb` | ✅ | Both lockfile formats |
| `build/` | ✅ | Zip bundle output |
| `schemas/gschemas.compiled` | ✅ | Compiled schema binary |
| `graphify-out/` | ✅ | Tooling output |
| `graph.html` | ✅ | Tooling output |
| `*.log` | ✅ | Dev logs |
| `.eslintcache` | ❌ | Not ignored — see finding **L2** |

---

## 2. Findings

### Medium

#### M1. `globals` is a dead devDependency — declared but never imported

**File:** `package.json:14`, `eslint.config.mjs:10-18`
```json
"devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.9.1",
    "globals": "^17.12.0"   // ← never imported
}
```
`eslint.config.mjs` defines `languageOptions.globals` as an **inline object literal** and never imports the `globals` package:
```js
languageOptions: {
    globals: {
        global: 'readonly',
        _: 'readonly',
        // ...
    },
}
```
A `grep` for `from 'globals'` / `require('globals')` / `globals.` returns no matches. The package is installed but unused — pure dead weight (one transitive install path).

**Impact:** Minor supply-chain surface and install time; no functional impact. The inline approach is actually fine for a small GNOME extension, but then the dependency should be removed.

**Fix (choose one):**
- **Remove** `globals` from `devDependencies` (preferred — keeps the inline definition), or
- **Adopt** it: `import globals from 'globals';` and spread `globals.browser`/a curated subset, replacing the inline object. This is more idiomatic for larger configs but unnecessary at this scale.

---

#### M2. Spec deviation: `arrow-body-style` & `prefer-arrow-callback` not implemented

**Spec:** `SPEC_LINTING.md` §2.3 "Core Rules to Enforce" explicitly lists:
> - `arrow-body-style` & `prefer-arrow-callback`: Modern ES2024 style.

**Actual:** `eslint.config.mjs:20-37` does **not** declare either rule. A `grep` confirms both are absent.

**Impact:** The codebase happens to use arrow functions idiomatically today (so 0 violations either way), but the spec's promised enforcement is missing — a future contributor could introduce `function` callbacks or verbose arrow bodies without lint pushback.

**Fix:** Either add the rules to match the spec, or amend `SPEC_LINTING.md` to mark them as deferred/optional. Recommended addition:
```js
'arrow-body-style': ['error', 'as-needed'],
'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
```

---

### Low

#### L1. `install.sh` quality gate is a *soft* gate — silently skipped when `bun` is absent

**File:** `install.sh:11-14`
```bash
if command -v bun >/dev/null 2>&1; then
    echo "==> Running ESLint quality gates..."
    bun run lint
fi
```
If `bun` is not on `PATH`, the gate is skipped with **no warning and no failure**. A contributor without bun installed could ship a lint-breaking change via `./install.sh` without any signal.

**Impact:** Low — `bun` is a documented project prerequisite and the gate is primarily a local-dev safeguard. CI (if added) should be the authoritative gate.

**Fix (optional hardening):** Emit a visible notice when skipping, or fail loudly:
```bash
if command -v bun >/dev/null 2>&1; then
    echo "==> Running ESLint quality gates..."
    bun run lint
else
    echo "==> WARNING: bun not found — ESLint quality gate SKIPPED" >&2
fi
```

---

#### L2. `.eslintcache` not in `.gitignore`

**File:** `.gitignore`
No `.eslintcache` entry. The current config does not pass `--cache`, so no cache file is generated today. However, if a contributor enables `--cache` (a common perf optimization), the cache file would appear as an untracked file.

**Fix:** Add `.eslintcache` to `.gitignore` defensively:
```
.eslintcache
```

---

#### L3. Latent `no-console` warning risk against the "0 warnings" contract

**File:** `eslint.config.mjs:36`
```js
'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
```
The rule is set to **`warn`**, not `error`. Today the codebase only uses `console.error` and `console.warn` (both allowed) → 0 warnings. But the moment someone adds `console.info()`, `console.debug()`, or `console.trace()`, the "0 warnings" contract from SPEC §3.3 silently breaks while `bun run lint` still exits 0 (warnings don't fail the exit code by default).

This is a **latent trap**: the gate passes but the contract is violated.

**Fix (recommended):** Promote to `error` to make the contract self-enforcing, or add `--max-warnings=0` to the lint script:
```js
'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
```
or
```json
"lint": "eslint . --max-warnings=0"
```
The `--max-warnings=0` option is preferable — it generically protects the 0-warning contract for *any* future `warn`-level rule, not just `no-console`.

---

#### L4. Stale build artifact with legacy UUID

**File:** `build/matrix-screensaver@chris.shell-extension.zip`
Alongside the correct `build/matrix-screensaver@cold-logic.shell-extension.zip` there is a leftover zip using the old `@chris` UUID. `build/` is gitignored so this is not tracked, but it can confuse `gnome-extensions install` consumers if the wrong zip is hand-picked.

**Fix:** `rm build/matrix-screensaver@chris.shell-extension.zip` (one-off cleanup). Optionally, `install.sh` could clean `build/` before regenerating the zip to prevent recurrence.

---

## 3. Verified Correct

### Configuration Structure
- **Flat Config format:** Valid ESLint v10 flat config (array of config objects). `js.configs.recommended` applied globally, then project-specific rules, then ignores. Correct ordering.
- **`ecmaVersion: 2024` + `sourceType: 'module'`:** Matches the project's pure-ESM architecture (`"type": "module"` in `package.json`). Compliant with `standards.md`.
- **Globals:** `global`, `_`, `console`, `imports`, `TextDecoder`, `TextEncoder` all marked `readonly`. Prevents accidental reassignment of GNOME Shell / GJS runtime globals. Correct.

### Rule Selection (vs. GNOME GJS conventions)
- **`camelcase` with `^vfunc_`, `^_vfunc_`, `^on_`, `^_init` exemptions:** Correctly accommodates GObject virtual method naming and GTK signal handler conventions. Compliant with `AGENTS.md` lifecycle rules.
- **`no-unused-vars` with `^_` ignore patterns:** Standard GNOME extension convention for intentionally-unused args. Correct.
- **`no-undef`:** Prevents runtime `ReferenceError` crashes in GNOME Shell (which would take down the whole shell). Critical safety rule. Correct.
- **`eqeqeq: 'smart'`:** Allows `== null` for null/undefined checks while enforcing `===` elsewhere. Pragmatic. Correct.
- **`prefer-const` + `no-var`:** Modern immutable scoping. Correct.
- **`semi: 'always'` + `quotes: 'single'`:** Consistent with existing codebase style. Correct.

### Ignore Patterns
- `node_modules/`, `dist/`, `.icm/`, `graphify-out/`, `*.zip`, `test-prefs.js` — all appropriate exclusions. `test-prefs.js` is a standalone GJS test harness not subject to the extension's module rules. Correct.

### Script Integration
- `package.json` `"type": "module"` + `"lint"` / `"lint:fix"` scripts match SPEC §2 exactly. Correct.
- `install.sh` gate ordering (lint → schema compile → copy → zip → install) is correct fail-fast sequencing.

### SCM Hygiene
- `bun.lock` and `bun.lockb` both ignored (future-proof against lockfile format changes). Correct.
- Working copy is clean (`jj status` shows no uncommitted changes). The lint feature is committed at `a4f87ee5` on `master`.

---

## 4. Recommended Action Priority

| # | Severity | Finding | Effort |
| :---: | :---: | :--- | :--- |
| 1 | Medium | **M2** — Add `arrow-body-style` / `prefer-arrow-callback` or amend spec | 5 min |
| 2 | Medium | **M1** — Remove unused `globals` devDependency (or adopt it) | 2 min |
| 3 | Low | **L3** — Add `--max-warnings=0` to `lint` script (protects 0-warning contract) | 1 min |
| 4 | Low | **L1** — Emit warning when `bun` is absent in `install.sh` | 2 min |
| 5 | Low | **L2** — Add `.eslintcache` to `.gitignore` | 1 min |
| 6 | Low | **L4** — Delete stale `build/*@chris.shell-extension.zip` | 1 min |

**None of these block the lint pipeline.** The Stage 03 acceptance criterion — *"`bun run lint` exits cleanly with 0 warnings, 0 errors"* (SPEC §3.3)* — is **met**.

---

## 5. Stage 03 Sign-off

| Criterion | Status |
| :--- | :---: |
| `bun run lint` → 0 errors, 0 warnings | ✅ PASS |
| `eslint.config.mjs` valid ESLint v10 flat config | ✅ PASS |
| `package.json` scripts match SPEC §2 | ✅ PASS |
| `install.sh` enforces lint gate before build | ✅ PASS (soft gate — see L1) |
| `.gitignore` covers build/install artifacts | ✅ PASS (minor: `.eslintcache` — see L2) |
| GNOME 50+ GJS conventions enforced | ✅ PASS |
| No SCM regressions (clean working copy) | ✅ PASS |

**Audit Result: APPROVED** — pipeline meets the Stage 03 acceptance criteria. Apply the 6 advisory findings in a follow-up fast-path commit to harden the contract.
