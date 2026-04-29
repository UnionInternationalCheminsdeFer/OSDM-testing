# DevOps Action Plan — OSDM Testing Suite (OTST)

> **Repository:** UnionInternationalCheminsdeFer/OSDM-testing  
> **Date:** 2026-04-29  
> **Branch:** copilot/analyze-test-coverage  

---

## 1. Executive Summary

The OSDM Testing Suite (OTST) is a Bruno-based API test collection for validating OSDM-compliant rail booking APIs (offers, bookings, fulfilments, refunds, exchanges). The codebase contains a rich set of business scenario definitions, a sophisticated JavaScript library (`library-bruno/`), data-driven scenario runners, and an HTML report generator.

**Key finding:** the suite is entirely executed manually or via ad-hoc CLI calls. There is **no CI/CD pipeline, no automated scheduling, no quality gate, and no unit-test layer** for the JavaScript library code. All of the following sections describe concrete actions to close these gaps.

---

## 2. Current State Assessment

### 2.1 What Is Already In Place

| Area | Status |
|---|---|
| Bruno API request collection (OTST_V2.0.1) | ✅ Implemented |
| After-response assertion scripts (per request) | ✅ Implemented |
| `bruTest` / `testCapture.js` test capture helper | ✅ Implemented |
| HTML report generation (`mergeReport.js`) | ✅ Implemented |
| Multi-scenario loop-back engine (`loopback.js`, `scenarioParser.js`) | ✅ Implemented |
| OpenAPI / AJV schema validation (`validators.js`) | ✅ Implemented (partially disabled) |
| Data files per partner (Benerail, Bileto, Paxone, Sqills, Turnit) | ✅ Present |
| Environment files per partner | ✅ Present |
| `.gitignore` excluding sensitive credentials | ✅ Present |
| GitHub Actions CI/CD pipeline | ❌ Missing |
| Scheduled/nightly test runs | ❌ Missing |
| Unit tests for `library-bruno/` JS modules | ❌ Missing |
| Contract / schema validation enforced in CI | ❌ Missing (commented-out in several requests) |
| Branch protection / required status checks | ❌ Not configured |
| Secret scanning / credential leak prevention | ❌ No automation |
| Test coverage tracking & reporting | ❌ Missing |
| Dependency vulnerability scanning | ❌ Missing |
| Linting for library JS files | ❌ Missing |

---

### 2.2 Test Coverage Analysis

#### Flows Covered by the Collection

| Flow | Requests | Assertions Present |
|---|---|---|
| Access Token (OAuth2 / password grant) | 5 requests | HTTP 200, token captured |
| System Info (version, coaches, place maps, categories, products, tags, zones) | 11 requests | HTTP 200, body structure |
| Offer Search (`POST /offers`) | 1 request + retry logic | Status, offer array, trip/leg/part validation |
| Create Booking (`POST /bookings`) | 1 request | Status, booking fields, offer-to-booking consistency |
| Patch Booking (multi-passenger) | 1 request | Status |
| Get Passenger / Booking | 3 requests | Status, fulfilment status |
| Obtain Fulfilments | 1 request | Status, fulfilment docs |
| Refund Offers — POST / GET / PATCH / DELETE | 6 requests | Status, refundOffer array, fees, overrule codes |
| Exchange Offers — POST / GET / POST operations / DELETE | 8 requests | Status, exchangeOffer array, fees |

#### Identified Coverage Gaps

**A. Missing API paths / verbs**

| Missing Coverage | Impact |
|---|---|
| `PATCH /bookings/{id}` (single-passenger or seat selection only) | Partial — only multi-passenger path tested |
| `DELETE /bookings/{id}` (cancel before fulfilment) | Not tested |
| `GET /offers` (if supported by spec) | Not tested |
| Error paths (4xx / 5xx responses) | Not tested — all scenarios assume 200 |
| Pagination parameters on listing endpoints | Not tested |
| `POST /offers` with `tripSpecification` model (only `searchCriteria` used by most data files) | Partially tested (only in trip-spec scenarios of some partners) |
| Ancillary-only offers / reservations-only offers | Not consistently tested across all partners |
| Concurrent booking conflicts (race conditions) | Not tested |

**B. Assertion depth gaps**

| Area | Gap |
|---|---|
| OpenAPI schema validation | `swaggerSchemaValidatorContent()` is commented out in `POST Get Offer` and other steps — schema compliance is **not enforced** during runs |
| Refund fee amount correctness | Amount validated as ≥ 0 but not cross-checked against after-sales conditions (the `validateRefundFeesConsistentWithAfterSalesConditions` analogue exists for exchanges but not refunds) |
| Fulfilment document format | Document type validated, byte content not verified |
| Booking state machine | Transitions (CONFIRMED → FULFILLED → REFUNDING) not checked end-to-end within a single assertion chain |
| HTTP headers in responses | `Content-Type` and `version` header not validated on responses |

