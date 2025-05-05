let totalProvisionalOrBookingPrice = 0;

validateBookingResponse = function (offers, offerId, booking, state) {
	const bookingId = booking.id;
	const createdOn = booking.createdOn;
	const bookedOffers = booking.bookedOffers;
	const passengerIdList = [];

	pm.globals.set("bookingId", bookingId);

	if (jsonData.booking?.passengers?.length > 0) {
		jsonData.booking.passengers.forEach((passenger, i) => {
			if (passenger.id) {
				pm.globals.set(`passengerId_${i}`, passenger.id);
				passengerIdList.push(passenger.id);
			} else {
				validationLogger(`[WARNING] ⚠️ Passenger at index ${i} has no ID.`);
			}
		});
	} else {
		validationLogger("[ERROR] Passengers structure is invalid or empty.");
	}
	pm.globals.set("passengerIdList", passengerIdList);

	validationLogger(`[INFO] Booking Id: ${bookingId}`);
	validationLogger(`[INFO] Offer Id: ${offerId}`);

	pm.test("Booking Id is returned", () => {
		pm.expect(bookingId).to.be.a('string').and.not.be.empty;
	});

	validationLogger(`[INFO] CreatedOn specific date format is valid: ${createdOn}`);
	pm.test(`CreatedOn in booking is returned : ${createdOn}`, () => {
		pm.expect(createdOn).to.not.be.empty;
		pm.expect(createdOn).to.be.a('string');
		const createdOnParsed = new Date(createdOn);
		const formatted = createdOnParsed.toISOString();
		const expected = createdOn.substring(0, 19);
		const actual = formatted.substring(0, 19);
		pm.expect(actual, `Expected: ${expected}, Actual: ${actual}`).to.equal(expected);
	});
	

	const offer = offers.find(internalOffer => internalOffer.offerId === offerId);

	if (!offer) {
		validationLogger("[INFO] No correct offer can be found, skipping rest of validation");
		return;
	} else {
		validationLogger("[INFO] Correct offer from offer response found, performing rest of validation");
	}

	const found = bookedOffers.some(bookedOffer => compareOffers(bookedOffer, offer, booking, state));

	pm.test(`Correct offer ${offer.offerId} is returned`, () => {
		pm.expect(found).to.equal(true);
	});

	offer.passengerRefs.forEach(passenger => {
		const found = booking.passengers.some(bookedPassenger => {
			return bookedPassenger.externalRef === passenger;
		});

		pm.test(`Passenger ${passenger} returned`, () => {
			pm.expect(found).to.equal(true);
		});
	});
};

compareOffers = function (bookedOffer, offer, booking, state) {
	pm.test(`Booked offerId: ${bookedOffer.offerId} matches offerId: ${offer.offerId}`, function () {
		pm.expect(bookedOffer.offerId).to.eql(offer.offerId);
	});	

	if (!bookedOffer.admissions?.length && !offer.admissionOfferParts?.length) {
		validationLogger("[INFO] Skipping admissions");
	} else {
		validationLogger("[INFO] Checking admissions");
		bookedOffer.admissions.forEach(bookedAdmission => {
			checkGenericBookedOfferPart(bookedAdmission, state, "admissions");
			offer.admissionOfferParts.some(offeredAdmission => compareAdmissions(bookedAdmission, offeredAdmission, booking));

		});
		pm.test("All booking admissions are matched in offer response admissions", function () {
			const unmatched = [];
			bookedOffer.admissions.forEach(bookedAdmission => {
				const match = offer.admissionOfferParts.find(offeredAdmission => 
					offeredAdmission.id === bookedAdmission.id
				);
				if (!match) {
					unmatched.push(bookedAdmission.id);
				}
			});
			pm.expect(unmatched, `Unmatched admission IDs: ${unmatched.join(", ")}`).to.be.empty;
		});
	}

	if (!bookedOffer.ancillaries?.length && !offer.ancillaryOfferParts?.length) {
		validationLogger("[INFO] Skipping ancillaries");
	} else {
		validationLogger("[INFO] Checking ancillaries");
		bookedOffer.ancillaries.forEach(bookedAncillary => {
			checkGenericBookedOfferPart(bookedAncillary, state, "ancillaries");
			offer.ancillaryOfferParts.some(offeredancillary => compareancillaries(bookedAncillary, offeredancillary, booking));
		});
		pm.test("All booking ancillaries are matched in offer response ancillaries", function () {
			const unmatched = [];
			bookedOffer.ancillaries.forEach(bookedAncillary => {
				const match = offer.ancillaryOfferParts.find(offeredancillary => 
					offeredancillary.id === bookedAncillary.id
				);
				if (!match) {
					unmatched.push(bookedAncillary.id);
				}
			});
			pm.expect(unmatched, `Unmatched ancillary IDs: ${unmatched.join(", ")}`).to.be.empty;
		});
	}

	if (!bookedOffer.reservations?.length && !offer.reservationOfferParts?.length) {
		validationLogger("[INFO] Skipping reservations");
	} else {
		validationLogger("[INFO] Checking reservations");
		bookedOffer.reservations.forEach(bookedReservation => {
			checkGenericBookedOfferPart(bookedReservation, state, "reservations");
			offer.reservationOfferParts.some(offeredReservation => compareReservations(bookedReservation, offeredReservation, booking));
		});
		pm.test("All booking reservations are matched in offer response reservations", function () {
			const unmatched = [];
			bookedOffer.reservations.forEach(bookedReservation => {
				const match = offer.reservationOfferParts.find(offeredReservation => 
					offeredReservation.id === bookedReservation.id
				);
				if (!match) {
					unmatched.push(bookedReservation.id);
				}
			});
			pm.expect(unmatched, `Unmatched reservation IDs: ${unmatched.join(", ")}`).to.be.empty;
		});
	}

	return true;
};

