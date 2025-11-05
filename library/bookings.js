let totalProvisionalOrBookingPrice = 0;

postCreateBookingResponse = function (offers, offerId, booking, state) {
	const currentDate = new Date();
	const bookingId = booking.id;
	const createdOn = new Date(booking.createdOn);
	const bookedOffers = booking.bookedOffers;
	const passengerIdList = [];

	pm.environment.set("bookingId", bookingId);

	if (jsonData.booking?.passengers?.length > 0) {
		jsonData.booking.passengers.forEach((passenger, i) => {
			if (passenger.id) {
				pm.environment.set(`passengerId_${i}`, passenger.id);
				passengerIdList.push(passenger.id);
			} else {
				validationLogger(`[WARNING] ⚠️ Passenger at index ${i} has no ID.`);
			}
		});
	} else {
		validationLogger("[ERROR] Passengers structure is invalid or empty.");
	}
	pm.environment.set("passengerIdList", passengerIdList);
	pm.environment.set("passengerId", passengerIdList[0]); // For backward compatibility, set the first passenger ID
	
	pm.test("Booking Id is returned", () => {
		validationLogger(`[INFO] Booking Id: ${bookingId}`);
		pm.expect(bookingId).to.be.a('string').and.not.be.empty;
	});
	
	validationLogger(`[INFO] Offer Id: ${offerId}`);

	pm.test(`CreatedOn in booking is returned`, () => {
		validationLogger(`[FULL] currentDate: ${currentDate.toDateString()} vs createdOn: ${createdOn.toDateString()}`);
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});

	const offer = offers.find(internalOffer => internalOffer.offerId === offerId);

	if (!offer) {
		validationLogger("[INFO] No correct offer can be found, skipping rest of validation");
		return;
	} else {
		const found = bookedOffers.some(bookedOffer => compareOffers(bookedOffer, offer, booking, state));
	
		pm.test(`Correct offer ${offerId} is returned`, () => {
			validationLogger(`[INFO] offerFound: ${offerId}, found: ${found}`);
			pm.expect(found).to.equal(true);
		});
		validationLogger("[INFO] Correct offer from offer response found, performing rest of validation");
	}

	offer.passengerRefs.forEach(passenger => {
		const found = booking.passengers.some(bookedPassenger => {
			return bookedPassenger.externalRef === passenger;
		});

		pm.test(`Passenger ${passenger} returned`, () => {
			validationLogger(`[INFO] passengerRef: ${passenger}, found: ${found}`);
			pm.expect(found).to.equal(true);
		});
	});
};

compareOffers = function (bookedOffer, offer, booking, state) {
	validationLogger("[INFO] ➤ compareOffers");

	const partRefs = [];

	if (!bookedOffer?.admissions || !offer?.admissionOfferParts || !bookedOffer.admissions.length || !offer.admissionOfferParts.length) {
		validationLogger("[INFO] Skipping admissions");
	} else {
		bookedOffer.admissions.forEach(bookedAdmission => {
			checkGenericBookedOfferPart(bookedAdmission, state, "admissions");
			offer.admissionOfferParts.some(offeredAdmission => compareAdmissions(bookedAdmission, offeredAdmission, booking));
		});
	}

	if (!bookedOffer?.ancillaries || !offer?.ancillaryOfferParts || !bookedOffer.ancillaries.length || !offer.ancillaryOfferParts.length) {
		validationLogger("[INFO] Skipping ancillaries");
	} else {
		bookedOffer.ancillaries.forEach(bookedAncillary => {
			checkGenericBookedOfferPart(bookedAncillary, state, "ancillaries");
			offer.ancillaryOfferParts.some(offeredAncillary => compareAncillaries(bookedAncillary, offeredAncillary, booking));
		});
	}

	if (!bookedOffer?.reservations || !offer?.reservationOfferParts || !bookedOffer.reservations.length || !offer.reservationOfferParts.length) {
		validationLogger("[INFO] Skipping reservations");
	} else {
		bookedOffer.reservations.forEach(bookedReservation => {
			checkGenericBookedOfferPart(bookedReservation, state, "reservations");
			offer.reservationOfferParts.some(offeredReservation => compareReservations(bookedReservation, offeredReservation, booking));
		});
	}
	pm.environment.set("idsAdmissionAncillariesReservationReference", JSON.stringify(partRefs));
	return true;
};

