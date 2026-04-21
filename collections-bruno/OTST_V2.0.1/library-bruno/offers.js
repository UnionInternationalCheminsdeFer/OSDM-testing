// Import needed library files
const display = require('./displays.js');
const requestsBuilder = require('./requestsBuilder.js');
const { bruTest: test } = require('./testCapture.js');
const { OSDM_PASSENGER_TYPES } = require('./osdmEnums.js');

module.exports = {
  checkWarningsAndProblems,
  postOfferResponsePreRequest,
  ensureAuthorizationOr403,
  postOfferResponse,
  selectAndSetOffer,
  validateOfferSummary,
  validatePassengers,
  validateTripsAndLegs,
  validateOfferParts,
  validateAdmissions,
  validateReservations,
  validateAncillaries,
  getTripLegCoverage,
  handleAccommodationAndPlaceSelection,
  ensureYesWhenRefundOrExchangeSelected
};

// Function to check warnings and problems in the response
function checkWarningsAndProblems(jsonData) {
  try {
    jsonData.warnings
      ? validationLogger(`[WARNING] ⚠️ Warning: ${jsonData.warnings}`)
      : validationLogger("[WARNING] ⚠️ No warnings found.");

    if (jsonData.problems?.length > 0) {
      validationLogger(`Problems found (${jsonData.problems.length}):`);
      jsonData.problems.forEach((problem, index) => {
        validationLogger(`[WARNING] ⚠️ Problem ${index + 1}:`);
        ["code", "type", "title", "status", "detail"].forEach(key => {
          validationLogger(`[WARNING] ⚠️ ${key.charAt(0).toUpperCase() + key.slice(1)}: ${problem[key] || 'Not available'}`);
        });

        if (problem.pointers?.length > 0) {
          problem.pointers.forEach((pointer, pointerIndex) => {
            validationLogger(`[WARNING] ⚠️ Pointer ${pointerIndex + 1}:`);
            ["code", "requestPointer"].forEach(key => {
              validationLogger(`[WARNING] ⚠️ ${key.charAt(0).toUpperCase() + key.slice(1)}: ${pointer[key] || 'Not available'}`);
            });
          });
        } else {
          validationLogger("[WARNING] ⚠️ No pointers found.");
        }
      });
    } else {
      validationLogger("[WARNING] ⚠️ No problems found.");
    }
  } catch (error) {
    validationLogger(`[WARNING] ⚠️ Error processing the response: ${error.message}`);
  }
}

function postOfferResponsePreRequest() {
  const requestName = (typeof req !== 'undefined' && typeof req.getName === 'function') ? req.getName() : '';
  console.log("⏩ [STEP] Executing request : " + requestName);
  validationLogger("[INFO] ➤ postOfferResponsePreRequest");

  if (typeof buildOfferCollectionRequest === "function") {
    buildOfferCollectionRequest();
  }

  ensureAuthorizationOr403();

  // Swagger capture and header logging are intentionally omitted/disabled here as in original (commented-out).
}

function ensureAuthorizationOr403() {
  validationLogger("[INFO] ➤ ensureAuthorizationOr403");
  validationLogger("[INFO] Run a preoffer authorization check to avoid 403 errors ...");

  function resolveVars(str) {
    if (!str) return str;
    return String(str).replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const v = bru.getEnvVar(varName);
      return v == null ? '' : String(v);
    });
  }

  try {
    const urlStr = (typeof req !== 'undefined' && req.getUrl) ? String(req.getUrl()) : '';
    const method = (typeof req !== 'undefined' && req.getMethod) ? req.getMethod() : 'GET';

    const resolvedUrl = resolveVars(urlStr);

    // Attempt to copy headers if possible
    let resolvedHeaders = {};
    try {
      const headersObj = req.getHeaders && req.getHeaders();
      // Try common shapes: getAll() or entries()
      if (headersObj && typeof headersObj.getAll === 'function') {
        const arr = headersObj.getAll();
        arr.forEach(h => {
          if (h && h.key) resolvedHeaders[h.key] = resolveVars(h.value);
        });
      } else if (headersObj && typeof headersObj.entries === 'function') {
        for (const { key, value } of headersObj.entries()) {
          resolvedHeaders[key] = resolveVars(value);
        }
      }
    } catch (e) {
      // If header extraction fails, continue without headers
    }

    // Best-effort body resolve (may be empty in pre-request)
    let resolvedBody = null;
    try {
      const rawBody = req.getBody && req.getBody();
      const rawStr = rawBody && typeof rawBody.toString === 'function' ? rawBody.toString() : null;
      if (rawStr) {
        const replaced = resolveVars(rawStr);
        try {
          resolvedBody = JSON.parse(replaced);
        } catch {
          resolvedBody = replaced;
        }
      }
    } catch (e) {
      // ignore body resolution failures
    }

    // Preflight call using bru.sendRequest
    if (resolvedBody) {
      resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] || 'application/json';
    }
    // bru.sendRequest expects headers as array of {key, value} objects (Postman/Bruno format)
    const headersArray = Object.entries(resolvedHeaders).map(([key, value]) => ({ key, value }));
    const bodyStr = resolvedBody
      ? (typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody))
      : undefined;
    bru.sendRequest({
      url: resolvedUrl,
      method: method,
      header: headersArray,
      body: bodyStr ? { mode: 'raw', raw: bodyStr } : undefined,
      proxy: false
    }, function (err, res) {
      if (err) {
        //console.log("⛔ Authorization precheck error:", err);
        return; // do not stop run on precheck transport errors
      }
      const code = res && (res.code || res.status || res.statusCode);
      if (code === 403 || code === 401) {
        console.log("⛔ Stop: Access forbidden (403) or Unauthorized (401). Check permissions. Access token could be expired.");
        console.error("Authorization precheck failed with " + code);
      } else if (code === 400) {
        console.log("⛔ Stop: Bad Request (400). Check request parameters and body. Possibly due to authorization.");
        console.error("Authorization precheck failed with 400");
      } else {
        validationLogger("[INFO] ✅ Authorization check passed.");
      }
    });
  } catch (e) {
    console.log("ensureAuthorizationOr403 error:", e && e.stack ? e.stack : e);
    // Don't throw here unless you want to halt the entire run
  }
}

// Function to validate offer response
function postOfferResponse(jsonData) {
  validationLogger("[INFO] ➤ postOfferResponse");
  if (typeof checkWarningsAndProblems === "function") {
    checkWarningsAndProblems(jsonData);
  }
  // Stop flow if offers invalid
  if (!Array.isArray(jsonData.offers) || jsonData.offers.length === 0) {
    validationLogger("[ERROR] No offers found or 'offers' is not an array.");
    throw new Error("No offers found or 'offers' is not an array.");
  }

  // Check offers exist
  test(`'offers' array exists with ${jsonData.offers.length} offer(s)`, () => {
    expect(jsonData.offers, "[ERROR] 'offers' is missing or empty").to.be.an("array").that.is.not.empty;
    validationLogger(`[INFO] 'offers' array exists with ${jsonData.offers.length} offer(s)`);
  });

  // A1/A3/A4: Per-offer mandatory field assertions (OSDM v3.8 spec)
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
    validationLogger(`[INFO] Stored offerCurrency: ${_offerCurrency}`);
  }

  let selectedOffer = selectAndSetOffer(jsonData);

  validateOfferSummary(selectedOffer);
  validatePassengers(jsonData);
  validateOfferParts(selectedOffer);
  validateTripsAndLegs(jsonData);
  validateAdmissions(selectedOffer);
  validateReservations(selectedOffer);
  validateAncillaries(selectedOffer);

  handleAccommodationAndPlaceSelection(selectedOffer);
  ensureYesWhenRefundOrExchangeSelected(selectedOffer);

  // Mirror original no-op env set (kept for compatibility)
  bru.setEnvVar("admissionReservationAncillaryOfferPartsIds", bru.getEnvVar("admissionReservationAncillaryOfferPartsIds"));
}

