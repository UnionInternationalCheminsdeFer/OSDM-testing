# OTST Collection — Compliance with OSDM Specifications Analysis

**Date:** 2026-03-30
**Collection:** OTST_V2.0.1
**OSDM versions reviewed:** v3.3.4 and v3.7.1
**Spec sources:**
- https://github.com/UnionInternationalCheminsdeFer/OSDM/tree/master/specification/v3.3 (`OSDM-online-api-v3.3.4-pre.yml`)
- https://github.com/UnionInternationalCheminsdeFer/OSDM/tree/master/specification/v3.7 (`OSDM-online-api-v3.7.1.yml`)

**Files analysed:**
- `library-bruno/model.js` — all trip/offer data model classes
- `library-bruno/requestsBuilder.js` — `OfferCollectionRequest` assembly
- `library-bruno/scenarioParser.js` — datetime formatting logic

---

## Executive Summary

The collection is **largely compliant** with both OSDM v3.3 and v3.7. All field names across every trip structure match the specification exactly. One spec violation was found (`objectType` sent in `OfferCollectionRequest` body), one cosmetic class naming issue, and one minor observation. Datetime formats are correctly handled per version.

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `objectType` field sent in `OfferCollectionRequest` body | 🔴 MEDIUM — spec violation | Open |
| 2 | `AlignSpecification` class should be `AlightSpecification` | 🟡 LOW — cosmetic only | Open |
| 3 | `VehicleFilter.lineNumbers: null` always serialized | ⚪ INFO | Open |
| — | All datetime formats (`ServiceTime`, `TripSearchCriteria`) | ✅ Compliant | — |
| — | All field names across all trip structures | ✅ Compliant | — |

---

## Scope

This analysis covers the **trip-related structures** used to build the `OfferCollectionRequest`, specifically:

- `TripSearchCriteria` (SEARCH trip type)
- `TripSpecification`, `TripLegSpecification`, `TimedLegSpecification` (SPECIFICATION trip type)
- `BoardSpecification`, `AlightSpecification`, `ServiceTime`
- `DatedJourney`, `NamedCompany`, `ProductCategory`
- `StopPlaceRef`
- `TripParameters`, `TripDataFilter`, `CarrierFilter`, `VehicleFilter`
- `OfferCollectionRequest` assembly

---

## Key Spec Facts (v3.3 and v3.7)

### Datetime formats — two distinct formats coexist

| Context | Format | Example | Note |
|---|---|---|---|
| `TripSearchCriteria.departureTime` / `arrivalTime` | **LocalDateTime** (no offset) | `2026-04-09T10:30:00` | v3.3 and v3.7 only. v3.8 changed this to OffsetDateTime. |
| `ServiceTime.timetabledTime` | **OffsetDateTime** (with `+HH:MM`) | `2026-04-09T10:30:00+02:00` | Spec explicitly forbids UTC/Z suffix. |

### Schema evolution between v3.3 and v3.7

The following schemas changed between v3.3 and v3.7 (all others are identical):

| Schema | Change |
|---|---|
| `TripSearchCriteria.departureTime` | Description clarified: "exactly one of departureTime/arrivalTime must be provided" |
| `TripParameters.numberOfResults` | Deprecated in v3.7 (being removed from OJP) |
| `BoardSpecification` | v3.7 adds optional `replacedPlaceRef` (for replacement bus scenarios) |
| `AlightSpecification` | v3.7 adds optional `replacedPlaceRef` |
| `OfferCollectionRequest` | v3.7 adds `inboundTripIds`, `inboundTripSpecifications`, `tripResponseParameters` (return trip support) |
| `TripVia.dwellTime` example | Fixed from `30M` to `PT30M` (proper ISO 8601 duration) |

---

## Detailed Compliance Results

### 1. `TripSearchCriteria`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
TripSearchCriteria:
  type: object
  additionalProperties: false
  required:
    - origin
    - destination
  properties:
    departureTime:
      type: string
      pattern: '(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)'   # LocalDateTime, no offset
      nullable: true
    arrivalTime:
      type: string
      pattern: '(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)'   # LocalDateTime, no offset
      nullable: true
    origin:
      $ref: '#/components/schemas/PlaceRef'
    destination:
      $ref: '#/components/schemas/PlaceRef'
    parameters:
      $ref: '#/components/schemas/TripParameters'
    vias: ...
    returnSearchParameters: ...
    notVias: ...
