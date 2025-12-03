// Function to validate refund offers response
postPatchRefundOfferResponse = function (jsonData, expectedRefundOperationStatus, expectedFulfillmentStatus) {
	validationLogger("[INFO] ➤ postPatchRefundOfferResponse");
	checkWarningsAndProblems(jsonData);
	// Stop flow if exchangeOperation invalid
	if (!Array.isArray(jsonData.refundOffers) || jsonData.refundOffers.length === 0) {
		validationLogger("[ERROR] No refundOffers found or 'refundOffers' is not an array.");
		pm.execution.setNextRequest(null);
		return;
	}

	// Check refund offers exist
	pm.test(`'refundOffers' array exists with ${jsonData.refundOffers.length} refund offer(s)`, () => {
		pm.expect(jsonData.refundOffers, "[ERROR] 'refundOffers' is missing or empty").to.be.an("array").that.is.not.empty;
		validationLogger(`[INFO] 'refundOffers' array exists with ${jsonData.refundOffers.length} refund offer(s)`);
	});

	// Validate each refund offer
	jsonData.refundOffers.forEach((refundOffer, index) => {
		validateRefundOfferResponse(refundOffer, index, expectedRefundOperationStatus, expectedFulfillmentStatus);
	});

	// Store first offer ID
	pm.environment.set("refundOffersOfferId", jsonData.refundOffers[0].id);
	validationLogger(`[INFO] Stored refundOffersOfferId: ${jsonData.refundOffers[0].id}`);


	// const refundOffers = isPatchResponse ? [jsonData.refundOffer] : jsonData.refundOffers;
	// pm.test(isPatchResponse ? "Patch refund response contains refundOffer" : "Refund response contains refundOffers", () => {
	// 	pm.expect(refundOffers).to.be.an('array').that.is.not.empty;
	// });

	// const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PROPOSED';
	// refundOffers.forEach(refundOffer => {
	// 	getRefundOfferResponse(refundOffer, expectedStatus);
	// });
}

