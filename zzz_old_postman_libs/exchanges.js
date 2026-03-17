// Function to validate exchange offers response
function postPatchExchangeOffersResponse(jsonData, expectedFulfillmentStatus) {
	validationLogger("[INFO] ➤ postPatchExchangeOffersResponse");
	// Stop flow if offers invalid
	if (!Array.isArray(jsonData.exchangeOffers) || jsonData.exchangeOffers.length === 0) {
		validationLogger("[ERROR] No exchangeOffers found or 'exchangeOffers' is not an array.");
		pm.execution.setNextRequest(null);
		return;
	}

	// Check exchange offers exist
	pm.test(`'exchangeOffers' array exists with ${jsonData.exchangeOffers.length} exchange offer(s)`, () => {
		validationLogger(`[INFO] 'exchangeOffers' array exists with ${jsonData.exchangeOffers.length} exchange offer(s)`);
		pm.expect(jsonData.exchangeOffers, "[ERROR] 'exchangeOffers' is missing or empty").to.be.an("array").that.is.not.empty;
	});

	// Validate each exchange offer
	jsonData.exchangeOffers.forEach((exchangeOffer, index) => {
		validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus);
	});

	// Store first offer ID
	pm.environment.set("exchangeOffersOfferId", jsonData.exchangeOffers[0].offerId);
	validationLogger(`[INFO] Stored exchangeOffersOfferId: ${jsonData.exchangeOffers[0].offerId}`);
}

// Function to validate exchange operations response (using 11_turnit_exchange.json structure)
function postPatchExchangeOperationsResponse(jsonData, expectedExchangeOperationStatus, expectedFulfillmentStatus) {
	validationLogger("[INFO] ➤ postPatchExchangeOperationsResponse");
	checkWarningsAndProblems(jsonData);
	// Stop flow if exchangeOperation invalid
	if (typeof jsonData.exchangeOperation !== 'object' || jsonData.exchangeOperation === null) {
		validationLogger("[ERROR] No exchangeOperation found or 'exchangeOperation' is not an object.");
		pm.execution.setNextRequest(null);
		return;
	}

	// Validate exchangeOperation exists
	pm.test(`'exchangeOperation' exists in response`, () => {
		validationLogger("[INFO] Exchange operation found in response");
		pm.expect(jsonData).to.have.property('exchangeOperation');
		pm.expect(jsonData.exchangeOperation).to.not.be.null;
	});

	// Validate exchangeOperation ID
	pm.test(`Exchange operation has a valid Id ${jsonData.exchangeOperation.id}`, () => {
		validationLogger(`[INFO] Exchange operation has a valid Id ${jsonData.exchangeOperation.id}`);
		pm.expect(jsonData.exchangeOperation.id).to.exist;
		pm.expect(jsonData.exchangeOperation.id).to.be.a('string').and.not.empty;
	});

	// Validate exchangeOperation status
	pm.test(`Exchange operation has valid status, expected : ${expectedExchangeOperationStatus}, actual : ${jsonData.exchangeOperation.status}`, () => {
		validationLogger(`[INFO] Exchange operation has valid status, expected : ${expectedExchangeOperationStatus}, actual : ${jsonData.exchangeOperation.status}`);
		pm.expect(expectedExchangeOperationStatus).to.include(jsonData.exchangeOperation.status);
	});

	// Validate exchangeOffers
	pm.test(`Exchange operation contains exchangeOffers`, () => {
		validationLogger(`[INFO] 🔍 ${jsonData.exchangeOperation.exchangeOffers.length} exchange offer(s) in operation`);
		pm.expect(jsonData.exchangeOperation).to.have.property('exchangeOffers');
		pm.expect(jsonData.exchangeOperation.exchangeOffers).to.be.an('array').that.is.not.empty;
	});

	jsonData.exchangeOperation.exchangeOffers.forEach((exchangeOffer, index) => {
		validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus);
	});

	// Store exchangeOperation ID
	pm.environment.set("exchangeOperationId", jsonData.exchangeOperation.id);
	validationLogger(`[INFO] Stored exchangeOperationId: ${jsonData.exchangeOperation.id}`);
}