compareAdmissions = function (bookedAdmission, offeredAdmission, booking) {
	validationLogger("[INFO] ➤➤➤ compareAdmissions");
	pm.test("Price of the admission should be set and similar to offer response", () => {
		validationLogger(`[INFO] Admission price: booked: ${bookedAdmission.price.amount}/${bookedAdmission.price.currency}/${bookedAdmission.price.scale} vs offered: ${offeredAdmission.price.amount}/${offeredAdmission.price.currency}/${offeredAdmission.price.scale}`);
		pm.expect(bookedAdmission.price.amount).to.equal(offeredAdmission.price.amount);
		pm.expect(bookedAdmission.price.currency).to.equal(offeredAdmission.price.currency);
		pm.expect(bookedAdmission.price.scale).to.equal(offeredAdmission.price.scale);
	});

	pm.test("Products of the admission should be set and similar to offer response", function () {
		for (var i = 0; i < bookedAdmission.products.length; i++) {
			var bookedProduct = bookedAdmission.products[i];
			var found = offeredAdmission.products.some(offeredProduct => bookedProduct.productId == offeredProduct.productId);
			validationLogger(`[INFO] Booked Admission Product ID ${bookedProduct.productId}, Offered Admission Product ID: ${found}`);
			pm.expect(found).to.equal(true);
		}
	});

	["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedAdmission[prop] !== undefined) {
			pm.test(`In admissions : ${prop} value should be set and similar to offer response`, () => {
				validationLogger(`[FULL] ${prop}: booked: ${bookedAdmission[prop]}, offered: ${offeredAdmission[prop]}`);
				pm.expect(bookedAdmission[prop]).to.equal(offeredAdmission[prop]);
			});
		}
	});

	pm.test("Correct passengers are part of the admission", () => {
		bookedAdmission.passengerIds.forEach(passengerId => {
			const found = booking.passengers.some(bookedPassenger => passengerId === bookedPassenger.id);
			validationLogger(`[INFO] PassengerId: ${passengerId}, found: ${found}`);
			pm.expect(found).to.equal(true);
		});
	});

	return true;
};


compareAncillaries = function (bookedAncillary, offeredAncillary, booking) {
	validationLogger("[INFO] ➤➤➤ compareAncillaries");
	pm.test("Price of the ancillary should be set and similar to offer response", () => {
		validationLogger(`[INFO] Ancillary price: booked: ${bookedAncillary.price.amount}/${bookedAncillary.price.currency}/${bookedAncillary.price.scale} vs offered: ${offeredAncillary.price.amount}/${offeredAncillary.price.currency}/${offeredAncillary.price.scale}`);
		pm.expect(bookedAncillary.price.amount).to.equal(offeredAncillary.price.amount);
		pm.expect(bookedAncillary.price.currency).to.equal(offeredAncillary.price.currency);
		pm.expect(bookedAncillary.price.scale).to.equal(offeredAncillary.price.scale);
	});

	//TODO : Work on this part, test below is failed and capture the wrong ancillary product

	/*pm.test("Products of the ancillary should be set and similar to offer response", function () {
		for (var i = 0; i < bookedAncillary.products.length; i++) {
			var bookedProduct = bookedAncillary.products[i];
			var found = false;
			for (var j = 0; j < offeredAncillary.products.length; j++) {
				var offeredProduct = offeredAncillary.products[j];
				if (bookedProduct.productId == offeredProduct.productId) {
					found = true;
					break;
				}
			}
			pm.expect(found).to.equal(true);
		}
	});*/

	/*["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedAncillary[prop] !== undefined) {
			pm.test(`In ancillaries : ${prop} value should be set and similar to offer response`, () => {
				pm.expect(bookedAncillary[prop]).to.equal(offeredAncillary[prop]);
			});
		}
	});*/

	pm.test("Correct passengers are part of the ancillary", () => {
		bookedAncillary.passengerIds.forEach(passengerId => {
			const found = booking.passengers.some(bookedPassenger => passengerId === bookedPassenger.id);
			validationLogger(`[INFO] Ancillary PassengerId: ${passengerId}, found: ${found}`);
			pm.expect(found).to.equal(true);
		});
	});

	return true;
};