// Function to validate refund offer
function validateRefundOfferResponse(refundOffer, index, expectedRefundOperationStatus, expectedFulfillmentStatus) {
	validationLogger("[INFO] ➤ validateRefundOfferResponse");
	validationLogger(`[INFO] Validating refund offer at index ${index}`);

	// Validate refund offer ID
	pm.test(`Refund offer at index ${index} has a valid Offer Id ${refundOffer.id}`, () => {
		pm.expect(refundOffer.id).to.exist;
		pm.expect(refundOffer.id).to.be.a('string').and.not.be.empty;
		validationLogger(`[INFO] Refund offer at index ${index} has a valid Offer Id ${refundOffer.id}`);
	});

	// Validate status
	pm.test(`Refund offer[${index}] has valid status, expected: ${expectedRefundOperationStatus}, actual: ${refundOffer.status}`, () => {
		pm.expect(refundOffer.status).to.exist;
		pm.expect(refundOffer.status).to.include(expectedRefundOperationStatus);
		validationLogger(`[INFO] Refund offer[${index}] has valid status, expected: ${expectedRefundOperationStatus}, actual: ${refundOffer.status}`);
	});

	// Validate dates
	const currentDate = new Date();
	const createdOn = new Date(refundOffer.createdOn);
	const validFrom = new Date(refundOffer.validFrom);
	const validUntil = new Date(refundOffer.validUntil);

	// Validate createdOn
	if (!isNaN(createdOn.getTime())) {
		pm.test(`Refund offer[${index}] createdOn is valid and in the past: ${refundOffer.createdOn}`, () => {
			pm.expect(refundOffer.createdOn).to.exist;
			pm.expect(createdOn.getTime()).to.be.at.most(currentDate.getTime());
			validationLogger(`[INFO] Refund offer[${index}] createdOn is valid and in the past: ${refundOffer.createdOn}`);
		});
	} else {
		validationLogger(`[WARNING] Refund offer[${index}] createdOn has invalid date format: ${refundOffer.createdOn}`);
	}

	// Validate validFrom
	if (!isNaN(validFrom.getTime())) {
		pm.test(`Refund offer[${index}] validFrom is valid: ${refundOffer.validFrom}`, () => {
			pm.expect(refundOffer.validFrom).to.exist;
			validationLogger(`[INFO] Refund offer[${index}] validFrom is valid: ${refundOffer.validFrom}`);
		});
	} else {
		validationLogger(`[WARNING] Refund offer[${index}] validFrom has invalid date format: ${refundOffer.validFrom}`);
	}

	// Validate validUntil
	if (!isNaN(validUntil.getTime())) {
		pm.test(`Refund offer[${index}] validUntil is valid and approximately 15 minutes in the future: ${refundOffer.validUntil}`, () => {
			pm.expect(refundOffer.validUntil).to.exist;
			pm.expect(validUntil.getTime()).to.be.above(currentDate.getTime());

			// Check if validUntil is approximately 15 minutes from now (with 2 minute tolerance)
			const expectedValidUntil = new Date(currentDate.getTime() + 15 * 60 * 1000);
			const tolerance = 2 * 60 * 1000; // 2 minutes tolerance
			const difference = Math.abs(validUntil.getTime() - expectedValidUntil.getTime());

			pm.expect(difference).to.be.at.most(tolerance);
			validationLogger(`[INFO] Refund offer[${index}] validUntil is valid and approximately 15 minutes in the future: ${refundOffer.validUntil}`);
		});
	} else {
		validationLogger(`[WARNING] Refund offer[${index}] validUntil has invalid date format: ${refundOffer.validUntil}`);
	}

	// Validate appliedOverruleCode
	const overruleCode = pm.environment.get("overruleCode");
	validateAppliedOverruleCode(refundOffer.appliedOverruleCode, overruleCode);
	
	// Validate refundableAmount structure
	pm.test(`Refund offer[${index}] refundableAmount exists and is valid, amount: ${refundOffer.refundableAmount.amount}, currency: ${refundOffer.refundableAmount.currency}`, () => {
		pm.expect(refundOffer.refundableAmount).to.exist;
		pm.expect(refundOffer.refundableAmount).to.be.an('object');
		pm.expect(refundOffer.refundableAmount.amount).to.be.a('number');
		pm.expect(refundOffer.refundableAmount.currency).to.be.a('string');
		pm.expect(refundOffer.refundableAmount.scale).to.be.a('number');
		validationLogger(`[INFO] Refund offer[${index}] refundableAmount: ${refundOffer.refundableAmount.amount} ${refundOffer.refundableAmount.currency}`);
	});

	// Validate refundFee structure
	pm.test(`Refund offer[${index}] refundFee exists and is valid, amount: ${refundOffer.refundFee.amount}, currency: ${refundOffer.refundFee.currency}`, () => {
		pm.expect(refundOffer.refundFee).to.exist;
		pm.expect(refundOffer.refundFee).to.be.an('object');
		pm.expect(refundOffer.refundFee.amount).to.be.a('number');
		pm.expect(refundOffer.refundFee.currency).to.be.a('string');
		pm.expect(refundOffer.refundFee.scale).to.be.a('number');
		validationLogger(`[INFO] Refund offer[${index}] refundFee: ${refundOffer.refundFee.amount} ${refundOffer.refundFee.currency}`);
	});

	// Validate reimbursementStatus
	pm.test(`Refund offer[${index}] has valid reimbursementStatus: ${refundOffer.reimbursementStatus}`, () => {
		pm.expect(refundOffer.reimbursementStatus).to.exist;
		pm.expect(refundOffer.reimbursementStatus).to.be.oneOf(['IMMEDIATE', 'DELAYED']);
		validationLogger(`[INFO] Refund offer[${index}] has valid reimbursementStatus: ${refundOffer.reimbursementStatus}`);
	});

	// Validate refundOfferBreakDown
	if (Array.isArray(refundOffer.refundOfferBreakDown) && refundOffer.refundOfferBreakDown.length > 0) {
		pm.test(`Refund offer[${index}] has ${refundOffer.refundOfferBreakDown.length} breakdown(s)`, () => {
			pm.expect(refundOffer.refundOfferBreakDown).to.be.an('array').that.is.not.empty;
			validationLogger(`[INFO] Refund offer[${index}] has ${refundOffer.refundOfferBreakDown.length} breakdown(s)`);
		});

		refundOffer.refundOfferBreakDown.forEach((breakdown, bdIndex) => {
			pm.test(`Refund offer[${index}] breakdown[${bdIndex}] is valid, refundFee amount: ${breakdown.refundFee.amount}, refundableAmount amount: ${breakdown.refundableAmount.amount}`, () => {
				// Validate refundFee
				pm.expect(breakdown.refundFee).to.exist;
				pm.expect(breakdown.refundFee.amount).to.be.a('number');
				pm.expect(breakdown.refundFee.currency).to.be.a('string');
				pm.expect(breakdown.refundFee.scale).to.be.a('number');

				// Validate refundableAmount
				pm.expect(breakdown.refundableAmount).to.exist;
				pm.expect(breakdown.refundableAmount.amount).to.be.a('number');
				pm.expect(breakdown.refundableAmount.currency).to.be.a('string');
				pm.expect(breakdown.refundableAmount.scale).to.be.a('number');

				// Validate bookingParts
				pm.expect(breakdown.bookingParts).to.be.an('array').that.is.not.empty;

				// Validate fulfillmentId
				pm.expect(breakdown.fulfillmentId).to.be.a('string').and.not.be.empty;

				validationLogger(`[INFO] Refund offer[${index}] breakdown[${bdIndex}] is valid, refundFee amount: ${breakdown.refundFee.amount}, refundableAmount amount: ${breakdown.refundableAmount.amount} bookingParts=${breakdown.bookingParts.length}, fulfillmentId=${breakdown.fulfillmentId}`);
			});

			// Store bookingParts IDs for later validation
			const partRefs = breakdown.bookingParts.map(bp => bp.id);
			validationLogger(`[INFO] Refund offer[${index}] breakdown[${bdIndex}] bookingParts IDs: ${partRefs.join(', ')}`);
		});
	} else {
		validationLogger(`[INFO] No refundOfferBreakDown found for refund offer[${index}]`);
	}

	// Validate fulfillments
	validateFulfillments(refundOffer.fulfillments, index, expectedFulfillmentStatus);

	// Store refund amounts based on status
	if (expectedFulfillmentStatus === "CONFIRMED" || expectedFulfillmentStatus === "FULFILLED") {
		const confirmedPriceAmount = pm.environment.get("confirmedPriceAmount");
		validateRefundableAmount(refundOffer, overruleCode, confirmedPriceAmount);
		validateRefundFee(refundOffer.refundFee);
	} else if (expectedFulfillmentStatus === "PROPOSED") {
		pm.environment.set("refundRefundAmount", refundOffer.refundableAmount.amount);
		pm.environment.set("refundFee", refundOffer.refundFee.amount);
		validationLogger(`[INFO] Stored refundRefundAmount: ${refundOffer.refundableAmount.amount}, refundFee: ${refundOffer.refundFee.amount}`);
	}
}