```

**Collection model (`model.js`):**
```javascript
var TripSearchCriteria = class {
  constructor(departureTime, origin, destination, parameters) {
    this.departureTime = departureTime;
    this.origin = origin;
    this.destination = destination;
    if (parameters) {
      this.parameters = parameters;   // only added when non-null
    }
  }
};
```

**Result: ✅ Compliant**

| Check | Result |
|---|---|
| Field names match spec | ✅ `departureTime`, `origin`, `destination`, `parameters` |
| `parameters` omitted when null | ✅ `if (parameters)` guard present |
| `departureTime` format for v3.3/v3.7 | ✅ `+HH:MM` offset stripped → LocalDateTime (handled in `scenarioParser.js`) |
| `departureTime` format for v3.8+ | ✅ offset preserved → OffsetDateTime (version-branched in `scenarioParser.js`) |
| `additionalProperties: false` respected | ✅ No extra fields added |

---

### 2. `StopPlaceRef`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
StopPlaceRef:
  description: Reference to a Stop Place using URNs.
  allOf:
    - $ref: '#/components/schemas/PlaceRef'   # requires objectType discriminator
    - type: object
      additionalProperties: false
      required:
        - stopPlaceRef
      properties:
        stopPlaceRef:
          type: string
          nullable: false
          example: urn:uic:stn:8503000
```

`PlaceRef` requires:
```yaml
PlaceRef:
  required:
    - objectType
  properties:
    objectType:
      type: string    # discriminator
```

**Collection model (`model.js`):**
```javascript
var StopPlaceRef = class {
  constructor(stopPlaceRef) {
    this.objectType = "StopPlaceRef";   // discriminator — required by PlaceRef
    this.stopPlaceRef = stopPlaceRef;
  }
};
```

**Result: ✅ Compliant** — `objectType` discriminator correctly set, `stopPlaceRef` string present.

---

### 3. `ServiceTime`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
ServiceTime:
  type: object
  additionalProperties: false
  description: |
    The time needs to be in Offset Time Format, i.e. 2023-12-03T10:15:30+01:00
    Do NOT use UTC format (Z suffix), i.e. 2023-12-03T10:15:30Z.
  required:
    - timetabledTime
  properties:
    timetabledTime:
      type: string
      format: date-time
      nullable: false
    estimatedTime:
      type: string
      format: date-time
      nullable: true
    observedTime:
      type: string
      format: date-time
      nullable: true
```

**Collection model (`model.js`):**
```javascript
var ServiceTime = class {
  constructor(timetabledTime) {
    this.timetabledTime = timetabledTime;
  }
};
```

**Usage in `scenarioParser.js`:**
```javascript
// Raw data file value after %TRIP_DATE% substitution: "2026-04-09T10:30:00+02:00"
// Passed directly — OffsetDateTime with +HH:MM, no Z suffix
new ServiceTime(legDef.startDateTime)   // → { timetabledTime: "2026-04-09T10:30:00+02:00" }
```

**Result: ✅ Compliant** — OffsetDateTime with `+HH:MM` offset used (no Z suffix as required).

---

### 4. `BoardSpecification`

**Spec definition (v3.3):**
```yaml
BoardSpecification:
  type: object
  additionalProperties: false
  required:
    - stopPlaceRef
    - serviceDeparture
  properties:
    stopPlaceRef:
      $ref: '#/components/schemas/StopPlaceRef'
    serviceDeparture:
      $ref: '#/components/schemas/ServiceTime'
```
*(v3.7 adds optional `replacedPlaceRef` — not used in collection, which is acceptable)*

**Collection model (`model.js`):**
```javascript
var BoardSpecification = class {
  constructor(stopPlaceRef, serviceDeparture) {
    this.stopPlaceRef = stopPlaceRef;
    this.serviceDeparture = serviceDeparture;
  }
};
```

**Result: ✅ Compliant** — field names `stopPlaceRef` and `serviceDeparture` match exactly.

---

### 5. `AlightSpecification` — named `AlignSpecification` in collection

**Spec definition (v3.3):**
```yaml
AlightSpecification:
  type: object
  additionalProperties: false
  required:
    - stopPlaceRef
    - serviceArrival
  properties:
    stopPlaceRef:
      $ref: '#/components/schemas/StopPlaceRef'
    serviceArrival:
      $ref: '#/components/schemas/ServiceTime'
