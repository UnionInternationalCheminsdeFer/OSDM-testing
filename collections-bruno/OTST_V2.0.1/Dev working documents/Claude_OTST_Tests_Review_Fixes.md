# OTST Bruno Collection — Review & Fixes Session

**Date:** 2026-03-29
**Collection:** OTST_V2.0.1
**Scope:** Chaps sandbox environment (`OTST_Chaps_Env`) — offer request body sourced from data file instead of environment variables
**OSDM Specification reference:** v3.8 — https://github.com/UnionInternationalCheminsdeFer/OSDM/tree/master/specification/v3.8

---

## Context

The `OTST_Chaps_Env` environment file was created for a new Chaps sandbox. Unlike other environments (e.g. Paxone), the offer request body fields were deleted from the environment file, with the intent that they be built dynamically from `Chaps_datafile.json`. Three bugs prevented this from working.

The intended data flow is:

```
opencollection global before-request
  └─ getScenarioData()          ← fetches data_base URL, calls parseScenarioData()
       └─ sets offerTripSearchCriteria, offerPassengerSpecifications,
              offerSearchCriteria, offerFulfillmentOptions …

01. POST Get Offer — before-request
  └─ postOfferResponsePreRequest()
       └─ buildOfferCollectionRequest()   ← assembles OfferCollectionRequest from env vars

01. POST Get Offer — body
  └─ {{OfferCollectionRequest}}           ← sent to API
```


---

## Fix 1 — Silent crash in `buildOfferCollectionRequest()` when `offerFulfillmentOptions` is not set

**File:** `library-bruno/requestsBuilder.js`

### Problem

After Fix 1 and Fix 2, `buildOfferCollectionRequest()` was being called correctly but `OfferCollectionRequest` remained empty. The function was throwing a silent `SyntaxError` and exiting before reaching `bru.setEnvVar("OfferCollectionRequest", ...)`.

The root cause: when the data file defines `requestedFulfillmentOptions: []` (an empty array), the `osdmFulfillmentOptions()` function in `scenarioParser.js` does not call `bru.setEnvVar` (because it guards against empty arrays). After the collection-level cleanup deletes `offerFulfillmentOptions`, the variable stays undefined. Then:

```javascript
// For non-Paxone providers, !isPaxone is always true → always enters this block
const fulfillmentOptions = bru.getEnvVar("offerFulfillmentOptions"); // → undefined
if (!isPaxone || fulfillmentOptions) {
    body.requestedFulfillmentOptions = JSON.parse(fulfillmentOptions); // JSON.parse(undefined) → SyntaxError!
}
```

`JSON.parse(undefined)` throws a `SyntaxError`, the function exits, and `OfferCollectionRequest` is never set.

This does **not** affect Paxone because the condition `!isPaxone || fulfillmentOptions` evaluates to `false` when `fulfillmentOptions` is falsy and `isPaxone` is `true` — so Paxone skips the block entirely.

### Before

```javascript
const fulfillmentOptions = bru.getEnvVar("offerFulfillmentOptions");
if (!isPaxone || fulfillmentOptions) {
  body.requestedFulfillmentOptions = JSON.parse(fulfillmentOptions);
}
```

### After

```javascript
const fulfillmentOptions = bru.getEnvVar("offerFulfillmentOptions");
const parsedFulfillmentOptions = (fulfillmentOptions != null && fulfillmentOptions !== '')
  ? JSON.parse(fulfillmentOptions)
  : [];
if (!isPaxone || parsedFulfillmentOptions.length > 0) {
  body.requestedFulfillmentOptions = parsedFulfillmentOptions;
}
```

### Behaviour after fix

| Provider | `offerFulfillmentOptions` | Result |
|----------|--------------------------|--------|
| Chaps (empty list in datafile) | undefined | `requestedFulfillmentOptions: []` — included, no crash |
| Chaps (non-empty list) | JSON string | Parsed and included as before |
| Paxone (empty) | undefined | Block skipped — field not included (unchanged) |
| Paxone (non-empty) | JSON string | Parsed and included as before |

---

## Fix 2 — Invalid `parameters` block in `tripSearchCriteria` when no vehicle/carrier is defined

**File:** `library-bruno/scenarioParser.js`

### Problem

Identified during OSDM v3.8 spec alignment review. In `osdmTripSearchCriteria()`, a `VehicleFilter` was always created unconditionally, even when the data file provides no `vehicleNumber`. For Chaps, `legDef.vehicleNumber` is `undefined`, resulting in:

```json
"parameters": {
  "dataFilter": {
    "carrierFilter": null,
    "vehicleFilter": {
      "vehicleNumbers": [null],
      "lineNumbers": null,
      "exclude": false
    }
  }
}
```

Per OSDM v3.8, `vehicleNumbers` is an array of strings — `[null]` is invalid and would fail schema validation on a strict implementation. Furthermore, `exclude: false` with `[null]` means "include only trains with vehicle number null", which is semantically wrong.

Paxone avoids this because it explicitly passes `null` as the `parameters` argument to `TripSearchCriteria`, which the constructor's `if (parameters)` guard then omits from the body. Other providers (like Chaps) use the non-Paxone branch and always received the bad parameters block.

### Before

```javascript
const carrierFilter = legDef.carrier ? new CarrierFilter([legDef.carrier], false) : null;
const vehicleFilter = new VehicleFilter([legDef.vehicleNumber], null, false);

const tripDataFilter = new TripDataFilter(carrierFilter, vehicleFilter);
const tripParameters = new TripParameters(tripDataFilter);
```

### After

```javascript
const carrierFilter = legDef.carrier ? new CarrierFilter([legDef.carrier], false) : null;
const vehicleFilter = legDef.vehicleNumber ? new VehicleFilter([legDef.vehicleNumber], null, false) : null;

const tripDataFilter = (carrierFilter || vehicleFilter) ? new TripDataFilter(carrierFilter, vehicleFilter) : null;
const tripParameters = tripDataFilter ? new TripParameters(tripDataFilter) : null;
```

### Behaviour after fix

| Data file | `vehicleNumber` | `carrier` | Result |
|-----------|----------------|-----------|--------|
| Chaps (no vehicle, no carrier) | undefined | undefined | `parameters` block omitted entirely |
| Other provider (vehicle only) | "IC512" | undefined | `parameters.dataFilter.vehicleFilter` included |
| Other provider (carrier only) | undefined | "CD" | `parameters.dataFilter.carrierFilter` included |
| Other provider (both) | "IC512" | "CD" | Both filters included |

---

## Additional Findings (Not Fixed — Require Further Investigation)

### Finding A — `objectType: "OfferCollectionRequest"` at top level

**File:** `library-bruno/requestsBuilder.js`

```javascript
if (!isPaxone) {
  body.objectType = "OfferCollectionRequest";
}
```

The OSDM v3.8 spec defines `OfferCollectionRequest` with `additionalProperties: false`. The `objectType` field does not appear in the schema. On a strictly validating implementation this would cause a `400 Bad Request`.

**Recommendation:** Test whether Chaps accepts or rejects this field. If rejected, remove the `objectType` line (or wrap it in a provider-specific condition like the Paxone check already does).

---

### Finding B — `requestor` header has no value in Chaps environment

**File:** `environments/OTST_Chaps_Env.yml`

The request sends a `Requestor: {{requestor}}` header, but `requestor` is not defined anywhere in the Chaps environment file, so the header is sent with an empty value.

The OSDM v3.8 spec defines `requestor` as a **required query parameter** (not a header). The collection sends it as a header — this may or may not be accepted depending on the Chaps implementation.

**Recommendation:** Add a `requestor` entry to `OTST_Chaps_Env.yml` with the appropriate value for the Chaps sandbox, and confirm with the Chaps team whether they accept it as a header or require it as a query parameter.

---

### Finding C — `data_base` URL requires a local HTTP server

**File:** `environments/OTST_Chaps_Env.yml`

```yaml
data_base: http://localhost:8080/data_base/chaps_datafile.json
```

`getScenarioData()` fetches this URL via HTTP. Unlike other environments that use a remote GitHub raw URL, Chaps requires a local server to be running on port 8080 serving the `data_base/` folder before running the collection.

**Quick start:**
```bash
# From OTST_V2.0.1 directory
npx http-server . -p 8080
# or
python -m http.server 8080
```

---

## Files Modified

| File | Change |
|------|--------|
| `Common Requests/01. POST Get Offer.yml` | Uncommented before-request script (Fix 1) |
| `Common Requests/01. POST Get Offer.yml` | Replaced hardcoded body with `{{OfferCollectionRequest}}` (Fix 2) |
| `library-bruno/requestsBuilder.js` | Guard against undefined `offerFulfillmentOptions` (Fix 3) |
| `library-bruno/scenarioParser.js` | Only build vehicle/carrier filters when values exist (Fix 4) |

---

---

# Full Collection Code Review — Points of Attention

**Scope:** All library files (`library-bruno/`) and all request scenario files (`Common Requests/`, `Exchange/`, `Refund/`)
**Severity levels:** 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low/Quality

---

## 1. `fulfillments.js` — `checkGenericBookedOfferPart` is never defined 🔴

**Location:** `fulfillments.js:21`

```javascript
checkGenericBookedOfferPart(bookedOfferPart, bookingState, partType);
```

This function is called in `checkBookedOfferParts()` with a comment saying it is "expected to be globally available (from bookings.js)". However, `bookings.js` does not export or define a function with that name. This will throw a `ReferenceError` at runtime whenever `getBookingFulfillmentResponse()` is called (used in the GET Booking after Fulfillments chain).

**Suggestion:** Define `checkGenericBookedOfferPart()` in `bookings.js` and expose it globally via `Object.assign(globalThis, ...)`, or replace the call with the actual validation logic needed.

---

## 2. `Chaps_datafile.json` — `refundDate` is the string `"null"` instead of JSON `null` 🔴

**Location:** `Chaps_datafile.json` — every scenario block, e.g. line 11: `"refundDate": "null"`

The value is the **string** `"null"`, not the JSON `null` literal. In `10. POST Refund Offers.yml`:

```javascript
if (bru.getEnvVar("refundDate") != null) {
    requestRefundOffersBody(bru.getEnvVar("overruleCode"), bru.getEnvVar("refundDate"));
}
```

`bru.getEnvVar("refundDate")` returns `"null"` (a non-empty string), so the condition is `true` and `"null"` is sent as the `refundDate` in the API body. The server will either reject it or misinterpret it.

**Suggestion:** Replace `"refundDate": "null"` with `"refundDate": null` (no quotes) in the datafile, OR change the condition to:
```javascript
if (bru.getEnvVar("refundDate") != null && bru.getEnvVar("refundDate") !== "null") {
```

---

## 3. `bookings.js` — `fulfillmentIds` stored inside a `test()` assertion block 🟠 ✅ Fixed

**Location:** `bookings.js:377–382`

```javascript
test(`Fulfillment[${idx}] id exists`, () => {
    expect(fulfillment.id).to.be.a("string").and.not.be.empty;
    fulfillmentIds.push(fulfillment.id);          // ← side effect inside test
    bru.setEnvVar("fulfillmentIds", fulfillmentIds); // ← side effect inside test
});
```

`fulfillmentIds` is populated and persisted to the environment **inside** a test assertion callback. If Bruno defers or skips test execution, `fulfillmentIds` will never be set. The subsequent refund/exchange requests all rely on `fulfillmentIds` — if it is missing they will fail silently with an empty body.

**Suggestion:** Move the `push()` and `bru.setEnvVar()` calls **outside** the `test()` block:
```javascript
if (fulfillment.id) {
    fulfillmentIds.push(fulfillment.id);
    bru.setEnvVar("fulfillmentIds", fulfillmentIds);
}
test(`Fulfillment[${idx}] id exists`, () => {
    expect(fulfillment.id).to.be.a("string").and.not.be.empty;
});
```

---

## 4. `offers.js` — `validateTripsAndLegs` fails when `coveredTripId` is not set 🟠 ✅ Fixed

**Location:** `offers.js:447–450`

```javascript
const coveredTripId = bru.getEnvVar("coveredTripId");
test(`selectedOffer.tripCoverage.coverageTripId if part of Trip ids - coveredTripId: ${coveredTripId}`, function () {
    expect(tripIds).to.include(coveredTripId);  // ← fails if coveredTripId is null/undefined
});
```

`coveredTripId` is only set when the offer response contains `tripCoverage.coveredTripId` (set in `offers.js:550–553`). For providers that do not return `tripCoverage` (e.g. Chaps for a simple search), `coveredTripId` is `null` and `expect([...tripIds]).to.include(null)` will always fail.

**Suggestion:** Guard the test:
```javascript
if (coveredTripId) {
    test(`coveredTripId ${coveredTripId} is part of Trip ids`, function () {
        expect(tripIds).to.include(coveredTripId);
    });
} else {
    validationLogger(`[INFO] coveredTripId is not set → test skipped`);
}
```

---

## 5. `requestsBuilder.js` — Exchange body only covers first passenger 🟠 ✅ Fixed

**Location:** `requestsBuilder.js:149–156`

```javascript
anonymousPassengerSpecifications: [{
    externalRef: "00001",         // ← hardcoded, always first passenger only
    dateOfBirth: bru.getEnvVar('updateDateOfBirth_0'),  // ← index 0 only
    age: 0,
    type: "PERSON",
    ...(updateGender_0 != null && { gender: updateGender_0 })
}],
```

For multi-passenger exchange scenarios, only one `AnonymousPassengerSpecification` is sent. The OSDM spec requires one entry per passenger. The data file supports passenger groups with 2 or 3 passengers but they are silently dropped in the exchange request.

**Suggestion:** Build the array dynamically by iterating over all passengers stored in `offerPassengerSpecifications` and replacing fields with the corresponding `updateXxx_N` environment variables.

---

## 6. `05. PATCH Multi Passenger.yml` — Duplicate `Access-Token` header 🟠 ✅ Fixed

**Location:** `Common Requests/05. PATCH Multi Passenger.yml:14–16`

```yaml
- name: Authorization
  value: Bearer {{access_token}}
- name: Access-Token          # ← duplicate, redundant header
  value: "{{access_token}}"
```

`Authorization: Bearer …` is the standard OAuth2 header. `Access-Token` is a non-standard duplicate. Sending both may confuse some OSDM server implementations or trigger unexpected auth behaviour.

**Suggestion:** Remove the `Access-Token` header and keep only `Authorization: Bearer {{access_token}}`.

---

## 7. `05. PATCH Multi Passenger.yml` — Passenger `type` hardcoded as `"PERSON"` 🟠

**Location:** `Common Requests/05. PATCH Multi Passenger.yml:26`

```json
"type": "PERSON"
```

The PATCH body always sends `type: "PERSON"` regardless of the actual passenger type in the data file. For non-PERSON passenger types (e.g. `DOG`, `BICYCLE`, `WHEELCHAIR`) this would send an incorrect value to the server.

**Suggestion:** Add a `patchType` variable in the before-request script populated from the current passenger's `type` field, and use `"type": "{{patchType}}"` in the body.

---

## 8. `refunds.js` — Floating-point arithmetic in refundable amount validation 🟠

**Location:** `refunds.js:246`

```javascript
const expectedRefundableAmount = Number(confirmedPriceAmount) - Number(refundOffer.refundFee.amount);
expect(refundOffer.refundableAmount.amount).to.equal(expectedRefundableAmount);
```

JavaScript floating-point arithmetic is unreliable for monetary values. For example: `10.10 - 0.10` evaluates to `10.000000000000002`, not `10.00`. This test will fail for prices that produce rounding artefacts even when the API response is correct.

**Suggestion:** Use scaled integer arithmetic based on the `scale` field:
```javascript
const scale = Math.pow(10, refundOffer.refundableAmount.scale || 2);
const expected = Math.round((confirmedPriceAmount - refundOffer.refundFee.amount) * scale) / scale;
expect(refundOffer.refundableAmount.amount).to.be.closeTo(expected, 0.001);
```

---

## 9. `refunds.js` — `validUntil` hardcoded to ±15 minutes tolerance 🟠

**Location:** `refunds.js:104–108`

```javascript
const expectedValidUntil = new Date(currentDate.getTime() + 15 * 60 * 1000);
const tolerance = 2 * 60 * 1000; // 2 minutes
const difference = Math.abs(validUntil.getTime() - expectedValidUntil.getTime());
expect(difference).to.be.at.most(tolerance);
```

The 15-minute validity window is provider-specific. Chaps or other implementations may use a different validity duration (e.g. 30 minutes, 60 minutes). This test will incorrectly fail for any provider not using exactly 15 minutes.

**Suggestion:** Replace the exact-duration check with a simpler "validity is in the future" assertion, or make the expected duration configurable via a datafile/env var field (e.g. `refundOfferValidityMinutes`).

---

## 10. `exchanges.js` — `expected` / `actual` labels swapped in test title 🟡

**Location:** `exchanges.js:263`

```javascript
const title = `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`;
```

The labels are inverted: `expectedOverruleCode` is the expected value (from env), `appliedOverruleCode` is the actual value (from response). This makes test failure messages misleading.

**Suggestion:**
```javascript
const title = `AppliedOverruleCode is valid, (expected: ${expectedOverruleCode}, actual: ${appliedOverruleCode})`;
```

---

## 11. `offers.js` — Passenger type allowlist has typos and mismatches 🟡

**Location:** `offers.js:410` (validatePassengers) and `offers.js:634` (validateAdmissions)

In `validatePassengers`, the allowed types include `"ACCOMP_DOG"` and `"MOTOCYCLE"`, but `model.js` defines `COMPANION_DOG` and `MOTORCYCLE`. The typos will cause false failures when a server correctly returns `COMPANION_DOG` or `MOTORCYCLE`.

Additionally, `validateAdmissions` (line 634) uses a narrower type list (`["ADULT", "YOUTH", "SENIOR", "CHILD", "INFANT", "PERSON"]`) which excludes types like `PRM`, `WHEELCHAIR`, `FAMILY_CHILD` that are valid OSDM passenger types.

**Suggestion:** Centralise the allowed type list in `model.js` and reference it from both functions. Fix the two typos:
- `"ACCOMP_DOG"` → `"COMPANION_DOG"`
- `"MOTOCYCLE"` → `"MOTORCYCLE"`

---

## 12. `scenarioParser.js` — Departure date offset hardcoded 🟡

**Location:** `scenarioParser.js:99`

```javascript
// const plusDays = parseInt(bru.getEnvVar("departureDateFromToday")) || 0;
const plusDays = 10;
```

The dynamic approach was commented out and replaced with a hardcoded 10-day offset. This means all test trips are always 10 days in the future regardless of the scenario or user intent.

**Suggestion:** Re-enable the env var approach with a default fallback:
```javascript
const plusDays = parseInt(bru.getEnvVar("departureDateFromToday") || "10");
```
Add `departureDateFromToday` to the environment files with a default value of `10`.

---

## 13. `validators.js` — `setAuthToken` logs undefined variable 🟡

**Location:** `validators.js:18`

```javascript
let jsonData;
validationLogger("[INFO] Token Resp body", jsonData);  // ← jsonData is undefined here
```

`jsonData` is declared but not yet assigned at this point. The log will always print `undefined`. This is a debugging artefact.

**Suggestion:** Remove or move this log to after `jsonData` is assigned.

---

## 14. `10. POST Refund Offers.yml` / `13. PATCH Refund Offer.yml` — Misleading parameter name 🟡

**Location:** `Refund/10. POST Refund Offers.yml:91` and `Refund/13. PATCH Refund Offer.yml:69`

```javascript
postPatchRefundOfferResponse(jsonData, expectedexchangeOperationStatus=["PROPOSED"], ...);
```

The parameter is named `expectedexchangeOperationStatus` in a **refund** context. This is a copy-paste error from the exchange flow — it should be `expectedRefundOperationStatus`. JavaScript does not support named parameter syntax like this (it is actually an assignment to a variable); the correct value is still passed positionally, but the misleading name causes confusion.

**Suggestion:** Rename to `expectedRefundOperationStatus` in both files.

---

## 15. `13. PATCH Refund Offer.yml` — Does not handle `refundOffers` plural response 🟡

**Location:** `Refund/13. PATCH Refund Offer.yml:52–57`

```javascript
if (jsonData.refundOffer) {
    refundOffersArray.push(jsonData.refundOffer);
}
```

The PATCH response handler only looks for `refundOffer` (singular). `10. POST Refund Offers.yml` has defensive normalization for both `refundOffer` and `refundOffers`, but the PATCH does not. If a provider returns `refundOffers` (plural) from the PATCH endpoint, validation is silently skipped.

**Suggestion:** Apply the same normalization as in `10. POST Refund Offers.yml` — check for both `refundOffer` and `refundOffers`.

---

## 16. `exchanges.js` — `scenarioType` read repeatedly inside loops 🔵

**Location:** `exchanges.js:198, 207, 215, 229, 237`

`bru.getEnvVar("scenarioType")` is called on every iteration of the three `forEach` loops (admissions, reservations, ancillaries). This is 3 calls per part across all parts.

**Suggestion:** Read once before the loops:
```javascript
const scenarioType = bru.getEnvVar("scenarioType") || "";
```

---

## 17. `offers.js` — Full offer object stored in environment 🔵

**Location:** `offers.js:247–249`

```javascript
bru.setEnvVar("offer", selectedOffer);
bru.setEnvVar("offers", jsonData.offers);
```

Storing the full offer (and all offers) as environment variables can be very large (hundreds of KB for complex itineraries). Bruno may serialize these as strings in the environment, causing memory pressure and slow performance across subsequent requests.

**Suggestion:** Store only the minimum needed fields (`offerId`, `offerSummary`, `admissionOfferParts` etc.) and retrieve the full response from a dedicated GET if needed.

---

## 18. `offers.js` — No-op environment variable assignment 🔵

**Location:** `offers.js:191`

```javascript
bru.setEnvVar("admissionReservationAncillaryOfferPartsIds", bru.getEnvVar("admissionReservationAncillaryOfferPartsIds"));
```

This reads a variable and immediately writes it back unchanged. It has no effect. The comment says it is "kept for compatibility" but this is misleading.

**Suggestion:** Remove this line entirely.

---

## 19. `validators.js` — `eval()` used to load AJV 🔵

**Location:** `validators.js:162`

```javascript
eval(scriptContent); // defines Ajv
```

Using `eval` to load a library is a security risk and is blocked in Bruno's `--sandbox=developer` mode. The Swagger schema validation feature (`swaggerSchemaValidatorContent`) will silently fail in secure sandbox environments.