// select and set offer based on criteria
function selectAndSetOffer(jsonData) {
  validationLogger("[INFO] ➤ selectAndSetOffer");

  const desiredFlexibility = bru.getEnvVar("desiredFlexibility");
  const accommodationSelection = bru.getEnvVar("accommodationSelection");
  const scenarioType = bru.getEnvVar("scenarioType");

  // match accommodation type in reservationOfferParts
  function matchesAccommodation(offer, expectedType, requireAll = false) {
    return (offer.reservationOfferParts || []).some(part => {
      if (!Array.isArray(part.availablePlaces)) return true;

      return requireAll
        ? part.availablePlaces.every(place => place.accommodationType === expectedType)
        : part.availablePlaces.some(place => place.accommodationType === expectedType);
    });
  }

  let filteredOffers = jsonData.offers;

  // Different accommodation selection handling
  if (accommodationSelection === "SEAT") {
    validationLogger("[INFO] Filter: only SEAT (all places must be SEAT)");
    filteredOffers = filteredOffers.filter(o => matchesAccommodation(o, "SEAT", true));
  }
  else if (accommodationSelection === "COUCHETTE") {
    validationLogger("[INFO] Filter: COUCHETTE (at least 1 place)");
    filteredOffers = filteredOffers.filter(o => matchesAccommodation(o, "COUCHETTE"));
  }
  else if (accommodationSelection === "BERTH") {
    validationLogger("[INFO] Filter: BERTH (at least 1 place)");
    filteredOffers = filteredOffers.filter(o => matchesAccommodation(o, "BERTH"));
  }
  else {
    validationLogger("[INFO] No accommodation filter applied");
  }

  // Apply flexibility filter if specified
  if (desiredFlexibility) {
    validationLogger(`[INFO] Applying flexibility filter: ${desiredFlexibility}`);
    filteredOffers = filteredOffers.filter(o =>
      o.offerSummary?.overallFlexibility === desiredFlexibility
    );
  }

  // Select the first matching offer or default to the first offer
  const selectedOffer = filteredOffers[0] || jsonData.offers[0];

  validationLogger(`[INFO] Selected Offer ID: ${selectedOffer.offerId}`);
  // Per-part summary first, so a certifier reading the log can tell at a glance
  // which part(s) carry which flags. An Offer has no top-level refundable /
  // exchangeable — only its parts do, and a "refundable: NO" on an ancillary
  // (e.g. luggage fee) is often misread as the whole offer being non-refundable.
  const _partSummary = (parts, label) =>
    (parts || []).map((p, i) =>
      `  ${label}[${i}] type=${p.type || p.objectType || '?'} refundable=${p.refundable} exchangeable=${p.exchangeable}`
    ).join('\n');
  const _admissionLines   = _partSummary(selectedOffer.admissionOfferParts,   'admission');
  const _reservationLines = _partSummary(selectedOffer.reservationOfferParts, 'reservation');
  const _ancillaryLines   = _partSummary(selectedOffer.ancillaryOfferParts,   'ancillary');
  console.log(`[INFO] 🔍 Selected Offer: ${selectedOffer.offerId}`);
  if (_admissionLines)   console.log(_admissionLines);
  if (_reservationLines) console.log(_reservationLines);
  if (_ancillaryLines)   console.log(_ancillaryLines);
  // Single-line JSON tagged with a marker the OSCAR Report Builder recognises —
  // it renders the block as one collapsible pill instead of ~30 stdout rows.
  // JSON.stringify also serialises at full depth (no [Array] / [Object] truncation
  // from Node's util.inspect default depth=2).
  console.log(`[JSON:selectedOffer] ${JSON.stringify(selectedOffer)}`);

  // Store selected offer and related info in environment
  bru.setEnvVar("offer", selectedOffer);
  bru.setEnvVar("offerId", selectedOffer.offerId);
  bru.setEnvVar("offers", jsonData.offers);

  if (desiredFlexibility) {
    const actual = selectedOffer.offerSummary?.overallFlexibility;
    test(`Selected offer has expected flexibility - expected: ${desiredFlexibility}, actual: ${actual}`, () => {
      validationLogger(`[INFO] Selected offer has expected flexibility - expected: ${desiredFlexibility}, actual: ${actual}`);
      expect(actual).to.eql(desiredFlexibility);
    });

    const matchingProducts = (selectedOffer.products || []).filter(p => p.flexibility === desiredFlexibility);
    test(`At least one matching product has the expected flexibility - count : ${matchingProducts.length}`, () => {
      validationLogger(`[INFO] At least one matching product has the expected flexibility - count : ${matchingProducts.length}`);
      expect(matchingProducts.length).to.be.above(0);
    });
  }

  function validateSelectedOfferAdmission(selOffer, scenarioTypeStr, overallFlexibility) {
    if (!selOffer?.admissionOfferParts) return;

    // Do nothing if not FULL_FLEXIBLE or SEMI_FLEXIBLE
    if (overallFlexibility !== "FULL_FLEXIBLE" && overallFlexibility !== "SEMI_FLEXIBLE") {
      validationLogger(`[INFO] overallFlexibility is '${overallFlexibility}' - skipping admissionOfferParts validation`);
      return;
    }

    function validateField(field, type) {
      const parts = selOffer.admissionOfferParts;
      const allYes = parts.every(p => p[field] === "YES");
      test(`All admissionOfferParts of selected offer are ${type} - expected: YES, actual: ${parts.map(p => p[field]).join(", ")}`, () => {
        validationLogger(`[INFO] All admissionOfferParts of selected offer are ${type} - expected: YES, actual: ${parts.map(p => p[field]).join(", ")}`);
        expect(allYes, `Expected all admissionOfferParts to be ${type}`).to.be.true;
        if (!allYes) {
          validationLogger(`[ERROR] Some admissionOfferParts are not ${type}`);
          throw new Error(`⛔ Stop: selected offer admissionOfferParts are not all ${type}`);
        }
      });
    }

    if (scenarioTypeStr?.includes("EXCHANGE")) validateField("exchangeable", "exchangeable");
    if (scenarioTypeStr?.includes("REFUND")) validateField("refundable", "refundable");
  }
  validateSelectedOfferAdmission(selectedOffer, scenarioType, selectedOffer.offerSummary?.overallFlexibility);

  return selectedOffer;
}