```
*(v3.7 adds optional `replacedPlaceRef`)*

**Collection model (`model.js`):**
```javascript
var AlignSpecification = class {   // ← wrong class name
  constructor(stopPlaceRef, serviceArrival) {
    this.stopPlaceRef = stopPlaceRef;
    this.serviceArrival = serviceArrival;
  }
};
```

**Result: ✅ Structurally compliant / 🟡 Naming issue**

- JSON output fields `stopPlaceRef` and `serviceArrival` are correct — no impact on API calls.
- The JavaScript class name `AlignSpecification` is incorrect. The spec uses `AlightSpecification` ("alight" = disembark from a train). "Align" is a different word with a different meaning.
- **Recommendation:** Rename to `AlightSpecification` in `model.js` and update all references in `scenarioParser.js`.

---

### 6. `TimedLegSpecification`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
TimedLegSpecification:
  type: object
  additionalProperties: false
  required:
    - start
    - end
    - service
  properties:
    start:
      $ref: '#/components/schemas/BoardSpecification'
    intermediates:
      type: array
      items:
        $ref: '#/components/schemas/IntermediateSpecification'
    end:
      $ref: '#/components/schemas/AlightSpecification'
    service:
      $ref: '#/components/schemas/DatedJourney'
```

**Collection model (`model.js`):**
```javascript
var TimedLegSpecification = class {
  constructor(start, end, service) {
    this.start = start;
    this.end = end;
    this.service = service;
  }
};
```

**Result: ✅ Compliant** — field names `start`, `end`, `service` match exactly.

---

### 7. `TripLegSpecification`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
TripLegSpecification:
  type: object
  additionalProperties: false
  properties:
    externalRef:
      type: string
      nullable: true
    timedLeg:
      $ref: '#/components/schemas/TimedLegSpecification'
    transferLeg:
      $ref: '#/components/schemas/TransferLeg'
```

**Collection model (`model.js`):**
```javascript
var TripLegSpecification = class {
  constructor(externalRef, timedLeg) {
    this.externalRef = externalRef;
    this.timedLeg = timedLeg;
  }
};
```

**Result: ✅ Compliant** — field names `externalRef` and `timedLeg` match. `transferLeg` is optional and not used.

---

### 8. `TripSpecification`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
TripSpecification:
  type: object
  additionalProperties: false
  required:
    - legs
  properties:
    externalRef:
      type: string
      nullable: true
    legs:
      type: array
      items:
        $ref: '#/components/schemas/TripLegSpecification'
      minItems: 1
    isPartOfInternationalTrip:
      type: boolean
      nullable: true
    returnSearchParameters:
      $ref: '#/components/schemas/ReturnSearchParameters'
```

**Collection model (`model.js`):**
```javascript
var TripSpecification = class {
  constructor(externalRef, legs) {
    this.externalRef = externalRef;
    this.legs = legs;
  }
};
```

**Result: ✅ Compliant** — `externalRef` and `legs` match. `legs` is always an array with at least one entry (validated in `osdmTripSpecification()`).

---

### 9. `DatedJourney`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
DatedJourney:
  type: object
  additionalProperties: false
  required:
    - vehicleNumbers    # minItems: 1
    - carriers          # minItems: 1
  properties:
    operatingDayRef: ...    # optional
    mode: ...               # optional
    productCategory:
      $ref: '#/components/schemas/ProductCategory'   # optional
    publishedServiceName:
      type: string
      nullable: true        # optional
    vehicleNumbers:
      type: array
      items:
        $ref: '#/components/schemas/VehicleNumber'   # string, nullable
      minItems: 1
    lineNumbers: ...        # optional
    serviceStatus: ...      # optional
    carriers:
      type: array
      items:
        $ref: '#/components/schemas/NamedCompany'
      minItems: 1