// Function to validate exchange offer
function validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus) {
	validationLogger("[INFO] ➤ validateExchangeOfferResponse");
	validationLogger(`[INFO] Validating exchange offer at index ${index}`);

	// Validate exchange offer ID
	pm.test(`Exchange offer at index ${index} has a valid Offer Id ${exchangeOffer.offerId}`, () => {
		validationLogger(`[INFO] Exchange offer at index ${index} has a valid Offer Id ${exchangeOffer.offerId}`);
		pm.expect(exchangeOffer.offerId).to.exist;
	});

	// Validate offer structure
	pm.test(`Exchange offer[${index}] has required properties offerSummary, exchangeFee, exchangePrice and amountToBePaid`, () => {
		validationLogger(`[INFO] Exchange offer[${index}] has required properties offerSummary, exchangeFee, exchangePrice and amountToBePaid`);
		pm.expect(exchangeOffer).to.have.property('offerSummary');
		pm.expect(exchangeOffer).to.have.property('exchangeFee');
		pm.expect(exchangeOffer).to.have.property('exchangePrice');
		pm.expect(exchangeOffer).to.have.property('amountToBePaid');
	});

	// Validate offer summary
	if (exchangeOffer.offerSummary) {
		pm.test(`Exchange offer [${index}] has overallFlexibility: ${exchangeOffer.offerSummary.overallFlexibility} and minimal price: ${exchangeOffer.offerSummary.minimalPrice.amount}`, () => {
			validationLogger(`[INFO] Exchange offer [${index}] has overallFlexibility: ${exchangeOffer.offerSummary.overallFlexibility} and minimal price: ${exchangeOffer.offerSummary.minimalPrice.amount}`);
			pm.expect(exchangeOffer.offerSummary).to.have.property('overallFlexibility');
			pm.expect(exchangeOffer.offerSummary.overallFlexibility).to.be.a('string');
			pm.expect(exchangeOffer.offerSummary).to.have.property('minimalPrice');
			pm.expect(exchangeOffer.offerSummary.minimalPrice.amount).to.be.a('number');
		});
	} else {
		validationLogger(`[WARN] Exchange offer[${index}] offerSummary is missing`);
	}

	// Validate amountToBePaid if present
	if (exchangeOffer.amountToBePaid) {
		pm.test(`Exchange offer[${index}] has amount to be paid: ${exchangeOffer.amountToBePaid.amount}`, () => {
			validationLogger(`[INFO] Exchange offer[${index}] has amount to be paid: ${exchangeOffer.amountToBePaid.amount}`);
			pm.expect(exchangeOffer.amountToBePaid.amount).to.be.a('number');
		});
		// Compare amountToBePaid with = exchangePrice + exchangeFee - confirmedPriceAmount
		const confirmedPriceAmount = pm.environment.get("confirmedPriceAmount");
		const expectedAmountToBePaid = exchangeOffer.exchangePrice.amount + exchangeOffer.exchangeFee.amount - confirmedPriceAmount;
		pm.test(`Exchange offer[${index}] correctly calculated expectedAmountToBePaid (exchangePrice.amount + exchangeFee.amount - confirmedPriceAmount) : expected : ${expectedAmountToBePaid}, and exchangeOffer.amountToBePaid.amount : actual : ${exchangeOffer.amountToBePaid.amount}`, () => {
			validationLogger(`[INFO] exchangePrice.amount = ${exchangeOffer.exchangePrice.amount}`);
			validationLogger(`[INFO] exchangeFee.amount = ${exchangeOffer.exchangeFee.amount}`);
			validationLogger(`[INFO] confirmedPriceAmount = ${confirmedPriceAmount}`);
			validationLogger(`[INFO] Total expectedAmountToBePaid (exchangeOffer.exchangePrice.amount + exchangeOffer.exchangeFee.amount - confirmedPriceAmount) = ${expectedAmountToBePaid}`);
			validationLogger(`[INFO] Exchange offer[${index}] correctly calculated expectedAmountToBePaid (exchangePrice.amount + exchangeFee.amount - confirmedPriceAmount) : expected : ${expectedAmountToBePaid}, and exchangeOffer.amountToBePaid.amount : actual : ${exchangeOffer.amountToBePaid.amount}`);
			pm.expect(exchangeOffer.amountToBePaid.amount).to.eql(expectedAmountToBePaid);
		});
	} else {
		validationLogger(`[WARN] Exchange offer[${index}] amountToBePaid is missing`);
	}

	//TODO
	// Check that exchangeFees are consistent with the afterSalesConditions for the previously sold offer
	// These checks should be performed on all the returned offers
	// Step 6: Create the exchange operations
	// Ensure the created exchange operation contains the requested offer with same information as before, impacting the demanded fulfillments
	// Step 7: Get booking
	// The previous fulfillment’s status should be EXCHANGE_ONGOING
	// The provisional amount of the booking should be equal to the exchangePrice (if previous offer is more expensive, we should check provisionalRefundableAMount)
	// exchangeOperations contains the new exchange operation

	const expectedOverruleCode = pm.environment.get("overruleCode") || null;
	// Validate applied overrule code if present
	if (exchangeOffer.appliedOverruleCode) {
		validateExchangeAppliedOverruleCode(exchangeOffer.appliedOverruleCode, expectedOverruleCode);

		// Validate exchange price and fees
		validateExchangeFeesConsistentWithAfterSalesConditions(exchangeOffer);
	}

	// Validate refundableAmount if present
	if (exchangeOffer.refundableAmount !== undefined && exchangeOffer.refundableAmount !== null && exchangeOffer.refundableAmount.amount !== "null") {
		pm.test(`Exchange offer[${index}] has refundable amount defined ${exchangeOffer.refundableAmount.amount}`, () => {
			validationLogger(`[INFO] Exchange offer[${index}] has refundable amount defined ${exchangeOffer.refundableAmount.amount}`);
			pm.expect(exchangeOffer.refundableAmount.amount).to.be.a('number');
		});
	} else {
		validationLogger(`[INFO] Exchange offer[${index}] refundable amount is not defined`);
	}

	if (pm.info.requestName === "12. GET Exchange Offer") {
		// Store all offer parts IDs in environment variable for fulfillment validation
		const admissionReservationAncillaryBookingPartsIds = pm.environment.get("admissionReservationAncillaryBookingPartsIds") || [];
		const allPartIds = [
			...(exchangeOffer.admissionOfferParts || []).map(part => part.id),
			...(exchangeOffer.reservationOfferParts || []).map(part => part.id),
			...(exchangeOffer.ancillaryOfferParts || []).map(part => part.id)
		].filter(id => id);

		admissionReservationAncillaryBookingPartsIds.push(...allPartIds);
		pm.environment.set("admissionReservationAncillaryBookingPartsIds", admissionReservationAncillaryBookingPartsIds);
		validationLogger(`[INFO] Collected ${allPartIds.length} exchange offer parts IDs`);
	}
	
	// Validate fulfillments
	if (exchangeOffer.fulfillments && expectedFulfillmentStatus) {
		validateFulfillments(exchangeOffer.fulfillments, index, expectedFulfillmentStatus);
	}
}