// Function to validate refund fee
function validateRefundFee(refundFee) {
    validationLogger(`[INFO] Validating refund fee: ${refundFee.amount} ${refundFee.currency}`);
    
    pm.test(`Refund fee is valid and non-negative`, () => {
        pm.expect(refundFee.amount).to.be.at.least(0);
        validationLogger(`[INFO] Refund fee amount: ${refundFee.amount} (non-negative)`);
    });
}

// Function to validate refundable amount
function validateRefundableAmount(refundOffer, overruleCode, confirmedPriceAmount) {
    validationLogger(`[INFO] confirmedPriceAmount: ${confirmedPriceAmount}`);
    validationLogger(`[INFO] RefundOffer.refundableAmount.amount: ${refundOffer.refundableAmount.amount}`);
    validationLogger(`[INFO] RefundOffer.refundFee.amount: ${refundOffer.refundFee.amount}`);
    validationLogger(`[INFO] OverruleCode: ${overruleCode}`);

    if (!overruleCode || overruleCode === "CODE_DOES_NOT_EXIST") {
        pm.test(`Refundable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST`, () => {
            pm.expect(refundOffer.refundableAmount.amount).to.equal(0);
            validationLogger(`[INFO] Refundable amount is 0 as expected (no valid overrule code)`);
        });
    } else {
        const expectedRefundableAmount = confirmedPriceAmount - refundOffer.refundFee.amount;
        pm.test(`Refundable amount is valid: ${refundOffer.refundableAmount.amount} = ${confirmedPriceAmount} - ${refundOffer.refundFee.amount}`, () => {
            pm.expect(refundOffer.refundableAmount.amount).to.equal(expectedRefundableAmount);
            validationLogger(`[INFO] Refundable amount calculation verified: ${refundOffer.refundableAmount.amount} = ${confirmedPriceAmount} - ${refundOffer.refundFee.amount}`);
        });
    }
}

// Function to validate applied overrule code
function validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
    const testMessage = expectedOverruleCode === null 
        ? `AppliedOverruleCode is null as expected, expected : null, actual : ${appliedOverruleCode}`
        : `AppliedOverruleCode matches, expected : ${expectedOverruleCode}, actual : ${appliedOverruleCode}`;

    pm.test(testMessage, () => {
        pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
        validationLogger(`[INFO] AppliedOverruleCode matches, expected : ${expectedOverruleCode}, actual : ${appliedOverruleCode}`);
    });
}

