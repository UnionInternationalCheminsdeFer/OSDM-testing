# VS Review Report - OTST_V2.0.1

Date: 2026-04-02
Scope: Audit of Bruno OSDM test workspace with focus on runtime scripts and data consistency.

## Executive Summary
The workspace is generally well-structured and modular, but several reliability and maintainability risks can lead to fragile executions or misleading test outcomes. The highest risks are:
- hardcoded machine-specific path in test runner
- dynamic code execution with `eval` for AJV loading
- duplicated JSON key that silently overrides configuration

## Findings

### 1. High - Hardcoded user-specific PATH entry in PowerShell runner
- File: run_tests.ps1
- Evidence: PATH is appended with `C:\Users\PCadmin\AppData\Roaming\npm`.
- Why it matters: On any machine where the Windows username is not `PCadmin`, Bruno CLI may not be discovered, causing run failures.
- Recommendation:
  - Resolve CLI via `Get-Command bru` or derive npm global bin from environment.
  - Fail fast with clear error when Bruno is unavailable.

### 2. High - Duplicate JSON key causes silent config override
- File: data_base/benerail_datafile.json
- Evidence: `scenariosToRun` appears twice at the top of the same object.
- Why it matters: In JSON objects, the last duplicate key wins. The first list is silently ignored, which can produce unexpected scenario selection.
- Recommendation:
  - Keep only one `scenariosToRun` key.
  - Optionally validate data files for duplicate keys before execution.

### 3. High - Runtime `eval` used to inject AJV script
- File: library-bruno/validators.js
- Evidence: `eval(scriptContent); // defines Ajv`
- Why it matters: `eval` increases attack surface and can execute arbitrary code if source is tampered. It is also harder to debug and maintain.
- Recommendation:
  - Prefer a pinned local dependency (`require('ajv')`) where possible.
  - If remote loading is required, validate source integrity (checksum/signature) and execute in constrained context.

### 4. Medium - Date offset is hardcoded to 10 days
- File: library-bruno/scenarioParser.js
- Evidence: `const plusDays = 10;` while env-driven line is commented out.
- Why it matters: Test schedules become rigid and environment setting `departureDateFromToday` is effectively ignored.
- Recommendation:
  - Restore env-driven behavior and fallback to default:
  - `const plusDays = parseInt(bru.getEnvVar("departureDateFromToday"), 10) || 10;`

### 5. Medium - Schema validation fallback points to non-existent function name
- File: library-bruno/scenarioParser.js
- Evidence: checks `validators.validateJsonWithTemplate`, while validators exports `validateDataFileJsonWithTemplate`.
- Why it matters: If global function binding is unavailable, intended validation fallback is skipped silently.
- Recommendation:
  - Align function name in fallback to exported symbol:
  - `validators.validateDataFileJsonWithTemplate(...)`

### 6. Medium - Inconsistent scenario control fields in data files
- Files: data_base/*.json (multiple)
- Evidence:
  - `scenarioAction` is empty for several REFUND/EXCHANGE scenarios.
  - `refundDate` uses mixed representations (`""`, `"null"`, missing).
- Why it matters: Empty or mixed semantics increase branching ambiguity and can cause inconsistent request payload generation.
- Recommendation:
  - Define canonical policy:
    - Use JSON `null` (not string `"null"`) or omit field consistently.
    - Use explicit allowed values for `scenarioAction` (e.g., `PATCH`, `DELETE`, `NONE`).
  - Add schema constraints for these fields.

### 7. Medium - Unprotected JSON parsing from env vars in request builders
- File: library-bruno/requestsBuilder.js
- Evidence: multiple direct `JSON.parse(bru.getEnvVar(...))` calls without guards.
- Why it matters: Any malformed/empty env value throws and can abort execution mid-flow.
- Recommendation:
  - Centralize safe parsing utility with fallback/default and contextual error logging.
  - Fail with explicit message showing which env var is invalid.

### 8. Medium - Report generation write path lacks guarded error handling
- File: library-bruno/mergeReport.js
- Evidence: report write uses `fs.writeFileSync(...)` without try/catch around final write block.
- Why it matters: Permission/disk/path errors can terminate report generation without structured remediation guidance.
- Recommendation:
  - Wrap final directory creation and write operations in `try/catch`.
  - Emit actionable error output including target path.

### 9. Low - Placeholder schema object left empty
- File: library-bruno/schema.js
- Evidence: `OSDM_OFFER_SCHEMA: ""`
- Why it matters: Creates confusion whether schema-based checks are active; may mislead maintainers.
- Recommendation:
  - Either provide actual schema content/reference or remove/deprecate this placeholder.

### 10. Low - Legacy version labels in scenario data
- Files: data_base/benerail_datafile.json, data_base/bileto_datafile.json (and similar)
- Evidence: many scenarios still declare `collection: "OTST_V1.4.7_RFND_EXCH_ALL"` while workspace is `OTST_V2.0.1`.
- Why it matters: Not a direct runtime failure, but increases confusion during audits and regression tracking.
- Recommendation:
  - Normalize collection/version metadata to current workspace naming.

## Positive Observations
- `library-bruno` is modularized by domain (offers, bookings, refunds, exchanges, reporting).
- Logging is consistently used, making debugging easier.
- The reporting pipeline merges assertions and request/response artifacts into a useful HTML output.

## Suggested Priority Plan
1. Fix runner portability and JSON duplicate key issue first.
2. Remove/restrict `eval` usage and harden schema/data validation fallback.
3. Normalize scenario data conventions (`scenarioAction`, `refundDate`, metadata fields).
4. Add safe parse helpers and defensive file I/O guards.

## Optional Enhancements
- Add a lightweight preflight validator script to check data files for:
  - duplicate keys
  - invalid enum values
  - required field consistency
- Add CI step to run preflight before executing Bruno collection.
