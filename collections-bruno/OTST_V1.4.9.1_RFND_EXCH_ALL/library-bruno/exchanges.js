// Import needed library files
const display = require('./displays.js');

module.exports = {
  postPatchExchangeOffersResponse,
  postPatchExchangeOperationsResponse,
  validateExchangeOfferResponse,
  validateExchangeFeesConsistentWithAfterSalesConditions,
  validateExchangeAppliedOverruleCode
};

// Function to validate exchange offers response
function postPatchExchangeOffersResponse(jsonData, expectedFulfillmentStatus) {
  validationLogger("[INFO] ➤ postPatchExchangeOffersResponse");
  // Stop flow if offers invalid
  if (!Array.isArray(jsonData.exchangeOffers) || jsonData.exchangeOffers.length === 0) {
    validationLogger("[ERROR] No exchangeOffers found or 'exchangeOffers' is not an array.");
    throw new Error("No exchangeOffers found or 'exchangeOffers' is not an array.");
  }

  // Check exchange offers exist
  test(`'exchangeOffers' array exists with ${jsonData.exchangeOffers.length} exchange offer(s)`, () => {
    validationLogger(`[INFO] 'exchangeOffers' array exists with ${jsonData.exchangeOffers.length} exchange offer(s)`);
    expect(jsonData.exchangeOffers, "[ERROR] 'exchangeOffers' is missing or empty").to.be.an("array").that.is.not.empty;
  });

  // Validate each exchange offer
  jsonData.exchangeOffers.forEach((exchangeOffer, index) => {
    validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus);
  });

  // Store first offer ID
  bru.setEnvVar("exchangeOffersOfferId", jsonData.exchangeOffers[0].offerId);
  validationLogger(`[INFO] Stored exchangeOffersOfferId: ${jsonData.exchangeOffers[0].offerId}`);
}

// Function to validate exchange operations response (using 11_turnit_exchange.json structure)
function postPatchExchangeOperationsResponse(jsonData, expectedExchangeOperationStatus, expectedFulfillmentStatus) {
  validationLogger("[INFO] ➤ postPatchExchangeOperationsResponse");
  if (typeof checkWarningsAndProblems === "function") {
    checkWarningsAndProblems(jsonData);
  }
  // Stop flow if exchangeOperation invalid
  if (typeof jsonData.exchangeOperation !== 'object' || jsonData.exchangeOperation === null) {
    validationLogger("[ERROR] No exchangeOperation found or 'exchangeOperation' is not an object.");
    throw new Error("No exchangeOperation found or 'exchangeOperation' is not an object.");
  }

  // Validate exchangeOperation exists
  test(`'exchangeOperation' exists in response`, () => {
    validationLogger("[INFO] Exchange operation found in response");
    expect(jsonData).to.have.property('exchangeOperation');
    expect(jsonData.exchangeOperation).to.not.be.null;
  });

  // Validate exchangeOperation ID
  test(`Exchange operation has a valid Id ${jsonData.exchangeOperation.id}`, () => {
    validationLogger(`[INFO] Exchange operation has a valid Id ${jsonData.exchangeOperation.id}`);
    expect(jsonData.exchangeOperation.id).to.exist;
    expect(jsonData.exchangeOperation.id).to.be.a('string').and.not.empty;
  });

  // Validate exchangeOperation status
  test(`Exchange operation has valid status, expected : ${expectedExchangeOperationStatus}, actual : ${jsonData.exchangeOperation.status}`, () => {
    validationLogger(`[INFO] Exchange operation has valid status, expected : ${expectedExchangeOperationStatus}, actual : ${jsonData.exchangeOperation.status}`);
    expect(expectedExchangeOperationStatus).to.include(jsonData.exchangeOperation.status);
  });

  // Validate exchangeOffers
  test(`Exchange operation contains exchangeOffers`, () => {
    validationLogger(`[INFO] 🔍 ${jsonData.exchangeOperation.exchangeOffers.length} exchange offer(s) in operation`);
    expect(jsonData.exchangeOperation).to.have.property('exchangeOffers');
    expect(jsonData.exchangeOperation.exchangeOffers).to.be.an('array').that.is.not.empty;
  });

  jsonData.exchangeOperation.exchangeOffers.forEach((exchangeOffer, index) => {
    validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus);
  });

  // Store exchangeOperation ID
  bru.setEnvVar("exchangeOperationId", jsonData.exchangeOperation.id);
  validationLogger(`[INFO] Stored exchangeOperationId: ${jsonData.exchangeOperation.id}`);
}