compareAdmissions = function (bookedAdmission, offeredAdmission, booking) {
	pm.test("Price of the admission should be set and similar to offer response", () => {
		pm.expect(bookedAdmission.price.amount).to.equal(offeredAdmission.price.amount);
		pm.expect(bookedAdmission.price.currency).to.equal(offeredAdmission.price.currency);
		pm.expect(bookedAdmission.price.scale).to.equal(offeredAdmission.price.scale);
	});

	pm.test("Products of the admission should be set and similar to offer response", function () {
		for (var i = 0; i < bookedAdmission.products.length; i++) {
			var bookedProduct = bookedAdmission.products[i];
			var found = false;
			for (var j = 0; j < offeredAdmission.products.length; j++) {
				var offeredProduct = offeredAdmission.products[j];
				if (bookedProduct.productId == offeredProduct.productId) {
					found = true;
					break;
				}
			}
			pm.expect(found).to.equal(true);
		}
	});

	//TODO : On Bileto offerMode is COLLECTIVE when it is set to INDIVIDUAL in data file
	["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedAdmission[prop] !== undefined) {
			pm.test(`In admissions : ${prop} value should be set and similar to offer response`, () => {
				pm.expect(bookedAdmission[prop]).to.equal(offeredAdmission[prop]);
			});
		}
	});

	pm.test("Correct passengers are part of the admission", () => {
		bookedAdmission.passengerIds.forEach(passengerId => {
			const found = booking.passengers.some(bookedPassenger => passengerId === bookedPassenger.id);
			pm.expect(found).to.equal(true);
		});
	});

	return true;
};

compareAncillaries = function (bookedAncillary, offeredAncillary, booking) {
	//TODO : Implement additional checks for ancillary properties
}

compareReservations = function (bookedReservation, offeredReservation, booking) {
	pm.test("Price of the reservation should be set and similar to offer response", () => {
		pm.expect(bookedReservation.price.amount).to.equal(offeredReservation.price.amount);
		pm.expect(bookedReservation.price.currency).to.equal(offeredReservation.price.currency);
		pm.expect(bookedReservation.price.scale).to.equal(offeredReservation.price.scale);
	});

	pm.test("Products of the reservation should be set and similar to offer response", function () {
		for (var i = 0; i < bookedReservation.products.length; i++) {
			var bookedProduct = bookedReservation.products[i];
			var found = false;
			for (var j = 0; j < offeredReservation.products.length; j++) {
				var offeredProduct = offeredReservation.products[j];
				if (bookedProduct.productId == offeredProduct.productId) {
					found = true;
					break;
				}
			}
			pm.expect(found).to.equal(true);
		}
	});

	["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedReservation[prop] !== undefined) {
			pm.test(`In reservations : ${prop} value should be set and similar to offer response`, () => {
				pm.expect(bookedReservation[prop]).to.equal(offeredReservation[prop]);
			});
		}
	});

	pm.test("Correct passengers are part of the reservation", () => {
		bookedReservation.passengerIds.forEach(passengerId => {
			const found = booking.passengers.some(bookedPassenger => passengerId === bookedPassenger.id);
			pm.expect(found).to.equal(true);
		});
	});

	return true;
};

checkGenericBookedOfferPart = function (offerPart, state, textDescription) {
	const currentDate = new Date();
	const createdOn = new Date(offerPart.createdOn);
	const validUntil = new Date(offerPart.validUntil)
	const confirmableUntil = new Date(offerPart.confirmableUntil);

	//TODO : review createdOn date format and check consistency with other date formats in the response
	pm.test(`CreatedOn is returned on bookedofferpart ${textDescription}`, () => {
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});
	pm.test(`ValidUntil is set for bookedofferpart ${textDescription}`, () => {
		pm.expect(validUntil.getTime()).to.be.above(currentDate.getTime());
	});

	totalProvisionalOrBookingPrice += calculateTotalAmount(offerPart);

	if (state === "PREBOOKED") {
		pm.test(`ConfirmableUntil is returned on bookedofferpart ${textDescription}`, () => {
			pm.expect(confirmableUntil.getTime()).to.be.above(currentDate.getTime());
		});
		pm.test(`Correct status is returned on bookedofferpart ${textDescription} : ${offerPart.status}`, () => {
			pm.expect(["PREBOOKED"]).to.include(offerPart.status);
		});
	} else {
		pm.test(`Correct status is returned on bookedofferpart ${textDescription} : ${offerPart.status}`, () => {
			pm.expect(["FULFILLED", "CONFIRMED"]).to.include(offerPart.status);
		});
	}
};

function calculateTotalAmount(offerPart) {
	const objectTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillaries'];
	const getPriceAmount = obj => (objectTypes.includes(obj.objectType) && obj.price?.amount) || 0;

	return Array.isArray(offerPart) ? offerPart.reduce((sum, item) => sum + getPriceAmount(item), 0) : getPriceAmount(offerPart);
}
