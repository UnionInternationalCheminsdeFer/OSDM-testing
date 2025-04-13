// Function to log refund details
function logRefundDetails(refundOffer) {
	validationLogger("[INFO] Checking refund offer with Id: " + refundOffer.id);
	validationLogger("[INFO] ValidUntil: " + new Date(pm.variables.get("validUntilRefundOffers")));
	validationLogger("[INFO] Status: " + refundOffer.status);
}

// Function to validate fulfillments
function validateFulfillments(fulfillments, expectedStatus) {
	var fulfillmentStatus = "FULFILLED";
	if (expectedStatus == "CONFIRMED") {
		fulfillmentStatus = "REFUNDED";
	}

	pm.test("Fulfillments are present and valid", function () {
		pm.expect(fulfillments).to.be.an('array').that.is.not.empty;
		fulfillments.forEach(function (fulfillment) {
			pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;
			pm.expect(fulfillment).to.have.property('status').that.equals(fulfillmentStatus);

			const fulfillmentsId = pm.globals.get("fulfillmentsId");
			pm.expect(fulfillment.id).to.eql(fulfillmentsId);
		});
	});
}

// Function to validate refund fee
function validateRefundFee(refundFee) {
	// TODO: Implement validation logic for refund fee
	// Why? if a fee is configured this amount will not be zero. if present it should be a number.
	// pm.test("Refund fee equals to 0", function () {
	//     pm.expect(refundFee).to.have.property('amount').that.equals(0);
	// });
}

// Function to validate refundable amount
function validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice) {
	validationLogger("[INFO] BookingConfirmedPrice : " + bookingConfirmedPrice);
	validationLogger("[INFO] RefundOffer.refundableAmount.amount : " + refundOffer.refundableAmount.amount);
	validationLogger("[INFO] RefundOffer.refundFee.amount : " + refundOffer.refundFee.amount);
	validationLogger("[INFO] OverruleCode : " + overruleCode);

	if (overruleCode == null || overruleCode == "CODE_DOES_NOT_EXIST") {
		pm.test("Refundable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST", function () {
			pm.expect(refundOffer.refundableAmount.amount).to.equal(0);
		});
	} else {
		pm.test("Refundable amount is VALID : refundOffer.refundableAmount.amount = " + refundOffer.refundableAmount.amount + " ⇔ bookingConfirmedPrice - refundOffer.refundFee.amount", function () {
			pm.expect(refundOffer.refundableAmount.amount).to.equal(bookingConfirmedPrice - refundOffer.refundFee.amount);
		});
	}
}

// Function to validate applied overrule code
function validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
	validationLogger("[INFO] ExpectedOverruleCode : " + expectedOverruleCode);
	validationLogger("[INFO] AppliedOverruleCode : " + appliedOverruleCode);
	if (expectedOverruleCode == null) {
		pm.test("AppliedOverruleCode is null as expected", function () {
			pm.expect(appliedOverruleCode).to.be.null;
		});
	} else {
		pm.test("AppliedOverruleCode is valid, compare appliedOverruleCode = " + appliedOverruleCode + " with expectedOverruleCode = " + expectedOverruleCode, function () {
			pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
		});
	}
}

// Function to validate refund offer
function validateRefundOffer(refundOffer, expectedStatus) {
	logRefundDetails(refundOffer);

	// refundOffer is linked to a bookedOfferpart, being admission or reservation
	// for now, default to the first one found in the refundOffer
	pm.globals.set("refundOfferPartReference", refundOffer.fulfillments[0].bookingParts[0].id);

	pm.test("Refund offer has a valid ID", function () {
		pm.expect(refundOffer.id).to.exist;
		pm.globals.set("refundId", refundOffer.id);
	});

	pm.test("Correct status is returned on refund : " + expectedStatus, function () {
		pm.expect(refundOffer.status).to.equal(expectedStatus);
	});

	validateFulfillments(refundOffer.fulfillments, expectedStatus);

	var overruleCode = pm.globals.get("refundOverruleCode");
	validateAppliedOverruleCode(refundOffer.appliedOverruleCode, overruleCode);

	if (expectedStatus == "CONFIRMED") {
		const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
		validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		validateRefundFee(refundOffer.refundFee);
	} else if (expectedStatus == "PROPOSED") {
		pm.globals.set("refundRefundAmount", refundOffer.refundableAmount.amount);
		pm.globals.set("refundFee", refundOffer.refundFee.amount);
	}
}

