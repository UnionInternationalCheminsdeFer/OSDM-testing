// Import needed library files
const display = require('./displays.js');
const { bruTest: test } = require('./testCapture.js');

module.exports = {
  postPatchRefundOfferResponse,
  validateRefundOfferResponse,
  validateRefundFee: validateRefundFeeLocal,
  validateRefundableAmount: validateRefundableAmountLocal,
  validateRefundAppliedOverruleCode,
  getBookingRefundResponse
};

// Function to validate refund offers response
function postPatchRefundOfferResponse(jsonData, expectedRefundOperationStatus, expectedFulfillmentStatus) {
  validationLogger("[INFO] ➤ postPatchRefundOfferResponse");
  if (typeof checkWarningsAndProblems === "function") {
    checkWarningsAndProblems(jsonData);
  }

  // Convert single refundOffer to refundOffers array if necessary
  if (jsonData.refundOffer && !jsonData.refundOffers) {
    jsonData.refundOffers = [jsonData.refundOffer];
    validationLogger("[INFO] Converted single refundOffer to refundOffers array");
  }

  // Stop flow if refundOffers invalid
  if (!Array.isArray(jsonData.refundOffers) || jsonData.refundOffers.length === 0) {
    validationLogger("[ERROR] No refundOffers found or 'refundOffers' is not an array.");
    throw new Error("No refundOffers found or 'refundOffers' is not an array.");
  }

  // Check refund offers exist
  test(`'refundOffers' array exists with ${jsonData.refundOffers.length} refund offer(s)`, () => {
    expect(jsonData.refundOffers, "[ERROR] 'refundOffers' is missing or empty").to.be.an("array").that.is.not.empty;
    validationLogger(`[INFO] 'refundOffers' array exists with ${jsonData.refundOffers.length} refund offer(s)`);
  });

  // Validate each refund offer
  jsonData.refundOffers.forEach((refundOffer, index) => {
    validateRefundOfferResponse(refundOffer, index, expectedRefundOperationStatus, expectedFulfillmentStatus);
  });

  // Store first offer ID
  bru.setEnvVar("refundOffersOfferId", jsonData.refundOffers[0].id);
  validationLogger(`[INFO] Stored refundOffersOfferId: ${jsonData.refundOffers[0].id}`);
}