**C. No unit tests for library JavaScript**

All business logic lives in `library-bruno/*.js` (≈ 18 files, thousands of lines). None of these files have standalone unit tests. Regressions in helpers such as `scenarioParser.js`, `reportGenerator.js`, `offers.js`, `refunds.js`, or `exchanges.js` are only detectable by running a full Bruno collection against a live server.

**D. Data file coverage**

Each partner has a single JSON data file. Coverage per partner varies:

| Partner | Refund (PATCH) | Refund (DEL) | 2-ADT | 2-LEG | Exchange | Trip-Spec |
|---|---|---|---|---|---|---|
| Benerail | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Bileto | ✅ | ✅ | ? | ? | ✅ | ? |
| Paxone | ✅ | ? | ? | ? | ? | ? |
| Sqills | ✅ | ? | ? | ? | ? | ? |
| Turnit | ✅ | ? | ? | ? | ? | ? |

(Gaps marked `?` were not inspectable without full data files — a baseline audit is needed.)

---

## 3. DevOps Action Plan

The plan is organised into five epics, each split into incremental actions.

---

### Epic 1 — CI/CD Pipeline (Priority: HIGH)

**Goal:** Run the Bruno collection automatically on every pull request and on a nightly schedule against at least one sandbox environment.

#### Action 1.1 — Create a GitHub Actions workflow for smoke testing

Create `.github/workflows/smoke-test.yml`:

```yaml
name: OTST Smoke Test

on:
  pull_request:
    branches: [main, master, exchange-dev]
  schedule:
    - cron: "0 3 * * *"   # nightly at 03:00 UTC
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment name"
        required: true
        default: "OTST_Benerail_Env"

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Bruno CLI
        run: npm install -g @usebruno/cli

      - name: Run collection
        env:
          OSDM_ACCESS_TOKEN: ${{ secrets.OSDM_ACCESS_TOKEN }}
          OSDM_API_BASE: ${{ secrets.OSDM_API_BASE }}
        run: |
          bru run collections-bruno/OTST_V2.0.1 \
            --env OTST_Benerail_Env \
            --sandbox developer \
            --reporter-json Validation_Reports/.bru_results.json \
            --bail

      - name: Generate HTML Report
        if: always()
        run: node collections-bruno/OTST_V2.0.1/library-bruno/mergeReport.js OTST_Benerail_Env

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: otst-report-${{ github.run_id }}
          path: collections-bruno/OTST_V2.0.1/Validation_Reports/*.html
```

**Secrets required in GitHub Settings → Secrets:**
- `OSDM_ACCESS_TOKEN` — pre-generated bearer token for the CI sandbox
- `OSDM_API_BASE` — base URL of the OSDM sandbox
- (Optional) `OSDM_CLIENT_ID` / `OSDM_CLIENT_SECRET` for token refresh

#### Action 1.2 — Inject secrets into the environment file at runtime

Because environment files are YAML and may be checked in (with placeholders), add a pre-run step that patches the file:

```yaml
- name: Patch environment variables
  run: |
    sed -i "s|__CI_ACCESS_TOKEN__|$OSDM_ACCESS_TOKEN|g" \
      collections-bruno/OTST_V2.0.1/environments/OTST_Benerail_Env.yml
    sed -i "s|__CI_API_BASE__|$OSDM_API_BASE|g" \
      collections-bruno/OTST_V2.0.1/environments/OTST_Benerail_Env.yml
```

Replace placeholder strings (`__CI_ACCESS_TOKEN__`, `__CI_API_BASE__`) in the committed environment file with actual CI secrets at run-time, so no credentials are ever stored in the repository.

#### Action 1.3 — Add a quality gate (fail the PR if assertions fail)

Use `--bail` flag (already shown in Action 1.1) so Bruno exits non-zero on any failed test, causing the GitHub Actions job to fail and blocking the merge.

#### Action 1.4 — Matrix strategy for multi-partner runs

Extend the workflow to a matrix build when running nightly:

```yaml
strategy:
  fail-fast: false
  matrix:
    env: [OTST_Benerail_Env, OTST_Bileto_Env, OTST_Sqills_Env]
```

---

### Epic 2 — Unit Tests for Library JavaScript (Priority: HIGH)

**Goal:** Protect the `library-bruno/` business logic with fast, offline unit tests that do not require a live OSDM server.

#### Action 2.1 — Bootstrap a Jest test suite

