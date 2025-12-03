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
		pm.expect(jsonData.exchangeOffers, "[ERROR] 'exchangeOffers' is missing or empty").to.be.an("array").that.is.not.empty;
		validationLogger(`[INFO] 'exchangeOffers' array exists with ${jsonData.exchangeOffers.length} exchange offer(s)`);
	});

	// Validate each exchange offer
	jsonData.exchangeOffers.forEach((exchangeOffer, index) => {
		validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus);
	});

	// Store first offer ID
	pm.environment.set("exchangeOffersOfferId", jsonData.exchangeOffers[0].offerId);
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
		pm.expect(jsonData).to.have.property('exchangeOperation');
		pm.expect(jsonData.exchangeOperation).to.not.be.null;
		validationLogger("[INFO] Exchange operation found in response");
	});

	// Validate exchangeOperation ID
	pm.test(`Exchange operation has a valid ID`, () => {
		pm.expect(jsonData.exchangeOperation.id).to.exist;
		pm.expect(jsonData.exchangeOperation.id).to.be.a('string').and.not.empty;
		//pm.environment.set("exchangeOperationId", jsonData.exchangeOperation.id);
		validationLogger(`[INFO] Exchange operation ID: ${jsonData.exchangeOperation.id}`);
	});

	// Validate exchangeOperation status
	pm.test(`Exchange operation has valid status, expected : ${expectedExchangeOperationStatus}, actual : ${jsonData.exchangeOperation.status}`, () => {
		pm.expect(expectedExchangeOperationStatus).to.include(jsonData.exchangeOperation.status);
		validationLogger(`[INFO] Exchange operation has valid status, expected : ${expectedExchangeOperationStatus}, actual : ${jsonData.exchangeOperation.status}`);
	});

	// Validate exchangeOffers
	pm.test(`Exchange operation contains exchangeOffers`, () => {
		pm.expect(jsonData.exchangeOperation).to.have.property('exchangeOffers');
		pm.expect(jsonData.exchangeOperation.exchangeOffers).to.be.an('array').that.is.not.empty;
		validationLogger(`[INFO] 🔍 ${jsonData.exchangeOperation.exchangeOffers.length} exchange offer(s) in operation`);
	});

	jsonData.exchangeOperation.exchangeOffers.forEach((exchangeOffer, index) => {
		validateExchangeOfferResponse(exchangeOffer, index, expectedFulfillmentStatus);
	});

	// Store first offer ID
	pm.environment.set("exchangeOffersOfferId", jsonData.exchangeOperation.exchangeOffers[0].offerId);
	validationLogger(`[INFO] Stored exchangeOffersOfferId: ${jsonData.exchangeOperation.exchangeOffers[0].offerId}`);
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
		pm.expect(exchangeOffer).to.have.property('offerSummary');
		pm.expect(exchangeOffer).to.have.property('exchangeFee');
		pm.expect(exchangeOffer).to.have.property('exchangePrice');
		pm.expect(exchangeOffer).to.have.property('amountToBePaid');
		validationLogger(`[INFO] Exchange offer[${index}] has required properties offerSummary, exchangeFee, exchangePrice and amountToBePaid`);
	});

	// Validate offer summary
	if (exchangeOffer.offerSummary) {
		pm.test(`Exchange offer [${index}] minimal price: ${exchangeOffer.offerSummary.minimalPrice.amount}`, () => {
			pm.expect(exchangeOffer.offerSummary).to.have.property('minimalPrice');
			pm.expect(exchangeOffer.offerSummary.minimalPrice.amount).to.be.a('number');
			validationLogger(`[INFO] Exchange offer [${index}] minimal price: ${exchangeOffer.offerSummary.minimalPrice.amount}`);
		});
	} else {
		validationLogger(`[WARN] Exchange offer[${index}] offerSummary is missing`);
	}

	// Validate amountToBePaid if present
	if (exchangeOffer.amountToBePaid) {
		pm.test(`Exchange offer[${index}] amount to be paid: ${exchangeOffer.amountToBePaid.amount}`, () => {
			pm.expect(exchangeOffer.amountToBePaid.amount).to.be.a('number');
			validationLogger(`[INFO] Offer[${index}] amount to be paid: ${exchangeOffer.amountToBePaid.amount}`);
		});
		// Compare amountToBePaid with = exchangePrice + exchangeFee - confirmedPriceAmount
		const confirmedPriceAmount = pm.environment.get("confirmedPriceAmount");
		const expectedAmountToBePaid = exchangeOffer.exchangePrice.amount + exchangeOffer.exchangeFee.amount - confirmedPriceAmount;
		pm.test(`Exchange offer[${index}] amountToBePaid is correctly calculated: expected : ${expectedAmountToBePaid}, actual : ${exchangeOffer.amountToBePaid.amount} (exchangePrice.amount + exchangeFee.amount - confirmedPriceAmount)`, () => {
			pm.expect(exchangeOffer.amountToBePaid.amount).to.eql(expectedAmountToBePaid, `amountToBePaid should be correctly calculated as exchangePrice + exchangeFee - confirmedPrice (${confirmedPriceAmount})`);
			validationLogger(`[INFO] confirmedPriceAmount ${confirmedPriceAmount}`);
			validationLogger(`[INFO] exchangePrice.amount ${exchangeOffer.exchangePrice.amount}`);
			validationLogger(`[INFO] exchangeFee.amount ${exchangeOffer.exchangeFee.amount}`);
			validationLogger(`[INFO] Total expectedAmountToBePaid ${expectedAmountToBePaid}`);
			validationLogger(`[INFO] Exchange offer[${index}] amountToBePaid is correctly calculated: expected ${expectedAmountToBePaid}, actual ${exchangeOffer.amountToBePaid.amount} (exchangePrice.amount + exchangeFee.amount - confirmedPriceAmount)`);
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
		validateAppliedOverruleCode(exchangeOffer.appliedOverruleCode, expectedOverruleCode);

		// Validate exchange price and fees
		validateExchangePriceAndFees(exchangeOffer, index, expectedOverruleCode);
	}

	// Validate refundableAmount if present
	if (exchangeOffer.refundableAmount !== undefined) {
		pm.test(`Exchange offer[${index}] has refundable amount defined`, () => {
			if (exchangeOffer.refundableAmount !== null) {
				pm.expect(exchangeOffer.refundableAmount.amount).to.be.a('number');
				validationLogger(`[INFO] Offer[${index}] refundable amount: ${exchangeOffer.refundableAmount.amount}`);
			} else {
				validationLogger(`[INFO] Offer[${index}] refundable amount is null`);
			}
		});
	} else {
		validationLogger(`[INFO] Exchange offer[${index}] refundable amount is not defined`);
	}

	// Validate fulfillments
	if (exchangeOffer.fulfillments && expectedFulfillmentStatus) {
		validateFulfillments(exchangeOffer.fulfillments, index, expectedFulfillmentStatus);
	}

}

// Function to validate exchangeable amount
function validateExchangePriceAndFees(exchangeOffer, index, overruleCode) {
	const exchangePriceAmount = exchangeOffer.exchangePrice.amount;
	const overallPrice = pm.environment.get("overallPrice");
	const exchangeFeeAmount = exchangeOffer.exchangeFee.amount;
	const expectedExchangeableAmount = overallPrice + exchangeFeeAmount;

	validationLogger(`[INFO] ExchangeOffer.exchangePrice.amount at index ${index}: ${exchangePriceAmount}`);
	validationLogger(`[INFO] Overall price: ${overallPrice}`);
	validationLogger(`[INFO] Exchange fee: ${exchangeFeeAmount}`);
	validationLogger(`[INFO] Expected exchangeable amount: ${expectedExchangeableAmount} = overallPrice (${overallPrice}) + exchangeFee (${exchangeFeeAmount})`);

	// Validate exchangeable amount based on overruleCode
	// if (!overruleCode || overruleCode === "CODE_DOES_NOT_EXIST") {
	// 	pm.test("Exchangeable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST", () => {
	// 		pm.expect(exchangeOffer.exchangePrice.amount).to.equal(0);
	// 		validationLogger(`[INFO] Exchangeable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST, actual: ${exchangeOffer.exchangePrice.amount}`);
	// 	});
	// } else {
	pm.test(`Exchangeable amount matches overallPrice when overruleCode ${overruleCode} is applied, expected: ${expectedExchangeableAmount}, actual: ${exchangeOffer.exchangePrice.amount}`, () => {
		pm.expect(exchangeOffer.exchangePrice.amount).to.eql(expectedExchangeableAmount, `Exchangeable amount should match overallPrice when overruleCode ${overruleCode} is applied`);
		validationLogger(`[INFO] Exchangeable amount matches overallPrice when overruleCode ${overruleCode} is applied, expected: ${expectedExchangeableAmount}, actual: ${exchangeOffer.exchangePrice.amount}`);
	});
	// }

	// Calculate total afterSalesConditions from all offer parts
	const admissionOfferParts = exchangeOffer.admissionOfferParts || [];
	const reservationOfferParts = exchangeOffer.reservationOfferParts || [];
	const ancillaryOfferParts = exchangeOffer.ancillaryOfferParts || [];

	let totalAfterSalesFee = 0;

	// Sum afterSalesConditions from admissionOfferParts
	admissionOfferParts.forEach((admission, admIndex) => {
		if (admission.afterSalesConditions && Array.isArray(admission.afterSalesConditions)) {
			admission.afterSalesConditions.forEach((condition, condIndex) => {
				if (condition.admissionAmount !== undefined) {
					validationLogger(`[INFO] AdmissionOfferPart[${admIndex}].afterSalesConditions[${condIndex}].admissionAmount: ${condition.admissionAmount}`);
					totalAfterSalesFee += condition.admissionAmount;
				}
			});
		}
	});

	// Sum afterSalesConditions from reservationOfferParts
	reservationOfferParts.forEach((reservation, resIndex) => {
		if (reservation.afterSalesConditions && Array.isArray(reservation.afterSalesConditions)) {
			reservation.afterSalesConditions.forEach((condition, condIndex) => {
				if (condition.reservationAmount !== undefined) {
					validationLogger(`[INFO] ReservationOfferPart[${resIndex}].afterSalesConditions[${condIndex}].reservationAmount: ${condition.reservationAmount}`);
					totalAfterSalesFee += condition.reservationAmount;
				}
			});
		}
	});

	// Sum afterSalesConditions from ancillaryOfferParts
	ancillaryOfferParts.forEach((ancillary, ancIndex) => {
		if (ancillary.afterSalesConditions && Array.isArray(ancillary.afterSalesConditions)) {
			ancillary.afterSalesConditions.forEach((condition, condIndex) => {
				if (condition.ancillaryAmount !== undefined) {
					validationLogger(`[INFO] AncillaryOfferPart[${ancIndex}].afterSalesConditions[${condIndex}].ancillaryAmount: ${condition.ancillaryAmount}`);
					totalAfterSalesFee += condition.ancillaryAmount;
				}
			});
		}
	});

	validationLogger(`[INFO] Total afterSalesConditions fee from all offer parts: ${totalAfterSalesFee}`);

	// Validate exchange fee if exchange fee and afterSalesConditions exist and consistent
	// Validate exchange fee matches total afterSalesConditions
	if (exchangeOffer.exchangeFee && exchangeOffer.afterSalesConditions) {
		pm.test(`Exchange fee (${exchangeFeeAmount}) matches total afterSalesConditions (${totalAfterSalesFee}) from all offer parts`, () => {
			pm.expect(exchangeFeeAmount).to.be.at.least(0, "Exchange fee should be non-negative");
			pm.expect(exchangeFeeAmount).to.eql(totalAfterSalesFee, "Exchange fee should match total afterSalesConditions from admissions, reservations, and ancillaries");
			validationLogger(`[INFO] Exchange fee (${exchangeFeeAmount}) matches total afterSalesConditions (${totalAfterSalesFee}) from all offer parts`);
		});


	}
}

// Function to validate exchange fee
function validateExchangeFee(exchangeFee, index) {
	let expectedFee = pm.environment.get("afterSaleCondition_admission_amount");

	validationLogger(`[INFO] Comparing with expected after sale fee: ${expectedFee}`);
	pm.test(`Exchange fee matches the after-sale admission amount: ${expectedFee}`, () => {
		pm.expect(exchangeFee.amount).to.eql(expectedFee, "Exchange fee should match the after-sale admission amount");
	});
}


// Function to validate applied overrule code
function validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
	validationLogger(`[INFO] ExpectedOverruleCode: ${expectedOverruleCode}`);
	validationLogger(`[INFO] AppliedOverruleCode: ${appliedOverruleCode}`);

	pm.test(expectedOverruleCode === null ? "AppliedOverruleCode is null as expected" : `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`, () => {
		pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
	});
}