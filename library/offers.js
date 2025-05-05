// Function to validate offer response
validateOfferResponse = function (passengerSpecifications, searchCriteria, fulfillmentOptions, offers, trips) {
	// Test if offers are returned
	validationLogger("[INFO] 🔍 There are " + offers.length + " offer(s) available");

	let found = false;
	for (let offerIndex = 0; offerIndex < offers.length && !found; offerIndex++) {
		validationLogger("[INFO] Checking offer index : " + offerIndex);
		const offer = offers[offerIndex];

		const { foundAdmissions, foundAncillaries, foundReservations } = validateOfferParts(
			offer,
			passengerSpecifications,
			fulfillmentOptions,
			searchCriteria
		);

		found = validateScenario(foundAdmissions, foundAncillaries, foundReservations, trips, passengerSpecifications);
	}

	validateOfferSearchCriteria(trips);
	validateTripSpecifications(trips);
	validateAnonymousPassengerSpecifications();
	selectAndSetOffer(offers);
	handlePlaceSelection();
};

// Helper function to validate offer parts
function validateOfferParts(offer, passengerSpecifications, fulfillmentOptions, searchCriteria) {
	let foundAdmissions = 0;
	let foundAncillaries = 0;
	let foundReservations = 0;

	foundAdmissions = validateAdmissions(offer.admissionOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);
	foundAncillaries = validateAncillaries(offer.ancillaryOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);
	foundReservations = validateReservations(offer.reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions);

	validationLogger("[INFO] Admissions : " + foundAdmissions);
	validationLogger("[INFO] Ancillaries : " + foundAncillaries);
	validationLogger("[INFO] Reservations : " + foundReservations);

	return { foundAdmissions, foundAncillaries, foundReservations };
}

// Helper function to validate admissions
function validateAdmissions(admissionOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
    let foundAdmissions = 0;

    if (admissionOfferParts && Array.isArray(admissionOfferParts)) {
        for (const part of admissionOfferParts) {
            const hasMatchingPassenger = part.passengerRefs.some(passengerRef =>
                passengerSpecifications.some(passenger => passenger.externalRef === passengerRef)
            );
            if (hasMatchingPassenger) {
				pm.test(`AdmissionOfferParts currency matches searchCriteria currency (expected: ${searchCriteria.currency}, actual: ${part.price.currency})`, function () {
					pm.expect(part.price.currency).to.eql(searchCriteria.currency);
				});
                if (fulfillmentOptions) {
					const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
					const actualOptions = part.availableFulfillmentOptions || [];
					const correctFulfillmentOption = actualOptions.some(
						option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
					);
					pm.test(`AdmissionOfferParts fulfillments matches fulfillmentOptions fulfillments (expected: ${fulfillmentOptionRequested[0].type}/${fulfillmentOptionRequested[0].media}, actual: ${actualOptions.map(opt => `${opt.type}/${opt.media}`).join(', ')})`, function () {
						pm.expect(correctFulfillmentOption).to.eql(true);
					});
					
                }
				foundAdmissions++;
            }
        }
    }
    return foundAdmissions;
}

// Helper function to validate ancillaries
function validateAncillaries(ancillaryOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
	let foundAncillaries = 0;

	if (ancillaryOfferParts && Array.isArray(ancillaryOfferParts)) {
		for (const part of ancillaryOfferParts) {
			const hasMatchingPassenger = part.passengerRefs.some(passengerRef =>
				passengerSpecifications.some(passenger => passenger.externalRef === passengerRef)
			);
			if (hasMatchingPassenger) {
				pm.test(`AncillaryOfferParts currency matches searchCriteria currency (expected: ${searchCriteria.currency}, actual: ${part.price.currency})`, function () {
					pm.expect(part.price.currency).to.eql(searchCriteria.currency);
				});
				if (fulfillmentOptions) {
					const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
					const actualOptions = part.availableFulfillmentOptions || [];
					const correctFulfillmentOption = actualOptions.some(
						option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
					);
					pm.test(`AncillaryOfferParts fulfillments matches fulfillmentOptions fulfillments (expected: ${fulfillmentOptionRequested[0].type}/${fulfillmentOptionRequested[0].media}, actual: ${actualOptions.map(opt => `${opt.type}/${opt.media}`).join(', ')})`, function () {
						pm.expect(correctFulfillmentOption).to.eql(true);
					});
					
				}
				foundAncillaries++;
			}
		}
	}
	return foundAncillaries;
}