// Offer summary validation
function validateOfferSummary(selectedOffer) {
  validationLogger("[INFO] ➤ validateOfferSummary");
  const offerSummary = selectedOffer.offerSummary || {};
  const mini = offerSummary.minimalPrice;
  const minimalPrice = offerSummary.minimalPrice?.amount;
  const overallFlexibility = offerSummary.overallFlexibility;
  const overallServiceClass = offerSummary.overallServiceClass?.name;
  const overallTravelClass = offerSummary.overallTravelClass;

  // Minimal price validation
  test(`Offer summary - minimalPrice structure exists, is a number >= 0 : ${minimalPrice}`, function () {
    validationLogger(`[INFO] Offer summary - minimalPrice structure exists, is a number >= 0 : ${minimalPrice}`);
    expect(minimalPrice).to.exist.and.is.a("number");
    expect(minimalPrice).to.be.at.least(0);
  });

  // minimalOriginalPrice structure (optional field)
  const minimalOriginalPrice = offerSummary.minimalOriginalPrice;
  if (minimalOriginalPrice) {
    test(`Offer summary - minimalOriginalPrice structure is valid`, function () {
      validationLogger(`[INFO] minimalOriginalPrice: ${minimalOriginalPrice.amount} ${minimalOriginalPrice.currency}`);
      expect(minimalOriginalPrice.amount, "minimalOriginalPrice.amount should be a number").to.be.a("number");
      expect(minimalOriginalPrice.amount, "minimalOriginalPrice.amount should be >= 0").to.be.at.least(0);
      expect(minimalOriginalPrice.currency, "minimalOriginalPrice.currency should exist").to.exist.and.be.a("string");
    });
  }

  // Check all price fields (amount, currency, scale) exist in minimalPrice
  test(`Price fields exist (currency, scale) exist in minimalPrice`, () => {
    expect(mini, 'minimalPrice is missing').to.exist;
    validationLogger(`[INFO] Price fields (currency, scale) are present in minimalPrice`);
    ['currency', 'scale'].forEach(field => {
      expect(mini[field], `minimalPrice.${field} missing`).to.exist;
    });
  });

  // Overall flexibility validation
  test(`Offer summary - overallFlexibility is defined - overallFlexibility: ${overallFlexibility}`, function () {
    validationLogger(`[INFO] Offer summary - overallFlexibility is defined - overallFlexibility: ${overallFlexibility}`);
    expect(overallFlexibility).to.be.a("string");
    bru.setEnvVar("overallFlexibility", overallFlexibility);
  });

  // overallServiceClass.type is a known value
  const overallServiceClassType = offerSummary.overallServiceClass?.type;
  if (overallServiceClassType) {
  test(`Offer summary - overallServiceClass is defined - overallServiceClass: ${overallServiceClass}`, function () {
    validationLogger(`[INFO] Offer summary - overallServiceClass is defined - overallServiceClass: ${overallServiceClass}`);
      expect(overallServiceClassType).to.be.oneOf(["BEST", "HIGH", "STANDARD", "BASIC", "ANY_CLASS"]);
    });
  }

  // Overall travel class validation
  if (overallTravelClass) {
    test(`Offer summary - overallTravelClass is defined - overallTravelClass: ${overallTravelClass}`, function () {
      validationLogger(`[INFO] Offer summary - overallTravelClass is defined - overallTravelClass: ${overallTravelClass}`);
      expect(overallTravelClass).to.be.a("string");
    });
  } else {
    validationLogger(`[INFO] overallTravelClass is not present in offer summary → test skipped`);
  }

  // overallFlexibility is a known OSDM value
  test(`Offer summary - overallFlexibility is a valid OSDM value: ${overallFlexibility}`, function () {
    validationLogger(`[INFO] Offer summary - overallFlexibility valid value check: ${overallFlexibility}`);
    expect(overallFlexibility).to.be.oneOf(["FULL_FLEXIBLE", "SEMI_FLEXIBLE", "NON_FLEXIBLE"]);
  });

  // overallAccommodationType is a known value (optional field)
  const overallAccommodationType = offerSummary.overallAccommodationType;
  if (overallAccommodationType) {
    test(`Offer summary - overallAccommodationType is a valid value: ${overallAccommodationType}`, function () {
      validationLogger(`[INFO] Offer summary - overallAccommodationType: ${overallAccommodationType}`);
      expect(overallAccommodationType).to.be.oneOf(["SEAT", "COUCHETTE", "BERTH", "VEHICLE", "STORAGE"]);
    });
  } else {
    validationLogger(`[INFO] overallAccommodationType is not present in offer summary → test skipped`);
  }

  // preBookableUntil must be defined and in the future
  const preBookableUntil = selectedOffer.preBookableUntil;
  if (preBookableUntil) {
    const preBookableDate = new Date(preBookableUntil);
    test(`Offer preBookableUntil is a valid date in the future - preBookableUntil: ${preBookableUntil}`, function () {
      validationLogger(`[INFO] preBookableUntil: ${preBookableUntil}`);
      expect(!isNaN(preBookableDate.getTime()), "preBookableUntil should be a valid ISO date").to.be.true;
      expect(preBookableDate.getTime(), "preBookableUntil should be in the future").to.be.above(Date.now());
    });
  } else {
    validationLogger(`[INFO] preBookableUntil is not present → test skipped`);
  }
}

// Passengers validation
function validatePassengers(jsonData) {
  validationLogger("[INFO] ➤ validatePassengers");
  const passengers = jsonData.anonymousPassengerSpecifications || [];
  bru.setEnvVar("passengerCount", passengers.length);

  test(`Passengers are defined - length: ${passengers.length}`, function () {
    validationLogger(`[INFO] Passengers are defined - length: ${passengers.length}`);
    expect(passengers.length).to.be.above(0);
  });

  passengers.forEach((p, i) => {
    // externalRef is defined
    test(`Passenger ${i + 1} externalRef is defined - externalRef: ${p.externalRef}`, function () {
      validationLogger(`[INFO] Passenger ${i + 1} externalRef: ${p.externalRef}`);
      expect(p.externalRef, "externalRef should exist").to.exist.and.be.a("string");
    });

    // type is a known OSDM value
    test(`Passenger ${i + 1} type is a known OSDM value - type: ${p.type}`, function () {
      validationLogger(`[INFO] Passenger ${i + 1} type valid value check: ${p.type}`);
      expect(p.type).to.be.oneOf(["YOUNG_CHILD", "CHILD", "YOUTH", "ADULT", "SENIOR", "FAMILY_CHILD", "ACCOMP_PRM", "PRM_CHILD", "WHEELCHAIR", "PERSON", "PRM", "DOG", "PET", "LUGGAGE", "BICYCLE", "PRAM", "COMPANION_DOG", "CAR", "MOTORCYCLE", "TRAILER"]);
    });

    // dateOfBirth is a valid date in the past (if present)
    if (p.dateOfBirth) {
      const dob = new Date(p.dateOfBirth);
      test(`Passenger ${i + 1} dateOfBirth is a valid date in the past - dateOfBirth: ${p.dateOfBirth}`, function () {
        validationLogger(`[INFO] Passenger ${i + 1} dateOfBirth: ${p.dateOfBirth}`);
        expect(!isNaN(dob.getTime()), "dateOfBirth should be a valid ISO date").to.be.true;
        expect(dob.getTime(), "dateOfBirth should be in the past").to.be.below(Date.now());
      });
    } else {
      validationLogger(`[INFO] Passenger ${i + 1} no dateOfBirth → test skipped`);
    }

    const reductionCards = p.appliedReductionCardTypes || [];
    test(`Passenger ${i + 1} reduction cards - reductionCards: ${JSON.stringify(reductionCards)}`, function () {
      validationLogger(`[INFO] Passenger ${i + 1} reduction cards - reductionCards: ${JSON.stringify(reductionCards)}`);
      expect(Array.isArray(reductionCards), "appliedReductionCardTypes should be an array").to.be.true;
    });
  });
}

