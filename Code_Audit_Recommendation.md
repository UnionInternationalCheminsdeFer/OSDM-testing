# Code Audit — OTST Bruno Collection Library
## Action Plan & Recommendations

> **Repository:** UnionInternationalCheminsdeFer/OSDM-testing  
> **Scope:** `collections-bruno/OTST_V2.0.1/library-bruno/` (18 files, 6 255 lines of JavaScript)  
> **Date:** 2026-04-29  
> **Auditor:** GitHub Copilot Coding Agent  

---

## Executive Summary

The `library-bruno/` JavaScript codebase drives the entire OTST validation engine. It is generally well-intentioned and follows sensible naming conventions, but a full reading reveals concrete issues in three areas:

| Area | Severity | Issues found |
|---|---|---|
| **Maintainability** | 🟠 Medium–High | 14 distinct findings |
| **Performance** | 🟡 Medium | 7 distinct findings |
| **Security** | 🔴 High | 8 distinct findings |

The most urgent items are the `new Function(scriptContent)` eval-equivalent in `validators.js` (arbitrary code execution risk) and the O(n²) `bru.setEnvVar` pattern inside per-part loops (degrades with large offers).

---

## 1. Code Maintainability

### 1.1 Module Size — `offers.js` and `scenarioParser.js` are too large

| File | Lines |
|---|---|
| `offers.js` | 1 222 |
| `scenarioParser.js` | 833 |
| `reportGenerator.js` | 710 |
| `bookings.js` | 551 |
| `displays.js` | 424 |
| `mergeReport.js` | 412 |
| `validators.js` | 406 |

**Finding:** `offers.js` (1 222 lines) contains at least six distinct logical concerns: response pre-request, offer selection, summary validation, passenger validation, trip/leg validation, and admission/reservation/ancillary validation. It is difficult to navigate and has a high cognitive load per review.

**Recommendation:** Split `offers.js` into smaller, purpose-focused modules:
- `offerSelector.js` — `selectAndSetOffer`, `handleAccommodationAndPlaceSelection`
- `offerSummaryValidator.js` — `validateOfferSummary`, `validateOfferParts`
- `offerPartsValidator.js` — `validateAdmissions`, `validateReservations`, `validateAncillaries`
- `tripValidator.js` — `validateTripsAndLegs`, `getTripLegCoverage`
- Keep `offers.js` as a thin façade that re-exports from the above

Apply the same split to `scenarioParser.js`: separate `parseScenarioData` / `setSystemInfoParameters` from `osdmTripSearchCriteria` / `osdmTripSpecification`.

---

### 1.2 Duplicate `afterSalesConditions` Summing Loop (Triple Copy)

**File:** `exchanges.js`, lines 217–265  
**Finding:** The body of the loop that sums `afterSaleFee.amount` for a given `condition.condition` type is copy-pasted three times — once for `admissionOfferParts`, once for `reservationOfferParts`, once for `ancillaryOfferParts`. All three copies read `bru.getEnvVar("scenarioType")` and perform the same `includes("REFUND")` / `includes("EXCHANGE")` branching inside each nested `forEach`.

```js
// ❌ Three copies of identical logic
admissionOfferParts.forEach((admission, admIndex) => {
  admission.afterSalesConditions.forEach((condition, condIndex) => {
    const scenarioType = bru.getEnvVar("scenarioType") || "";
    if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
      totalAfterSalesFee += condition.afterSaleFee.amount;
    } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
      totalAfterSalesFee += condition.afterSaleFee.amount;
    }
  });
});
// same block for reservationOfferParts …
// same block for ancillaryOfferParts …
```

**Recommendation:** Extract a single helper:

```js
// ✅ One helper called three times
function sumAfterSalesFeeForScenario(parts, scenarioType) {
  return (parts || []).reduce((sum, part) => {
    return sum + (part.afterSalesConditions || []).reduce((s, cond) => {
      if (!cond.afterSaleFee || cond.afterSaleFee.amount == null) return s;
      const match =
        (scenarioType.includes("REFUND")   && cond.condition === "REFUND") ||
        (scenarioType.includes("EXCHANGE") && cond.condition === "EXCHANGE");
      return match ? s + cond.afterSaleFee.amount : s;
    }, 0);
  }, 0);
}
```