Create `library-bruno/package.json` (or a root-level `package.json`) with:

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "chai": "^4.0.0"
  },
  "scripts": {
    "test": "jest --coverage"
  }
}
```

#### Action 2.2 — Write unit tests for each library module

Priority order (highest complexity / highest risk first):

| Module | Tests to Write |
|---|---|
| `scenarioParser.js` | `getScenarioData()` returns correct scenario from JSON, `resetScenarioEnvVars()` clears all env vars, index advancement logic |
| `reportGenerator.js` | `initReport()` creates the correct structure, HTML is well-formed, report accumulates request data per step |
| `offers.js` | `postOfferResponse()` parses offer arrays, `validateOfferParts()` checks admission/reservation counts, `ensureAuthorizationOr403()` reads env vars correctly |
| `refunds.js` | `validateRefundOfferResponse()` checks required fields, fee validation logic |
| `exchanges.js` | `validateExchangeFeesConsistentWithAfterSalesConditions()` |
| `loopback.js` | `loopbackOrStop()` routes correctly when scenario list is non-empty vs empty |
| `validators.js` | `swaggerSchemaValidator()` validates a known good/bad request against a minimal fixture schema |
| `testCapture.js` | `bruTest()` registers pass/fail, `resetTests()` clears accumulator |
| `mergeReport.js` | Unit test the HTML-generation helpers (`esc()`, `prettyJson()`, `maskHeaderValue()`, `headerTable()`, `statusBadge()`) |

#### Action 2.3 — Integrate unit tests into CI

Add a job in the GitHub Actions workflow that runs before the API test job:

```yaml
unit-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci
    - run: npm test -- --coverage --ci
    - uses: actions/upload-artifact@v4
      with:
        name: unit-coverage
        path: coverage/
```

---

### Epic 3 — Schema / Contract Validation (Priority: MEDIUM)

**Goal:** Enforce OSDM OpenAPI schema compliance on every request and response automatically.

#### Action 3.1 — Re-enable and fix `swaggerSchemaValidatorContent()`

The call `swaggerSchemaValidatorContent()` is commented out in `01. POST Get Offer.yml` (line 118) and likely in other steps. Investigate why it was disabled (AJV loading failures in CI sandbox) and fix the root cause:

- If the AJV script is loaded from a remote URL (`ajvMinified` env var), bundle it locally in `library-bruno/ajv.min.js` and reference it from a `file://` path so CI does not need external internet access.
- Once stable, uncomment the call in all relevant request `.yml` files.

#### Action 3.2 — Add OpenAPI diff check on schema changes

If the OSDM OpenAPI spec (`openapi3_0.json` in `json_validator/`) is updated, run a diff report to identify breaking changes:

```yaml
- name: OpenAPI diff
  uses: swaggerexpert/swagger-diff-action@v1
  with:
    base: main:json_validator/openapi3_0.json
    revision: ${{ github.sha }}:json_validator/openapi3_0.json
```

#### Action 3.3 — JSON data file schema validation in CI

`validators.js` already implements `validateDataFileJsonWithTemplate()`. Wire it into a pre-flight CI step that validates all `data_base/*.json` files against `json_validator/datafile.schema.json` before the Bruno run:

```bash
node -e "
const { validateDataFileJsonWithTemplate } = require('./collections-bruno/OTST_V2.0.1/library-bruno/validators.js');
const files = require('fs').readdirSync('./collections-bruno/OTST_V2.0.1/data_base').filter(f => f.endsWith('.json'));
files.forEach(f => {
  const data = require('./collections-bruno/OTST_V2.0.1/data_base/' + f);
  validateDataFileJsonWithTemplate(data);
});
"
```

---

### Epic 4 — Security & Credential Hygiene (Priority: HIGH)

**Goal:** Prevent secrets from leaking into the repository and detect existing leaks.

#### Action 4.1 — Add `gitleaks` pre-commit hook and CI scan

Add `.github/workflows/secret-scan.yml`:

```yaml
name: Secret Scan
on: [push, pull_request]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Action 4.2 — Audit existing environment files for hardcoded credentials

Run a one-time audit:

```bash
grep -r "client_secret\|access_token\|password\|Bearer " \
  collections-bruno/OTST_V2.0.1/environments/ --include="*.yml"