// Trips & Legs validation
function validateTripsAndLegs(jsonData) {
  validationLogger("[INFO] ➤ validateTripsAndLegs");
  const trips = jsonData.trips || [];

  test(`Trips are defined - length: ${trips.length}`, function () {
    validationLogger(`[INFO] Trips are defined - length: ${trips.length}`);
    expect(trips.length).to.be.above(0);
  });

  // Capture trip ids and compare to coveredTripId
  const tripIds = (jsonData.trips || []).map(trip => trip.id).filter(id => id !== undefined && id !== null);
  validationLogger(`[INFO] tripIds found: ${JSON.stringify(tripIds)}`);
  const coveredTripId = bru.getEnvVar("coveredTripId");
  if (coveredTripId) {
    test(`selectedOffer.tripCoverage.coveredTripId (${coveredTripId}) is part of Trip ids`, function () {
      validationLogger(`[INFO] Checking coveredTripId ${coveredTripId} is in tripIds: ${JSON.stringify(tripIds)}`);
      expect(tripIds).to.include(coveredTripId);
    });
  } else {
    validationLogger(`[INFO] coveredTripId is not set → tripCoverage test skipped`);
  }

  trips.forEach((trip, tripIndex) => {
    const legs = trip.legs || [];

    // A7: startTime must be strictly before endTime (OSDM: Trip.startTime/endTime required)
    const tripStart = new Date(trip.startTime);
    const tripEnd   = new Date(trip.endTime);
    if (!isNaN(tripStart.getTime()) && !isNaN(tripEnd.getTime())) {
      test(`Trip ${tripIndex + 1} startTime is before endTime (OSDM: temporal order)`, () => {
        expect(tripStart.getTime()).to.be.below(tripEnd.getTime(),
          `Trip startTime (${trip.startTime}) is not before endTime (${trip.endTime})`);
        validationLogger(`[INFO] Trip ${tripIndex + 1}: startTime=${trip.startTime}, endTime=${trip.endTime} ✓`);
      });
    } else {
      validationLogger(`[WARNING] Trip ${tripIndex + 1}: startTime or endTime is not a valid date → A7 test skipped`);
    }

    // direction is a known OSDM value
    test(`Trip ${tripIndex + 1} direction is a known value - direction: ${trip.direction}`, function () {
      validationLogger(`[INFO] Trip ${tripIndex + 1} direction: ${trip.direction}`);
      expect(trip.direction).to.be.oneOf(["OUT_BOUND", "IN_BOUND"]);
    });

    if (legs.length > 0) {
      test(`Trip ${tripIndex + 1} has legs - length: ${legs.length}`, function () {
        validationLogger(`[INFO] Trip ${tripIndex + 1} has legs - length: ${legs.length}`);
        expect(legs.length).to.be.above(0);
      });
    } else {
      validationLogger(`[INFO] Trip ${tripIndex + 1} has no legs (provider may not return legs) → test skipped`);
    }

    legs.forEach((leg, legIndex) => {
      const trainId = leg.timedLeg?.service?.vehicleNumbers?.[0];
      const origin = leg.timedLeg?.start?.stopPlaceName;
      const destination = leg.timedLeg?.end?.stopPlaceName;

      test(`Trip ${tripIndex + 1} Leg ${legIndex + 1} has TrainID, Origin & Destination - TrainID: ${trainId}, Origin: ${origin}, Destination: ${destination}`, function () {
        validationLogger(`[INFO] Trip ${tripIndex + 1} Leg ${legIndex + 1} has TrainID, Origin & Destination - TrainID: ${trainId}, Origin: ${origin}, Destination: ${destination}`);
        expect(trainId).to.not.be.undefined;
        expect(origin).to.not.be.undefined;
        expect(destination).to.not.be.undefined;
      });
    });
  });
}

// Offer Parts validation
function validateOfferParts(selectedOffer) {
  validationLogger("[INFO] ➤ validateOfferParts");

  const admissionParts = selectedOffer.admissionOfferParts || [];
  const reservationParts = selectedOffer.reservationOfferParts || [];
  const ancillaryParts = selectedOffer.ancillaryOfferParts || [];

  const sumPrice = parts => parts.reduce((sum, p) => sum + (p.price?.amount || 0), 0);

  // Collect all referenced ancillary IDs from admissionOfferParts
  const referencedAncillaryIds = new Set();
  admissionParts.forEach(admissionPart => {
    const ancillaries = admissionPart.ancillaries || [];
    ancillaries.forEach(ancillary => {
      const ancillaryRefs = ancillary.ancillaryGroup?.ancillaryRefs || [];
      ancillaryRefs.forEach(ref => {
        if (ref.id) {
          referencedAncillaryIds.add(ref.id);
        }
      });
    });
  });

  // Filter ancillaryParts to only those that are referenced
  const referencedAncillaryParts = ancillaryParts.filter(part => referencedAncillaryIds.has(part.id));

  // Stock referenced ancillary IDs in environment
  bru.setEnvVar("referencedAncillaryIds", JSON.stringify([...referencedAncillaryIds]));

  const admissionPrice = sumPrice(admissionParts);
  const reservationPrice = sumPrice(reservationParts);
  const ancillaryPrice = sumPrice(referencedAncillaryParts);

  validationLogger(`[INFO] Admission parts price: ${admissionPrice}`);
  validationLogger(`[INFO] Reservation parts price: ${reservationPrice}`);
  validationLogger(`[INFO] Ancillary parts price: ${ancillaryPrice}`);

  const offerParts = [...admissionParts, ...reservationParts, ...referencedAncillaryParts];

  const minimalPrice = selectedOffer.offerSummary?.minimalPrice?.amount || 0;
  bru.setEnvVar("minimalPrice", minimalPrice);
  bru.setEnvVar("admissionPartsPrice", admissionPrice);
  bru.setEnvVar("reservationPartsPrice", reservationPrice);
  bru.setEnvVar("ancillaryPartsPrice", ancillaryPrice);

  const sumPartsPrice = sumPrice(offerParts);

  test(`Offer minimalPrice >= sum of offerParts price - minimalPrice: ${minimalPrice}, sumPartsPrice: ${sumPartsPrice}`, function () {
    validationLogger(`[INFO] Offer minimalPrice >= sum of offerParts price - minimalPrice: ${minimalPrice}, sumPartsPrice: ${sumPartsPrice}`);
    expect(minimalPrice).to.be.at.least(sumPartsPrice);
  });

  // Flexibility calculation
  const productFlex = Array.from(new Set(selectedOffer?.products?.map(p => p.flexibility).filter(Boolean)));
  const flexibilityResult = productFlex.includes("FULL_FLEXIBLE") ? "FULL_FLEXIBLE" : (productFlex.length === 1 ? productFlex[0] : "SEMI_FLEXIBLE");
  const overallFlex = selectedOffer.offerSummary?.overallFlexibility;

  test(`Offer overallFlexibility consistency - overallFlex: ${overallFlex}, flexibilityResult: ${flexibilityResult}`, () => {
    validationLogger(`[INFO] productFlex: ${productFlex.join(", ")}, Result: ${flexibilityResult}`);
    expect(overallFlex).to.eql(flexibilityResult);
  });

  // capture coveredTripId if value exists
  const coveredTripId = selectedOffer.tripCoverage && selectedOffer.tripCoverage.coveredTripId;
  if (coveredTripId !== undefined && coveredTripId !== null) {
    validationLogger(`[INFO] Covered Trip ID: ${coveredTripId}`);
    bru.setEnvVar("coveredTripId", coveredTripId);
  }

  // Validate tripCoverage.coveredLegIds are non-empty strings (if present)
  const coveredLegIds = selectedOffer.tripCoverage?.coveredLegIds || [];
  if (coveredLegIds.length > 0) {
    test(`Offer tripCoverage.coveredLegIds are non-empty strings - count: ${coveredLegIds.length}`, function () {
      validationLogger(`[INFO] tripCoverage.coveredLegIds: ${JSON.stringify(coveredLegIds)}`);
      coveredLegIds.forEach((legId, idx) => {
        expect(legId, `coveredLegIds[${idx}] should be a string`).to.be.a("string");
      });
    });
  }

  // A8: Currency consistency — all offer part prices must use the same currency as offerSummary
  const _summaryCurrency = selectedOffer.offerSummary?.minimalPrice?.currency;
  if (_summaryCurrency) {
    ['admissionOfferParts', 'reservationOfferParts', 'ancillaryOfferParts'].forEach(partType => {
      (selectedOffer[partType] || []).forEach((part, pi) => {
        if (part.price?.currency) {
          test(`${partType}[${pi}].price.currency matches offerSummary currency (expected: ${_summaryCurrency}, actual: ${part.price.currency})`, () => {
            expect(part.price.currency).to.eql(_summaryCurrency,
              `Currency mismatch in ${partType}[${pi}]: expected ${_summaryCurrency}, got ${part.price.currency}`);
          });
        }
      });
    });
    validationLogger(`[INFO] A8 currency consistency checked for all offer parts against summaryCurrency=${_summaryCurrency}`);
  }
}