// Function to validate a single refund offer
function validateRefundOfferResponse(refundOffer, index, expectedRefundOperationStatus, expectedFulfillmentStatus) {
  validationLogger("[INFO] ➤ validateRefundOfferResponse");
  validationLogger(`[INFO] Validating refund offer at index ${index}`);

  // Validate refund offer ID
  test(`Refund offer at index ${index} has a valid Offer Id ${refundOffer.id}`, () => {
    expect(refundOffer.id).to.exist;
    expect(refundOffer.id).to.be.a('string').and.not.be.empty;
    validationLogger(`[INFO] Refund offer at index ${index} has a valid Offer Id ${refundOffer.id}`);
  });

  // Validate status
  test(`Refund offer[${index}] has valid status, expected: ${expectedRefundOperationStatus}, actual: ${refundOffer.status}`, () => {
    expect(refundOffer.status).to.exist;
    // expectedRefundOperationStatus can be array or string; normalize to array
    const expectedStatuses = Array.isArray(expectedRefundOperationStatus)
      ? expectedRefundOperationStatus
      : [expectedRefundOperationStatus];
    expect(expectedStatuses).to.include(refundOffer.status);
    validationLogger(`[INFO] Refund offer[${index}] has valid status, expected: ${expectedRefundOperationStatus}, actual: ${refundOffer.status}`);
  });

  // Validate dates
  const currentDate = new Date();
  const createdOn = new Date(refundOffer.createdOn);
  const validFrom = new Date(refundOffer.validFrom);
  const validUntil = new Date(refundOffer.validUntil);

  // Validate createdOn
  if (!isNaN(createdOn.getTime())) {
    test(`Refund offer[${index}] createdOn is valid and in the past: ${refundOffer.createdOn}`, () => {
      expect(refundOffer.createdOn).to.exist;
      expect(createdOn.getTime()).to.be.at.most(currentDate.getTime());
      validationLogger(`[INFO] Refund offer[${index}] createdOn is valid and in the past: ${refundOffer.createdOn}`);
    });
  } else {
    validationLogger(`[WARNING] Refund offer[${index}] createdOn has invalid date format: ${refundOffer.createdOn}`);
  }

  // Validate validFrom
  if (!isNaN(validFrom.getTime())) {
    test(`Refund offer[${index}] validFrom is valid: ${refundOffer.validFrom}`, () => {
      expect(refundOffer.validFrom).to.exist;
      validationLogger(`[INFO] Refund offer[${index}] validFrom is valid: ${refundOffer.validFrom}`);
    });
  } else {
    validationLogger(`[WARNING] Refund offer[${index}] validFrom has invalid date format: ${refundOffer.validFrom}`);
  }

  // Validate validUntil (approx 15 minutes in future with 2 minutes tolerance)
  if (!isNaN(validUntil.getTime())) {
    test(`Refund offer[${index}] validUntil is valid and approximately 15 minutes in the future: ${refundOffer.validUntil}`, () => {
      expect(refundOffer.validUntil).to.exist;
      expect(validUntil.getTime()).to.be.above(currentDate.getTime());

      const expectedValidUntil = new Date(currentDate.getTime() + 15 * 60 * 1000);
      const tolerance = 2 * 60 * 1000; // 2 minutes
      const difference = Math.abs(validUntil.getTime() - expectedValidUntil.getTime());
      expect(difference).to.be.at.most(tolerance);
      validationLogger(`[INFO] Refund offer[${index}] validUntil is valid and approximately 15 minutes in the future: ${refundOffer.validUntil}`);
    });
  } else {
    validationLogger(`[WARNING] Refund offer[${index}] validUntil has invalid date format: ${refundOffer.validUntil}`);
  }

  // E1: validFrom must be before or equal to validUntil (OSDM: temporal order required)
  if (!isNaN(validFrom.getTime()) && !isNaN(validUntil.getTime())) {
    test(`Refund offer[${index}] validFrom is before or equal to validUntil (OSDM: temporal order)`, () => {
      expect(validFrom.getTime()).to.be.at.most(validUntil.getTime(),
        `validFrom (${refundOffer.validFrom}) is after validUntil (${refundOffer.validUntil})`);
      validationLogger(`[INFO] Refund offer[${index}] temporal order OK: validFrom=${refundOffer.validFrom} ≤ validUntil=${refundOffer.validUntil}`);
    });
  }

  // Validate appliedOverruleCode
  const overruleCode = bru.getEnvVar("overruleCode");
  validateRefundAppliedOverruleCode(refundOffer.appliedOverruleCode, overruleCode);

  // Validate refundableAmount structure, and compare amounts depending on fulfillment state
  const expectedFulfillmentStatuses = Array.isArray(expectedFulfillmentStatus) ? expectedFulfillmentStatus : [expectedFulfillmentStatus];
  const refundableAmountLabel = refundOffer.refundableAmount
    ? `amount: ${refundOffer.refundableAmount.amount}, currency: ${refundOffer.refundableAmount.currency}`
    : 'missing';
  test(`Refund offer[${index}] refundableAmount exists and is valid, ${refundableAmountLabel}`, () => {
    validationLogger(`[INFO] Refund offer[${index}] refundableAmount: ${refundOffer.refundableAmount?.amount} ${refundOffer.refundableAmount?.currency}`);
    expect(refundOffer.refundableAmount).to.exist;
    expect(refundOffer.refundableAmount).to.be.an('object');
    expect(refundOffer.refundableAmount.amount).to.be.a('number');
    expect(refundOffer.refundableAmount.currency).to.be.a('string');
    expect(refundOffer.refundableAmount.scale).to.be.a('number');

    if (expectedFulfillmentStatuses.includes("CONFIRMED") || expectedFulfillmentStatuses.includes("FULFILLED")) {
      const confirmedPriceAmount = Number(bru.getEnvVar("confirmedPriceAmount"));
      validateRefundableAmountLocal(refundOffer, overruleCode, confirmedPriceAmount);
    } else if (expectedFulfillmentStatuses.includes("PROPOSED")) {
      bru.setEnvVar("refundRefundAmount", refundOffer.refundableAmount.amount);
      bru.setEnvVar("refundFee", refundOffer.refundFee?.amount);
    }
  });

  // Validate refundFee structure
  const refundFeeLabel = refundOffer.refundFee
    ? `amount: ${refundOffer.refundFee.amount}, currency: ${refundOffer.refundFee.currency}`
    : 'missing';
  test(`Refund offer[${index}] refundFee exists and is valid, ${refundFeeLabel}`, () => {  
    validationLogger(`[INFO] Refund offer[${index}] refundFee: ${refundOffer.refundFee?.amount} ${refundOffer.refundFee?.currency}`);
    expect(refundOffer.refundFee).to.exist;
    expect(refundOffer.refundFee).to.be.an('object');
    expect(refundOffer.refundFee.amount).to.be.a('number');
    expect(refundOffer.refundFee.currency).to.be.a('string');
    expect(refundOffer.refundFee.scale).to.be.a('number');
    expect(refundOffer.refundFee.amount).to.be.at.least(0);
  });

  // E3: fulfillments must be a non-empty array (OSDM: RefundOffer.fulfillments minItems:1)
  test(`Refund offer[${index}] fulfillments is a non-empty array (OSDM: minItems:1)`, () => {
    expect(refundOffer.fulfillments).to.be.an('array').with.lengthOf.at.least(1,
      `refundOffer.fulfillments must not be empty`);
    validationLogger(`[INFO] Refund offer[${index}] has ${refundOffer.fulfillments?.length} fulfillment(s)`);
  });

  // Validate reimbursementStatus
  if (refundOffer.reimbursementStatus) {
    test(`Refund offer[${index}] has valid reimbursementStatus: ${refundOffer.reimbursementStatus}`, () => {
      expect(refundOffer.reimbursementStatus).to.exist;
      expect(refundOffer.reimbursementStatus).to.be.oneOf(['IMMEDIATE', 'DELAYED']);
      validationLogger(`[INFO] Refund offer[${index}] has valid reimbursementStatus: ${refundOffer.reimbursementStatus}`);
    });
  } else {
    validationLogger(`[INFO] reimbursementStatus is not present in refund offer[${index}] → test skipped`);
  }

  // Validate refundOfferBreakDown
  if (Array.isArray(refundOffer.refundOfferBreakDown) && refundOffer.refundOfferBreakDown.length > 0) {
    test(`Refund offer[${index}] has ${refundOffer.refundOfferBreakDown.length} breakdown(s)`, () => {
      expect(refundOffer.refundOfferBreakDown).to.be.an('array').that.is.not.empty;
      validationLogger(`[INFO] Refund offer[${index}] has ${refundOffer.refundOfferBreakDown.length} breakdown(s)`);
    });

    refundOffer.refundOfferBreakDown.forEach((breakdown, bdIndex) => {
      const bdLabel = `refundFee amount: ${breakdown.refundFee?.amount}, refundableAmount amount: ${breakdown.refundableAmount?.amount}`;
      test(`Refund offer[${index}] breakdown[${bdIndex}] is valid, ${bdLabel}`, () => {
        // Validate refundFee
        validationLogger(`[INFO] Refund offer[${index}] breakdown[${bdIndex}] refundFee: ${breakdown.refundFee.amount} ${breakdown.refundFee.currency}`);
        expect(breakdown.refundFee).to.exist;
        expect(breakdown.refundFee.amount).to.be.a('number').and.at.least(0);
        expect(breakdown.refundFee.currency).to.be.a('string');
        expect(breakdown.refundFee.scale).to.be.a('number');

        // Validate refundableAmount
        expect(breakdown.refundableAmount).to.exist;
        expect(breakdown.refundableAmount.amount).to.be.a('number');
        expect(breakdown.refundableAmount.currency).to.be.a('string');
        expect(breakdown.refundableAmount.scale).to.be.a('number');

        // Validate bookingParts
        expect(breakdown.bookingParts).to.be.an('array').that.is.not.empty;

        // Validate fulfillmentId
        expect(breakdown.fulfillmentId).to.be.a('string').and.not.be.empty;

        validationLogger(`[INFO] Refund offer[${index}] breakdown[${bdIndex}] is valid, refundFee amount: ${breakdown.refundFee.amount}, refundableAmount amount: ${breakdown.refundableAmount.amount} bookingParts=${breakdown.bookingParts.length}, fulfillmentId=${breakdown.fulfillmentId}`);
      });

      // Store bookingParts IDs for later validation (log only; storage optional)
      const partRefs = breakdown.bookingParts.map(bp => bp.id);
      validationLogger(`[INFO] Refund offer[${index}] breakdown[${bdIndex}] bookingParts IDs: ${partRefs.join(', ')}`);
    });
  } else {
    validationLogger(`[INFO] No refundOfferBreakDown found for refund offer[${index}]`);
  }

  // Validate fulfillments
  if (refundOffer.fulfillments) {
    if (typeof validateFulfillments === "function") {
      // Support both signatures: (fulfillments, expected) and (fulfillments, index, expected)
      if (validateFulfillments.length >= 3) {
        validateFulfillments(refundOffer.fulfillments, index, expectedFulfillmentStatus);
      } else {
        validateFulfillments(refundOffer.fulfillments, expectedFulfillmentStatus);
      }
    }
  }
}

