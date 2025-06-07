// Function to log refund details
function logRefundDetails(refundOffer) {
	validationLogger(`[INFO] Checking refund offer with Id: ${refundOffer.id}`);
	validationLogger(`[INFO] validUntil for the RefundOffers: $${refundOffer.validUntil}`);
	validationLogger(`[INFO] Status: ${refundOffer.status}`);
}

// Function to validate fulfillments
function validateFulfillments(fulfillments, expectedStatus) {
	let validStatuses = [];
	validStatuses = expectedStatus === "CONFIRMED" ? ["REFUNDED"] : ["CONFIRMED", "FULFILLED"];

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

    const refundPartRefs = JSON.parse(pm.globals.get("idsAdmissionAncillariesReservationReference") || "[]");
    const bookingPartIds = fulfillments.flatMap(f => f.bookingParts.map(bp => bp.id));

	pm.test(`Each bookingPart id is included in idsAdmissionAncillariesReservationReference: ${refundPartRefs}`, () => {
        bookingPartIds.forEach(bpId => {
            pm.expect(refundPartRefs, `Expected refundPartRefs to contain bookingPart id: ${bpId}`).to.include.oneOf([bpId]);
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

	pm.test(expectedOverruleCode === null ? "AppliedOverruleCode is null as expected" : `AppliedOverruleCode is valid, (expected: appliedOverruleCode = ${appliedOverruleCode}, actual: expectedOverruleCode = ${expectedOverruleCode})`, () => {
		pm.expect(appliedOverruleCode).to.equal(expectedOverruleCode);
	});
}

// Function to validate refund offer
function validateRefundOffer(refundOffer, expectedStatus) {
	const currentDate = new Date();
	const validUntilRefundOffers = new Date(refundOffer.validUntil);
	logRefundDetails(refundOffer);

	pm.test("Valid until is set and still valid for the RefundOffers", () => {
		pm.expect(refundOffer.validUntil).to.exist;
		pm.expect(validUntilRefundOffers.getTime()).to.be.above(currentDate.getTime());
	});

	//TODO : Check if getting fulfillments ids is correct and compare it to bookedAdmissions/Reservations ids
	// idsAdmissionAncillariesReservationReferenceDummy is dummy variable
	const partRefs = [];
	refundOffer.fulfillments.forEach(f => {
		f.bookingParts.forEach(bp => {
			partRefs.push(bp.id);
		});
	});
	pm.globals.set("idsAdmissionAncillariesReservationReferenceDummy", JSON.stringify(partRefs));


	pm.test("Refund offer has a valid ID", () => {
		pm.expect(refundOffer.id).to.exist;
		pm.globals.set("refundId", refundOffer.id);
	});

	pm.test(`Correct status is returned on refund | Expected: ${expectedStatus} | Actual: ${refundOffer.status}`, () => {
		pm.expect(refundOffer.status).to.equal(expectedStatus);
	});
	
	validateFulfillments(refundOffer.fulfillments, expectedStatus);

	const overruleCode = pm.globals.get("refundOverruleCode");
	validateAppliedOverruleCode(refundOffer.appliedOverruleCode, overruleCode);

	if ((expectedStatus === "CONFIRMED") || (expectedStatus === "FULFILLED")) {
		const bookingConfirmedPrice = pm.globals.get("bookingConfirmedPrice");
		validateRefundableAmount(refundOffer, overruleCode, bookingConfirmedPrice);
		validateRefundFee(refundOffer.refundFee);
	} else if (expectedStatus === "PROPOSED") {
		//TODO : Check if price comparison must be done here
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

	pm.test(isPatchResponse ? "Patch refund response contains refundOffer" : "Refund response contains refundOffers", () => {
		pm.expect(refundOffers).to.be.an('array').that.is.not.empty;
	});

	const expectedStatus = isPatchResponse ? 'CONFIRMED' : 'PROPOSED';
	refundOffers.forEach(refundOffer => {
		validateRefundOffer(refundOffer, expectedStatus);
	});
}

// Function to validate booking response for refund
function validateBookingResponseRefund(response, refundType) {
	const booking = response.booking;

	if (["post", "patch"].includes(refundType)) {
		const idsAdmissionAncillariesReservationReference = JSON.parse(pm.globals.get("idsAdmissionAncillariesReservationReferenceDummy"));
		validationLogger(`[INFO] Reference for admissions, ancillaries and reservations: ${idsAdmissionAncillariesReservationReference}`);

		idsAdmissionAncillariesReservationReference.forEach(refId => {
			const admissions = booking.bookedOffers[0].admissions || [];
			const reservations = booking.bookedOffers[0].reservations || [];
		
			const matchedAdmission = admissions.find(admission => admission.id === refId);
			const matchedReservation = reservations.find(reservation => reservation.id === refId);
		
			// TODO : implement for ancillaries ?
			if (matchedAdmission || matchedReservation) {
				pm.test(`RefundOfferPart '${refId}' found in booking`, () => {
					pm.expect(true).to.be.true;
				});
			} else {
				pm.test(`RefundOfferPart '${refId}' NOT found in booking`, () => {
					pm.expect.fail(`[ERROR] ID '${refId}' not found in admissions or reservations`);
				});
			}
		});		

		pm.globals.set("admissionsRefundAmount", booking.bookedOffers[0].admissions?.refundAmount);
		if (booking.bookedOffers[0].reservations) {
			pm.globals.set("reservationsRefundAmount", booking.bookedOffers[0].reservations.refundAmount);
		}

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

			const expectedStatus = refundType === "post" ? 'PROPOSED' : 'CONFIRMED';
			if(expectedStatus === 'CONFIRMED') {
				pm.globals.set("isRefundConfirmed", true);
			}
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