// Function to validate booking response for refund
function getBookingRefundResponse(response, scenarioType) {

	if (pm.response.code !== 200) {
		pm.execution.setNextRequest(null);
		throw new Error(`Exiting script due to wrong response status`);
	}
	if (!jsonData.booking || jsonData.booking.length === 0) {
		throw new Error("⛔ Exiting script, no booking available in the response");
	}
	pm.test('Successfully received booking', () => pm.expect(pm.response.code).to.eql(200));

	const booking = response.booking;

	if (["postRefund", "patchRefund"].includes(scenarioType)) {
		const idsAdmissionAncillariesReservationReference = JSON.parse(pm.environment.get("idsAdmissionAncillariesReservationReferenceDummy"));
		validationLogger(`[INFO] Reference for admissions, ancillaries and reservations: ${idsAdmissionAncillariesReservationReference}`);

		idsAdmissionAncillariesReservationReference.forEach(refId => {
			const admissions = booking.bookedOffers[0].admissions || [];
			const reservations = booking.bookedOffers[0].reservations || [];
			const ancillaries = booking.bookedOffers[0].ancillaries || [];

			const matchedAdmission = admissions.find(admission => admission.id === refId);
			const matchedReservation = reservations.find(reservation => reservation.id === refId);
			const matchedAncillary = ancillaries.find(ancillary => ancillary.id === refId);

			if (matchedAdmission || matchedReservation || matchedAncillary) {
				pm.test(`RefundOfferPart '${refId}' found in booking`, () => {
					pm.expect(true).to.be.true;
				});
			} else {
				pm.test(`RefundOfferPart '${refId}' NOT found in booking`, () => {
					pm.expect.fail(`[ERROR] ID '${refId}' not found in admissions or reservations or ancillaries`);
				});
			}
		});

		// partRefs.forEach(refId => {
		//     const admissions = booking.bookedOffers[0].admissions || [];
		//     const reservations = booking.bookedOffers[0].reservations || [];

		//     const matchedAdmission = admissions.find(admission => admission.id === refId);
		//     const matchedReservation = reservations.find(reservation => reservation.id === refId);

		//     // TODO : implement for ancillaries ?
		//     if (matchedAdmission || matchedReservation) {
		//         pm.test(`RefundOfferPart '${refId}' found in booking`, () => {
		//             pm.expect(true).to.be.true;
		//         });
		//     } else {
		//         pm.test(`RefundOfferPart '${refId}' NOT found in booking`, () => {
		//             pm.expect.fail(`[ERROR] ID '${refId}' not found in admissions or reservations`);
		//         });
		//     }
		// });

		//TODO Delete ?
		// pm.environment.set("admissionsRefundAmount", booking.bookedOffers[0].admissions?.refundAmount);
		// if (booking.bookedOffers[0].reservations) {
		// 	pm.environment.set("reservationsRefundAmount", booking.bookedOffers[0].reservations.refundAmount);
		// }

		pm.test("Booking is present and Booking ID is valid", () => {
			pm.expect(response).to.have.property('booking');
			pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
		});

		const validUntilRefundOffers = new Date(booking.refundOffers[0].validUntil);
		const currentDate = new Date();

		pm.test("Valid until is set and still valid for the RefundOffers", () => {
			pm.expect(validUntilRefundOffers).to.exist;
			pm.expect(validUntilRefundOffers.getTime()).to.be.above(currentDate.getTime());
		});

		pm.test("Refund offers are valid", () => {
			pm.expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
			const refundOffer = booking.refundOffers[0];

			pm.expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;

			const expectedStatus = scenarioType === "postRefund" ? 'PROPOSED' : 'CONFIRMED';
			if (expectedStatus === 'CONFIRMED') {
				pm.environment.set("isRefundConfirmed", true);
			}
			validateFulfillments(refundOffer.fulfillments, expectedStatus);
			validateRefundFee(refundOffer.refundFee);

			const overruleCode = pm.environment.get("overruleCode");
			const confirmedPriceAmount = pm.environment.get("confirmedPriceAmount");
			validateRefundableAmount(refundOffer, overruleCode, confirmedPriceAmount);
		});
	} else if (scenarioType === "deleteRefund") {
		pm.test("Refund offers are not present, empty array returned", () => {
			pm.expect(booking).to.have.property("refundOffers").that.is.an("array");
			pm.expect(booking.refundOffers).to.be.empty;
		});
	}
}