compareReservations = function (bookedReservation, offeredReservation, booking) {
	validationLogger("[INFO] ➤➤➤ compareReservations");
	pm.test("Price of the reservation should be set and similar to offer response", () => {
		validationLogger(`[INFO] Reservation price: booked: ${bookedReservation.price.amount}/${bookedReservation.price.currency}/${bookedReservation.price.scale} vs offered: ${offeredReservation.price.amount}/${offeredReservation.price.currency}/${offeredReservation.price.scale}`);
		pm.expect(bookedReservation.price.amount).to.equal(offeredReservation.price.amount);
		pm.expect(bookedReservation.price.currency).to.equal(offeredReservation.price.currency);
		pm.expect(bookedReservation.price.scale).to.equal(offeredReservation.price.scale);
	});

	pm.test("Products of the reservation should be set and similar to offer response", function () {
		for (var i = 0; i < bookedReservation.products.length; i++) {
			var bookedProduct = bookedReservation.products[i];
			var found = offeredReservation.products.some(offeredProduct => bookedProduct.productId == offeredProduct.productId);
			validationLogger(`[INFO] Booked Reservation Product ID ${bookedProduct.productId}, Offered Reservation Product ID: ${found}`);
			pm.expect(found).to.equal(true);
		}
	});

	["exchangeable", "isReservationRequired", "isReusable", "offerMode", "refundable"].forEach(prop => {
		if (bookedReservation[prop] !== undefined) {
			pm.test(`In reservations : ${prop} value should be set and similar to offer response`, () => {
				validationLogger(`[FULL] Reservation ${prop}: booked: ${bookedReservation[prop]}, offered: ${offeredReservation[prop]}`);
				pm.expect(bookedReservation[prop]).to.equal(offeredReservation[prop]);
			});
		}
	});

	pm.test("Correct passengers are part of the reservation", () => {
		bookedReservation.passengerIds.forEach(passengerId => {
			const found = booking.passengers.some(bookedPassenger => passengerId === bookedPassenger.id);
			validationLogger(`[INFO] Reservation PassengerId: ${passengerId}, found: ${found}`);
			pm.expect(found).to.equal(true);
		});
	});

	return true;
};

checkGenericBookedOfferPart = function (bookedofferpart, state, textDescription) {
	validationLogger(`[INFO] ➤➤ checkGenericBookedOfferPart ${textDescription}`);
	const currentDate = new Date();
	const createdOn = new Date(bookedofferpart.createdOn);
	const validUntil = new Date(bookedofferpart.validUntil);
	const confirmableUntil = new Date(bookedofferpart.confirmableUntil);

	pm.test(`CreatedOn is returned on bookedofferpart ${textDescription}`, () => {
		validationLogger(`[FULL] ${textDescription}: currentDate: ${currentDate.toDateString()}, createdOn: ${createdOn.toDateString()}`);
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});

	pm.test(`ValidUntil is set for bookedofferpart ${textDescription}`, () => {
		validationLogger(`[FULL] ${textDescription}: validUntil: ${validUntil.toISOString()}, currentDate: ${currentDate.toISOString()}`);
		pm.expect(validUntil.getTime()).to.be.above(currentDate.getTime());
	});

	if (state === "PREBOOKED") {
		pm.test(`ConfirmableUntil is returned on bookedofferpart ${textDescription}`, () => {
			validationLogger(`[FULL] ${textDescription}: confirmableUntil: ${confirmableUntil.toISOString()}, currentDate: ${currentDate.toISOString()}`);
			pm.expect(confirmableUntil.getTime()).to.be.above(currentDate.getTime());
		});
		
		pm.test(`Correct status is returned on bookedofferpart ${textDescription} : ${bookedofferpart.status}`, () => {
			validationLogger(`[INFO] ${textDescription}: status: ${bookedofferpart.status}, expected=["PREBOOKED"]`);
			pm.expect(["PREBOOKED"]).to.include(bookedofferpart.status);
		});
	} else {
		pm.test(`Correct status is returned on bookedofferpart ${textDescription} : ${bookedofferpart.status}`, () => {
			validationLogger(`[INFO] ${textDescription}: status: ${bookedofferpart.status}, expected=["FULFILLED","CONFIRMED"]`);
			pm.expect(["FULFILLED", "CONFIRMED"]).to.include(bookedofferpart.status);
		});
	}

	// Set the total price in the environment
	totalProvisionalOrBookingPrice += calculateTotalAmount(bookedofferpart);
	pm.environment.set("totalProvisionalOrBookingPrice", totalProvisionalOrBookingPrice);
	extractAfterSaleFees(bookedofferpart, textDescription);	
};