// Function to validate exchangeable amount
function validateExchangeFeesConsistentWithAfterSalesConditions(exchangeOffer) {
	validationLogger("[INFO] ➤ validateExchangeFeesConsistentWithAfterSalesConditions");
	// Calculate total afterSalesConditions from all offer parts
	const exchangeFee = exchangeOffer.exchangeFee;
	const admissionOfferParts = exchangeOffer.admissionOfferParts || [];
	const reservationOfferParts = exchangeOffer.reservationOfferParts || [];
	const ancillaryOfferParts = exchangeOffer.ancillaryOfferParts || []
	let totalAfterSalesFee = 0;
	let admissionReservationAncillaryOfferPartsAftersalesConditions = pm.environment.get("admissionReservationAncillaryOfferPartsAftersalesConditions") || 0;

	// Sum afterSalesConditions from admissionOfferParts
	admissionOfferParts.forEach((admission, admIndex) => {
		if (admission.afterSalesConditions.length > 0 && Array.isArray(admission.afterSalesConditions)) {
			admission.afterSalesConditions.forEach((condition, condIndex) => {
				if (condition.afterSaleFee.amount !== undefined) {
					validationLogger(`[INFO] AdmissionOfferPart[${admIndex}].afterSalesConditions[${condIndex}].afterSaleFee.amount: ${condition.afterSaleFee.amount}`);
					if (pm.environment.get("scenarioType").includes("REFUND") && condition.condition === "REFUND") {
						totalAfterSalesFee += condition.afterSaleFee.amount;
					} else if (pm.environment.get("scenarioType").includes("EXCHANGE") && condition.condition === "EXCHANGE") {
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
					if (pm.environment.get("scenarioType").includes("REFUND") && condition.condition === "REFUND") {
						totalAfterSalesFee += condition.afterSaleFee.amount;
					} else if (pm.environment.get("scenarioType").includes("EXCHANGE") && condition.condition === "EXCHANGE") {
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
					if (pm.environment.get("scenarioType").includes("REFUND") && condition.condition === "REFUND") {
						totalAfterSalesFee += condition.afterSaleFee.amount;
					} else if (pm.environment.get("scenarioType").includes("EXCHANGE") && condition.condition === "EXCHANGE") {
						totalAfterSalesFee += condition.afterSaleFee.amount;
					}
				}
			});
		}
	});

	validationLogger(`[INFO] Total afterSalesConditions fee from all offer parts: ${totalAfterSalesFee}`);

	// Validate exchange fee if exchange fee and afterSalesConditions exist and consistent
	// Validate exchange fee matches total afterSalesConditions
	if (exchangeFee && typeof exchangeFee.amount === 'number') {
		pm.test(`Exchange fee = ${exchangeFee.amount} matches total afterSalesConditions = ${totalAfterSalesFee} from all offer parts and admissionReservationAncillaryOfferPartsAftersalesConditions from offer = ${admissionReservationAncillaryOfferPartsAftersalesConditions}`, () => {
			validationLogger(`[INFO] Exchange fee = ${exchangeFee.amount} matches total afterSalesConditions = ${totalAfterSalesFee} from all offer parts and admissionReservationAncillaryOfferPartsAftersalesConditions from offer = ${admissionReservationAncillaryOfferPartsAftersalesConditions}`);
			pm.expect(exchangeFee.amount).to.be.at.least(0, "Exchange fee should be non-negative");
			pm.expect(exchangeFee.amount).to.eql(totalAfterSalesFee);
			pm.expect(exchangeFee.amount).to.eql(admissionReservationAncillaryOfferPartsAftersalesConditions);
		});
	}
}

// Function to validate applied overrule code
function validateExchangeAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
	validationLogger(`[INFO] ExpectedOverruleCode: ${expectedOverruleCode}`);
	validationLogger(`[INFO] AppliedOverruleCode: ${appliedOverruleCode}`);

	pm.test(expectedOverruleCode === null ? "AppliedOverruleCode is null as expected" : `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`, () => {
		pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
	});
}