// Admission validation
function validateAdmissions(selectedOffer) {
  validationLogger("[INFO] ➤ validateAdmissions");

  const overallFlex = selectedOffer.offerSummary?.overallFlexibility;
  const admissionParts = selectedOffer.admissionOfferParts || [];
  const reservationParts = selectedOffer.reservationOfferParts || [];
  const ancillaryParts = selectedOffer.ancillaryOfferParts || [];
  const _idsRaw1 = bru.getEnvVar("admissionReservationAncillaryOfferPartsIds");
  const admissionReservationAncillaryOfferPartsIds = Array.isArray(_idsRaw1) ? _idsRaw1 : JSON.parse(_idsRaw1 || "[]");
  let admissionReservationAncillaryOfferPartsAftersalesConditions = Number(bru.getEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0);

  if (admissionParts.length > 0) {
    admissionParts.forEach((admission, i) => {
      validationLogger(`[INFO] Validating admissionOfferParts ${i + 1} id=${admission.id}`);
      admissionReservationAncillaryOfferPartsIds.push(admission.id);
      bru.setEnvVar("admissionReservationAncillaryOfferPartsIds", admissionReservationAncillaryOfferPartsIds);

      // Determine business type of admission (NRT / IRT)
      let type = "NRT"; // Default: Non Reserved Ticket
      if (admission.isReservationRequired && Array.isArray(admission.reservations) && admission.reservations.length > 0) type = "IRT";

      test(`AdmissionOfferPart ${i + 1} type: ${type}`, function () {
        validationLogger(`[INFO] AdmissionOfferPart ${i + 1} type: ${type}`);
        expect(["NRT", "TLT", "IRT"]).to.include(type);
      });

      // validFrom is a valid date
      if (admission.validFrom) {
        const validFrom = new Date(admission.validFrom);
        test(`AdmissionOfferPart ${i + 1} validFrom is a valid date - validFrom: ${admission.validFrom}`, function () {
          validationLogger(`[INFO] AdmissionOfferPart ${i + 1} validFrom: ${admission.validFrom}`);
          expect(!isNaN(validFrom.getTime()), "validFrom should be a valid ISO date").to.be.true;
        });
      }

      // validUntil must be in the future
      const validUntil = new Date(admission.validUntil);
      test(`AdmissionOfferPart ${i + 1} validUntil is in the future - validUntil: ${validUntil}`, function () {
        validationLogger(`[INFO] AdmissionOfferPart ${i + 1} validUntil is in the future - validUntil: ${validUntil}`);
        expect(validUntil.getTime()).to.be.above(Date.now());
      });

      // price structure is valid
      test(`AdmissionOfferPart ${i + 1} price structure is valid - amount: ${admission.price?.amount}, currency: ${admission.price?.currency}`, function () {
        validationLogger(`[INFO] AdmissionOfferPart ${i + 1} price: ${admission.price?.amount} ${admission.price?.currency}`);
        expect(admission.price, "price should exist").to.be.an("object");
        expect(admission.price.amount, "price.amount should be a number >= 0").to.be.a("number").and.at.least(0);
        expect(admission.price.currency, "price.currency should exist").to.exist.and.be.a("string");
        expect(admission.price.scale, "price.scale should be a number").to.be.a("number");
      });

      // offerMode is defined
      if (admission.offerMode) {
        test(`AdmissionOfferPart ${i + 1} offerMode is a known value - offerMode: ${admission.offerMode}`, function () {
          validationLogger(`[INFO] AdmissionOfferPart ${i + 1} offerMode: ${admission.offerMode}`);
          expect(admission.offerMode).to.be.oneOf(["INDIVIDUAL", "COLLECTIVE"]);
        });
      }

      // appliedPassengerTypes each has a type and passengerRef
      const appliedPassengerTypes = admission.appliedPassengerTypes || [];
      if (appliedPassengerTypes.length > 0) {
        test(`AdmissionOfferPart ${i + 1} appliedPassengerTypes are valid - count: ${appliedPassengerTypes.length}`, function () {
          validationLogger(`[INFO] AdmissionOfferPart ${i + 1} appliedPassengerTypes count: ${appliedPassengerTypes.length}`);
          appliedPassengerTypes.forEach((apt, aptIdx) => {
            expect(apt.passengerRef, `appliedPassengerTypes[${aptIdx}].passengerRef should exist`).to.be.a("string");
            // Use the shared OSDM PassengerType enum from osdmEnums.js so this
            // check stays in lockstep with passengers.js. The previous inline
            // 6-value list (ADULT/YOUTH/SENIOR/CHILD/INFANT/PERSON) wrongly
            // rejected valid OSDM values like YOUNG_CHILD, DOG, BICYCLE, CAR
            // — which appear in family, pet-friendly, and auto-train offers.
            expect(apt.type, `appliedPassengerTypes[${aptIdx}].type should be a known value`).to.be.oneOf(OSDM_PASSENGER_TYPES);
          });
        });
      }

      // isReusable is a boolean (if present)
      if (admission.isReusable !== undefined) {
        test(`AdmissionOfferPart ${i + 1} isReusable is a boolean - isReusable: ${admission.isReusable}`, function () {
          validationLogger(`[INFO] AdmissionOfferPart ${i + 1} isReusable: ${admission.isReusable}`);
          expect(admission.isReusable, "isReusable should be a boolean").to.be.a("boolean");
        });
      }

      // passengerRefs: at least one
      const passengerRefs = admission.passengerRefs || [];
      test(`AdmissionOfferPart ${i + 1} passengerRefs has at least one entry`, function () {
        validationLogger(`[INFO] AdmissionOfferPart ${i + 1} passengerRefs: ${JSON.stringify(passengerRefs)}`);
        expect(passengerRefs.length).to.be.above(0);
      });

      // Validate linkage to reservationOfferParts (handles both Paxone: reservationsGroup.reservationsRefs and Turnit: reservationGroup.reservationRefs)
      const reservationsRefs = admission?.reservations?.flatMap(r =>
        r.reservationGroup?.reservationRefs || r.reservationsGroup?.reservationsRefs || []
      ) || [];
      if (reservationsRefs.length > 0) {
        test(`Reservation linkage in admission with id ${admission.id}, reservationsRef ids should match reservationOfferParts ids`, () => {
          reservationsRefs.forEach(ref => {
            const found = reservationParts.some(r => r.id === ref.id);
            validationLogger(`[INFO] reservationsRef.id : ${ref.id} → match in reservationOfferParts : ${found}`);
            expect(found, `reservationOfferParts should contain id ${ref.id}`).to.eql(true);
          });
        });
      } else {
        validationLogger(`[INFO] No reservationsRefs found for admission id=${admission.id} → test skipped`);
      }

      // Validate linkage to ancillaryOfferParts
      const ancillaryRefs = admission?.ancillaries?.flatMap(r => r.ancillaryGroup?.ancillaryRefs || []) || [];
      if (ancillaryRefs.length > 0) {
        test(`Ancillary linkage in admission with id ${admission.id}, ancillaryRef ids should match ancillaryOfferParts ids`, () => {
          ancillaryRefs.forEach(ref => {
            const found = ancillaryParts.some(a => a.id === ref.id);
            validationLogger(`[INFO] ancillaryRef.id : ${ref.id} → match in ancillaryOfferParts : ${found}`);
            expect(found, `ancillaryOfferParts should contain id ${ref.id}`).to.eql(true);
          });
        });
      } else {
        validationLogger(`[INFO] No ancillaryRefs found for admission id=${admission.id} → test skipped`);
      }

      // Validate afterSalesConditions structure
      if (Array.isArray(admission.afterSalesConditions) && admission.afterSalesConditions.length > 0) {
        test(`Admission part ${i + 1} afterSalesConditions validity`, () => {
          validationLogger(`[INFO] AdmissionOfferPart ${i + 1} has ${admission.afterSalesConditions.length} afterSalesCondition(s)`);

          admission.afterSalesConditions.forEach((condition, condIndex) => {
            validationLogger(`[INFO] Validating afterSalesCondition[${condIndex}] for admission ${admission.id}`);

            // Validate condition type
            expect(condition.condition, `afterSalesCondition[${condIndex}].condition should exist`).to.exist;
            expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND, EXCHANGE or PLACE_CHANGE (OSDM: AfterSaleConditionType)`).to.be.oneOf(['REFUND', 'EXCHANGE', 'PLACE_CHANGE']);
            validationLogger(`[INFO] afterSalesCondition[${condIndex}].condition: ${condition.condition}`);

            // Validate validFrom
            if (condition.validFrom) {
              const validFromDate = new Date(condition.validFrom);
              if (!isNaN(validFromDate.getTime())) {
                expect(condition.validFrom, `afterSalesCondition[${condIndex}].validFrom should be a valid date`).to.be.a('string');
                validationLogger(`[INFO] afterSalesCondition[${condIndex}].validFrom: ${condition.validFrom}`);
              } else {
                validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validFrom has invalid date format: ${condition.validFrom}`);
              }
            }

            // Validate validUntil
            if (condition.validUntil) {
              const validUntilDate = new Date(condition.validUntil);
              if (!isNaN(validUntilDate.getTime())) {
                expect(condition.validUntil, `afterSalesCondition[${condIndex}].validUntil should be a valid date`).to.be.a('string');
                validationLogger(`[INFO] afterSalesCondition[${condIndex}].validUntil: ${condition.validUntil}`);
              } else {
                validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validUntil has invalid date format: ${condition.validUntil}`);
              }
            }

            // Validate afterSaleFee structure
            if (condition.afterSaleFee) {
              expect(condition.afterSaleFee, `afterSalesCondition[${condIndex}].afterSaleFee should exist`).to.be.an('object');
              expect(condition.afterSaleFee.currency, `afterSalesCondition[${condIndex}].afterSaleFee.currency should exist`).to.exist;
              expect(condition.afterSaleFee.amount, `afterSalesCondition[${condIndex}].afterSaleFee.amount should be a number`).to.be.a('number');
              expect(condition.afterSaleFee.scale, `afterSalesCondition[${condIndex}].afterSaleFee.scale should be a number`).to.be.a('number');
              validationLogger(`[INFO] afterSalesCondition[${condIndex}].afterSaleFee: ${condition.afterSaleFee.amount} ${condition.afterSaleFee.currency}`);

              const scenarioType = bru.getEnvVar("scenarioType") || "";
              if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
                admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
                bru.setEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
              } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
                admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
                bru.setEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
              }
            } else {
              validationLogger(`[WARNING] afterSalesCondition[${condIndex}].afterSaleFee is missing`);
            }
          });
        });
      } else {
        validationLogger(`[INFO] No afterSalesConditions found for admission id=${admission.id} → test skipped`);
      }

      // If FULL FLEXIBLE ticket, refundable and/or exchangeable must be YES
      if (overallFlex === "FULL_FLEXIBLE" || overallFlex === "SEMI_FLEXIBLE") {
        const scenarioType = bru.getEnvVar("scenarioType") || "";
        if (scenarioType.includes("REFUND")) {
          test(`Admission part ${i + 1} refundable : ${admission.refundable}`, function () {
            validationLogger(`[INFO] Admission part ${i + 1} refundable : ${admission.refundable}`);
            expect(admission.refundable, "Refundable should be YES").to.eql("YES");
          });
        } else if (scenarioType.includes("EXCHANGE")) {
          test(`Admission part ${i + 1} exchangeable : ${admission.exchangeable}`, function () {
            validationLogger(`[INFO] Admission part ${i + 1} exchangeable : ${admission.exchangeable}`);
            expect(admission.exchangeable, "Exchangeable should be YES").to.eql("YES");
          });
        }
      }
    });
  } else {
    validationLogger(`[INFO] No admissionOfferParts found for offer.id : ${selectedOffer.offerId} → test skipped`);
  }
}

// Reservation validation
function validateReservations(selectedOffer) {
  validationLogger("[INFO] ➤ validateReservations");

  const reservationParts = selectedOffer.reservationOfferParts || [];
  const ancillaryParts = selectedOffer.ancillaryOfferParts || [];
  const _idsRaw2 = bru.getEnvVar("admissionReservationAncillaryOfferPartsIds");
  const admissionReservationAncillaryOfferPartsIds = Array.isArray(_idsRaw2) ? _idsRaw2 : JSON.parse(_idsRaw2 || "[]");
  let admissionReservationAncillaryOfferPartsAftersalesConditions = Number(bru.getEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0);

  if (reservationParts.length > 0) {
    reservationParts.forEach((reservation, i) => {
      validationLogger(`[INFO] Validating reservationOfferParts ${i + 1} id : ${reservation.id}`);
      admissionReservationAncillaryOfferPartsIds.push(reservation.id);
      bru.setEnvVar("admissionReservationAncillaryOfferPartsIds", admissionReservationAncillaryOfferPartsIds);

      // price structure is valid
      test(`ReservationOfferPart ${i + 1} price structure is valid - amount: ${reservation.price?.amount}, currency: ${reservation.price?.currency}`, function () {
        validationLogger(`[INFO] ReservationOfferPart ${i + 1} price: ${reservation.price?.amount} ${reservation.price?.currency}`);
        expect(reservation.price, "price should exist").to.be.an("object");
        expect(reservation.price.amount, "price.amount should be a number >= 0").to.be.a("number").and.at.least(0);
        expect(reservation.price.currency, "price.currency should exist").to.exist.and.be.a("string");
        expect(reservation.price.scale, "price.scale should be a number").to.be.a("number");
      });

      // refundable and exchangeable are valid OSDM values
      test(`ReservationOfferPart ${i + 1} refundable is a valid value - refundable: ${reservation.refundable}`, function () {
        validationLogger(`[INFO] ReservationOfferPart ${i + 1} refundable: ${reservation.refundable}`);
        expect(reservation.refundable).to.be.oneOf(["YES", "NO", "WITH_CONDITION"]);
      });
      test(`ReservationOfferPart ${i + 1} exchangeable is a valid value - exchangeable: ${reservation.exchangeable}`, function () {
        validationLogger(`[INFO] ReservationOfferPart ${i + 1} exchangeable: ${reservation.exchangeable}`);
        expect(reservation.exchangeable).to.be.oneOf(["YES", "NO", "WITH_CONDITION"]);
      });

      // offerMode is a known OSDM value (if present)
      if (reservation.offerMode) {
        test(`ReservationOfferPart ${i + 1} offerMode is a known value - offerMode: ${reservation.offerMode}`, function () {
          validationLogger(`[INFO] ReservationOfferPart ${i + 1} offerMode: ${reservation.offerMode}`);
          expect(reservation.offerMode).to.be.oneOf(["INDIVIDUAL", "COLLECTIVE"]);
        });
      }

      // passengerRefs: at least one
      const reservationPassengerRefs = reservation.passengerRefs || [];
      test(`ReservationOfferPart ${i + 1} passengerRefs has at least one entry`, function () {
        validationLogger(`[INFO] ReservationOfferPart ${i + 1} passengerRefs: ${JSON.stringify(reservationPassengerRefs)}`);
        expect(reservationPassengerRefs.length).to.be.above(0);
      });

      // Available Places: accommodationType oneOf + tripLegCoverage structure
      const availablePlaces = reservation.availablePlaces || [];
      if (availablePlaces.length > 0) {
        test(`Reservation part ${i + 1} availablePlaces is an array and contains accommodationType and numericAvailability`, () => {
          validationLogger(`[INFO] availablePlaces count : ${availablePlaces.length}`);
          expect(Array.isArray(availablePlaces)).to.eql(true);
          availablePlaces.forEach((place, pIndex) => {
            validationLogger(`[INFO] availablePlaces[${pIndex}] accommodationType : ${place.accommodationType}, numericAvailability : ${place.numericAvailability}`);
            expect(typeof place.accommodationType).to.eql("string");
            expect(place.accommodationType, `availablePlaces[${pIndex}].accommodationType should be a known OSDM value`).to.be.oneOf(	["SEAT", "COUCHETTE", "BERTH", "VEHICLE", "STORAGE"]);
            expect(typeof place.numericAvailability).to.eql("number");
            // tripLegCoverage structure (if present)
            if (place.tripLegCoverage) {
              expect(place.tripLegCoverage.tripId, `availablePlaces[${pIndex}].tripLegCoverage.tripId should be a string`).to.be.a("string");
              expect(place.tripLegCoverage.legId, `availablePlaces[${pIndex}].tripLegCoverage.legId should be a string`).to.be.a("string");
            }
          });
        });
      } else {
        validationLogger(`[INFO] No availablePlaces for reservation id=${reservation.id} → test skipped`);
      }

      // Numeric Availability
      if ("numericAvailability" in reservation) {
        test(`Reservation part ${i + 1} numericAvailability is a number - total: ${reservation.numericAvailability}`, () => {
          validationLogger(`[INFO] numericAvailability : ${reservation.numericAvailability}`);
          expect(typeof reservation.numericAvailability).to.eql("number");
        });
      } else {
        validationLogger(`[INFO] No numericAvailability for reservation id : ${reservation.id} → test skipped`);
      }

      // Number of Private Compartments
      if ("numberOfPrivateCompartments" in reservation) {
        test(`Reservation part ${i + 1} numberOfPrivateCompartments is a number - total: ${reservation.numberOfPrivateCompartments}`, () => {
          validationLogger(`[INFO] numberOfPrivateCompartments : ${reservation.numberOfPrivateCompartments}`);
          expect(typeof reservation.numberOfPrivateCompartments).to.eql("number");
        });
      } else {
        validationLogger(`[INFO] No numberOfPrivateCompartments for reservation id=${reservation.id} → test skipped`);
      }

      // Available Place Preferences
      const placePrefs = reservation.availablePlacePreferences || [];
      if (placePrefs.length > 0) {
        test(`Reservation part ${i + 1} availablePlacePreferences present`, () => {
          validationLogger(`[INFO] availablePlacePreferences : ${JSON.stringify(placePrefs)}`);
          expect(Array.isArray(placePrefs)).to.eql(true);
          expect(placePrefs.length).to.be.above(0);
        });
      } else {
        validationLogger(`[INFO] No availablePlacePreferences for reservation id=${reservation.id} → test skipped`);
      }

      // Validate linkage to ancillaryOfferParts
      const ancillaryRefs = reservation?.ancillaries?.flatMap(r => r.ancillaryGroup?.ancillaryRefs || []) || [];
      if (ancillaryRefs.length > 0) {
        test(`Ancillary linkage — reservation id ${reservation.id}`, () => {
          ancillaryRefs.forEach(ref => {
            const found = ancillaryParts.some(a => a.id === ref.id);
            validationLogger(`[INFO] ancillaryRef.id : ${ref.id} → match in ancillaryOfferParts : ${found}`);
            expect(found, `ancillaryOfferParts should contain id ${ref.id}`).to.eql(true);
          });
        });
      } else {
        validationLogger(`[INFO] No ancillaryRefs found for reservation id : ${reservation.id} → test skipped`);
      }

      // Validate afterSalesConditions structure
      if (Array.isArray(reservation.afterSalesConditions) && reservation.afterSalesConditions.length > 0) {
        test(`Reservation part ${i + 1} afterSalesConditions validity`, () => {
          validationLogger(`[INFO] Reservation part ${i + 1} has ${reservation.afterSalesConditions.length} afterSalesCondition(s)`);

          reservation.afterSalesConditions.forEach((condition, condIndex) => {
            validationLogger(`[INFO] Validating afterSalesCondition[${condIndex}] for reservation ${reservation.id}`);
            // Validate condition type
            expect(condition.condition, `afterSalesCondition[${condIndex}].condition should exist`).to.exist;
            expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND, EXCHANGE or PLACE_CHANGE (OSDM: AfterSaleConditionType)`).to.be.oneOf(['REFUND', 'EXCHANGE', 'PLACE_CHANGE']);
            validationLogger(`[INFO] afterSalesCondition[${condIndex}].condition: ${condition.condition}`);

            // Validate validFrom
            if (condition.validFrom) {
              const validFromDate = new Date(condition.validFrom);
              if (!isNaN(validFromDate.getTime())) {
                expect(condition.validFrom, `afterSalesCondition[${condIndex}].validFrom should be a valid date`).to.be.a('string');
                validationLogger(`[INFO] afterSalesCondition[${condIndex}].validFrom: ${condition.validFrom}`);
              } else {
                validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validFrom has invalid date format: ${condition.validFrom}`);
              }
            }

            // Validate validUntil
            if (condition.validUntil) {
              const validUntilDate = new Date(condition.validUntil);
              if (!isNaN(validUntilDate.getTime())) {
                expect(condition.validUntil, `afterSalesCondition[${condIndex}].validUntil should be a valid date`).to.be.a('string');
                validationLogger(`[INFO] afterSalesCondition[${condIndex}].validUntil: ${condition.validUntil}`);
              } else {
                validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validUntil has invalid date format: ${condition.validUntil}`);
              }
            }

            // Validate afterSaleFee structure
            if (condition.afterSaleFee) {
              expect(condition.afterSaleFee, `afterSalesCondition[${condIndex}].afterSaleFee should exist`).to.be.an('object');
              expect(condition.afterSaleFee.currency, `afterSalesCondition[${condIndex}].afterSaleFee.currency should exist`).to.exist;
              expect(condition.afterSaleFee.amount, `afterSalesCondition[${condIndex}].afterSaleFee.amount should be a number`).to.be.a('number');
              expect(condition.afterSaleFee.scale, `afterSalesCondition[${condIndex}].afterSaleFee.scale should be a number`).to.be.a('number');
              validationLogger(`[INFO] afterSalesCondition[${condIndex}].afterSaleFee: ${condition.afterSaleFee.amount} ${condition.afterSaleFee.currency}`);

              const scenarioType = bru.getEnvVar("scenarioType") || "";
              if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
                admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
                bru.setEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
              } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
                admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
                bru.setEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
              }
            } else {
              validationLogger(`[WARNING] afterSalesCondition[${condIndex}].afterSaleFee is missing`);
            }
          });
        });
      } else {
        validationLogger(`[INFO] No afterSalesConditions found for reservation id : ${reservation.id} → test skipped`);
      }
    });
  } else {
    validationLogger(`[INFO] No reservationOfferParts found for offer.id : ${selectedOffer.offerId} → test skipped`);
  }
}