function validateReservations(reservationOfferParts, passengerSpecifications, searchCriteria, fulfillmentOptions) {
	let foundReservations = 0;

	if (reservationOfferParts && Array.isArray(reservationOfferParts)) {
		for (const part of reservationOfferParts) {
			const hasMatchingPassenger = part.passengerRefs.some(passengerRef =>
				passengerSpecifications.some(passenger => passenger.externalRef === passengerRef)
			);
			if (hasMatchingPassenger) {
				pm.test(`ReservationOfferParts currency matches searchCriteria currency (expected: ${searchCriteria.currency}, actual: ${part.price.currency})`, function () {
					pm.expect(part.price.currency).to.eql(searchCriteria.currency);
				});
				if (fulfillmentOptions) {
					const fulfillmentOptionRequested = JSON.parse(fulfillmentOptions);
					const actualOptions = part.availableFulfillmentOptions || [];
					const correctFulfillmentOption = actualOptions.some(
						option => option.type === fulfillmentOptionRequested[0].type && option.media === fulfillmentOptionRequested[0].media
					);
					pm.test(`ReservationOfferParts fulfillments matches fulfillmentOptions fulfillments (expected: ${fulfillmentOptionRequested[0].type}/${fulfillmentOptionRequested[0].media}, actual: ${actualOptions.map(opt => `${opt.type}/${opt.media}`).join(', ')})`, function () {
						pm.expect(correctFulfillmentOption).to.eql(true);
					});
					
				}
				foundReservations++;
			}
		}
	}
	return foundReservations;
}

// Helper function to validate scenario
function validateScenario(foundAdmissions, foundAncillaries, foundReservations, trips, passengerSpecifications) {
	//TODO : Check trips[0] if it is correct
	const legAmountsLength = trips[0].legs.length;
	const passengerAmounts = passengerSpecifications.length;
	const amounts = legAmountsLength * passengerAmounts;
	let allValid = true;
	if (foundAdmissions !== 0) {
		pm.test(`Correct admissions are returned (expected: ${amounts}, actual: ${foundAdmissions})`, function () {
			pm.expect(foundAdmissions).to.equal(amounts);
		});
		allValid = allValid && (foundAdmissions === amounts);
	}
	if (foundAncillaries !== 0) {
		pm.test(`Correct ancillaries are returned (expected: ${amounts}, actual: ${foundAncillaries})`, function () {
			pm.expect(foundAncillaries).to.equal(amounts);
		});
		allValid = allValid && (foundAncillaries === amounts);
	}
	if (foundReservations !== 0) {
		pm.test(`Correct reservations are returned (expected: ${amounts}, actual: ${foundReservations})`, function () {
			pm.expect(foundReservations).to.equal(amounts);
		});
		allValid = allValid && (foundReservations === amounts);
	}
	
	return allValid;
}

// Helper function to validate trip specifications
function validateTripSpecifications(trips) {
	if (pm.globals.get("offerTripSpecifications")) {
		const requiredTrip = JSON.parse(pm.globals.get("offerTripSpecifications"));
		pm.test("validateTripSpecifications : Trips are returned", function () {
			pm.expect(trips).not.to.be.empty;
			const found = trips.some(trip => {
				const legsFound = trip.legs.filter(leg =>
					requiredTrip[0].legs.some(requiredLeg =>
						requiredLeg.timedLeg.start.stopPlaceRef.stopPlaceRef === leg.timedLeg.start.stopPlaceRef.stopPlaceRef &&
						requiredLeg.timedLeg.end.stopPlaceRef.stopPlaceRef === leg.timedLeg.end.stopPlaceRef.stopPlaceRef &&
						requiredLeg.timedLeg.service.vehicleNumbers[0] === leg.timedLeg.service.vehicleNumbers[0] &&
						requiredLeg.timedLeg.service.carriers[0].ref === leg.timedLeg.service.carriers[0].ref
					)
				).length;
				return legsFound === requiredTrip[0].legs.length;
			});
			pm.test("Correct legs are returned", function () {
				pm.expect(found).to.equal(true);
			});
		});
	}
}