The same summing pattern is also partially repeated in `offers.js` inside `validateAdmissions`. Apply the same fix.

---

### 1.3 Inline Passenger-Type List Duplicated in `offers.js:461`

**Finding:** `osdmEnums.js` provides `OSDM_PASSENGER_TYPES` as the canonical list (correctly imported and used in `appliedPassengerTypes` validation at line 723). However, line 461 of `offers.js` still uses a hand-written inline `oneOf([...])` list in `validatePassengers`. The comment on line 718 even describes a previous incorrect 6-value list, but the `validatePassengers` function still has its own 20-value inline copy — it could drift again.

```js
// ❌ Inline list at offers.js:461 (will drift)
expect(p.type).to.be.oneOf(["YOUNG_CHILD", "CHILD", … "TRAILER"]);

// ✅ Already correct at offers.js:723
expect(apt.type, …).to.be.oneOf(OSDM_PASSENGER_TYPES);
```

**Recommendation:** Replace the inline list at line 461 with `OSDM_PASSENGER_TYPES` (already imported at line 5).

---

### 1.4 `globalThis` Pollution in Every Module (13 of 18 files)

**Finding:** Every module contains a try/catch at the bottom that dumps all exports into the global scope:

```js
try {
  Object.assign(globalThis, module.exports);
} catch (e) { /* no-op */ }
```

This was added to support scripts that call functions like `checkWarningsAndProblems()` or `validateFulfillments()` without an explicit `require`. The effect is that all 100+ functions are global, making it impossible to trace which module a function came from, and creating a risk of name shadowing.

**Concrete evidence of shadowing right now:**
- `validatePassengers` is defined in both `offers.js` (line 441, takes `jsonData`) and `fulfillments.js` (line 43, takes `booking, offer`). Whichever module is loaded last wins. The behaviour is non-deterministic.
- `checkWarningsAndProblems` is defined in `offers.js` but called in `refunds.js` and `exchanges.js` without an import — relying entirely on global pollution.
- `validateFulfillments` is defined in `bookings.js` but called in `refunds.js` and `exchanges.js` — same issue.

**Recommendation:**
1. Add explicit `require` for every cross-module dependency (e.g. `const { checkWarningsAndProblems } = require('./offers.js');` at the top of `refunds.js` and `exchanges.js`).
2. Remove the `Object.assign(globalThis, …)` blocks from all modules.
3. Rename the colliding `validatePassengers` functions to clearly distinct names (`validateOfferPassengers` in `offers.js`, `validateBookingPassengers` in `fulfillments.js`).

---

### 1.5 `validationLogger` Called Without Import in Several Files

**Finding:** `refunds.js`, `exchanges.js`, `fulfillments.js`, and `requestsBuilder.js` all call `validationLogger(…)` at the top of the file — but the first line imports from `displays.js` without destructuring it:

```js
// ❌ refunds.js:1 — imports module but never reads validationLogger from it
const display = require('./displays.js');
// validationLogger then works only because globalThis pollution put it there
```

`offers.js` does the same:
```js
const display = require('./displays.js');  // display is never used directly
```

**Recommendation:** Use a destructured import everywhere:
```js
const { validationLogger } = require('./displays.js');
```

---

### 1.6 `swagger.js` Is an Empty File (0 bytes)

**Finding:** `swagger.js` contains no code. It is `require`-able but exports nothing. The name implies it was once the home for Swagger validation logic (now in `validators.js`).

**Recommendation:** Delete `swagger.js` or document its intended future purpose. Its presence misleads contributors.

---

### 1.7 `schema.js` Contains a Stub That Is Never Used

**Finding:** `schema.js` exports `{ schemaData: { OSDM_OFFER_SCHEMA: "" } }` — an empty string. No file imports `schemaData`. The module is vestigial.

**Recommendation:** Remove `schema.js` or populate `OSDM_OFFER_SCHEMA` with the actual schema string. Add an import to `validators.js` if the schema is meant to be used for validation.

---

### 1.8 Partner-Specific Hacks Hard-Coded in Business Logic