function extractAfterSaleFees(bookedofferpart, textDescription) {
	validationLogger("[INFO] ➤➤➤ extractAfterSaleFees");
	const conditions = bookedofferpart.afterSalesConditions;
	let result = [];
	let index = 0;

	if (!Array.isArray(conditions)) {
		validationLogger(`[INFO] No afterSalesConditions found in bookedofferpart: ${textDescription}`);
		return;
	}
	if(pm.environment.get("scenarioType").includes("EXCHANGE")) {
		var cond = "EXCHANGE";
	}
	if(pm.environment.get("scenarioType").includes("REFUND")) {
		var cond = "REFUND";
	}
	for (let condition of conditions) {
		if (condition.condition === cond) {
			const fee = condition.afterSaleFee;
			if (fee && typeof fee.amount === "number" && fee.currency) {
				const conditionData = {
					condition: condition.condition,
					amount: fee.amount,
					currency: fee.currency
				};
				pm.environment.set(`afterSaleCondition_${textDescription}_amount`, fee.amount);
				pm.environment.set(`afterSaleCondition_${textDescription}_currency`, fee.currency);

				validationLogger(`[INFO] Set afterSaleCondition_${textDescription}_amount: ${fee.amount}, currency: ${fee.currency}`);
				result.push(conditionData);
				index++;
			}
		}
	}
}



// function calculateTotalAmount(offerPart) {
// 	// List of object types to include
// 	const objectTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillary'];

// 	// Function to get the amount if the object is of an allowed type
// 	function getPriceAmount(obj) {
// 		// Check if the object's type is in the allowed list
// 		if (objectTypes.includes(obj.objectType)) {
// 			const amount = obj.price?.amount || 0; // Ensure price exists before accessing amount
// 			console.log(`Type: ${obj.objectType} → Amount: ${amount}`);
// 			return amount;
// 		} else {
// 			console.log(`Type: ${obj.objectType} not included → Amount: 0`);
// 			return 0;
// 		}
// 	}

// 	// If offerPart is an array, calculate the sum of the amounts
// 	if (Array.isArray(offerPart)) {
// 		let total = 0;
// 		for (let item of offerPart) {
// 			total += getPriceAmount(item);
// 		}
// 		console.log(`Final total: ${total}`);
// 		return total;
// 	} else {
// 		// If it's not an array, handle it as a single object
// 		const amount = getPriceAmount(offerPart);
// 		console.log(`Total for a single object: ${amount}`);
// 		return amount;
// 	}
// }

function calculateTotalAmount(bookedOfferPart) {
	validationLogger("[INFO] ➤➤➤ calculateTotalAmount");
	const allowedTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillary'];
	let total = 0;

	const items = Array.isArray(bookedOfferPart) ? bookedOfferPart : [bookedOfferPart];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];

		if (allowedTypes.includes(item.objectType)) {
			const amount = item.price && item.price.amount ? item.price.amount : 0;
			total += amount;
		}
	}
	validationLogger(`[INFO] Calculating total amount for all sections Reservation, Admission, Fees, Fares, Ancillary :  ${total}`);
	return total;
}
