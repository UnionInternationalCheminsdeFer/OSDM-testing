validateBookingResponse = function (offers, offerId, booking, state) {
	const bookingId = booking.id;
	const createdOn = new Date(booking.createdOn);
	const confirmationTimeLimit = new Date(booking.confirmationTimeLimit);
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

	validationLogger(`[INFO] Checking booking with Id: ${bookingId}`);
	validationLogger(`[INFO] Offer Id: ${offerId}`);

	pm.test("a bookingId is returned", () => {
		pm.expect(bookingId).to.be.a('string').and.not.be.empty;
	});

	const currentDate = new Date();
	validationLogger(`[INFO] CreatedOn specific date format is valid: ${currentDate}`);
	pm.test("Correct createdOn is returned", () => {
		pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
		pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
		pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
	});

	if (booking.confirmationTimeLimit) {
		pm.test("a correct confirmationTimeLimit is returned", () => {
			pm.expect(confirmationTimeLimit.getTime()).to.be.above(currentDate.getTime());
		});
	}

	const offer = offers.find(internalOffer => internalOffer.offerId === offerId);

	if (!offer) {
		validationLogger("[INFO] No correct offer can be found, skipping rest of validation");
		return;
	}

	validationLogger("[INFO] Correct offer from offer response found, performing rest of validation");
	validationLogger("[DEBUG] 🪲 BookedOffers: ", bookedOffers);
	validationLogger("[DEBUG] 🪲 Offer: ", offer);
	validationLogger("[DEBUG] 🪲 Booking: ", booking);
	validationLogger("[DEBUG] 🪲 State: ", state);

	const found = bookedOffers.some(bookedOffer => compareOffers(bookedOffer, offer, booking, state));

	pm.test(`Correct offer ${offer.offerId} is returned`, () => {
		pm.expect(found).to.equal(true);
	});

	offer.passengerRefs.forEach(passenger => {
		const found = booking.passengers.some(bookedPassenger => {
			return bookedPassenger.externalRef === passenger;
		});

		pm.test(`passenger ${passenger} returned`, () => {
			pm.expect(found).to.equal(true);
		});
	});
};

compareOffers = function (bookedOffer, offer, booking, state) {
	pm.test("Booked offerId matches offerId", function () {
		pm.expect(bookedOffer.offerId, "Comparing offerIds").to.eql(offer.offerId);
	});

	if (!bookedOffer.admissions?.length && !offer.admissionOfferParts?.length) {
		validationLogger("[INFO] Skipping admissions");
	} else {
		bookedOffer.admissions.forEach(bookedAdmission => {
			checkGenericBookedOfferPart(bookedAdmission, state, "admissions");
			offer.admissionOfferParts.some(offeredAdmission => compareAdmissions(bookedAdmission, offeredAdmission, booking));

		});
		pm.test("All booked admissions are matched in offered admissions", function () {
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

	if (!bookedOffer.reservations?.length && !offer.reservationOfferParts?.length) {
		validationLogger("[INFO] Skipping reservations");
	} else {
		bookedOffer.reservations.forEach(bookedReservation => {
			checkGenericBookedOfferPart(bookedReservation, state, "reservations");
			offer.reservationOfferParts.some(offeredReservation => compareReservations(bookedReservation, offeredReservation, booking));
		});
		pm.test("All booked reservations are matched in offered reservations", function () {
			const unmatched = [];
			bookedOffer.reservations.forEach(bookedReservation => {
				const match = offer.reservationOfferParts.find(offeredReservation => 
					offeredReservation.id === bookedReservation.id
				);
				if (!match) {
					unmatched.push(bookedAdmission.id);
				}
			});
			pm.expect(unmatched, `Unmatched reservation IDs: ${unmatched.join(", ")}`).to.be.empty;
		});
	}

	return true;
};

compareAdmissions = function (bookedAdmission, offeredAdmission, booking) {
	pm.test("Price of the admission should be correct", () => {
		pm.expect(bookedAdmission.price.amount).to.equal(offeredAdmission.price.amount);
		pm.expect(bookedAdmission.price.currency).to.equal(offeredAdmission.price.currency);
		pm.expect(bookedAdmission.price.scale).to.equal(offeredAdmission.price.scale);
	});
/*
	pm.test("Products of the admission should be correct", () => {
		bookedAdmission.products.forEach(bookedProduct => {
			const found = offeredAdmission.products.some(offeredProduct => {
				const match = bookedProduct.productId === offeredProduct.productId;
				if (!match) {
					validationLogger(`[WARNING] ⚠️ Product mismatch → booked: ${bookedProduct.productId} vs offered: ${offeredProduct.productId}`);
				}
				return match;
			});
	
			validationLogger(`[INFO] Looking for bookedProduct.productId = ${bookedProduct.productId} → Found: ${found}`);
			pm.expect(found, `Product ID ${bookedProduct.productId} should be in offeredAdmission`).to.equal(true);
		});
	});
*/
	pm.test("Products of the admission should be correct", function () {
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

	["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedAdmission[prop] !== undefined) {
			pm.test(`${prop} should be set and similar to offered`, () => {
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

compareReservations = function (bookedReservation, offeredReservation, booking) {
	pm.test("Price of the reservation should be correct", () => {
		pm.expect(bookedReservation.price.amount).to.equal(offeredReservation.price.amount);
		pm.expect(bookedReservation.price.currency).to.equal(offeredReservation.price.currency);
		pm.expect(bookedReservation.price.scale).to.equal(offeredReservation.price.scale);
	});

	if (bookedReservation.products?.length) {
		pm.test("Products of the reservation should be correct", () => {
			bookedReservation.products.forEach(bookedProduct => {
				const found = offeredReservation.products.some(offeredProduct => bookedProduct.productId === offeredProduct.productId);
				pm.expect(found).to.equal(true);
			});
		});
	}

	["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedReservation[prop] !== undefined) {
			pm.test(`${prop} should be set and similar to offered`, () => {
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
	const confirmableUntil = new Date(offerPart.confirmableUntil);

	pm.test(`Correct createdOn is returned on bookedofferpart ${textDescription}`, () => {
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});

	totalProvisionalOrBookingPrice += calculateTotalAmount(offerPart);

	if (state === "PREBOOKED") {
		pm.test(`a correct confirmableUntil is returned on bookedofferpart ${textDescription}`, () => {
			pm.expect(confirmableUntil.getTime()).to.be.above(currentDate.getTime());
		});
	}

	//TODO : check if correct for paxone and sqills ?
	var sandbox = pm.environment.get("api_base");
	if (sandbox.includes("paxone") && state !== "PREBOOKED") {
		pm.test(`Correct status is returned on bookedofferpart ${textDescription} : ${state}`, () => {
			pm.expect(["FULFILLED", "CONFIRMED"]).to.include(offerPart.status);
		});
	} else {
		pm.test(`Correct status is returned on bookedofferpart ${textDescription} : ${state}`, () => {
			pm.expect(offerPart.status).to.equal(state);
		});
	}
};

function calculateTotalAmount(offerPart) {
	if (!offerPart || typeof offerPart !== 'object') {
		validationLogger("[ERROR] OfferPart not found.");
		return 0;
	}

	const objectTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillaries'];
	const getPriceAmount = obj => (objectTypes.includes(obj.objectType) && obj.price?.amount) || 0;

	return Array.isArray(offerPart) ? offerPart.reduce((sum, item) => sum + getPriceAmount(item), 0) : getPriceAmount(offerPart);
}
