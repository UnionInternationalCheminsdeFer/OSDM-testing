const { validationLogger } = require('./displays.js');
const { bruTest: test } = require('./testCapture.js');

module.exports = {
  postCreateBookingResponse,
  validateFulfillments
};

// ─── Field-level helpers ─────────────────────────────────────────────────────

function validatePartIntersectionFields(offerParts, bookedParts, partType, fields) {
  fields.forEach(field => {
    const offerValues   = offerParts.map(p => p[field]).filter(v => v != null);
    const bookingValues = bookedParts.map(p => p[field]).filter(v => v != null);
    if (offerValues.length > 0 && bookingValues.length > 0) {
      test(`${partType} ${field} values have at least one member in common between offer and booking offer=[${offerValues}] booking=[${bookingValues}]`, () => {
        const intersection = offerValues.filter(v => bookingValues.includes(v));
        expect(intersection.length, `No common value for ${field} between offer and booking`).to.be.above(0);
        validationLogger(`[INFO] ${partType} ${field}: offer=[${offerValues}] booking=[${bookingValues}] intersection=[${intersection}]`);
      });
    } else if (offerValues.length === 0 && bookingValues.length === 0) {
      validationLogger(`[INFO] ${partType}: '${field}' is empty in both offer and booking`);
    } else {
      validationLogger(`[WARNING] ${partType}: '${field}' missing - offer has ${offerValues.length} values, booking has ${bookingValues.length} values`);
    }
  });
}

function validatePartEqualityFields(part, bookedPart, partType, index, fields) {
  fields.forEach(field => {
    if (part[field] != null && bookedPart[field] != null) {
      test(`${partType}[${index}].${field} matches between offer and booking : offer='${part[field]}' booking='${bookedPart[field]}'`, () => {
        expect(bookedPart[field]).to.eql(part[field]);
        validationLogger(`[INFO] ${partType}[${index}].${field}: offer='${part[field]}' booking='${bookedPart[field]}'`);
      });
    } else {
      validationLogger(`[WARNING] ${partType}[${index}]: '${field}' missing in offer or booking`);
    }
  });
}

function validatePartPrices(offerParts, bookedParts, partType) {
  const offerPrices   = offerParts.filter(p => p.price).map(p => ({ amount: p.price.amount, currency: p.price.currency, scale: p.price.scale }));
  const bookingPrices = bookedParts.filter(p => p.price).map(p => ({ amount: p.price.amount, currency: p.price.currency, scale: p.price.scale }));
  if (offerPrices.length > 0 && bookingPrices.length > 0) {
    test(`${partType} prices have at least one member in common between offer and booking`, () => {
      ['amount', 'currency', 'scale'].forEach(field => {
        const offerValues   = offerPrices.map(p => p[field]);
        const bookingValues = bookingPrices.map(p => p[field]);
        const intersection  = offerValues.filter(v => bookingValues.includes(v));
        expect(intersection.length, `No common value for price.${field} between offer and booking`).to.be.above(0);
        validationLogger(`[INFO] ${partType} price.${field}: offer=[${offerValues}] booking=[${bookingValues}] intersection=[${intersection}]`);
      });
    });
  } else if (offerPrices.length === 0 && bookingPrices.length === 0) {
    validationLogger(`[INFO] ${partType}: 'price' is empty in both offer and booking`);
  } else {
    validationLogger(`[WARNING] ${partType}: 'price' missing - offer has ${offerPrices.length} prices, booking has ${bookingPrices.length} prices`);
  }
}

function validatePartDates(part, bookedPart, partType, index) {
  ['validFrom', 'validUntil'].forEach(field => {
    if (part[field] && bookedPart[field]) {
      const partDate       = new Date(part[field]);
      const bookedPartDate = new Date(bookedPart[field]);
      if (!isNaN(partDate.getTime()) && !isNaN(bookedPartDate.getTime())) {
        test(`${partType}[${index}].${field} is present in both offer and booking`, () => {
          expect(part[field]).to.exist;
          expect(bookedPart[field]).to.exist;
          validationLogger(`[INFO] ${partType}[${index}].${field}: offer='${part[field]}' booking='${bookedPart[field]}'`);
        });
      } else {
        validationLogger(`[WARNING] ${partType}[${index}] ${field} has invalid date format`);
      }
    } else {
      validationLogger(`[WARNING] ${partType}[${index}] ${field} missing in offer or booking`);
    }
  });
}