```

**Collection model (`model.js`) and usage (`scenarioParser.js`):**
```javascript
var DatedJourney = class {
  constructor(productCategory, vehicleNumbers, carriers) {
    this.productCategory = productCategory;
    this.vehicleNumbers = vehicleNumbers;
    this.carriers = carriers;
  }
};

// Usage:
new DatedJourney(
  productCategory,                    // ProductCategory object or null
  [legDef.vehicleNumber],             // array of VehicleNumber strings, minItems satisfied
  [new NamedCompany(legDef.carrier)]  // array of NamedCompany, minItems satisfied
)
```

**Result: ✅ Compliant**

| Check | Result |
|---|---|
| `vehicleNumbers` is array of strings, minItems:1 | ✅ `[legDef.vehicleNumber]` |
| `carriers` is array of `NamedCompany`, minItems:1 | ✅ `[new NamedCompany(ref)]` |
| `productCategory` is optional, correctly null-guarded | ✅ |

---

### 10. `NamedCompany`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
NamedCompany:
  type: object
  additionalProperties: false
  required:
    - ref
  properties:
    ref:
      $ref: '#/components/schemas/CompanyRef'   # plain string, e.g. "urn:uic:rics:1185:000011"
    name:
      type: string
      nullable: true    # optional
```

**Collection model (`model.js`):**
```javascript
var NamedCompany = class {
  constructor(ref) {
    this.ref = ref;
  }
};
```

**Result: ✅ Compliant** — required `ref` field present, `name` is optional and omitted.

---

### 11. `ProductCategory`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
ProductCategory:
  type: object
  additionalProperties: false
  required:
    - name          # non-nullable
    - shortName     # non-nullable
    - productCategoryRef   # ProductCategoryRef string, nullable
  properties:
    name:
      type: string
      nullable: false
    shortName:
      type: string
      nullable: false
    productCategoryRef:
      type: string   # $ref ProductCategoryRef — nullable: true
```

**Collection model (`model.js`) and usage (`scenarioParser.js`):**
```javascript
var ProductCategory = class {
  constructor(productCategoryRef, name, shortName) {
    this.productCategoryRef = productCategoryRef;
    this.name = name;
    this.shortName = shortName;
  }
};

// Usage — only created when productCategoryRef is not null:
const productCategory = legDef.productCategoryRef === null
  ? null
  : new ProductCategory(legDef.productCategoryRef, legDef.productCategoryName, legDef.productCategoryShortName);
```

**Result: ✅ Compliant** — all three required fields provided when the object is created. Object is null when `productCategoryRef` is null (acceptable since `productCategory` is optional in `DatedJourney`).

---

### 12. `CarrierFilter`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
CarrierFilter:
  type: object
  additionalProperties: false
  properties:
    exclude:
      type: boolean
      nullable: true
      default: true    # true = EXCLUDE mode (carriers in list are excluded)
    carriers:
      type: array
      items:
        $ref: '#/components/schemas/CompanyRef'   # plain string
```

**Collection model (`model.js`) and usage (`scenarioParser.js`):**
```javascript
var CarrierFilter = class {
  constructor(carriers, exclude = true) {
    this.carriers = carriers;
    this.exclude = exclude;
  }
};

// Usage: exclude: false → INCLUDE mode (only this carrier is allowed)
new CarrierFilter([legDef.carrier], false)
```

**Result: ✅ Compliant**

- `CompanyRef` is a plain string in the spec — the collection passes the raw carrier string directly ✅
- `exclude: false` means include-only mode (search restricted to this carrier) ✅

---

### 13. `VehicleFilter`

**Spec definition (identical in v3.3 and v3.7):**
```yaml
VehicleFilter:
  type: object
  additionalProperties: false
  properties:
    exclude:
      type: boolean
      nullable: true
      default: true
    vehicleNumbers:
      type: array
      items:
        $ref: '#/components/schemas/VehicleNumber'   # string, nullable
    lineNumbers:
      type: array
      items:
        $ref: '#/components/schemas/LineNumber'
```

