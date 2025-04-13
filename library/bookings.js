validateBookingResponse = function(offers, offerId, booking, state) {
	// Extract booking details
	var bookingId = booking.id;
	var createdOn = new Date(booking.createdOn);
	var confirmationTimeLimit = new Date(booking.confirmationTimeLimit);
	var bookedOffers = booking.bookedOffers;
	var passengerIdList = [];

	pm.globals.set("bookingId", bookingId);

	if (jsonData.booking && Array.isArray(jsonData.booking.passengers) && jsonData.booking.passengers.length > 0) {
		for (var i = 0; i < jsonData.booking.passengers.length; i++) {
			var passengerId = jsonData.booking.passengers[i].id;
			if (passengerId) {
				pm.globals.set("passengerId_" + i, passengerId);
				passengerIdList.push(passengerId);
			} else {
				validationLogger("[WARNING] Passenger at index " + i + " has no ID.");
			}
		}
	} else {
		validationLogger("[ERROR] Passengers structure is invalid or empty.");
	}
	pm.globals.set("passengerIdList", passengerIdList);
	// Log booking and offer information
	validationLogger("[INFO] Checking booking with Id : " + bookingId);
	validationLogger("[INFO] Offer Id : " + offerId);

	// Check if bookingId is returned
	pm.test("a bookingId is returned", function () {
		pm.expect(bookingId).to.be.a('string').and.not.be.empty;
	});

	// Check the creation date
	var currentDate = new Date();
	validationLogger("[INFO] CreatedOn specific date format is valid : " + currentDate);
	pm.test("Correct createdOn is returned", function () {
		pm.expect(currentDate.getDate()).to.equal(createdOn.getDate());
		pm.expect(currentDate.getMonth()).to.equal(createdOn.getMonth());
		pm.expect(currentDate.getFullYear()).to.equal(createdOn.getFullYear());
	});

	// TODO : Check if a confirmationTimeLimit is available to check
	if (booking.confirmationTimeLimit != undefined && booking.confirmationTimeLimit != null) {
		// Check the confirmationTimeLimit
		pm.test("a correct confirmationTimeLimit is returned", function () {
			var current = currentDate.getTime();
			var confirmation = confirmationTimeLimit.getTime();
			pm.expect(confirmation).to.be.above(current);
		});
	}

	// Find the correct offer from the list of offers
	var offer = null;
	offers.some(function (internalOffer) {
		if (internalOffer.offerId == offerId) {
			offer = internalOffer;
			return true;
		}
	});

	// If no correct offer is found, skip the rest of the validation
	if (offer == undefined || offer == null) {
		validationLogger("[INFO] No correct offer can be found, skipping rest of validation");
		return;
	} else {
		validationLogger("[INFO] Correct offer from offer response found, performing rest of validation");
	}

	validationLogger("[DEBUG] 🪲 BookedOffers: ", bookedOffers);
	validationLogger("[DEBUG] Offer: ", offer);
	validationLogger("[DEBUG] Booking: ", booking);
	validationLogger("[DEBUG] State: ", state);

	// Compare booked offers with the correct offer
	var found = bookedOffers.some(function (bookedOffer) {
		return compareOffers(bookedOffer, offer, booking, state);
	});

	// Check if the correct offer is returned
	pm.test("Correct offer " + offer.offerId + " is returned", function () {
		pm.expect(found).to.equal(true);
	});

	// Check that all the passengers match the passengers from the offer
	offer.passengerRefs.forEach(function (passenger) {
		var found = false;
		found = booking.passengers.some(function (bookedPassenger) {
			validationLogger("[INFO] Comparing bookedPassenger.externalRef = " + bookedPassenger.externalRef + " ⇔ Passenger ref = " + passenger);
			if (bookedPassenger.externalRef == passenger) {
				return true;
			}
		});

		// Check if the passenger is returned
		pm.test("passenger " + passenger + " returned", function () {
			pm.expect(found).to.equal(true);
		});

	});

};