// Function to validate exchange offer
function validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus) {
  validationLogger("[INFO] ➤ validateExchangeOfferResponse");
  validationLogger(`[INFO] Validating exchange offer at index ${index}`);

  // Validate exchange offer ID
  test(`Exchange offer at index ${index} has a valid Offer Id ${exchangeOffer.offerId}`, () => {
    validationLogger(`[INFO] Exchange offer at index ${index} has a valid Offer Id ${exchangeOffer.offerId}`);
    expect(exchangeOffer.offerId).to.exist;
  });

  // Validate offer structure
  test(`Exchange offer[${index}] has required properties offerSummary, exchangeFee, exchangePrice and amountToBePaid`, () => {
    validationLogger(`[INFO] Exchange offer[${index}] has required properties offerSummary, exchangeFee, exchangePrice and amountToBePaid`);
    expect(exchangeOffer).to.have.property('offerSummary');
    expect(exchangeOffer).to.have.property('exchangeFee');
    expect(exchangeOffer).to.have.property('exchangePrice');
    expect(exchangeOffer).to.have.property('amountToBePaid');
  });

  // Validate offer summary
  if (exchangeOffer.offerSummary) {
    test(`Exchange offer [${index}] has overallFlexibility: ${exchangeOffer.offerSummary.overallFlexibility} and minimal price: ${exchangeOffer.offerSummary.minimalPrice.amount}`, () => {
      validationLogger(`[INFO] Exchange offer [${index}] has overallFlexibility: ${exchangeOffer.offerSummary.overallFlexibility} and minimal price: ${exchangeOffer.offerSummary.minimalPrice.amount}`);
      expect(exchangeOffer.offerSummary).to.have.property('overallFlexibility');
      expect(exchangeOffer.offerSummary.overallFlexibility).to.be.a('string');
      expect(exchangeOffer.offerSummary).to.have.property('minimalPrice');
      expect(exchangeOffer.offerSummary.minimalPrice.amount).to.be.a('number');
    });
  } else {
    validationLogger(`[WARN] Exchange offer[${index}] offerSummary is missing`);
  }

  // Validate amountToBePaid if present
  if (exchangeOffer.amountToBePaid) {
    test(`Exchange offer[${index}] has amount to be paid: ${exchangeOffer.amountToBePaid.amount}`, () => {
      validationLogger(`[INFO] Exchange offer[${index}] has amount to be paid: ${exchangeOffer.amountToBePaid.amount}`);
      expect(exchangeOffer.amountToBePaid.amount).to.be.a('number');
    });
    // Compare amountToBePaid with = exchangePrice + exchangeFee - confirmedPriceAmount
    const confirmedPriceAmount = Number(bru.getEnvVar("confirmedPriceAmount"));
    const expectedAmountToBePaid = exchangeOffer.exchangePrice.amount + exchangeOffer.exchangeFee.amount - confirmedPriceAmount;
    test(`Exchange offer[${index}] correctly calculated expectedAmountToBePaid (exchangePrice.amount + exchangeFee.amount - confirmedPriceAmount) : expected : ${expectedAmountToBePaid}, and exchangeOffer.amountToBePaid.amount : actual : ${exchangeOffer.amountToBePaid.amount}`, () => {
      validationLogger(`[INFO] exchangePrice.amount = ${exchangeOffer.exchangePrice.amount}`);
      validationLogger(`[INFO] exchangeFee.amount = ${exchangeOffer.exchangeFee.amount}`);
      validationLogger(`[INFO] confirmedPriceAmount = ${confirmedPriceAmount}`);
      validationLogger(`[INFO] Total expectedAmountToBePaid (exchangeOffer.exchangePrice.amount + exchangeOffer.exchangeFee.amount - confirmedPriceAmount) = ${expectedAmountToBePaid}`);
      validationLogger(`[INFO] Exchange offer[${index}] correctly calculated expectedAmountToBePaid (exchangePrice.amount + exchangeFee.amount - confirmedPriceAmount) : expected : ${expectedAmountToBePaid}, and exchangeOffer.amountToBePaid.amount : actual : ${exchangeOffer.amountToBePaid.amount}`);
      expect(exchangeOffer.amountToBePaid.amount).to.eql(expectedAmountToBePaid);
    });
  } else {
    validationLogger(`[WARN] Exchange offer[${index}] amountToBePaid is missing`);
  }

  const expectedOverruleCode = bru.getEnvVar("overruleCode") || null;
  // Validate applied overrule code if present
  if (exchangeOffer.appliedOverruleCode) {
    validateExchangeAppliedOverruleCode(exchangeOffer.appliedOverruleCode, expectedOverruleCode);

    // Validate exchange price and fees
    validateExchangeFeesConsistentWithAfterSalesConditions(exchangeOffer);
  }

  // Validate refundableAmount if present
  if (exchangeOffer.refundableAmount !== undefined && exchangeOffer.refundableAmount !== null && exchangeOffer.refundableAmount.amount !== "null") {
    test(`Exchange offer[${index}] has refundable amount defined ${exchangeOffer.refundableAmount.amount}`, () => {
      validationLogger(`[INFO] Exchange offer[${index}] has refundable amount defined ${exchangeOffer.refundableAmount.amount}`);
      expect(exchangeOffer.refundableAmount.amount).to.be.a('number');
    });
  } else {
    validationLogger(`[INFO] Exchange offer[${index}] refundable amount is not defined`);
  }

  // Store all offer part IDs for later fulfillment validation when on that specific request
  const requestName = (typeof req !== 'undefined' && typeof req.getName === 'function') ? req.getName() : "";
  if (requestName === "12. GET Exchange Offer") {
    const admissionReservationAncillaryBookingPartsIds = bru.getEnvVar("admissionReservationAncillaryBookingPartsIds") || [];
    const allPartIds = [
      ...(exchangeOffer.admissionOfferParts || []).map(part => part.id),
      ...(exchangeOffer.reservationOfferParts || []).map(part => part.id),
      ...(exchangeOffer.ancillaryOfferParts || []).map(part => part.id)
    ].filter(id => id);

    admissionReservationAncillaryBookingPartsIds.push(...allPartIds);
    bru.setEnvVar("admissionReservationAncillaryBookingPartsIds", admissionReservationAncillaryBookingPartsIds);
    validationLogger(`[INFO] Collected ${allPartIds.length} exchange offer parts IDs`);
  }

  // Validate fulfillments
  if (exchangeOffer.fulfillments && expectedFulfillmentStatus) {
    if (typeof validateFulfillments === "function") {
      validateFulfillments(exchangeOffer.fulfillments, index, expectedFulfillmentStatus);
    }
  }
}

