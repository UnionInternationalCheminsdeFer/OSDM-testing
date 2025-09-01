// Function to log exchange details
function logExchangeDetails(exchangeOffer) {
	validationLogger(`[INFO] Checking exchange offer with Id: ${exchangeOffer.offerId}`);
}

// Function to validate fulfillments
function validateFulfillmentsExchange(fulfillments, expectedStatus) {
	let validStatuses = [];
	validStatuses = expectedStatus === "FULFILLED" ? ["EXCHANGED"] : ["CONFIRMED", "FULFILLED"];

	pm.test(`Fulfillments are present and valid with status: ${validStatuses}`, () => {
		pm.expect(fulfillments).to.be.an('array').that.is.not.empty;
		fulfillments.forEach(fulfillment => {
			pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;
			pm.expect(fulfillment).to.have.property('status');
			pm.expect(validStatuses).to.include(fulfillment.status);
			pm.expect(fulfillment).to.have.property('bookingParts').that.is.an('array').and.is.not.empty;
		});
	});
	const fulfillmentsIdRaw = pm.globals.get("fulfillmentsIds");
	if (fulfillmentsIdRaw) {
		const expectedIds = JSON.parse(fulfillmentsIdRaw);
		const actualIds = fulfillments.map(f => f.id);
		actualIds.forEach((id, index) => {
			pm.test(`booking.fulfillments[${index}].id (${id}) should be one of expected fulfillments`, () => {
				pm.expect(id).to.be.oneOf(expectedIds);
			});
		});
	}

    const exchangePartRefs = JSON.parse(pm.globals.get("idsAdmissionAncillariesReservationReference") || "[]");
    const bookingPartIds = fulfillments.flatMap(f => f.bookingParts.map(bp => bp.id));

	pm.test(`Each bookingPart id is included in idsAdmissionAncillariesReservationReference: ${exchangePartRefs}`, () => {
        bookingPartIds.forEach(bpId => {
            pm.expect(exchangePartRefs, `Expected exchangePartRefs to contain bookingPart id: ${bpId}`).to.include.oneOf([bpId]);
        });
    });
}

// Function to validate exchange fee
function validateExchangeFee(exchangeFee) {
	validationLogger(`[INFO] Validating exchange fee: ${exchangeFee.amount}`);
	pm.expect(exchangeFee.amount).to.be.at.least(0, "Exchange fee should be non-negative");

	let expectedFee = pm.globals.get("afterSaleCondition_admission_amount");

    validationLogger(`[INFO] Comparing with expected after sale fee: ${expectedFee}`);

    pm.expect(exchangeFee.amount).to.eql(expectedFee, "Exchange fee should match the after-sale admission amount");
}

// Function to validate exchangeable amount
function validateExchangeAmount(exchangeOffer, overruleCode, bookingConfirmedPrice) {
	validationLogger(`[INFO] BookingConfirmedPrice: ${bookingConfirmedPrice}`);
	validationLogger(`[INFO] ExchangeOffer.exchangePrice.amount: ${exchangeOffer.exchangePrice.amount}`);
	validationLogger(`[INFO] OverruleCode: ${overruleCode}`);

	if (!overruleCode || overruleCode === "CODE_DOES_NOT_EXIST") {
		pm.test("Exchangeable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST", () => {
			pm.expect(exchangeOffer.exchangePrice.amount).to.equal(0);
		});
	} else {
		pm.test(`Exchangeable amount is VALID: exchangeOffer.exchangePrice.amount = ${exchangeOffer.exchangePrice.amount} ⇔ bookingConfirmedPrice - exchangeOffer.exchangePrice.amount`, () => {
			pm.expect(exchangeOffer.exchangePrice.amount).to.equal(bookingConfirmedPrice + exchangeOffer.amountToBePaid.amount - exchangeOffer.exchangeFee.amount);
		});
	}
}

// Function to validate applied overrule code
function validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
	validationLogger(`[INFO] ExpectedOverruleCode: ${expectedOverruleCode}`);
	validationLogger(`[INFO] AppliedOverruleCode: ${appliedOverruleCode}`);

	pm.test(expectedOverruleCode === null ? "AppliedOverruleCode is null as expected" : `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`, () => {
		pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
	});
}

