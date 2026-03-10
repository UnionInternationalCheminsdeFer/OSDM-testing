const { validationLogger } = require('./displays.js');

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
  if (!Array.isArray(part.afterSalesConditions) || part.afterSalesConditions.length === 0) {
    if (Array.isArray(bookedPart.afterSalesConditions) && bookedPart.afterSalesConditions.length > 0) {
      validationLogger(`[WARNING] ${partType}[${index}] afterSalesConditions exist in booking but not in offer`);
    }
    return;
  }
  test(`${partType}[${index}] afterSalesConditions exist in both offer and booking`, () => {
    expect(bookedPart.afterSalesConditions, `afterSalesConditions missing in booking`).to.exist;
    expect(bookedPart.afterSalesConditions).to.be.an('array');
    validationLogger(`[INFO] ${partType}[${index}] has ${part.afterSalesConditions.length} afterSalesCondition(s) in offer and ${bookedPart.afterSalesConditions.length} in booking`);
  });
  part.afterSalesConditions.forEach((condition, condIndex) => {
    const condType        = condition.condition;
    const bookedCondition = bookedPart.afterSalesConditions?.find(c => c.condition === condType);
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
    validationLogger(`[INFO] Validating ${partType}[${index}] appliedPassengerTypes[${ptIndex}] - ${passengerType.passengerRef}/${passengerType.type}`);
    const bookedPassengerType = bookedPart.appliedPassengerTypes?.find(
      pt => pt.passengerRef === passengerType.passengerRef && pt.type === passengerType.type
    );
    test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}] - ${passengerType.passengerRef}/${passengerType.type} exists in booking`, () => {
      expect(bookedPassengerType, `PassengerType '${passengerType.passengerRef}/${passengerType.type}' not found in booking`).to.exist;
      validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}] - ${passengerType.passengerRef}/${passengerType.type} found in booking`);
    });
    if (!bookedPassengerType) return;

    test(`${partType}[${index}] appliedPassengerTypes[${ptIndex}].passengerRef matches`, () => {
      expect(bookedPassengerType.passengerRef).to.eql(passengerType.passengerRef);
      validationLogger(`[INFO] ${partType}[${index}] appliedPassengerTypes[${ptIndex}].passengerRef: offer='${passengerType.passengerRef}' booking='${bookedPassengerType.passengerRef}'`);
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
  const ids = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds") || [];

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

  test(`Booking Id : ${booking.id} and Booking code : ${booking.bookingCode} are returned`, () => {
    validationLogger(`[INFO] Booking Id : ${booking.id} and Booking code : ${booking.bookingCode} are returned`);
    expect(booking.id).to.be.a('string').and.not.be.empty;
    expect(booking.bookingCode).to.be.a('string').and.not.be.empty;
  });
  bru.setEnvVar("bookingId", booking.id);

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

  // Check passengers from offer exist in booking
  test(`Passengers in offer should exist in booking`, () => {
    (selectedOffer.anonymousPassengerSpecifications || []).forEach(p => {
      const match = (booking.passengers || []).find(b => b.id === p.externalRef || b.externalRef === p.externalRef);
      validationLogger(`[INFO] Checking passenger externalRef=${p.externalRef} in booking`);
      expect(match, `[ERROR] Passenger ${p.externalRef} missing in booking`).to.exist;
    });
  });
}

function validateFulfillments(fulfillments, index, expectedFulfillmentStatus) {
  validationLogger("[INFO] ► validateFulfillments");
  if (!Array.isArray(fulfillments) || fulfillments.length === 0) {
    validationLogger("[INFO] No fulfillments available in the response, continue execution");
    return;
  }

  const fulfillmentIds   = [];
  const bookedPartIds    = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds") || [];
  const expectedStatuses = Array.isArray(expectedFulfillmentStatus) ? expectedFulfillmentStatus : [expectedFulfillmentStatus];

  test(`Fulfillments exist at index ${index}`, () => {
    expect(fulfillments).to.be.an("array").that.is.not.empty;
    validationLogger(`[INFO] Number of fulfillments: ${fulfillments.length}`);
  });

  fulfillments.forEach((fulfillment, idx) => {
    test(`Fulfillment[${idx}] id exists`, () => {
      expect(fulfillment.id).to.be.a("string").and.not.be.empty;
      validationLogger(`[INFO] Fulfillment[${idx}] id exists: ${fulfillment.id}`);
      fulfillmentIds.push(fulfillment.id);
      bru.setEnvVar("fulfillmentIds", fulfillmentIds);
    });

    test(`Fulfillment[${idx}] bookingRef exists`, () => {
      expect(fulfillment.bookingRef).to.be.a("string").and.not.be.empty;
      validationLogger(`[INFO] Fulfillment[${idx}] bookingRef exists: ${fulfillment.bookingRef}`);
    });

    if (expectedStatuses.includes("FULFILLED") || expectedStatuses.includes("CONFIRMED")) {
      const createdOnDate = new Date(fulfillment.createdOn);
      if (!isNaN(createdOnDate.getTime())) {
        test(`Fulfillment[${idx}] createdOn exists`, () => {
          expect(fulfillment.createdOn).to.be.a("string").and.not.be.empty;
          expect(createdOnDate.getTime()).to.be.at.most(Date.now());
          validationLogger(`[INFO] Fulfillment[${idx}] createdOn exists: ${fulfillment.createdOn}`);
        });
      } else {
        validationLogger(`[WARNING] Fulfillment[${idx}] createdOn has invalid date format: ${fulfillment.createdOn}`);
      }
    }

    test(`Fulfillment[${idx}] status comparison - expected: ${expectedFulfillmentStatus}, actual: ${fulfillment.status}`, () => {
      validationLogger(`[INFO] Fulfillment[${idx}] status comparison - expected: ${expectedFulfillmentStatus}, actual: ${fulfillment.status}`);
      if (Array.isArray(expectedFulfillmentStatus)) {
        expect(expectedFulfillmentStatus).to.include(fulfillment.status);
      } else {
        expect(fulfillment.status).to.eql(expectedFulfillmentStatus);
      }
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
  });
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
