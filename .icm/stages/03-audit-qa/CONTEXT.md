# Stage 03: Audit & QA Contract

## Role
Quality Assurance & Code Auditor (Devin CLI / GLM-5.2-Max)

## Inputs
- `.icm/stages/02-implementation/output/CHANGELOG.md`
- `.icm/_config/standards.md`
- `.icm/stages/01-spec/output/SPEC.md`

## Task
1. Run static audit via `devin -p --model glm-5-2-max` checking for leaks, types, and schema validity.
2. Launch `./dev.sh` to test in nested GNOME 50 Wayland sandbox.
3. Validate user interaction and live test preview.

## Outputs
- `output/AUDIT_REPORT.md`