// Wrapper in case a global implementation already exists elsewhere
function validateRefundFeeLocal(refundFee) {
  if (typeof validateRefundFee === "function" && validateRefundFee !== validateRefundFeeLocal) {
    return validateRefundFee(refundFee);
  }
  validationLogger(`[INFO] Validating refund fee: ${refundFee.amount} ${refundFee.currency}`);
  test(`Refund fee is valid and non-negative`, () => {
    expect(refundFee.amount).to.be.at.least(0);
    validationLogger(`[INFO] Refund fee amount: ${refundFee.amount} (non-negative)`);
  });
}

// Wrapper in case a global implementation already exists elsewhere
function validateRefundableAmountLocal(refundOffer, overruleCode, confirmedPriceAmount) {
  if (typeof validateRefundableAmount === "function" && validateRefundableAmount !== validateRefundableAmountLocal) {
    return validateRefundableAmount(refundOffer, overruleCode, confirmedPriceAmount);
  }
  validationLogger(`[INFO] confirmedPriceAmount: ${confirmedPriceAmount}`);
  validationLogger(`[INFO] RefundOffer.refundableAmount.amount: ${refundOffer.refundableAmount.amount}`);
  validationLogger(`[INFO] RefundOffer.refundFee.amount: ${refundOffer.refundFee.amount}`);
  validationLogger(`[INFO] OverruleCode: ${overruleCode}`);

  if (!overruleCode || overruleCode === "CODE_DOES_NOT_EXIST") {
    test(`Refundable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST`, () => {
      expect(refundOffer.refundableAmount.amount).to.equal(0);
      validationLogger(`[INFO] Refundable amount is 0 as expected (no valid overrule code)`);
    });
  } else {
    // E2: Use integer arithmetic to avoid floating-point rounding errors on monetary values
    const _scale       = Math.pow(10, refundOffer.refundableAmount?.scale || 2);
    const _feeInt      = Math.round(refundOffer.refundFee.amount * _scale);
    const _refundInt   = Math.round(refundOffer.refundableAmount.amount * _scale);
    const _confirmedInt = Math.round(Number(confirmedPriceAmount) * _scale);
    test(`Refund financial identity: refundFee(${refundOffer.refundFee.amount}) + refundableAmount(${refundOffer.refundableAmount.amount}) = confirmedPrice(${confirmedPriceAmount}) (OSDM: integer arithmetic)`, () => {
      expect(_feeInt + _refundInt).to.eql(_confirmedInt,
        `Financial identity broken: fee(${_feeInt}) + refundable(${_refundInt}) ≠ confirmed(${_confirmedInt})`);
      validationLogger(`[INFO] Financial identity verified (scaled): ${_feeInt} + ${_refundInt} = ${_confirmedInt}`);
    });
  }
}