**Finding:** `requestsBuilder.js` and `scenarioParser.js` contain URL string matching to activate partner-specific behaviors:

```js
// requestsBuilder.js:15
const isPaxone = sandbox.includes("paxone");

// requestsBuilder.js:71
if (!sandbox.includes("paxone")) { body.externalRef = "00001"; }

// scenarioParser.js:685
if (_apiBase.includes("bileto")) {
  // Bileto exception — TripSearchCriteria uses OffsetDateTime
```

If a URL contains "paxone" or "bileto" as a coincidental substring, the wrong branch executes. Comments in `exchanges.js:38` even reference a specific partner's internal JSON file name: `"using 11_turnit_exchange.json structure"`.

**Recommendation:** Introduce an explicit, structured `partnerProfile` field in the environment file (e.g., `partner: PAXONE`) and replace all `sandbox.includes("paxone")` checks with `bru.getEnvVar("partner") === "PAXONE"`. Document each partner deviation in a dedicated section of the environment file or README.

---

### 1.9 Mixed `var` / `let` / `const` Style in `model.js`

**Finding:** `model.js` defines all classes using `var ClassName = class { … }` syntax. The rest of the codebase uses `const` and `class`. Additionally, `model.js` mixes `var`, `const`, and `class` syntax inconsistently:

```js
var GV = { … };          // var
const exported = { … };   // const
class Contact { … }       // ES6 class but mixed with var-class below
var FulfillmentOption = class { … };  // var + anonymous class
```

**Recommendation:** Standardise on `class` declarations and `const` assignments throughout `model.js`. Use ES2020 syntax consistently across all modules.

---

### 1.10 `displayBookingResponse` and `displayFulFilledBooking` Are ~70% Duplicate

**Finding:** Both functions in `displays.js` iterate trips, legs, passengers, bookedOffers, and fulfillments with nearly identical log statements. The only differences are in how `provisionalPrice` vs `confirmedPrice` are handled.

**Recommendation:** Extract a single `_displayBookingCore(booking)` helper and have both public functions call it, passing optional flags for the price fields they want to display.

---

### 1.11 `fulfillments.js::validatePrices` Uses a Different Env Var Key Than `bookings.js`

**Finding:**  
- `bookings.js` writes: `bru.setEnvVar("provisionalPriceAmount", prov.amount)`  
- `fulfillments.js` reads: `bru.getEnvVar("provisionalPrice")`

These are **different keys**. `fulfillments.js::validatePrices` reads a key that is only ever written by itself (within the `else` branch), never by `bookings.js`. This means the `provisionalPrice` comparison in `validatePrices` always compares the fulfillment module's own stored value against itself, not the booking's provisional price. The cross-step validation is silently broken.

**Recommendation:** Align the key names. `validatePrices` should read `bru.getEnvVar("provisionalPriceAmount")` to use the value stored by `bookings.js`.

---

### 1.12 Missing Documentation — No JSDoc on Most Public Functions

**Finding:** Of 18 modules, only `testCapture.js` and `reportGenerator.js` have JSDoc comments on their exported functions. None of the domain modules (`offers.js`, `bookings.js`, `refunds.js`, `exchanges.js`) have docstrings explaining what parameters are expected, what env vars they read/write, or what OSDM spec versions they target.

The only specification references are inline comments like `// A1/A3/A4: Per-offer mandatory field assertions (OSDM v3.8 spec)` — useful, but not in a format that tools or IDE hover-help can surface.

**Recommendation:** Add a JSDoc block to every exported function covering at minimum:
- `@param` types and descriptions
- `@returns` description
- `@sideEffects` listing which env vars are read and written
- `@osdm` OSDM spec field or requirement reference

Example:
```js
/**
 * Validates the POST /offers response and selects the best matching offer.
 * @param {object} jsonData - Parsed Bruno response body
 * @sideEffects Reads: desiredFlexibility, accommodationSelection, scenarioType
 * @sideEffects Writes: offer, offerId, offers, offerCurrency, coveredTripId
 * @osdm OSDM v3.8 § Offer, OfferSummary, AnonymousPassengerSpecification
 */
function postOfferResponse(jsonData) { … }
```

