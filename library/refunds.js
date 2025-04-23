// Function to log refund details
function logRefundDetails(refundOffer) {
	validationLogger(`[INFO] Checking refund offer with Id: ${refundOffer.id}`);
	validationLogger(`[INFO] ValidUntil: ${new Date(pm.variables.get("validUntilRefundOffers"))}`);
	validationLogger(`[INFO] Status: ${refundOffer.status}`);
}

// Function to validate fulfillments
function validateFulfillments(fulfillments, expectedStatus) {
	let validStatuses = [];
	var sandbox = pm.environment.get("api_base");
	if (sandbox.includes("paxone")) {
		validStatuses = expectedStatus === "CONFIRMED" ? ["REFUNDED"] : ["CONFIRMED", "FULFILLED"];
	} else {
		validStatuses = expectedStatus === "CONFIRMED" ? ["REFUNDED"] : ["FULFILLED"];
	}

	pm.test(`Fulfillments are present and valid with status: ${validStatuses}`, () => {
		pm.expect(fulfillments).to.be.an('array').that.is.not.empty;
		fulfillments.forEach(fulfillment => {
			pm.expect(fulfillment.id).to.be.a('string').and.not.be.empty;
			pm.expect(fulfillment).to.have.property('status');
			pm.expect(validStatuses).to.include(fulfillment.status);

			const fulfillmentsId = pm.globals.get("fulfillmentsId");
			pm.expect(fulfillment.id).to.eql(fulfillmentsId);
		});
	});
}

// Function to validate refund fee
function validateRefundFee(refundFee) {
	validationLogger(`[INFO] Validating refund fee: ${refundFee.amount}`);
	pm.expect(refundFee.amount).to.be.at.least(0, "Refund fee should be non-negative");
}

// Function to validate refundable amount
function validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice) {
	validationLogger(`[INFO] BookingConfirmedPrice: ${bookingConfirmedPrice}`);
	validationLogger(`[INFO] RefundOffer.refundableAmount.amount: ${refundOffer.refundableAmount.amount}`);
	validationLogger(`[INFO] RefundOffer.refundFee.amount: ${refundOffer.refundFee.amount}`);
	validationLogger(`[INFO] OverruleCode: ${overruleCode}`);

	if (!overruleCode || overruleCode === "CODE_DOES_NOT_EXIST") {
		pm.test("Refundable amount is 0 because overruleCode is null or CODE_DOES_NOT_EXIST", () => {
			pm.expect(refundOffer.refundableAmount.amount).to.equal(0);
		});
	} else {
		pm.test(`Refundable amount is VALID: refundOffer.refundableAmount.amount = ${refundOffer.refundableAmount.amount} ⇔ bookingConfirmedPrice - refundOffer.refundFee.amount`, () => {
			pm.expect(refundOffer.refundableAmount.amount).to.equal(bookingConfirmedPrice - refundOffer.refundFee.amount);
		});
	}
}

// Function to validate applied overrule code
function validateAppliedOverruleCode(appliedOverruleCode, expectedOverruleCode) {
	validationLogger(`[INFO] ExpectedOverruleCode: ${expectedOverruleCode}`);
	validationLogger(`[INFO] AppliedOverruleCode: ${appliedOverruleCode}`);

	pm.test(expectedOverruleCode === null ? "AppliedOverruleCode is null as expected" : `AppliedOverruleCode is valid, compare appliedOverruleCode = ${appliedOverruleCode} with expectedOverruleCode = ${expectedOverruleCode}`, () => {
		pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
	});
}