**Collection model (`model.js`) and usage (`scenarioParser.js`):**
```javascript
var VehicleFilter = class {
  constructor(vehicleNumbers, lineNumbers = null, exclude = true) {
    this.vehicleNumbers = vehicleNumbers;
    this.lineNumbers = lineNumbers;   // always serialized, even as null
    this.exclude = exclude;
  }
};

// Usage:
new VehicleFilter([legDef.vehicleNumber], null, false)
// → { vehicleNumbers: ["9218"], lineNumbers: null, exclude: false }
```

**Result: ✅ Compliant / ⚪ Minor observation**

- `vehicleNumbers` is an array of `VehicleNumber` strings ✅
- `exclude: false` = include-only mode ✅
- `lineNumbers: null` — `lineNumbers` is a listed property in the spec so sending it as null is not a violation, but it adds unnecessary noise to the request. Omitting it when null would produce a cleaner payload.

---

### 14. `TripParameters` / `TripDataFilter`

**Spec definitions:**
```yaml
TripParameters:
  type: object
  additionalProperties: false
  properties:
    dataFilter:
      $ref: '#/components/schemas/TripDataFilter'
    # + policyFilter, mobilityFilter, numberOfResults (deprecated v3.7), etc.

TripDataFilter:
  type: object
  additionalProperties: false
  properties:
    ptModeFilter: ...
    carrierFilter:
      $ref: '#/components/schemas/CarrierFilter'
    serviceBrandFilter: ...
    vehicleFilter:
      $ref: '#/components/schemas/VehicleFilter'
```

**Collection model (`model.js`):**
```javascript
var TripParameters = class {
  constructor(dataFilter) { this.dataFilter = dataFilter; }
};
var TripDataFilter = class {
  constructor(carrierFilter, vehicleFilter) {
    this.carrierFilter = carrierFilter;
    this.vehicleFilter = vehicleFilter;
  }
};
```

**Result: ✅ Compliant** — field names `dataFilter`, `carrierFilter`, `vehicleFilter` match spec exactly. Only used fields are set; optional fields are omitted.

---

## 🔴 Issue 1 — `objectType` sent in `OfferCollectionRequest` body

### Finding

**Location:** `library-bruno/requestsBuilder.js` — `buildOfferCollectionRequest()`, line 21

```javascript
// requestsBuilder.js
if (!isPaxone) {
  body.objectType = "OfferCollectionRequest";   // ← NOT in spec
}
```

### Spec

The OSDM spec defines `OfferCollectionRequest` with `additionalProperties: false`:

```yaml
OfferCollectionRequest:
  type: object
  additionalProperties: false
  required:
    - anonymousPassengerSpecifications
  properties:
    tripSpecifications: ...
    tripIds: ...
    tripSearchCriteria: ...
    nonTripSearchCriteria: ...
    requestedSections: ...
    offerSearchCriteria: ...
    anonymousPassengerSpecifications: ...
    corporateCodes: ...
    promotionCodes: ...
    requestedFulfillmentOptions: ...
    embed: ...
    # objectType is NOT listed here
```

### Impact

`additionalProperties: false` means the server **must reject** any property not listed in `properties`. Sending `objectType: "OfferCollectionRequest"` is therefore a spec violation. Implementations that strictly enforce the schema (e.g. Bileto, auto-generated validators) will respond with a `400 MALFORMED_REQUEST` or `VALIDATION_ERROR`.

Note: `objectType` is used as a discriminator in OSDM polymorphic types (like `PlaceRef`), but `OfferCollectionRequest` is **not** a polymorphic type and has no discriminator.

### Recommended Fix

```javascript
// requestsBuilder.js — remove the objectType line entirely
function buildOfferCollectionRequest() {
  const body = {};

  // REMOVE: if (!isPaxone) { body.objectType = "OfferCollectionRequest"; }

  if (tripType === "SPECIFICATION") {
    body.tripSpecifications = JSON.parse(bru.getEnvVar("offerTripSpecifications"));
  } else if (tripType === "SEARCH") {
    body.tripSearchCriteria = JSON.parse(bru.getEnvVar("offerTripSearchCriteria"));
  }
  // ...
}
```

---

## 🟡 Issue 2 — `AlignSpecification` class name (should be `AlightSpecification`)

### Finding

**Location:** `library-bruno/model.js` — line 233