---

### 1.13 `opencollection.yml` Delete-List Must Stay in Sync with `scenarioParser.js`

**Finding:** The comment on `resetScenarioEnvVars` in `scenarioParser.js:27` explicitly states it **"Must stay in sync with the _deleteList in opencollection.yml"**. There is no automated check for this synchronisation. If a new env var is introduced in a library function, it may be cleared in one place but not the other, causing ghost values to persist across scenarios.

**Recommendation:** Either:
- Move the canonical list to a shared JSON file imported by both, or
- Add a lint/test step that diffs both lists and fails if they diverge.

---

### 1.14 No Module-Level File Header or Architecture Map

**Finding:** There is no top-level `ARCHITECTURE.md` or header comment in any module explaining:
- The module's role in the request lifecycle (pre-request / after-response)
- Its dependencies on other modules
- Which request files call it

New contributors must trace every `require()` and read every `.yml` to understand the call chain.

**Recommendation:** Add a one-paragraph file header comment to each module and maintain an `ARCHITECTURE.md` describing the module dependency graph and the request lifecycle (scenario init → offer → booking → fulfilment → refund/exchange → report).

---

## 2. Performance

### 2.1 O(n²) `bru.setEnvVar` Inside Per-Part Loops

**File:** `offers.js`, `validateAdmissions` (line 667) and `validateReservations` (line 868); also `bookings.js::validateOfferParts` (line 263)

**Finding:** Each iteration of the per-part `forEach` calls `bru.setEnvVar` with the accumulating array:

```js
admissionParts.forEach((admission, i) => {
  admissionReservationAncillaryOfferPartsIds.push(admission.id);
  bru.setEnvVar("admissionReservationAncillaryOfferPartsIds",
    admissionReservationAncillaryOfferPartsIds); // ← serialised & stored on every iteration
  …
});
```

For an offer with N admission parts + M reservation parts + K ancillary parts, this performs (N + M + K) serialisations instead of 3. With offers that have 10+ parts each, this is significant.

**Recommendation:** Accumulate into the array first, then call `setEnvVar` once after the loop:

```js
admissionParts.forEach((admission) => {
  admissionReservationAncillaryOfferPartsIds.push(admission.id);
  // … other validations …
});
bru.setEnvVar("admissionReservationAncillaryOfferPartsIds",
  admissionReservationAncillaryOfferPartsIds); // ← called once
```

---

### 2.2 `bru.setEnvVar("offer", selectedOffer)` Stores Entire JSON Object

**File:** `offers.js:298–300`

**Finding:**
```js
bru.setEnvVar("offer", selectedOffer);    // full offer object
bru.setEnvVar("offers", jsonData.offers); // ALL offers returned
```

`jsonData.offers` can include dozens of offers, each with admissions, reservations, ancillaries, after-sales conditions, etc. Storing the entire list in an env var means it is serialised to JSON and deserialized on every subsequent `bru.getEnvVar("offers")` call in `bookings.js`. In a realistic response with 20 offers × 5 parts, this can be hundreds of kilobytes.

**Recommendation:**
- Store only the `selectedOffer` (not the full `offers` array).
- If cross-step access to all offers is needed, store only the IDs and re-parse from the response body via the report capture mechanism instead.

---

### 2.3 `validationLogger` JSON Parse + Serialize on Every Log Call

**File:** `displays.js:58–69`

**Finding:**
```js
var existing = JSON.parse(bru.getVar('__rptLogs') || '[]');
existing.push({ level, message });
bru.setVar('__rptLogs', JSON.stringify(existing));
```

Every `validationLogger` call (there are hundreds per scenario run) reads, parses, appends to, and re-serialises the entire log array. Late in a verbose (`FULL`) run the array can contain thousands of entries, making each subsequent call progressively slower.

**Recommendation:** Use a ring-buffer / limit strategy:

```js
// Cap at the most recent N log entries to prevent unbounded growth
const MAX_LOG_ENTRIES = 500;
const existing = JSON.parse(bru.getVar('__rptLogs') || '[]');
existing.push({ level, message });
if (existing.length > MAX_LOG_ENTRIES) existing.splice(0, existing.length - MAX_LOG_ENTRIES);
bru.setVar('__rptLogs', JSON.stringify(existing));
```