// Function to validate exchange offer
function getExchangeOfferResponse(exchangeOffer, expectedStatus) {
	const currentDate = new Date();
	logExchangeDetails(exchangeOffer);

	//TODO : Check if getting fulfillments ids is correct and compare it to bookedAdmissions/Reservations ids
	// idsAdmissionAncillariesReservationReferenceDummy is dummy variable
	const partRefs = [];
	exchangeOffer.fulfillments.forEach(f => {
		f.bookingParts.forEach(bp => {
			partRefs.push(bp.id);
		});
	});
	pm.globals.set("idsAdmissionAncillariesReservationReferenceDummy", JSON.stringify(partRefs));

	validateFulfillmentsExchange(exchangeOffer.fulfillments, expectedStatus);

	const overruleCode = pm.globals.get("overruleCode");
	validateAppliedOverruleCode(exchangeOffer.appliedOverruleCode, overruleCode);

	//TODO Check the code here
	// if ((expectedStatus === "CONFIRMED") || (expectedStatus === "FULFILLED")) {
	const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
	validateExchangeAmount(exchangeOffer, overruleCode, bookingConfirmedPrice);
	validateExchangeFee(exchangeOffer.exchangeFee);
	// } else if (expectedStatus === "PREBOOKED") {
	// 	//TODO : Check if price comparison must be done here
	// 	pm.globals.set("exchangePriceAmount", exchangeOffer.exchangePrice.amount);
	// 	pm.globals.set("exchangeFee", exchangeOffer.exchangeFee.amount);
	// }
}