```javascript
var AlignSpecification = class {   // ← wrong name
  constructor(stopPlaceRef, serviceArrival) {
    this.stopPlaceRef = stopPlaceRef;
    this.serviceArrival = serviceArrival;
  }
};
```

### Spec

The OSDM spec calls this schema `AlightSpecification`. "Alight" is the railway term for a passenger leaving a train (as opposed to "board"). "Align" has no meaning in this context.

### Impact

Zero impact on API calls — the class name is never serialized to JSON. The JSON output is structurally correct: fields `stopPlaceRef` and `serviceArrival` match the spec exactly. This is a readability and documentation issue.

### Recommended Fix

Rename the class and update all 3 references:

```javascript
// model.js — rename class
var AlightSpecification = class {   // was: AlignSpecification
  constructor(stopPlaceRef, serviceArrival) {
    this.stopPlaceRef = stopPlaceRef;
    this.serviceArrival = serviceArrival;
  }
};

// model.js — update export
AlightSpecification,  // was: AlignSpecification

// scenarioParser.js — update usage (~line 471)
const alignSpec = new AlightSpecification(  // was: new AlignSpecification(
  new StopPlaceRef(legDef.endStopPlaceRef),
  new ServiceTime(legDef.endDateTime)
);
```

---

## ⚪ Observation — `VehicleFilter.lineNumbers: null` always serialized

### Finding

`VehicleFilter` always includes `lineNumbers: null` in the serialized JSON:
```json
{ "vehicleNumbers": ["9218"], "lineNumbers": null, "exclude": false }
```

### Impact

Not a spec violation — `lineNumbers` is a listed (nullable) property in `VehicleFilter`. However, sending an explicit `null` for an unused optional field adds noise to the request body.

### Recommended Fix (optional)

```javascript
var VehicleFilter = class {
  constructor(vehicleNumbers, lineNumbers = null, exclude = true) {
    this.vehicleNumbers = vehicleNumbers;
    if (lineNumbers !== null) {
      this.lineNumbers = lineNumbers;   // omit when null
    }
    this.exclude = exclude;
  }
};
```

---

## Datetime Format Summary

| Location | Format used | Spec requirement | Status |
|---|---|---|---|
| `TripSearchCriteria.departureTime` for OSDM < 3.8 | `2026-04-09T10:30:00` (LocalDateTime, no offset) | Pattern `YYYY-MM-DDTHH:MM:SS` | ✅ |
| `TripSearchCriteria.departureTime` for OSDM ≥ 3.8 | `2026-04-09T10:30:00+02:00` (OffsetDateTime) | Changed in v3.8 | ✅ |
| `ServiceTime.timetabledTime` | `2026-04-09T10:30:00+02:00` (OffsetDateTime, no Z) | Offset format, explicitly no UTC/Z | ✅ |

The version-based branching is implemented in `scenarioParser.js` — `osdmTripSearchCriteria()`. The effective OSDM version is determined at parse time (data file value takes priority over env file value) and logged to the console.

---

## Appendix — Schema Differences Between v3.3 and v3.7

The following schemas were confirmed identical between v3.3.4 and v3.7.1:
`DatedJourney`, `CompanyRef`, `NamedCompany`, `ProductCategory`, `VehicleNumber`, `StopPlaceRef`, `ServiceTime`, `BoardSpecification` (structure), `TripLegSpecification`, `TripSpecification`, `TripDataFilter`, `CarrierFilter`, `VehicleFilter`, `TripParameters` (structure).

Changes that affect the collection (none blocking):

| Schema | v3.3 | v3.7 |
|---|---|---|
| `TripSearchCriteria.departureTime` | "Needs to be in local date time format." | Clarified: "exactly one of departureTime/arrivalTime must be provided" |
| `TripParameters.numberOfResults` | `default: 5`, active | Deprecated — being removed from OJP |
| `BoardSpecification` | `stopPlaceRef` + `serviceDeparture` | Adds optional `replacedPlaceRef` |
| `AlightSpecification` | `stopPlaceRef` + `serviceArrival` | Adds optional `replacedPlaceRef` |
| `OfferCollectionRequest` | No inbound trip | Adds `inboundTripIds`, `inboundTripSpecifications`, `tripResponseParameters` |