Similarly `testCapture.js::bruTest` re-serialises `__rptTests` on every assertion — apply the same principle if the assertion count becomes large.

---

### 2.4 `ensureAuthorizationOr403` Makes an Extra HTTP Request on Every Offer Search

**File:** `offers.js:73–162`

**Finding:** `postOfferResponsePreRequest` calls `ensureAuthorizationOr403`, which immediately issues a `bru.sendRequest` preflight to the OSDM endpoint. This is a full HTTP round-trip that doubles the network cost of every offer-search step.

The function was introduced to detect expired tokens before the main request, but it only logs to the console on failure — it does not stop execution (note the `return` inside the callback). So the main request proceeds regardless of the preflight result.

**Recommendation:**
- Either give the preflight a real fail-fast mechanism (call `bru.runner.stopExecution()` on 401/403), or
- Remove the preflight entirely and rely on the HTTP status assertion in the after-response script, which already handles 401/403 via `loopbackOrStop`.
- If the preflight is retained, cache the result in an env var (`__authChecked`) and skip subsequent checks within the same scenario.

---

### 2.5 `resolveAjvConstructor` Re-Evaluates `scriptContent` on Each Call

**File:** `validators.js:13–32`

**Finding:**
```js
function resolveAjvConstructor() {
  const factory = new Function(`${String(scriptContent)}; return …`);
  const AjvFromScript = factory();  // re-evaluates the entire AJV bundle every call
}
```

The AJV minified bundle is several hundred kilobytes. Creating a `new Function` from it on every schema validation call is expensive.

**Recommendation:** Cache the resolved constructor in a module-level variable:

```js
let _cachedAjv = null;
function resolveAjvConstructor() {
  if (_cachedAjv) return _cachedAjv;
  // … resolve and assign to _cachedAjv …
  return _cachedAjv;
}
```

---

### 2.6 `resetScenarioEnvVars` Deletes Env Vars One at a Time (60+ Calls)

**File:** `scenarioParser.js:28–79`

**Finding:** The function calls `bru.deleteEnvVar(key)` in a loop over 60+ keys. Each call is a separate operation on Bruno's internal env store.

**Recommendation:** While Bruno's API does not currently expose a batch-delete method, submit a feature request upstream. In the meantime, group the deletions into a single serialised empty-value set where possible, and keep the list sorted so maintenance diffs are easier to review.

---

### 2.7 `validateExchangeFeesConsistentWithAfterSalesConditions` Calls `bru.getEnvVar` in Every Inner Loop Iteration

**File:** `exchanges.js:206–278`

**Finding:**
```js
admissionOfferParts.forEach((admission, admIndex) => {
  admission.afterSalesConditions.forEach((condition, condIndex) => {
    const scenarioType = bru.getEnvVar("scenarioType") || "";  // ← re-fetched every iteration
    …
  });
});
```

`bru.getEnvVar` is called on every condition of every part. Since `scenarioType` does not change during a single request, it should be read once before the loops:

```js
const scenarioType = bru.getEnvVar("scenarioType") || "";
admissionOfferParts.forEach(…);
```

The same pattern appears in `offers.js::validateAdmissions` (line 816–822).

---

## 3. Security

### 3.1 🔴 `new Function(scriptContent)` — Arbitrary Code Execution

**File:** `validators.js:26`  
**Severity:** CRITICAL

**Finding:**
```js
const factory = new Function(`${String(scriptContent)}; return typeof Ajv !== 'undefined' ? Ajv : null;`);
```

`scriptContent` is sourced from `bru.getEnvVar("scriptContent")`. This env var is populated by fetching the AJV bundle from the URL stored in `ajvMinified`. If the URL is fetched over HTTP (not HTTPS), or if an attacker can modify the environment file or intercept the connection, they can inject arbitrary JavaScript that will execute in the Bruno sandbox context.

`new Function(…)` is equivalent to `eval(…)`. It bypasses Bruno's sandbox mode entirely if the code is injected before the sandbox applies.