function validateAfterSalesConditions(part, bookedPart, partType, index) {
  // Some sandboxes (e.g. Bileto) use 'afterSaleConditions' (no trailing 's') → normalise both
  const offerConditions   = part.afterSalesConditions      || part.afterSaleConditions      || [];
  const bookedConditions  = bookedPart.afterSalesConditions || bookedPart.afterSaleConditions || [];

  if (!Array.isArray(offerConditions) || offerConditions.length === 0) {
    if (Array.isArray(bookedConditions) && bookedConditions.length > 0) {
      validationLogger(`[WARNING] ${partType}[${index}] afterSalesConditions exist in booking but not in offer`);
    }
    return;
  }
  test(`${partType}[${index}] afterSalesConditions exist in both offer and booking`, () => {
    expect(bookedConditions.length, `afterSalesConditions missing or empty in booking`).to.be.above(0);
    expect(bookedConditions).to.be.an('array');
    validationLogger(`[INFO] ${partType}[${index}] has ${offerConditions.length} afterSalesCondition(s) in offer and ${bookedConditions.length} in booking`);
  });
  offerConditions.forEach((condition, condIndex) => {
    const condType        = condition.condition;
    const bookedCondition = bookedConditions.find(c => c.condition === condType);
    test(`${partType}[${index}] afterSalesConditions[${condIndex}] - ${condType} exists in booking`, () => {
      expect(bookedCondition, `Condition '${condType}' not found in booking`).to.exist;
      validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}] - ${condType} found in booking`);
    });
    if (!bookedCondition) return;
    test(`${partType}[${index}] afterSalesConditions[${condIndex}].condition matches`, () => {
      expect(bookedCondition.condition).to.eql(condition.condition);
      validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}].condition: offer='${condition.condition}' booking='${bookedCondition.condition}'`);
    });
    if (condition.afterSaleFee && bookedCondition.afterSaleFee) {
      test(`${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee exists in both`, () => {
        expect(condition.afterSaleFee).to.exist;
        expect(bookedCondition.afterSaleFee).to.exist;
        validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee exists in both offer and booking`);
      });
      ['currency', 'amount', 'scale'].forEach(field => {
        test(`${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee.${field} matches`, () => {
          expect(bookedCondition.afterSaleFee[field]).to.eql(condition.afterSaleFee[field]);
          validationLogger(`[INFO] ${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee.${field}: offer='${condition.afterSaleFee[field]}' booking='${bookedCondition.afterSaleFee[field]}'`);
        });
      });
      const scenarioType = bru.getEnvVar("scenarioType");
      if (scenarioType && scenarioType.includes(condType)) {
        bru.setEnvVar(`afterSaleCondition_${condType}_amount`,   condition.afterSaleFee.amount);
        bru.setEnvVar(`afterSaleCondition_${condType}_currency`, condition.afterSaleFee.currency);
        bru.setEnvVar(`afterSaleCondition_${condType}_scale`,    condition.afterSaleFee.scale);
        validationLogger(`[INFO] Stored afterSaleCondition_${condType}: amount=${condition.afterSaleFee.amount}, currency=${condition.afterSaleFee.currency}`);
      }
    } else {
      validationLogger(`[WARNING] ${partType}[${index}] afterSalesConditions[${condIndex}].afterSaleFee missing in offer or booking`);
    }
  });
}

function validateAppliedPassengerTypes(part, bookedPart, partType, index) {
  if (!Array.isArray(part.appliedPassengerTypes) || part.appliedPassengerTypes.length === 0) {
    if (Array.isArray(bookedPart.appliedPassengerTypes) && bookedPart.appliedPassengerTypes.length > 0) {
      validationLogger(`[WARNING] ${partType}[${index}] appliedPassengerTypes exist in booking but not in offer`);
    }
    return;
  }
  test(`${partType}[${index}] appliedPassengerTypes exist in both offer and booking`, () => {
    expect(bookedPart.appliedPassengerTypes, `appliedPassengerTypes missing in booking`).to.exist;
    expect(bookedPart.appliedPassengerTypes).to.be.an('array');
    validationLogger(`[INFO] ${partType}[${index}] has ${part.appliedPassengerTypes.length} appliedPassengerType(s) in offer and ${bookedPart.appliedPassengerTypes.length} in booking`);
  });
  part.appliedPassengerTypes.forEach((passengerType, ptIndex) => {
    validationLogger(`[INFO] Validating ${partType}[${index}] appliedPassengerTypes[${ptIndex}] - type=${passengerType.type}`);
    // Note: passengerRef in the offer is the externalRef (e.g. "00001") while in the booking it is the
    // sandbox internal UUID → match by type only to avoid false negatives across all sandboxes.
    const bookedPassengerType = bookedPart.appliedPassengerTypes?.find(
      pt => pt.type === passengerType.type
    );
    test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}] - type=${passengerType.type} exists in booking`, () => {
      expect(bookedPassengerType, `PassengerType type='${passengerType.type}' not found in booking`).to.exist;
      validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}] - type=${passengerType.type} found in booking`);
    });
    if (!bookedPassengerType) return;

    // passengerRef is intentionally not compared: offer contains externalRef, booking contains internal UUID
    test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].passengerRef exists in booking`, () => {
      expect(bookedPassengerType.passengerRef, `passengerRef missing in booking appliedPassengerTypes`).to.be.a('string').and.not.be.empty;
      validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].passengerRef in booking: '${bookedPassengerType.passengerRef}' (offer externalRef was: '${passengerType.passengerRef}')`);
    });
    test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].type matches`, () => {
      expect(bookedPassengerType.type).to.eql(passengerType.type);
      validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].type: offer='${passengerType.type}' booking='${bookedPassengerType.type}'`);
    });

    if (passengerType.description && bookedPassengerType.description) {
      test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].description matches`, () => {
        expect(bookedPassengerType.description).to.eql(passengerType.description);
        validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].description: offer='${passengerType.description}' booking='${bookedPassengerType.description}'`);
      });
    }

    if (passengerType.tripCoverage && bookedPassengerType.tripCoverage) {
      test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage exists in both`, () => {
        expect(passengerType.tripCoverage).to.exist;
        expect(bookedPassengerType.tripCoverage).to.exist;
        validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage exists in both offer and booking`);
      });
      if (passengerType.tripCoverage.coveredTripId && bookedPassengerType.tripCoverage.coveredTripId) {
        test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredTripId matches`, () => {
          expect(bookedPassengerType.tripCoverage.coveredTripId).to.eql(passengerType.tripCoverage.coveredTripId);
          validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredTripId: offer='${passengerType.tripCoverage.coveredTripId}' booking='${bookedPassengerType.tripCoverage.coveredTripId}'`);
        });
      }
      if (passengerType.tripCoverage.coveredLegIds && bookedPassengerType.tripCoverage.coveredLegIds) {
        test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredLegIds matches`, () => {
          expect(bookedPassengerType.tripCoverage.coveredLegIds).to.have.members(passengerType.tripCoverage.coveredLegIds);
          validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage.coveredLegIds: offer=[${passengerType.tripCoverage.coveredLegIds}] booking=[${bookedPassengerType.tripCoverage.coveredLegIds}]`);
        });
      }
    } else if (passengerType.tripCoverage || bookedPassengerType.tripCoverage) {
      validationLogger(`[WARNING] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].tripCoverage missing in ${passengerType.tripCoverage ? 'booking' : 'offer'}`);
    }

    if (Array.isArray(passengerType.appliedReductionCardTypes)) {
      if (passengerType.appliedReductionCardTypes.length > 0) {
        test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes exist in both`, () => {
          expect(bookedPassengerType.appliedReductionCardTypes, `appliedReductionCardTypes missing in booking`).to.exist;
          expect(bookedPassengerType.appliedReductionCardTypes).to.be.an('array');
          validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}] has ${passengerType.appliedReductionCardTypes.length} appliedReductionCardType(s)`);
        });
        passengerType.appliedReductionCardTypes.forEach((cardType, cardIndex) => {
          const bookedCardType = bookedPassengerType.appliedReductionCardTypes?.find(c => c === cardType);
          test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes[${cardIndex}] matches`, () => {
            expect(bookedCardType).to.eql(cardType);
            validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes[${cardIndex}]: offer='${cardType}' booking='${bookedCardType}'`);
          });
        });
      } else {
        test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes is empty in both`, () => {
          expect(bookedPassengerType.appliedReductionCardTypes || []).to.be.an('array').with.lengthOf(0);
          validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].appliedReductionCardTypes is empty in both offer and booking`);
        });
      }
    }
  });
}

// ─── Part-level orchestrator ─────────────────────────────────────────────────

function validateOfferParts(offerParts, bookedParts, partType, expectedBookedOffersStatus) {
  const _idsRaw = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds");
  const ids = Array.isArray(_idsRaw) ? _idsRaw : JSON.parse(_idsRaw || "[]");

  offerParts.forEach((part, index) => {
    const bookedPart = bookedParts[index];
    if (!bookedPart) {
      validationLogger(`[WARNING] No booked ${partType}[${index}] found for offer part id=${part.id}`);
      return;
    }
    ids.push(bookedPart.id);

    validatePartIntersectionFields(offerParts, bookedParts, partType, ['exchangeable', 'refundable']);
    validatePartEqualityFields(part, bookedPart, partType, index, ['isReservationRequired', 'offerMode']);

    test(`Status is ${expectedBookedOffersStatus} for ${partType}[${index}] - expected: ${expectedBookedOffersStatus}, actual: ${bookedPart.status}`, () => {
      if (Array.isArray(expectedBookedOffersStatus)) {
        expect(expectedBookedOffersStatus).to.include(bookedPart.status);
      } else {
        expect(bookedPart.status).to.eql(expectedBookedOffersStatus);
      }
      validationLogger(`[INFO] ${partType}[${index}]: status: ${bookedPart.status}`);
    });

    // B6: Status must be a known OSDM BookingPartStatus enum value
    const _validBookingPartStatuses = ['PREBOOKED','ON_HOLD','CONFIRMED','FULFILLED',
      'CANCELLED','RELEASED','REFUNDED','EXCHANGE_ONGOING','EXCHANGED','ERROR'];
    test(`${partType}[${index}].status '${bookedPart.status}' is a valid OSDM BookingPartStatus`, () => {
      expect(_validBookingPartStatuses).to.include(bookedPart.status,
        `'${bookedPart.status}' is not a valid BookingPartStatus enum value`);
    });

    validatePartPrices(offerParts, bookedParts, partType);
    validatePartDates(part, bookedPart, partType, index);
    validateAfterSalesConditions(part, bookedPart, partType, index);
    validateAppliedPassengerTypes(part, bookedPart, partType, index);
  });

  bru.setEnvVar("admissionReservationAncillaryBookingPartsIds", ids);
}

// ─── Public functions ────────────────────────────────────────────────────────

function postCreateBookingResponse(selectedOffer, jsonData, expectedBookedOffersStatus, expectedFulfillmentStatus) {
  validationLogger("[INFO] ► postCreateBookingResponse");

  const booking = jsonData.booking;
  if (typeof booking !== 'object' || booking === null) {
    validationLogger("[ERROR] No booking found or 'booking' is not an object.");
    throw new Error("No booking found or 'booking' is not an object.");
  }

  test(`'booking' object exists`, () => {
    expect(booking, "[ERROR] 'booking' is missing or empty").to.be.an("object").that.is.not.empty;
    validationLogger(`[INFO] 'booking' object exists`);
  });

  test(`booking.id is a non-empty string (OSDM: Booking.id required)`, () => {
    validationLogger(`[INFO] booking.id: ${booking.id}`);
    expect(booking.id).to.be.a('string').and.not.be.empty;
  });
  bru.setEnvVar("bookingId", booking.id);
  if (booking.bookingCode !== undefined && booking.bookingCode !== null) {
    test(`booking.bookingCode is a non-empty string when present`, () => {
      validationLogger(`[INFO] booking.bookingCode: ${booking.bookingCode}`);
      expect(booking.bookingCode).to.be.a('string').and.not.be.empty;
    });
  } else {
    validationLogger(`[INFO] booking.bookingCode is absent (optional per OSDM spec)`);
  }

  // Collect passenger IDs
  const passengerIdList = [];
  (booking.passengers || []).forEach((passenger, i) => {
    if (passenger.id) {
      passengerIdList.push(passenger.id);
    } else {
      validationLogger(`[WARNING] Passenger at index ${i} has no ID.`);
    }
  });
  if (passengerIdList.length === 0) validationLogger("[ERROR] Passengers structure is invalid or empty.");
  validationLogger(`[FULL] Passenger IDs: [${passengerIdList}]`);
  bru.setEnvVar("passengerIdList", passengerIdList);

  // Check booking.createdOn > offer.createdOn
  const bookingDate = new Date(booking.createdOn);
  const offerDate   = new Date(selectedOffer.createdOn);
  if (!isNaN(bookingDate.getTime()) && !isNaN(offerDate.getTime())) {
    test(`booking.createdOn: ${bookingDate.toISOString()}, offer.createdOn: ${offerDate.toISOString()}`, () => {
      validationLogger(`[INFO] booking.createdOn: ${bookingDate.toISOString()}, offer.createdOn: ${offerDate.toISOString()}`);
      expect(bookingDate.getTime()).to.be.above(offerDate.getTime());
    });
  } else {
    validationLogger(`[WARNING] Invalid date - bookingDate: ${booking.createdOn}, offerDate: ${selectedOffer.createdOn}`);
  }

  // B2: confirmationTimeLimit must be a valid future datetime when present (OSDM)
  if (booking.confirmationTimeLimit) {
    const confirmLimit = new Date(booking.confirmationTimeLimit);
    test(`booking.confirmationTimeLimit is a valid future datetime (OSDM: must confirm before this deadline)`, () => {
      expect(isNaN(confirmLimit.getTime()), `confirmationTimeLimit is not a valid date`).to.be.false;
      expect(confirmLimit.getTime()).to.be.above(Date.now(),
        `confirmationTimeLimit is already in the past: ${booking.confirmationTimeLimit}`);
      validationLogger(`[INFO] booking.confirmationTimeLimit: ${booking.confirmationTimeLimit}`);
    });
  } else {
    validationLogger(`[INFO] booking.confirmationTimeLimit absent → test skipped`);
  }

  // B3: bookedOffers must be non-empty (OSDM: a booking must contain at least one BookedOffer)
  test(`booking.bookedOffers is a non-empty array (OSDM: required)`, () => {
    expect(booking.bookedOffers).to.be.an('array').with.lengthOf.at.least(1);
    validationLogger(`[INFO] booking.bookedOffers count: ${booking.bookedOffers?.length}`);
  });

  // Price structure checks
  const prov      = booking.provisionalPrice;
  const mini      = selectedOffer.offerSummary.minimalPrice;
  const confirmed = booking.confirmedPrice;

  test(`provisionalPrice structure exists`, () => {
    expect(prov, `provisionalPrice missing`).to.exist;
    validationLogger(`[INFO] provisionalPrice structure exists`);
  });
  test(`confirmedPrice structure exists`, () => {
    expect(confirmed, `confirmedPrice missing`).to.exist;
    validationLogger(`[INFO] confirmedPrice structure exists`);
  });
  test(`Price fields exist (currency, scale) in provisionalPrice and confirmedPrice`, () => {
    ['currency', 'scale'].forEach(field => {
      expect(prov[field],      `provisionalPrice.${field} missing`).to.exist;
      expect(confirmed[field], `confirmedPrice.${field} missing`).to.exist;
    });
    bru.setEnvVar("provisionalPriceAmount", prov.amount);
    bru.setEnvVar("confirmedPriceAmount",   confirmed.amount);
    validationLogger(`[INFO] provisionalPrice and confirmedPrice fields present`);
  });

  // B4: Both prices must use the same currency (OSDM: currency must be consistent within a booking)
  if (prov?.currency && confirmed?.currency) {
    test(`provisionalPrice.currency matches confirmedPrice.currency (OSDM: currency consistency)`, () => {
      expect(confirmed.currency).to.eql(prov.currency,
        `Currency mismatch: provisional=${prov.currency}, confirmed=${confirmed.currency}`);
      validationLogger(`[INFO] Currency consistent across prices: ${prov.currency}`);
    });
  }
  // H3: Offer currency must carry through to booking (OSDM: cross-flow currency consistency)
  const _offerCurrency = bru.getEnvVar("offerCurrency");
  if (_offerCurrency && prov?.currency) {
    test(`booking.provisionalPrice.currency matches offer currency (expected: ${_offerCurrency}, actual: ${prov.currency})`, () => {
      expect(prov.currency).to.eql(_offerCurrency,
        `Booking currency (${prov.currency}) differs from offer currency (${_offerCurrency})`);
    });
  }

  const requestName = req?.getName?.() ?? "";
  if (requestName === "03. POST Create Booking" || requestName === "07. GET Booking before Fulfillments") {
    test(`provisionalPrice matches minimalPrice: ${prov.amount} ${prov.currency} (scale: ${prov.scale})`, () => {
      expect(prov.amount).to.eql(mini.amount);
      expect(prov.currency).to.eql(mini.currency);
      expect(prov.scale).to.eql(mini.scale);
      validationLogger(`[INFO] provisionalPrice matches minimalPrice: ${prov.amount} ${prov.currency} (scale: ${prov.scale})`);
    });
  }

  // Validate booked offer parts
  const bookedOffers = booking.bookedOffers || [];
  validateOfferParts(selectedOffer.admissionOfferParts   || [], bookedOffers.flatMap(b => b.admissions   || []), "admission",   expectedBookedOffersStatus);
  validateOfferParts(selectedOffer.reservationOfferParts || [], bookedOffers.flatMap(b => b.reservations || []), "reservation", expectedBookedOffersStatus);
  validateOfferParts(selectedOffer.ancillaryOfferParts   || [], bookedOffers.flatMap(b => b.ancillaries  || []), "ancillary",   expectedBookedOffersStatus);

  validateFulfillments(booking.fulfillments || [], 0, expectedFulfillmentStatus);

  // Check that booking has the same number of passengers as expected from the offer
  const expectedPassengerCount = Number(bru.getEnvVar("passengerCount") || 0);
  const actualPassengerCount = (booking.passengers || []).length;
  test(`Booking contains exactly the expected number of passengers - expected: ${expectedPassengerCount}, actual: ${actualPassengerCount}`, () => {
    validationLogger(`[INFO] Booking passenger count - expected: ${expectedPassengerCount}, actual: ${actualPassengerCount}`);
    if (expectedPassengerCount > 0) {
      expect(actualPassengerCount).to.eql(expectedPassengerCount,
        `Expected exactly ${expectedPassengerCount} passengers, got ${actualPassengerCount}`);
    } else {
      expect(actualPassengerCount).to.be.above(0);
    }
  });

  // C2: fulfillmentStatus (OSDM v3.8 new field) must be a valid FulfillmentSummaryStatus enum when present
  const _validFulfillmentSummaryStatuses = ['UNISSUED','PARTIALLY_ISSUED','ISSUED',
    'PARTIALLY_USED','COMPLETELY_USED','REFUNDED','CANCELLED','EXPIRED'];
  if (booking.fulfillmentStatus !== undefined) {
    test(`booking.fulfillmentStatus '${booking.fulfillmentStatus}' is a valid FulfillmentSummaryStatus (OSDM v3.8)`, () => {
      expect(_validFulfillmentSummaryStatuses).to.include(booking.fulfillmentStatus,
        `'${booking.fulfillmentStatus}' is not a valid FulfillmentSummaryStatus`);
      validationLogger(`[INFO] booking.fulfillmentStatus: ${booking.fulfillmentStatus}`);
    });
  } else {
    validationLogger(`[INFO] booking.fulfillmentStatus absent (optional in OSDM v3.8) → test skipped`);
  }
}

function validateFulfillments(fulfillments, index, expectedFulfillmentStatus) {
  validationLogger("[INFO] ► validateFulfillments");
  if (!Array.isArray(fulfillments) || fulfillments.length === 0) {
    validationLogger("[INFO] No fulfillments available in the response, continue execution");
    return;
  }

  const fulfillmentIds   = [];
  const _bookedPartIdsRaw = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds");
  const bookedPartIds    = Array.isArray(_bookedPartIdsRaw) ? _bookedPartIdsRaw : JSON.parse(_bookedPartIdsRaw || "[]");
  const expectedStatuses = Array.isArray(expectedFulfillmentStatus) ? expectedFulfillmentStatus : [expectedFulfillmentStatus];

  test(`Fulfillments exist at index ${index}`, () => {
    expect(fulfillments).to.be.an("array").that.is.not.empty;
    validationLogger(`[INFO] Number of fulfillments: ${fulfillments.length}`);
  });

  fulfillments.forEach((fulfillment, idx) => {
    if (fulfillment?.id) {
      fulfillmentIds.push(fulfillment.id);
    }

    test(`Fulfillment[${idx}] id exists`, () => {
      expect(fulfillment.id).to.be.a("string").and.not.be.empty;
      validationLogger(`[INFO] Fulfillment[${idx}] id exists: ${fulfillment.id}`);
    });

    test(`Fulfillment[${idx}] bookingRef exists`, () => {
      expect(fulfillment.bookingRef).to.be.a("string").and.not.be.empty;
      validationLogger(`[INFO] Fulfillment[${idx}] bookingRef exists: ${fulfillment.bookingRef}`);
    });

    // D3: bookingRef must match the current bookingId (OSDM: Fulfillment.bookingRef required)
    const _currentBookingId = bru.getEnvVar("bookingId");
    if (_currentBookingId && fulfillment.bookingRef) {
      test(`Fulfillment[${idx}].bookingRef matches current bookingId (expected: ${_currentBookingId}, actual: ${fulfillment.bookingRef})`, () => {
        expect(fulfillment.bookingRef).to.eql(_currentBookingId,
          `bookingRef '${fulfillment.bookingRef}' does not match bookingId '${_currentBookingId}'`);
        validationLogger(`[INFO] Fulfillment[${idx}].bookingRef matches bookingId ✓`);
      });
    }

    // D4: createdOn must always be a valid ISO datetime (OSDM: Fulfillment.createdOn required)
    const createdOnDate = new Date(fulfillment.createdOn);
    if (!isNaN(createdOnDate.getTime())) {
      test(`Fulfillment[${idx}] createdOn is a valid datetime at or before now`, () => {
        expect(fulfillment.createdOn).to.be.a("string").and.not.be.empty;
        expect(createdOnDate.getTime()).to.be.at.most(Date.now());
        validationLogger(`[INFO] Fulfillment[${idx}] createdOn: ${fulfillment.createdOn}`);
      });
    } else {
      validationLogger(`[WARNING] Fulfillment[${idx}] createdOn has invalid date format: ${fulfillment.createdOn}`);
    }

    test(`Fulfillment[${idx}] status comparison - expected: ${expectedFulfillmentStatus}, actual: ${fulfillment.status}`, () => {
      validationLogger(`[INFO] Fulfillment[${idx}] status comparison - expected: ${expectedFulfillmentStatus}, actual: ${fulfillment.status}`);
      if (Array.isArray(expectedFulfillmentStatus)) {
        expect(expectedFulfillmentStatus).to.include(fulfillment.status);
      } else {
        expect(fulfillment.status).to.eql(expectedFulfillmentStatus);
      }
    });

    // D1: status must be a valid OSDM FulfillmentStatus enum value
    const _validFulfillmentStatuses = ['AVAILABLE','USED','PARTIALLY_USED','RESERVED',
      'EXCHANGED','REFUNDED','RELEASED','CANCELLED','EXPIRED'];
    test(`Fulfillment[${idx}].status '${fulfillment.status}' is a valid OSDM FulfillmentStatus`, () => {
      expect(_validFulfillmentStatuses).to.include(fulfillment.status,
        `'${fulfillment.status}' is not a valid FulfillmentStatus enum value`);
    });

    if (fulfillment.controlNumber != null) {
      test(`Fulfillment[${idx}] controlNumber exists`, () => {
        expect(fulfillment.controlNumber).to.be.a("string").and.not.be.empty;
      });
    } else {
      validationLogger(`[INFO] Fulfillment[${idx}] controlNumber is absent (expected for CONFIRMED without document issuance yet)`);
    }

    test(`Fulfillment[${idx}] bookingParts.id exist in admissionReservationAncillaryBookingPartsIds - expected: [${bookedPartIds}], actual: [${fulfillment.bookingParts.map(bp => bp.id)}]`, () => {
      expect(fulfillment.bookingParts).to.be.an("array").that.is.not.empty;
      fulfillment.bookingParts.forEach(part => {
        validationLogger(`[INFO] Fulfillment[${idx}] bookingPart.id: ${part.id} exists in admissionReservationAncillaryBookingPartsIds`);
        expect(bookedPartIds).to.include(part.id);
      });
    });

    if (Array.isArray(fulfillment.fulfillmentDocuments) && fulfillment.fulfillmentDocuments.length > 0) {
      test(`Fulfillment[${idx}] documents exist and contain valid data`, () => {
        expect(fulfillment.fulfillmentDocuments).to.be.an("array").that.is.not.empty;
        validationLogger(`[INFO] Fulfillment[${idx}] number of documents: ${fulfillment.fulfillmentDocuments.length}`);
        fulfillment.fulfillmentDocuments.forEach((doc, docIndex) => {
          test(`Fulfillment[${idx}].document[${docIndex}] - fields exist`, () => {
            expect(doc.medium,       "medium missing").to.be.a("string").and.not.be.empty;
            expect(doc.type,         "type missing").to.be.a("string").and.not.be.empty;
            expect(doc.downloadLink, "downloadLink missing").to.be.a("string").and.not.be.empty;
            expect(doc.format,       "format missing").to.be.a("string").and.not.be.empty;
            validationLogger(`[INFO] Fulfillment[${idx}].document[${docIndex}] -> medium=${doc.medium}, type=${doc.type}, link=${doc.downloadLink}`);
          });
        });
      });
    }

    // D2: Check fulfillmentDocumentRefs (v3.8 field, replaces deprecated fulfillmentDocuments)
    const _hasLegacyDocs = Array.isArray(fulfillment.fulfillmentDocuments) && fulfillment.fulfillmentDocuments.length > 0;
    const _hasDocRefs    = Array.isArray(fulfillment.fulfillmentDocumentRefs) && fulfillment.fulfillmentDocumentRefs.length > 0;
    if (_hasDocRefs) {
      test(`Fulfillment[${idx}].fulfillmentDocumentRefs are non-empty strings (OSDM v3.8: replaces fulfillmentDocuments)`, () => {
        fulfillment.fulfillmentDocumentRefs.forEach((ref, ri) => {
          expect(ref).to.be.a('string').and.not.be.empty;
        });
        validationLogger(`[INFO] Fulfillment[${idx}] has ${fulfillment.fulfillmentDocumentRefs.length} fulfillmentDocumentRef(s)`);
      });
    } else if (!_hasLegacyDocs) {
      validationLogger(`[INFO] Fulfillment[${idx}] has no document refs or documents (may be pre-issuance state)`);
    }
  });

  bru.setEnvVar("fulfillmentIds", JSON.stringify(fulfillmentIds));
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