function validateAncillaries(selectedOffer) {
  validationLogger("[INFO] ➤ validateAncillaries");
  const ancillaryParts = selectedOffer.ancillaryOfferParts || [];
  const _idsRaw3 = bru.getEnvVar("admissionReservationAncillaryOfferPartsIds");
  const admissionReservationAncillaryOfferPartsIds = Array.isArray(_idsRaw3) ? _idsRaw3 : JSON.parse(_idsRaw3 || "[]");
  let admissionReservationAncillaryOfferPartsAftersalesConditions = Number(bru.getEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0);

  // Capture referenced ancillary IDs from environment
  const referencedAncillaryIdsArray = JSON.parse(bru.getEnvVar("referencedAncillaryIds") || "[]");
  const referencedAncillaryIds = new Set(referencedAncillaryIdsArray);

  if (ancillaryParts.length > 0) {
    ancillaryParts.forEach((ancillary, i) => {
      validationLogger(`[INFO] Validating ancillaryOfferParts ${i + 1} id=${ancillary.id}`);

      // Add ids only if referenced in admissionOfferParts
      if (referencedAncillaryIds.has(ancillary.id)) {
        admissionReservationAncillaryOfferPartsIds.push(ancillary.id);
        bru.setEnvVar("admissionReservationAncillaryOfferPartsIds", admissionReservationAncillaryOfferPartsIds);
      }

      test(`Ancillary type is defined - type: ${ancillary.type}`, function () {
        validationLogger(`[INFO] ancillaryOfferParts ${i + 1} type: ${ancillary.type}`);
        expect(ancillary.type).to.be.a("string");
      });

      // Validate afterSalesConditions structure
      if (Array.isArray(ancillary.afterSalesConditions) && ancillary.afterSalesConditions.length > 0) {
        test(`Ancillary part ${i + 1} afterSalesConditions validity`, () => {
          validationLogger(`[INFO] Ancillary part ${i + 1} has ${ancillary.afterSalesConditions.length} afterSalesCondition(s)`);

          ancillary.afterSalesConditions.forEach((condition, condIndex) => {
            validationLogger(`[INFO] Validating afterSalesCondition[${condIndex}] for ancillary ${ancillary.id}`);
            // Validate condition type
            expect(condition.condition, `afterSalesCondition[${condIndex}].condition should exist`).to.exist;
            expect(condition.condition, `afterSalesCondition[${condIndex}].condition should be REFUND, EXCHANGE or PLACE_CHANGE (OSDM: AfterSaleConditionType)`).to.be.oneOf(['REFUND', 'EXCHANGE', 'PLACE_CHANGE']);
            validationLogger(`[INFO] afterSalesCondition[${condIndex}].condition: ${condition.condition}`);

            // Validate validFrom
            if (condition.validFrom) {
              const validFromDate = new Date(condition.validFrom);
              if (!isNaN(validFromDate.getTime())) {
                expect(condition.validFrom, `afterSalesCondition[${condIndex}].validFrom should be a valid date`).to.be.a('string');
                validationLogger(`[INFO] afterSalesCondition[${condIndex}].validFrom: ${condition.validFrom}`);
              } else {
                validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validFrom has invalid date format: ${condition.validFrom}`);
              }
            }

            // Validate validUntil
            if (condition.validUntil) {
              const validUntilDate = new Date(condition.validUntil);
              if (!isNaN(validUntilDate.getTime())) {
                expect(condition.validUntil, `afterSalesCondition[${condIndex}].validUntil should be a valid date`).to.be.a('string');
                validationLogger(`[INFO] afterSalesCondition[${condIndex}].validUntil: ${condition.validUntil}`);
              } else {
                validationLogger(`[WARNING] afterSalesCondition[${condIndex}].validUntil has invalid date format: ${condition.validUntil}`);
              }
            }

            // Validate afterSaleFee structure
            if (condition.afterSaleFee) {
              expect(condition.afterSaleFee, `afterSalesCondition[${condIndex}].afterSaleFee should exist`).to.be.an('object');
              expect(condition.afterSaleFee.currency, `afterSalesCondition[${condIndex}].afterSaleFee.currency should exist`).to.exist;
              expect(condition.afterSaleFee.amount, `afterSalesCondition[${condIndex}].afterSaleFee.amount should be a number`).to.be.a('number');
              expect(condition.afterSaleFee.scale, `afterSalesCondition[${condIndex}].afterSaleFee.scale should be a number`).to.be.a('number');
              validationLogger(`[INFO] afterSalesCondition[${condIndex}].afterSaleFee: ${condition.afterSaleFee.amount} ${condition.afterSaleFee.currency}`);

              const scenarioType = bru.getEnvVar("scenarioType") || "";
              if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
                admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
                bru.setEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
              } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
                admissionReservationAncillaryOfferPartsAftersalesConditions += condition.afterSaleFee.amount;
                bru.setEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions", admissionReservationAncillaryOfferPartsAftersalesConditions);
              }
            } else {
              validationLogger(`[WARNING] afterSalesCondition[${condIndex}].afterSaleFee is missing`);
            }
          });
        });
      } else {
        validationLogger(`[INFO] No afterSalesConditions found for ancillary id : ${ancillary.id} → test skipped`);
      }
    });
  } else {
    validationLogger(`[INFO] No ancillaryOfferParts found for offer.id : ${selectedOffer.id} → test skipped`);
  }
}

// Function to extract all tripId and legId from tripLegCoverage for a given accommodationType
function getTripLegCoverage(selectedOffer, accommodationSelection) {
  const tripLegs = [];

  (selectedOffer.reservationOfferParts || []).forEach(part => {
    if (Array.isArray(part.availablePlaces)) {
      part.availablePlaces.forEach(place => {
        if (place.accommodationType === accommodationSelection && place.tripLegCoverage) {
          tripLegs.push({
            tripId: place.tripLegCoverage.tripId,
            legId: place.tripLegCoverage.legId
          });
        }
      });
    }
  });

  return tripLegs;
}

// Helper function to handle place and accommodation selection
function handleAccommodationAndPlaceSelection(selectedOffer) {
  validationLogger("[INFO] ➤ handleAccommodationAndPlaceSelection");

  const accommodationSelection = bru.getEnvVar("accommodationSelection");

  if (accommodationSelection !== "COUCHETTE" && accommodationSelection !== "BERTH") {
    validationLogger(`[INFO] accommodationSelection is ${accommodationSelection}, skipping place selection`);
    return;
  }

  const reservationParts = selectedOffer.reservationOfferParts || [];
  validationLogger(`[INFO] Reservation Offer Parts count: ${reservationParts.length}`);

  const matchingParts = reservationParts.filter(part =>
    Array.isArray(part.availablePlaces) &&
    part.availablePlaces.some(place => place.accommodationType === accommodationSelection)
  );

  if (matchingParts.length === 0) {
    validationLogger(`[WARN] No reservationOfferParts found for accommodationType: '${accommodationSelection}'`);
    test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function () {
      expect(false, `No reservationOfferParts with accommodationType ${accommodationSelection}`).to.be.true;
    });
    return;
  }

  matchingParts.forEach(part => validationLogger(`[INFO] ${accommodationSelection} reservationOfferPart.id: ${part.id}`));
  bru.setEnvVar("reservationIds", JSON.stringify(matchingParts.map(part => part.id)));
  bru.setEnvVar("reservationId", matchingParts[0].id);

  test(`At least one reservationOfferPart has accommodationType: ${accommodationSelection}`, function () {
    expect(matchingParts.length, "No matching reservationOfferParts found").to.be.above(0);
  });

  const tripLegCoverage = getTripLegCoverage(selectedOffer, accommodationSelection);
  bru.setEnvVar("tripLegCoverage", JSON.stringify(tripLegCoverage));
  validationLogger(`[INFO] tripLegCoverage stored in environment: ${JSON.stringify(tripLegCoverage)}`);
}

function ensureYesWhenRefundOrExchangeSelected(selectedOffer) {
  validationLogger("[INFO] ➤ ensureYesWhenRefundOrExchangeSelected");

  const admissionParts = selectedOffer.admissionOfferParts || [];

  if (admissionParts.length > 0) {
    admissionParts.forEach((admission, i) => {
      const scenarioType = bru.getEnvVar("scenarioType") || "";
      if (scenarioType.includes("REFUND")) {
        test(`Admission part ${i + 1} is refundable (scenarioType=REFUND) - refundable: ${admission.refundable}`, function () {
          if (admission.refundable !== "YES") {
            validationLogger(`[ERROR] ⛔ scenarioType is REFUND but Admission part ${i + 1} is not refundable`);
          } else {
            validationLogger(`[INFO] Admission part ${i + 1} is refundable as expected, continuing.`);
          }
          expect(admission.refundable, "Admission part should be refundable in REFUND scenario").to.eql("YES");
        });
      } else if (scenarioType.includes("EXCHANGE")) {
        test(`Admission part ${i + 1} is exchangeable (scenarioType=EXCHANGE) - exchangeable: ${admission.exchangeable}`, function () {
          if (admission.exchangeable !== "YES") {
            validationLogger(`[ERROR] ⛔ scenarioType is EXCHANGE but Admission part ${i + 1} is not exchangeable`);
          } else {
            validationLogger(`[INFO] Admission part ${i + 1} is exchangeable as expected, continuing.`);
          }
          expect(admission.exchangeable, "Admission part should be exchangeable in EXCHANGE scenario").to.eql("YES");
        });
      }
    });
  }
}

// Expose globally for convenience in eval/require flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