**Recommendations:**
1. **Immediate fix:** Bundle AJV locally in the repository under `library-bruno/ajv.min.js`. Replace the URL fetch with a local `require('./ajv.min.js')`. This eliminates the network fetch entirely.
2. **If remote loading is required:** Verify the URL is HTTPS and implement Subresource Integrity (SRI) by comparing a SHA-256 hash of the fetched content against a pinned value stored in the environment file.
3. **Alternative:** Use the `require("ajv")` path (line 14–16) with a local `package.json` so AJV is a proper dependency — no eval required.

---

### 3.2 🔴 Bearer Token Potentially Exposed in Logs

**File:** `displays.js`, `validators.js:38–54`  
**Severity:** HIGH

**Finding:**
```js
// validators.js:38
validationLogger("[INFO] Token Resp body", jsonData);
```

`validationLogger` takes a single string argument. Passing `jsonData` (which contains the `access_token`) as a second argument means it is coerced to `[object Object]` in normal use, but could produce different results depending on the JavaScript engine's `String()` coercion of the second argument. More importantly, the call signature itself suggests the intent was to log the response body — which would include the raw `access_token`.

Additionally, with `loggingType=FULL`, all `validationLogger` output (including request/response headers) is stored in `__rptLogs` and later written to the HTML report artifact. If that artifact is archived in GitHub Actions or shared, bearer tokens present in headers will be visible.

`mergeReport.js` does mask the `Authorization` header (`maskHeaderValue`), which is correct. However, a token could also appear in the response body (`access_token` field during the auth step) which is not masked in the `resBody` section of the report.

**Recommendations:**
1. Fix `validators.js:38`: `validationLogger("[INFO] setAuthToken: processing response")` — do not log the body.
2. In `mergeReport.js`, add response-body token masking for auth requests: replace any `"access_token":"..."` pattern in `resBody` with `"access_token":"[REDACTED]"`.
3. In `displays.js`, add the `Content-Type: text/plain` response body to the mask list if it contains `access_token=`.

---

### 3.3 🔴 Full OpenAPI Spec Stored in an Env Var via Unverified HTTP

**File:** `validators.js:58–90`  
**Severity:** HIGH

**Finding:**
```js
const url = bru.getEnvVar("swaggerSchema");
bru.sendRequest({ url, method: 'GET', proxy: false }, function (err, res) {
  const swaggerJson = JSON.parse(body);
  bru.setEnvVar("swaggerJson", swaggerJsonString); // full spec stored
```

`proxy: false` bypasses any corporate proxy that provides TLS inspection, certificate pinning, or malware filtering. If `swaggerSchema` points to an HTTP URL, the fetched spec could be tampered with in transit.

**Recommendations:**
1. The `swaggerSchema` env var should always be an `https://` URL. Add a validation guard:
```js
if (!/^https:\/\//i.test(url)) {
  console.error("❌ swaggerSchema must be an HTTPS URL");
  return;
}
```
2. Consider bundling the OpenAPI spec locally (it is already partially present in `json_validator/`), removing the remote fetch entirely.

---

### 3.4 🟠 Partner URL Pattern Matching Is Fragile and Security-Relevant

**Files:** `requestsBuilder.js:15, 71`, `scenarioParser.js:685, 699`  
**Severity:** MEDIUM

**Finding:** The `externalRef: "00001"` field is omitted only for Paxone, detected by `sandbox.includes("paxone")`. If the real URL of a different partner contains the string "paxone", their booking requests will silently omit `externalRef`, causing booking failures. More critically, the Bileto-specific `OffsetDateTime` path is triggered by `_apiBase.includes("bileto")` — an easy-to-fool substring check.

**Recommendation:** Replace all `sandbox.includes("partnerName")` checks with an explicit `partner` field in the environment file (`partner: PAXONE`, `partner: BILETO`). Use strict equality: `bru.getEnvVar("partner") === "PAXONE"`.

---

### 3.5 🟠 Hard-Coded `externalRef: "00001"` Causes Shared-Sandbox Conflicts

**File:** `requestsBuilder.js:73`  
**Severity:** MEDIUM

**Finding:**
```js
if (!sandbox.includes("paxone")) {
  body.externalRef = "00001";
}
```