// Function to check warnings and problems in the response
function checkWarningsAndProblems(response) {
	try {
		response.warnings
			? validationLogger(`[WARNING] ⚠️ Warning: ${response.warnings}`)
			: validationLogger("[WARNING] ⚠️ No warnings found.");

		if (response.problems?.length > 0) {
			validationLogger(`Problems found (${response.problems.length}):`);
			response.problems.forEach((problem, index) => {
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

// Function to validate exchange offers response
function postPatchExchangeOffersResponse(response, isPatchResponse = false) {
	checkWarningsAndProblems(response);

	const exchangeOffers = response.exchangeOffers;
	
	pm.test("Exchange response contains exchangeOffers", () => {
		pm.expect(exchangeOffers).to.be.an('array').that.is.not.empty;
	});
	
	pm.test("Exchange offer has a valid Offer Id", () => {
		pm.expect(jsonData.exchangeOffers[0].offerId).to.exist;
		pm.globals.set("exchangeOffersOfferId", jsonData.exchangeOffers[0].offerId);
	});

	const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PREBOOKED';
	exchangeOffers.forEach(exchangeOffer => {
		getExchangeOfferResponse(exchangeOffer, expectedStatus);
	});
}

// Function to validate exchange operations response
function postPatchExchangeOperationsResponse(response, isPatchResponse = false) {
	checkWarningsAndProblems(response);

	const exchangeOperation = response.exchangeOperation;
	const exchangeOffers = exchangeOperation.exchangeOffers;

	pm.test("Exchange operation has a valid ID", () => {
		pm.expect(exchangeOperation.id).to.exist;
		pm.globals.set("exchangeOperationId", exchangeOperation.id);
	});

	pm.test("Exchange response contains exchangeOffers", () => {
		pm.expect(exchangeOffers).to.be.an('array').that.is.not.empty;
	});

	const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PREBOOKED';
	exchangeOffers.forEach(exchangeOffer => {
		getExchangeOfferResponse(exchangeOffer, expectedStatus);
	});
}


// Function to validate booking response for exchange
function getBookingFulfillmentExchangeResponse(response, scenarioType) {
    const booking = response.booking;

    if (["preFulfillment", "postFulfillment"].includes(scenarioType)) {
		// Collect all booking part IDs from all fulfillments in all exchangeOffers
		const exchangeOperations = booking.exchangeOperations || [];
		const allExchangeOffers = exchangeOperations.flatMap(op => op.exchangeOffers || []);
		const allFulfillments = allExchangeOffers.flatMap(offer => offer.fulfillments || []);
		const partRefs = allFulfillments.flatMap(f => f.bookingParts.map(bp => bp.id));

		if(scenarioType === "preFulfillment") {
			// Check that the previous fulfillment is CONFIRMED and the new one is ON_HOLD
			pm.test("Fulfillments include a CONFIRMED and an ON_HOLD status", () => {
				const fulfillments = booking.fulfillments || [];
				const hasConfirmed = fulfillments.some(f => f.status === "CONFIRMED");
				const hasOnHold = fulfillments.some(f => f.status === "ON_HOLD");

			pm.expect(hasConfirmed, "At least one fulfillment should be CONFIRMED").to.be.true;
			pm.expect(hasOnHold, "At least one fulfillment should be ON_HOLD").to.be.true;
			});

			// Check that the provisional amount matches the exchangePrice
			pm.test("Provisional price amount matches the expected Exchange price", () => {
				const expectedExchangeAmount = exchangeOperations[0].exchangeOffers[0].exchangePrice.amount;
				const provisionalAmount = booking.provisionalPrice?.amount;
				const provisionalRefundableAmount = booking.provisionalRefundAmount?.amount;
	
				// If exchange price is greater than provisionalPrice, fallback to checking refundable
				if (expectedExchangeAmount > provisionalAmount) {
					pm.expect(provisionalRefundableAmount).to.eql(expectedExchangeAmount, "Expected amount should match refundable amount");
				} else {
					pm.expect(provisionalAmount).to.eql(expectedExchangeAmount, "Expected amount should match provisional price");
				}
			});

			pm.test("Exchange operations are valid", () => {
				pm.expect(booking).to.have.property('exchangeOperations').that.is.an('array').with.length.above(0);
				const exchangeOperation = booking.exchangeOperations[0];

				pm.expect(exchangeOperation).to.have.property('id').that.is.a('string').and.not.empty;

				// Adapted: Loop through exchangeOffers in the operation
				const exchangeOffers = exchangeOperation.exchangeOffers || [];
				pm.globals.set("afterSaleCondition_admission_amount", 0);
				exchangeOffers.forEach(exchangeOffer => {
					pm.expect(exchangeOffer).to.have.property('offerId').that.is.a('string').and.not.empty;
					getExchangeOfferResponse(exchangeOffer, 'PREBOOKED');
				});
			});
		} else if (scenarioType === "postFulfillment") {
			// Check that the previous fulfillment is ON_HOLD and the new one is CONFIRMED
			pm.test("Fulfillments include a ON_HOLD and a CONFIRMED status", () => {
				const fulfillments = booking.fulfillments || [];
				const hasFulfilled = fulfillments.some(f => f.status === "FULFILLED");
				const hasExchanged = fulfillments.some(f => f.status === "EXCHANGED");

				pm.expect(hasFulfilled, "At least one fulfillment should be FULFILLED").to.be.true;
				pm.expect(hasExchanged, "At least one fulfillment should be EXCHANGED").to.be.true;
			});

			// Check that the provisional amount is 0 and confirmed amount matches the expected Exchange price
			pm.test("Provisional price amount matches the expected Exchange price", () => {
				const expectedExchangeAmount = exchangeOperations[0].exchangeOffers[0].exchangePrice.amount;
				const confirmedAmount = booking.confirmedPrice?.amount;

				pm.expect(confirmedAmount).to.eql(expectedExchangeAmount, "Expected amount should match confirmed price");
			});


			pm.test("Exchange operations are valid", () => {
				pm.expect(booking).to.have.property('exchangeOperations').that.is.an('array').with.length.above(0);
				const exchangeOperation = booking.exchangeOperations[0];

				pm.expect(exchangeOperation).to.have.property('id').that.is.a('string').and.not.empty;

				// Adapted: Loop through exchangeOffers in the operation
				const exchangeOffers = exchangeOperation.exchangeOffers || [];
				pm.globals.set("afterSaleCondition_admission_amount", 0);
				exchangeOffers.forEach(exchangeOffer => {
					pm.expect(exchangeOffer).to.have.property('offerId').that.is.a('string').and.not.empty;
					getExchangeOfferResponse(exchangeOffer, 'FULFILLED');
				});
			});
		}


		// Check that exchangeOperations contains at least one operation
		pm.test("Exchange operations are present in booking", () => {
			const exchangeOperations = booking.exchangeOperations || [];
			pm.expect(exchangeOperations.length, "There should be at least one exchange operation").to.be.above(0);
		});

        validationLogger(`[INFO] Reference for admissions, ancillaries and reservations: ${partRefs}`);
        partRefs.forEach(refId => {
			//TODO Check if loop on full offer or not ?
            const admissions = booking.bookedOffers[0].admissions || [];
            const reservations = booking.bookedOffers[0].reservations || [];
			const ancillaries = booking.bookedOffers[0].ancillaries || [];

            const matchedAdmission = admissions.find(admission => admission.id === refId);
            const matchedReservation = reservations.find(reservation => reservation.id === refId);
            const matchedAncillary = ancillaries.find(ancillary => ancillary.id === refId);

            if (matchedAdmission || matchedReservation || matchedAncillary) {
                pm.test(`ExchangeOfferPart '${refId}' found in booking for admissions, reservations or ancillaries`, () => {
                    pm.expect(true).to.be.true;
                });
            } else {
                pm.test(`ExchangeOfferPart '${refId}' NOT found in booking`, () => {
                    pm.expect.fail(`[ERROR] ID '${refId}' not found in admissions or reservations or ancillaries`);
                });
            }
        });

		//TODO Delete ?
        // pm.globals.set("admissionsExchangeAmount", booking.bookedOffers[0].admissions?.refundAmount);
        // if (booking.bookedOffers[0].reservations) {
        //     pm.globals.set("reservationsRefundAmount", booking.bookedOffers[0].reservations.refundAmount);
        // }

        pm.test("Booking is present and Booking ID is valid", () => {
            pm.expect(response).to.have.property('booking');
            pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
        });

    } else if (scenarioType === "deleteExchange") {
        pm.test("Exchange operations are not present, empty array returned", () => {
            pm.expect(booking).to.have.property("exchangeOperations").that.is.an("array");
            pm.expect(booking.exchangeOperations).to.be.empty;
        });
    }
}