// Function to compare booked offers with the provided offer and booking state
compareOffers = function(bookedOffer, offer, booking, state){
	validationLogger("[INFO] Comparing bookedOffer offerId = "+bookedOffer.offerId+" ⇔ offer offerId = "+offer.offerId);
	
	// Check if admissions are defined and compare them
	if((bookedOffer.admissions==undefined||bookedOffer.admissions==null||bookedOffer.admissions.length==0)&&
		(offer.admissionOfferParts==undefined||offer.admissionOfferParts==null||offer.admissionOfferParts.length==0)) {
		validationLogger("[INFO] Skipping admissions");
	} else {
		bookedOffer.admissions.forEach(function(bookedAdmission){
			checkGenericBookedOfferPart(bookedAdmission, state, "admissions");
			offer.admissionOfferParts.some(function(offeredAdmission){
				return compareAdmissions(bookedAdmission, offeredAdmission, booking);
			});
		});	
	}
	
	// Check if reservations are defined and compare them
	if((bookedOffer.reservations==undefined||bookedOffer.reservations==null||bookedOffer.reservations.length==0)&&
		(offer.reservationOfferParts==undefined||offer.reservationOfferParts==null||offer.reservationOfferParts.length==0)) {
		validationLogger("[INFO] Skipping reservations");
	} else {
		bookedOffer.reservations.forEach(function(bookedReservation){
			checkGenericBookedOfferPart(bookedReservation, state, "reservations");
			var found = offer.reservationOfferParts.some(function(offeredReservation){
				return compareReservations(bookedReservation, offeredReservation, booking);
			});
		});	
	}
	
	return true;
};

// Function to compare booked admissions with offered admissions
compareAdmissions = function(bookedAdmission, offeredAdmission, booking){
	validationLogger("[INFO] Comparing admission bookedAdmission.id = "+bookedAdmission.id+" ⇔ offeredAdmission.id = "+offeredAdmission.id);

	// Compare prices
	pm.test("Price of the admission should be correct", function () {
		pm.expect(bookedAdmission.price.amount).to.equal(offeredAdmission.price.amount);
		pm.expect(bookedAdmission.price.currency).to.equal(offeredAdmission.price.currency);
		pm.expect(bookedAdmission.price.scale).to.equal(offeredAdmission.price.scale);
	});

	// Compare products
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
	
	// Compare exchangeable property
	if(bookedAdmission.exchangeable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.exchangeable).to.equal(offeredAdmission.exchangeable);
		});
	}
	
	// Compare isReservationRequired property
	if(bookedAdmission.isReservationRequired!=undefined){
		pm.test("isReservationRequired should be set and similar to offered", function () {
			pm.expect(bookedAdmission.isReservationRequired).to.equal(offeredAdmission.isReservationRequired);
		});
	}
	
	// Compare isReusable property
	if(bookedAdmission.isReusable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.isReusable).to.equal(offeredAdmission.isReusable);
		});
	}
	
	// Compare offerMode property
	if(bookedAdmission.offerMode!=undefined){
		pm.test("offerMode should be set and similar to offered", function () {
			pm.expect(bookedAdmission.offerMode).to.equal(offeredAdmission.offerMode);
		});
	}
	
	// Compare refundable property
	if(bookedAdmission.refundable!=undefined){
		pm.test("refundable should be set and similar to offered", function () {
			pm.expect(bookedAdmission.refundable).to.equal(offeredAdmission.refundable);
		});
	}
	
	// Compare passengerIds with booking passengers
	pm.test("Correct passengers are part of the admission", function () {
		bookedAdmission.passengerIds.forEach(function(passengerId){
			var found = booking.passengers.some(function(bookedPassenger){
				if(passengerId==bookedPassenger.id){
					return true;
				}
			});
			pm.expect(found).to.equal(true);
		});
	});
	return true;
};