```

Replace any literal values found with the placeholder pattern (`__CI_ACCESS_TOKEN__` etc.) and update `.gitignore` to exclude the patched files from accidental commit.

#### Action 4.3 — Enable GitHub Secret Scanning

In repository Settings → Security → Secret scanning: enable **Secret scanning** and **Push protection**. This blocks any push that contains a known secret pattern (API keys, tokens, etc.).

#### Action 4.4 — Separate CI credentials from developer credentials

Create a dedicated CI service account / OAuth client with read-only sandbox access. CI secrets should never be the same credentials used by human testers.

---

### Epic 5 — Code Quality & Maintenance (Priority: MEDIUM)

**Goal:** Enforce consistent code style, catch regressions early, and keep dependencies up to date.

#### Action 5.1 — Add ESLint for `library-bruno/` JavaScript

Create `.eslintrc.json`:

```json
{
  "env": { "node": true, "es2020": true },
  "extends": "eslint:recommended",
  "rules": {
    "no-unused-vars": "warn",
    "no-undef": "off"
  }
}
```

Add lint step to CI:

```yaml
- run: npx eslint collections-bruno/OTST_V2.0.1/library-bruno/
```

Known issues to fix first:
- `validationLogger` is called in multiple files but defined globally (in `displays.js`) and not imported explicitly — this causes `no-undef` warnings.
- `GV.ACCESS_TOKEN` in `validators.js` is never imported.

#### Action 5.2 — Dependabot for `package.json` and GitHub Actions

Add `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

#### Action 5.3 — Branch protection rules

In GitHub Settings → Branches, protect `main`/`master` and `exchange-dev`:

- Require at least 1 PR review
- Require status checks: `smoke-test`, `unit-test`, `secret-scan`
- Require branches to be up to date before merging
- Disallow force-push

#### Action 5.4 — Standardise the `test()` vs `bruTest()` inconsistency

Several `.yml` files (e.g., `03-Refund/10. POST Refund Offers.yml`) still call the raw `test()` function directly instead of using the `bruTest()` wrapper from `testCapture.js`. This means those assertions are not captured in the HTML report. Replace all direct `test()` calls with `bruTest()` across all `.yml` request files.

---

## 4. Prioritised Backlog (Summary)

| # | Action | Priority | Effort | Value |
|---|---|---|---|---|
| 1.1 | GitHub Actions CI workflow | 🔴 HIGH | M | Automated regression detection |
| 1.3 | Quality gate on PR merges | 🔴 HIGH | S | Blocks broken code |
| 4.1 | Secret scanning (gitleaks) | 🔴 HIGH | S | Prevents credential leaks |
| 4.3 | GitHub Secret Scanning | 🔴 HIGH | S (settings) | Platform-native protection |
| 2.1–2.3 | Unit tests for library JS | 🔴 HIGH | L | Offline, fast regression safety |
| 1.2 | Runtime secret injection | 🔴 HIGH | S | Required for Action 1.1 |
| 3.1 | Re-enable schema validation | 🟠 MEDIUM | M | Enforces OSDM contract |
| 3.3 | Data file validation in CI | 🟠 MEDIUM | S | Catches data errors before runs |
| 5.3 | Branch protection | 🟠 MEDIUM | S | Governance |
| 5.4 | Standardise `bruTest()` usage | 🟠 MEDIUM | M | Complete report coverage |
| 1.4 | Multi-partner matrix | 🟡 LOW | S | Broader coverage |
| 3.2 | OpenAPI diff check | 🟡 LOW | S | Early breaking-change detection |
| 5.1 | ESLint for library JS | 🟡 LOW | M | Code quality |
| 5.2 | Dependabot | 🟡 LOW | S | Dependency hygiene |
| 4.2 | Credential audit | 🟡 LOW | S | One-time hardening |

---

## 5. Additional Test Coverage Recommendations

Beyond CI/CD infrastructure, the following test scenarios should be added to the Bruno collection to achieve comprehensive OSDM API coverage:

1. **Negative / error path testing** — Add a dedicated folder `05-Error Scenarios/` with requests that deliberately send invalid payloads and assert 4xx status codes and `problems[]` arrays.
2. **Cancel booking flow** — Add `DELETE /bookings/{id}` step after booking creation (before fulfilment) to cover the cancel-before-fulfilment path.
3. **Seat selection flow** — Add a dedicated scenario using `requiresPlaceSelection=true` that exercises `GET /place-maps` and the place-selection PATCH.
4. **Multi-leg / multi-passenger exchange** — Currently only 1-adult 1-leg exchange is broadly tested. Add 2-adult and 2-leg exchange scenarios across all partners.
5. **Cross-partner scenarios** — Add scenarios where the requestor and the allocator use different partner data files, exercising interoperability.
6. **OSDM version matrix** — Add scenarios pinned to older OSDM versions (e.g., 3.3, 3.4) to verify backward compatibility.

---

## 6. Success Metrics

| Metric | Target |
|---|---|
| CI pipeline pass rate (main branch) | ≥ 95% |
| Unit test coverage (library-bruno/) | ≥ 80% line coverage |
| Scenarios with schema validation enabled | 100% of OSDM steps |
| Open security alerts (secret scanning) | 0 |
| Average PR feedback time (CI) | < 10 minutes |
| Partners with full scenario matrix (all flow types) | 5/5 |

---

*Document generated by GitHub Copilot Coding Agent — OSDM Testing Suite DevOps Analysis.*