// Function to validate exchange fees are consistent with after-sales conditions
function validateExchangeFeesConsistentWithAfterSalesConditions(exchangeOffer) {
  validationLogger("[INFO] ➤ validateExchangeFeesConsistentWithAfterSalesConditions");
  // Calculate total afterSalesConditions from all offer parts
  const exchangeFee = exchangeOffer.exchangeFee;
  const admissionOfferParts = exchangeOffer.admissionOfferParts || [];
  const reservationOfferParts = exchangeOffer.reservationOfferParts || [];
  const ancillaryOfferParts = exchangeOffer.ancillaryOfferParts || [];
  let totalAfterSalesFee = 0;
  let admissionReservationAncillaryOfferPartsAftersalesConditions = bru.getEnvVar("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0;

  // Sum afterSalesConditions from admissionOfferParts
  admissionOfferParts.forEach((admission, admIndex) => {
    if (admission.afterSalesConditions.length > 0 && Array.isArray(admission.afterSalesConditions)) {
      admission.afterSalesConditions.forEach((condition, condIndex) => {
        if (condition.afterSaleFee.amount !== undefined) {
          validationLogger(`[INFO] AdmissionOfferPart[${admIndex}].afterSalesConditions[${condIndex}].afterSaleFee.amount: ${condition.afterSaleFee.amount}`);
          const scenarioType = bru.getEnvVar("scenarioType") || "";
          if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
            totalAfterSalesFee += condition.afterSaleFee.amount;
          } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
            totalAfterSalesFee += condition.afterSaleFee.amount;
          }
        }
      });
    }
  });

  // Sum afterSalesConditions from reservationOfferParts
  reservationOfferParts.forEach((reservation, resIndex) => {
    if (reservation.afterSalesConditions.length > 0 && Array.isArray(reservation.afterSalesConditions)) {
      reservation.afterSalesConditions.forEach((condition, condIndex) => {
        if (condition.afterSaleFee.amount !== undefined) {
          validationLogger(`[INFO] ReservationOfferPart[${resIndex}].afterSalesConditions[${condIndex}].afterSaleFee.amount: ${condition.afterSaleFee.amount}`);
          const scenarioType = bru.getEnvVar("scenarioType") || "";
          if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
            totalAfterSalesFee += condition.afterSaleFee.amount;
          } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
            totalAfterSalesFee += condition.afterSaleFee.amount;
          }
        }
      });
    }
  });

  // Sum afterSalesConditions from ancillaryOfferParts
  ancillaryOfferParts.forEach((ancillary, ancIndex) => {
    if (ancillary.afterSalesConditions.length > 0 && Array.isArray(ancillary.afterSalesConditions)) {
      ancillary.afterSalesConditions.forEach((condition, condIndex) => {
        if (condition.afterSaleFee.amount !== undefined) {
          validationLogger(`[INFO] AncillaryOfferPart[${ancIndex}].afterSalesConditions[${condIndex}].afterSaleFee.amount: ${condition.afterSaleFee.amount}`);
          const scenarioType = bru.getEnvVar("scenarioType") || "";
          if (scenarioType.includes("REFUND") && condition.condition === "REFUND") {
            totalAfterSalesFee += condition.afterSaleFee.amount;
          } else if (scenarioType.includes("EXCHANGE") && condition.condition === "EXCHANGE") {
            totalAfterSalesFee += condition.afterSaleFee.amount;
          }
        }
      });
    }
  });

  validationLogger(`[INFO] Total afterSalesConditions fee from all offer parts: ${totalAfterSalesFee}`);

  // Validate exchange fee if exchange fee and afterSalesConditions exist and consistent
  if (exchangeFee && typeof exchangeFee.amount === 'number') {
    test(`Exchange fee = ${exchangeFee.amount} matches total afterSalesConditions = ${totalAfterSalesFee} from all offer parts and admissionReservationAncillaryOfferPartsAftersalesConditions from offer = ${admissionReservationAncillaryOfferPartsAftersalesConditions}`, () => {
      validationLogger(`[INFO] Exchange fee = ${exchangeFee.amount} matches total afterSalesConditions = ${totalAfterSalesFee} from all offer parts and admissionReservationAncillaryOfferPartsAftersalesConditions from offer = ${admissionReservationAncillaryOfferPartsAftersalesConditions}`);
      expect(exchangeFee.amount).to.be.at.least(0, "Exchange fee should be non-negative");
      expect(exchangeFee.amount).to.eql(totalAfterSalesFee);
      expect(exchangeFee.amount).to.eql(admissionReservationAncillaryOfferPartsAftersalesConditions);
    });
  }
}

// Function to validate applied overrule code
function validateExchangeAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
  validationLogger(`[INFO] ExpectedOverruleCode: ${expectedOverruleCode}`);
  validationLogger(`[INFO] AppliedOverruleCode: ${appliedOverruleCode}`);

  const title = expectedOverruleCode === null
    ? "AppliedOverruleCode is null as expected"
    : `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`;

  test(title, () => {
    expect(appliedOverruleCode).to.equal(expectedOverruleCode);
  });
}

// Expose to global for convenience in eval/require loader flows
try {
  Object.assign(globalThis, module.exports);
} catch (e) {
  // no-op
}