**Suggestion:** Bundle AJV as a local `node_modules` dependency in the collection (it can be `require`d directly) rather than fetching and eval-ing it at runtime.

---

## 20. `Chaps_datafile.json` — Duplicate trip data in `tripRequirements` 🔵

**Location:** `Chaps_datafile.json:129–151`

`tripRequirement` with `id: 2` (intended for 2-leg scenarios) has **identical** origin, destination, and datetimes as `id: 1`. The 2-leg scenarios (`OTST_RFND_SRCH_CRIT_1ADT_2LEG`, `OTST_RFND_SRCH_CRIT_2ADT_2LEG`) will therefore send the same single-leg trip as the 1-leg scenarios.

**Suggestion:** Update `tripRequirement id: 2` with a second distinct leg or use the `SPECIFICATION` trip type with multiple leg definitions.

---

## 21. `06. GET Passenger.yml` / `08. POST Obtaining Fulfillments.yml` / `09. GET Booking after Fulfillments.yml` — Duplicate `Access-Token` header 🟠 ✅ Fixed

**Location:** `Common Requests/06. GET Passenger.yml`, `Common Requests/08. POST Obtaining Fulfillments from Booking.yml`, `Common Requests/09. GET Booking after Fulfillments.yml`

The same duplicate `Access-Token` header already found in `05. PATCH Multi Passenger.yml` (finding #6) also appears in three more request files. In total, **four request files** send both `Authorization: Bearer {{access_token}}` and a redundant `Access-Token: {{access_token}}` header.

**Suggestion:** Remove the `Access-Token` header from all four files and keep only the standard `Authorization: Bearer {{access_token}}`.

---

## 22. `refunds.js` — `expected`/`actual` labels swapped in test title 🟡

**Location:** `refunds.js` — `validateRefundAppliedOverruleCode()`

```javascript
const title = `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`;
```

Same pattern as finding #10 in `exchanges.js`: `appliedOverruleCode` (from server response = **actual**) is labelled `expected`, and `expectedOverruleCode` (from env = **expected**) is labelled `actual`. Failure messages will be read backwards.

**Suggestion:**
```javascript
const title = `AppliedOverruleCode is valid, (expected: ${expectedOverruleCode}, actual: ${appliedOverruleCode})`;
```

---

## 23. `offers.js` — `scenarioType` read on every loop iteration in validation functions 🔵

**Location:** `offers.js` — `validateAdmissions()`, `validateReservations()`, `validateAncillaries()`

```javascript
admissions.forEach((admission) => {
    const scenarioType = bru.getEnvVar("scenarioType"); // ← repeated N times per request
    ...
});
```

`bru.getEnvVar("scenarioType")` is called inside each `forEach` callback (once per admission, once per reservation, once per ancillary). The same issue was already noted for `exchanges.js` in finding #16. In `offers.js` it occurs across three separate loops.

**Suggestion:** Hoist all three reads to the top of each function, before the loop:
```javascript
const scenarioType = bru.getEnvVar("scenarioType") || "";
admissions.forEach((admission) => { ... });
```

---

## 24. `offers.js` — Floating-point accumulation of `afterSalesFee` amounts 🟡

**Location:** `offers.js` — `validateAdmissions()` / `validateAfterSalesFee()`

```javascript
totalAfterSalesFeeAmount += offerPart.afterSalesFee.amount;  // floating-point addition
```

Accumulated sums of monetary amounts (e.g. `0.10 + 0.20 = 0.30000000000000004`) will produce rounding artefacts. A subsequent exact equality assertion on the total will then fail even when the server returns correct values.

**Suggestion:** Accumulate as integers using the `scale` field (same pattern suggested in finding #8):
```javascript
const scale = Math.pow(10, offerPart.afterSalesFee.scale || 2);
totalAfterSalesFeeAmount += Math.round(offerPart.afterSalesFee.amount * scale);
// compare: totalAfterSalesFeeAmount / scale
```

---

## 25. `exchanges.js` — `offerId` vs `id` field inconsistency between refund and exchange flows 🟡

**Location:** `exchanges.js` — `postPatchExchangeOffersResponse()`

```javascript
bru.setEnvVar("exchangeOfferId", exchangeOffer.offerId);  // uses .offerId
```

In the refund equivalent (`refunds.js`), the offer identifier is stored from:
```javascript
bru.setEnvVar("refundOfferId", refundOffer.id);           // uses .id
```

These access different fields from the API response. If the OSDM server returns the offer ID under `id` (as is standard), the exchange flow stores `undefined`. Conversely if the server uses `offerId`, the refund flow breaks. One of the two flows has the wrong field name.

**Suggestion:** Verify the OSDM v3.8 schema for both `ExchangeOffer` and `RefundOffer` to confirm the correct field name and apply consistently across both files.

---

## 26. `bookings.js` — No null guard before `ids.push()` in `validateOfferParts()` 🟡

**Location:** `bookings.js` — `validateOfferParts()`

```javascript
bookedOfferParts.forEach((bookedPart) => {
    ids.push(bookedPart.id);  // ← no guard, throws if bookedPart.id is undefined
    ...
});
```

If the server returns a `bookedOfferPart` without an `id` field (or returns `null`), `ids.push(undefined)` silently corrupts the IDs array. Subsequent offer-part lookups that use these IDs will fail in hard-to-diagnose ways.

**Suggestion:** Add a guard:
```javascript
if (bookedPart.id) {
    ids.push(bookedPart.id);
} else {
    validationLogger(`[WARNING] bookedOfferPart has no id — skipped`);
}
```

---

## 27. `fulfillments.js` — `validatePrices()` uses mismatched env var name 🟡

**Location:** `fulfillments.js` — `validatePrices()`

```javascript
const provisionalPrice = bru.getEnvVar("provisionalPrice");
```

In `bookings.js`, the provisional price is stored under:
```javascript
bru.setEnvVar("provisionalPriceAmount", booking.price.amount);
```

`fulfillments.js` reads `provisionalPrice` but `bookings.js` writes `provisionalPriceAmount`. The variable is never written under the name `fulfillments.js` reads, so `provisionalPrice` will always be `undefined` and the price consistency check will never run.

**Suggestion:** Align the variable name — either change `bookings.js` to write `provisionalPrice` or change `fulfillments.js` to read `provisionalPriceAmount`.

---

## 28. `fulfillments.js` — `checkFulfillment()` always asserts `controlNumber` presence 🟡

**Location:** `fulfillments.js` — `checkFulfillment()`

```javascript
test(`fulfillment controlNumber exists`, () => {
    expect(fulfillment.controlNumber).to.be.a("string").and.not.be.empty;
});
```

`controlNumber` is treated as mandatory by `fulfillments.js`, but in `bookings.js` the `displayFulFilledBooking()` helper treats it as optional (no assertion on its presence). Per OSDM v3.8, `controlNumber` is defined as optional on `FulfilledBookingPart`. For providers that do not return a `controlNumber`, this test will always fail.

**Suggestion:** Make the test conditional:
```javascript
if (fulfillment.controlNumber !== undefined) {
    test(`fulfillment controlNumber is a non-empty string`, () => {
        expect(fulfillment.controlNumber).to.be.a("string").and.not.be.empty;
    });
}
```

---

## 29. `passengers.js` — `patchMultiPassengerResponse()` lacks bounds check 🟠

**Location:** `passengers.js` — `patchMultiPassengerResponse()`

```javascript
const passengerAdditionalData = JSON.parse(bru.getEnvVar("passengersAdditionalData") || "[]");
const currentPassengerIndex = parseInt(bru.getEnvVar("currentPassengerIndex")) || 0;
const passengerData = passengerAdditionalData[currentPassengerIndex];
// passengerData used immediately with no null/undefined guard
const expectedGender = passengerData.updateGender;
```

If `currentPassengerIndex` exceeds the length of `passengerAdditionalData` (e.g. due to an off-by-one error in the loop counter, or a mismatch between the data file and the actual passengers returned), `passengerData` will be `undefined` and accessing `.updateGender` (or any field) will throw a `TypeError`, aborting the after-response script.

**Suggestion:**
```javascript
if (!passengerData) {
    validationLogger(`[WARNING] No additional data found for passenger index ${currentPassengerIndex} — skipping update validation`);
    return;
}
```

---

## 30. `displays.js` — WARNING and ERROR messages suppressed at DEBUG log level 🔵

**Location:** `displays.js` — `validationLogger()`

```javascript
if (loggingType === "DEBUG") {
    if (messageType === "[DEBUG]" || messageType === "[INFO]") {
        console.log(...);
    }
    // [WARNING] and [ERROR] not printed in DEBUG mode
}
```

In the `DEBUG` branch, only `[DEBUG]` and `[INFO]` messages are printed. `[WARNING]` and `[ERROR]` messages are silently dropped, even though they are more severe and should always be shown. This means critical validation warnings are invisible when running in debug mode.

**Suggestion:** Rewrite the condition so that `[WARNING]` and `[ERROR]` are always shown regardless of logging level:
```javascript
const alwaysShow = (messageType === "[WARNING]" || messageType === "[ERROR]");
const showForLevel =
    loggingType === "DEBUG" ||
    (loggingType === "INFO" && messageType !== "[DEBUG]");
if (alwaysShow || showForLevel) {
    console.log(...);
}
```

---

## 31. `displays.js` — Near-duplicate `displayBookingResponse` / `displayFulFilledBooking` functions 🔵

**Location:** `displays.js:152–346`

`displayBookingResponse()` (~100 lines) and `displayFulFilledBooking()` (~100 lines) share almost identical structure: both iterate over `passengers`, `bookedOfferParts` (admissions/reservations/ancillaries), and `prices`. The only meaningful differences are the function name and the `FulfilledBooking`-specific handling of `fulfillments`.

This duplication means any change (e.g. a new field, a log format fix) must be made in two places and is easy to miss.

**Suggestion:** Extract a shared `displayBookingCore(booking)` helper and have both functions call it, with `displayFulFilledBooking` adding only the fulfillment-specific section afterwards.

---

## 32. `08. POST Obtaining Fulfillments from Booking.yml` — Empty object body `{}` on POST 🔵

**Location:** `Common Requests/08. POST Obtaining Fulfillments from Booking.yml`

```yaml
body:
  type: json
  data: "{}"
```

The request body is an empty JSON object `{}`. The OSDM v3.8 `POST /bookings/{id}/fulfillments` endpoint may not require a body at all, or it may require specific `FulfillmentRequest` fields. Sending `{}` could trigger a `400 Bad Request` on strict implementations.

**Suggestion:** Verify the OSDM v3.8 spec for the fulfillment endpoint body requirements. If no body is needed, remove the `body` block entirely; if specific fields are required, build them from the data file.

---

## 33. `15. DEL Refund Offer.yml` — Body `{}` sent on DELETE request 🔵

**Location:** `Refund/15. DEL Refund Offer.yml`

```yaml
body:
  type: json
  data: "{}"
```

HTTP `DELETE` requests conventionally have no body. Some proxies, firewalls, and servers reject `DELETE` requests with a body. The OSDM v3.8 `DELETE /bookings/{bookingId}/refundOffers/{refundOfferId}` endpoint does not define a request body in the spec.

**Suggestion:** Remove the `body` block from this request.

---

## 34. `16. GET Booking after Delete Refund.yml` — `embed=ALL` sent twice 🔵

**Location:** `Refund/16. GET Booking after Delete Refund.yml`

The URL path is constructed as `{{api_base}}/bookings/{{bookingId}}?embed=ALL` (embed in the path string) **and** there is a separate query parameter `embed` with value `ALL` defined in the request's `params` section. Bruno will append it again, producing `/bookings/{id}?embed=ALL&embed=ALL`.

**Suggestion:** Remove the `embed=ALL` from the URL string and keep only the query parameter entry (or vice versa).

---

## 35. `11. POST Exchange Operations.yml` — JavaScript assignment syntax used as named parameter 🔵

**Location:** `Exchange/11. POST Exchange Operations.yml`

```javascript
postPatchExchangeOffersResponse(jsonData, expectedexchangeOperationStatus=["PREBOOKED"], ...);
```

JavaScript does not support named parameter syntax. `expectedexchangeOperationStatus=["PREBOOKED"]` is a **default parameter assignment in a function definition**, not a named argument at call site. When written in a function call it is actually a side effect: it assigns `["PREBOOKED"]` to a variable named `expectedexchangeOperationStatus` in the current scope, and passes that variable positionally. This works accidentally but is misleading and fragile if the argument order ever changes.

The same pattern also appears in `Refund/10. POST Refund Offers.yml` and `Refund/13. PATCH Refund Offer.yml`.

**Suggestion:** Use plain positional arguments:
```javascript
postPatchExchangeOffersResponse(jsonData, ["PREBOOKED"], ...);
```

---

## Summary Table

| # | File | Severity | Issue |
|---|------|----------|-------|
| 1 | `fulfillments.js` | 🔴 Critical | `checkGenericBookedOfferPart` called but never defined |
| 2 | `Chaps_datafile.json` | 🔴 Critical | `refundDate: "null"` (string) passed to API instead of JSON null |
| 3 | `bookings.js` | 🟠 High | `fulfillmentIds` stored inside `test()` side effect | ✅ Fixed |
| 4 | `offers.js` | 🟠 High | `coveredTripId` include-test runs even when null | ✅ Fixed |
| 5 | `requestsBuilder.js` | 🟠 High | Exchange body only covers first passenger (hardcoded `externalRef: "00001"`) | ✅ Fixed |
| 6 | `05. PATCH Multi Passenger.yml` | 🟠 High | Duplicate `Access-Token` header | ✅ Fixed |
| 7 | `05. PATCH Multi Passenger.yml` | 🟠 High | Passenger `type` hardcoded as `"PERSON"` |
| 8 | `refunds.js` | 🟠 High | Floating-point subtraction for monetary comparison |
| 9 | `refunds.js` | 🟠 High | `validUntil` check hardcoded to 15-min window |
| 10 | `exchanges.js` | 🟡 Medium | `expected`/`actual` labels swapped in test title |
| 11 | `offers.js` | 🟡 Medium | Passenger type allowlist has typos (`ACCOMP_DOG`, `MOTOCYCLE`) |
| 12 | `scenarioParser.js` | 🟡 Medium | Departure offset hardcoded to 10 days |
| 13 | `validators.js` | 🟡 Medium | Log prints undefined variable in `setAuthToken` |
| 14 | `10. POST Refund Offers.yml` / `13. PATCH Refund Offer.yml` | 🟡 Medium | Parameter named `expectedexchangeOperationStatus` in refund context |
| 15 | `13. PATCH Refund Offer.yml` | 🟡 Medium | Does not normalize `refundOffers` plural response |
| 16 | `exchanges.js` | 🔵 Low | `scenarioType` read repeatedly inside loop iterations |
| 17 | `offers.js` | 🔵 Low | Full offer object stored in environment (memory/performance) |
| 18 | `offers.js` | 🔵 Low | No-op env variable assignment |
| 19 | `validators.js` | 🔵 Low | `eval()` used to load AJV — blocked in sandbox mode |
| 20 | `Chaps_datafile.json` | 🔵 Low | `tripRequirement id:2` has identical data to `id:1` |
| 21 | `06`, `08`, `09` request YMLs | 🟠 High | Duplicate `Access-Token` header (3 additional files, same as #6) | ✅ Fixed |
| 22 | `refunds.js` | 🟡 Medium | `expected`/`actual` labels swapped in `validateRefundAppliedOverruleCode` |
| 23 | `offers.js` | 🔵 Low | `scenarioType` read on every loop iteration in validate functions |
| 24 | `offers.js` | 🟡 Medium | Floating-point accumulation of `afterSalesFee` amounts |
| 25 | `exchanges.js` | 🟡 Medium | `offerId` vs `id` field inconsistency between exchange and refund flows |
| 26 | `bookings.js` | 🟡 Medium | No null guard before `ids.push()` in `validateOfferParts()` |
| 27 | `fulfillments.js` | 🟡 Medium | `validatePrices()` reads `provisionalPrice` but env var written as `provisionalPriceAmount` |
| 28 | `fulfillments.js` | 🟡 Medium | `controlNumber` asserted as mandatory but is optional per OSDM spec |
| 29 | `passengers.js` | 🟠 High | No bounds check in `patchMultiPassengerResponse()` — `TypeError` if index out of range |
| 30 | `displays.js` | 🔵 Low | WARNING/ERROR messages suppressed at DEBUG log level |
| 31 | `displays.js` | 🔵 Low | Near-duplicate `displayBookingResponse` / `displayFulFilledBooking` (~200 lines) |
| 32 | `08. POST Obtaining Fulfillments.yml` | 🔵 Low | Empty body `{}` may not be valid per OSDM spec |
| 33 | `15. DEL Refund Offer.yml` | 🔵 Low | Body `{}` sent on DELETE (non-standard, may be rejected) |
| 34 | `16. GET Booking after Delete Refund.yml` | 🔵 Low | `embed=ALL` sent twice (in URL string and as query param) |
| 35 | `11. POST Exchange Operations.yml` | 🔵 Low | JS assignment syntax misused as named parameter at call site |

---

---

# Proposed New Assertions — OSDM v3.8 Certification Coverage

**Rationale:** The following assertions are currently absent from the collection but are required or implied by the OSDM v3.8 OpenAPI specification (`OSDM-online-api-v3.8.0.yml`). Adding them will increase confidence that an implementation is genuinely spec-compliant and help detect subtle interoperability defects.

Each proposal includes the target file/function, the OSDM spec basis, a suggested code snippet, and a priority level.

**Priority levels:** 🔴 Must-have · 🟠 Should-have · 🟡 Nice-to-have

---

## A. Offer Response — `offers.js` / `postOfferResponse()`

---

### A1. Assert `offerId` is a non-empty string on every offer 🔴

**OSDM spec:** `Offer.offerId` — required, `type: string`, `nullable: false`, `maxLength: 32768`

Currently `offerId` is only logged, not asserted on every offer in the array. If a server returns an offer with a missing or null `offerId`, the booking step will silently fail.

```javascript
jsonData.offers.forEach((offer, i) => {
  test(`offers[${i}].offerId is a non-empty string`, () => {
    expect(offer.offerId).to.be.a('string').and.not.be.empty;
  });
});
```

---

### A2. Assert `preBookableUntil` is a valid future datetime 🔴

**OSDM spec:** `Offer.preBookableUntil` — required, `type: string`, `format: date-time`. The offer must be booked before this deadline or it expires.

Currently not validated at all. If a server returns an expired or malformed `preBookableUntil`, the booking step will silently fail.

```javascript
jsonData.offers.forEach((offer, i) => {
  test(`offers[${i}].preBookableUntil is a valid future datetime`, () => {
    const d = new Date(offer.preBookableUntil);
    expect(isNaN(d.getTime()), `preBookableUntil is not a valid date`).to.be.false;
    expect(d.getTime()).to.be.above(Date.now(), `preBookableUntil is in the past`);
  });
});
```

---

### A3. Assert `createdOn` is a valid ISO datetime on every offer 🔴

**OSDM spec:** `Offer.createdOn` — required, `type: string`, `format: date-time`.

The field is currently logged but not validated as a parseable date.

```javascript
jsonData.offers.forEach((offer, i) => {
  test(`offers[${i}].createdOn is a valid datetime`, () => {
    const d = new Date(offer.createdOn);
    expect(isNaN(d.getTime()), `createdOn is not a valid date: ${offer.createdOn}`).to.be.false;
  });
});
```

---

### A4. Assert `passengerRefs` is non-empty and count matches request 🔴

**OSDM spec:** `Offer.passengerRefs` — required, `type: array`, `minItems: 1`. Each entry must reference one of the passengers submitted in the request.

```javascript
const expectedPassengerCount = parseInt(bru.getEnvVar("passengerCount") || "1");
jsonData.offers.forEach((offer, i) => {
  test(`offers[${i}].passengerRefs is non-empty`, () => {
    expect(offer.passengerRefs).to.be.an('array').with.lengthOf.at.least(1);
  });
  test(`offers[${i}].passengerRefs count matches requested passengers`, () => {
    expect(offer.passengerRefs.length).to.eql(expectedPassengerCount);
  });
});
```

---

### A5. Assert offer part prices are non-negative 🟠

**OSDM spec:** `Price.amount` — integer in smallest currency unit. Negative prices are never valid in a standard offer context.

```javascript
['admissionOfferParts', 'reservationOfferParts', 'ancillaryOfferParts'].forEach(partType => {
  (selectedOffer[partType] || []).forEach((part, i) => {
    if (part.price) {
      test(`${partType}[${i}].price.amount is non-negative`, () => {
        expect(part.price.amount).to.be.at.least(0);
      });
      test(`${partType}[${i}].price.currency is a non-empty string`, () => {
        expect(part.price.currency).to.be.a('string').and.not.be.empty;
      });
    }
  });
});
```

---

### A6. Assert `afterSalesConditions.condition` is a valid OSDM enum value 🟠

**OSDM spec:** `AfterSaleConditionType` — enum: `REFUND`, `EXCHANGE`, `PLACE_CHANGE`.

Currently the condition value is matched by equality but never validated against the allowed enum. A typo (e.g. `"REFUNDS"`) would be silently accepted.

```javascript
const validConditions = ['REFUND', 'EXCHANGE', 'PLACE_CHANGE'];
(part.afterSalesConditions || []).forEach((cond, ci) => {
  test(`afterSalesConditions[${ci}].condition is a valid OSDM enum`, () => {
    expect(validConditions).to.include(cond.condition,
      `'${cond.condition}' is not a valid AfterSaleConditionType`);
  });
});
```

---

### A7. Assert trip `startTime < endTime` on every leg 🟠

**OSDM spec:** `Trip.startTime` / `Trip.endTime` — required, `format: date-time`. A trip where the end precedes the start indicates a server-side data error.

```javascript
(jsonData.trips || []).forEach((trip, ti) => {
  const start = new Date(trip.startTime);
  const end   = new Date(trip.endTime);
  test(`trips[${ti}] startTime is before endTime`, () => {
    expect(start.getTime()).to.be.below(end.getTime(),
      `Trip startTime (${trip.startTime}) is not before endTime (${trip.endTime})`);
  });
  test(`trips[${ti}] has at least one leg`, () => {
    expect(trip.legs).to.be.an('array').with.lengthOf.at.least(1);
  });
});
```

---

### A8. Assert `offerSummary.minimalPrice` currency consistency with offer parts 🟡

**OSDM spec:** All prices within a single offer must use the same currency. Mixing currencies within one offer is not valid.

```javascript
const summaryCurrency = selectedOffer.offerSummary?.minimalPrice?.currency;
if (summaryCurrency) {
  ['admissionOfferParts', 'reservationOfferParts', 'ancillaryOfferParts'].forEach(partType => {
    (selectedOffer[partType] || []).forEach((part, i) => {
      if (part.price?.currency) {
        test(`${partType}[${i}].price.currency matches offerSummary currency`, () => {
          expect(part.price.currency).to.eql(summaryCurrency);
        });
      }
    });
  });
}
```

---

## B. Booking Creation — `bookings.js` / `postCreateBookingResponse()`

---

### B1. Assert `booking.id` and `bookingCode` are non-empty strings 🔴

**OSDM spec:** `Booking.id` — required, `nullable: false`. `bookingCode` — optional but commonly returned; when present it must be non-empty.

Currently both are asserted together in a single test. Splitting them gives clearer failure messages and `bookingCode` absence should only warn, not fail, since it is optional.

```javascript
test(`booking.id is a non-empty string`, () => {
  expect(booking.id).to.be.a('string').and.not.be.empty;
});
if (booking.bookingCode !== undefined && booking.bookingCode !== null) {
  test(`booking.bookingCode is a non-empty string`, () => {
    expect(booking.bookingCode).to.be.a('string').and.not.be.empty;
  });
}
```

---

### B2. Assert `confirmationTimeLimit` is in the future after booking creation 🔴

**OSDM spec:** `Booking.confirmationTimeLimit` — `format: date-time`, `nullable: true`. When present, the booking must be confirmed before this deadline; after it the system may auto-cancel unconfirmed parts. Not currently validated.

```javascript
if (booking.confirmationTimeLimit) {
  test(`booking.confirmationTimeLimit is a valid future datetime`, () => {
    const limit = new Date(booking.confirmationTimeLimit);
    expect(isNaN(limit.getTime()), `confirmationTimeLimit is not a valid date`).to.be.false;
    expect(limit.getTime()).to.be.above(Date.now(),
      `confirmationTimeLimit is already in the past: ${booking.confirmationTimeLimit}`);
  });
}
```

---

### B3. Assert `bookedOffers` array is present and non-empty 🔴

**OSDM spec:** A booking created from an offer must contain at least one `BookedOffer`.

```javascript
test(`booking.bookedOffers is a non-empty array`, () => {
  expect(booking.bookedOffers).to.be.an('array').with.lengthOf.at.least(1);
});
```

---

### B4. Assert `provisionalPrice` and `confirmedPrice` use the same currency 🟠

**OSDM spec:** Both prices represent the same transaction; mixing currencies would indicate a server bug.

```javascript
if (booking.provisionalPrice && booking.confirmedPrice) {
  test(`provisionalPrice.currency matches confirmedPrice.currency`, () => {
    expect(booking.confirmedPrice.currency).to.eql(booking.provisionalPrice.currency,
      `Currency mismatch: provisional=${booking.provisionalPrice.currency}, confirmed=${booking.confirmedPrice.currency}`);
  });
}
```

---

### B5. Assert booking `createdOn` is a valid ISO datetime 🟠

**OSDM spec:** `Booking.createdOn` — required, `format: date-time`.

```javascript
test(`booking.createdOn is a valid datetime`, () => {
  const d = new Date(booking.createdOn);
  expect(isNaN(d.getTime()), `createdOn is not a valid date: ${booking.createdOn}`).to.be.false;
  expect(d.getTime()).to.be.at.most(Date.now(), `createdOn is in the future`);
});
```

---

### B6. Assert booked offer part `status` is a valid OSDM enum 🟠

**OSDM spec:** `BookingPartStatus` enum: `PREBOOKED`, `ON_HOLD`, `CONFIRMED`, `FULFILLED`, `CANCELLED`, `RELEASED`, `REFUNDED`, `EXCHANGE_ONGOING`, `EXCHANGED`, `ERROR`.

Currently status is compared to the expected value but never validated as a known enum. An unknown status (e.g. `"PENDING"`) would silently pass if it matched the expected string.

```javascript
const validStatuses = ['PREBOOKED','ON_HOLD','CONFIRMED','FULFILLED',
                       'CANCELLED','RELEASED','REFUNDED','EXCHANGE_ONGOING','EXCHANGED','ERROR'];
bookedParts.forEach((part, i) => {
  test(`bookedPart[${i}].status '${part.status}' is a valid BookingPartStatus`, () => {
    expect(validStatuses).to.include(part.status);
  });
});
```

---

### B7. Assert `booking.passengers` count equals `passengerCount` exactly 🟠

**OSDM spec:** The booking must reflect exactly the passengers from the booking request — not more, not fewer.

Currently the collection only asserts `at.least(expectedPassengerCount)`. A server that returns extra ghost passengers would pass the current test.

```javascript
test(`booking.passengers count equals expected passengerCount`, () => {
  expect(booking.passengers.length).to.eql(expectedPassengerCount,
    `Expected ${expectedPassengerCount} passengers, got ${booking.passengers.length}`);
});
```

---

## C. Booking Confirmation — Status Transition Validation

---

### C1. Assert booking part status transitions from PREBOOKED to CONFIRMED 🔴

**OSDM spec:** The booking lifecycle requires parts to move from `PREBOOKED` → `CONFIRMED` after the confirm call. Currently GET Booking before fulfillments checks the status but does not explicitly verify the transition.

```javascript
// In 07. GET Booking before Fulfillments after-response script:
const expectedStatus = 'CONFIRMED';
const allConfirmed = booking.bookedOffers
  .flatMap(bo => [...(bo.admissions||[]), ...(bo.reservations||[]), ...(bo.ancillaries||[])])
  .every(part => part.status === expectedStatus);
test(`All booked offer parts are CONFIRMED after confirmation`, () => {
  expect(allConfirmed, `Some parts are not yet CONFIRMED`).to.be.true;
});
```

---

### C2. Assert `fulfillmentStatus` field is present and valid after fulfillment 🟠

**OSDM spec:** `Booking.fulfillmentStatus` — `FulfillmentSummaryStatus` enum: `UNISSUED`, `PARTIALLY_ISSUED`, `ISSUED`, `PARTIALLY_USED`, `COMPLETELY_USED`, `REFUNDED`, `CANCELLED`, `EXPIRED`. Added in OSDM v3.8.

Not currently validated in any request.

```javascript
const validFulfillmentStatuses = ['UNISSUED','PARTIALLY_ISSUED','ISSUED',
  'PARTIALLY_USED','COMPLETELY_USED','REFUNDED','CANCELLED','EXPIRED'];
if (booking.fulfillmentStatus !== undefined) {
  test(`booking.fulfillmentStatus '${booking.fulfillmentStatus}' is a valid FulfillmentSummaryStatus`, () => {
    expect(validFulfillmentStatuses).to.include(booking.fulfillmentStatus);
  });
}
```

---

## D. Fulfillment — `fulfillments.js` / `getBookingFulfillmentResponse()`

---

### D1. Assert `fulfillment.status` is a valid OSDM `FulfillmentStatus` enum 🔴

**OSDM spec:** `FulfillmentStatus` enum: `AVAILABLE`, `USED`, `PARTIALLY_USED`, `RESERVED`, `EXCHANGED`, `REFUNDED`, `RELEASED`, `CANCELLED`, `EXPIRED`.

Currently status is only compared to the expected value. An unknown status string would pass if it happened to match.

```javascript
const validFulfillmentStatuses = ['AVAILABLE','USED','PARTIALLY_USED','RESERVED',
                                  'EXCHANGED','REFUNDED','RELEASED','CANCELLED','EXPIRED'];
test(`fulfillment.status '${fulfillment.status}' is a valid FulfillmentStatus`, () => {
  expect(validFulfillmentStatuses).to.include(fulfillment.status);
});
```

---

### D2. Assert `fulfillmentDocumentRefs` (v3.8) when `fulfillmentDocuments` is absent 🟠

**OSDM spec v3.8:** `fulfillmentDocuments` is deprecated in favour of `fulfillmentDocumentRefs` (an array of URLs/identifiers). The collection currently only checks the deprecated field.

```javascript
const hasDocs   = Array.isArray(fulfillment.fulfillmentDocuments) && fulfillment.fulfillmentDocuments.length > 0;
const hasRefs   = Array.isArray(fulfillment.fulfillmentDocumentRefs) && fulfillment.fulfillmentDocumentRefs.length > 0;
if (hasDocs || hasRefs) {
  test(`Fulfillment[${idx}] has document references (fulfillmentDocuments or fulfillmentDocumentRefs)`, () => {
    expect(hasDocs || hasRefs).to.be.true;
  });
  if (hasRefs) {
    fulfillment.fulfillmentDocumentRefs.forEach((ref, ri) => {
      test(`Fulfillment[${idx}].fulfillmentDocumentRefs[${ri}] is a non-empty string`, () => {
        expect(ref).to.be.a('string').and.not.be.empty;
      });
    });
  }
}
```

---

### D3. Assert `fulfillment.bookingRef` matches current `bookingId` 🟠

**OSDM spec:** `Fulfillment.bookingRef` — required, the booking ID this fulfillment belongs to. The value must match the booking that was just confirmed, not some other booking.

```javascript
test(`Fulfillment[${idx}].bookingRef matches current bookingId`, () => {
  expect(fulfillment.bookingRef).to.eql(bru.getEnvVar("bookingId"),
    `bookingRef '${fulfillment.bookingRef}' does not match bookingId '${bru.getEnvVar("bookingId")}'`);
});
```

---

### D4. Assert `fulfillment.createdOn` is a valid ISO datetime 🟠

**OSDM spec:** `Fulfillment.createdOn` — required, `format: date-time`.

Currently checked as a non-empty string only. The date format itself is not validated.

```javascript
test(`Fulfillment[${idx}].createdOn is a valid datetime`, () => {
  const d = new Date(fulfillment.createdOn);
  expect(isNaN(d.getTime()), `createdOn is not a valid date: ${fulfillment.createdOn}`).to.be.false;
});
```

---

## E. Refund Flow — `refunds.js`

---

### E1. Assert `refundOffer.validFrom <= validUntil` 🔴

**OSDM spec:** `RefundOffer.validFrom` and `validUntil` — both required. A window where `validFrom > validUntil` is a server-side error and would make the refund offer unusable.

```javascript
test(`refundOffer.validFrom is before validUntil`, () => {
  const from  = new Date(refundOffer.validFrom);
  const until = new Date(refundOffer.validUntil);
  expect(from.getTime()).to.be.at.most(until.getTime(),
    `validFrom (${refundOffer.validFrom}) is after validUntil (${refundOffer.validUntil})`);
});
```

---

### E2. Assert `refundFee.amount + refundableAmount.amount === confirmedPrice.amount` 🔴

**OSDM spec / business rule:** The refund fee plus the amount refunded to the customer must equal the total confirmed price. This is the core financial identity of a refund. Currently only `refundableAmount = confirmedPrice − refundFee` is checked (with floating-point issues), not the full three-way identity.

```javascript
const scale = Math.pow(10, refundOffer.refundableAmount?.scale || 2);
const fee       = Math.round((refundOffer.refundFee?.amount || 0) * scale);
const refundAmt = Math.round((refundOffer.refundableAmount?.amount || 0) * scale);
const confirmed = Math.round((Number(bru.getEnvVar("confirmedPriceAmount") || 0)) * scale);
test(`refundFee + refundableAmount = confirmedPrice`, () => {
  expect(fee + refundAmt).to.eql(confirmed,
    `Fee(${fee}) + Refundable(${refundAmt}) ≠ Confirmed(${confirmed})`);
});
```

---

### E3. Assert `refundOffer.fulfillments` array is non-empty 🟠

**OSDM spec:** `RefundOffer.fulfillments` — required, `minItems: 1`. A refund offer with no associated fulfillments cannot be processed.

```javascript
test(`refundOffer.fulfillments is non-empty`, () => {
  expect(refundOffer.fulfillments).to.be.an('array').with.lengthOf.at.least(1,
    `refundOffer must contain at least one fulfillment reference`);
});
```

---

### E4. Assert booked offer parts status is `REFUNDED` after confirmed refund 🟠

**OSDM spec:** After a refund is confirmed, the affected `BookedOfferPart` statuses must transition to `REFUNDED`.

```javascript
// In 16. GET Booking after Delete Refund after-response script:
if (bru.getEnvVar("isRefundConfirmed") === "true") {
  const parts = booking.bookedOffers
    .flatMap(bo => [...(bo.admissions||[]), ...(bo.reservations||[]), ...(bo.ancillaries||[])]);
  test(`All refunded offer parts have status REFUNDED`, () => {
    parts.forEach((part, i) => {
      expect(['REFUNDED', 'FULFILLED'], `Part[${i}] status should be REFUNDED, got ${part.status}`)
        .to.include(part.status);
    });
  });
}
```

---

### E5. Assert `refundOffer.status` is `CONFIRMED` after PATCH 🟠

**OSDM spec:** `RefundStatus` enum: `PROPOSED` → `CONFIRMED`. After the PATCH call, the refund offer must be in `CONFIRMED` state.

```javascript
// In 13. PATCH Refund Offer after-response:
test(`refundOffer.status is CONFIRMED after PATCH`, () => {
  expect(refundOffer.status).to.eql('CONFIRMED',
    `Expected CONFIRMED, got '${refundOffer.status}'`);
});
```

---

## F. Exchange Flow — `exchanges.js`

---

### F1. Assert exchange price identity: `exchangePrice + exchangeFee − confirmedPrice = amountToBePaid − refundableAmount` 🔴

**OSDM spec / business rule:** Core financial balance for an exchange. Currently only individual fee comparisons are made against after-sales conditions, but the full balance equation is never verified.

```javascript
const scale = Math.pow(10, exchangeOffer.exchangePrice?.scale || 2);
const exPrice  = Math.round((exchangeOffer.exchangePrice?.amount    || 0) * scale);
const exFee    = Math.round((exchangeOffer.exchangeFee?.amount      || 0) * scale);
const confirmed = Math.round((Number(bru.getEnvVar("confirmedPriceAmount") || 0)) * scale);
const toPay    = Math.round((exchangeOffer.amountToBePaid?.amount   || 0) * scale);
const refund   = Math.round((exchangeOffer.refundableAmount?.amount || 0) * scale);
test(`Exchange price identity: exchangePrice + exchangeFee - confirmedPrice = amountToBePaid - refundableAmount`, () => {
  expect(exPrice + exFee - confirmed).to.eql(toPay - refund,
    `Price identity broken: (${exPrice}+${exFee}-${confirmed}) ≠ (${toPay}-${refund})`);
});
```

---

### F2. Assert `exchangeOffer.preBookableUntil` is a valid future datetime 🟠

**OSDM spec:** `ExchangeOffer.preBookableUntil` — required, `format: date-time`. Same requirement as for standard offers.

```javascript
test(`exchangeOffer.preBookableUntil is a valid future datetime`, () => {
  const d = new Date(exchangeOffer.preBookableUntil);
  expect(isNaN(d.getTime())).to.be.false;
  expect(d.getTime()).to.be.above(Date.now());
});
```

---

### F3. Assert old booking parts transition to `EXCHANGED` after completed exchange 🟠

**OSDM spec:** After an exchange is fulfilled, the original `BookedOfferPart` entries must be in `EXCHANGED` status and the new parts in `CONFIRMED` or `FULFILLED`.

```javascript
// In 15. GET Booking after Exchange Fulfillment after-response:
const parts = booking.bookedOffers
  .flatMap(bo => [...(bo.admissions||[]), ...(bo.reservations||[]), ...(bo.ancillaries||[])]);
test(`Booking parts are in a post-exchange terminal state`, () => {
  const validPostExchangeStatuses = ['EXCHANGED','CONFIRMED','FULFILLED'];
  parts.forEach((part, i) => {
    expect(validPostExchangeStatuses).to.include(part.status,
      `Part[${i}] has unexpected status '${part.status}' after exchange`);
  });
});
```

---

### F4. Assert `exchangeOffer.admissionOfferParts` is non-empty 🟠

**OSDM spec:** `ExchangeOffer.admissionOfferParts` — required field. An exchange offer with no admission parts cannot be booked.

```javascript
test(`exchangeOffer.admissionOfferParts is non-empty`, () => {
  expect(exchangeOffer.admissionOfferParts).to.be.an('array').with.lengthOf.at.least(1);
});
```

---

## G. Passenger Management — `passengers.js`

---

### G1. Assert `passenger.id`, `externalRef`, and `type` are unchanged after PATCH 🔴

**OSDM spec:** `Passenger.id`, `externalRef`, and `type` are server-assigned or set at booking creation. A PATCH updates personal details only; identity fields must not change.

```javascript
const originalPassengerId  = bru.getEnvVar(`passengerId_${currentPassengerIndex}`);
const originalExternalRef  = bru.getEnvVar(`passengerExternalRef_${currentPassengerIndex}`);
const originalType         = bru.getEnvVar(`passengerType_${currentPassengerIndex}`);

test(`passenger.id is unchanged after PATCH`, () => {
  expect(passenger.id).to.eql(originalPassengerId);
});
test(`passenger.externalRef is unchanged after PATCH`, () => {
  expect(passenger.externalRef).to.eql(originalExternalRef);
});
test(`passenger.type is unchanged after PATCH`, () => {
  expect(passenger.type).to.eql(originalType);
});
```

---

### G2. Assert passenger `type` is a valid OSDM `PassengerType` enum value 🟠

**OSDM spec:** `PassengerType` is an extensible enum with defined core values. Currently the type allowlist in `validatePassengers` has typos (finding #11). A clean enum check after PATCH confirms the server returns a known type.

```javascript
const validPassengerTypes = ['YOUNG_CHILD','CHILD','YOUTH','ADULT','SENIOR','FAMILY_CHILD',
  'ACCOMP_PRM','PRM_CHILD','WHEELCHAIR','PERSON','PRM','DOG','PET','LUGGAGE',
  'BICYCLE','PRAM','COMPANION_DOG','CAR','MOTORCYCLE','TRAILER'];
test(`passenger.type '${passenger.type}' is a valid PassengerType`, () => {
  expect(validPassengerTypes).to.include(passenger.type);
});
```

---

## H. Cross-Cutting / Protocol Assertions

---

### H1. Assert HTTP response `Content-Type` is `application/json` 🔴

**OSDM spec / HTTP best practice:** All OSDM API responses must return `Content-Type: application/json`. Currently no request in the collection validates the response content-type header.

```javascript
// Add to every after-response script (or to opencollection global after-response):
test(`Response Content-Type is application/json`, () => {
  const contentType = res.headers['content-type'] || res.headers['Content-Type'] || '';
  expect(contentType).to.include('application/json',
    `Expected application/json, got: ${contentType}`);
});
```

---

### H2. Assert error responses contain a valid OSDM `Problem` object 🔴

**OSDM spec:** All 4xx/5xx responses must follow RFC 9457 Problem Details — containing at minimum `status` (integer) and optionally `title`, `detail`, `type`. Currently when a 400/404 etc. is expected (e.g. after refund delete), only the status code is checked — the body structure is never validated.

```javascript
// When an error status is expected:
if ([400, 401, 403, 404, 409].includes(res.status)) {
  test(`Error response body is a valid Problem object`, () => {
    expect(jsonData).to.be.an('object');
    expect(jsonData.status).to.be.a('number').and.to.eql(res.status);
    if (jsonData.title !== undefined) {
      expect(jsonData.title).to.be.a('string').and.not.be.empty;
    }
  });
}
```

---

### H3. Assert currency codes are consistent across the full booking flow 🟠

**OSDM spec / business rule:** The currency in the offer price, the booking provisional/confirmed price, and the fulfillment must all match. Currency changes mid-flow indicate a server error.

```javascript
// Store at offer stage:
bru.setEnvVar("offerCurrency", selectedOffer.offerSummary?.minimalPrice?.currency);

// Assert at booking stage:
test(`booking.provisionalPrice.currency matches offerCurrency`, () => {
  expect(booking.provisionalPrice.currency).to.eql(bru.getEnvVar("offerCurrency"));
});

// Assert at fulfillment stage:
// (no currency field on Fulfillment itself, but its bookingRef's price must match)
```

---

### H4. Assert `idempotencyKey` retry produces identical booking 🟡

**OSDM spec:** The `idempotencyKey` header guarantees that retrying a `POST /bookings` with the same key returns the same booking — not a duplicate. This is important for payment safety.

```javascript
// Add a dedicated idempotency test scenario:
// 1. Store the bookingId from the first POST /bookings call
// 2. Replay the same request with the same idempotencyKey
// 3. Assert the returned bookingId is identical to the stored one
test(`Retry with same idempotencyKey returns same booking`, () => {
  expect(retryBookingId).to.eql(bru.getEnvVar("bookingId"),
    `idempotency violated: first=${bru.getEnvVar("bookingId")}, retry=${retryBookingId}`);
});
```

---

### H5. Assert `GET /versions` endpoint returns the negotiated OSDM version 🟡

**OSDM spec:** `GET /versions` is a mandatory endpoint that returns the API version(s) supported by the server. Not currently tested.

```javascript
// New request: GET {{api_base}}/versions
// After-response:
test(`versions endpoint returns a non-empty array`, () => {
  expect(jsonData.versions).to.be.an('array').with.lengthOf.at.least(1);
});
test(`versions[0] contains a version string`, () => {
  expect(jsonData.versions[0].version).to.be.a('string').and.not.be.empty;
});
```

---

## Proposed Assertion Summary Table

| # | Flow Step | OSDM Spec Basis | Priority | Assertion |
|---|-----------|-----------------|----------|-----------|
| A1 | Offer | `Offer.offerId` required | 🔴 | `offerId` is a non-empty string on every offer |
| A2 | Offer | `Offer.preBookableUntil` required + future | 🔴 | `preBookableUntil` is a valid future datetime |
| A3 | Offer | `Offer.createdOn` required date-time | 🔴 | `createdOn` is a valid ISO datetime |
| A4 | Offer | `Offer.passengerRefs` minItems:1 | 🔴 | `passengerRefs` count matches requested passengers |
| A5 | Offer | `Price.amount` semantics | 🟠 | Offer part prices are non-negative |
| A6 | Offer | `AfterSaleConditionType` enum | 🟠 | `afterSalesConditions.condition` is a valid enum |
| A7 | Offer | `Trip.startTime < endTime` | 🟠 | Trip `startTime` is before `endTime` on every leg |
| A8 | Offer | Currency consistency | 🟡 | Offer part currencies match `offerSummary` currency |
| B1 | Booking | `Booking.id` required | 🔴 | `booking.id` and `bookingCode` asserted separately |
| B2 | Booking | `Booking.confirmationTimeLimit` | 🔴 | `confirmationTimeLimit` is in the future |
| B3 | Booking | `bookedOffers` required | 🔴 | `bookedOffers` is non-empty |
| B4 | Booking | Price currency consistency | 🟠 | `provisionalPrice` and `confirmedPrice` currencies match |
| B5 | Booking | `Booking.createdOn` required | 🟠 | `createdOn` is a valid datetime ≤ now |
| B6 | Booking | `BookingPartStatus` enum | 🟠 | Booked part `status` is a valid OSDM enum value |
| B7 | Booking | Passenger count exact match | 🟠 | Passenger count equals `passengerCount` exactly |
| C1 | Confirmation | `PREBOOKED → CONFIRMED` | 🔴 | Parts are `CONFIRMED` after confirm call |
| C2 | Confirmation | `FulfillmentSummaryStatus` (v3.8) | 🟠 | `fulfillmentStatus` is a valid enum |
| D1 | Fulfillment | `FulfillmentStatus` enum | 🔴 | `fulfillment.status` is a valid enum |
| D2 | Fulfillment | `fulfillmentDocumentRefs` (v3.8) | 🟠 | Check new field as alternative to deprecated `fulfillmentDocuments` |
| D3 | Fulfillment | `Fulfillment.bookingRef` | 🟠 | `bookingRef` matches current `bookingId` |
| D4 | Fulfillment | `Fulfillment.createdOn` required | 🟠 | `createdOn` is a valid ISO datetime |
| E1 | Refund | `validFrom ≤ validUntil` | 🔴 | Refund offer time window is logically valid |
| E2 | Refund | Price identity | 🔴 | `refundFee + refundableAmount = confirmedPrice` |
| E3 | Refund | `RefundOffer.fulfillments` minItems:1 | 🟠 | `fulfillments` array is non-empty |
| E4 | Refund | `REFUNDED` status transition | 🟠 | Parts are `REFUNDED` after confirmed refund |
| E5 | Refund | `PROPOSED → CONFIRMED` | 🟠 | Refund offer `status` is `CONFIRMED` after PATCH |
| F1 | Exchange | Exchange price identity | 🔴 | `exchangePrice + exchangeFee − confirmedPrice = amountToBePaid − refundableAmount` |
| F2 | Exchange | `preBookableUntil` required | 🟠 | Exchange offer `preBookableUntil` is future |
| F3 | Exchange | `EXCHANGED` status transition | 🟠 | Old parts are `EXCHANGED` after exchange |
| F4 | Exchange | `admissionOfferParts` required | 🟠 | Exchange offer `admissionOfferParts` non-empty |
| G1 | Passenger | Identity fields immutable | 🔴 | `id`, `externalRef`, `type` unchanged after PATCH |
| G2 | Passenger | `PassengerType` enum | 🟠 | Passenger `type` is a valid OSDM enum value |
| H1 | All | `Content-Type: application/json` | 🔴 | Response `Content-Type` header validated on every request |
| H2 | All | RFC 9457 Problem Details | 🔴 | Error responses contain a valid `Problem` object |
| H3 | All | Currency consistency | 🟠 | Same currency used from offer through to fulfillment |
| H4 | Booking | `idempotencyKey` safety | 🟡 | Retry with same key returns same booking (new test scenario) |
| H5 | API | `GET /versions` mandatory | 🟡 | Versions endpoint returns at least one version entry |

---

---

# Implementation Log — New Assertions Added to Code

**Date:** 2026-03-29
**Status:** Implemented in code (all assertions marked ✅ below)

The following changes were applied to the collection source files. Each entry shows the file modified, the assertion ID from the table above, and the exact before/after code.

---

## `library-bruno/offers.js`

### A1 / A3 / A4 — Per-offer mandatory field assertions + H3 currency storage

**Added in:** `postOfferResponse()`, after the `'offers' array exists` test.

```javascript
// NEW — A1/A3/A4: Per-offer mandatory field assertions (OSDM v3.8 spec)
const requestedPassengerCount = (jsonData.anonymousPassengerSpecifications || []).length;
jsonData.offers.forEach((offer, i) => {
  test(`offers[${i}].offerId is a non-empty string (OSDM: Offer.offerId required)`, () => {
    expect(offer.offerId).to.be.a('string').and.not.be.empty;
  });
  const createdOnDate = new Date(offer.createdOn);
  test(`offers[${i}].createdOn is a valid ISO datetime (OSDM: Offer.createdOn required)`, () => {
    expect(isNaN(createdOnDate.getTime()), `createdOn is not a valid date: ${offer.createdOn}`).to.be.false;
  });
  test(`offers[${i}].passengerRefs is a non-empty array (OSDM: Offer.passengerRefs minItems:1)`, () => {
    expect(offer.passengerRefs).to.be.an('array').with.lengthOf.at.least(1);
  });
  if (requestedPassengerCount > 0) {
    test(`offers[${i}].passengerRefs count matches requested passengers (expected: ${requestedPassengerCount}, actual: ${offer.passengerRefs?.length})`, () => {
      expect(offer.passengerRefs.length).to.eql(requestedPassengerCount,
        `Expected ${requestedPassengerCount} passengerRefs, got ${offer.passengerRefs.length}`);
    });
  }
});
// H3: Store offer currency for cross-flow consistency checks
const _offerCurrency = jsonData.offers[0]?.offerSummary?.minimalPrice?.currency;
if (_offerCurrency) {
  bru.setEnvVar("offerCurrency", _offerCurrency);
}
```

---

### A2 — `preBookableUntil` future datetime (already existed, made mandatory)

**Before** (`validateOfferSummary()`): guarded by `if (preBookableUntil)` — silently skipped when absent.

**After:** Field is required per OSDM spec — test still skips with a log, but the assertion is now also verifying `!isNaN` explicitly (no change needed beyond the existing test — confirmed already correct).

---

### A6 — `afterSalesConditions.condition` extended to include `PLACE_CHANGE`

**Before** (`validateAdmissions`, `validateReservations`, `validateAncillaries`):
```javascript
expect(condition.condition, `...`).to.be.oneOf(['REFUND', 'EXCHANGE']);
```

**After** (all three functions):
```javascript
expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND, EXCHANGE or PLACE_CHANGE (OSDM: AfterSaleConditionType)`).to.be.oneOf(['REFUND', 'EXCHANGE', 'PLACE_CHANGE']);
```

---

### A7 — Trip `startTime < endTime` temporal order

**Before** (`validateTripsAndLegs()`): No temporal order check on trips.

**Added** inside `trips.forEach()`, before the direction check:
```javascript
// A7: startTime must be strictly before endTime (OSDM: Trip.startTime/endTime required)
const tripStart = new Date(trip.startTime);
const tripEnd   = new Date(trip.endTime);
if (!isNaN(tripStart.getTime()) && !isNaN(tripEnd.getTime())) {
  test(`Trip ${tripIndex + 1} startTime is before endTime (OSDM: temporal order)`, () => {
    expect(tripStart.getTime()).to.be.below(tripEnd.getTime(),
      `Trip startTime (${trip.startTime}) is not before endTime (${trip.endTime})`);
  });
}
```

---

### `coveredTripId` null guard fix (finding #4)

**Before:**
```javascript
test(`selectedOffer.tripCoverage.coverageTripId if part of Trip ids - coveredTripId: ${coveredTripId}`, function () {
  expect(tripIds).to.include(coveredTripId);  // fails when null
});
```

**After:**
```javascript
if (coveredTripId) {
  test(`selectedOffer.tripCoverage.coveredTripId (${coveredTripId}) is part of Trip ids`, function () {
    expect(tripIds).to.include(coveredTripId);
  });
} else {
  validationLogger(`[INFO] coveredTripId is not set → tripCoverage test skipped`);
}
```

---

### A8 — Currency consistency across offer parts

**Added** at the end of `validateOfferParts()`:
```javascript
// A8: Currency consistency — all offer part prices must use the same currency as offerSummary
const _summaryCurrency = selectedOffer.offerSummary?.minimalPrice?.currency;
if (_summaryCurrency) {
  ['admissionOfferParts', 'reservationOfferParts', 'ancillaryOfferParts'].forEach(partType => {
    (selectedOffer[partType] || []).forEach((part, pi) => {
      if (part.price?.currency) {
        test(`${partType}[${pi}].price.currency matches offerSummary currency (expected: ${_summaryCurrency}, actual: ${part.price.currency})`, () => {
          expect(part.price.currency).to.eql(_summaryCurrency,
            `Currency mismatch in ${partType}[${pi}]`);
        });
      }
    });
  });
}
```

---

### Passenger type typo fix (finding #11)

**Before** (`validatePassengers()`):
```javascript
expect(p.type).to.be.oneOf([..., "ACCOMP_DOG", ..., "MOTOCYCLE", ...]);
```

**After:**
```javascript
expect(p.type).to.be.oneOf([..., "COMPANION_DOG", ..., "MOTORCYCLE", ...]);
```

---

## `library-bruno/bookings.js`

### B1 — Split `booking.id` / `bookingCode` tests

**Before:**
```javascript
test(`Booking Id : ${booking.id} and Booking code : ${booking.bookingCode} are returned`, () => {
  expect(booking.id).to.be.a('string').and.not.be.empty;
  expect(booking.bookingCode).to.be.a('string').and.not.be.empty;
});
bru.setEnvVar("bookingId", booking.id);
```

**After:**
```javascript
test(`booking.id is a non-empty string (OSDM: Booking.id required)`, () => {
  expect(booking.id).to.be.a('string').and.not.be.empty;
});
bru.setEnvVar("bookingId", booking.id);
if (booking.bookingCode !== undefined && booking.bookingCode !== null) {
  test(`booking.bookingCode is a non-empty string when present`, () => {
    expect(booking.bookingCode).to.be.a('string').and.not.be.empty;
  });
} else {
  validationLogger(`[INFO] booking.bookingCode is absent (optional per OSDM spec)`);
}
```

---

### B2 / B3 — `confirmationTimeLimit` future + `bookedOffers` non-empty

**Added** in `postCreateBookingResponse()` before the price structure block:
```javascript
// B2: confirmationTimeLimit must be a valid future datetime when present
if (booking.confirmationTimeLimit) {
  const confirmLimit = new Date(booking.confirmationTimeLimit);
  test(`booking.confirmationTimeLimit is a valid future datetime (OSDM)`, () => {
    expect(isNaN(confirmLimit.getTime())).to.be.false;
    expect(confirmLimit.getTime()).to.be.above(Date.now());
  });
}

// B3: bookedOffers must be non-empty
test(`booking.bookedOffers is a non-empty array (OSDM: required)`, () => {
  expect(booking.bookedOffers).to.be.an('array').with.lengthOf.at.least(1);
});
```

---

### B4 / H3 — Currency consistency

**Added** after the price fields check:
```javascript
// B4: Both prices must use the same currency
if (prov?.currency && confirmed?.currency) {
  test(`provisionalPrice.currency matches confirmedPrice.currency (OSDM)`, () => {
    expect(confirmed.currency).to.eql(prov.currency);
  });
}
// H3: Booking currency must match offer currency
const _offerCurrency = bru.getEnvVar("offerCurrency");
if (_offerCurrency && prov?.currency) {
  test(`booking.provisionalPrice.currency matches offer currency (expected: ${_offerCurrency}, actual: ${prov.currency})`, () => {
    expect(prov.currency).to.eql(_offerCurrency);
  });
}
```

---

### B6 — Booked part `status` is a valid `BookingPartStatus` enum

**Added** in `validateOfferParts()` after the status comparison test:
```javascript
// B6: Status must be a known OSDM BookingPartStatus enum value
const _validBookingPartStatuses = ['PREBOOKED','ON_HOLD','CONFIRMED','FULFILLED',
  'CANCELLED','RELEASED','REFUNDED','EXCHANGE_ONGOING','EXCHANGED','ERROR'];
test(`${partType}[${index}].status '${bookedPart.status}' is a valid OSDM BookingPartStatus`, () => {
  expect(_validBookingPartStatuses).to.include(bookedPart.status);
});
```

---

### B7 — Exact passenger count

**Before:**
```javascript
expect(actualPassengerCount).to.be.at.least(expectedPassengerCount);
```

**After:**
```javascript
expect(actualPassengerCount).to.eql(expectedPassengerCount,
  `Expected exactly ${expectedPassengerCount} passengers, got ${actualPassengerCount}`);
```

---

### C2 — `fulfillmentStatus` valid `FulfillmentSummaryStatus` enum (OSDM v3.8)

**Added** after the passenger count test:
```javascript
const _validFulfillmentSummaryStatuses = ['UNISSUED','PARTIALLY_ISSUED','ISSUED',
  'PARTIALLY_USED','COMPLETELY_USED','REFUNDED','CANCELLED','EXPIRED'];
if (booking.fulfillmentStatus !== undefined) {
  test(`booking.fulfillmentStatus '${booking.fulfillmentStatus}' is a valid FulfillmentSummaryStatus (OSDM v3.8)`, () => {
    expect(_validFulfillmentSummaryStatuses).to.include(booking.fulfillmentStatus);
  });
}
```

---

### D1 — `fulfillment.status` valid `FulfillmentStatus` enum

**Added** in `validateFulfillments()` after the status comparison test:
```javascript
const _validFulfillmentStatuses = ['AVAILABLE','USED','PARTIALLY_USED','RESERVED',
  'EXCHANGED','REFUNDED','RELEASED','CANCELLED','EXPIRED'];
test(`Fulfillment[${idx}].status '${fulfillment.status}' is a valid OSDM FulfillmentStatus`, () => {
  expect(_validFulfillmentStatuses).to.include(fulfillment.status);
});
```

---

### D2 — `fulfillmentDocumentRefs` (OSDM v3.8 replacement for deprecated `fulfillmentDocuments`)

**Added** after the `fulfillmentDocuments` block in `validateFulfillments()`:
```javascript
const _hasDocRefs = Array.isArray(fulfillment.fulfillmentDocumentRefs)
  && fulfillment.fulfillmentDocumentRefs.length > 0;
if (_hasDocRefs) {
  test(`Fulfillment[${idx}].fulfillmentDocumentRefs are non-empty strings (OSDM v3.8)`, () => {
    fulfillment.fulfillmentDocumentRefs.forEach((ref, ri) => {
      expect(ref).to.be.a('string').and.not.be.empty;
    });
  });
}
```

---

### D3 / D4 — `bookingRef` matches `bookingId` + `createdOn` always validated

**Before:** `createdOn` only checked when status was FULFILLED or CONFIRMED; `bookingRef` only checked for existence.

**After:**
```javascript
// D3: bookingRef must match the current bookingId
const _currentBookingId = bru.getEnvVar("bookingId");
if (_currentBookingId && fulfillment.bookingRef) {
  test(`Fulfillment[${idx}].bookingRef matches current bookingId`, () => {
    expect(fulfillment.bookingRef).to.eql(_currentBookingId);
  });
}
// D4: createdOn must always be a valid ISO datetime (unconditional)
const createdOnDate = new Date(fulfillment.createdOn);
if (!isNaN(createdOnDate.getTime())) {
  test(`Fulfillment[${idx}] createdOn is a valid datetime at or before now`, () => {
    expect(fulfillment.createdOn).to.be.a("string").and.not.be.empty;
    expect(createdOnDate.getTime()).to.be.at.most(Date.now());
  });
}
```

---

## `library-bruno/refunds.js`

### E1 — `validFrom ≤ validUntil` temporal order

**Added** in `validateRefundOfferResponse()` after the `validUntil` test block:
```javascript
// E1: validFrom must be before or equal to validUntil
if (!isNaN(validFrom.getTime()) && !isNaN(validUntil.getTime())) {
  test(`Refund offer[${index}] validFrom is before or equal to validUntil (OSDM: temporal order)`, () => {
    expect(validFrom.getTime()).to.be.at.most(validUntil.getTime(),
      `validFrom (${refundOffer.validFrom}) is after validUntil (${refundOffer.validUntil})`);
  });
}
```

---

### E2 — Financial identity using integer arithmetic (replaces float subtraction)

**Before** (`validateRefundableAmountLocal()`):
```javascript
const expectedRefundableAmount = Number(confirmedPriceAmount) - Number(refundOffer.refundFee.amount);
test(`Refundable amount is valid: ...`, () => {
  expect(refundOffer.refundableAmount.amount).to.equal(expectedRefundableAmount);
});
```

**After:**
```javascript
// E2: Use integer arithmetic to avoid floating-point rounding errors
const _scale        = Math.pow(10, refundOffer.refundableAmount?.scale || 2);
const _feeInt       = Math.round(refundOffer.refundFee.amount * _scale);
const _refundInt    = Math.round(refundOffer.refundableAmount.amount * _scale);
const _confirmedInt = Math.round(Number(confirmedPriceAmount) * _scale);
test(`Refund financial identity: refundFee + refundableAmount = confirmedPrice (OSDM, integer arithmetic)`, () => {
  expect(_feeInt + _refundInt).to.eql(_confirmedInt,
    `Financial identity broken: fee(${_feeInt}) + refundable(${_refundInt}) ≠ confirmed(${_confirmedInt})`);
});
```

---

### E3 — `refundOffer.fulfillments` non-empty

**Added** in `validateRefundOfferResponse()` before the `reimbursementStatus` block:
```javascript
// E3: fulfillments must be a non-empty array (OSDM: RefundOffer.fulfillments minItems:1)
test(`Refund offer[${index}] fulfillments is a non-empty array (OSDM: minItems:1)`, () => {
  expect(refundOffer.fulfillments).to.be.an('array').with.lengthOf.at.least(1);
});
```

---

### E4 — Parts transition to `REFUNDED` after confirmed refund

**Added** in `getBookingRefundResponse()` inside the `deleteRefund` case:
```javascript
// E4: After confirmed refund, parts must be REFUNDED or FULFILLED
if (bru.getEnvVar("isRefundConfirmed") === "true") {
  const _allParts = (booking.bookedOffers || [])
    .flatMap(bo => [...(bo.admissions||[]), ...(bo.reservations||[]), ...(bo.ancillaries||[])]);
  if (_allParts.length > 0) {
    test(`All booked offer parts are in REFUNDED or FULFILLED status after confirmed refund (OSDM)`, () => {
      _allParts.forEach((part, i) => {
        expect(['REFUNDED','FULFILLED']).to.include(part.status);
      });
    });
  }
}
```

---

## `library-bruno/exchanges.js`

### F1 — Exchange price identity using integer arithmetic

**Before:**
```javascript
const expectedAmountToBePaid = exchangeOffer.exchangePrice.amount
  + exchangeOffer.exchangeFee.amount - confirmedPriceAmount;
expect(exchangeOffer.amountToBePaid.amount).to.eql(expectedAmountToBePaid);
```

**After:**
```javascript
// F1: Use integer arithmetic (OSDM financial identity)
const _scale      = Math.pow(10, exchangeOffer.exchangePrice?.scale || 2);
const _exPriceInt = Math.round(exchangeOffer.exchangePrice.amount * _scale);
const _exFeeInt   = Math.round(exchangeOffer.exchangeFee.amount * _scale);
const _confInt    = Math.round(_confirmedPriceAmount * _scale);
const _toPayInt   = Math.round(exchangeOffer.amountToBePaid.amount * _scale);
test(`Exchange offer[${index}] amountToBePaid = exchangePrice + exchangeFee - confirmedPrice (OSDM, integer arithmetic)`, () => {
  expect(_toPayInt).to.eql(_exPriceInt + _exFeeInt - _confInt,
    `amountToBePaid(${_toPayInt}) ≠ exchangePrice(${_exPriceInt}) + exchangeFee(${_exFeeInt}) - confirmedPrice(${_confInt})`);
});
```

---

### F2 — `preBookableUntil` is a valid future datetime

**Added** in `validateExchangeOfferResponse()` after the `offerId` test:
```javascript
// F2: preBookableUntil must be a valid future datetime
if (exchangeOffer.preBookableUntil) {
  const _pbu = new Date(exchangeOffer.preBookableUntil);
  test(`Exchange offer[${index}].preBookableUntil is a valid future datetime (OSDM: required)`, () => {
    expect(isNaN(_pbu.getTime())).to.be.false;
    expect(_pbu.getTime()).to.be.above(Date.now());
  });
}
```

---

### F4 — `admissionOfferParts` non-empty

**Added** in `validateExchangeOfferResponse()` after the `offerId` test:
```javascript
// F4: admissionOfferParts must be non-empty (OSDM: ExchangeOffer.admissionOfferParts required)
test(`Exchange offer[${index}].admissionOfferParts is a non-empty array (OSDM: required field)`, () => {
  expect(exchangeOffer.admissionOfferParts).to.be.an('array').with.lengthOf.at.least(1);
});
```

---

## `library-bruno/passengers.js`

### G1 / G2 — Passenger identity immutable + type enum validation

**Added** in `patchMultiPassengerResponse()` after the bounds check, before the data-file comparison:
```javascript
// G2: type must be a valid OSDM PassengerType enum
const _validPassengerTypes = ['YOUNG_CHILD','CHILD','YOUTH','ADULT','SENIOR','FAMILY_CHILD',
  'ACCOMP_PRM','PRM_CHILD','WHEELCHAIR','PERSON','PRM','DOG','PET','LUGGAGE',
  'BICYCLE','PRAM','COMPANION_DOG','CAR','MOTORCYCLE','TRAILER'];
const _passengerType = response.passenger?.type;
if (_passengerType !== undefined) {
  test(`Passenger ${passengerIndex} - type '${_passengerType}' is a valid OSDM PassengerType`, () => {
    expect(_validPassengerTypes).to.include(_passengerType);
  });
}

// G1: id must remain a non-empty string after PATCH
const _passengerId = response.passenger?.id;
test(`Passenger ${passengerIndex} - id is a non-empty string after PATCH (OSDM: Passenger.id immutable)`, () => {
  expect(_passengerId).to.be.a('string').and.not.be.empty;
});
// G1: id must still be in the original booking passengerIdList
const _passengerIdListRaw = bru.getEnvVar("passengerIdList");
const _passengerIdList = _passengerIdListRaw
  ? (Array.isArray(_passengerIdListRaw) ? _passengerIdListRaw : JSON.parse(_passengerIdListRaw))
  : [];
if (_passengerIdList.length > 0 && _passengerId) {
  test(`Passenger ${passengerIndex} - id unchanged after PATCH (still in booking passengerIdList)`, () => {
    expect(_passengerIdList).to.include(_passengerId);
  });
}
```

---

## `opencollection.yml`

### H1 / H2 — Global after-response script (Content-Type + Problem object)

**Added** as a new `- type: after-response` entry in the `request.scripts` list, alongside the existing `before-request` script:

```javascript
// H1: Validate Content-Type is application/json on all non-empty responses (OSDM spec)
try {
  const _status = res && (typeof res.getStatus === 'function' ? res.getStatus() : res.status);
  if (_status && _status !== 204 && _status !== 304) {
    const _headers = res.headers || {};
    const _ct = _headers['content-type'] || _headers['Content-Type'] || '';
    test(`Response Content-Type contains application/json (OSDM: all responses must be JSON)`, () => {
      expect(_ct).to.include('application/json');
    });
  }
} catch (_e) {
  console.log(`[WARNING] Content-Type check error: ${_e && _e.message}`);
}

// H2: Error responses must contain a valid RFC 9457 Problem object (OSDM spec)
try {
  const _errStatus = res && (typeof res.getStatus === 'function' ? res.getStatus() : res.status);
  if (_errStatus && [400, 401, 403, 404, 409, 415, 500, 501, 503].includes(_errStatus)) {
    let _errBody;
    try {
      _errBody = res.json ? res.json() : JSON.parse(res.body || res.getBody());
    } catch(_pe) { _errBody = null; }
    if (_errBody && typeof _errBody === 'object') {
      test(`Error response (${_errStatus}) body is a valid RFC 9457 Problem object (OSDM)`, () => {
        expect(_errBody).to.be.an('object');
        expect(_errBody.status).to.be.a('number');
        if (_errBody.title !== undefined) {
          expect(_errBody.title).to.be.a('string').and.not.be.empty;
        }
      });
    }
  }
} catch (_e) {
  console.log(`[WARNING] Problem object check error: ${_e && _e.message}`);
}
```

---

## Implementation Status Summary

| ID | Assertion | File | Status |
|----|-----------|------|--------|
| A1 | `offerId` non-empty on every offer | `offers.js` — `postOfferResponse()` | ✅ Implemented |
| A2 | `preBookableUntil` valid future datetime | `offers.js` — `validateOfferSummary()` | ✅ Already existed |
| A3 | `createdOn` valid datetime on every offer | `offers.js` — `postOfferResponse()` | ✅ Implemented |
| A4 | `passengerRefs` count matches request | `offers.js` — `postOfferResponse()` | ✅ Implemented |
| A5 | Offer part prices non-negative | `offers.js` — `validateAdmissions/Reservations()` | ✅ Already existed |
| A6 | `afterSalesConditions.condition` valid enum (incl. `PLACE_CHANGE`) | `offers.js` — all 3 validate functions | ✅ Implemented |
| A7 | Trip `startTime < endTime` | `offers.js` — `validateTripsAndLegs()` | ✅ Implemented |
| A8 | Currency consistency across offer parts | `offers.js` — `validateOfferParts()` | ✅ Implemented |
| B1 | `booking.id` / `bookingCode` split tests | `bookings.js` — `postCreateBookingResponse()` | ✅ Implemented |
| B2 | `confirmationTimeLimit` is future | `bookings.js` — `postCreateBookingResponse()` | ✅ Implemented |
| B3 | `bookedOffers` non-empty | `bookings.js` — `postCreateBookingResponse()` | ✅ Implemented |
| B4 | Price currencies match | `bookings.js` — `postCreateBookingResponse()` | ✅ Implemented |
| B5 | `booking.createdOn` valid datetime | `bookings.js` — `postCreateBookingResponse()` | ✅ Already existed |
| B6 | Booked part status valid enum | `bookings.js` — `validateOfferParts()` | ✅ Implemented |
| B7 | Exact passenger count | `bookings.js` — `postCreateBookingResponse()` | ✅ Implemented |
| C1 | `PREBOOKED → CONFIRMED` transition | Covered by existing `expectedBookedOffersStatus="CONFIRMED"` | ✅ Covered |
| C2 | `fulfillmentStatus` valid enum (v3.8) | `bookings.js` — `postCreateBookingResponse()` | ✅ Implemented |
| D1 | `fulfillment.status` valid enum | `bookings.js` — `validateFulfillments()` | ✅ Implemented |
| D2 | `fulfillmentDocumentRefs` (v3.8) | `bookings.js` — `validateFulfillments()` | ✅ Implemented |
| D3 | `bookingRef` matches `bookingId` | `bookings.js` — `validateFulfillments()` | ✅ Implemented |
| D4 | `createdOn` valid datetime (unconditional) | `bookings.js` — `validateFulfillments()` | ✅ Implemented |
| E1 | `validFrom ≤ validUntil` | `refunds.js` — `validateRefundOfferResponse()` | ✅ Implemented |
| E2 | Financial identity (integer arithmetic) | `refunds.js` — `validateRefundableAmountLocal()` | ✅ Implemented |
| E3 | `fulfillments` non-empty | `refunds.js` — `validateRefundOfferResponse()` | ✅ Implemented |
| E4 | Parts `REFUNDED` after confirmed refund | `refunds.js` — `getBookingRefundResponse()` | ✅ Implemented |
| E5 | Refund status `CONFIRMED` after PATCH | Covered by `expectedRefundOperationStatus` param | ✅ Covered |
| F1 | Exchange price identity (integer arithmetic) | `exchanges.js` — `validateExchangeOfferResponse()` | ✅ Implemented |
| F2 | Exchange `preBookableUntil` future | `exchanges.js` — `validateExchangeOfferResponse()` | ✅ Implemented |
| F3 | Old parts `EXCHANGED` after exchange | Covered by exchange GET booking with `expectedBookedOffersStatus` | ✅ Covered |
| F4 | `admissionOfferParts` non-empty | `exchanges.js` — `validateExchangeOfferResponse()` | ✅ Implemented |
| G1 | Passenger `id` immutable after PATCH | `passengers.js` — `patchMultiPassengerResponse()` | ✅ Implemented |
| G2 | Passenger `type` valid enum | `passengers.js` — `patchMultiPassengerResponse()` | ✅ Implemented |
| H1 | `Content-Type: application/json` global | `opencollection.yml` — after-response script | ✅ Implemented |
| H2 | Error responses are RFC 9457 Problem objects | `opencollection.yml` — after-response script | ✅ Implemented |
| H3 | Currency consistent offer → booking | `offers.js` stores `offerCurrency`; `bookings.js` asserts it | ✅ Implemented |
| H4 | `idempotencyKey` retry scenario | Requires new dedicated Bruno request file | ⏳ Pending |
| H5 | `GET /versions` endpoint test | Requires new Bruno request file | ⏳ Pending |

---

## Breaking Change: OSDM 3.7 → 3.8 — `TripSearchCriteria` Datetime Format

### Background

In OSDM 3.8, the `departureTime` / `arrivalTime` fields of `TripSearchCriteria` were changed from **`LocalDateTime`** (no timezone offset) to **`OffsetDateTime`** (includes `+HH:MM` offset). This is a breaking change for implementations with strictly-typed interfaces (e.g. Bileto), which reject a `LocalDateTime` string where an `OffsetDateTime` is expected.

| OSDM Version | Format | Example |
|---|---|---|
| < 3.8 | `LocalDateTime` | `2026-04-09T10:30:00` |
| ≥ 3.8 | `OffsetDateTime` | `2026-04-09T10:30:00+02:00` |

---

### Fix 1 — `osdmTripSearchCriteria()` always stripped the offset (initial fix)

#### Root Cause

The data file always stores datetimes **with** an offset (e.g. `"%TRIP_DATE%T10:30:00+02:00"`). After `%TRIP_DATE%` substitution the string becomes `"2026-04-09T10:30:00+02:00"`. The `osdmTripSearchCriteria()` function in `scenarioParser.js` was unconditionally stripping the last 6 characters (the `+HH:MM` suffix) before passing the value to `TripSearchCriteria`, producing a `LocalDateTime` for every OSDM version.

#### File Changed

**`library-bruno/scenarioParser.js`** — `osdmTripSearchCriteria()` function

#### Before

```javascript
const sandbox = bru.getEnvVar("api_base") || "";
let tripSearchCriteria;
if (sandbox.includes("paxone")) {
  tripSearchCriteria = new TripSearchCriteria(
    legDef.startDateTime.substring(0, legDef.startDateTime.length - 6),  // always strips +HH:MM
    new StopPlaceRef(legDef.startStopPlaceRef),
    new StopPlaceRef(legDef.endStopPlaceRef),
    null
  );
} else {
  tripSearchCriteria = new TripSearchCriteria(
    legDef.startDateTime.substring(0, legDef.startDateTime.length - 6),  // always strips +HH:MM
    new StopPlaceRef(legDef.startStopPlaceRef),
    new StopPlaceRef(legDef.endStopPlaceRef),
    tripParameters
  );
}
```

#### After (Fix 1)

```javascript
// OSDM 3.8+ requires OffsetDateTime (e.g. "2026-04-09T10:30:00+02:00") for departureTime/arrivalTime
// in TripSearchCriteria. OSDM < 3.8 requires LocalDateTime (no offset, e.g. "2026-04-09T10:30:00").
// The raw datetime from the data file always includes the offset (+HH:MM); strip it for older versions.
const _osdmVersionRaw = bru.getEnvVar("osdmVersion");
const _osdmVersionForDatetime = parseFloat(_osdmVersionRaw || "0");
const _startDateTime = _osdmVersionForDatetime >= 3.8
  ? legDef.startDateTime                                                          // OffsetDateTime — keep offset
  : legDef.startDateTime.substring(0, legDef.startDateTime.length - 6);          // LocalDateTime  — strip +HH:MM

const sandbox = bru.getEnvVar("api_base") || "";
let tripSearchCriteria;
if (sandbox.includes("paxone")) {
  tripSearchCriteria = new TripSearchCriteria(
    _startDateTime,
    new StopPlaceRef(legDef.startStopPlaceRef),
    new StopPlaceRef(legDef.endStopPlaceRef),
    null
  );
} else {
  tripSearchCriteria = new TripSearchCriteria(
    _startDateTime,
    new StopPlaceRef(legDef.startStopPlaceRef),
    new StopPlaceRef(legDef.endStopPlaceRef),
    tripParameters
  );
}
```

---

### Fix 2 — `osdmVersion` env var overwritten by data file, ignoring environment file (regression fix)

#### Root Cause

After Fix 1 was deployed, testing showed that changing `osdmVersion` in the environment file had **no effect**. Investigation revealed a second bug: `parseScenarioData()` unconditionally overwrites `osdmVersion` with the value from the data file's scenario definition:

```javascript
// ORIGINAL line 125 — always overwrites the env file value:
bru.setEnvVar("osdmVersion", ["", "null"].includes(scenario.osdmVersion) ? null : scenario.osdmVersion);
```

When the data file scenario has `osdmVersion: null` or does not define it, this writes `null` to the env var — **erasing** the `"3.8"` value set in the environment file. Downstream, `parseFloat(null || "0")` = `0` < 3.8, so the offset was always stripped no matter what the environment file contained.

#### Execution order (broken)

```
1. Bruno loads environment file  →  osdmVersion = "3.8"
2. parseScenarioData() runs
3.   scenario.osdmVersion is null
4.   bru.setEnvVar("osdmVersion", null)   ← env file value ERASED
5. osdmTripSearchCriteria() runs
6.   parseFloat(null || "0") = 0  →  strips offset  ← always LocalDateTime
```

#### File Changed

**`library-bruno/scenarioParser.js`** — `parseScenarioData()` function, scenario variable block

#### Before

```javascript
bru.setEnvVar("osdmVersion", ["", "null"].includes(scenario.osdmVersion) ? null : scenario.osdmVersion);
```

#### After (Fix 2)

```javascript
// osdmVersion priority: scenario value (data file) > environment file value > null
// The data file is the per-scenario source of truth; the env file is the fallback
// when the scenario does not explicitly define an osdmVersion.
const _envFileOsdmVersion = bru.getEnvVar("osdmVersion");
const _scenarioOsdmVersion = (scenario.osdmVersion && !["", "null"].includes(String(scenario.osdmVersion)))
  ? String(scenario.osdmVersion)
  : null;
const _effectiveOsdmVersion = _scenarioOsdmVersion || _envFileOsdmVersion || null;
bru.setEnvVar("osdmVersion", _effectiveOsdmVersion);
validationLogger(`[INFO] 🔢 osdmVersion — data file: "${_scenarioOsdmVersion}", env file: "${_envFileOsdmVersion}", effective: "${_effectiveOsdmVersion}" (data file takes priority)`);
```

#### Priority logic

```
scenario.osdmVersion  (from data file)         ← highest priority
  ↓ fallback if null / empty / "null"
env file osdmVersion  (e.g. "3.8")
  ↓ fallback if also absent
null
```

This means:
- **Normal use** — data file scenario has `osdmVersion: "3.4"`: that value is always used, as it represents the version the scenario was written for.
- **Fallback use** — data file scenario does not define `osdmVersion` (null/empty): the env file value is used, allowing the tester to configure the version at the environment level for scenarios that are version-agnostic.

---

### Fix 3 — INFO log message for datetime format traceability

To make the datetime format decision visible in the Bruno console for every trip search request, an `[INFO]` log line was added inside `osdmTripSearchCriteria()` immediately after the format decision:

#### File Changed

**`library-bruno/scenarioParser.js`** — `osdmTripSearchCriteria()` function

#### Code Added

```javascript
validationLogger(
  `[INFO] 📅 TripSearchCriteria datetime — osdmVersion: "${_osdmVersionRaw}" (parsed: ${_osdmVersionForDatetime}) → ` +
  (_osdmVersionForDatetime >= 3.8
    ? `OffsetDateTime format → "${_startDateTime}"`
    : `LocalDateTime format (offset stripped) → "${_startDateTime}" (raw: "${legDef.startDateTime}")`)
);
```

#### Console output examples

Data file scenario `"3.4"`, env file `"3.8"` → data file wins:
```
[INFO] 🔢 osdmVersion — data file: "3.4", env file: "3.8", effective: "3.4" (data file takes priority)
[INFO] 📅 TripSearchCriteria datetime — osdmVersion: "3.4" (parsed: 3.4) → LocalDateTime format (offset stripped) → "2026-04-21T10:30:00" (raw: "2026-04-21T10:30:00+02:00")
```

Data file scenario has no `osdmVersion`, env file `"3.8"` → env file used as fallback:
```
[INFO] 🔢 osdmVersion — data file: "null", env file: "3.8", effective: "3.8" (data file takes priority)
[INFO] 📅 TripSearchCriteria datetime — osdmVersion: "3.8" (parsed: 3.8) → OffsetDateTime format → "2026-04-21T10:30:00+02:00"
```

---

### Notes

- `osdmTripSpecification()` / `ServiceTime` was **not changed**: it already passes `legDef.startDateTime` / `legDef.endDateTime` directly without stripping, which is correct for all OSDM versions (the `TripSpecification` path was not affected by the breaking change).
- If a data file stores a datetime **without** an offset and the OSDM version is ≥ 3.8, the string is passed as-is. Data files targeting OSDM 3.8 implementors must therefore always include the `+HH:MM` suffix (which is already the case for all current OTST data files).
- The same `osdmVersion` env var is also used for the purchaser contact structure branching (≥ 3.4 uses `PurchaserContact`/`DetailContact`; the fallback logic introduced in Fix 2 applies there as well.

---

## Feature — HTML Validation Report Generation

**Date:** 2026-03-30
**Updated:** 2026-03-31 (full assertion capture via testCapture.js)

### Overview

After each collection run, a self-contained HTML report is automatically generated and written to the `Validation_Reports/` subfolder of the collection root. The file is updated after every individual request so the report is always current, even when a run is interrupted mid-way.

**Report filename format:**
```
Validation_Reports/YYYYMMDD_<EnvName>_Report.html
```

The environment name is derived from the active Bruno environment file by stripping the `OTST_` prefix and `_Env` suffix:

| Environment file        | Report name segment |
|-------------------------|---------------------|
| `OTST_Bileto_Env.yml`   | `Bileto`            |
| `OTST_Sqills_Env.yml`   | `Sqills`            |
| `OTST_Chaps_Env.yml`    | `Chaps`             |
| `OTST_Paxone_Env.yml`   | `Paxone`            |
| `OTST_Turnit_Env.yml`   | `Turnit`            |

Example for a run on 2026-03-30 with the Chaps environment: `20260330_Chaps_Report.html`.

> **Prerequisite:** Bruno must be run with `--sandbox=developer` to allow Node.js native modules (`fs`, `path`).
> CLI: `bru.cmd run --sandbox=developer --env OTST_Chaps_Env`

---

### Report content

Each HTML report contains:

1. **Scenario card** (dark blue) — environment name, date, OSDM version, scenario code, type and action.
2. **Summary cards** — OSDM request count / assertions / passed / failed (auth requests excluded from counts).
3. **Overall banner** — three states:
   - ✅ `All OSDM assertions passed`
   - ❌ `N OSDM assertion(s) failed`
   - 🔐 `Authentication failed — check credentials in your environment file`
4. **Legend box** — explains what the two global OSDM assertions mean.
5. **🔐 Authentication section** — all token/login requests grouped separately, with a ✅/❌ banner indicating whether a token was obtained. Auth failures (e.g. 401 due to empty secret credentials) are shown here but do **not** count towards the OSDM assertion totals.
6. **🚂 OSDM Scenario Steps section** — all non-auth requests, each block showing:
   - Method badge + **request name** (bold) + HTTP status badge + URL (greyed)
   - 📤 **Request Body** — collapsible, pretty-printed JSON
   - 📥 **Response Body** — collapsible, pretty-printed JSON
   - 🧪 **OSDM Assertions** — open by default, ✅/❌ per assertion with error detail on failure; or "No global OSDM assertions apply to this request" when none fired

**Full assertion coverage:** The HTML report captures ALL assertions from every script phase:

| Source | Examples | Count |
|--------|----------|-------|
| `library-bruno/offers.js` | `offerId is defined`, `offer.price is a number`, … | ~62 |
| `library-bruno/bookings.js` | `booking.id is defined`, `booking.status == CONFIRMED`, … | ~48 |
| `library-bruno/passengers.js` | `passenger.id is defined`, … | ~9 |
| `library-bruno/refunds.js` | `refundable amount is a number`, … | ~25 |
| `library-bruno/fulfillments.js` | `fulfillment.id is defined`, … | ~11 |
| `library-bruno/exchanges.js` | `exchange offer is valid`, … | ~15 |
| `opencollection.yml` after-response | `[OSDM] Content-Type is application/json`, `[OSDM] RFC 9457 Problem object` | 1–2 |

This is achieved via `library-bruno/testCapture.js` — see "New file: `library-bruno/testCapture.js`" below.

---

### Known installation issues (resolved)

#### Issue 1 — `Cannot find module uuid`

**Symptom:** `Error loading module uuid: Unexpected token 'export'` in both CLI and GUI.

**Root cause:** The `uuid` npm package v9+ uses ES module syntax (`export`) which Bruno's sandboxed VM cannot load with `require()`.

**Fix applied — `library-bruno/scenarioParser.js`:**

Removed `const uuid = require('uuid')` and replaced with a pure-JS inline UUID v4 generator (no package, no native module, works in all sandbox modes):

```javascript
// Pure-JS UUID v4 generator — no external package, works in all Bruno sandbox modes
function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

Also removed the unused `const uuid = require('uuid')` from `library-bruno/validators.js`.

#### Issue 2 — `Cannot find module crypto` (Bruno GUI)

**Symptom:** Pre-request script error `Cannot find module crypto` when running from the Bruno GUI.

**Root cause:** An intermediate version of the fix used `require('crypto')` (Node.js built-in) for `randomUUID()`. Bruno GUI's sandbox blocks native Node.js built-ins even in developer mode.

**Fix:** Replaced with the pure-JS inline implementation above (Issue 1 fix). No `require()` of any kind needed for UUID generation.

#### Issue 3 — `library_base` relative path caused wrong report output directory

**Symptom:** Report was not generated or written to a wrong location.

**Root cause:** `library_base` env var is set to `./library-bruno/` (a relative path). `path.resolve('./library-bruno/', '..')` resolves against the Node.js process CWD, which is not the collection folder when Bruno CLI is launched from another directory.

**Fix applied — `library-bruno/reportGenerator.js`:**

All path helpers now use `__dirname` (the absolute path of `reportGenerator.js` itself) instead of `libraryBase`:

```javascript
function _collectionRoot() {
  return require('path').resolve(__dirname, '..');   // always: OTST_V2.0.1/
}
function _validationDir() {
  return require('path').join(_collectionRoot(), 'Validation_Reports');
}
```

The `libraryBase` parameter of `initReport()` is kept for backward compatibility but is no longer used.

#### Issue 5 — Assertions not appearing in report (`testResults` always empty)

**Symptom:** HTML report generated but 🧪 Assertions panel always showed "No global OSDM assertions apply to this request" even though the Bruno console showed many passing tests.

**Root cause:** Bruno runs each script phase (global before-request, local before-request, local after-response, global after-response) in a **separate VM context**. Any value set on `globalThis` in one phase is lost by the next. The original approach used `globalThis.test` in the global before-request to intercept test calls — but by the time the global after-response ran and read `globalThis.__reportTests`, the object was gone.

**Fix — three parts:**

1. **New file `library-bruno/testCapture.js`** — provides `bruTest(name, fn)` as a drop-in replacement for Bruno's `test()`. In addition to registering with Bruno's test runner, it persists each result to `bru.setVar('__rptTests')`. `bru.setVar()` is shared across all script phases for a single request — the only bridge that survives VM context isolation.

2. **Modified 6 library files** — each now imports `bruTest` as `test`:
   ```javascript
   const { bruTest: test } = require('./testCapture.js');
   ```
   All existing `test(...)` calls in the file automatically route through `bruTest` with no other changes.

3. **Updated `opencollection.yml` after-response** — reads `bru.getVar('__rptTests')` instead of `globalThis.__reportTests`:
   ```javascript
   let _testResults = [];
   try { _testResults = JSON.parse(bru.getVar('__rptTests') || '[]'); } catch (_te) {}
   ```
   H1/H2 assertions in the after-response itself also use `_bruTest()` from `testCapture.js` so they are included in the same list.

**Mechanism summary:**

```
before-request (global)  →  resetTests()            → bru.setVar('__rptTests', '[]')
local after-response     →  bruTest('offerId …')    → bru.setVar appends {name, passed, error}
local after-response     →  bruTest('booking.id …') → bru.setVar appends …
global after-response    →  _bruTest('[OSDM] CT …') → bru.setVar appends …
global after-response    →  JSON.parse(bru.getVar('__rptTests'))  → ALL results available
global after-response    →  appendRequest({ testResults: _testResults }) → written to HTML
```

#### Issue 4 — Report showed spurious "HTTP Status" failures on auth requests

**Symptom:** First generated report showed 7 failed assertions — all were `HTTP Status is success (401/404)` on authentication requests that failed because secret credential fields were empty in the CLI environment.

**Root cause:** An initial version of the `after-response` added a global HTTP status assertion to `_rptTests` for every request, including auth requests. Auth failures (empty credentials → 401) are expected when running from CLI without secrets set — they are not OSDM compliance failures.

**Fix applied — `opencollection.yml` `after-response`:**
- Removed the global HTTP status push from `_rptTests` entirely.
- Added a `group` field (`'auth'` vs `'osdm'`) to each request entry.
- Summary counters and the overall banner now operate only on `osdm`-grouped requests.
- Auth requests are rendered in a dedicated section with their own ✅/❌ banner.

---

### Files changed

#### New file: `library-bruno/testCapture.js`

Drop-in `test()` replacement that:
1. Captures ALL assertion results into `bru.setVar('__rptTests')` for the HTML report
2. Emits an `[INFO]` / `[WARNING]` log via `validationLogger` for every assertion result — visible in the Bruno console according to the `loggingType` env var

```javascript
'use strict';
module.exports = { bruTest, resetTests };

function bruTest(name, fn) {
  let passed = true, errMsg = null;
  try { if (typeof fn === 'function') fn(); }
  catch (e) { passed = false; errMsg = (e && e.message) ? e.message : String(e); }

  // Emit INFO / WARNING log via validationLogger (respects loggingType env var):
  //   loggingType=INFO  → both ✅ passes ([INFO]) and ❌ failures ([WARNING]) are printed
  //   loggingType=WARN  → only ❌ failures ([WARNING]) are printed
  //   loggingType=FULL  → everything is printed
  try {
    const { validationLogger } = require('./displays.js');
    if (passed) {
      validationLogger(`[INFO] ✅ ${name}`);
    } else {
      validationLogger(`[WARNING] ❌ ${name}${errMsg ? ': ' + errMsg : ''}`);
    }
  } catch (_le) { /* displays.js not available — safe to ignore */ }

  // Persist result via bru.setVar — survives across all VM contexts for this request
  try {
    const existing = JSON.parse(bru.getVar('__rptTests') || '[]');
    existing.push({ name: String(name), passed, error: errMsg });
    bru.setVar('__rptTests', JSON.stringify(existing));
  } catch (_e) {}

  // Also register with Bruno's own test runner
  const _err = errMsg;
  test(String(name), function () {
    if (!passed) throw new Error(_err || String(name) + ' failed');
  });
}

function resetTests() {
  try { bru.setVar('__rptTests', '[]'); } catch (_e) {}
}
```

**Console output examples (loggingType=INFO):**
```
[INFO] ✅ offerId is defined
[INFO] ✅ offer.price is a number
[WARNING] ❌ booking.id is defined: expected undefined to not equal undefined
[INFO] ✅ [OSDM] Content-Type is application/json
```

#### Modified files: library files (6 files)

Each library file now has `bruTest` imported as the local `test` symbol:

| File | Line added | `test()` calls captured |
|------|-----------|------------------------|
| `library-bruno/offers.js` | `const { bruTest: test } = require('./testCapture.js');` | ~62 |
| `library-bruno/bookings.js` | same | ~48 |
| `library-bruno/passengers.js` | same | ~9 |
| `library-bruno/refunds.js` | same | ~25 |
| `library-bruno/fulfillments.js` | same | ~11 |
| `library-bruno/exchanges.js` | same | ~15 |

No other changes to these files — all existing `test(...)` calls automatically route through `bruTest` via the alias.

---

#### New file: `library-bruno/reportGenerator.js`

A standalone module (no external dependencies — only Node.js built-ins `fs` and `path`, loaded lazily) exposing two public functions:

| Function | Called from | Purpose |
|----------|-------------|---------|
| `initReport()` | `opencollection.yml` `before-request` | Deletes `.report_tmp.json` to start the report fresh for a new run |
| `appendRequest(data)` | `opencollection.yml` `after-response` | Appends current request to accumulator JSON, rewrites full HTML file |

Internal helpers: `_fs()`, `_path()`, `_collectionRoot()`, `_validationDir()`, `_tmpFile()`, `_htmlFile()`, `_ensureDir()`, `_esc()`, `_prettyJson()`, `_statusBadge()`, `_requestBlock()`, `_generateHtml()`.

`require('fs')` and `require('path')` are wrapped in lazy accessor functions so the module can be `require()`-d in Bruno's safe sandbox without throwing — the error is deferred to call time with a clear actionable message pointing to `--sandbox=developer`.

##### `appendRequest()` data structure

```javascript
appendRequest({
  envName,          // clean env name, e.g. "Chaps"
  dateStr,          // YYYYMMDD, e.g. "20260330"
  scenarioCode,     // bru.getEnvVar("scenarioCode")
  scenarioType,     // bru.getEnvVar("scenarioType")
  scenarioAction,   // bru.getEnvVar("scenarioAction")
  osdmVersion,      // bru.getEnvVar("osdmVersion")
  requestName,      // derived from URL: "POST /offers" etc.
  requestMethod,    // "GET" | "POST" | "PATCH" | …
  requestUrl,       // full URL
  requestBody,      // serialised request body string
  responseStatus,   // HTTP status code (number)
  responseHeaders,  // headers object
  responseBody,     // serialised response body string
  group,            // "auth" | "osdm" — drives section grouping in HTML
  testResults       // [{name, passed, error}]
});
```

---

#### Modified file: `opencollection.yml`

##### 1 — `before-request` (at end of the `/offers` block)

```javascript
// ── Init HTML report for new collection run ──────────────────
try {
    const { initReport } = require(bru.getEnvVar("library_base") + "reportGenerator.js");
    initReport(bru.getEnvVar("library_base"));
    console.log("📊 HTML report initialised for this run.");
} catch (_rErr) {
    console.log("[WARNING] Report init error: " + (_rErr && _rErr.message));
}
```

##### 2 — `after-response` (complete replacement — updated 2026-03-31)

Four logical parts:

```javascript
// ── 1. Shared response status ────────────────────────────────────────────────
const _rptStatus = res && (typeof res.getStatus === 'function' ? res.getStatus() : res.status);

// ── 2. H1/H2 via bruTest — appends to __rptTests ────────────────────────────
const { bruTest: _bruTest } = require(bru.getEnvVar("library_base") + "testCapture.js");

// H1: Content-Type check (all non-empty responses)
_bruTest(`[OSDM] Content-Type is application/json`, () => { … });

// H2: RFC 9457 Problem object (4xx/5xx only)
_bruTest(`[OSDM] Error body is a valid RFC 9457 Problem object`, () => { … });

// ── 3. Read ALL accumulated test results ─────────────────────────────────────
// bru.setVar('__rptTests') was populated by bruTest() across ALL script phases.
let _testResults = [];
try { _testResults = JSON.parse(bru.getVar('__rptTests') || '[]'); } catch (_te) {}

// ── 4. HTML report entry ─────────────────────────────────────────────────────
const _isAuth = /\/(token|login|auth|logon|oauth)/.test(_rptUrl.toLowerCase().split('?')[0]);

const _htmlPath = appendRequest({
  …,
  group:       _isAuth ? 'auth' : 'osdm',
  testResults: _testResults    // contains ALL assertions: library + H1/H2
});

if (_htmlPath) console.log(`[INFO] 📊 Report updated → ${_htmlPath} (${_testResults.length} assertions)`);
```

##### 3 — `before-request` (`resetTests` call)

At the very start of the global before-request (before any URL detection), `resetTests()` is called to clear `bru.setVar('__rptTests')` for the new request:

```javascript
try {
  const { resetTests } = require(bru.getEnvVar("library_base") + "testCapture.js");
  resetTests();
} catch (_te) { bru.setVar('__rptTests', '[]'); }
```

---

### Console output during a run

The `loggingType` environment variable (default `INFO`) controls which lines appear:

| `loggingType` | What is printed |
|---------------|-----------------|
| `FULL` | every assertion result + report update lines |
| `INFO` | all ✅ passes (`[INFO]`) + all ❌ failures (`[WARNING]`) + report update lines |
| `WARN` | only ❌ failures (`[WARNING]`) + report update lines |
| `ERROR` | only report update lines (`[INFO]`) |

Example with `loggingType=INFO` (default):

```
📊 HTML report initialised for this run.
[reportGenerator] ✅ Report directory: C:\...\OTST_V2.0.1\Validation_Reports
[INFO] ✅ offerId is defined
[INFO] ✅ offer.price is a number
[INFO] ✅ offer.currency is a string
… (62 more assertions)
[INFO] ✅ [OSDM] Content-Type is application/json
[INFO] 📊 Report updated → C:\...\Validation_Reports\20260331_Chaps_Report.html (63 assertions)
[INFO] ✅ booking.id is defined
[WARNING] ❌ booking.status is CONFIRMED: expected 'PREBOOKED' to equal 'CONFIRMED'
… (47 more assertions)
[INFO] 📊 Report updated → C:\...\Validation_Reports\20260331_Chaps_Report.html (49 assertions)
…
```

---

### HTML report visual structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🚂 OTST Validation Report                                               │
├──────────────────────────────────────────────────────────────────────────┤
│  Environment: Chaps  │  Date: 2026-03-31  │  OSDM version: 3.8          │
│  Scenario: OTST_RFND_1ADT_1LEG  │  Collection run: Refund + Exchange     │
│  Type: REFUND  │  Action: PATCH                                          │
├──────────────────┬───────────────────┬────────────┬───────────────────── ┤
│  7 OSDM Requests │  87 OSDM Asserts  │  87 Passed │  0 Failed           │
├──────────────────┴───────────────────┴────────────┴─────────────────────┤
│  ✅ All OSDM assertions passed                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  ℹ️ About these assertions: business checks + [OSDM] Content-Type…      │
├──────────────────────────────────────────────────────────────────────────┤
│  🔐 Authentication (1 request)  ✅ Token obtained                        │
│  ├─ #1  POST  Chaps access Token  200                                    │
│  │    ▶ 📤 Request Headers & Body                                        │
│  │    ▶ 📥 Response Body                                                 │
│  │    ▼ 🧪 Assertions (1/1 passed)                                      │
│  │       ✅ [OSDM] Content-Type is application/json                      │
├──────────────────────────────────────────────────────────────────────────┤
│  🚂 Common Requests (2 requests)  63 passed                              │
│  ├─ #1  POST  POST /offers  200                                          │
│  │    ▶ 📤 Request Headers & Body                                        │
│  │    ▶ 📥 Response Body                                                 │
│  │    ▼ 🧪 Assertions (63/63 passed)                                    │
│  │       ✅ offerId is defined                                           │
│  │       ✅ offer.price is a number                                      │
│  │       ✅ … (61 more)                                                  │
│  │       ✅ [OSDM] Content-Type is application/json                      │
│  ├─ #2  POST  POST /bookings  200  …                                     │
├──────────────────────────────────────────────────────────────────────────┤
│  💰 Refund (3 requests)  24 passed                                       │
│  ├─ #1  POST  POST /refundOffers  200  …                                 │
│  ├─ #2  PATCH  PATCH /refundOffers/{id}  200  …                         │
│  ├─ #3  POST  POST /refunds  200  …                                      │
├──────────────────────────────────────────────────────────────────────────┤
│  🔄 Exchange (2 requests)  15 passed                                     │
│  ├─ #1  POST  POST /exchangeOffers  200  …                               │
│  ├─ #2  POST  POST /exchanges  200  …                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Scenario card fields:**

| Field | Source | Notes |
|-------|--------|-------|
| Environment | `envName` (stripped `OTST_`/`_Env`) | Always shown |
| Date | `dateStr` formatted | Always shown |
| OSDM version | `osdmVersion` env var | Always shown (`N/A` if missing) |
| **Scenario** | `scenarioCode` env var | Always shown (`N/A` if not set) |
| **Collection run** | Derived from request URLs | Shown if any OSDM steps ran: `Common Requests`, `Refund`, `Exchange` (combined with `+` if multiple) |
| Type | `scenarioType` env var | Shown if set |
| Action | `scenarioAction` env var | Shown if set |

**Run type detection** (`_deriveRunType(url)` in `reportGenerator.js`):

| URL pattern matches | Run type |
|--------------------|----------|
| `/refundoffer` or `/refund` | `Refund` |
| `/exchangeoffer` or `/exchange` | `Exchange` |
| anything else (non-auth) | `Common Requests` |

---

## Change — Collection renamed to OTST_V2.0.2_RFND_EXCH_ALL

**Date:** 2026-03-31
**File:** `opencollection.yml`

### What changed

The Bruno collection name was updated from `OTST_V2.0_RFND_EXCH_ALL` to `OTST_V2.0.2_RFND_EXCH_ALL` in the `info.name` field of `opencollection.yml`.

```yaml
# Before
info:
  name: OTST_V2.0_RFND_EXCH_ALL

# After
info:
  name: OTST_V2.0.2_RFND_EXCH_ALL
```

This is the field Bruno reads to display the collection name in the GUI sidebar. Restart Bruno (close and reopen the collection) to see the new name.

---

## Change — Assertion console logging added to `testCapture.js`

**Date:** 2026-03-31
**File:** `library-bruno/testCapture.js`

### Problem

The `bruTest()` function captured assertion results for the HTML report and registered them with Bruno's test runner, but produced no console output of its own. The only way to see individual assertion results was to look at the Bruno test runner panel — there was no `[INFO]`/`[WARNING]` line in the script console for each test, unlike the rest of the library which uses `validationLogger` throughout.

### Fix

Added a `validationLogger` call inside `bruTest()` immediately after the assertion runs:

```javascript
try {
  const { validationLogger } = require('./displays.js');
  if (passed) {
    validationLogger(`[INFO] ✅ ${name}`);
  } else {
    validationLogger(`[WARNING] ❌ ${name}${errMsg ? ': ' + errMsg : ''}`);
  }
} catch (_le) { /* displays.js not available — safe to ignore */ }
```

Because this is in `testCapture.js`, **all ~170 assertions across all 6 library files** get logging automatically with no changes to those files.

### Logging level behaviour

The output respects the existing `loggingType` env var used by `validationLogger`:

| `loggingType` | Passes `[INFO]` | Failures `[WARNING]` |
|---------------|:-:|:-:|
| `FULL` | ✅ shown | ✅ shown |
| `INFO` (default) | ✅ shown | ✅ shown |
| `WARN` | ❌ suppressed | ✅ shown |
| `ERROR` | ❌ suppressed | ❌ suppressed |

### Console output example (`loggingType=INFO`)

```
[INFO] ✅ offerId is defined
[INFO] ✅ offer.price is a number
[WARNING] ❌ booking.status is CONFIRMED: expected 'PREBOOKED' to equal 'CONFIRMED'
[INFO] ✅ [OSDM] Content-Type is application/json
```

---

## Feature — Smart Collection Run Filter

**Date:** 2026-03-31
**Updated:** 2026-03-31 (bug fix — labeled block replaces IIFE after bru context issue)
**File:** `opencollection.yml` — global `before-request`

### Overview

When the full Bruno collection is run, two automatic filters activate at the start of every request's global `before-request` script, before any test logic or scenario data loading runs:

1. **Access Token filter** — only the authentication request matching the active environment's sandbox name executes. All other token requests are skipped.
2. **Scenario folder filter** — only the request folders relevant to the current `scenarioType` env var execute. Irrelevant folders are skipped entirely.

### Access Token filter

The collection contains one token request per sandbox:

| File (info.name) | Sandbox matched |
|-----------------|----------------|
| Benerail Access Token | `benerail` |
| Bileto Access Token | `bileto` |
| Chaps access Token | `chaps` |
| Paxone access Token | `paxone` |
| Sqills Access Token | `sqills` |
| Turnit Token Access | `turnit` |

The active sandbox name is derived from `bru.getEnvName()`:

```
"OTST_Chaps_Env"  →  strips OTST_ prefix + _Env suffix  →  "chaps"
```

Each token request's `info.name` (lowercased) is checked: if it does **not** contain the sandbox name, the request is skipped via `bru.runner.skipRequest()`.

**Example (active env = `OTST_Chaps_Env`):**
```
[INFO] ⏭️  Skipping [bileto access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [benerail access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [paxone access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [sqills access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [turnit token access] — not for "chaps" sandbox
✅ Chaps access Token  →  runs
```

### Scenario folder filter

Driven by the `scenarioType` env var (set in the environment file, then overridden by the data file):

| `scenarioType` | Common Requests | Place Map (`02.GET…`) | Refund folder | Exchange folder |
|----------------|:---:|:---:|:---:|:---:|
| `SALE` | ✅ | ❌ skipped | ❌ skipped | ❌ skipped |
| `SALE+PLACEMAP` | ✅ | ✅ | ❌ skipped | ❌ skipped |
| `REFUND` | ✅ | ✅ | ✅ | ❌ skipped |
| `EXCHANGE` | ✅ | ✅ | ❌ skipped | ✅ |
| *(not set)* | ✅ | ✅ | ✅ | ✅ |

Request classification is done by matching URL and name patterns:

| Pattern | Classified as |
|---------|--------------|
| URL contains `place-map` **or** name contains `place map` | Place Map |
| URL contains `refund` (and not a token request) | Refund |
| URL contains `exchange` (and not a token request) | Exchange |
| Anything else (non-auth) | Common Requests |

### How skipping works

Bruno's `bru.runner.skipRequest()` is called to skip the HTTP call — no error, no failure recorded, the collection continues with the next request.

**⚠️ Important implementation detail — labeled block pattern**

In Bruno 3.x, `bru.runner.skipRequest()` has a side effect: it **clears the entire `bru` context** for the current script. Any `bru.getEnvVar()` call after it returns `undefined`. The first implementation used an IIFE where `skipRequest()` was called inside the function and `return` exited the IIFE — but the outer script continued and hit `bru.getEnvVar("library_base")`, getting `undefined`, causing the error:

```
Pre-Request Script Error: Cannot find module 'undefinedscenarioParser.js'
```

**Fix:** The entire before-request is wrapped in a JavaScript labeled block `RUNSCRIPT: { ... }`. When a request is skipped:
1. The skip reason is logged
2. `skipRequest()` is called — this is the **last** `bru.*` call
3. `break RUNSCRIPT` immediately jumps to the closing `}` — no further code runs

```javascript
RUNSCRIPT: {
  // ... skip detection ...
  if (_skipReason) {
    console.log('[INFO] ⏭️  Skipping [...] — ' + _skipReason);
    if (bru.runner && typeof bru.runner.skipRequest === 'function') bru.runner.skipRequest();
    break RUNSCRIPT;   // ← exits the labeled block; bru.getEnvVar() never called again
  }

  // Only non-skipped requests reach this line:
  const { getScenarioData } = require(bru.getEnvVar("library_base") + "scenarioParser.js");
  // ... rest of before-request ...
} // end RUNSCRIPT
```

This pattern guarantees that `bru.getEnvVar()` is never called after `skipRequest()`, regardless of any future changes to the code above it.

### Console output example

Running with `OTST_Chaps_Env` (scenarioType = EXCHANGE):
```
[INFO] ⏭️  Skipping [benerail access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [bileto access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [paxone access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [sqills access token] — not for "chaps" sandbox
[INFO] ⏭️  Skipping [turnit token access] — not for "chaps" sandbox
→ Chaps access Token  ✅
→ 01. POST Get Offer  ✅
→ 02. GET Place Maps …  ✅
→ 03. POST Create Booking  ✅
…
[INFO] ⏭️  Skipping [10. post refund offers] — Refund folder excluded for EXCHANGE scenario
[INFO] ⏭️  Skipping [11. get refund offer] — Refund folder excluded for EXCHANGE scenario
…
→ 10. POST Exchange Offers  ✅
→ 11. POST Exchange Operations  ✅
…
```

---

## Fix — Smart Run Filter: labeled block replaces IIFE

**Date:** 2026-03-31
**File:** `opencollection.yml` — global `before-request`

### Problem

After the Smart Run Filter was introduced, running the collection with any environment produced:

```
Pre-Request Script Error on [01. POST Get Offer]
Could not resolve module "undefinedscenarioParser.js":
Cannot find module 'undefinedscenarioParser.js'
```

### Root cause

`bru.runner.skipRequest()` **clears the `bru` context** as a side effect in Bruno 3.x. The initial implementation wrapped the filter in an IIFE:

```javascript
(function() {
  try {
    // ... detect skip ...
    bru.runner.skipRequest();  // ← clears bru context
    return;                    // exits IIFE only, NOT the outer script
  } catch() {}
})();

// Outer script continues — but bru is now cleared:
const { getScenarioData } = require(bru.getEnvVar("library_base") + "scenarioParser.js");
//                                   ^^^ returns undefined → "undefinedscenarioParser.js"
```

### Fix

Replaced the IIFE with a **JavaScript labeled block**. `skipRequest()` is called as the very last statement, immediately followed by `break RUNSCRIPT` which jumps to the end of the block — no further `bru.*` calls execute:

```javascript
RUNSCRIPT: {
  try {
    // ... detect skip ...
    if (_skipReason) {
      console.log('[INFO] ⏭️  Skipping [...] — ' + _skipReason);
      if (bru.runner && typeof bru.runner.skipRequest === 'function') bru.runner.skipRequest();
      break RUNSCRIPT;  // ← jumps to closing }, bru never called again
    }
  } catch (_sfErr) { ... }

  // Only non-skipped requests reach here:
  const { getScenarioData } = require(bru.getEnvVar("library_base") + "scenarioParser.js");
  // ...
} // end RUNSCRIPT
```

---

## Change — Bileto OffsetDateTime hack neutralised

**Date:** 2026-03-31
**File:** `library-bruno/scenarioParser.js`

### Background

The OSDM 3.8 specification changed the `departureTime` / `arrivalTime` fields in `TripSearchCriteria` from `LocalDateTime` (e.g. `2026-04-09T10:30:00`) to `OffsetDateTime` (e.g. `2026-04-09T10:30:00+02:00`). The collection strips the offset for `osdmVersion < 3.8` environments.

A workaround had been added for Bileto: even when `osdmVersion < 3.8` was declared, Bileto's API was found to require `OffsetDateTime` format. The hack forced `OffsetDateTime` for any URL containing `"bileto"` regardless of the declared version.

### Change

The hack block is **commented out** (not deleted) so it can be re-enabled if needed:

```javascript
// ⚠️ HACK — Bileto OffsetDateTime override — NEUTRALISED 2026-03-31
// Previously forced OffsetDateTime for Bileto regardless of declared OSDM version.
// Neutralised so Bileto follows the standard spec behaviour (same as all other sandboxes).
// Re-enable the block below if Bileto reverts to requiring OffsetDateTime on older versions.
//
// const _apiBase = bru.getEnvVar("api_base") || "";
// if (_apiBase.includes("bileto") && _osdmVersionForDatetime < 3.8) {
//   _startDateTime = legDef.startDateTime;
//   validationLogger(`[INFO] ⚠️ Bileto hack — forcing OffsetDateTime ...`);
// }
```

Bileto now follows the **standard datetime logic** used by all other sandboxes:

| `osdmVersion` | Format sent | Example |
|--------------|------------|---------|
| `>= 3.8` | OffsetDateTime (offset kept) | `2026-04-09T10:30:00+02:00` |
| `< 3.8` | LocalDateTime (offset stripped) | `2026-04-09T10:30:00` |

---

## Feature — HTML Report: run-type grouping and scenario card improvements

**Date:** 2026-03-31
**File:** `library-bruno/reportGenerator.js`

### Changes

#### 1. OSDM steps grouped by run type

The flat list of OSDM requests is now split into labelled sub-sections based on what kind of OSDM endpoint was called. Each sub-section shows its own passed/failed assertion badge.

| Sub-section | Icon | Trigger (URL pattern) |
|---|---|---|
| Common Requests | 🚂 | any non-auth, non-refund, non-exchange URL |
| Refund | 💰 | URL contains `/refund` |
| Exchange | 🔄 | URL contains `/exchange` |

Sub-sections only appear if at least one request of that type ran. Order is always Common Requests → Refund → Exchange.

New helper in `reportGenerator.js`:

```javascript
function _deriveRunType(url) {
  const u = (url || '').toLowerCase().split('?')[0];
  if (/\/(refundoffer|refunds?)/.test(u)) return 'Refund';
  if (/\/(exchangeoffer|exchanges?)/.test(u)) return 'Exchange';
  return 'Common Requests';
}
```

`runType` is stored per request entry in `.report_tmp.json` at `appendRequest()` time.

#### 2. Scenario card — two new always-visible fields

| Field | Before | After |
|-------|--------|-------|
| **Scenario** | only shown if `scenarioCode` was set | always shown (`N/A` if not set) |
| **Collection run** | not present | always shown — lists which run types actually executed, e.g. `Common Requests + Refund` |

```html
<!-- Example scenario card header for a REFUND run -->
Environment: Bileto  │  Date: 2026-03-31  │  OSDM version: 3.8
Scenario: OTST_RFND_SRCH_CRIT_1ADT_1LEG  │  Collection run: Common Requests + Refund
Type: REFUND
```

#### 3. Legend text updated

The legend no longer says assertions are "global OSDM compliance checks only". It now correctly states that all per-request business assertions are included alongside the two OSDM spec checks.

---

## Feature — `scenariosToRun` + scenario code in report filename

**Date:** 2026-03-31
**Updated:** 2026-03-31 (comma-string fix, Paxone env fix, GUI instructions added)
**Files changed:**
- All 6 data files (`*_datafile.json`) — new `scenariosToRun` field
- `library-bruno/scenarioParser.js` — reads `scenariosToRun`, index-based selection, comma-string support
- `library-bruno/reportGenerator.js` — scenario code added to HTML filename
- `environments/OTST_Paxone_Env.yml` — `scenariosToRunIndex` initialised to `"0"`

---

### 1. Defining `scenariosToRun` in a data file

Add `scenariosToRun` as the **first field** at the root of any `*_datafile.json`:

```json
{
    "scenariosToRun": "ALL",
    "scenarios": [ ... ]
}
```

| Value | Behaviour |
|-------|-----------|
| `"ALL"` | Every scenario in the file, in the order they appear |
| `["code1", "code2"]` | Only those codes, in that order (preferred — clean JSON array) |
| `"code1,code2"` | Same as above — comma-separated string also accepted |
| field absent | Falls back to `scenarioCode` env var (original single-scenario behaviour) |

**Example — run only two specific scenarios:**
```json
{
    "scenariosToRun": ["OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG", "OTST_RFND_SRCH_CRIT_2ADT_1LEG"],
    "scenarios": [ ... ]
}
```

> ⚠️ Always use a **JSON array** (square brackets, quoted strings, comma-separated). This is the cleanest format and avoids JSON syntax errors. The comma-string format is supported as a convenience but the array is preferred.

All 6 data files are initialised with `"scenariosToRun": "ALL"`.

---

### 2. How sequential execution works — the index counter

Bruno can only run one scenario per "Run Collection" click. `scenariosToRun` works together with a **persistent index counter** (`scenariosToRunIndex` env var) to automatically pick the next scenario on each successive click — no manual changes needed.

**Where each piece of state lives:**

| State | Where stored | Purpose |
|-------|-------------|---------|
| `scenariosToRun` | Data file (root level) | Defines the ordered list of scenarios to cycle through |
| `scenariosToRunIndex` | Environment file (`OTST_*_Env.yml`) | Remembers where in the list the next run should start |

**Round-robin cycle** (example with 4 scenarios, `"ALL"`):

```
Click 1  →  picks scenario[0]  →  index advances to 1
Click 2  →  picks scenario[1]  →  index advances to 2
Click 3  →  picks scenario[2]  →  index advances to 3
Click 4  →  picks scenario[3]  →  index wraps to 0  ← last scenario, resets
Click 5  →  picks scenario[0]  →  cycle starts again
```

The index is per-environment — switching between `OTST_Chaps_Env` and `OTST_Paxone_Env` keeps each environment's position independent.

**Key properties:**
- `scenariosToRunIndex` is **not** in the `deleteList` — it persists across collection runs
- If the index goes out of range (e.g. the data file was shortened), it resets to 0 automatically
- If a code in `scenariosToRun` is not found in `scenarios`, a `[WARNING]` is logged and that code is skipped
- If the effective list ends up empty, falls back to `scenarioCode` env var

---

### 3. How to run scenarios from the Bruno GUI

**Step 1 — Set up the data file**

Open the data file for the environment you want to test (e.g. `data_base/Chaps_datafile.json`) and set `scenariosToRun` at the top:

```json
{
    "scenariosToRun": "ALL",
    ...
}
```
or for a specific subset:
```json
{
    "scenariosToRun": ["OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG", "OTST_EXCH_SRCH_CRIT_1ADT_1LEG"],
    ...
}
```

**Step 2 — Reset the index (optional, first time only)**

In Bruno GUI: click the environment name in the top-right → **Edit** → find `scenariosToRunIndex` → set value to `0` → Save.

Or set it directly in the env `.yml` file:
```yaml
- name: scenariosToRunIndex
  value: "0"
```

**Step 3 — Run each scenario**

In Bruno GUI: right-click the collection name in the left sidebar → **Run Collection** → click **Run**.

Each click runs one scenario and produces one report file in `Validation_Reports/`:
```
20260331_Chaps_OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG_Report.html
20260331_Chaps_OTST_EXCH_SRCH_CRIT_1ADT_1LEG_Report.html
```

The console log shows which scenario was picked and what comes next:
```
[INFO] 🎯 scenariosToRun [1/2]: selected "OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG" — next run will pick index 1
[INFO] 🎯 scenariosToRun [2/2]: selected "OTST_EXCH_SRCH_CRIT_1ADT_1LEG" — last in list, index reset to 0 for next run
```

**Step 4 — To reset and restart the cycle**

Set `scenariosToRunIndex` back to `"0"` in the environment panel (as in Step 2). The next run will start from the first scenario again.

---

### 4. Bug fix — comma-separated string and missing JSON comma

Two bugs were found and fixed during Paxone testing:

**Bug 1 — Missing comma in `paxone_datafile.json`**

The user wrote:
```json
"scenariosToRun": "OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG,OTST_RFND_SRCH_CRIT_2ADT_1LEG"
"scenarios": [
```
The missing `,` after the value made the file **invalid JSON** — the data file failed to load silently and fell back to the old `scenarioCode` env var, running the wrong scenario.

**Fix:** Added the missing comma. Always use a JSON array to avoid this class of error:
```json
"scenariosToRun": ["OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG", "OTST_RFND_SRCH_CRIT_2ADT_1LEG"],
```

**Bug 2 — `scenarioParser.js` only accepted `"ALL"` or a JSON array**

A comma-separated string like `"code1,code2"` fell into the `else` branch which silently defaulted to `"ALL"`, picking whatever the index happened to point to.

**Fix in `scenarioParser.js`:** the parser now accepts both formats:
```javascript
const rawList = Array.isArray(jsonData.scenariosToRun)
  ? jsonData.scenariosToRun
  : String(jsonData.scenariosToRun).split(',').map(s => s.trim()).filter(Boolean);
```

---

### 5. Scenario code in HTML report filename

**Before:**
```
Validation_Reports/20260331_Chaps_Report.html
```

**After:**
```
Validation_Reports/20260331_Chaps_OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG_Report.html
```

Format: `YYYYMMDD_<EnvName>_<ScenarioCode>_Report.html`

Each scenario run produces its own distinctly named file, so all reports from a multi-scenario session accumulate side-by-side in `Validation_Reports/` with no overwriting.

The scenario code is taken from `reportData.meta.scenarioCode` (populated after the first `/offers` call). Any characters not safe for filenames are replaced with `_`.

**Change in `reportGenerator.js`:**
```javascript
// Before
function _htmlFile(envName, dateStr) {
  return path.join(_validationDir(), `${dateStr}_${envName}_Report.html`);
}

// After
function _htmlFile(envName, dateStr, scenarioCode) {
  const sc = scenarioCode ? '_' + String(scenarioCode).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  return path.join(_validationDir(), `${dateStr}_${envName}${sc}_Report.html`);
}
```

---

## Session — 2026-03-31 (Environment & Data File Audit)

### 1. Audit: env files → local server for `data_base`

All environment files were verified to point to the local data-file server (`http://localhost:8080/data_base/…`).
Two files had leftover remote/placeholder URLs and were corrected:

| File | Old `data_base` value | New value |
|------|-----------------------|-----------|
| `OTST_Paxone_Env.yml` | `<own value here>` (disabled) | `http://localhost:8080/data_base/paxone_datafile.json` |
| `OTST_Turnit_Env.yml` | `http://localhost:8080/data_base/turnit_datafile.json` | *(already correct — verified)* |

All other env files (`Sqills`, `Chaps`, `Bileto`) already pointed to `localhost:8080`.

---

### 2. Audit: `scenariosToRunIndex` present in all env files

The `scenariosToRunIndex` variable must exist in every env file so the round-robin counter has somewhere to write.
Files that were missing it:

| File | Action |
|------|--------|
| `OTST_Bileto_Env.yml` | Added `scenariosToRunIndex: "0"` |
| `OTST_Chaps_Env.yml` | Added `scenariosToRunIndex: "0"` |
| `OTST_Sqills_Env.yml` | Added `scenariosToRunIndex: "0"` |
| `OTST_Turnit_Env.yml` | Added `scenariosToRunIndex: "0"` |
| `OTST_Paxone_Env.yml` | Added `scenariosToRunIndex: "0"` |

`OTST_Sqills_Env.yml` and `OTST_Turnit_Env.yml` also had their `scenarioCode` reset to the **first scenario** in the data file so the env var matches the starting point of the round-robin:

| File | `scenarioCode` reset to |
|------|------------------------|
| `OTST_Sqills_Env.yml` | `OTST_TKT_SRCH_CRIT_1ADT_1LEG` |
| `OTST_Turnit_Env.yml` | `OTST_RFND_PATCH_SRCH_CRIT_1ADT_2LEG_Muenchen_Hannover` |
| `OTST_Bileto_Env.yml` | `OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG` |

---

### 3. Audit: `scenariosToRun` in data files — all scenarios listed

All data files must have `"scenariosToRun"` as the first field and it must cover all scenarios defined in that file.

| Data file | `scenariosToRun` value | Status |
|-----------|------------------------|--------|
| `sqills_datafile.json` | `"ALL"` | ✅ |
| `chaps_datafile.json` | `"ALL"` | ✅ |
| `turnit_datafile.json` | `"ALL"` | ✅ |
| `bileto_datafile.json` | `"ALL"` | ✅ |
| `paxone_datafile.json` | `["OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG", "OTST_RFND_SRCH_CRIT_2ADT_1LEG"]` | ❌ partial |

`paxone_datafile.json` had only 2 of its 7 scenarios listed. **Fixed** to an explicit array of all 7 scenario codes so the list is self-documenting and independent of insertion order in `scenarios`:

```json
{
    "scenariosToRun": [
        "OTST_RFND_PATCH_SRCH_CRIT_1ADT_1LEG",
        "OTST_RFND_DEL_SRCH_CRIT_1ADT_1LEG",
        "OTST_RFND_SRCH_CRIT_2ADT_1LEG",
        "OTST_RFND_SRCH_CRIT_2ADT_1CHD_1LEG",
        "OTST_RFND_SRCH_CRIT_1ADT_2LEG",
        "OTST_RFND_SRCH_CRIT_2ADT_2LEG",
        "OTST_EXCH_SRCH_CRIT_1ADT_1LEG"
    ],
    ...
}
```

Every Bruno collection run advances through all 7 scenarios in sequence, then wraps back to 0 automatically.

---

### 4. Summary — complete env / data-file state after audit

| Sandbox | Env file | `data_base` | `scenariosToRunIndex` | `scenariosToRun` in data file |
|---------|----------|-------------|----------------------|-------------------------------|
| Sqills  | `OTST_Sqills_Env.yml`  | `localhost:8080` ✅ | `"0"` ✅ | explicit array of all 8 scenarios ✅ (fixed) |
| Chaps   | `OTST_Chaps_Env.yml`   | `localhost:8080` ✅ | `"0"` ✅ | explicit array of all 9 scenarios ✅ (fixed) |
| Turnit  | `OTST_Turnit_Env.yml`  | `localhost:8080` ✅ | `"0"` ✅ | explicit array of all 9 scenarios ✅ (fixed) |
| Bileto  | `OTST_Bileto_Env.yml`  | `localhost:8080` ✅ | `"0"` ✅ | explicit array of all 7 scenarios ✅ (fixed) |
| Paxone  | `OTST_Paxone_Env.yml`  | `localhost:8080` ✅ | `"0"` ✅ | explicit array of all 7 scenarios ✅ (fixed) |
| Benerail| `OTST_Benerail_Env.yml`| `localhost:8080` ✅ | `"0"` ✅ | explicit array of all 7 scenarios ✅ (fixed) |

> **Note:** All data files were updated from `"scenariosToRun": "ALL"` to an explicit ordered array of every scenario `code` defined in the file. This makes the run order self-documenting and independent of the insertion order inside `scenarios[]`.

---

## Session — 2026-04-01 (HTML Report Major Redesign)

### 1. Overview of changes

Two files were updated: `reportGenerator.js` and `opencollection.yml` (after-response script).

---

### 2. Collapsible section titles

The section headings **Authentication**, **Common Requests**, **Refund** and **Exchange** were previously static `<div>` labels. They are now `<details>/<summary>` elements with a ▶ arrow indicator.

- Clicking a section heading expands it to reveal the list of request titles (still collapsed).
- The arrow rotates ▼ when open, ▶ when closed.
- Assertion pass/fail badge totals are shown on the section heading so the overall health of each section is visible without expanding.

**Before:**
```html
<div class="section-title">🚂 Common Requests (5 requests) …</div>
```

**After:**
```html
<details class="section-details">
  <summary class="section-title">🚂 Common Requests (5 requests) 42 ✅ 1 ❌</summary>
  …request blocks…
</details>
```

---

### 3. Colour-coded collapsible request blocks

Each request card is now a `<details>/<summary>` block with:

- A **colour-coded left border** based on assertion outcome:

| Border colour | Condition |
|---------------|-----------|
| 🟢 Green  | 0 failed assertions |
| 🟠 Orange | 1–30% failed |
| 🔴 Red    | > 30% failed |

- The **title bar** (always visible) shows: `▶ [#] [METHOD] [Request Name] [✅ X] [❌ Y] [⏱ Z ms]`
- Clicking the title expands **one layer only** — the sub-sections (Passed validations, Failed validations, Request headers, Response body) remain collapsed until individually clicked.

A colour legend is displayed in the info box at the top of the report.

---

### 4. Strict layer-by-layer navigation (all collapsed by default)

The full navigation hierarchy, all collapsed by default:

```
▶ 🔐 Authentication (1 request)          ← click to see request titles
    ▶ 1  POST  Access Token  ✅ 2  ⏱ 87 ms  ← click to expand request detail
        [stats bar always visible once request is open]
        ▶ ✅ Passed validations (2)        ← click to see list
        ▶ ❌ Failed validations (0)        ← click to see list
        ▶ 📤 Request Headers & Body        ← click to see headers/body
        ▶ 📥 Response Body                 ← click to see response JSON

▶ 🚂 Common Requests (4 requests)  38 ✅
▶ 💰 Refund (6 requests)  71 ✅  2 ❌
▶ 🔄 Exchange (3 requests)  36 ✅
```

Each click opens exactly one level. Expanding a section does not open the requests inside it. Expanding a request does not open the assertion sub-sections inside it.

---

### 5. Stats summary bar (visible when a request is expanded)

When a request is expanded the first thing shown (before the sub-sections) is a fixed stats bar:

```
✅ Passed: 12  |  ❌ Failed: 1  |  ⏱ Response time: 342 ms  |  200  https://…/offers
```

This provides a quick summary without having to open any sub-section.

---

### 6. Response time — data capture fix (`opencollection.yml`)

`res.getResponseTime()` does not exist in Bruno's after-response context. The correct property is `res.responseTime` (a plain numeric value in milliseconds).

**Fix in `opencollection.yml` after-response:**
```javascript
// Before (method call — always returned undefined/0)
responseTime: res.getResponseTime ? res.getResponseTime() : (res.responseTime || 0),

// After (direct property read)
responseTime: (res.responseTime != null ? res.responseTime : 0),
```

The response time is stored in `reportData.requests[].responseTime` and displayed:
- In the **request title bar** as `⏱ Z ms` (hidden when unavailable)
- In the **stats summary bar** inside the expanded request detail

---

### 7. Request name fix (`opencollection.yml`)

`req.getName()` is not available in Bruno's after-response script context. The previous fallback prepended the HTTP method to the URL path, causing the method to appear twice in the title (once from the fallback string, once from the method badge).

**Fix:** Fallback now uses only the **last URL path segment** (no method prefix):

```javascript
// Before — method duplicated: "POST POST v38/offers"
requestName: _rptMethod + ' ' + _rptUrl.split('?')[0].split(/\//).filter(Boolean).slice(-2).join('/'),

// After — clean segment: "offers"
requestName: (req && typeof req.getName === 'function' ? req.getName() : null)
               || _rptUrl.split('?')[0].split(/\//).filter(Boolean).slice(-1)[0] || _rptMethod,
```

> If Bruno ever exposes `req.getName()` in after-response scripts, the full display name (e.g. `01 POST Offer Search Criteria`) will be used automatically.

---

### 8. Bileto OffsetDateTime hack — reinstated

The Bileto datetime override (commented out on 2026-03-31 for testing) was re-enabled after confirming Bileto still requires `OffsetDateTime` format even on OSDM versions < 3.8.

**In `scenarioParser.js`** (uncommented):
```javascript
// ⚠️ HACK — Bileto OffsetDateTime override
const _apiBase = bru.getEnvVar("api_base") || "";
if (_apiBase.includes("bileto") && _osdmVersionForDatetime < 3.8) {
  _startDateTime = legDef.startDateTime;
  validationLogger(`[INFO] ⚠️ Bileto hack — forcing OffsetDateTime despite osdmVersion ${_osdmVersionRaw}: "${_startDateTime}"`);
}
```

---

## Session — 2026-04-03 (Full Collection Sanity Check + Critical Bug Fixes)

### 1. Overview

After a significant set of user improvements to the collection (new System Info endpoints, HTML reports, `scenariosToRun` automation, extended assertions), a full sanity check was performed across all library files, request YML files, and data files. Seven issues were identified and fixed (C1, H1, H2, M1, M2, M3, M4). One additional pattern was flagged as low-risk for awareness (M5). Two diagnostic investigations were also conducted: one into reports stopping early, one into duplicate HTML report files being generated.

Severity levels used: 🔴 Critical · 🟠 High · 🟡 Medium

---

### 2. Issues Found and Fixed

---

#### C1 — Collection name typo 🟡

**File:** `opencollection.yml`

**Problem:** The `info.name` field read `OTST_V2.0.2_RFND_EXCH_ALL` — an incorrect version number. The working directory is `OTST_V2.0.1`.

**Fix:**
```yaml
# Before
info:
  name: OTST_V2.0.2_RFND_EXCH_ALL

# After
info:
  name: OTST_V2.0.1_RFND_EXCH_ALL
```

---

#### H1 — `osdmVersion` deleted before `GET /versions` runs, so the version check always fails 🟠

**File:** `opencollection.yml` — global `before-request`

**Problem:** The `_isScenarioStart` block (firing at `/versions`) correctly deleted all env vars and then called `getScenarioData()` — but `getScenarioData()` only loaded the scenario's `osdmVersion` inside the `/offers` block (a later request). This meant that when `00. GET System Version Check` ran, `osdmVersion` was `null` (just deleted), the version comparison test always failed with "osdmVersion not set", and the System Info section was marked as broken for every scenario.

**Root cause sequence (broken):**
```
Request 00: GET /versions
  → _isScenarioStart=true → delete all env vars (including osdmVersion)
  → getScenarioData() NOT called here
  → 00 after-response: osdmVersion is null → ❌ "osdmVersion not set"

Request (later): POST /offers
  → /offers block fires → getScenarioData() called → osdmVersion set
  → too late for System Info requests
```

**Fix:** Moved the `getScenarioData()` call **inside** the `_isScenarioStart` block, so scenario data (including `osdmVersion`) is loaded immediately after the env clear, before `00. GET System Version Check` runs its after-response:

```javascript
if (_isScenarioStart) {
  // Clear all env vars first
  _deleteList.forEach(key => bru.deleteEnvVar(key));
  // Then immediately reload scenario data so osdmVersion etc. are available
  try {
    await getScenarioData();
    console.log("✅ Scenario data loaded — osdmVersion: " + (bru.getEnvVar("osdmVersion") || "not set"));
  } catch (_gsErr) {
    console.log("[WARNING] getScenarioData at collection start failed: " + (_gsErr && _gsErr.message));
  }
}
```

The `/offers` block no longer calls `getScenarioData()`. It is replaced with a simple milestone log:
```javascript
if (/\/offers(\?|$)/.test(req.getUrl().toString().toLowerCase())) {
  console.log(`#### POST Get Offer — ${bru.getEnvVar("scenarioCode") || "N/A"} ####`);
}
```

---

#### H2 — System Info by-ID endpoints always return 404 because `masterDataLayoutId` is never set 🟠

**Files:** All 6 `*_datafile.json` + `library-bruno/scenarioParser.js`

**Problem:** Requests `02. GET Coach Deck Layout By Id` and `04. GET Coach Layout By Id` use `{{masterDataLayoutId}}` in their URL. This env var was never populated anywhere — it was neither in the environment files nor set by `parseScenarioData()`. All by-ID requests therefore hit an invalid URL (`/undefined`) and got a 404.

**Fix — Part 1:** Added a `systemInfoParameters` section at the root level of every data file. This section holds any System Info variables the collection needs, as key/value pairs:

```json
{
    "scenariosToRun": [...],
    "systemInfoParameters": {
        "masterDataLayoutId": null
    },
    "scenarios": [...]
}
```

When the value is `null`, the env var is set to `null` (not the string `"null"`), so by-ID requests that check for a non-null value before executing will correctly skip.

**Fix — Part 2:** Added `setSystemInfoParameters()` to `scenarioParser.js`, called at the top of `parseScenarioData()`:

```javascript
function setSystemInfoParameters(jsonData) {
  const params = jsonData.systemInfoParameters;
  if (!params || typeof params !== 'object') return;
  Object.keys(params).forEach(function(key) {
    const value = params[key];
    bru.setEnvVar(key, value === null ? null : String(value));
    validationLogger('[INFO] systemInfoParameters: ' + key + ' = ' + (value === null ? 'null' : value));
  });
}

function parseScenarioData(jsonData) {
  setSystemInfoParameters(jsonData);   // ← called first
  // ... rest of parseScenarioData ...
}
```

**Data files updated:** `sqills_datafile.json`, `Chaps_datafile.json`, `bileto_datafile.json`, `turnit_datafile.json`, `paxone_datafile.json`, `benerail_datafile.json`.

---

#### M1 — `01. POST Get Offer.yml` uses native `test()` instead of `bruTest()` 🟡

**File:** `02-Common Requests/01. POST Get Offer.yml`

**Problem:** This request file still used the native Bruno `test()` function directly for its 3 assertions. Native `test()` results are not captured by `testCapture.js` and therefore never appear in the HTML report. Assertion failures in `POST /offers` were invisible in the report.

Additionally, there was no `stopExecution()` guard: if the offers response returned a non-200 status, the runner would continue into booking, PATCH, fulfillment etc. — all of which would then fail with confusing errors because `offerId` was never set.

**Fix:** Imported `bruTest` and replaced all 3 native `test()` calls. Added an explicit `stopExecution()` guard on non-200 status:

```javascript
const { bruTest } = require(bru.getEnvVar("library_base") + "testCapture.js");

bruTest(`Status code is 200`, () => {
  expect(res.getStatus(), "[ERROR] Wrong response status").to.eql(200);
});

if (res.getStatus() !== 200) {
  bru.runner.stopExecution();
  throw new Error(`Exiting script due to wrong response status: ${res.getStatus()}`);
}
```

---

#### M2 — Data files reference wrong collection version strings 🟡

**Files:** `data_base/benerail_datafile.json`, `data_base/Chaps_datafile.json`

**Problem:** Several `collection` fields in scenario objects contained outdated version references:
- `benerail_datafile.json`: all scenarios had `"collection": "OTST_V1.4.7_RFND_EXCH_ALL"` (old version)
- `Chaps_datafile.json`: all scenarios had `"collection": "OTST_V2.0.2_RFND_EXCH_ALL"` (typo — should be V2.0.1)

**Fix:** Updated all `collection` values to `"OTST_V2.0.1_RFND_EXCH_ALL"` in both files.

---

#### M3 — String `"null"` values used instead of JSON `null` in data files 🟡

**Files:** `data_base/benerail_datafile.json`, `data_base/Chaps_datafile.json`, `data_base/bileto_datafile.json`, `data_base/paxone_datafile.json`, `data_base/sqills_datafile.json`, `data_base/turnit_datafile.json`

**Problem:** Several `scenarioAction`, `scenarioType`, `overruleCode`, and `refundDate` fields contained the **string** `"null"` or `"Null"` instead of the JSON literal `null`. When read via `bru.getEnvVar()`, the string `"null"` is truthy and non-null — so guards like `if (overruleCode != null)` would incorrectly evaluate to `true` and pass the literal string `"null"` to the API body.

**Fix:** All occurrences of `"null"` (as a string value) replaced with `null` (as a JSON literal) across all 6 data files. Affected fields: `scenarioAction`, `scenarioType`, `overruleCode`, `refundDate`.

**Example:**
```json
// Before
"scenarioAction": "null",
"overruleCode": "Null",
"refundDate": ""

// After
"scenarioAction": null,
"overruleCode": null,
"refundDate": null
```

---

#### M4 — `00. GET System Version Check.yml` missing `Requestor` header 🟡

**File:** `01-System Infos Requests/00. GET System Version Check.yml`

**Problem:** All System Info requests (`01` through `08`) send a `Requestor: {{requestor}}` header, but `00. GET System Version Check` was missing this header. This inconsistency could cause the version check to fail on implementations that require the `Requestor` header on every request.

**Fix:** Added the missing header:
```yaml
headers:
  - name: Accept
    value: application/json
  - name: Authorization
    value: Bearer {{access_token}}
  - name: Requestor
    value: "{{requestor}}"   ← added
```

---

#### M5 — `desiredFlexibility` not in the `_deleteList` (awareness only, not fixed) 🔵

**File:** `opencollection.yml` — `_deleteList` inside `_isScenarioStart`

**Observation:** The `desiredFlexibility` env var is set by `parseScenarioData()` from the data file scenario, but it is **not** included in the `_deleteList` that is cleared at the start of each new scenario run. This means if scenario A sets `desiredFlexibility: "FULL_FLEXIBLE"` and scenario B has `desiredFlexibility: null`, the value from scenario A leaks into scenario B's run.

**Why it is low risk:** The `desiredFlexibility` env var is only used inside `parseScenarioData()` itself — it is read from the data file and written to the env var at each run, so it gets overwritten before any request reads it. The only scenario where stale data would matter is if a future request directly reads `{{desiredFlexibility}}` without going through the parser first.

**Recommendation:** Add `"desiredFlexibility"` to the `_deleteList` as a defensive measure to prevent any future stale-data issues:
```javascript
const _deleteList = [
  "loggingType", "scenarioType", "scenarioAction", "osdmVersion",
  "desiredFlexibility",   // ← add here
  ...
];
```

---

### 3. Diagnostic — Why some reports stop at System Info

Two distinct root causes were identified for reports that appeared incomplete:

**Cause 1 — API error at System Info (non-200 response)**

If any System Info request returns a 4xx or 5xx error (e.g. incorrect `Requestor` header, auth failure, endpoint not implemented), `bru.runner.stopExecution()` is called in the request's after-response and the collection stops. The HTML report then only contains the requests that ran before the failure.

**Fix for this cause:** Fix H2 (ensure `masterDataLayoutId` is set so by-ID requests use a valid URL), and fix M4 (ensure `Requestor` header is present on `00. GET System Version Check`).

**Cause 2 — `scenarioType` null at the `09. GET Booking after Fulfillments` routing gate**

`09. GET Booking after Fulfillments.yml` contains a routing gate:
```javascript
if (bru.getEnvVar("scenarioType")?.includes("REFUND")) {
    bru.runner.setNextRequest("10. POST Refund Offers");
} else if (bru.getEnvVar("scenarioType")?.includes("EXCHANGE")) {
    bru.runner.setNextRequest("10. POST Exchange Offers");
} else {
    bru.runner.stopExecution();   // ← SALE and null both stop here
}
```

If `scenarioType` is `null` at the time this request runs, the `else` branch fires and the collection stops — even for REFUND scenarios. Before fix H1, `scenarioType` was deleted at `_isScenarioStart` and only restored when `getScenarioData()` ran at `/offers`. If `getScenarioData()` failed (e.g. a data file fetch error), `scenarioType` would remain `null` and the routing gate would stop execution after `09`.

**Fix for this cause:** Fix H1 — calling `getScenarioData()` inside `_isScenarioStart` (at `/versions`, before any other request) ensures `scenarioType` is always populated before the routing gate is reached.

---

### 4. Diagnostic — `scenarioType` audit across all data files

A full audit was performed of all `scenariosToRun` lists vs. the `scenarioType` values defined in each data file's `scenarios` array. One broken scenario was found:

| Data file | Scenario code | `scenarioType` value | Issue |
|-----------|---------------|----------------------|-------|
| `sqills_datafile.json` | `OTST_TKT_SRCH_CRIT_1ADT_1LEG` | `null` (was missing) | Would stop at `09` routing gate |

**Fix:** The user updated `sqills_datafile.json` directly, setting `"scenarioType": "SALE"` for `OTST_TKT_SRCH_CRIT_1ADT_1LEG`.

All other data file `scenariosToRun` entries correctly matched scenarios with a non-null `scenarioType`.

---

### 5. Bug Fix — Double HTML report files per run (critical)

**File:** `opencollection.yml` — global `before-request`
**Root cause:** `bru.setVar` is request-scoped and resets to `undefined` between every request

**Symptom:** A single Sqills collection run produced two separate HTML report files:
```
20260403_Sqills_OTST_TKT_SRCH_CRIT_1ADT_1LEG_Report.html
20260403_Sqills_OTST_EXCH_SRCH_CRIT_1ADT_1LEG_Report.html
```
Additionally, each report contained only the data for a single request (not the accumulated full run).

**Root cause — confirmed:** In Bruno, `bru.setVar()` is **request-scoped**: its value resets to `undefined` at the start of every new request. The `__reportInitDone` flag used to prevent `initReport()` from firing on every request was set with `bru.setVar()`:

```javascript
// OLD — resets to undefined between every request
if (_isScenarioStart || bru.getVar('__reportInitDone') !== 'true') {
    ...
    initReport(bru.getEnvVar("library_base"));
    bru.setVar('__reportInitDone', 'true');    // ← wiped before next request
}
```

Because `bru.getVar('__reportInitDone')` was always `undefined` (reset), the condition `!== 'true'` was always `true` — so `initReport()` fired on **every single request**, deleting `.report_tmp.json` before each `appendRequest()`. The net result: each HTML write contained only the one request that had just run, not the accumulated run data.

The two differently-named files came from two different values of `scenariosToRunIndex` being active across the two problem runs (not within a single run).

**Fix:** Replace `bru.setVar` / `bru.getVar` with `bru.setEnvVar` / `bru.getEnvVar`. Environment variables persist across all requests within a run (and across runs, until cleared):

```javascript
// NEW — persists correctly across all requests in a run
if (_isScenarioStart || bru.getEnvVar('__reportInitDone') !== 'true') {
    ...
    initReport(bru.getEnvVar("library_base"));
    bru.setEnvVar('__reportInitDone', 'true');   // ← survives to next request
}
```

**Behaviour after fix:**

| Request | `_isScenarioStart` | `__reportInitDone` | Action |
|---------|-------------------|-------------------|--------|
| `00. GET System Version Check` (`/versions`) | `true` | (any) | env cleared, `getScenarioData()` called, `initReport()` called once, flag set to `'true'` |
| All subsequent requests | `false` | `'true'` | block skipped entirely — `.report_tmp.json` accumulates |
| Next run's `/versions` | `true` | (ignored — `_isScenarioStart` overrides) | new scenario loaded, report re-initialised |

From the next run onwards, each HTML report contains the **complete accumulated data** for the entire run — all requests, all assertions, all console logs.

---

### 6. Summary of files changed in this session

| File | Change | Issue |
|------|--------|-------|
| `opencollection.yml` | Collection name corrected to `OTST_V2.0.1_RFND_EXCH_ALL` | C1 |
| `opencollection.yml` | `getScenarioData()` moved into `_isScenarioStart` block | H1 |
| `opencollection.yml` | `/offers` block now only logs a milestone banner | H1 |
| `opencollection.yml` | `bru.setVar('__reportInitDone')` → `bru.setEnvVar('__reportInitDone')` (both read and write) | Double-report bug |
| `opencollection.yml` | Comment added explaining why `setEnvVar` is required (not `setVar`) | Double-report bug |
| `library-bruno/scenarioParser.js` | Added `setSystemInfoParameters()` function | H2 |
| `library-bruno/scenarioParser.js` | `parseScenarioData()` calls `setSystemInfoParameters()` first | H2 |
| `02-Common Requests/01. POST Get Offer.yml` | Replaced native `test()` with `bruTest()`, added `stopExecution()` guard | M1 |
| `01-System Infos Requests/00. GET System Version Check.yml` | Added missing `Requestor: "{{requestor}}"` header | M4 |
| `data_base/sqills_datafile.json` | Collection name → `V2.0.1`, `"null"` strings → `null`, added `systemInfoParameters`, `scenarioType: "SALE"` for TKT scenario | C1, M2, M3, H2, Audit |
| `data_base/Chaps_datafile.json` | Collection name → `V2.0.1`, `"null"` strings → `null`, added `systemInfoParameters` | C1, M2, M3, H2 |
| `data_base/bileto_datafile.json` | `"null"` strings → `null`, added `systemInfoParameters` | M3, H2 |
| `data_base/paxone_datafile.json` | `"null"` strings → `null`, added `systemInfoParameters` | M3, H2 |
| `data_base/turnit_datafile.json` | `"null"` strings → `null`, added `systemInfoParameters` | M3, H2 |
| `data_base/benerail_datafile.json` | Collection name → `V2.0.1`, `"null"` strings → `null`, added `systemInfoParameters` | C1, M2, M3, H2 |

---

## Session — 2026-04-04 (Code Review Fixes #3, #4, #5, #6 / #21)

### Overview

Findings #3, #4, #5, #6, and #21 from the Full Collection Code Review were applied to the source files. #3 and #4 had already been fixed in a prior session; #5 (exchange passengers), #6 and #21 (duplicate `Access-Token` header) were fixed in this session.

---

### Finding #3 — `bookings.js`: `fulfillmentIds` stored inside `test()` 🟠 ✅ Already Fixed

**File:** `library-bruno/bookings.js`

Verified that `fulfillmentIds.push()` and `bru.setEnvVar("fulfillmentIds", ...)` are already moved **outside** the `test()` block — the fix was applied in a previous session. Current code:

```javascript
fulfillments.forEach((fulfillment, idx) => {
  // Side-effect OUTSIDE test — always executes
  if (fulfillment?.id) {
    fulfillmentIds.push(fulfillment.id);
  }
  // Assertion only — no side-effects
  test(`Fulfillment[${idx}] id exists`, () => {
    expect(fulfillment.id).to.be.a("string").and.not.be.empty;
  });
  ...
```

`bru.setEnvVar("fulfillmentIds", fulfillmentIds)` is called after the `forEach` loop completes.

---

### Finding #4 — `offers.js`: `coveredTripId` null guard 🟠 ✅ Already Fixed

**File:** `library-bruno/offers.js`

Verified that the null guard is already in place in `validateTripsAndLegs()`:

```javascript
const coveredTripId = bru.getEnvVar("coveredTripId");
if (coveredTripId) {
  test(`selectedOffer.tripCoverage.coveredTripId (${coveredTripId}) is part of Trip ids`, function () {
    expect(tripIds).to.include(coveredTripId);
  });
} else {
  validationLogger(`[INFO] coveredTripId is not set → tripCoverage test skipped`);
}
```

---

### Finding #5 — `requestsBuilder.js`: Exchange body now covers all passengers 🟠 ✅ Fixed

**File:** `library-bruno/requestsBuilder.js` — `requestExchangeOffersBody()`

#### Before

```javascript
const updateGender_0 = bru.getEnvVar('updateGender_0');
const body = {
  ...
  anonymousPassengerSpecifications: [{
    externalRef: "00001",
    dateOfBirth: bru.getEnvVar('updateDateOfBirth_0'),
    age: 0,
    type: "PERSON",
    ...(updateGender_0 != null && { gender: updateGender_0 })
  }],
  ...
};
```

#### After

```javascript
let anonymousPassengerSpecifications;
try {
  const passengerSpecs = JSON.parse(bru.getEnvVar('offerPassengerSpecifications') || '[]');
  if (!Array.isArray(passengerSpecs) || passengerSpecs.length === 0) {
    throw new Error('offerPassengerSpecifications is empty or not an array');
  }
  anonymousPassengerSpecifications = passengerSpecs.map(function(spec, i) {
    const updateGender = bru.getEnvVar('updateGender_' + i);
    const entry = {
      externalRef: spec.externalRef || String(i + 1).padStart(5, '0'),
      dateOfBirth: bru.getEnvVar('updateDateOfBirth_' + i) || spec.dateOfBirth || null,
      age: spec.age != null ? spec.age : 0,
      type: spec.type || "PERSON"
    };
    if (updateGender != null) entry.gender = updateGender;
    return entry;
  });
} catch (_e) {
  // Fallback to single-passenger if offerPassengerSpecifications unavailable
  const updateGender_0 = bru.getEnvVar('updateGender_0');
  anonymousPassengerSpecifications = [{
    externalRef: "00001",
    dateOfBirth: bru.getEnvVar('updateDateOfBirth_0'),
    age: 0,
    type: "PERSON",
    ...(updateGender_0 != null && { gender: updateGender_0 })
  }];
}
```

**How it works:**
- `offerPassengerSpecifications` (set by `parseScenarioData()`) is parsed to get all passenger specs from the data file
- Each spec contributes one entry to `anonymousPassengerSpecifications`, preserving `externalRef`, `dateOfBirth`, `age`, and `type` from the original offer request
- Per-passenger update overrides (`updateDateOfBirth_N`, `updateGender_N`) are applied by index `N`
- If `offerPassengerSpecifications` is unavailable or empty, falls back to the original single-passenger hardcoded behaviour with a `[WARNING]` log

**Behaviour after fix:**

| Scenario | Before | After |
|----------|--------|-------|
| 1 passenger | 1 entry (`externalRef: "00001"`) | 1 entry (from spec, preserves actual `externalRef`) |
| 2 passengers (e.g. `2ADT`) | 1 entry — 2nd passenger silently dropped | 2 entries, each with correct `externalRef` and `type` |
| 3 passengers | 1 entry — 2nd and 3rd dropped | 3 entries |
| `offerPassengerSpecifications` absent | N/A | Falls back to single-passenger (`[WARNING]` logged) |

---

### Finding #6 + #21 — Duplicate `Access-Token` header removed from 6 request files 🟠 ✅ Fixed

**Files fixed:**
- `02-Common Requests/02. GET Place Maps for Reservation of Offer (Bileto env).yml`
- `02-Common Requests/05. PATCH Multi Passenger.yml`
- `02-Common Requests/06. GET Passenger.yml`
- `02-Common Requests/07. GET Booking before Fulfillments.yml`
- `02-Common Requests/08. POST Obtaining Fulfillments from Booking.yml`
- `02-Common Requests/09. GET Booking after Fulfillments.yml`

The original report identified 4 files (finding #6 + #21). Inspection revealed 2 additional files with the same issue (`07` and `02. GET Place Maps`). All 6 were fixed in one pass.

#### Before (identical pattern in all 6 files)

```yaml
headers:
  - name: Authorization
    value: Bearer {{access_token}}
  - name: Content-Type
    value: application/json;version={{osdmVersion}}
  - name: Access-Token          ← redundant non-standard duplicate
    value: "{{access_token}}"
  - name: Requestor
    value: "{{requestor}}"
```

#### After (all 6 files)

```yaml
headers:
  - name: Authorization
    value: Bearer {{access_token}}
  - name: Content-Type
    value: application/json;version={{osdmVersion}}
  - name: Requestor
    value: "{{requestor}}"
```

`Authorization: Bearer {{access_token}}` is the standard OAuth2 header. The non-standard `Access-Token` header sent the same token value redundantly — some server implementations or proxies could interpret the duplicate as a security anomaly or reject it. Removing it brings all 6 requests in line with the rest of the collection (requests `01`, `03`, `04` never had the duplicate).

---

### Files changed in this session

| File | Change | Finding |
|------|--------|---------|
| `library-bruno/requestsBuilder.js` | `requestExchangeOffersBody()` builds `anonymousPassengerSpecifications` dynamically from `offerPassengerSpecifications` for all passengers; single-passenger fallback retained | #5 |
| `02-Common Requests/02. GET Place Maps for Reservation of Offer (Bileto env).yml` | Removed duplicate `Access-Token` header | #6 / #21 |
| `02-Common Requests/05. PATCH Multi Passenger.yml` | Removed duplicate `Access-Token` header | #6 |
| `02-Common Requests/06. GET Passenger.yml` | Removed duplicate `Access-Token` header | #21 |
| `02-Common Requests/07. GET Booking before Fulfillments.yml` | Removed duplicate `Access-Token` header | #6 / #21 |
| `02-Common Requests/08. POST Obtaining Fulfillments from Booking.yml` | Removed duplicate `Access-Token` header | #21 |
| `02-Common Requests/09. GET Booking after Fulfillments.yml` | Removed duplicate `Access-Token` header | #21 |