`externalRef` is the requestor's own booking reference. Hard-coding it to `"00001"` for all scenarios on all partners means concurrent test runs (e.g., multiple CI pipelines or multiple testers on the same sandbox) will collide on the same external reference. Some OSDM implementations enforce uniqueness on `externalRef` and will reject the second booking with a conflict error.

**Recommendation:** Generate a unique `externalRef` per run using the UUID helper already available in `scenarioParser.js`:
```js
body.externalRef = randomUUID(); // re-use the local UUID generator
```

---

### 3.6 🟠 `bru.setEnvVar("access_token", …)` Stores Bearer Token in Plain-Text Env

**File:** `validators.js:48`  
**Severity:** MEDIUM

**Finding:**
```js
bru.setEnvVar(GV.ACCESS_TOKEN, jsonData.access_token);
```

The token is stored as a plain env var string. In Bruno Desktop this is visible in the Environments panel. In CLI runs it can appear in debug output. If environment files are accidentally committed with the token populated (e.g. if `OTST_Chaps_Env.yml` is accidentally un-gitignored), the token would be exposed.

**Recommendations:**
1. Use Bruno's dedicated secret variable mechanism (`bru.setSecret`) if available in the Bruno CLI version in use.
2. Verify `.gitignore` rules cover all environment files that could contain tokens (currently only `OTST_Chaps_Env.yml` is explicitly excluded — other env files are committed and their `access_token` field is visible).

---

### 3.7 🟡 Unvalidated URL in `getJson` — Potential SSRF

**File:** `scenarioParser.js:118–140`  
**Severity:** LOW–MEDIUM

**Finding:**
```js
async function getJson(url) {
  const cleanUrl = url.replace(/([^:])\/\/+/g, '$1/');
  // No further validation — any URL accepted
  bru.sendRequest({ url: cleanUrl, method: "GET", proxy: false }, …);
}
```

`url` is sourced from `bru.getEnvVar("data_base")`. There is only a basic `https?://` regex check at the call site. If the `data_base` env var is set to an internal network URL (e.g. `http://169.254.169.254/latest/meta-data/` on AWS), the request will be sent, potentially exposing internal infrastructure metadata.

**Recommendation:** Validate that `data_base` is either an approved domain (allowlist) or a `file://` path, and explicitly reject private IP ranges. As a minimum, require `https://` (the check at line 183 allows `http://`).

---

### 3.8 🟡 HTML Report Does Not Sanitise JSON Body Display

**File:** `mergeReport.js:175–179`, `requestBlock` function

**Finding:** The `prettyJson` helper formats the request/response body for display. The result is then passed through `esc()` before inserting into the HTML report. `esc()` correctly escapes `&`, `<`, `>`, and `"`. This is **correct** for the pre element context shown. However, the report also embeds raw JSON as page data (not in a `<pre>`), and any JavaScript loaded by the page uses `innerHTML` patterns — review the full HTML template to confirm no XSS path exists through nested `<script>` injection in body fields.

**Recommendation:** Conduct a focused XSS review of `mergeReport.js`. Specifically confirm:
1. Every user-controlled string (env name, scenario code, URL, headers, body) passes through `esc()` before insertion.
2. No `innerHTML` assignment receives unescaped data anywhere in the generated `<script>` blocks.

---

## 4. Prioritised Remediation Backlog