// Function to check warnings and problems in the response
function checkWarningsAndProblems(response) {
	try {
		// Check and log warnings
		if (response.warnings) {
			validationLogger(`[WARNING] Warning: ${response.warnings}`);
		} else {
			validationLogger("[WARNING] No warnings found.");
		}

		// Check and log problems
		if (response.problems && response.problems.length > 0) {
			validationLogger(`Problems found (${response.problems.length}):`);
			response.problems.forEach((problem, index) => {
				validationLogger(`[WARNING]   Problem ${index + 1}:`);
				validationLogger(`[WARNING]     Code: ${problem.code || 'Not available'}`);
				validationLogger(`[WARNING]     Type: ${problem.type || 'Not available'}`);
				validationLogger(`[WARNING]     Title: ${problem.title || 'Not available'}`);
				validationLogger(`[WARNING]     Status: ${problem.status || 'Not available'}`);
				validationLogger(`[WARNING]     Detail: ${problem.detail || 'Not available'}`);

				if (problem.pointers && problem.pointers.length > 0) {
					problem.pointers.forEach((pointer, pointerIndex) => {
						validationLogger(`[WARNING]     Pointer ${pointerIndex + 1}:`);
						validationLogger(`[WARNING]       Code: ${pointer.code || 'Not available'}`);
						validationLogger(`[WARNING]       Request Pointer: ${pointer.requestPointer || 'Not available'}`);
					});
				} else {
					validationLogger("[WARNING]     No pointers found.");
				}
			});
		} else {
			validationLogger("[WARNING] No problems found.");
		}
	} catch (error) {
		validationLogger(`[WARNING] Error processing the response: ${error.message}`);
	}
}

// Function to validate refund offers response
function validateRefundOffersResponse(response, isPatchResponse = false) {
	checkWarningsAndProblems(response);
	const refundOffers = isPatchResponse ? [response.refundOffer] : response.refundOffers;
	pm.test("Status code is 200", function () {
		pm.response.to.have.status(200);
	});

	pm.test(isPatchResponse ? "Patch refund response contains refundOffer" : "Refund response contains refundOffers", function () {
		pm.expect(refundOffers).to.be.an('array').that.is.not.empty;
	});

	const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PROPOSED';
	refundOffers.forEach(function (refundOffer) {
		if (expectedStatus == "PROPOSED") {
			pm.globals.set("validUntilRefundOffers", refundOffer.validUntil);
			pm.test("ValidUntil is set for refundOffer", function () {
				pm.expect(refundOffer.validUntil).to.exist;
			});
		}
		validateRefundOffer(refundOffer, expectedStatus);
	});
}

// Function to validate booking response for refund
function validateBookingResponseRefund(response, refundType) {
	const booking = response.booking;

	if (refundType == "post" || refundType == "patch" || refundType == "delete") {
		let refundOfferPartReference = pm.globals.get("refundOfferPartReference");

		validationLogger("[INFO] RefundOfferPartReference : " + refundOfferPartReference);

		// Check if referenced part is an admission
		let refundOfferPart;

		if (booking.bookedOffers[0].admissions != null && booking.bookedOffers[0].admissions != undefined) {
			refundOfferPart = booking.bookedOffers[0].admissions.find(admission =>
				admission.id === refundOfferPartReference
			);
		}

		// Check if the referenced part is a reservation
		if ((refundOfferPart == null || refundOfferPart == undefined) &&
			(booking.bookedOffers[0].reservations != null && booking.bookedOffers[0].reservations != undefined)) {
			refundOfferPart = booking.bookedOffers[0].reservations.find(reservation =>
				reservation.id === refundOfferPartReference
			);
		}

		pm.globals.set("admissionsRefundAmount", booking.bookedOffers[0].admissions.refundAmount);
		if (booking.bookedOffers[0].reservations) {
			pm.globals.set("reservationsRefundAmount", booking.bookedOffers[0].reservations.refundAmount);
		}
	}

	pm.test("Booking is present and Booking ID is valid", function () {
		pm.expect(response).to.have.property('booking');
		pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
	});

	if (refundType == "post" || refundType == "patch") {
		pm.test("Refund offers are valid", function () {
			pm.expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
			const refundOffer = booking.refundOffers[0];

			pm.expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;

			if (refundType == "post") {
				var expectedStatus = 'PROPOSED';
			} else if (refundType == "patch") {
				var expectedStatus = 'CONFIRMED';
			}
			validateFulfillments(refundOffer.fulfillments, expectedStatus);
			validateRefundFee(refundOffer.refundFee);

			const overruleCode = pm.globals.get("refundOverruleCode");
			const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
			validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		});
	} else if (refundType == "delete") {
		pm.test("Refund offers are not present, empty array returned", function () {
			pm.expect(booking).to.have.property("refundOffers").that.is.an("array");
			pm.expect(booking.refundOffers).to.be.empty;
		});
	}
}