// Function to validate refund offer
function validateRefundOffer(refundOffer, expectedStatus) {
	logRefundDetails(refundOffer);

	pm.test("Refund offer is still valid checking ValidUntil", () => {
		const validUntil = new Date(refundOffer.validUntil);
		const now = new Date();
		pm.expect(validUntil.getTime()).to.be.above(now.getTime());
	});

	pm.globals.set("refundOfferPartReference", refundOffer.fulfillments[0].bookingParts[0].id);

	pm.test("Refund offer has a valid ID", () => {
		pm.expect(refundOffer.id).to.exist;
		pm.globals.set("refundId", refundOffer.id);
	});

	pm.test(`Correct status is returned on refund: ${expectedStatus}`, () => {
		pm.expect(refundOffer.status).to.equal(expectedStatus);
	});

	validateFulfillments(refundOffer.fulfillments, expectedStatus);

	const overruleCode = pm.globals.get("refundOverruleCode");
	validateAppliedOverruleCode(refundOffer.appliedOverruleCode, overruleCode);

	if (expectedStatus === "CONFIRMED") {
		const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
		validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		validateRefundFee(refundOffer.refundFee);
	} else if (expectedStatus === "PROPOSED") {
		pm.globals.set("refundRefundAmount", refundOffer.refundableAmount.amount);
		pm.globals.set("refundFee", refundOffer.refundFee.amount);
	}
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

// Function to validate refund offers response
function validateRefundOffersResponse(response, isPatchResponse = false) {
	checkWarningsAndProblems(response);

	const refundOffers = isPatchResponse ? [response.refundOffer] : response.refundOffers;
	pm.test("Status code is 200", () => pm.response.to.have.status(200));

	pm.test(isPatchResponse ? "Patch refund response contains refundOffer" : "Refund response contains refundOffers", () => {
		pm.expect(refundOffers).to.be.an('array').that.is.not.empty;
	});

	const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PROPOSED';
	refundOffers.forEach(refundOffer => {
		if (expectedStatus === "PROPOSED") {
			pm.globals.set("validUntilRefundOffers", refundOffer.validUntil);
			pm.test("ValidUntil is set for refundOffer", () => {
				pm.expect(refundOffer.validUntil).to.exist;
			});
		}
		validateRefundOffer(refundOffer, expectedStatus);
	});
}

// Function to validate booking response for refund
function validateBookingResponseRefund(response, refundType) {
	const booking = response.booking;

	pm.test("Refund offer is still valid checking ValidUntil", () => {
		const validUntil = new Date(booking.refundOffers[0].validUntil);
		const now = new Date();
		pm.expect(validUntil.getTime()).to.be.above(now.getTime());
	});

	if (["post", "patch", "delete"].includes(refundType)) {
		const refundOfferPartReference = pm.globals.get("refundOfferPartReference");
		validationLogger(`[INFO] RefundOfferPartReference: ${refundOfferPartReference}`);

		/*
		let refundOfferPart = booking.bookedOffers[0].admissions?.find(admission => admission.id === refundOfferPartReference)
			|| booking.bookedOffers[0].reservations?.find(reservation => reservation.id === refundOfferPartReference);
		*/

		let refundOfferPart;

		// Check if referenced part is an admission
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
		// Code finish here

		pm.globals.set("admissionsRefundAmount", booking.bookedOffers[0].admissions?.refundAmount);
		if (booking.bookedOffers[0].reservations) {
			pm.globals.set("reservationsRefundAmount", booking.bookedOffers[0].reservations.refundAmount);
		}
	}

	pm.test("Booking is present and Booking ID is valid", () => {
		pm.expect(response).to.have.property('booking');
		pm.expect(booking).to.have.property('id').that.is.a('string').and.not.empty;
	});

	if (["post", "patch"].includes(refundType)) {
		pm.test("Refund offers are valid", () => {
			pm.expect(booking).to.have.property('refundOffers').that.is.an('array').with.length.above(0);
			const refundOffer = booking.refundOffers[0];

			pm.expect(refundOffer).to.have.property('id').that.is.a('string').and.not.empty;

			const expectedStatus = refundType === "post" ? 'PROPOSED' : 'CONFIRMED';
			validateFulfillments(refundOffer.fulfillments, expectedStatus);
			validateRefundFee(refundOffer.refundFee);

			const overruleCode = pm.globals.get("refundOverruleCode");
			const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
			validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		});
	} else if (refundType === "delete") {
		pm.test("Refund offers are not present, empty array returned", () => {
			pm.expect(booking).to.have.property("refundOffers").that.is.an("array");
			pm.expect(booking.refundOffers).to.be.empty;
		});
	}
}