// Function to validate applied overrule code (uses global validateAppliedOverruleCode if available)
function validateRefundAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
  validationLogger(`[INFO] ExpectedOverruleCode: ${expectedOverruleCode}`);
  validationLogger(`[INFO] AppliedOverruleCode: ${appliedOverruleCode}`);
  if (typeof validateAppliedOverruleCode === "function") {
    return validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode);
  }
  const title = expectedOverruleCode === null
    ? "AppliedOverruleCode is null as expected"
    : `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`;
  test(title, () => {
    expect(appliedOverruleCode).to.equal(expectedOverruleCode);
  });
}

// Function to validate booking response for refund
function getBookingRefundResponse(response, scenarioType) {
  // Response status check (Bruno)
  if (typeof res !== "undefined" && typeof res.getStatus === "function") {
    const status = res.getStatus();
    if (status !== 200) {
      throw new Error(`Exiting script due to wrong response status: ${status}`);
    }
    test('Successfully received booking', () => expect(status).to.eql(200));
  }

  if (!response.booking) {
    throw new Error("⛔ Exiting script, no booking available in the response");
  }

  const booking = response.booking;

  if (["postRefund", "patchRefund"].includes(scenarioType)) {
    const _refsRaw = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds");
    const idsAdmissionAncillariesReservationReference = Array.isArray(_refsRaw) ? _refsRaw : JSON.parse(_refsRaw || "[]");
    validationLogger(`[INFO] Reference for admissions, ancillaries and reservations: ${idsAdmissionAncillariesReservationReference}`);

    idsAdmissionAncillariesReservationReference.forEach(refId => {
      const admissions = booking.bookedOffers?.[0]?.admissions || [];
      const reservations = booking.bookedOffers?.[0]?.reservations || [];
      const ancillaries = booking.bookedOffers?.[0]?.ancillaries || [];

      const matchedAdmission = admissions.find(admission => admission.id === refId);
      const matchedReservation = reservations.find(reservation => reservation.id === refId);
      const matchedAncillary = ancillaries.find(ancillary => ancillary.id === refId);

      if (matchedAdmission || matchedReservation || matchedAncillary) {
        test(`RefundOfferPart '${refId}' found in booking`, () => {
          expect(true).to.be.true;
        });
      } else {
        test(`RefundOfferPart '${refId}' NOT found in booking`, () => {
          expect.fail(`[ERROR] ID '${refId}' not found in admissions or reservations or ancillaries`);
        });
      }
    });

    test("Booking is present and Booking ID is valid", () => {
      expect(response).to.have.property('booking');
      expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
    });

    const validUntilRefundOffers = new Date(booking.refundOffers?.[0]?.validUntil);
    const currentDate = new Date();

    test("Valid until is set and still valid for the RefundOffers", () => {
      expect(validUntilRefundOffers).to.exist;
      expect(validUntilRefundOffers.getTime()).to.be.above(currentDate.getTime());
    });

    test("Refund offers are valid", () => {
      expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
      const refundOffer = booking.refundOffers[0];

      expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;

      const expectedStatus = scenarioType === "postRefund" ? 'PROPOSED' : 'CONFIRMED';
      if (expectedStatus === 'CONFIRMED') {
        bru.setEnvVar("isRefundConfirmed", true);
      }

      if (typeof validateFulfillments === "function") {
        // Signature handling as above
        if (validateFulfillments.length >= 3) {
          validateFulfillments(refundOffer.fulfillments, 0, expectedStatus);
        } else {
          validateFulfillments(refundOffer.fulfillments, expectedStatus);
        }
      }

      validateRefundFeeLocal(refundOffer.refundFee);

      const overruleCode = bru.getEnvVar("overruleCode");
      const confirmedPriceAmount = Number(bru.getEnvVar("confirmedPriceAmount"));
      validateRefundableAmountLocal(refundOffer, overruleCode, confirmedPriceAmount);
    });
  } else if (scenarioType === "deleteRefund") {
    test("Refund offers are not present, empty array returned", () => {
      expect(booking).to.have.property("refundOffers").that.is.an("array");
      expect(booking.refundOffers).to.be.empty;
    });
    // E4: After a confirmed refund, affected booking parts must have transitioned to REFUNDED status
    if (bru.getEnvVar("isRefundConfirmed") === "true") {
      const _allParts = (booking.bookedOffers || [])
        .flatMap(bo => [...(bo.admissions||[]), ...(bo.reservations||[]), ...(bo.ancillaries||[])]);
      if (_allParts.length > 0) {
        test(`All booked offer parts are in REFUNDED or FULFILLED status after confirmed refund (OSDM: status transition)`, () => {
          _allParts.forEach((part, i) => {
            expect(['REFUNDED','FULFILLED'], `Part[${i}] status should be REFUNDED, got '${part.status}'`)
              .to.include(part.status);
          });
          validationLogger(`[INFO] All ${_allParts.length} parts verified as post-refund status`);
        });
      }
    }
  }
}

// Expose to global for convenience (optional)
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