// Function to compare booked reservations with offered reservations
compareReservations = function(bookedReservation, offeredReservation, booking){
	validationLogger("[INFO] Comparing reservation bookedReservation.id = "+bookedReservation.id+" ⇔ offeredReservation.id = "+offeredReservation.id);
	
	// Compare prices
	pm.test("Price of the reservation should be correct", function () {
		pm.expect(bookedReservation.price.amount).to.equal(offeredReservation.price.amount);
		pm.expect(bookedReservation.price.currency).to.equal(offeredReservation.price.currency);
		pm.expect(bookedReservation.price.scale).to.equal(offeredReservation.price.scale);
	});
	
	// Compare products if available
	if(bookedReservation.products!=undefined&&bookedReservation.products!=null&&bookedReservation.products.length!=0){
		pm.test("Products of the reservation should be correct", function () {
			bookedReservation.products.forEach(function(bookedProduct){
				var found = offeredReservation.products.some(function(offeredProduct){
					if(bookedProduct.productId==offeredProduct.productId){
						return true;
					}
				});
				pm.expect(found).to.equal(true);
			});
		});
	}

	// Compare exchangeable property
	if(bookedReservation.exchangeable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedReservation.exchangeable).to.equal(offeredReservation.exchangeable);
		});
	}

	// Compare isReservationRequired property
	if(bookedReservation.isReservationRequired!=undefined){
		pm.test("isReservationRequired should be set and similar to offered", function () {
			pm.expect(bookedReservation.isReservationRequired).to.equal(offeredReservation.isReservationRequired);
		});
	}

	// Compare isReusable property
	if(bookedReservation.isReusable!=undefined){
		pm.test("Exchangable should be set and similar to offered", function () {
			pm.expect(bookedReservation.isReusable).to.equal(offeredReservation.isReusable);
		});
	}

	// Compare offerMode property
	if(bookedReservation.offerMode!=undefined){
		pm.test("offerMode should be set and similar to offered", function () {
			pm.expect(bookedReservation.offerMode).to.equal(offeredReservation.offerMode);
		});
	}

	// Compare refundable property
	if(bookedReservation.refundable!=undefined){
		pm.test("refundable should be set and similar to offered", function () {
			pm.expect(bookedReservation.refundable).to.equal(offeredReservation.refundable);
		});
	}

	// Compare passengerIds with booking passengers
	pm.test("Correct passengers are part of the reservation", function () {
		bookedReservation.passengerIds.forEach(function(passengerId){
			var found = booking.passengers.some(function(bookedPassenger){
				if(passengerId==bookedPassenger.id){
					return true;
				}
			});
			pm.expect(found).to.equal(true);
		});
	});
	return true;
};

// Function to compare ancillaries
compareAncillaries = function(ancillary1, ancillary2, booking){
	validationLogger("[INFO] Comparing ancillary = "+ancillary1.id+" ⇔ "+ ancillary2.id);
	return true;
};

// Function to check generic booked offer part
checkGenericBookedOfferPart = function(offerPart, state, textDescription){
	var currentDate = new Date();
	var createdOn = new Date(offerPart.createdOn);
	var confirmableUntil = new Date(offerPart.confirmableUntil);

	// Check createdOn date
	pm.test("Correct createdOn is returned on bookedofferpart " + textDescription, function () {
		pm.expect(currentDate.toDateString()).to.equal(createdOn.toDateString());
	});
	totalProvisionalOrBookingPrice += calculateTotalAmount(offerPart);

	// Check confirmableUntil date if state is PREBOOKED
	if(state=="PREBOOKED"){
		pm.test("a correct confirmableUntil is returned on bookedofferpart " + textDescription, function () {
			var current = currentDate.getTime();
			var confirmation = confirmableUntil.getTime();
			pm.expect(confirmation).to.be.above(current);
		});
	}

	// Check status
	pm.test("Correct status is returned on bookedofferpart " + textDescription + " : " + state, function () {
		pm.expect(offerPart.status).to.equal(state);
	});
};

// Function to calculate total amount of an offer part
function calculateTotalAmount(offerPart) {
	if (!offerPart || typeof offerPart !== 'object') {
		validationLogger("[ERROR] OfferPart not found.");
		return 0;
	}

	const objectTypes = ['Reservation', 'Admission', 'Fees', 'Fares', 'Ancillaries'];
	function getPriceAmount(obj) {
		if (objectTypes.includes(obj.objectType) && obj.price && typeof obj.price.amount === 'number') {
			return obj.price.amount;
		}
		return 0;
	}

	if (Array.isArray(offerPart)) {
		return offerPart.reduce((sum, item) => sum + getPriceAmount(item), 0);
	}

	return getPriceAmount(offerPart);
}