// Helper function to validate offer search criteria
function validateOfferSearchCriteria(trips) {
	if (pm.globals.get("offerTripSearchCriteria")) {
		pm.test("validateOfferSearchCriteria : Trips are returned", function () {
			pm.expect(trips).not.to.be.empty;
			//TODO : Correct validation of the trip search criteria ?
		});
	}
}

// Helper function to validate anonymous passenger specifications
function validateAnonymousPassengerSpecifications() {
	pm.test("validateAnonymousPassengerSpecifications : AnonymousPassengerSpecifications contain valid externalRef", function () {
		const response = pm.response.json();
		const specs = response.anonymousPassengerSpecifications;

		pm.expect(specs).to.be.an('array').that.is.not.empty;

		specs.forEach((spec, index) => {
			pm.expect(spec.externalRef, `Missing externalRef at index ${index}`).to.be.a('string').that.is.not.empty;
		});
	});
}


// Helper function to select and set the desired offer
function selectAndSetOffer(offers) {
	const desiredFlexibility = pm.globals.get("desiredFlexibility");
	const selectedOffers = offers.filter(offer => offer.offerSummary?.overallFlexibility === desiredFlexibility);
	const selectedOffer = selectedOffers.length > 0 ? selectedOffers[0] : offers[0];

	let allMatchingProducts = [];

	if (desiredFlexibility === null) {
		validationLogger("[INFO] DesiredFlexibility is not set, taking the 1st offer in the list");
	} else {
		validationLogger("[INFO] DesiredFlexibility for current scenario : " + desiredFlexibility);
		pm.test(`Selected offer has the expected overallFlexibility (expected: ${desiredFlexibility}, actual: ${selectedOffer.offerSummary?.overallFlexibility})`, function () {
			pm.expect(selectedOffer.offerSummary?.overallFlexibility).to.eql(desiredFlexibility);
		});
		offers.forEach((offer, offerIndex) => {
			const products = offer.products || [];
			const matchingProducts = products.filter(p => p.flexibility === desiredFlexibility);
			if (matchingProducts.length === 0) {
				console.warn(`[WARNING] No matching products found for offer ${offerIndex} with flexibility: ${desiredFlexibility}`);
			}
			matchingProducts.forEach((product, productIndex) => {
				console.log(`[INFO] Offer ${offerIndex} - Product ${productIndex}: flexibility: ${product.flexibility}, id: ${product.id}`);
			});
			allMatchingProducts = allMatchingProducts.concat(matchingProducts);
		});
		
		pm.test(`Total number of matching products with flexibility = ${desiredFlexibility} (found: ${allMatchingProducts.length})`, function () {
			pm.expect(allMatchingProducts.length, `Expected at least 1, but found ${allMatchingProducts.length}`).to.be.above(0);
		});
	}
	console.log("[INFO] 🔍 Selected offer : ", selectedOffer);
	pm.globals.set("offers", offers);
	pm.globals.set("offerId", selectedOffer.offerId);
	pm.globals.set("offer", selectedOffer);
}

// Helper function to handle place selection
function handlePlaceSelection() {
	if (pm.globals.get("requiresPlaceSelection") === true) {
		const reservationOfferPart = offer.reservationOfferParts[0];
		pm.globals.set("reservationId", reservationOfferPart.id);
	} else {
		validationLogger("skipping Get Place Maps for Reservation of Offer");
		pm.execution.setNextRequest("03. Create a Booking");
	}
}