| # | Finding | Area | Severity | Effort | Impact |
|---|---|---|---|---|---|
| S1 | Remove `new Function(scriptContent)` — bundle AJV locally | Security | 🔴 CRITICAL | S | Eliminates arbitrary code execution risk |
| S2 | Fix `validators.js:38` — stop logging token response body | Security | 🔴 HIGH | XS | Prevents credential leak in logs |
| M11 | Fix `provisionalPrice` vs `provisionalPriceAmount` key mismatch | Maintainability | 🔴 HIGH | XS | Fixes silently broken price validation |
| P1 | Move `bru.setEnvVar` outside per-part loop (O(n²) → O(1)) | Performance | 🟠 HIGH | S | Significant speedup for large offers |
| S3 | Enforce HTTPS for `swaggerSchema` URL | Security | 🔴 HIGH | XS | Prevents schema tampering |
| M4 | Remove `globalThis` pollution; add explicit `require` | Maintainability | 🟠 HIGH | M | Fixes `validatePassengers` name collision |
| M3 | Replace inline passenger-type list with `OSDM_PASSENGER_TYPES` | Maintainability | 🟠 HIGH | XS | Prevents enum drift |
| P3 | Cap `__rptLogs` array growth in `validationLogger` | Performance | 🟠 MEDIUM | S | Prevents memory/perf degradation on FULL runs |
| S4 | Replace URL string matching with `partner` env var | Security | 🟠 MEDIUM | S | Fixes fragile partner detection |
| S5 | Generate unique `externalRef` per run | Security | 🟠 MEDIUM | XS | Prevents concurrent-run collisions |
| M2 | Extract `sumAfterSalesFee` helper — eliminate 3× duplicate loop | Maintainability | 🟡 MEDIUM | S | Reduces duplication |
| M8 | Fix `requestsBuilder.js` / `scenarioParser.js` partner hacks | Maintainability | 🟡 MEDIUM | M | Improves portability |
| M5 | Destructure `validationLogger` import everywhere | Maintainability | 🟡 LOW | XS | Clarity and correctness |
| P4 | Remove or fix `ensureAuthorizationOr403` preflight | Performance | 🟡 LOW | S | Halves pre-request network calls |
| P5 | Cache `resolveAjvConstructor` result | Performance | 🟡 LOW | XS | Avoids repeated bundle evaluation |
| M1 | Split `offers.js` into focused sub-modules | Maintainability | 🟡 LOW | L | Improves navigability |
| M12 | Add JSDoc to all exported functions | Maintainability | 🟡 LOW | L | Enables IDE hover-help and contributor onboarding |
| M6 | Delete `swagger.js` (empty file) | Maintainability | 🟡 LOW | XS | Removes dead code |
| M7 | Delete or populate `schema.js` (empty stub) | Maintainability | 🟡 LOW | XS | Removes dead code |
| S7 | SSRF guard in `getJson` — require HTTPS, deny private IPs | Security | 🟡 LOW | S | Defence in depth |
| M10 | Split `displays.js` display functions — DRY refactor | Maintainability | 🟡 LOW | M | Reduces duplication |
| M13 | Automate `resetScenarioEnvVars` ↔ `opencollection.yml` sync | Maintainability | 🟡 LOW | M | Prevents ghost env var bugs |

---

## 5. Module Health Summary

| Module | Lines | Issues | Notes |
|---|---|---|---|
| `offers.js` | 1 222 | M1, M3, M4, M5, P1, P7 | Largest file, needs splitting |
| `scenarioParser.js` | 833 | M8, S4, S7 | Partner hacks, SSRF risk |
| `reportGenerator.js` | 710 | — | Clean, well-documented |
| `bookings.js` | 551 | M4, M5, P1 | `validatePassengers` name collision |
| `displays.js` | 424 | M10, P3, S2 | Duplicate display fns, log growth |
| `mergeReport.js` | 412 | S8 | Good masking, XSS review needed |
| `validators.js` | 406 | S1, S3, P5 | Critical `new Function` issue |
| `refunds.js` | 399 | M4 | Relies on `validateFulfillments` via global |
| `model.js` | 336 | M9 | Mixed `var`/`class` style |
| `exchanges.js` | 299 | M2, M4, P7 | Triple-duplicated summing loop |
| `requestsBuilder.js` | 209 | M8, S4, S5 | Partner hacks, hardcoded externalRef |
| `fulfillments.js` | 200 | M4, M11 | Key mismatch, name collision |
| `passengers.js` | 96 | — | Clean |
| `testCapture.js` | 77 | P3 | Well-documented, minor perf risk |
| `osdmEnums.js` | 31 | — | Good, well-documented |
| `loopback.js` | 32 | — | Clean and simple |
| `schema.js` | 18 | M7 | Empty stub |
| `swagger.js` | 0 | M6 | Empty file |

---

*Document generated by GitHub Copilot Coding Agent — OSDM Testing Suite Code Audit.*
